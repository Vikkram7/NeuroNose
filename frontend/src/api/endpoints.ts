import apiClient from './client';
import {
  Device,
  SensorSample,
  Prediction,
  Alert,
  CalibrationRecord,
  ModelVersion,
  AnalyticsSummary,
  HealthStatus,
  Page,
  RTLTestRun,
  RTLComparisonVector,
  ReportConfig,
} from '../types';

// Helper to normalize either Page<T> or T[] response into an array
export function extractContent<T>(data: Page<T> | T[]): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.content)) {
    return data.content;
  }
  return [];
}

// System Health
export async function getHealth(): Promise<HealthStatus> {
  const response = await apiClient.get<HealthStatus>('/health');
  return response.data;
}

// Devices
export async function getDevices(): Promise<Device[]> {
  const response = await apiClient.get<Device[] | Page<Device>>('/devices');
  return extractContent(response.data);
}

export async function getDevice(id: string): Promise<Device> {
  const response = await apiClient.get<Device>(`/devices/${id}`);
  return response.data;
}

export async function createDevice(device: Partial<Device>): Promise<Device> {
  const response = await apiClient.post<Device>('/devices', device);
  return response.data;
}

export async function updateDevice(id: string, device: Partial<Device>): Promise<Device> {
  const response = await apiClient.put<Device>(`/devices/${id}`, device);
  return response.data;
}

export async function deleteDevice(id: string): Promise<void> {
  await apiClient.delete(`/devices/${id}`);
}

// Sensor Samples
export interface GetSamplesParams {
  deviceId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  source?: string;
}

export async function getSamples(params?: GetSamplesParams): Promise<SensorSample[]> {
  const response = await apiClient.get<SensorSample[] | Page<SensorSample>>('/samples', {
    params,
  });
  return extractContent(response.data);
}

export async function getSample(id: string): Promise<SensorSample> {
  const response = await apiClient.get<SensorSample>(`/samples/${id}`);
  return response.data;
}

export async function createSample(sample: Partial<SensorSample>): Promise<SensorSample> {
  const response = await apiClient.post<SensorSample>('/samples', sample);
  return response.data;
}

// Predictions / Inferences
export interface GetPredictionsParams {
  sampleId?: string;
  deviceId?: string;
  page?: number;
  size?: number;
}

export async function getPredictions(params?: GetPredictionsParams): Promise<Prediction[]> {
  const response = await apiClient.get<Prediction[] | Page<Prediction>>('/predictions', {
    params,
  });
  return extractContent(response.data);
}

export async function createPrediction(payload: { sampleId: string; modelVersion?: string }): Promise<Prediction> {
  const response = await apiClient.post<Prediction>('/predictions', payload);
  return response.data;
}

// Alerts
export interface GetAlertsParams {
  acknowledged?: boolean;
  severity?: string;
  deviceId?: string;
  page?: number;
  size?: number;
}

export async function getAlerts(params?: GetAlertsParams): Promise<Alert[]> {
  const response = await apiClient.get<Alert[] | Page<Alert>>('/alerts', {
    params,
  });
  return extractContent(response.data);
}

export async function acknowledgeAlert(id: string): Promise<Alert> {
  const response = await apiClient.post<Alert>(`/alerts/${id}/acknowledge`);
  return response.data;
}

// Calibration
export interface GetCalibrationsParams {
  deviceId?: string;
}

export async function getCalibrations(params?: GetCalibrationsParams): Promise<CalibrationRecord[]> {
  const response = await apiClient.get<CalibrationRecord[] | Page<CalibrationRecord>>('/calibrations', {
    params,
  });
  return extractContent(response.data);
}

export async function createCalibration(calibration: Partial<CalibrationRecord>): Promise<CalibrationRecord> {
  const response = await apiClient.post<CalibrationRecord>('/calibrations', calibration);
  return response.data;
}

// Machine Learning Models
export async function getModels(): Promise<ModelVersion[]> {
  const response = await apiClient.get<ModelVersion[] | Page<ModelVersion>>('/models');
  return extractContent(response.data);
}

// Analytics Summary
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await apiClient.get<AnalyticsSummary>('/analytics/summary');
  return response.data;
}

// Reports Export
export async function exportReport(config: ReportConfig): Promise<Blob> {
  const response = await apiClient.post('/reports/export', config, {
    responseType: 'blob',
  });
  return response.data;
}

// RTL Validation
export async function getRTLTestRuns(): Promise<RTLTestRun[]> {
  const response = await apiClient.get<RTLTestRun[] | Page<RTLTestRun>>('/rtl/runs');
  return extractContent(response.data);
}

export async function getRTLVectors(runId: string): Promise<RTLComparisonVector[]> {
  const response = await apiClient.get<RTLComparisonVector[]>(`/rtl/runs/${runId}/vectors`);
  return response.data;
}

export async function runRTLSimulation(payload: { vectorCount: number; modelVersion: string }): Promise<RTLTestRun> {
  const response = await apiClient.post<RTLTestRun>('/rtl/simulate', payload);
  return response.data;
}

// System Settings
export interface SystemSettings {
  samplingRateHz: number;
  activeChannels: number;
  baselineDriftThresholdPpm: number;
  alertOnNovelty: boolean;
  noveltyThreshold: number;
  dataSource: 'HARDWARE' | 'SIMULATED';
  demoMode: boolean;
  simulationOdorProfile: string;
}

export async function getSettings(): Promise<SystemSettings> {
  const response = await apiClient.get<SystemSettings>('/settings');
  return response.data;
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const response = await apiClient.put<SystemSettings>('/settings', settings);
  return response.data;
}
