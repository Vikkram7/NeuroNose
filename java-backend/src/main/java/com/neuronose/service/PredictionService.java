package com.neuronose.service;

import com.neuronose.dto.PredictionRequest;
import com.neuronose.dto.PredictionResponse;
import com.neuronose.entity.Prediction;
import com.neuronose.entity.SensorSample;
import com.neuronose.exception.ResourceNotFoundException;
import com.neuronose.repository.PredictionRepository;
import com.neuronose.repository.SensorSampleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PredictionService {

    private final PredictionRepository predictionRepository;
    private final SensorSampleRepository sensorSampleRepository;

    public PredictionService(
            PredictionRepository predictionRepository,
            SensorSampleRepository sensorSampleRepository
    ) {
        this.predictionRepository = predictionRepository;
        this.sensorSampleRepository = sensorSampleRepository;
    }

    public Page<PredictionResponse> getPredictions(String predictedClass, Boolean isNovel, Pageable pageable) {
        Page<Prediction> page = predictionRepository.findWithFilters(predictedClass, isNovel, pageable);
        return page.map(this::toResponse);
    }

    public PredictionResponse getPredictionById(UUID id) {
        Prediction prediction = predictionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prediction", id));
        return toResponse(prediction);
    }

    public List<PredictionResponse> getRecentPredictions() {
        return predictionRepository.findTop10ByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PredictionResponse recordPrediction(PredictionRequest request) {
        SensorSample sample = sensorSampleRepository.findById(request.getSampleId())
                .orElseThrow(() -> new ResourceNotFoundException("SensorSample", request.getSampleId()));

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        Prediction prediction = Prediction.builder()
                .sample(sample)
                .predictedClass(request.getPredictedClass())
                .confidence(request.getConfidence())
                .modelVersion(request.getModelVersion())
                .isNovel(request.getIsNovel() != null ? request.getIsNovel() : false)
                .noveltyScore(request.getNoveltyScore() != null ? request.getNoveltyScore() : 0.0)
                .classProbabilities(request.getClassProbabilities())
                .createdAt(now)
                .build();

        Prediction saved = predictionRepository.save(prediction);
        return toResponse(saved);
    }

    public PredictionResponse toResponse(Prediction prediction) {
        return PredictionResponse.builder()
                .id(prediction.getId())
                .sampleId(prediction.getSample() != null ? prediction.getSample().getId() : null)
                .predictedClass(prediction.getPredictedClass())
                .confidence(prediction.getConfidence())
                .modelVersion(prediction.getModelVersion())
                .isNovel(prediction.getIsNovel())
                .noveltyScore(prediction.getNoveltyScore())
                .classProbabilities(prediction.getClassProbabilities())
                .createdAt(prediction.getCreatedAt())
                .build();
    }
}
