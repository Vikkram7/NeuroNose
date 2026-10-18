package com.neuronose.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neuronose.dto.SensorSampleRequest;
import com.neuronose.dto.SensorSampleResponse;
import com.neuronose.service.SensorSampleService;
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

@WebMvcTest(SensorSampleController.class)
class SensorSampleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SensorSampleService sensorSampleService;

    @Test
    void getSamples_shouldReturnPageOfSamples() throws Exception {
        UUID sampleId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        double[] readings = {10.5, 20.3, 15.2, 40.1, 33.2, 28.4, 22.1, 19.8};

        SensorSampleResponse response = SensorSampleResponse.builder()
                .id(sampleId)
                .deviceId(deviceId)
                .deviceName("Chamber-01")
                .channelReadings(readings)
                .temperature(25.0)
                .humidity(50.0)
                .sessionId("SESSION_1")
                .dataSource("SIMULATED")
                .timestamp(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();

        Mockito.when(sensorSampleService.getSamples(any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(response)));

        mockMvc.perform(get("/api/samples")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(sampleId.toString()))
                .andExpect(jsonPath("$.content[0].dataSource").value("SIMULATED"));
    }

    @Test
    void recordSample_shouldReturnCreatedSample() throws Exception {
        UUID deviceId = UUID.randomUUID();
        double[] readings = {12.0, 14.5, 18.2, 22.1, 30.0, 25.4, 19.8, 16.2};

        SensorSampleRequest request = SensorSampleRequest.builder()
                .deviceId(deviceId)
                .channelReadings(readings)
                .temperature(24.5)
                .humidity(48.0)
                .sessionId("SESSION_2")
                .dataSource("SIMULATED")
                .build();

        SensorSampleResponse response = SensorSampleResponse.builder()
                .id(UUID.randomUUID())
                .deviceId(deviceId)
                .deviceName("Chamber-01")
                .channelReadings(readings)
                .temperature(24.5)
                .humidity(48.0)
                .sessionId("SESSION_2")
                .dataSource("SIMULATED")
                .timestamp(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();

        Mockito.when(sensorSampleService.recordSample(any(SensorSampleRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/samples")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.channelReadings[0]").value(12.0))
                .andExpect(jsonPath("$.dataSource").value("SIMULATED"));
    }
}
