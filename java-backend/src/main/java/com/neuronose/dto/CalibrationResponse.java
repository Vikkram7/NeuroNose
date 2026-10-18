package com.neuronose.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalibrationResponse {
    private UUID id;
    private UUID deviceId;
    private String deviceName;
    private String calibrationVersion;
    private Map<String, Double> baselineValues;
    private Map<String, Double> scaleFactors;
    private String notes;
    private String performedBy;
    private LocalDateTime calibratedAt;
    private LocalDateTime createdAt;
}
