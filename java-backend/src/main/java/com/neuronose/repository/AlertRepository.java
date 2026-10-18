package com.neuronose.repository;

import com.neuronose.entity.Alert;
import com.neuronose.entity.AlertSeverity;
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
public interface AlertRepository extends JpaRepository<Alert, UUID>, JpaSpecificationExecutor<Alert> {

    Page<Alert> findByAcknowledged(Boolean acknowledged, Pageable pageable);

    Page<Alert> findBySeverity(AlertSeverity severity, Pageable pageable);

    long countBySeverity(AlertSeverity severity);

    long countByAcknowledged(Boolean acknowledged);

    @Query("SELECT a.severity, COUNT(a) FROM Alert a GROUP BY a.severity")
    List<Object[]> countGroupedBySeverity();

    @Query("SELECT a FROM Alert a LEFT JOIN FETCH a.device WHERE (:severity IS NULL OR a.severity = :severity) AND (:acknowledged IS NULL OR a.acknowledged = :acknowledged)")
    Page<Alert> findWithFilters(
            @Param("severity") AlertSeverity severity,
            @Param("acknowledged") Boolean acknowledged,
            Pageable pageable
    );
}
