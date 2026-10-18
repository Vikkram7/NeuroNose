import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  Plus,
  RefreshCw,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import {
  getCalibrations,
  createCalibration,
  getDevices,
} from '../api/endpoints';
import { CalibrationRecord } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

const CHANNEL_COLORS = [
  '#0284c7',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export const CalibrationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [deviceId, setDeviceId] = useState('');
  const [channelIndex, setChannelIndex] = useState(1);
  const [baselineResistance, setBaselineResistance] = useState(10.5);
  const [referenceGas, setReferenceGas] = useState('Synthetic Clean Air');
  const [slope, setSlope] = useState(1.02);
  const [offset, setOffset] = useState(-0.015);

  // Fetch calibrations
  const {
    data: calibrations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['calibrations'],
    queryFn: () => getCalibrations(),
  });

  // Fetch devices
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  // Add calibration record mutation
  const createMutation = useMutation({
    mutationFn: createCalibration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibrations'] });
      setIsAddModalOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setChannelIndex(1);
    setBaselineResistance(10.5);
    setReferenceGas('Synthetic Clean Air');
    setSlope(1.02);
    setOffset(-0.015);
  };

  const handleCreateCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      deviceId: deviceId || (devices[0]?.id ?? 'dev-default'),
      channelIndex,
      channelName: `CH ${channelIndex}`,
      baselineResistance,
      referenceGas,
      slope,
      offset,
      rSquared: 0.994,
      status: 'VALID',
      calibratedAt: new Date().toISOString(),
    });
  };

  // Group calibrations to construct baseline drift chart over time
  const driftChartData = [...calibrations]
    .sort((a, b) => new Date(a.calibratedAt).getTime() - new Date(b.calibratedAt).getTime())
    .map((cal, idx) => ({
      index: idx,
      date: cal.calibratedAt
        ? format(new Date(cal.calibratedAt), 'MM/dd HH:mm')
        : `#${idx + 1}`,
      baseline: cal.baselineResistance,
      channel: `CH ${cal.channelIndex}`,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sensor Calibration & Baseline Drift"
        description="Zero-point baseline calibration, drift compensation coefficients, and sensor channel health"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card hover:bg-slate-50 dark:hover:bg-surface-card-hover text-slate-600 dark:text-slate-300"
              title="Refresh calibrations"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Calibration
            </button>
          </div>
        }
      />

      {/* Channel Health Grid (CH 1 to CH 8) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }, (_, i) => {
          const chNum = i + 1;
          const matchingCal = calibrations.find((c) => c.channelIndex === chNum);
          const status = matchingCal?.status || (i === 6 ? 'DRIFTED' : 'VALID');
          const baseline = matchingCal?.baselineResistance || (10.0 + (i * 1.25)).toFixed(2);

          return (
            <div
              key={chNum}
              className="p-3 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                  CH {chNum}
                </span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Baseline R0</span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100">
                  {baseline} kΩ
                </span>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-surface-border">
                <StatusBadge status={status} size="sm" showDot={false} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Baseline Drift Chart Over Time */}
      <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-sky-500" />
              Baseline Resistance Drift Tracking (R0)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Long-term baseline resistance shifts indicating chemical poisoning or aging
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Target Range: 8 - 25 kΩ</span>
        </div>

        {calibrations.length === 0 ? (
          <EmptyState
            title="No Calibration History"
            description="Add baseline calibration runs to monitor drift trends."
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={driftChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="#475569"
                  opacity={0.3}
                />
                <YAxis
                  unit=" kΩ"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="#475569"
                  opacity={0.3}
                  domain={['dataMin - 1', 'dataMax + 1']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1d2e',
                    borderColor: '#2a2f45',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline R0"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#0284c7' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Calibration History Table */}
      <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-surface-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-500" />
            Calibration History & Calibration Coefficients
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {calibrations.length} records recorded
          </span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner message="Loading calibration records..." />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState
              title="Failed to Load Calibrations"
              message={error instanceof Error ? error.message : 'Error'}
              onRetry={() => refetch()}
            />
          </div>
        ) : calibrations.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Calibration History Found"
              description="Click 'New Calibration' above to perform a sensor array zero-point run."
              actionLabel="Add Calibration"
              onAction={() => setIsAddModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-surface-border bg-slate-50/50 dark:bg-surface-dark/50 text-slate-400 font-mono uppercase text-[11px]">
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Baseline R0</th>
                  <th className="py-3 px-4">Reference Gas</th>
                  <th className="py-3 px-4">Sensitivity Slope (m)</th>
                  <th className="py-3 px-4">Offset (b)</th>
                  <th className="py-3 px-4">R² Fit</th>
                  <th className="py-3 px-4">Calibrated At</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-border">
                {calibrations.map((cal) => (
                  <tr
                    key={cal.id}
                    className="hover:bg-slate-50 dark:hover:bg-surface-card-hover transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                      CH {cal.channelIndex}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-900 dark:text-white font-medium">
                      {cal.baselineResistance.toFixed(3)} kΩ
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {cal.referenceGas}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {cal.slope?.toFixed(4) || '1.0000'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {cal.offset?.toFixed(4) || '0.0000'}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-500 font-semibold">
                      {cal.rSquared?.toFixed(4) || '0.9982'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {cal.calibratedAt
                        ? format(new Date(cal.calibratedAt), 'yyyy-MM-dd HH:mm')
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={cal.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Calibration Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-card border border-slate-200 dark:border-surface-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-surface-border">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sky-500" />
                Record Calibration Measurement
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCalibration} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Device *
                </label>
                <select
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.id.slice(0, 8)})
                    </option>
                  ))}
                  {devices.length === 0 && <option value="default">Default Sensor Node</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Channel Index
                  </label>
                  <select
                    value={channelIndex}
                    onChange={(e) => setChannelIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        CH {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Baseline R0 (kΩ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={baselineResistance}
                    onChange={(e) => setBaselineResistance(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reference Gas
                </label>
                <input
                  type="text"
                  required
                  value={referenceGas}
                  onChange={(e) => setReferenceGas(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Slope (m)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={slope}
                    onChange={(e) => setSlope(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Offset (b)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={offset}
                    onChange={(e) => setOffset(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-surface-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-card-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Calibration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalibrationPage;
