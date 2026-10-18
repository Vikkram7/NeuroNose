import React from 'react';
import clsx from 'clsx';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DataCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'warning' | 'critical' | 'success';
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export const DataCard: React.FC<DataCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  loading = false,
  className,
  onClick,
}) => {
  const variantStyles = {
    default: 'hover:border-slate-300 dark:hover:border-slate-700',
    primary: 'border-sky-500/20 bg-sky-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    critical: 'border-rose-500/20 bg-rose-500/5',
    success: 'border-emerald-500/20 bg-emerald-500/5',
  };

  const iconColors = {
    default: 'text-sky-500 bg-sky-500/10',
    primary: 'text-sky-500 bg-sky-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    critical: 'text-rose-500 bg-rose-500/10',
    success: 'text-emerald-500 bg-emerald-500/10',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-5 transition-all duration-200 shadow-sm relative overflow-hidden',
        'bg-white dark:bg-surface-card border-slate-200 dark:border-surface-border',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-md transform hover:-translate-y-0.5',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <div className="h-8 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            ) : (
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {value}
              </span>
            )}
            {trend && !loading && (
              <span
                className={clsx(
                  'inline-flex items-center text-xs font-medium',
                  trend === 'up' && 'text-emerald-500',
                  trend === 'down' && 'text-rose-500',
                  trend === 'neutral' && 'text-slate-400'
                )}
              >
                {trend === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                {trend === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                {trend === 'neutral' && <Minus className="h-3 w-3 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={clsx(
              'p-2.5 rounded-lg flex-shrink-0',
              iconColors[variant]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCard;
