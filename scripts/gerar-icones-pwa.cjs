/**
 * Gera todos os icones PWA do Village Azaleia com fundo VERDE de borda a borda,
 * sem nenhuma moldura branca nem transparencia nas bordas.
 *
 * POR QUE ISSO EXISTE: os PNGs anteriores tinham moldura branca (maskable: 77px,
 * apple-touch: 27px) e bordas transparentes nos pwa-*.png. No celular, o Android e o
 * iOS aplicam a propria mascara arredondada e a area transparente/branca aparecia
 * como "rebarba" branca em volta do icone na tela de inicio.
 *
 * Renderiza em Node puro (sem dependencia de sharp/canvas): desenha a flor da azaleia
 * por rasterizacao propria das formas e grava PNG RGB (sem canal alpha) via zlib.
 *
 * Uso: node scripts/gerar-icones-pwa.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Paleta oficial da marca
const VERDE_CLARO = [21, 70, 45];    // #15462D
const VERDE_MEIO = [13, 56, 35];     // #0D3823
const VERDE_ESCURO = [6, 29, 18];    // #061D12
const OURO_CLARO = [255, 242, 178];  // #FFF2B2
const OURO = [229, 193, 88];         // #E5C158
const OURO_ESCURO = [138, 107, 26];  // #8A6B1A
const ROSA_CLARO = [255, 96, 144];   // #FF6090
const ROSA = [216, 27, 96];          // #D81B60
const ROSA_ESCURO = [136, 14, 79];   // #880E4F

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/** Gradiente diagonal do fundo verde (canto sup-esq -> canto inf-dir) */
function corDeFundo(x, y, size) {
  const t = (x / size + y / size) / 2;
  return t < 0.55 ? mix(VERDE_CLARO, VERDE_MEIO, t / 0.55) : mix(VERDE_MEIO, VERDE_ESCURO, (t - 0.55) / 0.45);
}

/**
 * A flor e composta por elipses rotacionadas (petalas) — mesma silhueta do
 * emblema oficial em src/components/VillageAzaleiaLogo.tsx.
 * Cada petala: centro, raios, rotacao.
 */
function construirPetalas(cx, cy, escala) {
  // Leque de 5 petalas do emblema: 1 central pontuda no topo, 2 laterais superiores
  // e 2 laterais inferiores mais abertas — mesma silhueta do VillageAzaleiaLogo.
  const defs = [
    { graus: 0, dist: 30, rx: 21, ry: 42, principal: true },
    { graus: -47, dist: 30, rx: 19, ry: 34, principal: false },
    { graus: 47, dist: 30, rx: 19, ry: 34, principal: false },
    { graus: -96, dist: 27, rx: 17, ry: 31, principal: false },
    { graus: 96, dist: 27, rx: 17, ry: 31, principal: false }
  ];
  return defs.map((d) => {
    const rad = (d.graus * Math.PI) / 180;
    return {
      cx: cx + Math.sin(rad) * d.dist * escala,
      cy: cy - Math.cos(rad) * d.dist * escala,
      rx: d.rx * escala,
      ry: d.ry * escala,
      rot: rad,
      principal: d.principal
    };
  });
}

/** Testa se o ponto esta dentro da elipse rotacionada; devolve distancia normalizada (0=centro, 1=borda) */
function dentroDaPetala(x, y, p) {
  const dx = x - p.cx;
  const dy = y - p.cy;
  const cos = Math.cos(-p.rot);
  const sin = Math.sin(-p.rot);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.sqrt((lx / p.rx) ** 2 + (ly / p.ry) ** 2);
}

/** Renderiza um icone quadrado e devolve buffer RGB (3 bytes por pixel, sem alpha) */
function renderizarIcone(size, { margem = 0.16 } = {}) {
  const px = Buffer.alloc(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;
  const escala = (size * (1 - margem * 2)) / 200;
  const petalas = construirPetalas(cx, cy + size * 0.04, escala);
  const SS = 3; // supersampling 3x3 para bordas suaves (antialiasing)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px1 = x + (sx + 0.5) / SS;
          const py1 = y + (sy + 0.5) / SS;
          let cor = corDeFundo(px1, py1, size);

          // Desenha as petalas de tras para frente (a central por ultimo, fica na frente)
          const ordenadas = [...petalas].sort((a, b2) => (a.principal ? 1 : 0) - (b2.principal ? 1 : 0));
          for (const p of ordenadas) {
            const d = dentroDaPetala(px1, py1, p);
            if (d <= 1.0) {
              const bordaOuro = d > 0.87;
              if (bordaOuro) {
                // Contorno dourado da petala
                const t = (d - 0.87) / 0.13;
                cor = mix(OURO_CLARO, OURO_ESCURO, t);
              } else {
                // Preenchimento rosa com degrade vertical dentro da petala
                const t = Math.max(0, Math.min(1, (py1 - (p.cy - p.ry)) / (p.ry * 2)));
                const base = p.principal ? mix(ROSA_CLARO, ROSA, Math.min(1, t * 1.6)) : mix(ROSA, ROSA_ESCURO, t);
                cor = mix(base, ROSA_ESCURO, Math.max(0, (d - 0.6) / 0.4) * 0.45);
              }
            }
          }

          // Estames dourados: 5 filetes saindo do centro com contas nas pontas
          const baseX = cx;
          const baseY = cy + size * 0.04 + 6 * escala;
          for (const ang of [0, -26, 26, -50, 50]) {
            const rad = (ang * Math.PI) / 180;
            const comp = (ang === 0 ? 30 : Math.abs(ang) < 30 ? 26 : 22) * escala;
            const pontaX = baseX + Math.sin(rad) * comp;
            const pontaY = baseY - Math.cos(rad) * comp;
            // conta dourada na ponta
            if (Math.hypot(px1 - pontaX, py1 - pontaY) < 3.4 * escala) {
              cor = mix(OURO_CLARO, OURO_ESCURO, Math.hypot(px1 - pontaX, py1 - pontaY) / (3.4 * escala));
            }
            // filete: distancia ponto-segmento
            const vx = pontaX - baseX, vy = pontaY - baseY;
            const t = Math.max(0, Math.min(1, ((px1 - baseX) * vx + (py1 - baseY) * vy) / (vx * vx + vy * vy)));
            if (Math.hypot(px1 - (baseX + vx * t), py1 - (baseY + vy * t)) < 1.1 * escala) {
              cor = mix(OURO, OURO_ESCURO, 0.35);
            }
          }

          r += cor[0]; g += cor[1]; b += cor[2];
        }
      }

      const n = SS * SS;
      const i = (y * size + x) * 3;
      px[i] = Math.round(r / n);
      px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n);
    }
  }
  return px;
}

/** Codifica RGB cru como PNG colorType=2 (RGB puro, SEM canal alpha -> impossivel ter rebarba) */
function gravarPng(caminho, size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro "None"
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo, dados) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corpo));
    return Buffer.concat([len, corpo, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colorType 2 = RGB sem alpha
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(caminho, png);
  return png.length;
}

const alvos = [
  { arquivo: 'pwa-64x64.png', size: 64, margem: 0.14 },
  { arquivo: 'pwa-192x192.png', size: 192, margem: 0.14 },
  { arquivo: 'pwa-512x512.png', size: 512, margem: 0.14 },
  // maskable: a flor fica na "safe zone" central (40% do raio), o verde ocupa o resto
  { arquivo: 'maskable-icon-512x512.png', size: 512, margem: 0.26 },
  { arquivo: 'apple-touch-icon-180x180.png', size: 180, margem: 0.12 }
];

console.log('=== Gerando icones PWA com fundo verde de borda a borda ===');
for (const alvo of alvos) {
  const rgb = renderizarIcone(alvo.size, { margem: alvo.margem });
  const bytes = gravarPng(path.join(PUBLIC_DIR, alvo.arquivo), alvo.size, rgb);
  console.log(`OK  ${alvo.arquivo.padEnd(34)} ${alvo.size}x${alvo.size}  ${(bytes / 1024).toFixed(1)} KB  (RGB sem alpha)`);
}
console.log('\n=== Concluido: nenhum icone tem transparencia ou borda branca ===');
