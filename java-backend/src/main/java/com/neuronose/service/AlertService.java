package com.neuronose.service;

import com.neuronose.dto.AlertAcknowledgeRequest;
import com.neuronose.dto.AlertResponse;
import com.neuronose.entity.Alert;
import com.neuronose.entity.AlertSeverity;
import com.neuronose.entity.Device;
import com.neuronose.exception.ResourceNotFoundException;
import com.neuronose.repository.AlertRepository;
import com.neuronose.repository.DeviceRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AlertService {

    private final AlertRepository alertRepository;
    private final DeviceRepository deviceRepository;

    public AlertService(AlertRepository alertRepository, DeviceRepository deviceRepository) {
        this.alertRepository = alertRepository;
        this.deviceRepository = deviceRepository;
    }

    public Page<AlertResponse> getAlerts(AlertSeverity severity, Boolean acknowledged, Pageable pageable) {
        Page<Alert> page = alertRepository.findWithFilters(severity, acknowledged, pageable);
        return page.map(this::toResponse);
    }

    public AlertResponse getAlertById(UUID id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Alert", id));
        return toResponse(alert);
    }

    @Transactional
    public AlertResponse createAlert(AlertSeverity severity, String alertType, String message, String source, UUID deviceId) {
        Device device = null;
        if (deviceId != null) {
            device = deviceRepository.findById(deviceId).orElse(null);
        }

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        Alert alert = Alert.builder()
                .severity(severity != null ? severity : AlertSeverity.WARNING)
                .alertType(alertType)
                .message(message)
                .source(source)
                .device(device)
                .acknowledged(false)
                .createdAt(now)
                .build();

        return toResponse(alertRepository.save(alert));
    }

    @Transactional
    public AlertResponse acknowledgeAlert(UUID id, AlertAcknowledgeRequest request) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Alert", id));

        alert.setAcknowledged(true);
        alert.setAcknowledgedAt(LocalDateTime.now(ZoneOffset.UTC));
        alert.setAcknowledgedBy(request != null && request.getAcknowledgedBy() != null ? request.getAcknowledgedBy() : "operator");

        Alert saved = alertRepository.save(alert);
        return toResponse(saved);
    }

    public AlertResponse toResponse(Alert alert) {
        return AlertResponse.builder()
                .id(alert.getId())
                .severity(alert.getSeverity())
                .alertType(alert.getAlertType())
                .message(alert.getMessage())
                .source(alert.getSource())
                .deviceId(alert.getDevice() != null ? alert.getDevice().getId() : null)
                .deviceName(alert.getDevice() != null ? alert.getDevice().getName() : null)
                .acknowledged(alert.getAcknowledged())
                .acknowledgedAt(alert.getAcknowledgedAt())
                .acknowledgedBy(alert.getAcknowledgedBy())
                .createdAt(alert.getCreatedAt())
                .build();
    }
}
