/**
 * Self-check do QR Code real: gera a MESMA matriz que o QRCodeDisplay (src/components/VisualCodes.tsx)
 * desenha na tela do morador, renderiza como pixels RGBA (com quiet zone de 4 modulos) e decodifica
 * com jsQR — a mesma biblioteca usada na camera da Portaria (src/components/QrCodeScanner.tsx).
 * Prova que o token realmente sai e volta, sem precisar de camera fisica.
 *
 * Uso: node scripts/test-qr-roundtrip.cjs
 */
const QRCode = require('qrcode');
const jsQR = require('jsqr');

const QUIET_MODULES = 4;
const SCALE = 8; // pixels por modulo — simula uma foto de boa resolucao

function renderToImageData(value) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const dim = qr.modules.size;
  const total = dim + QUIET_MODULES * 2;
  const px = total * SCALE;

  const data = new Uint8ClampedArray(px * px * 4);
  data.fill(255); // fundo branco

  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      if (!qr.modules.get(r, c)) continue;
      const x0 = (c + QUIET_MODULES) * SCALE;
      const y0 = (r + QUIET_MODULES) * SCALE;
      for (let y = 0; y < SCALE; y++) {
        for (let x = 0; x < SCALE; x++) {
          const idx = ((y0 + y) * px + (x0 + x)) * 4;
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        }
      }
    }
  }
  return { data, width: px, height: px };
}

const casos = [
  'QR-B03A102-PKG001',
  'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c', // formato crypto.randomUUID()
  'QR-B12BA0999-PKGZZZZZZZZ'
];

let falhas = 0;
for (const value of casos) {
  const img = renderToImageData(value);
  const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  const ok = result && result.data === value;
  console.log(`${ok ? 'OK ' : 'FALHOU'} — "${value}" -> ${result ? `"${result.data}"` : '(nao decodificado)'}`);
  if (!ok) falhas++;
}

if (falhas > 0) {
  console.log(`\n=== RESULTADO: ${falhas} caso(s) falharam ===`);
  process.exit(1);
}
console.log('\n=== RESULTADO: QR real gera e decodifica corretamente (roundtrip OK) ===');
