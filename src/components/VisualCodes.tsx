import React, { useMemo } from 'react';
import QRCode from 'qrcode';

/**
 * QR Code real (biblioteca `qrcode`, matriz gerada via QRCode.create — síncrono,
 * sem I/O) — renderizado como SVG de células, mesmo estilo visual de antes.
 *
 * ATENÇÃO: a versão anterior deste componente desenhava um padrão SVG decorativo
 * (hash pseudo-aleatório) que SÓ PARECIA um QR Code — não continha nenhuma
 * codificação Reed-Solomon real, então nenhum leitor (câmera da portaria, jsQR)
 * jamais conseguiria decodificá-lo. Era a causa raiz do porteiro nunca
 * conseguir escanear o QR do morador.
 */
export const QRCodeDisplay: React.FC<{ value: string; size?: number; className?: string; fgColor?: string; bgColor?: string }> = ({
  value,
  size = 160,
  className = '',
  fgColor = '#0F172A',
  bgColor = '#FFFFFF'
}) => {
  const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'M' }), [value]);
  const dim = qr.modules.size;
  // Quiet zone de 4 módulos (mínimo da spec ISO/IEC 18004) desenhada dentro do próprio
  // SVG — não depender só do padding CSS ao redor, porque quem lê é a câmera de OUTRO
  // aparelho fotografando a tela, e sem essa margem branca o detector do leitor falha.
  const QUIET_MODULES = 4;
  const totalModules = dim + QUIET_MODULES * 2;
  const cellSize = size / totalModules;

  return (
    <div className={`inline-flex flex-col items-center justify-center p-3 rounded-xl bg-white shadow-sm border border-slate-200 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md">
        <rect width={size} height={size} fill={bgColor} />
        {Array.from({ length: dim }).map((_, r) =>
          Array.from({ length: dim }).map((_, c) =>
            qr.modules.get(r, c) ? (
              <rect
                key={`${r}-${c}`}
                x={(c + QUIET_MODULES) * cellSize}
                y={(r + QUIET_MODULES) * cellSize}
                width={cellSize + 0.2}
                height={cellSize + 0.2}
                fill={fgColor}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};

// Generates a clean Code128-like Barcode SVG
export const BarcodeDisplay: React.FC<{ value: string; className?: string; height?: number }> = ({
  value,
  className = '',
  height = 42
}) => {
  const bars = useMemo(() => {
    // Generate deterministic bar widths based on tracking code
    const list: { width: number; isSpace: boolean }[] = [];
    // Start guard
    list.push({ width: 2, isSpace: false });
    list.push({ width: 1, isSpace: true });
    list.push({ width: 2, isSpace: false });

    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      const w1 = ((code % 3) + 1);
      const s1 = (((code >> 1) % 2) + 1);
      const w2 = (((code >> 2) % 3) + 1);
      const s2 = (((code >> 3) % 2) + 1);

      list.push({ width: w1, isSpace: false });
      list.push({ width: s1, isSpace: true });
      list.push({ width: w2, isSpace: false });
      list.push({ width: s2, isSpace: true });
    }

    // Stop guard
    list.push({ width: 3, isSpace: false });
    list.push({ width: 1, isSpace: true });
    list.push({ width: 2, isSpace: false });

    return list;
  }, [value]);

  const totalWidth = bars.reduce((acc, b) => acc + b.width, 0);

  let currentX = 0;

  return (
    <div className={`inline-flex flex-col items-center bg-white px-3 py-2 rounded-lg border border-slate-200 ${className}`}>
      <svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`} preserveAspectRatio="none" className="w-full">
        {bars.map((bar, idx) => {
          const x = currentX;
          currentX += bar.width;
          if (bar.isSpace) return null;
          return (
            <rect
              key={idx}
              x={x}
              y={0}
              width={bar.width}
              height={height}
              fill="#1E293B"
            />
          );
        })}
      </svg>
      <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-600 mt-1 uppercase">
        {value}
      </span>
    </div>
  );
};
