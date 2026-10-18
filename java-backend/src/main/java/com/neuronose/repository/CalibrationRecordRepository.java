package com.neuronose.repository;

import com.neuronose.entity.CalibrationRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CalibrationRecordRepository extends JpaRepository<CalibrationRecord, UUID>, JpaSpecificationExecutor<CalibrationRecord> {

    Page<CalibrationRecord> findByDeviceId(UUID deviceId, Pageable pageable);

    List<CalibrationRecord> findByDeviceIdOrderByCalibratedAtDesc(UUID deviceId);

    Optional<CalibrationRecord> findFirstByDeviceIdOrderByCalibratedAtDesc(UUID deviceId);

    @Query("SELECT c FROM CalibrationRecord c JOIN FETCH c.device WHERE (:deviceId IS NULL OR c.device.id = :deviceId)")
    Page<CalibrationRecord> findWithFilters(@Param("deviceId") UUID deviceId, Pageable pageable);
}
