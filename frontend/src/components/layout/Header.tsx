import React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, AlertTriangle, Radio, ShieldCheck, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { getHealth } from '../../api/endpoints';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  sidebarCollapsed: boolean;
}

const routeTitles: Record<string, { title: string; category: string }> = {
  '/': { title: 'Instrumentation Overview', category: 'Dashboard' },
  '/live': { title: 'Real-Time Sensor Monitor', category: 'Telemetry' },
  '/analysis': { title: 'Sample & Odor Analysis', category: 'Inference' },
  '/fingerprints': { title: 'Fingerprint Library', category: 'Database' },
  '/devices': { title: 'Hardware Devices & Sensors', category: 'Hardware' },
  '/calibration': { title: 'Sensor Calibration & Drift', category: 'Metrology' },
  '/alerts': { title: 'System Alerts & Warnings', category: 'Monitoring' },
  '/ml': { title: 'Machine Learning Analytics', category: 'Models' },
  '/rtl': { title: 'RTL Hardware Validation', category: 'FPGA / ASIC' },
  '/reports': { title: 'Audit Reports & Exports', category: 'Reports' },
  '/settings': { title: 'System & Sensor Settings', category: 'Configuration' },
};

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  sidebarCollapsed,
}) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentMeta = routeTitles[currentPath] || {
    title: 'NeuroNose Instrumentation',
    category: 'System',
  };

  // Poll health every 10 seconds
  const { data: health, isError } = useQuery({
    queryKey: ['system-health'],
    queryFn: getHealth,
    refetchInterval: 10000,
    retry: 1,
  });

  const isDemo = health?.demoMode ?? (import.meta.env.VITE_DEMO_MODE === 'true');
  const isOnline = !isError && health?.status !== 'DOWN';

  return (
    <header
      className={clsx(
        'sticky top-0 z-20 flex flex-col transition-all duration-300',
        sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
      )}
    >
      {/* Demo Mode / Simulation Banner */}
      {isDemo && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 animate-bounce" />
            <span className="font-bold tracking-wider">SIMULATED DATA ACTIVE:</span>
            <span className="hidden sm:inline">
              Hardware bus is operating in synthetic emulation mode. Real sensor readings are simulated.
            </span>
            <span className="sm:hidden">Hardware emulation mode</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[11px] font-bold">
            DEMO MODE
          </span>
        </div>
      )}

      {/* Main Top Navigation Bar */}
      <div className="h-16 bg-white/80 dark:bg-surface-card/80 backdrop-blur-md border-b border-slate-200 dark:border-surface-border px-4 sm:px-8 flex items-center justify-between">
        {/* Left: Breadcrumbs & Current Page Title */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>NeuroNose</span>
            <span>/</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {currentMeta.category}
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
            {currentMeta.title}
          </h2>
        </div>

        {/* Right: Actions, Status & Theme */}
        <div className="flex items-center gap-3">
          {/* Connection Status Indicator */}
          <div
            className={clsx(
              'hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border',
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            )}
            title={isOnline ? 'Backend service online' : 'Backend service offline or unreachable'}
          >
            <span
              className={clsx(
                'h-2 w-2 rounded-full',
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              )}
            />
            <span className="font-medium">
              {isOnline ? 'BACKEND ONLINE' : 'SERVICE OFFLINE'}
            </span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:text-sky-500 dark:hover:text-sky-400 hover:border-sky-500/50 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-sky-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
