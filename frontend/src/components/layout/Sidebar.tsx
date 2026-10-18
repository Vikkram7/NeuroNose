import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Activity,
  Microscope,
  Fingerprint,
  Cpu,
  Sliders,
  Bell,
  Brain,
  Binary,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Live Monitor', path: '/live', icon: Activity },
  { name: 'Sample Analysis', path: '/analysis', icon: Microscope },
  { name: 'Fingerprint Library', path: '/fingerprints', icon: Fingerprint },
  { name: 'Devices', path: '/devices', icon: Cpu },
  { name: 'Calibration', path: '/calibration', icon: Sliders },
  { name: 'Alerts', path: '/alerts', icon: Bell },
  { name: 'ML Analytics', path: '/ml', icon: Brain },
  { name: 'RTL Validation', path: '/rtl', icon: Binary },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={clsx(
        'fixed top-0 left-0 z-30 h-screen transition-all duration-300 ease-in-out',
        'border-r border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card flex flex-col',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-surface-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-lg bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 flex items-center justify-center flex-shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Neuro<span className="text-sky-500">Nose</span>
              </span>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase -mt-0.5">
                Olfactory Core
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-card-hover transition-colors hidden sm:block"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative',
                  isActive
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-card-hover hover:text-slate-900 dark:hover:text-slate-200'
                )
              }
              title={collapsed ? item.name : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={clsx(
                      'h-4 w-4 flex-shrink-0 transition-colors',
                      isActive
                        ? 'text-sky-500'
                        : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                    )}
                  />
                  {!collapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-sky-500 rounded-r" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200 dark:border-surface-border">
        {!collapsed ? (
          <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>RTL: v1.2</span>
              <span>NN: INT8</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              NeuroNose Edge Instrumentation
            </div>
          </div>
        ) : (
          <div className="text-center text-[10px] font-mono text-slate-400">
            v1.2
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
