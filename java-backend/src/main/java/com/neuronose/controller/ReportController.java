package com.neuronose.controller;

import com.neuronose.entity.SensorSample;
import com.neuronose.repository.SensorSampleRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Reports", description = "Export experiment data and sensor historical measurements")
public class ReportController {

    private final SensorSampleRepository sensorSampleRepository;

    public ReportController(SensorSampleRepository sensorSampleRepository) {
        this.sensorSampleRepository = sensorSampleRepository;
    }

    @GetMapping("/export")
    @Operation(summary = "Export sensor sample records as CSV")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(required = false) UUID deviceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "1000") int limit
    ) {
        PageRequest pageRequest = PageRequest.of(0, Math.min(limit, 5000), Sort.by(Sort.Direction.DESC, "timestamp"));
        Page<SensorSample> page = sensorSampleRepository.findWithFilters(deviceId, startDate, endDate, pageRequest);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(baos, true, StandardCharsets.UTF_8)) {
            // Write CSV Header
            writer.println("SampleID,DeviceID,DeviceName,Timestamp,DataSource,SessionID,Temperature_C,Humidity_RH,CH0,CH1,CH2,CH3,CH4,CH5,CH6,CH7");

            for (SensorSample s : page.getContent()) {
                StringBuilder line = new StringBuilder();
                line.append(s.getId()).append(",");
                line.append(s.getDevice() != null ? s.getDevice().getId() : "").append(",");
                line.append(s.getDevice() != null ? "\"" + s.getDevice().getName() + "\"" : "").append(",");
                line.append(s.getTimestamp() != null ? s.getTimestamp().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : "").append(",");
                line.append(s.getDataSource()).append(",");
                line.append(s.getSessionId() != null ? s.getSessionId() : "").append(",");
                line.append(s.getTemperature() != null ? s.getTemperature() : "").append(",");
                line.append(s.getHumidity() != null ? s.getHumidity() : "").append(",");

                double[] readings = s.getChannelReadings();
                for (int i = 0; i < 8; i++) {
                    if (readings != null && i < readings.length) {
                        line.append(readings[i]);
                    } else {
                        line.append("0.0");
                    }
                    if (i < 7) {
                        line.append(",");
                    }
                }
                writer.println(line);
            }
        }

        byte[] csvData = baos.toByteArray();
        String filename = "neuronose_export_" + DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss").format(LocalDateTime.now()) + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csvData);
    }
}
