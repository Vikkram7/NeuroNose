import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Filter,
  Calendar,
  Layers,
  Database,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { getDevices, getSamples } from '../api/endpoints';
import { Device, SensorSample } from '../types';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import { format } from 'date-fns';

export const ReportsPage: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [exportLimit, setExportLimit] = useState<number>(500);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Fetch devices
  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  // Fetch sample preview
  const {
    data: previewSamples = [],
    isLoading,
    refetch,
  } = useQuery<SensorSample[]>({
    queryKey: ['report-samples-preview', selectedDevice],
    queryFn: () => getSamples({ deviceId: selectedDevice || undefined, size: 15 }),
  });

  const handleDownloadCsv = () => {
    setIsExporting(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
      let exportUrl = `${baseUrl}/reports/export?limit=${exportLimit}`;
      if (selectedDevice) {
        exportUrl += `&deviceId=${selectedDevice}`;
      }
      window.open(exportUrl, '_blank');
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scientific Data Reports & Export"
        description="Generate formatted CSV measurement records for analytical review and academic reporting"
      />

      {/* Export Configuration Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-surface-card border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Export Query Parameters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Device Filter
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Registered Devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Record Limit
            </label>
            <select
              value={exportLimit}
              onChange={(e) => setExportLimit(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              <option value={100}>100 Records</option>
              <option value={500}>500 Records</option>
              <option value={1000}>1,000 Records</option>
              <option value={5000}>5,000 Records (Max)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleDownloadCsv}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white transition-colors shadow-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating CSV...' : 'Download CSV Report'}
            </button>
          </div>
        </div>

        <div className="pt-2 text-xs text-slate-500 flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <span>Includes SampleID, DeviceName, UTC Timestamps, Temperature, Humidity, and Channels CH0–CH7.</span>
        </div>
      </div>

      {/* Live Sample Preview Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-surface-card border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Live Export Preview (First 15 Samples)
          </h3>
          <span className="text-xs text-slate-500">{previewSamples.length} rows previewed</span>
        </div>

        {isLoading ? (
          <LoadingSpinner message="Loading preview records..." />
        ) : previewSamples.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No sensor samples found matching the current query filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                  <th className="p-2.5">Timestamp (UTC)</th>
                  <th className="p-2.5">Device</th>
                  <th className="p-2.5">Source</th>
                  <th className="p-2.5">Temp (°C)</th>
                  <th className="p-2.5">RH (%)</th>
                  <th className="p-2.5">Channels (CH0–CH7)</th>
                </tr>
              </thead>
              <tbody>
                {previewSamples.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/60 font-mono">
                    <td className="p-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {format(new Date(s.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300 font-sans">
                      {s.deviceName || 'Device'}
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-sans font-medium">
                        {s.dataSource || s.source || 'SIMULATED'}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      {s.temperature ? s.temperature.toFixed(1) : '--'}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      {s.humidity ? s.humidity.toFixed(1) : '--'}
                    </td>
                    <td className="p-2.5 text-slate-500 dark:text-slate-400 truncate max-w-xs">
                      [{(s.channelReadings || s.channelValues || []).map((v: number) => v.toFixed(1)).join(', ')}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
