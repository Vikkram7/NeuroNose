package com.neuronose.controller;

import com.neuronose.dto.AlertAcknowledgeRequest;
import com.neuronose.dto.AlertResponse;
import com.neuronose.entity.AlertSeverity;
import com.neuronose.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/alerts")
@Tag(name = "Alerts", description = "Sensor drift, hardware failure, and threshold anomaly alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    @Operation(summary = "List alerts filtered by severity and acknowledged state")
    public ResponseEntity<Page<AlertResponse>> getAlerts(
            @RequestParam(required = false) AlertSeverity severity,
            @RequestParam(required = false) Boolean acknowledged,
            @PageableDefault(size = 30, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(alertService.getAlerts(severity, acknowledged, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get alert by UUID")
    public ResponseEntity<AlertResponse> getAlertById(@PathVariable UUID id) {
        return ResponseEntity.ok(alertService.getAlertById(id));
    }

    @RequestMapping(value = "/{id}/acknowledge", method = {RequestMethod.PATCH, RequestMethod.POST})
    @Operation(summary = "Acknowledge an alert")
    public ResponseEntity<AlertResponse> acknowledgeAlert(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) AlertAcknowledgeRequest request
    ) {
        if (request == null) {
            request = new AlertAcknowledgeRequest("operator");
        }
        return ResponseEntity.ok(alertService.acknowledgeAlert(id, request));
    }
}
