import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'amber';
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  onClick,
}) => {
  const variantStyles = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    amber: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    outline: 'bg-transparent text-slate-400 border-slate-800',
  }[variant];

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
  }[size];

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-md border tracking-tight select-none',
        variantStyles,
        sizeStyles,
        onClick && 'cursor-pointer hover:opacity-80 active:scale-95 transition-transform',
        className
      )}
    >
      {children}
    </span>
  );
};
