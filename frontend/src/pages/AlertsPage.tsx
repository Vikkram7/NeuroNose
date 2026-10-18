import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle,
  RefreshCw,
  Check,
  Eye,
  X,
  Filter,
  CheckCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { getAlerts, acknowledgeAlert } from '../api/endpoints';
import { Alert, AlertSeverity } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

export const AlertsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [ackFilter, setAckFilter] = useState<string>('ALL');

  // Selected Alert for Detail Modal
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Acknowledge Confirmation Modal
  const [confirmingAlert, setConfirmingAlert] = useState<Alert | null>(null);

  // Fetch alerts
  const {
    data: alerts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(),
    refetchInterval: 8000,
  });

  // Acknowledge mutation
  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
      setConfirmingAlert(null);
    },
  });

  // Filtered alerts
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSeverity =
      severityFilter === 'ALL' || alert.severity === severityFilter;
    const matchesAck =
      ackFilter === 'ALL'
        ? true
        : ackFilter === 'UNACK'
        ? !alert.acknowledged
        : alert.acknowledged;

    return matchesSeverity && matchesAck;
  });

  const criticalCount = alerts.filter(
    (a) => a.severity === 'CRITICAL' && !a.acknowledged
  ).length;
  const warningCount = alerts.filter(
    (a) => a.severity === 'WARNING' && !a.acknowledged
  ).length;
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  const getSeverityIcon = (sev: AlertSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <AlertOctagon className="h-4 w-4 text-rose-500" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'INFO':
        return <Info className="h-4 w-4 text-sky-500" />;
      case 'OK':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Bell className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Alerts & Diagnostics"
        description="Threshold violations, chemical toxicity limits, baseline drift warnings, and hardware bus alarms"
        actions={
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card hover:bg-slate-50 dark:hover:bg-surface-card-hover text-slate-600 dark:text-slate-300"
            title="Refresh alerts"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      {/* Alert KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase">
              Critical Alarms
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {criticalCount}
            </div>
            <span className="text-[11px] text-slate-500">Gas toxicity or hardware fault</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500">
            <AlertOctagon className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">
              Warnings
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {warningCount}
            </div>
            <span className="text-[11px] text-slate-500">Drift or novelty anomalies</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Unacknowledged Total
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {unacknowledgedCount}
            </div>
            <span className="text-[11px] text-slate-500">Requiring technician sign-off</span>
          </div>
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-500">
            <Bell className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Severity:
            </span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
              <option value="OK">OK</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Status:
            </span>
            <select
              value={ackFilter}
              onChange={(e) => setAckFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNACK">Unacknowledged Only</option>
              <option value="ACK">Acknowledged Only</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing {filteredAlerts.length} of {alerts.length} alerts
        </div>
      </div>

      {/* Alerts Table */}
      <div className="rounded-xl border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card overflow-hidden">
        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner message="Querying system alarms..." />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState
              title="Error Loading Alerts"
              message={error instanceof Error ? error.message : 'Database error'}
              onRetry={() => refetch()}
            />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Alarms Found"
              description="No active alerts match current filtering parameters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-surface-border bg-slate-50/50 dark:bg-surface-dark/50 text-slate-400 font-mono uppercase text-[11px]">
                  <th className="py-3 px-4 w-12">Severity</th>
                  <th className="py-3 px-4">Alarm Title</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-border">
                {filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className={`transition-colors hover:bg-slate-50 dark:hover:bg-surface-card-hover ${
                      !alert.acknowledged && alert.severity === 'CRITICAL'
                        ? 'bg-rose-500/5'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {getSeverityIcon(alert.severity)}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {alert.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {alert.message}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {alert.deviceName || alert.deviceId?.slice(0, 8) || 'Node-01'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {alert.timestamp
                        ? format(new Date(alert.timestamp), 'yyyy-MM-dd HH:mm:ss')
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {alert.acknowledged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-500">
                          <CheckCheck className="h-3.5 w-3.5" />
                          Acked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-500 animate-pulse">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!alert.acknowledged && (
                          <button
                            onClick={() => setConfirmingAlert(alert)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedAlert(alert)}
                          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-card border border-slate-200 dark:border-surface-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Alarm Acknowledgment
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to acknowledge this alert? This logs your operator confirmation and silences audible alarms:
            </p>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border text-xs font-mono">
              <div className="font-semibold text-slate-900 dark:text-white">
                {confirmingAlert.title}
              </div>
              <div className="text-slate-400 mt-1">{confirmingAlert.message}</div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-surface-border">
              <button
                onClick={() => setConfirmingAlert(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-surface-border text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-card-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => ackMutation.mutate(confirmingAlert.id)}
                disabled={ackMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white font-medium shadow-sm transition-colors"
              >
                {ackMutation.isPending ? 'Confirming...' : 'Yes, Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-card border border-slate-200 dark:border-surface-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-surface-border">
              <div className="flex items-center gap-2">
                {getSeverityIcon(selectedAlert.severity)}
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Alarm Diagnostic Detail
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Alarm Title
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                  {selectedAlert.title}
                </span>
                <p className="mt-2 text-slate-600 dark:text-slate-300 font-sans">
                  {selectedAlert.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <span className="text-[10px] text-slate-400 block">Severity</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedAlert.severity} size="sm" />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border">
                  <span className="text-[10px] text-slate-400 block">Status</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                    {selectedAlert.acknowledged ? 'Acknowledged' : 'Active / Unacknowledged'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-surface-border space-y-1.5 text-slate-500">
                <div className="flex justify-between">
                  <span>Trigger Timestamp:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {selectedAlert.timestamp
                      ? format(new Date(selectedAlert.timestamp), 'yyyy-MM-dd HH:mm:ss')
                      : 'N/A'}
                  </span>
                </div>
                {selectedAlert.acknowledgedAt && (
                  <div className="flex justify-between">
                    <span>Acknowledged At:</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {format(new Date(selectedAlert.acknowledgedAt), 'yyyy-MM-dd HH:mm:ss')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Device Node ID:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {selectedAlert.deviceId || 'DEV-NODE-01'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-surface-border">
              <button
                onClick={() => setSelectedAlert(null)}
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

export default AlertsPage;
