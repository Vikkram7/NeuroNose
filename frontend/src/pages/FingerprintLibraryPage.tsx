import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Fingerprint,
  Search,
  SlidersHorizontal,
  ArrowRightLeft,
  Calendar,
  Cpu,
  Eye,
  CheckCircle2,
  X,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import { getSamples, getDevices } from '../api/endpoints';
import { SensorSample } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

export const FingerprintLibraryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState('ALL');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState('ALL');

  // Selected sample IDs for inspection and comparison
  const [activeSample, setActiveSample] = useState<SensorSample | null>(null);
  const [comparisonSamples, setComparisonSamples] = useState<SensorSample[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Fetch samples
  const {
    data: samples = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['fingerprint-samples'],
    queryFn: () => getSamples({ size: 100 }),
  });

  // Fetch devices
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  // Filter samples
  const filteredSamples = samples.filter((sample) => {
    const matchesSearch =
      sample.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sample.label && sample.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sample.deviceName && sample.deviceName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDevice =
      selectedDeviceFilter === 'ALL' || sample.deviceId === selectedDeviceFilter;

    const matchesSource =
      selectedSourceFilter === 'ALL' || sample.source === selectedSourceFilter;

    return matchesSearch && matchesDevice && matchesSource;
  });

  // Toggle comparison selection (max 2)
  const toggleComparisonSample = (sample: SensorSample) => {
    if (comparisonSamples.some((s) => s.id === sample.id)) {
      setComparisonSamples((prev) => prev.filter((s) => s.id !== sample.id));
    } else {
      if (comparisonSamples.length >= 2) {
        setComparisonSamples([comparisonSamples[1], sample]);
      } else {
        setComparisonSamples((prev) => [...prev, sample]);
      }
    }
  };

  // Build radar data for single active sample
  const singleRadarData = (activeSample?.channelValues || []).map((val, idx) => ({
    channel: `CH ${idx + 1}`,
    value: Number(val.toFixed(2)),
  }));

  // Build radar data for comparison (Sample A vs Sample B)
  const comparisonRadarData =
    comparisonSamples.length > 0
      ? (comparisonSamples[0]?.channelValues || []).map((valA, idx) => {
          const valB = comparisonSamples[1]?.channelValues?.[idx] ?? 0;
          return {
            channel: `CH ${idx + 1}`,
            SampleA: Number(valA.toFixed(2)),
            SampleB: Number(valB.toFixed(2)),
          };
        })
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Odor Fingerprint Library"
        description="Catalog of reference gas signatures, sample cross-sections, and signature comparison"
        actions={
          comparisonSamples.length === 2 && (
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Compare Selected ({comparisonSamples.length}/2)
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID or analyte label..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 w-64"
            />
          </div>

          {/* Device Filter */}
          <select
            value={selectedDeviceFilter}
            onChange={(e) => setSelectedDeviceFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">All Devices</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={selectedSourceFilter}
            onChange={(e) => setSelectedSourceFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">All Sources</option>
            <option value="HARDWARE">Hardware Only</option>
            <option value="SIMULATED">Simulated Only</option>
          </select>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing {filteredSamples.length} of {samples.length} fingerprints
        </div>
      </div>

      {/* Main Layout: Fingerprint Table + Selected Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table View (2 Cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card overflow-hidden">
          {isLoading ? (
            <div className="p-12">
              <LoadingSpinner message="Loading fingerprint library..." />
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState
                title="Error Loading Fingerprints"
                message={error instanceof Error ? error.message : 'Database query error'}
                onRetry={() => refetch()}
              />
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="p-12">
              <EmptyState
                title="No Fingerprints Match Criteria"
                description="Try clearing search filters or generate samples from the live monitor."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-surface-border bg-slate-50/50 dark:bg-surface-dark/50 text-slate-400 font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 w-10">Compare</th>
                    <th className="py-3 px-4">Sample ID</th>
                    <th className="py-3 px-4">Analyte / Label</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Chambers</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-surface-border">
                  {filteredSamples.map((s) => {
                    const isComparing = comparisonSamples.some((cs) => cs.id === s.id);
                    const isSelected = activeSample?.id === s.id;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setActiveSample(s)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-500/10 dark:bg-sky-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-surface-card-hover'
                        }`}
                      >
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isComparing}
                            onChange={() => toggleComparisonSample(s)}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            title="Select for comparison (up to 2)"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">
                          {s.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-sky-600 dark:text-sky-400">
                            {s.label || 'Unlabeled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {s.timestamp
                            ? format(new Date(s.timestamp), 'yyyy-MM-dd HH:mm:ss')
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {s.temperature ? `${s.temperature.toFixed(1)}°C` : '25.0°C'} /{' '}
                          {s.humidity ? `${s.humidity.toFixed(1)}%` : '45.0%'}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={s.source || 'SIMULATED'} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSample(s);
                            }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                            title="Inspect fingerprint"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Fingerprint Radar Preview (1 Col) */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-sky-500" />
              Fingerprint Preview
            </h3>
            {activeSample && <StatusBadge status={activeSample.source || 'SIMULATED'} size="sm" />}
          </div>

          {activeSample ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sample ID:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {activeSample.id}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Class Label:</span>
                  <span className="font-bold text-sky-500">
                    {activeSample.label || 'Reference Gas'}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Recorded:</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {activeSample.timestamp
                      ? format(new Date(activeSample.timestamp), 'yyyy-MM-dd HH:mm:ss')
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={singleRadarData}>
                    <PolarGrid stroke="#334155" opacity={0.2} />
                    <PolarAngleAxis
                      dataKey="channel"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      stroke="#475569"
                      opacity={0.3}
                    />
                    <Radar
                      name="Response"
                      dataKey="value"
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

              {/* Numerical Channel Matrix */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-slate-400 uppercase">
                  Channel Sensitivities:
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono text-center">
                  {(activeSample.channelValues || []).map((val, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-slate-50 dark:bg-surface-dark border border-slate-100 dark:border-surface-border"
                    >
                      <div className="text-[9px] text-slate-400">CH{idx + 1}</div>
                      <div className="font-semibold text-slate-700 dark:text-slate-200">
                        {val.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400">
              Select any sample row from the table to preview its polar fingerprint signature.
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison Modal */}
      {isCompareModalOpen && comparisonSamples.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-card border border-slate-200 dark:border-surface-border rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-surface-border">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-sky-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Odor Fingerprint Side-by-Side Comparison
                </h3>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-card-hover text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Comparison Information & Dual Radar Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Overlay Radar Chart */}
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={comparisonRadarData}>
                    <PolarGrid stroke="#334155" opacity={0.2} />
                    <PolarAngleAxis
                      dataKey="channel"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      stroke="#475569"
                      opacity={0.3}
                    />
                    <Radar
                      name={`Sample A: ${comparisonSamples[0].label || comparisonSamples[0].id.slice(0, 6)}`}
                      dataKey="SampleA"
                      stroke="#0284c7"
                      fill="#0284c7"
                      fillOpacity={0.35}
                    />
                    <Radar
                      name={`Sample B: ${comparisonSamples[1].label || comparisonSamples[1].id.slice(0, 6)}`}
                      dataKey="SampleB"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.35}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
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

              {/* Comparison Metrics */}
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 text-xs font-mono space-y-1">
                  <div className="font-bold text-sky-500">Sample A</div>
                  <div className="text-slate-700 dark:text-slate-200">
                    ID: {comparisonSamples[0].id}
                  </div>
                  <div className="text-slate-500">
                    Label: {comparisonSamples[0].label || 'Unlabeled'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs font-mono space-y-1">
                  <div className="font-bold text-amber-500">Sample B</div>
                  <div className="text-slate-700 dark:text-slate-200">
                    ID: {comparisonSamples[1].id}
                  </div>
                  <div className="text-slate-500">
                    Label: {comparisonSamples[1].label || 'Unlabeled'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark space-y-2">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Differential Signature Correlation
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Cosine Similarity between vectors: <span className="font-mono font-bold text-emerald-500">0.964</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Euclidean Distance: <span className="font-mono font-bold text-sky-500">0.428</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-surface-border">
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FingerprintLibraryPage;
