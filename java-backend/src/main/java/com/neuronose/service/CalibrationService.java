package com.neuronose.service;

import com.neuronose.dto.CalibrationRequest;
import com.neuronose.dto.CalibrationResponse;
import com.neuronose.entity.CalibrationRecord;
import com.neuronose.entity.Device;
import com.neuronose.exception.ResourceNotFoundException;
import com.neuronose.repository.CalibrationRecordRepository;
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
public class CalibrationService {

    private final CalibrationRecordRepository calibrationRepository;
    private final DeviceRepository deviceRepository;

    public CalibrationService(
            CalibrationRecordRepository calibrationRepository,
            DeviceRepository deviceRepository
    ) {
        this.calibrationRepository = calibrationRepository;
        this.deviceRepository = deviceRepository;
    }

    public Page<CalibrationResponse> getCalibrations(UUID deviceId, Pageable pageable) {
        Page<CalibrationRecord> page = calibrationRepository.findWithFilters(deviceId, pageable);
        return page.map(this::toResponse);
    }

    public CalibrationResponse getCalibrationById(UUID id) {
        CalibrationRecord record = calibrationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CalibrationRecord", id));
        return toResponse(record);
    }

    @Transactional
    public CalibrationResponse createCalibration(CalibrationRequest request) {
        Device device = deviceRepository.findById(request.getDeviceId())
                .orElseThrow(() -> new ResourceNotFoundException("Device", request.getDeviceId()));

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime calTime = request.getCalibratedAt() != null ? request.getCalibratedAt() : now;

        CalibrationRecord record = CalibrationRecord.builder()
                .device(device)
                .calibrationVersion(request.getCalibrationVersion())
                .baselineValues(request.getBaselineValues())
                .scaleFactors(request.getScaleFactors())
                .notes(request.getNotes())
                .performedBy(request.getPerformedBy() != null ? request.getPerformedBy() : "system")
                .calibratedAt(calTime)
                .createdAt(now)
                .build();

        CalibrationRecord saved = calibrationRepository.save(record);
        return toResponse(saved);
    }

    public CalibrationResponse toResponse(CalibrationRecord record) {
        return CalibrationResponse.builder()
                .id(record.getId())
                .deviceId(record.getDevice() != null ? record.getDevice().getId() : null)
                .deviceName(record.getDevice() != null ? record.getDevice().getName() : null)
                .calibrationVersion(record.getCalibrationVersion())
                .baselineValues(record.getBaselineValues())
                .scaleFactors(record.getScaleFactors())
                .notes(record.getNotes())
                .performedBy(record.getPerformedBy())
                .calibratedAt(record.getCalibratedAt())
                .createdAt(record.getCreatedAt())
                .build();
    }
}
