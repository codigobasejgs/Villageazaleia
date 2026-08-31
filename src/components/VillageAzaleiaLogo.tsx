import React from 'react';

interface LogoProps {
  variant?: 'full' | 'horizontal' | 'icon' | 'badge' | 'light-horizontal';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const VillageAzaleiaLogo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = ''
}) => {
  // SVG Icon representing the 3D-embossed Azaleia Flower of the official emblem
  const AzaleiaFlowerIcon = ({ iconSize = 40 }: { iconSize?: number }) => (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-md select-none shrink-0"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2B2" />
          <stop offset="35%" stopColor="#E5C158" />
          <stop offset="70%" stopColor="#C5A059" />
          <stop offset="100%" stopColor="#8A6B1A" />
        </linearGradient>

        <linearGradient id="pinkCenter" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF6090" />
          <stop offset="30%" stopColor="#E91E63" />
          <stop offset="85%" stopColor="#D81B60" />
          <stop offset="100%" stopColor="#880E4F" />
        </linearGradient>

        <linearGradient id="pinkSide" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F06292" />
          <stop offset="40%" stopColor="#D81B60" />
          <stop offset="100%" stopColor="#7B0D47" />
        </linearGradient>

        <linearGradient id="pinkBottom" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E91E63" />
          <stop offset="100%" stopColor="#640837" />
        </linearGradient>

        <linearGradient id="greenBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B5E39" />
          <stop offset="50%" stopColor="#0D3823" />
          <stop offset="100%" stopColor="#061D12" />
        </linearGradient>

        <filter id="emboss3d" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      <g filter="url(#emboss3d)">
        {/* BOTTOM PETAL / BASE WING */}
        <path
          d="M 50 135 C 75 160, 125 160, 150 135 C 130 148, 70 148, 50 135 Z"
          fill="url(#greenBorderGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="3"
        />
        <path
          d="M 60 135 C 80 152, 120 152, 140 135 C 122 144, 78 144, 60 135 Z"
          fill="url(#pinkBottom)"
        />

        {/* LOWER SIDE PETALS */}
        <path
          d="M 25 110 C 25 80, 75 75, 100 100 C 65 115, 35 125, 25 110 Z"
          fill="url(#greenBorderGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="3"
        />
        <path
          d="M 33 107 C 35 86, 73 82, 92 101 C 65 112, 42 118, 33 107 Z"
          fill="url(#pinkSide)"
        />

        <path
          d="M 175 110 C 175 80, 125 75, 100 100 C 135 115, 165 125, 175 110 Z"
          fill="url(#greenBorderGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="3"
        />
        <path
          d="M 167 107 C 165 86, 127 82, 108 101 C 135 112, 158 118, 167 107 Z"
          fill="url(#pinkSide)"
        />

        {/* UPPER SIDE PETALS */}
        <path
          d="M 45 75 C 40 45, 85 45, 100 80 C 75 75, 55 70, 45 75 Z"
          fill="url(#greenBorderGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="3"
        />
        <path
          d="M 52 72 C 48 51, 80 51, 94 77 C 75 73, 60 69, 52 72 Z"
          fill="url(#pinkSide)"
        />

        <path
          d="M 155 75 C 160 45, 115 45, 100 80 C 125 75, 145 70, 155 75 Z"
          fill="url(#greenBorderGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="3"
        />
        <path
          d="M 148 72 C 152 51, 120 51, 106 77 C 125 73, 140 69, 148 72 Z"
          fill="url(#pinkSide)"
        />

        {/* MAIN CENTRAL POINTED PETAL */}
        <path
          d="M 100 20 C 125 50, 130 90, 100 135 C 70 90, 75 50, 100 20 Z"
          fill="url(#greenBorderGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="3.5"
        />
        <path
          d="M 100 26 C 120 52, 123 87, 100 128 C 77 87, 80 52, 100 26 Z"
          fill="url(#pinkCenter)"
        />

        {/* GOLD PISTILS / STAMENS (5 with golden beads) */}
        {/* Center */}
        <line x1="100" y1="115" x2="100" y2="60" stroke="#0D3823" strokeWidth="2.5" />
        <circle cx="100" cy="58" r="5" fill="url(#goldGrad)" stroke="#061D12" strokeWidth="1" />
        
        {/* Left inner */}
        <path d="M 100 115 Q 92 90 88 70" stroke="#0D3823" strokeWidth="2" fill="none" />
        <circle cx="88" cy="69" r="4" fill="url(#goldGrad)" stroke="#061D12" strokeWidth="1" />

        {/* Right inner */}
        <path d="M 100 115 Q 108 90 112 70" stroke="#0D3823" strokeWidth="2" fill="none" />
        <circle cx="112" cy="69" r="4" fill="url(#goldGrad)" stroke="#061D12" strokeWidth="1" />

        {/* Left outer */}
        <path d="M 100 115 Q 82 98 76 82" stroke="#0D3823" strokeWidth="2" fill="none" />
        <circle cx="76" cy="82" r="3.5" fill="url(#goldGrad)" stroke="#061D12" strokeWidth="1" />

        {/* Right outer */}
        <path d="M 100 115 Q 118 98 124 82" stroke="#0D3823" strokeWidth="2" fill="none" />
        <circle cx="124" cy="82" r="3.5" fill="url(#goldGrad)" stroke="#061D12" strokeWidth="1" />
      </g>
    </svg>
  );

  // Icon only
  if (variant === 'icon') {
    const sizeMap = { xs: 24, sm: 32, md: 42, lg: 56, xl: 72 };
    return <AzaleiaFlowerIcon iconSize={sizeMap[size]} />;
  }

  // Full official crest emblem (as shown on the logo sign)
  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        {/* Top Header: RESIDENCIAL */}
        <div className="w-full max-w-[260px] flex items-center justify-center gap-2 mb-1">
          <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-[#D4AF37]" />
          <span className="font-brand font-extrabold tracking-[0.28em] text-xs sm:text-sm text-[#0D3823] drop-shadow-sm px-1">
            RESIDENCIAL
          </span>
          <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[#D4AF37] to-[#D4AF37]" />
        </div>

        {/* Gold Bar */}
        <div className="w-full max-w-[240px] h-[3px] bg-gradient-to-r from-[#C5A059] via-[#FFF2B2] to-[#C5A059] rounded-full shadow-sm mb-2" />

        {/* Flower Emblem */}
        <div className="my-1 py-1">
          <AzaleiaFlowerIcon iconSize={size === 'xl' ? 120 : size === 'lg' ? 95 : 80} />
        </div>

        {/* Gold Bar */}
        <div className="w-full max-w-[240px] h-[3px] bg-gradient-to-r from-[#C5A059] via-[#FFF2B2] to-[#C5A059] rounded-full shadow-sm mt-2 mb-1" />

        {/* Main Title: VILLAGE AZALEIA */}
        <div className="flex flex-col items-center">
          <span className="font-brand font-black text-xl sm:text-2xl tracking-[0.2em] text-[#0D3823] drop-shadow leading-tight">
            VILLAGE
          </span>
          <span className="font-brand font-black text-2xl sm:text-3xl tracking-[0.22em] text-[#0D3823] drop-shadow leading-tight -mt-1">
            AZALEIA
          </span>
        </div>

        {/* Gold Bottom Bar */}
        <div className="w-full max-w-[260px] h-[2.5px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent rounded-full mt-2" />
      </div>
    );
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#061D12] to-[#0D3823] border border-[#D4AF37]/50 shadow-md ${className}`}
      >
        <AzaleiaFlowerIcon iconSize={22} />
        <div className="flex flex-col leading-none">
          <span className="font-brand font-bold text-[10px] tracking-wider text-[#FFF2B2]">
            RESIDENCIAL
          </span>
          <span className="font-brand font-extrabold text-xs tracking-wider text-white">
            VILLAGE AZALEIA
          </span>
        </div>
      </div>
    );
  }

  // Light-horizontal variant (For light backgrounds)
  if (variant === 'light-horizontal') {
    return (
      <div className={`flex items-center gap-2.5 select-none ${className}`}>
        <div className="p-1 rounded-xl bg-white border border-[#D4AF37]/40 shadow-sm">
          <AzaleiaFlowerIcon iconSize={size === 'sm' ? 28 : size === 'lg' ? 44 : 36} />
        </div>
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-brand font-bold text-[9px] sm:text-[10px] tracking-[0.2em] text-[#D81B60] uppercase">
              Residencial
            </span>
            <div className="w-6 h-[1px] bg-[#D4AF37]" />
          </div>
          <span className="font-brand font-extrabold text-sm sm:text-base tracking-[0.12em] text-[#0D3823]">
            VILLAGE AZALEIA
          </span>
        </div>
      </div>
    );
  }

  // Default: Horizontal Dark Bar (for Header / Nav)
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative p-1 rounded-xl bg-gradient-to-b from-[#0D3823] to-[#061D12] border border-[#D4AF37]/50 shadow-md shadow-black/30">
        <AzaleiaFlowerIcon iconSize={size === 'sm' ? 26 : size === 'lg' ? 42 : 34} />
      </div>
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="font-brand font-bold text-[9px] sm:text-[10px] tracking-[0.25em] text-[#E5C158] uppercase">
            Residencial
          </span>
          <div className="w-6 h-[1px] bg-[#D4AF37]/60" />
        </div>
        <span className="font-brand font-black text-sm sm:text-base tracking-[0.14em] text-white">
          VILLAGE AZALEIA
        </span>
      </div>
    </div>
  );
};
