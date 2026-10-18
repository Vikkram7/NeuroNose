package com.neuronose.repository;

import com.neuronose.entity.Prediction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PredictionRepository extends JpaRepository<Prediction, UUID>, JpaSpecificationExecutor<Prediction> {

    Page<Prediction> findByPredictedClass(String predictedClass, Pageable pageable);

    Page<Prediction> findByIsNovel(Boolean isNovel, Pageable pageable);

    List<Prediction> findTop10ByOrderByCreatedAtDesc();

    long countByPredictedClass(String predictedClass);

    long countByIsNovel(Boolean isNovel);

    @Query("SELECT p.predictedClass, COUNT(p) FROM Prediction p GROUP BY p.predictedClass")
    List<Object[]> countGroupedByPredictedClass();

    @Query("SELECT p FROM Prediction p WHERE (:predictedClass IS NULL OR p.predictedClass = :predictedClass) AND (:isNovel IS NULL OR p.isNovel = :isNovel)")
    Page<Prediction> findWithFilters(
            @Param("predictedClass") String predictedClass,
            @Param("isNovel") Boolean isNovel,
            Pageable pageable
    );
}
