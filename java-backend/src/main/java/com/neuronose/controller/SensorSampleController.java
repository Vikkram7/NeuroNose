package com.neuronose.controller;

import com.neuronose.dto.SensorSampleRequest;
import com.neuronose.dto.SensorSampleResponse;
import com.neuronose.service.SensorSampleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/samples")
@Tag(name = "Sensor Samples", description = "Raw and preprocessed multi-channel sensor acquisitions")
public class SensorSampleController {

    private final SensorSampleService sensorSampleService;

    public SensorSampleController(SensorSampleService sensorSampleService) {
        this.sensorSampleService = sensorSampleService;
    }

    @GetMapping
    @Operation(summary = "Query sensor samples with device, start, and end time filters")
    public ResponseEntity<Page<SensorSampleResponse>> getSamples(
            @RequestParam(required = false) UUID deviceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @PageableDefault(size = 50, sort = "timestamp", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(sensorSampleService.getSamples(deviceId, startDate, endDate, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get sensor sample by UUID")
    public ResponseEntity<SensorSampleResponse> getSampleById(@PathVariable UUID id) {
        return ResponseEntity.ok(sensorSampleService.getSampleById(id));
    }

    @PostMapping
    @Operation(summary = "Ingest a new multi-channel sensor sample")
    public ResponseEntity<SensorSampleResponse> recordSample(@Valid @RequestBody SensorSampleRequest request) {
        SensorSampleResponse created = sensorSampleService.recordSample(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
