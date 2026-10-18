import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  Plus,
  RefreshCw,
  HardDrive,
  Activity,
  Sliders,
  MapPin,
  Clock,
  Wifi,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  FileCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getDevices,
  createDevice,
  deleteDevice,
  getDevice,
} from '../api/endpoints';
import { Device, DeviceStatus } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

export const DevicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [channelCount, setChannelCount] = useState(8);
  const [samplingRateHz, setSamplingRateHz] = useState(100);
  const [location, setLocation] = useState('Chamber Alpha');
  const [firmwareVersion, setFirmwareVersion] = useState('v2.1.4');

  // Fetch devices
  const {
    data: devices = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 10000,
  });

  // Create Device Mutation
  const createMutation = useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsAddModalOpen(false);
      resetForm();
    },
  });

  // Delete Device Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      if (selectedDevice) setSelectedDevice(null);
    },
  });

  const resetForm = () => {
    setName('');
    setSerialNumber('');
    setChannelCount(8);
    setSamplingRateHz(100);
    setLocation('Chamber Alpha');
    setFirmwareVersion('v2.1.4');
  };

  const handleAddDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate({
      name,
      serialNumber: serialNumber || `NN-${Math.floor(1000 + Math.random() * 9000)}`,
      channelCount,
      samplingRateHz,
      location,
      firmwareVersion,
      status: 'ONLINE',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hardware Devices & Sensor Nodes"
        description="Configuration and telemetry status for physical and simulated electronic nose nodes"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card hover:bg-slate-50 dark:hover:bg-surface-card-hover text-slate-600 dark:text-slate-300"
              title="Refresh device list"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Register Device
            </button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingSpinner fullPage message="Querying registered sensor arrays..." />
      ) : error ? (
        <ErrorState
          title="Failed to Load Devices"
          message={error instanceof Error ? error.message : 'Unknown communication error'}
          onRetry={() => refetch()}
        />
      ) : devices.length === 0 ? (
        <EmptyState
          title="No Devices Found"
          description="Register a new physical hardware array or connect to the demo sensor bus."
          actionLabel="Register Device"
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => {
            const isSelected = selectedDevice?.id === device.id;
            return (
              <div
                key={device.id}
                className={`rounded-xl border transition-all duration-200 bg-white dark:bg-surface-card p-5 space-y-4 shadow-sm flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-500 ring-1 ring-sky-500'
                    : 'border-slate-200 dark:border-surface-border hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                        <Cpu className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {device.name}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-400">
                          SN: {device.serialNumber || 'NN-DEV-001'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={device.status} size="sm" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-100 dark:border-surface-border">
                      <span className="text-[10px] text-slate-400 block">Channels</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {device.channelCount || 8} Active MOX
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-100 dark:border-surface-border">
                      <span className="text-[10px] text-slate-400 block">Sampling Rate</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {device.samplingRateHz || 100} Hz
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{device.location || 'Chamber Alpha'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wifi className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono text-[11px]">
                        {device.ipAddress || '192.168.1.104'} • FW {device.firmwareVersion || 'v1.0'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px]">
                        Last seen:{' '}
                        {device.lastSeen
                          ? format(new Date(device.lastSeen), 'yyyy-MM-dd HH:mm:ss')
                          : 'Just now'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-surface-border flex items-center justify-between">
                  <button
                    onClick={() => setSelectedDevice(device)}
                    className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    View Detail Specs
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(device.id)}
                    className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Remove device"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-card border border-slate-200 dark:border-surface-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-surface-border">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu className="h-5 w-5 text-sky-500" />
                Register New Sensor Node
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chamber-B Sensor Array"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NN-SN-4982"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Channels
                  </label>
                  <select
                    value={channelCount}
                    onChange={(e) => setChannelCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  >
                    <option value={4}>4 Channels</option>
                    <option value={8}>8 Channels</option>
                    <option value={16}>16 Channels</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Sampling Rate (Hz)
                  </label>
                  <input
                    type="number"
                    value={samplingRateHz}
                    onChange={(e) => setSamplingRateHz(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Location / Chamber
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Firmware Version
                </label>
                <input
                  type="text"
                  value={firmwareVersion}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
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
                  {createMutation.isPending ? 'Registering...' : 'Save Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Detail Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-card border border-slate-200 dark:border-surface-border rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-surface-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDevice.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400">ID: {selectedDevice.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <span className="text-slate-400 block text-[10px]">Operational Status</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedDevice.status} size="sm" />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <span className="text-slate-400 block text-[10px]">Active MOX Channels</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                    {selectedDevice.channelCount} Channels
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <span className="text-slate-400 block text-[10px]">Sampling Rate</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                    {selectedDevice.samplingRateHz || 100} Hz
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <span className="text-slate-400 block text-[10px]">Firmware</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                    {selectedDevice.firmwareVersion || 'v2.1.4'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark space-y-2">
                <div className="text-slate-700 dark:text-slate-300 font-semibold font-sans">
                  Bus Diagnostics
                </div>
                <div className="text-slate-500 flex justify-between">
                  <span>I2C Bus Address:</span>
                  <span className="text-slate-800 dark:text-slate-200">0x48 (ADS1115 ADC)</span>
                </div>
                <div className="text-slate-500 flex justify-between">
                  <span>SPI Communication:</span>
                  <span className="text-emerald-500 font-bold">Synchronized (10 MHz)</span>
                </div>
                <div className="text-slate-500 flex justify-between">
                  <span>Heater Circuit Voltage:</span>
                  <span className="text-slate-800 dark:text-slate-200">5.00 V ± 0.02 V</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-surface-border">
              <button
                onClick={() => setSelectedDevice(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
