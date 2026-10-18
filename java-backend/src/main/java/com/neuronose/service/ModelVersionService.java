package com.neuronose.service;

import com.neuronose.dto.ModelVersionRequest;
import com.neuronose.dto.ModelVersionResponse;
import com.neuronose.entity.ModelVersion;
import com.neuronose.exception.ResourceNotFoundException;
import com.neuronose.repository.ModelVersionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ModelVersionService {

    private final ModelVersionRepository modelVersionRepository;

    public ModelVersionService(ModelVersionRepository modelVersionRepository) {
        this.modelVersionRepository = modelVersionRepository;
    }

    public List<ModelVersionResponse> getAllModels() {
        return modelVersionRepository.findAllByOrderByTrainedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    public ModelVersionResponse getActiveModel() {
        return modelVersionRepository.findFirstByIsActiveTrueOrderByTrainedAtDesc()
                .or(modelVersionRepository::findFirstByOrderByTrainedAtDesc)
                .map(this::toResponse)
                .orElse(null);
    }

    public ModelVersionResponse getModelById(UUID id) {
        ModelVersion model = modelVersionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ModelVersion", id));
        return toResponse(model);
    }

    @Transactional
    public ModelVersionResponse registerModel(ModelVersionRequest request) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        if (Boolean.TRUE.equals(request.getIsActive())) {
            modelVersionRepository.findByIsActive(true).forEach(m -> {
                m.setIsActive(false);
                modelVersionRepository.save(m);
            });
        }

        ModelVersion model = ModelVersion.builder()
                .version(request.getVersion())
                .algorithm(request.getAlgorithm())
                .accuracy(request.getAccuracy())
                .f1Score(request.getF1Score())
                .trainingSamples(request.getTrainingSamples())
                .datasetDescription(request.getDatasetDescription())
                .hyperparameters(request.getHyperparameters())
                .metrics(request.getMetrics())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .trainedAt(now)
                .createdAt(now)
                .build();

        ModelVersion saved = modelVersionRepository.save(model);
        return toResponse(saved);
    }

    public ModelVersionResponse toResponse(ModelVersion model) {
        return ModelVersionResponse.builder()
                .id(model.getId())
                .version(model.getVersion())
                .algorithm(model.getAlgorithm())
                .accuracy(model.getAccuracy())
                .f1Score(model.getF1Score())
                .trainingSamples(model.getTrainingSamples())
                .datasetDescription(model.getDatasetDescription())
                .hyperparameters(model.getHyperparameters())
                .metrics(model.getMetrics())
                .isActive(model.getIsActive())
                .trainedAt(model.getTrainedAt())
                .createdAt(model.getCreatedAt())
                .build();
    }
}
