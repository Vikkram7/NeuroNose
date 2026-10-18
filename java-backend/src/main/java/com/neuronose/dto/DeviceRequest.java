package com.neuronose.dto;

import com.neuronose.entity.DeviceStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceRequest {

    @NotBlank(message = "Device name is required")
    @Size(min = 2, max = 100, message = "Device name must be between 2 and 100 characters")
    private String name;

    @Size(max = 500, message = "Description cannot exceed 500 characters")
    private String description;

    @Size(max = 150, message = "Location cannot exceed 150 characters")
    private String location;

    @Min(value = 1, message = "Channel count must be at least 1")
    @Max(value = 64, message = "Channel count cannot exceed 64")
    private Integer channelCount;

    private DeviceStatus status;
}
