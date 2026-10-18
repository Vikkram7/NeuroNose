// TypeScript interfaces matching NeuroNose Backend DTOs

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'CALIBRATING' | 'ERROR';
export type SampleSource = 'HARDWARE' | 'SIMULATED';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';
export type CalibrationStatus = 'VALID' | 'EXPIRED' | 'DRIFTED' | 'FAILED';

export interface Device {
  id: string;
  name: string;
  serialNumber?: string;
  status: DeviceStatus;
  channelCount: number;
  lastSeen?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  location?: string;
  samplingRateHz?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SensorSample {
  id: string;
  deviceId: string;
  deviceName?: string;
  timestamp: string;
  channelValues?: number[];
  channelReadings?: number[];
  temperature?: number;
  humidity?: number;
  pressure?: number;
  samplingRateHz?: number;
  source?: SampleSource;
  dataSource?: string;
  label?: string;
  notes?: string;
}

export interface Prediction {
  id: string;
  sampleId: string;
  deviceId?: string;
  deviceName?: string;
  predictedClass: string;
  confidence: number; // 0.0 to 1.0 (or percentage)
  probabilities: Record<string, number>;
  noveltyScore: number; // 0.0 (familiar) to 1.0 (completely novel/anomaly)
  modelVersion: string;
  featureContributions?: Record<string, number>;
  timestamp: string;
  inferenceTimeMs?: number;
}

export interface Alert {
  id: string;
  deviceId?: string;
  deviceName?: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface CalibrationRecord {
  id: string;
  deviceId: string;
  deviceName?: string;
  channelIndex: number;
  channelName?: string;
  baselineResistance: number;
  referenceGas: string;
  driftRatePpm?: number;
  slope: number;
  offset: number;
  rSquared?: number;
  status: CalibrationStatus;
  calibratedAt: string;
  expiresAt?: string;
}

export interface ModelVersion {
  id: string;
  version: string;
  name?: string;
  algorithm: string;
  accuracy: number;
  precision?: number;
  recall?: number;
  f1Score: number;
  classes?: string[];
  confusionMatrix?: number[][];
  datasetSize?: number;
  isSyntheticData?: boolean;
  active?: boolean;
  isActive?: boolean;
  trainingSamples?: number;
  datasetDescription?: string;
  trainedAt?: string;
  createdAt?: string;
}

export interface ActivityItem {
  id: string;
  type: 'SAMPLE' | 'PREDICTION' | 'ALERT' | 'CALIBRATION' | 'DEVICE';
  description: string;
  timestamp: string;
  status?: string;
}

export interface AnalyticsSummary {
  totalSamples: number;
  activeDevices?: number;
  totalDevices: number;
  recentPredictionsCount?: number;
  unacknowledgedAlertsCount?: number;
  averageConfidence?: number;
  systemHealth?: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  isDemoMode?: boolean;
  predictionsByClass?: Record<string, number>;
  recentActivity?: ActivityItem[];
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  components?: {
    backend: boolean;
    database: boolean;
    mlService: boolean;
    hardwareBus: boolean;
  };
  uptimeSeconds?: number;
  demoMode?: boolean;
  version?: string;
  timestamp?: string;
  service?: string;
  database?: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first?: boolean;
  last?: boolean;
}

// RTL Validation & Hardware Verification types
export interface RTLTestRun {
  id: string;
  name: string;
  timestamp: string;
  status: 'PASSED' | 'FAILED' | 'RUNNING';
  totalVectors: number;
  passedVectors: number;
  failedVectors: number;
  maxAbsoluteError: number;
  meanSquaredError: number;
  latencyCycles: number;
  clockFrequencyMhz: number;
  quantizationBits: number;
}

export interface RTLComparisonVector {
  vectorId: number;
  inputSampleId: string;
  referenceClass: string;
  referenceConfidence: number;
  rtlClass: string;
  rtlConfidence: number;
  numericalError: number;
  match: boolean;
}

export interface ReportConfig {
  reportType: 'DAILY_SUMMARY' | 'CALIBRATION_AUDIT' | 'ALERTS_LOG' | 'ML_PERFORMANCE' | 'RAW_SAMPLES';
  startDate?: string;
  endDate?: string;
  format: 'CSV' | 'JSON' | 'PDF';
  deviceId?: string;
}
