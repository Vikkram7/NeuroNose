package com.neuronose.repository;

import com.neuronose.entity.Device;
import com.neuronose.entity.DeviceStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceRepository extends JpaRepository<Device, UUID>, JpaSpecificationExecutor<Device> {

    Page<Device> findByStatus(DeviceStatus status, Pageable pageable);

    List<Device> findByStatus(DeviceStatus status);

    long countByStatus(DeviceStatus status);

    Optional<Device> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
