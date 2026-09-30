import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'amber' | 'cyan';
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
  variant = 'amber',
}) => {
  const borderStyle =
    variant === 'amber'
      ? 'border-amber-500/20 shadow-[0_0_25px_rgba(229,169,60,0.08)]'
      : 'border-cyan-500/20 shadow-[0_0_25px_rgba(60,229,217,0.08)]';

  return (
    <div
      className={`relative backdrop-blur-xl bg-[#080b18]/70 border rounded-xl p-6 ${borderStyle} ${className}`}
    >
      {children}
    </div>
  );
};
