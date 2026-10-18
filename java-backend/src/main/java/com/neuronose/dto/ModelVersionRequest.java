package com.neuronose.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelVersionRequest {

    @NotBlank(message = "Model version is required")
    private String version;

    @NotBlank(message = "Algorithm is required")
    private String algorithm;

    private Double accuracy;

    private Double f1Score;

    private Integer trainingSamples;

    private String datasetDescription;

    private Map<String, Object> hyperparameters;

    private Map<String, Double> metrics;

    private Boolean isActive;
}
