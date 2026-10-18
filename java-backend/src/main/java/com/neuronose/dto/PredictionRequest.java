package com.neuronose.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionRequest {

    @NotNull(message = "Sample ID is required")
    private UUID sampleId;

    @NotBlank(message = "Predicted class is required")
    private String predictedClass;

    @NotNull(message = "Confidence is required")
    @DecimalMin(value = "0.0", message = "Confidence must be at least 0.0")
    @DecimalMax(value = "1.0", message = "Confidence cannot exceed 1.0")
    private Double confidence;

    @NotBlank(message = "Model version is required")
    private String modelVersion;

    private Boolean isNovel;

    private Double noveltyScore;

    private Map<String, Double> classProbabilities;
}
