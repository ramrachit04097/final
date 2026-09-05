import React, { useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

interface GlowingEdgeCardProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  glowColor?: string; // hex or rgb
  tilt?: boolean;
  volumetric?: boolean;
  maxTiltX?: number; // degrees
  maxTiltY?: number; // degrees
  onClick?: () => void;
  id?: string;
  interactive?: boolean;
  selected?: boolean;
  style?: React.CSSProperties;
}

export const GlowingEdgeCard: React.FC<GlowingEdgeCardProps> = ({
  children,
  className = '',
  contentClassName = '',
  glowColor = '#8b7cff',
  tilt = false,
  volumetric = false,
  maxTiltX = 9,
  maxTiltY = 12,
  onClick,
  id,
  interactive = true,
  selected = false,
  style = {},
}) => {
  const { theme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; relX: number; relY: number }>({
    x: 0,
    y: 0,
    relX: 0.5,
    relY: 0.5,
  });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [tiltTransform, setTiltTransform] = useState<string>('');

  // Track cursor position on the card
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relX = Math.max(0, Math.min(1, x / rect.width));
    const relY = Math.max(0, Math.min(1, y / rect.height));

    setMousePos({ x, y, relX, relY });

    if (tilt && theme === 'dark') {
      // Calculate rotation angles
      const rotX = (0.5 - relY) * (maxTiltX * 2);
      const rotY = (relX - 0.5) * (maxTiltY * 2);
      setTiltTransform(
        `perspective(1350px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(${isHovered ? '8px' : '0px'})`
      );
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (tilt && theme === 'dark') {
      setTiltTransform('perspective(1350px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
    }
  };

  if (theme === 'light') {
    return (
      <div
        ref={cardRef}
        id={id}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`glowing-edge-card relative rounded-2xl bg-white border border-[#E5E7EB] transition-all duration-200 ${
          onClick ? 'cursor-pointer' : ''
        } ${
          selected
            ? 'ring-2 ring-[#6366F1] border-[#6366F1] shadow-[0_4px_20px_rgba(99,102,241,0.15)]'
            : isHovered
            ? 'border-[#D1D5DB] shadow-[0_8px_24px_rgba(15,23,42,0.06)] -translate-y-[1px]'
            : 'shadow-[0_4px_16px_rgba(15,23,42,0.04)]'
        } ${className}`}
        style={style}
      >
        <div
          className={`relative rounded-2xl bg-white w-full ${
            contentClassName ? contentClassName : 'h-full overflow-hidden'
          }`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      id={id}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative group rounded-2xl transition-all duration-300 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={{
        transform: tilt ? tiltTransform : undefined,
        transformStyle: 'preserve-3d',
        transition: isHovered
          ? 'transform 0.12s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.3s ease'
          : 'transform 0.5s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.3s ease',
        ...style,
      }}
    >
      {/* 1. Outer Glow halo reacting to cursor proximity */}
      <div
        className="absolute -inset-px rounded-2xl pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovered || selected ? 1 : 0,
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}33, transparent 65%)`,
          zIndex: 0,
        }}
      />

      {/* 2. Cursor-following perimeter border highlight */}
      <div
        className="absolute -inset-px rounded-2xl pointer-events-none transition-opacity duration-200"
        style={{
          opacity: isHovered || selected ? 0.9 : 0.25,
          background: `radial-gradient(220px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}, transparent 70%)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          padding: '1px',
          zIndex: 1,
        }}
      />

      {/* 3. Base subtle static border */}
      <div
        className={`absolute inset-0 rounded-2xl border transition-colors duration-300 pointer-events-none ${
          selected
            ? 'border-violet-500/60 shadow-[0_0_24px_rgba(109,93,245,0.25)]'
            : isHovered
            ? 'border-violet-500/40'
            : 'border-violet-900/25'
        }`}
        style={{ zIndex: 1 }}
      />

      {/* 4. Volumetric thickness layers when requested */}
      {volumetric && (
        <>
          <div
            className="absolute inset-0 rounded-2xl bg-[#090710] pointer-events-none"
            style={{
              transform: 'translateZ(-10px)',
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.85)',
              zIndex: -1,
            }}
          />
          <div
            className="absolute inset-0 rounded-2xl bg-[#120e24] pointer-events-none"
            style={{
              transform: 'translateZ(-5px)',
              zIndex: -1,
            }}
          />
        </>
      )}

      {/* 5. Internal surface layer with subtle dark glassmorphism */}
      <div
        className={`relative z-2 rounded-2xl bg-[#0d0a16]/85 backdrop-blur-xl w-full ${
          contentClassName ? contentClassName : 'h-full overflow-hidden'
        }`}
        style={{
          transform: tilt ? 'translateZ(4px)' : undefined,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Subtle top inner edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent pointer-events-none" />

        {/* Ambient subtle inner glow */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, ${glowColor}15 0%, transparent 70%)`,
            opacity: isHovered ? 0.9 : 0.3,
          }}
        />

        {children}
      </div>
    </div>
  );
};
