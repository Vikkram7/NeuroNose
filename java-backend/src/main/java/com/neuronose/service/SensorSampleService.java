package com.neuronose.service;

import com.neuronose.dto.SensorSampleRequest;
import com.neuronose.dto.SensorSampleResponse;
import com.neuronose.entity.DataSource;
import com.neuronose.entity.Device;
import com.neuronose.entity.SensorSample;
import com.neuronose.exception.ResourceNotFoundException;
import com.neuronose.exception.ValidationException;
import com.neuronose.repository.DeviceRepository;
import com.neuronose.repository.SensorSampleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SensorSampleService {

    private final SensorSampleRepository sensorSampleRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceService deviceService;

    public SensorSampleService(
            SensorSampleRepository sensorSampleRepository,
            DeviceRepository deviceRepository,
            DeviceService deviceService
    ) {
        this.sensorSampleRepository = sensorSampleRepository;
        this.deviceRepository = deviceRepository;
        this.deviceService = deviceService;
    }

    public Page<SensorSampleResponse> getSamples(UUID deviceId, LocalDateTime start, LocalDateTime end, Pageable pageable) {
        Page<SensorSample> page = sensorSampleRepository.findWithFilters(deviceId, start, end, pageable);
        return page.map(this::toResponse);
    }

    public SensorSampleResponse getSampleById(UUID id) {
        SensorSample sample = sensorSampleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SensorSample", id));
        return toResponse(sample);
    }

    public SensorSample getSampleEntity(UUID id) {
        return sensorSampleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SensorSample", id));
    }

    public List<SensorSampleResponse> getRecentSamples(Pageable pageable) {
        return sensorSampleRepository.findTopSamples(pageable).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public SensorSampleResponse recordSample(SensorSampleRequest request) {
        Device device = deviceRepository.findById(request.getDeviceId())
                .orElseThrow(() -> new ResourceNotFoundException("Device", request.getDeviceId()));

        if (request.getChannelReadings() == null || request.getChannelReadings().length == 0) {
            throw new ValidationException("Channel readings array cannot be empty");
        }

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime sampleTime = request.getTimestamp() != null ? request.getTimestamp() : now;

        String dataSource = request.getDataSource();
        if (dataSource == null || dataSource.isBlank()) {
            dataSource = DataSource.SIMULATED.name();
        }

        SensorSample sample = SensorSample.builder()
                .device(device)
                .channelReadings(request.getChannelReadings())
                .temperature(request.getTemperature())
                .humidity(request.getHumidity())
                .sessionId(request.getSessionId())
                .dataSource(dataSource)
                .timestamp(sampleTime)
                .createdAt(now)
                .build();

        SensorSample saved = sensorSampleRepository.save(sample);
        deviceService.updateLastSeen(device.getId(), sampleTime);

        return toResponse(saved);
    }

    public SensorSampleResponse toResponse(SensorSample sample) {
        return SensorSampleResponse.builder()
                .id(sample.getId())
                .deviceId(sample.getDevice() != null ? sample.getDevice().getId() : null)
                .deviceName(sample.getDevice() != null ? sample.getDevice().getName() : null)
                .channelReadings(sample.getChannelReadings())
                .temperature(sample.getTemperature())
                .humidity(sample.getHumidity())
                .sessionId(sample.getSessionId())
                .dataSource(sample.getDataSource())
                .timestamp(sample.getTimestamp())
                .createdAt(sample.getCreatedAt())
                .build();
    }
}
