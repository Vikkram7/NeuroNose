package com.neuronose.service;

import com.neuronose.dto.AnalyticsSummaryResponse;
import com.neuronose.dto.PredictionResponse;
import com.neuronose.entity.AlertSeverity;
import com.neuronose.entity.DeviceStatus;
import com.neuronose.repository.AlertRepository;
import com.neuronose.repository.DeviceRepository;
import com.neuronose.repository.PredictionRepository;
import com.neuronose.repository.SensorSampleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    private final SensorSampleRepository sensorSampleRepository;
    private final DeviceRepository deviceRepository;
    private final AlertRepository alertRepository;
    private final PredictionRepository predictionRepository;
    private final PredictionService predictionService;

    public AnalyticsService(
            SensorSampleRepository sensorSampleRepository,
            DeviceRepository deviceRepository,
            AlertRepository alertRepository,
            PredictionRepository predictionRepository,
            PredictionService predictionService
    ) {
        this.sensorSampleRepository = sensorSampleRepository;
        this.deviceRepository = deviceRepository;
        this.alertRepository = alertRepository;
        this.predictionRepository = predictionRepository;
        this.predictionService = predictionService;
    }

    public AnalyticsSummaryResponse getSummary() {
        long totalSamples = sensorSampleRepository.count();
        long totalDevices = deviceRepository.count();
        long onlineDevices = deviceRepository.countByStatus(DeviceStatus.ONLINE);
        long totalAlerts = alertRepository.count();
        long unacknowledgedAlerts = alertRepository.countByAcknowledged(false);
        long totalPredictions = predictionRepository.count();
        long novelDetectionsCount = predictionRepository.countByIsNovel(true);

        double anomalyRate = totalPredictions > 0
                ? Math.round(((double) novelDetectionsCount / totalPredictions) * 1000.0) / 10.0
                : 0.0;

        List<PredictionResponse> recentPredictions = predictionService.getRecentPredictions();

        Map<String, Long> predictionsByClass = new HashMap<>();
        List<Object[]> classCounts = predictionRepository.countGroupedByPredictedClass();
        for (Object[] row : classCounts) {
            String className = (String) row[0];
            Long count = (Long) row[1];
            if (className != null) {
                predictionsByClass.put(className, count);
            }
        }

        Map<String, Long> alertsBySeverity = new HashMap<>();
        List<Object[]> alertCounts = alertRepository.countGroupedBySeverity();
        for (Object[] row : alertCounts) {
            AlertSeverity severity = (AlertSeverity) row[0];
            Long count = (Long) row[1];
            if (severity != null) {
                alertsBySeverity.put(severity.name(), count);
            }
        }

        return AnalyticsSummaryResponse.builder()
                .totalSamples(totalSamples)
                .totalDevices(totalDevices)
                .onlineDevices(onlineDevices)
                .totalAlerts(totalAlerts)
                .unacknowledgedAlerts(unacknowledgedAlerts)
                .totalPredictions(totalPredictions)
                .novelDetectionsCount(novelDetectionsCount)
                .anomalyRate(anomalyRate)
                .recentPredictions(recentPredictions)
                .predictionsByClass(predictionsByClass)
                .alertsBySeverity(alertsBySeverity)
                .build();
    }
}
