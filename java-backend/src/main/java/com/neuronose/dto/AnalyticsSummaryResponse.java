package com.neuronose.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsSummaryResponse {
    private long totalSamples;
    private long totalDevices;
    private long onlineDevices;
    private long totalAlerts;
    private long unacknowledgedAlerts;
    private long totalPredictions;
    private long novelDetectionsCount;
    private double anomalyRate;
    private List<PredictionResponse> recentPredictions;
    private Map<String, Long> predictionsByClass;
    private Map<String, Long> alertsBySeverity;
}
