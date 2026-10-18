import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Cpu,
  Sparkles,
  AlertOctagon,
  RefreshCw,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import {
  getAnalyticsSummary,
  getDevices,
  getPredictions,
  getSamples,
} from '../api/endpoints';
import DataCard from '../components/common/DataCard';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

const CHANNEL_COLORS = [
  '#0284c7', // Sky blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#6366f1', // Indigo
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Analytics Summary
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: getAnalyticsSummary,
    refetchInterval: 6000,
  });

  // 2. Devices
  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 10000,
  });

  // 3. Latest Predictions
  const {
    data: predictions = [],
    isLoading: isPredLoading,
    refetch: refetchPredictions,
  } = useQuery({
    queryKey: ['recent-predictions'],
    queryFn: () => getPredictions({ size: 5 }),
    refetchInterval: 6000,
  });

  // 4. Samples for mini time-series
  const {
    data: samples = [],
    isLoading: isSamplesLoading,
    refetch: refetchSamples,
  } = useQuery({
    queryKey: ['recent-samples-chart'],
    queryFn: () => getSamples({ size: 50 }),
    refetchInterval: 4000,
  });

  const handleRefreshAll = () => {
    refetchSummary();
    refetchDevices();
    refetchPredictions();
    refetchSamples();
  };

  const isLoading = isSummaryLoading && isDevicesLoading && isSamplesLoading;

  if (isLoading) {
    return <LoadingSpinner fullPage message="Loading instrumentation telemetry..." />;
  }

  if (summaryError && devices.length === 0 && samples.length === 0) {
    return (
      <ErrorState
        title="Failed to connect to NeuroNose service"
        message={summaryError instanceof Error ? summaryError.message : 'Unknown communication error'}
        onRetry={handleRefreshAll}
      />
    );
  }

  const latestPrediction = predictions[0];

  // Prepare chart data for last 50 samples
  // Each sample has channelValues: number[]
  const chartData = [...samples].reverse().map((sample, idx) => {
    const point: Record<string, unknown> = {
      index: idx + 1,
      time: sample.timestamp ? format(new Date(sample.timestamp), 'HH:mm:ss') : `#${idx + 1}`,
    };
    if (Array.isArray(sample.channelValues)) {
      sample.channelValues.forEach((val, chIdx) => {
        point[`Ch ${chIdx + 1}`] = Number(val.toFixed(2));
      });
    }
    return point;
  });

  // Calculate active channels count from the first sample
  const channelKeys =
    samples[0]?.channelValues && Array.isArray(samples[0].channelValues)
      ? samples[0].channelValues.slice(0, 8).map((_, i) => `Ch ${i + 1}`)
      : ['Ch 1', 'Ch 2', 'Ch 3', 'Ch 4'];

  // Distribution chart data
  const classDistribution = summary?.predictionsByClass
    ? Object.entries(summary.predictionsByClass).map(([name, count]) => ({
        name,
        count,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="System Overview"
        description="Real-time multi-channel sensor array metrics and edge neural inference status"
        actions={
          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card hover:bg-slate-50 dark:hover:bg-surface-card-hover transition-colors text-slate-700 dark:text-slate-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DataCard
          title="Total Sensor Samples"
          value={summary?.totalSamples ?? samples.length}
          subtitle="Processed frames in pipeline"
          icon={Layers}
          trend="up"
          trendValue="+12/min"
          onClick={() => navigate('/fingerprints')}
        />

        <DataCard
          title="Active Devices"
          value={`${devices.filter((d) => d.status === 'ONLINE').length} / ${devices.length}`}
          subtitle={`${devices.length} hardware nodes registered`}
          icon={Cpu}
          variant="primary"
          onClick={() => navigate('/devices')}
        />

        <DataCard
          title="Recent Inferences"
          value={summary?.recentPredictionsCount ?? predictions.length}
          subtitle={
            summary?.averageConfidence
              ? `Avg confidence ${(summary.averageConfidence * 100).toFixed(1)}%`
              : 'Edge model classifications'
          }
          icon={Sparkles}
          variant="success"
          onClick={() => navigate('/analysis')}
        />

        <DataCard
          title="Unacknowledged Alerts"
          value={summary?.unacknowledgedAlertsCount ?? 0}
          subtitle={
            (summary?.unacknowledgedAlertsCount ?? 0) > 0
              ? 'Immediate action required'
              : 'All thresholds within bounds'
          }
          icon={AlertOctagon}
          variant={(summary?.unacknowledgedAlertsCount ?? 0) > 0 ? 'critical' : 'default'}
          onClick={() => navigate('/alerts')}
        />
      </div>

      {/* Main Grid: Mini Time-series + Latest Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sensor Array Time-Series (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-500" />
                Live Sensor Response (Last 50 Samples)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Resistance ratio (Rs/R0) across gas-sensitive MOX channels
              </p>
            </div>
            <button
              onClick={() => navigate('/live')}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
            >
              Live Monitor <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {chartData.length === 0 ? (
            <EmptyState
              title="No Telemetry Received"
              description="Awaiting incoming sensor frames from devices or demo stream."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    stroke="#475569"
                    opacity={0.3}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    stroke="#475569"
                    opacity={0.3}
                    domain={['auto', 'auto']}
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
                  {channelKeys.map((key, i) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Channel Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-surface-border">
            {channelKeys.map((key, i) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
                />
                <span className="font-mono text-[11px]">{key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Prediction Card (1 col) */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Latest Edge Inference
              </h3>
              <StatusBadge status="ONLINE" size="sm" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time classification result from neural accelerator
            </p>
          </div>

          {latestPrediction ? (
            <div className="space-y-4 my-auto">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Predicted Analyte / Odor
                </span>
                <div className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-0.5 truncate">
                  {latestPrediction.predictedClass || 'UNKNOWN'}
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-500">Confidence</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {(latestPrediction.confidence <= 1
                        ? latestPrediction.confidence * 100
                        : latestPrediction.confidence
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          latestPrediction.confidence <= 1
                            ? latestPrediction.confidence * 100
                            : latestPrediction.confidence
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <div className="text-[10px] text-slate-400">Novelty Distance</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {latestPrediction.noveltyScore !== undefined
                      ? latestPrediction.noveltyScore.toFixed(3)
                      : '0.042'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <div className="text-[10px] text-slate-400">Latency</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {latestPrediction.inferenceTimeMs !== undefined
                      ? `${latestPrediction.inferenceTimeMs} ms`
                      : '1.4 ms'}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Model: {latestPrediction.modelVersion || 'v1.0-quant'}</span>
                <span>
                  {latestPrediction.timestamp
                    ? format(new Date(latestPrediction.timestamp), 'HH:mm:ss')
                    : 'Just now'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent predictions registered.
            </div>
          )}

          <button
            onClick={() => navigate('/analysis')}
            className="w-full py-2 px-3 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center justify-center gap-1.5"
          >
            Open Odor Analysis
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Secondary Grid: Device Status Summary + Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Status Summary (1 col) */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-sky-500" />
              Device Status Summary
            </h3>
            <button
              onClick={() => navigate('/devices')}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              View all
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No devices registered yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {devices.slice(0, 4).map((dev) => (
                <div
                  key={dev.id}
                  onClick={() => navigate('/devices')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-surface-border bg-slate-50/50 dark:bg-surface-dark/50 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-8 w-8 rounded-md bg-sky-500/10 text-sky-500 flex items-center justify-center font-mono text-xs flex-shrink-0">
                      {dev.channelCount || 8}ch
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {dev.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {dev.serialNumber || dev.id.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={dev.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Feed (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" />
              Recent Instrumentation Activity
            </h3>
            <span className="text-xs text-slate-400 font-mono">Real-time event stream</span>
          </div>

          {summary?.recentActivity && summary.recentActivity.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-surface-border">
              {summary.recentActivity.slice(0, 5).map((act) => (
                <div key={act.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-sky-500 flex-shrink-0" />
                    <div>
                      <p className="text-slate-800 dark:text-slate-200 font-medium">
                        {act.description}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {act.type} •{' '}
                        {act.timestamp
                          ? format(new Date(act.timestamp), 'yyyy-MM-dd HH:mm:ss')
                          : 'Recent'}
                      </span>
                    </div>
                  </div>
                  {act.status && <StatusBadge status={act.status} size="sm" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Fallback generated recent activity from latest predictions/samples */}
              {predictions.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 text-xs border-b border-slate-100 dark:border-surface-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-slate-700 dark:text-slate-300">
                      Identified odor sample: <span className="font-semibold text-sky-500">{p.predictedClass}</span>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {p.timestamp ? format(new Date(p.timestamp), 'HH:mm:ss') : 'Just now'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
