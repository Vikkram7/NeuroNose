package com.neuronose.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neuronose.dto.DeviceRequest;
import com.neuronose.dto.DeviceResponse;
import com.neuronose.entity.DeviceStatus;
import com.neuronose.service.DeviceService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DeviceController.class)
class DeviceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DeviceService deviceService;

    @Test
    void getAllDevices_shouldReturnPageOfDevices() throws Exception {
        UUID id = UUID.randomUUID();
        DeviceResponse dev = DeviceResponse.builder()
                .id(id)
                .name("Test-Chamber-01")
                .description("Test Description")
                .location("Lab 1")
                .channelCount(8)
                .status(DeviceStatus.ONLINE)
                .lastSeenAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Mockito.when(deviceService.getAllDevices(any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(dev)));

        mockMvc.perform(get("/api/devices")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Test-Chamber-01"))
                .andExpect(jsonPath("$.content[0].channelCount").value(8));
    }

    @Test
    void createDevice_shouldReturnCreatedDevice() throws Exception {
        UUID id = UUID.randomUUID();
        DeviceRequest request = DeviceRequest.builder()
                .name("New-Chamber")
                .description("New Description")
                .location("Lab 2")
                .channelCount(8)
                .status(DeviceStatus.ONLINE)
                .build();

        DeviceResponse response = DeviceResponse.builder()
                .id(id)
                .name("New-Chamber")
                .description("New Description")
                .location("Lab 2")
                .channelCount(8)
                .status(DeviceStatus.ONLINE)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Mockito.when(deviceService.createDevice(any(DeviceRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/devices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("New-Chamber"))
                .andExpect(jsonPath("$.id").value(id.toString()));
    }
}
