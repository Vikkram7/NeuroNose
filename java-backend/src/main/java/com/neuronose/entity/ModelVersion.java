package com.neuronose.entity;

import com.neuronose.entity.converter.DoubleMapJsonConverter;
import com.neuronose.entity.converter.ObjectMapJsonConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "model_versions", indexes = {
        @Index(name = "idx_model_version_active", columnList = "is_active"),
        @Index(name = "idx_model_version_version", columnList = "version")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ModelVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "version", nullable = false, unique = true, length = 100)
    private String version;

    @Column(name = "algorithm", nullable = false, length = 100)
    private String algorithm;

    @Column(name = "accuracy")
    private Double accuracy;

    @Column(name = "f1_score")
    private Double f1Score;

    @Column(name = "training_samples")
    private Integer trainingSamples;

    @Column(name = "dataset_description", length = 1000)
    private String datasetDescription;

    @Convert(converter = ObjectMapJsonConverter.class)
    @Column(name = "hyperparameters", columnDefinition = "TEXT")
    @Builder.Default
    private Map<String, Object> hyperparameters = new HashMap<>();

    @Convert(converter = DoubleMapJsonConverter.class)
    @Column(name = "metrics", columnDefinition = "TEXT")
    @Builder.Default
    private Map<String, Double> metrics = new HashMap<>();

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = false;

    @Column(name = "trained_at", nullable = false, columnDefinition = "TIMESTAMP")
    private LocalDateTime trainedAt;

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMP")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.trainedAt == null) {
            this.trainedAt = now;
        }
        if (this.isActive == null) {
            this.isActive = false;
        }
        if (this.hyperparameters == null) {
            this.hyperparameters = new HashMap<>();
        }
        if (this.metrics == null) {
            this.metrics = new HashMap<>();
        }
    }
}
