import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  variant?: 'light' | 'dark' | 'violet';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = false,
  variant = 'violet',
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-base font-bold',
    md: 'text-xl font-bold',
    lg: 'text-2xl font-black',
    xl: 'text-3xl font-black',
  };

  return (
    <div id="meetflow-brand-logo" className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Official MeetFlow Logo Icon: Dual Figures, Infinity Ribbon & Upward Arrow */}
      <div
        id="meetflow-logo-icon"
        className={`${iconSizes[size]} flex-shrink-0 flex items-center justify-center relative group drop-shadow-[0_2px_14px_rgba(109,93,245,0.45)]`}
      >
        <svg
          viewBox="0 0 240 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="mf-left-grad" x1="20%" y1="20%" x2="80%" y2="80%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b7cff" />
            </linearGradient>

            <linearGradient id="mf-right-grad" x1="20%" y1="20%" x2="80%" y2="80%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            <linearGradient id="mf-arrow-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#8b7cff" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>

          {/* Left Person Head */}
          <circle cx="85" cy="65" r="14" fill="#818cf8" />

          {/* Right Person Head */}
          <circle cx="155" cy="53" r="14" fill="#a78bfa" />

          {/* Left Person Loop */}
          <path
            d="M 85 86 C 62 86 44 104 44 127 C 44 150 62 168 85 168 C 105 168 120 152 120 132 C 120 110 105 86 85 86 Z"
            stroke="url(#mf-left-grad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Person Loop */}
          <path
            d="M 155 76 C 133 76 118 96 118 118 C 118 140 133 162 155 162 C 178 162 196 144 196 121 C 196 98 178 76 155 76 Z"
            stroke="url(#mf-right-grad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dynamic Swoosh Arrow Ribbon */}
          <path
            d="M 46 142 C 60 156 88 152 118 132 C 148 112 176 88 194 62"
            stroke="url(#mf-arrow-grad)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Arrow Head */}
          <polygon
            points="182,48 206,58 196,82"
            fill="#c084fc"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center tracking-tight leading-none lowercase">
            <span
              className={`${textSizes[size]} ${
                variant === 'dark'
                  ? 'text-slate-900'
                  : 'text-white'
              } font-bold`}
            >
              meet
            </span>
            <span
              className={`${textSizes[size]} bg-gradient-to-r from-[#8b7cff] via-[#a78bfa] to-[#c4b5fd] bg-clip-text text-transparent font-black`}
            >
              flow
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[10px] font-medium text-violet-300/80 tracking-wide uppercase mt-1">
              Accountable Action
            </span>
          )}
        </div>
      )}
    </div>
  );
};
