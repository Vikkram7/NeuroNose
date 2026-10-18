import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  Cpu,
  Sliders,
  CheckCircle2,
  Save,
  Radio,
  Bell,
  RefreshCw,
  Server,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { getHealth } from '../api/endpoints';
import { HealthStatus } from '../types';
import PageHeader from '../components/common/PageHeader';

export const SettingsPage: React.FC = () => {
  // Local reactive settings state
  const [samplingRate, setSamplingRate] = useState<number>(10);
  const [activeChannels, setActiveChannels] = useState<number>(8);
  const [noveltyThreshold, setNoveltyThreshold] = useState<number>(-0.05);
  const [driftTolerance, setDriftTolerance] = useState<number>(4.0);
  const [dataSource, setDataSource] = useState<'SIMULATED' | 'HARDWARE'>('SIMULATED');
  const [odorProfile, setOdorProfile] = useState<string>('mixed_food_and_voc');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Health probe
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery<HealthStatus>({
    queryKey: ['health-settings'],
    queryFn: getHealth,
    refetchInterval: 10000,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Parameters & Acquisition Settings"
        description="Configure real-time sensor sampling, novelty rejection boundaries, and hardware communication interfaces"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Acquisition Configuration */}
            <div className="p-6 rounded-2xl bg-white dark:bg-surface-card border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                Sensor Array Acquisition
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Data Source Interface
                  </label>
                  <select
                    value={dataSource}
                    onChange={(e) => setDataSource(e.target.value as 'SIMULATED' | 'HARDWARE')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="SIMULATED">Simulated Sensor Engine (Software)</option>
                    <option value="HARDWARE">Physical UART Hardware Interface (115200 Baud)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Sampling Frequency (Hz)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={samplingRate}
                    onChange={(e) => setSamplingRate(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Active Channel Count
                  </label>
                  <select
                    value={activeChannels}
                    onChange={(e) => setActiveChannels(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value={4}>4 Channels (CH0–CH3)</option>
                    <option value={8}>8 Channels (CH0–CH7 Full Array)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Simulation Volatile Profile
                  </label>
                  <select
                    value={odorProfile}
                    onChange={(e) => setOdorProfile(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="mixed_food_and_voc">Mixed Benchmark (Food, Aroma, VOC)</option>
                    <option value="food_freshness">Food Spoilage Research Profile</option>
                    <option value="coffee_tea_aroma">Beverage Aroma Discrimination</option>
                    <option value="ambient_monitoring">Ambient Air & Environmental VOC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Threshold & Drift Rejection */}
            <div className="p-6 rounded-2xl bg-white dark:bg-surface-card border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Alerts & Novelty Rejection
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Isolation Forest Novelty Cutoff: <span className="font-mono text-primary">{noveltyThreshold}</span>
                  </label>
                  <input
                    type="range"
                    min="-0.30"
                    max="0.10"
                    step="0.01"
                    value={noveltyThreshold}
                    onChange={(e) => setNoveltyThreshold(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Scores below this boundary are rejected as unfamiliar unknown patterns.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Baseline Drift Tolerance: <span className="font-mono text-primary">±{driftTolerance} LSB</span>
                  </label>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={driftTolerance}
                    onChange={(e) => setDriftTolerance(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Triggers BASELINE_DRIFT alert when running mean shifts beyond tare value.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save System Parameters
              </button>

              {savedSuccess && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                  <CheckCircle2 className="w-4 h-4" />
                  Parameters saved successfully!
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Backend & Environment Health Status */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-surface-card border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Backend Health Status
              </h3>
              <button
                onClick={() => refetchHealth()}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Service:</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {health?.service || 'neuronose-backend'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Overall Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-3 h-3" />
                  {health?.status || 'UP'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Database Engine:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {health?.database || 'UP (PostgreSQL / H2)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Demo Mode:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-500">
                  {health?.demoMode ? 'ENABLED (Simulated)' : 'DISABLED'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500">Java Version:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  Java 21 LTS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
