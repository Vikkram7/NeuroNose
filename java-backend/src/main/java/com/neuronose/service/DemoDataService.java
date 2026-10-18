package com.neuronose.service;

import com.neuronose.entity.*;
import com.neuronose.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class DemoDataService {

    private static final Logger log = LoggerFactory.getLogger(DemoDataService.class);

    private final DeviceRepository deviceRepository;
    private final SensorSampleRepository sensorSampleRepository;
    private final PredictionRepository predictionRepository;
    private final AlertRepository alertRepository;
    private final CalibrationRecordRepository calibrationRepository;
    private final ModelVersionRepository modelVersionRepository;

    public DemoDataService(
            DeviceRepository deviceRepository,
            SensorSampleRepository sensorSampleRepository,
            PredictionRepository predictionRepository,
            AlertRepository alertRepository,
            CalibrationRecordRepository calibrationRepository,
            ModelVersionRepository modelVersionRepository
    ) {
        this.deviceRepository = deviceRepository;
        this.sensorSampleRepository = sensorSampleRepository;
        this.predictionRepository = predictionRepository;
        this.alertRepository = alertRepository;
        this.calibrationRepository = calibrationRepository;
        this.modelVersionRepository = modelVersionRepository;
    }

    @Transactional
    public void seedDemoData() {
        if (deviceRepository.count() > 0) {
            log.info("Database already contains device records ({} found). Skipping demo seed.", deviceRepository.count());
            return;
        }

        log.info("Seeding deterministic SIMULATED demo records for NeuroNose research platform...");
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        // 1. Devices
        Device dev1 = Device.builder()
                .name("NN-CHAMBER-01 (Simulated)")
                .description("Primary environmental volatile test chamber array")
                .location("Volatile Screening Lab B4")
                .channelCount(8)
                .status(DeviceStatus.ONLINE)
                .lastSeenAt(now)
                .createdAt(now.minusDays(5))
                .updatedAt(now)
                .build();

        Device dev2 = Device.builder()
                .name("NN-FIELD-02 (Simulated)")
                .description("Mobile aroma characterization field testbench")
                .location("Cold Storage Unit 3")
                .channelCount(8)
                .status(DeviceStatus.ONLINE)
                .lastSeenAt(now.minusMinutes(2))
                .createdAt(now.minusDays(2))
                .updatedAt(now.minusMinutes(2))
                .build();

        Device dev3 = Device.builder()
                .name("NN-BENCH-03 (Offline)")
                .description("Auxiliary sensor baseline testbench")
                .location("Electronics Calibration Bench")
                .channelCount(8)
                .status(DeviceStatus.OFFLINE)
                .lastSeenAt(now.minusDays(1))
                .createdAt(now.minusDays(10))
                .updatedAt(now.minusDays(1))
                .build();

        dev1 = deviceRepository.save(dev1);
        dev2 = deviceRepository.save(dev2);
        dev3 = deviceRepository.save(dev3);

        // 2. Active Model Version
        Map<String, Object> hparams = new HashMap<>();
        hparams.put("n_estimators", 150);
        hparams.put("max_depth", 12);
        hparams.put("random_state", 42);

        Map<String, Double> metrics = new HashMap<>();
        metrics.put("accuracy", 0.9875);
        metrics.put("macro_f1", 0.9875);
        metrics.put("macro_precision", 0.9884);
        metrics.put("macro_recall", 0.9875);

        ModelVersion model = ModelVersion.builder()
                .version("v1.0.0-rf-sim")
                .algorithm("RandomForestClassifier + IsolationForest")
                .accuracy(0.9875)
                .f1Score(0.9875)
                .trainingSamples(960)
                .datasetDescription("Deterministic synthetic multi-class aroma & VOC benchmark (6 classes, Q8.8 fixed-point)")
                .hyperparameters(hparams)
                .metrics(metrics)
                .isActive(true)
                .trainedAt(now.minusDays(1))
                .createdAt(now.minusDays(1))
                .build();
        modelVersionRepository.save(model);

        // 3. Calibration record
        Map<String, Double> baselines = new HashMap<>();
        for (int i = 0; i < 8; i++) {
            baselines.put("ch" + i, 12.5 + i * 0.8);
        }
        Map<String, Double> scales = new HashMap<>();
        for (int i = 0; i < 8; i++) {
            scales.put("ch" + i, 1.0);
        }

        CalibrationRecord cal = CalibrationRecord.builder()
                .device(dev1)
                .calibrationVersion("CAL-2026-Q1-V1")
                .baselineValues(baselines)
                .scaleFactors(scales)
                .notes("Synthetic factory reference tare calibration under 25C / 45% RH condition")
                .performedBy("Automated Calibrator")
                .calibratedAt(now.minusDays(3))
                .createdAt(now.minusDays(3))
                .build();
        calibrationRepository.save(cal);

        // 4. Samples and Predictions
        String[] classes = {"ambient_air", "coffee_aroma", "tea_aroma", "fresh_food", "spoiled_food", "chemical_voc"};
        double[][] fingerprints = {
                {10.2, 11.5, 9.8, 12.1, 10.4, 11.0, 9.9, 10.7}, // ambient_air
                {35.4, 42.1, 28.9, 54.2, 48.7, 39.5, 31.2, 45.0}, // coffee_aroma
                {22.1, 26.4, 19.8, 32.5, 29.1, 24.8, 20.2, 28.0}, // tea_aroma
                {28.5, 31.0, 24.2, 38.6, 33.4, 29.5, 25.1, 34.2}, // fresh_food
                {65.2, 72.8, 58.4, 84.1, 79.5, 68.2, 61.4, 75.0}, // spoiled_food
                {88.5, 94.2, 82.1, 105.4, 98.7, 86.0, 78.5, 92.1}  // chemical_voc
        };

        Random rand = new Random(42);

        for (int s = 0; s < 30; s++) {
            int clsIdx = s % classes.length;
            String targetCls = classes[clsIdx];
            double[] basePattern = fingerprints[clsIdx];

            double[] readings = new double[8];
            for (int ch = 0; ch < 8; ch++) {
                double noise = (rand.nextDouble() - 0.5) * 2.0;
                readings[ch] = Math.round((basePattern[ch] + noise) * 100.0) / 100.0;
            }

            LocalDateTime sampleTimestamp = now.minusMinutes((30 - s) * 2);

            SensorSample sample = SensorSample.builder()
                    .device(dev1)
                    .channelReadings(readings)
                    .temperature(24.5 + rand.nextDouble() * 1.5)
                    .humidity(46.0 + rand.nextDouble() * 3.0)
                    .sessionId("SESSION_SIM_" + (s / 5 + 1))
                    .dataSource(DataSource.SIMULATED.name())
                    .timestamp(sampleTimestamp)
                    .createdAt(sampleTimestamp)
                    .build();
            sample = sensorSampleRepository.save(sample);

            Map<String, Double> probs = new HashMap<>();
            for (int c = 0; c < classes.length; c++) {
                probs.put(classes[c], c == clsIdx ? 0.95 : 0.01);
            }

            boolean isNovel = (s == 25); // one injected novel sample for demonstration
            if (isNovel) {
                targetCls = "unknown_pattern";
            }

            Prediction pred = Prediction.builder()
                    .sample(sample)
                    .predictedClass(targetCls)
                    .confidence(isNovel ? 0.42 : 0.96)
                    .modelVersion("v1.0.0-rf-sim")
                    .isNovel(isNovel)
                    .noveltyScore(isNovel ? -0.28 : 0.18)
                    .classProbabilities(probs)
                    .createdAt(sampleTimestamp)
                    .build();
            predictionRepository.save(pred);
        }

        // 5. Alerts
        Alert alert1 = Alert.builder()
                .severity(AlertSeverity.WARNING)
                .alertType("BASELINE_DRIFT_DETECTED")
                .message("Sensor Channel CH3 baseline has shifted by +4.2 LSB beyond target tare threshold.")
                .source("RTL_MONITOR")
                .device(dev1)
                .acknowledged(false)
                .createdAt(now.minusHours(1))
                .build();

        Alert alert2 = Alert.builder()
                .severity(AlertSeverity.INFO)
                .alertType("SYSTEM_HEALTH_REPORT")
                .message("Device NN-CHAMBER-01 completed routine self-test. All 8 Q8.8 channels responsive.")
                .source("HEALTH_SERVICE")
                .device(dev1)
                .acknowledged(true)
                .acknowledgedAt(now.minusHours(2))
                .acknowledgedBy("system")
                .createdAt(now.minusHours(3))
                .build();

        Alert alert3 = Alert.builder()
                .severity(AlertSeverity.CRITICAL)
                .alertType("ANOMALOUS_VOLATILE_SURGE")
                .message("Spike detected on VOC channels CH4/CH5 exceeding 100.0 Q8.8 threshold.")
                .source("ANOMALY_FLAGGER")
                .device(dev1)
                .acknowledged(false)
                .createdAt(now.minusMinutes(15))
                .build();

        alertRepository.save(alert1);
        alertRepository.save(alert2);
        alertRepository.save(alert3);

        log.info("Demo data seed completed: 3 devices, 1 active model, 1 calibration, 30 samples, 30 predictions, 3 alerts.");
    }
}
