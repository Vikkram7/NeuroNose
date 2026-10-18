package com.neuronose.repository;

import com.neuronose.entity.ModelVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ModelVersionRepository extends JpaRepository<ModelVersion, UUID>, JpaSpecificationExecutor<ModelVersion> {

    List<ModelVersion> findByIsActive(Boolean isActive);

    Optional<ModelVersion> findFirstByIsActiveTrueOrderByTrainedAtDesc();

    Optional<ModelVersion> findFirstByOrderByTrainedAtDesc();

    Optional<ModelVersion> findByVersion(String version);

    List<ModelVersion> findAllByOrderByTrainedAtDesc();
}
