package com.neuronose.entity;

import com.neuronose.entity.converter.DoubleMapJsonConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "predictions", indexes = {
        @Index(name = "idx_prediction_predicted_class", columnList = "predicted_class"),
        @Index(name = "idx_prediction_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Prediction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sample_id", nullable = false)
    private SensorSample sample;

    @Column(name = "predicted_class", nullable = false, length = 100)
    private String predictedClass;

    @Column(name = "confidence", nullable = false)
    private Double confidence;

    @Column(name = "model_version", nullable = false, length = 100)
    private String modelVersion;

    @Column(name = "is_novel", nullable = false)
    @Builder.Default
    private Boolean isNovel = false;

    @Column(name = "novelty_score")
    private Double noveltyScore;

    @Convert(converter = DoubleMapJsonConverter.class)
    @Column(name = "class_probabilities", columnDefinition = "TEXT")
    @Builder.Default
    private Map<String, Double> classProbabilities = new HashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMP")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now(ZoneOffset.UTC);
        }
        if (this.classProbabilities == null) {
            this.classProbabilities = new HashMap<>();
        }
    }
}
