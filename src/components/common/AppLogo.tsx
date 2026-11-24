import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  variant?: 'squircle' | 'mark-only' | 'inverted';
  showText?: boolean;
  textClassName?: string;
}

/**
 * Pure SVG Apex Mark (Left Facet + Right Facet)
 * Geometric architectural monogram 'A' representing the summit/peak of financial freedom.
 */
export const ApexMark: React.FC<{
  size?: number;
  className?: string;
  leftColor?: string;
  rightColor?: string;
}> = ({
  size = 24,
  className = '',
  leftColor = 'currentColor',
  rightColor
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left Facet */}
      <path
        d="M 256 104 L 256 184 L 228 262 L 256 262 L 256 312 L 214 312 L 170 404 L 104 404 Z"
        fill={leftColor}
      />
      {/* Right Facet */}
      <path
        d="M 256 104 L 408 404 L 342 404 L 298 312 L 256 312 L 256 262 L 284 262 L 256 184 Z"
        fill={rightColor || leftColor}
        fillOpacity={rightColor ? 1 : 0.78}
      />
    </svg>
  );
};

/**
 * World-Class Apex Brand Logo with Squircle Container and Responsive Lighting
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  size = 32,
  className = '',
  variant = 'squircle',
  showText = false,
  textClassName = ''
}) => {
  if (variant === 'mark-only') {
    return (
      <div className={`inline-flex items-center gap-2 select-none ${className}`}>
        <ApexMark size={size} />
        {showText && (
          <span className={`font-bold tracking-tight text-zinc-900 dark:text-white ${textClassName}`}>
            Apex
          </span>
        )}
      </div>
    );
  }

  // Squircle Container Logo (Matching PWA Icon)
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        style={{ width: size, height: size }}
        className="relative flex-shrink-0 rounded-[22%] bg-zinc-950 dark:bg-[#09090B] border border-zinc-800/80 dark:border-zinc-700/60 shadow-sm flex items-center justify-center overflow-hidden transition-all duration-200"
      >
        <ApexMark
          size={Math.round(size * 0.72)}
          leftColor="#FFFFFF"
          rightColor="#D4D4D8"
        />
      </div>

      {showText && (
        <span className={`font-bold tracking-tight text-zinc-900 dark:text-white ${textClassName}`}>
          Apex
        </span>
      )}
    </div>
  );
};

export default AppLogo;
