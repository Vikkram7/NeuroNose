package com.neuronose.controller;

import com.neuronose.dto.PredictionRequest;
import com.neuronose.dto.PredictionResponse;
import com.neuronose.service.PredictionService;
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
@RequestMapping("/api/predictions")
@Tag(name = "Predictions", description = "Volatile pattern inference, scores, and novelty rejections")
public class PredictionController {

    private final PredictionService predictionService;

    public PredictionController(PredictionService predictionService) {
        this.predictionService = predictionService;
    }

    @GetMapping
    @Operation(summary = "List predictions with class and novelty filters")
    public ResponseEntity<Page<PredictionResponse>> getPredictions(
            @RequestParam(required = false) String predictedClass,
            @RequestParam(required = false) Boolean isNovel,
            @PageableDefault(size = 30, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(predictionService.getPredictions(predictedClass, isNovel, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get prediction result by UUID")
    public ResponseEntity<PredictionResponse> getPredictionById(@PathVariable UUID id) {
        return ResponseEntity.ok(predictionService.getPredictionById(id));
    }

    @PostMapping
    @Operation(summary = "Record a model prediction result")
    public ResponseEntity<PredictionResponse> recordPrediction(@Valid @RequestBody PredictionRequest request) {
        PredictionResponse created = predictionService.recordPrediction(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
