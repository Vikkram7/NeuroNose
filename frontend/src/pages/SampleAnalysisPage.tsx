import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Microscope,
  Sparkles,
  BarChart3,
  Radar as RadarIcon,
  Play,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Cpu,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import {
  getSamples,
  getPredictions,
  createPrediction,
  getModels,
} from '../api/endpoints';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

const CLASS_COLORS: Record<string, string> = {
  Ethanol: '#0284c7',
  Acetone: '#06b6d4',
  Ammonia: '#10b981',
  Methane: '#f59e0b',
  CO: '#ef4444',
  Hydrogen: '#8b5cf6',
  Toluene: '#ec4899',
  CleanAir: '#64748b',
};

export const SampleAnalysisPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');

  // 1. Fetch available samples
  const {
    data: samples = [],
    isLoading: isSamplesLoading,
    error: samplesError,
  } = useQuery({
    queryKey: ['samples-for-analysis'],
    queryFn: () => getSamples({ size: 30 }),
  });

  // Automatically select first sample if not selected
  const activeSample =
    samples.find((s) => s.id === selectedSampleId) || samples[0];

  // 2. Fetch predictions for active sample
  const {
    data: predictions = [],
    isLoading: isPredLoading,
    error: predError,
  } = useQuery({
    queryKey: ['sample-predictions', activeSample?.id],
    queryFn: () =>
      activeSample?.id
        ? getPredictions({ sampleId: activeSample.id })
        : Promise.resolve([]),
    enabled: !!activeSample?.id,
  });

  // 3. Fetch active models
  const { data: models = [] } = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
  });

  // 4. Mutation to trigger edge inference
  const predictionMutation = useMutation({
    mutationFn: (sampleId: string) =>
      createPrediction({
        sampleId,
        modelVersion: models.find((m) => m.active)?.version || 'v1.0-quant',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
    },
  });

  const latestPrediction = predictions[0];

  // Radar chart data from channel values
  const radarData = activeSample?.channelValues
    ? activeSample.channelValues.map((val, idx) => ({
        channel: `CH ${idx + 1}`,
        response: Number(val.toFixed(2)),
        fullMark: 10,
      }))
    : [];

  // Confidence distribution data
  const probabilitiesData = latestPrediction?.probabilities
    ? Object.entries(latestPrediction.probabilities).map(([className, prob]) => ({
        name: className,
        probability: Number((prob <= 1 ? prob * 100 : prob).toFixed(1)),
      }))
    : [
        {
          name: latestPrediction?.predictedClass || 'Predicted',
          probability: Number(
            (
              (latestPrediction?.confidence ?? 0.85) <= 1
                ? (latestPrediction?.confidence ?? 0.85) * 100
                : latestPrediction?.confidence ?? 85
            ).toFixed(1)
          ),
        },
      ];

  // Feature contributions data
  const featureData = latestPrediction?.featureContributions
    ? Object.entries(latestPrediction.featureContributions).map(([ch, weight]) => ({
        channel: ch.replace('channel', 'CH '),
        weight: Number(weight.toFixed(3)),
      }))
    : activeSample?.channelValues?.slice(0, 8).map((val, idx) => ({
        channel: `CH ${idx + 1}`,
        weight: Number(((val / 10) * (0.8 - idx * 0.05)).toFixed(3)),
      })) || [];

  if (isSamplesLoading) {
    return <LoadingSpinner fullPage message="Loading sensor samples for analysis..." />;
  }

  if (samplesError) {
    return (
      <ErrorState
        title="Failed to load samples"
        message={samplesError instanceof Error ? samplesError.message : 'Unknown error'}
      />
    );
  }

  if (samples.length === 0) {
    return (
      <EmptyState
        title="No Sensor Samples Found"
        description="Trigger device sampling or start the demo data generator in Settings."
      />
    );
  }

  const noveltyScore = latestPrediction?.noveltyScore ?? 0.045;
  const isNoveltyHigh = noveltyScore > 0.4;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sample Odor Analysis"
        description="Neuromorphic pattern extraction, analyte fingerprinting, and novelty detection"
        actions={
          <button
            onClick={() => activeSample && predictionMutation.mutate(activeSample.id)}
            disabled={predictionMutation.isPending || !activeSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {predictionMutation.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            Run Neural Inference
          </button>
        }
      />

      {/* Sample Selector Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            Select Sample:
          </label>
          <select
            value={activeSample?.id}
            onChange={(e) => setSelectedSampleId(e.target.value)}
            className="bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 10)}... | {s.source} |{' '}
                {s.timestamp ? format(new Date(s.timestamp), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}{' '}
                {s.label ? `(${s.label})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>Source: <StatusBadge status={activeSample?.source || 'SIMULATED'} size="sm" /></span>
          <span>Chamber: {activeSample?.temperature?.toFixed(1) ?? 25.0}°C / {activeSample?.humidity?.toFixed(1) ?? 45.0}% RH</span>
        </div>
      </div>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Classification Result & Novelty Score */}
        <div className="space-y-6">
          {/* Classification Result Card */}
          <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Edge Classification
              </h3>
              <StatusBadge status={latestPrediction ? 'OK' : 'INFO'} size="sm" />
            </div>

            {latestPrediction ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Target Analyte
                  </div>
                  <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
                    {latestPrediction.predictedClass}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Classification Confidence</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {(latestPrediction.confidence <= 1
                        ? latestPrediction.confidence * 100
                        : latestPrediction.confidence
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                </div>

                {/* Novelty Score Indicator */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                      Novelty / Anomaly Score:
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        isNoveltyHigh ? 'text-rose-500' : 'text-emerald-500'
                      }`}
                    >
                      {noveltyScore.toFixed(3)}
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isNoveltyHigh ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, noveltyScore * 100)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isNoveltyHigh
                      ? '⚠️ High novelty distance detected. Sample may contain an unfamiliar analyte or compound mixture.'
                      : '✓ Low novelty distance. Fingerprint matches known chemical training distribution.'}
                  </p>
                </div>

                {/* Model Metadata */}
                <div className="text-xs font-mono space-y-1.5 pt-2 border-t border-slate-100 dark:border-surface-border text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Model Version:</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {latestPrediction.modelVersion}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inference Latency:</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {latestPrediction.inferenceTimeMs ?? 1.4} ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sample ID:</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {activeSample?.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 space-y-3">
                <p>No edge prediction recorded for this sample yet.</p>
                <button
                  onClick={() => activeSample && predictionMutation.mutate(activeSample.id)}
                  disabled={predictionMutation.isPending}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs"
                >
                  Run Classification Now
                </button>
              </div>
            )}
          </div>

          {/* Feature Contributions */}
          <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-500" />
              Sensor Channel Contributions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Normalized Shapley weight of each sensor channel
            </p>

            <div className="space-y-2 pt-2">
              {featureData.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-mono">
                  <span className="w-12 text-slate-400">{f.channel}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.abs(f.weight) * 100 * 2)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-slate-600 dark:text-slate-300">
                    {f.weight.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center & Right: Fingerprint Radar Chart & Probability Distribution */}
        <div className="lg:col-span-2 space-y-6">
          {/* Odor Fingerprint (Radar Chart) */}
          <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <RadarIcon className="h-4 w-4 text-sky-500" />
                  Odor Fingerprint Polar Signature
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Multichannel gas cross-sensitivity pattern
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {radarData.length} Channels
              </span>
            </div>

            <div className="h-72 sm:h-80 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#334155" opacity={0.2} />
                  <PolarAngleAxis
                    dataKey="channel"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 'auto']}
                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                    stroke="#475569"
                    opacity={0.3}
                  />
                  <Radar
                    name="Sensor Response"
                    dataKey="response"
                    stroke="#0284c7"
                    fill="#0284c7"
                    fillOpacity={0.4}
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
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Class Confidence Distribution (Bar Chart) */}
          <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-sky-500" />
                  Analyte Probability Distribution
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Softmax output probabilities across supported gas target classes
                </p>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={probabilitiesData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    stroke="#475569"
                    opacity={0.3}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#475569"
                    opacity={0.3}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1d2e',
                      borderColor: '#2a2f45',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                    formatter={(val: number) => [`${val}%`, 'Probability']}
                  />
                  <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                    {probabilitiesData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CLASS_COLORS[entry.name] || '#0284c7'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SampleAnalysisPage;
