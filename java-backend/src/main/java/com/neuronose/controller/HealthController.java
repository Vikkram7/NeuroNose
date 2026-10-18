package com.neuronose.controller;

import com.neuronose.dto.HealthResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@Tag(name = "Health", description = "Service and database connectivity health probe")
public class HealthController {

    private final DataSource dataSource;

    @Value("${neuronose.demo-mode:true}")
    private boolean demoMode;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping
    @Operation(summary = "Get system health status")
    public ResponseEntity<HealthResponse> getHealth() {
        String dbStatus = "UP";
        try (Connection conn = dataSource.getConnection()) {
            if (!conn.isValid(2)) {
                dbStatus = "DEGRADED";
            }
        } catch (Exception e) {
            dbStatus = "DOWN: " + e.getMessage();
        }

        Map<String, Object> details = new HashMap<>();
        details.put("jvmVersion", System.getProperty("java.version"));
        details.put("osArch", System.getProperty("os.arch"));
        details.put("availableProcessors", Runtime.getRuntime().availableProcessors());
        details.put("freeMemoryMb", Runtime.getRuntime().freeMemory() / (1024 * 1024));

        HealthResponse health = HealthResponse.builder()
                .status("UP".equals(dbStatus) ? "UP" : "DEGRADED")
                .timestamp(LocalDateTime.now(ZoneOffset.UTC))
                .service("neuronose-backend")
                .version("1.0.0")
                .database(dbStatus)
                .demoMode(demoMode)
                .details(details)
                .build();

        return ResponseEntity.ok(health);
    }
}
