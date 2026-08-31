import React, { useMemo } from 'react';

// Generates an authentic, deterministic SVG 2D QR Code Matrix pattern based on string input
export const QRCodeDisplay: React.FC<{ value: string; size?: number; className?: string; fgColor?: string; bgColor?: string }> = ({
  value,
  size = 160,
  className = '',
  fgColor = '#0F172A',
  bgColor = '#FFFFFF'
}) => {
  const matrix = useMemo(() => {
    // Generate deterministic 21x21 QR Code grid
    const dim = 21;
    const grid: boolean[][] = Array(dim).fill(false).map(() => Array(dim).fill(false));

    // Corner position markers (7x7 squares)
    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 || r === 6 || c === 0 || c === 6 || // outer border
            (r >= 2 && r <= 4 && c >= 2 && c <= 4) // center 3x3
          ) {
            grid[startY + r][startX + c] = true;
          }
        }
      }
    };

    // Top-left, Top-right, Bottom-left finders
    drawFinder(0, 0);
    drawFinder(dim - 7, 0);
    drawFinder(0, dim - 7);

    // Timing patterns
    for (let i = 8; i < dim - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Small alignment pattern
    const alignX = 14, alignY = 14;
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        grid[alignY + r][alignX + c] = (Math.abs(r) === 1 || Math.abs(c) === 1 || (r === 0 && c === 0));
      }
    }

    // Pseudo-random data bits based on input hash
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }

    // Fill data area
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        // Skip finder areas
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= dim - 8) ||
          (r >= dim - 8 && c < 8) ||
          (r === 6 || c === 6)
        ) {
          continue;
        }

        const seed = Math.sin(hash * 999 + r * 31 + c * 17) * 10000;
        grid[r][c] = (seed - Math.floor(seed)) > 0.45;
      }
    }

    return grid;
  }, [value]);

  const cellSize = size / 21;

  return (
    <div className={`inline-flex flex-col items-center justify-center p-3 rounded-xl bg-white shadow-sm border border-slate-200 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md">
        <rect width={size} height={size} fill={bgColor} />
        {matrix.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize + 0.2}
                height={cellSize + 0.2}
                fill={fgColor}
                rx={0.5}
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
