package com.neuronose.controller;

import com.neuronose.dto.ModelVersionRequest;
import com.neuronose.dto.ModelVersionResponse;
import com.neuronose.service.ModelVersionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/models")
@Tag(name = "Models", description = "Machine learning model version registry, accuracy, and hyperparameters")
public class ModelVersionController {

    private final ModelVersionService modelVersionService;

    public ModelVersionController(ModelVersionService modelVersionService) {
        this.modelVersionService = modelVersionService;
    }

    @GetMapping
    @Operation(summary = "List all registered ML model versions")
    public ResponseEntity<List<ModelVersionResponse>> getAllModels() {
        return ResponseEntity.ok(modelVersionService.getAllModels());
    }

    @GetMapping("/active")
    @Operation(summary = "Get current active model version")
    public ResponseEntity<ModelVersionResponse> getActiveModel() {
        ModelVersionResponse model = modelVersionService.getActiveModel();
        return model != null ? ResponseEntity.ok(model) : ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get model version metadata by UUID")
    public ResponseEntity<ModelVersionResponse> getModelById(@PathVariable UUID id) {
        return ResponseEntity.ok(modelVersionService.getModelById(id));
    }

    @PostMapping
    @Operation(summary = "Register a trained ML model version")
    public ResponseEntity<ModelVersionResponse> registerModel(@Valid @RequestBody ModelVersionRequest request) {
        ModelVersionResponse created = modelVersionService.registerModel(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
