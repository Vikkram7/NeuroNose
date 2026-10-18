package com.neuronose.repository;

import com.neuronose.entity.SensorSample;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface SensorSampleRepository extends JpaRepository<SensorSample, UUID>, JpaSpecificationExecutor<SensorSample> {

    Page<SensorSample> findByDeviceId(UUID deviceId, Pageable pageable);

    Page<SensorSample> findByDeviceIdAndTimestampBetween(
            UUID deviceId,
            LocalDateTime start,
            LocalDateTime end,
            Pageable pageable
    );

    Page<SensorSample> findByTimestampBetween(
            LocalDateTime start,
            LocalDateTime end,
            Pageable pageable
    );

    long countByDeviceId(UUID deviceId);

    @Query("SELECT s FROM SensorSample s JOIN FETCH s.device ORDER BY s.timestamp DESC")
    List<SensorSample> findTopSamples(Pageable pageable);

    @Query("SELECT s FROM SensorSample s JOIN FETCH s.device WHERE (:deviceId IS NULL OR s.device.id = :deviceId) AND (:start IS NULL OR s.timestamp >= :start) AND (:end IS NULL OR s.timestamp <= :end)")
    Page<SensorSample> findWithFilters(
            @Param("deviceId") UUID deviceId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable
    );
}
