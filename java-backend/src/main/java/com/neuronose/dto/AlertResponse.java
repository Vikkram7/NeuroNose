package com.neuronose.dto;

import com.neuronose.entity.AlertSeverity;
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
public class AlertResponse {
    private UUID id;
    private AlertSeverity severity;
    private String alertType;
    private String message;
    private String source;
    private UUID deviceId;
    private String deviceName;
    private Boolean acknowledged;
    private LocalDateTime acknowledgedAt;
    private String acknowledgedBy;
    private LocalDateTime createdAt;
}
