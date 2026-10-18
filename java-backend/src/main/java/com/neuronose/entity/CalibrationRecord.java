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
@Table(name = "calibration_records", indexes = {
        @Index(name = "idx_calibration_device_id", columnList = "device_id"),
        @Index(name = "idx_calibration_calibrated_at", columnList = "calibrated_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CalibrationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Column(name = "calibration_version", nullable = false, length = 50)
    private String calibrationVersion;

    @Convert(converter = DoubleMapJsonConverter.class)
    @Column(name = "baseline_values", columnDefinition = "TEXT")
    @Builder.Default
    private Map<String, Double> baselineValues = new HashMap<>();

    @Convert(converter = DoubleMapJsonConverter.class)
    @Column(name = "scale_factors", columnDefinition = "TEXT")
    @Builder.Default
    private Map<String, Double> scaleFactors = new HashMap<>();

    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "performed_by", length = 100)
    private String performedBy;

    @Column(name = "calibrated_at", nullable = false, columnDefinition = "TIMESTAMP")
    private LocalDateTime calibratedAt;

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMP")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.calibratedAt == null) {
            this.calibratedAt = now;
        }
        if (this.baselineValues == null) {
            this.baselineValues = new HashMap<>();
        }
        if (this.scaleFactors == null) {
            this.scaleFactors = new HashMap<>();
        }
    }
}
