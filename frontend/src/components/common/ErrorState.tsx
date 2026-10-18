import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import clsx from 'clsx';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isOffline?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load instrumentation data',
  message = 'An unexpected error occurred while communicating with the NeuroNose service.',
  onRetry,
  isOffline = false,
  className,
}) => {
  const Icon = isOffline ? WifiOff : AlertTriangle;

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border',
        'border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/20',
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-500 mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
        {title}
      </h3>
      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 max-w-md font-mono">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Connection
        </button>
      )}
    </div>
  );
};

export default ErrorState;
