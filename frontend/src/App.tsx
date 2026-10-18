import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import clsx from 'clsx';
import { useTheme } from './hooks/useTheme';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

// Pages
import DashboardPage from './pages/DashboardPage';
import LiveMonitorPage from './pages/LiveMonitorPage';
import SampleAnalysisPage from './pages/SampleAnalysisPage';
import FingerprintLibraryPage from './pages/FingerprintLibraryPage';
import DevicesPage from './pages/DevicesPage';
import CalibrationPage from './pages/CalibrationPage';
import AlertsPage from './pages/AlertsPage';
import MLAnalyticsPage from './pages/MLAnalyticsPage';
import RTLValidationPage from './pages/RTLValidationPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-surface-dark text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          theme={theme}
          onToggleTheme={toggleTheme}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Content Container */}
        <main
          className={clsx(
            'flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300',
            sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-72'
          )}
        >
          <div className="max-w-7xl mx-auto space-y-6">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/live" element={<LiveMonitorPage />} />
              <Route path="/analysis" element={<SampleAnalysisPage />} />
              <Route path="/fingerprints" element={<FingerprintLibraryPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/calibration" element={<CalibrationPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/ml" element={<MLAnalyticsPage />} />
              <Route path="/rtl" element={<RTLValidationPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
