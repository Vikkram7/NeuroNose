package com.neuronose.entity;

import com.neuronose.entity.converter.DoubleArrayConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "sensor_samples", indexes = {
        @Index(name = "idx_sensor_sample_device_timestamp", columnList = "device_id, timestamp")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SensorSample {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Convert(converter = DoubleArrayConverter.class)
    @Column(name = "channel_readings", nullable = false, columnDefinition = "TEXT")
    private double[] channelReadings;

    @Column(name = "temperature")
    private Double temperature;

    @Column(name = "humidity")
    private Double humidity;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "data_source", nullable = false, length = 50)
    @Builder.Default
    private String dataSource = DataSource.SIMULATED.name();

    @Column(name = "timestamp", nullable = false, columnDefinition = "TIMESTAMP")
    private LocalDateTime timestamp;

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMP")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.timestamp == null) {
            this.timestamp = now;
        }
    }
}
