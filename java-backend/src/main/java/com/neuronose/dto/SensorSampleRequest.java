package com.neuronose.dto;

import jakarta.validation.constraints.NotNull;
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
public class SensorSampleRequest {

    @NotNull(message = "Device ID is required")
    private UUID deviceId;

    @NotNull(message = "Channel readings are required")
    private double[] channelReadings;

    private Double temperature;

    private Double humidity;

    private String sessionId;

    private String dataSource;

    private LocalDateTime timestamp;
}
