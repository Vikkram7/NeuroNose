package com.neuronose.service;

import com.neuronose.dto.DeviceRequest;
import com.neuronose.dto.DeviceResponse;
import com.neuronose.entity.Device;
import com.neuronose.entity.DeviceStatus;
import com.neuronose.exception.ResourceNotFoundException;
import com.neuronose.exception.ValidationException;
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
public class DeviceService {

    private final DeviceRepository deviceRepository;

    public DeviceService(DeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }

    public Page<DeviceResponse> getAllDevices(DeviceStatus status, Pageable pageable) {
        Page<Device> devices = (status != null)
                ? deviceRepository.findByStatus(status, pageable)
                : deviceRepository.findAll(pageable);
        return devices.map(this::toResponse);
    }

    public DeviceResponse getDeviceById(UUID id) {
        Device device = getDeviceEntity(id);
        return toResponse(device);
    }

    public Device getDeviceEntity(UUID id) {
        return deviceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Device", id));
    }

    @Transactional
    public DeviceResponse createDevice(DeviceRequest request) {
        if (deviceRepository.existsByNameIgnoreCase(request.getName())) {
            throw new ValidationException("Device with name '" + request.getName() + "' already exists");
        }

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        Device device = Device.builder()
                .name(request.getName())
                .description(request.getDescription())
                .location(request.getLocation())
                .channelCount(request.getChannelCount() != null ? request.getChannelCount() : 8)
                .status(request.getStatus() != null ? request.getStatus() : DeviceStatus.ONLINE)
                .lastSeenAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Device saved = deviceRepository.save(device);
        return toResponse(saved);
    }

    @Transactional
    public DeviceResponse updateDevice(UUID id, DeviceRequest request) {
        Device device = getDeviceEntity(id);

        if (!device.getName().equalsIgnoreCase(request.getName()) &&
                deviceRepository.existsByNameIgnoreCase(request.getName())) {
            throw new ValidationException("Device with name '" + request.getName() + "' already exists");
        }

        device.setName(request.getName());
        device.setDescription(request.getDescription());
        device.setLocation(request.getLocation());
        if (request.getChannelCount() != null) {
            device.setChannelCount(request.getChannelCount());
        }
        if (request.getStatus() != null) {
            device.setStatus(request.getStatus());
        }
        device.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));

        return toResponse(deviceRepository.save(device));
    }

    @Transactional
    public void updateLastSeen(UUID deviceId, LocalDateTime timestamp) {
        deviceRepository.findById(deviceId).ifPresent(device -> {
            device.setLastSeenAt(timestamp != null ? timestamp : LocalDateTime.now(ZoneOffset.UTC));
            deviceRepository.save(device);
        });
    }

    @Transactional
    public void deleteDevice(UUID id) {
        Device device = getDeviceEntity(id);
        deviceRepository.delete(device);
    }

    public DeviceResponse toResponse(Device device) {
        return DeviceResponse.builder()
                .id(device.getId())
                .name(device.getName())
                .description(device.getDescription())
                .location(device.getLocation())
                .channelCount(device.getChannelCount())
                .status(device.getStatus())
                .lastSeenAt(device.getLastSeenAt())
                .createdAt(device.getCreatedAt())
                .updatedAt(device.getUpdatedAt())
                .build();
    }
}
