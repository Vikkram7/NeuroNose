package com.neuronose.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class CalibrationRequest {

    @NotNull(message = "Device ID is required")
    private UUID deviceId;

    @NotBlank(message = "Calibration version is required")
    private String calibrationVersion;

    private Map<String, Double> baselineValues;

    private Map<String, Double> scaleFactors;

    private String notes;

    private String performedBy;

    private LocalDateTime calibratedAt;
}
