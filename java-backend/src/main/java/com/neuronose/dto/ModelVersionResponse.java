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
public class ModelVersionResponse {
    private UUID id;
    private String version;
    private String algorithm;
    private Double accuracy;
    private Double f1Score;
    private Integer trainingSamples;
    private String datasetDescription;
    private Map<String, Object> hyperparameters;
    private Map<String, Double> metrics;
    private Boolean isActive;
    private LocalDateTime trainedAt;
    private LocalDateTime createdAt;
}
