package com.neuronose.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SensorSampleResponse {
    private UUID id;
    private UUID deviceId;
    private String deviceName;
    private double[] channelReadings;
    private Double temperature;
    private Double humidity;
    private String sessionId;
    private String dataSource;
    private LocalDateTime timestamp;
    private LocalDateTime createdAt;
}
