import React from 'react';

/**
 * Lightweight SVG Corner Brackets Primitive
 * Provides subtle futuristic framing without solid heavy borders.
 * Pointer-events: none ensures non-blocking interaction.
 */
export const CornerBrackets: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 p-5 md:p-7 pointer-events-none z-10 flex flex-col justify-between"
    >
      {/* Top Corners */}
      <div className="flex justify-between items-start">
        {/* Top Left */}
        <svg className="w-5 h-5 text-amber-500/25" viewBox="0 0 20 20" fill="none">
          <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
        </svg>

        {/* Top Right */}
        <svg className="w-5 h-5 text-amber-500/25" viewBox="0 0 20 20" fill="none">
          <path d="M19 19V1H1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
        </svg>
      </div>

      {/* Bottom Corners */}
      <div className="flex justify-between items-end">
        {/* Bottom Left */}
        <svg className="w-5 h-5 text-amber-500/25" viewBox="0 0 20 20" fill="none">
          <path d="M1 1v18h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
        </svg>

        {/* Bottom Right */}
        <svg className="w-5 h-5 text-amber-500/25" viewBox="0 0 20 20" fill="none">
          <path d="M19 1v18H1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
        </svg>
      </div>
    </div>
  );
};
