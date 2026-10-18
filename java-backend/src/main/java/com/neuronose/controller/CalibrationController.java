package com.neuronose.controller;

import com.neuronose.dto.CalibrationRequest;
import com.neuronose.dto.CalibrationResponse;
import com.neuronose.service.CalibrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/calibrations")
@Tag(name = "Calibration", description = "Sensor array tare baselines, scaling factors, and drift histories")
public class CalibrationController {

    private final CalibrationService calibrationService;

    public CalibrationController(CalibrationService calibrationService) {
        this.calibrationService = calibrationService;
    }

    @GetMapping
    @Operation(summary = "List calibration records with device filter")
    public ResponseEntity<Page<CalibrationResponse>> getCalibrations(
            @RequestParam(required = false) UUID deviceId,
            @PageableDefault(size = 20, sort = "calibratedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(calibrationService.getCalibrations(deviceId, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get calibration record by UUID")
    public ResponseEntity<CalibrationResponse> getCalibrationById(@PathVariable UUID id) {
        return ResponseEntity.ok(calibrationService.getCalibrationById(id));
    }

    @PostMapping
    @Operation(summary = "Record a new sensor baseline calibration session")
    public ResponseEntity<CalibrationResponse> createCalibration(@Valid @RequestBody CalibrationRequest request) {
        CalibrationResponse created = calibrationService.createCalibration(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
