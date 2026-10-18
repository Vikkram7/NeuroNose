import React from 'react';
import clsx from 'clsx';

export type BadgeVariant =
  | 'ONLINE'
  | 'OFFLINE'
  | 'CALIBRATING'
  | 'ERROR'
  | 'CRITICAL'
  | 'WARNING'
  | 'INFO'
  | 'OK'
  | 'VALID'
  | 'EXPIRED'
  | 'DRIFTED'
  | 'FAILED'
  | 'PASSED'
  | 'HARDWARE'
  | 'SIMULATED'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'DOWN'
  | 'UP'
  | 'DEFAULT';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

const variantStyles: Record<string, { bg: string; text: string; dot: string }> = {
  ONLINE: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  HEALTHY: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  UP: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  OK: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  VALID: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  PASSED: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  HARDWARE: {
    bg: 'bg-sky-500/10 border-sky-500/30',
    text: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  SIMULATED: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500 animate-pulse',
  },
  CALIBRATING: {
    bg: 'bg-indigo-500/10 border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500 animate-pulse',
  },
  WARNING: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  DRIFTED: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  DEGRADED: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  CRITICAL: {
    bg: 'bg-rose-500/10 border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500 animate-ping',
  },
  ERROR: {
    bg: 'bg-rose-500/10 border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  FAILED: {
    bg: 'bg-rose-500/10 border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  DOWN: {
    bg: 'bg-rose-500/10 border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  OFFLINE: {
    bg: 'bg-slate-500/10 border-slate-500/30',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  EXPIRED: {
    bg: 'bg-slate-500/10 border-slate-500/30',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  INFO: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
  className,
}) => {
  const normalizedKey = status.toUpperCase();
  const config = variantStyles[normalizedKey] || {
    bg: 'bg-slate-500/10 border-slate-500/30',
    text: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold tracking-wide',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border transition-colors uppercase font-mono',
        config.bg,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span className={clsx('h-1.5 w-1.5 rounded-full flex-shrink-0', config.dot)} />
      )}
      <span>{status}</span>
    </span>
  );
};

export default StatusBadge;
