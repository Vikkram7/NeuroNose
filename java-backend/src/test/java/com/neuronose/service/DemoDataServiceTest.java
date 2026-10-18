package com.neuronose.service;

import com.neuronose.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DemoDataServiceTest {

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private SensorSampleRepository sensorSampleRepository;

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private AlertRepository alertRepository;

    @Mock
    private CalibrationRecordRepository calibrationRepository;

    @Mock
    private ModelVersionRepository modelVersionRepository;

    @InjectMocks
    private DemoDataService demoDataService;

    @Test
    void seedDemoData_whenEmptyDatabase_shouldSeedRecords() {
        Mockito.when(deviceRepository.count()).thenReturn(0L);

        demoDataService.seedDemoData();

        verify(deviceRepository, Mockito.atLeast(1)).save(any());
        verify(modelVersionRepository, Mockito.atLeast(1)).save(any());
        verify(calibrationRepository, Mockito.atLeast(1)).save(any());
        verify(sensorSampleRepository, Mockito.atLeast(1)).save(any());
        verify(predictionRepository, Mockito.atLeast(1)).save(any());
        verify(alertRepository, Mockito.atLeast(1)).save(any());
    }

    @Test
    void seedDemoData_whenNonEmptyDatabase_shouldSkipSeeding() {
        Mockito.when(deviceRepository.count()).thenReturn(5L);

        demoDataService.seedDemoData();

        verify(deviceRepository, never()).save(any());
        verify(sensorSampleRepository, never()).save(any());
    }
}
