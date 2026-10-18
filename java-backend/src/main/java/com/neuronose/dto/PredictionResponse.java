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
public class PredictionResponse {
    private UUID id;
    private UUID sampleId;
    private String predictedClass;
    private Double confidence;
    private String modelVersion;
    private Boolean isNovel;
    private Double noveltyScore;
    private Map<String, Double> classProbabilities;
    private LocalDateTime createdAt;
}
