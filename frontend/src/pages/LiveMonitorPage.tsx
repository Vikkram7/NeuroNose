import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Play,
  Pause,
  RefreshCw,
  Thermometer,
  Droplets,
  Gauge,
  SlidersHorizontal,
  CheckSquare,
  Square,
  AlertCircle,
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
import { getSamples, getDevices } from '../api/endpoints';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

const CHANNEL_COLORS = [
  '#0284c7', // Sky Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export const LiveMonitorPage: React.FC = () => {
  const [isLive, setIsLive] = useState<boolean>(true);
  const [pollInterval, setPollInterval] = useState<number>(1000);
  const [historyLength, setHistoryLength] = useState<number>(60);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');

  // Fetch devices for device selector
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    staleTime: 30000,
  });

  // Fetch samples continuously
  const {
    data: samples = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['live-samples', selectedDeviceId, historyLength],
    queryFn: () =>
      getSamples({
        deviceId: selectedDeviceId !== 'all' ? selectedDeviceId : undefined,
        size: historyLength,
      }),
    refetchInterval: isLive ? pollInterval : false,
  });

  const latestSample = samples[0];
  const channelCount = latestSample?.channelValues?.length || 8;

  // Toggle single channel
  const toggleChannel = (idx: number) => {
    setSelectedChannels((prev) =>
      prev.includes(idx) ? prev.filter((c) => c !== idx) : [...prev, idx]
    );
  };

  // Select all or deselect all
  const toggleAllChannels = () => {
    if (selectedChannels.length === channelCount) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels(Array.from({ length: channelCount }, (_, i) => i));
    }
  };

  // Prepare chart series (oldest first for time chart)
  const chartData = [...samples].reverse().map((sample, idx) => {
    const point: Record<string, unknown> = {
      index: idx,
      timestamp: sample.timestamp
        ? format(new Date(sample.timestamp), 'HH:mm:ss')
        : `${idx}s`,
    };

    if (Array.isArray(sample.channelValues)) {
      sample.channelValues.forEach((val, chIdx) => {
        point[`Ch${chIdx + 1}`] = Number(val.toFixed(2));
      });
    }

    return point;
  });

  const sourceBadge = latestSample?.source || 'SIMULATED';

  return (
    <div className="space-y-6">
      {/* Header with Live Controls */}
      <PageHeader
        title="Real-Time Sensor Telemetry"
        description="Continuous multichannel sensor array monitoring and environmental diagnostics"
        badge={<StatusBadge status={sourceBadge} size="md" />}
        actions={
          <div className="flex items-center gap-2">
            {/* Sampling State Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card text-xs font-mono">
              <span
                className={`h-2 w-2 rounded-full ${
                  isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isLive ? 'SAMPLING (LIVE)' : 'PAUSED'}
              </span>
            </div>

            {/* Play/Pause Button */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white shadow-sm transition-colors ${
                isLive
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isLive ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Resume
                </>
              )}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card hover:bg-slate-50 dark:hover:bg-surface-card-hover text-slate-600 dark:text-slate-300"
              title="Refresh now"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {/* Control Bar: Refresh Rate, Device Filter, Window Size */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {/* Device Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Device:</span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Devices (Aggregate)</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          {/* Polling Rate */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Interval:</span>
            <select
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              disabled={!isLive}
              className="bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
            >
              <option value={500}>500 ms (2 Hz)</option>
              <option value={1000}>1000 ms (1 Hz)</option>
              <option value={2000}>2000 ms (0.5 Hz)</option>
              <option value={5000}>5000 ms (0.2 Hz)</option>
            </select>
          </div>

          {/* Window size */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Window:</span>
            <select
              value={historyLength}
              onChange={(e) => setHistoryLength(Number(e.target.value))}
              className="bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value={30}>30 points</option>
              <option value={60}>60 points</option>
              <option value={120}>120 points</option>
              <option value={200}>200 points</option>
            </select>
          </div>
        </div>

        <div className="text-slate-400 font-mono text-[11px]">
          Sample ID: {latestSample?.id ? latestSample.id.slice(0, 12) : 'Awaiting data...'}
        </div>
      </div>

      {/* Environmental Sensors & Chamber Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Temperature */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
              Chamber Temperature
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {latestSample?.temperature !== undefined
                ? `${latestSample.temperature.toFixed(1)} °C`
                : '24.2 °C'}
            </div>
            <div className="text-[11px] text-emerald-500 mt-0.5">Optimal range (20-28°C)</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <Thermometer className="h-6 w-6" />
          </div>
        </div>

        {/* Humidity */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
              Relative Humidity
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {latestSample?.humidity !== undefined
                ? `${latestSample.humidity.toFixed(1)} %`
                : '45.0 %'}
            </div>
            <div className="text-[11px] text-emerald-500 mt-0.5">Target &plusmn; 5% RH</div>
          </div>
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-500">
            <Droplets className="h-6 w-6" />
          </div>
        </div>

        {/* Chamber Pressure */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
              Atmospheric Pressure
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {latestSample?.pressure !== undefined
                ? `${latestSample.pressure.toFixed(1)} hPa`
                : '1013.2 hPa'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Standard pressure</div>
          </div>
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Gauge className="h-6 w-6" />
          </div>
        </div>

        {/* Sampling Rate */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
              ADC Sampling Rate
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {latestSample?.samplingRateHz || 100} Hz
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">16-bit Sigma-Delta ADC</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Activity className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Multi-Channel Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
        {/* Channel Selection Checkboxes */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-surface-border">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-sky-500" />
            <span className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Channel Select:
            </span>
            <button
              onClick={toggleAllChannels}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-mono ml-2"
            >
              {selectedChannels.length === channelCount ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: channelCount }, (_, i) => {
              const isSelected = selectedChannels.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleChannel(i)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all border ${
                    isSelected
                      ? 'border-transparent text-white font-medium shadow-sm'
                      : 'border-slate-200 dark:border-surface-border text-slate-400 bg-transparent opacity-60'
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? CHANNEL_COLORS[i % CHANNEL_COLORS.length]
                      : undefined,
                  }}
                >
                  {isSelected ? (
                    <CheckSquare className="h-3 w-3" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                  <span>Ch {i + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-Time Line Graph */}
        {isLoading && chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center">
            <LoadingSpinner message="Acquiring sensor array channel telemetry..." />
          </div>
        ) : isError ? (
          <ErrorState
            title="Sensor Stream Interrupted"
            message={error instanceof Error ? error.message : 'Telemetry stream error'}
            onRetry={() => refetch()}
          />
        ) : (
          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="#475569"
                  opacity={0.3}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="#475569"
                  opacity={0.3}
                  domain={['auto', 'auto']}
                  label={{
                    value: 'Sensor Output (V / kΩ)',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 10,
                    fill: '#94a3b8',
                    offset: 15,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1d2e',
                    borderColor: '#2a2f45',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconType="circle"
                />
                {selectedChannels.map((chIdx) => (
                  <Line
                    key={`Ch${chIdx + 1}`}
                    type="monotone"
                    dataKey={`Ch${chIdx + 1}`}
                    name={`Sensor Ch ${chIdx + 1}`}
                    stroke={CHANNEL_COLORS[chIdx % CHANNEL_COLORS.length]}
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Real-time Numerical Values Table */}
      <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-500" />
          Channel Instantaneous Values & Baselines
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: channelCount }, (_, i) => {
            const val = latestSample?.channelValues?.[i] ?? 0;
            return (
              <div
                key={i}
                className="p-3 rounded-lg border border-slate-100 dark:border-surface-border bg-slate-50/50 dark:bg-surface-dark/50 text-center"
              >
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-mono">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
                  />
                  <span>CH {i + 1}</span>
                </div>
                <div className="text-base font-bold font-mono text-slate-800 dark:text-slate-100 mt-1">
                  {val.toFixed(3)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {(val * 1.15).toFixed(2)} kΩ
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LiveMonitorPage;
