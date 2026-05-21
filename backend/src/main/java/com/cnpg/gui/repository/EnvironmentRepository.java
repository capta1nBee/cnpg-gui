package com.cnpg.gui.repository;

import com.cnpg.gui.domain.K8sEnvironment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface EnvironmentRepository extends JpaRepository<K8sEnvironment, UUID> {
    
    @Query(value = "SELECT e.* FROM k8s_environments e " +
                   "JOIN tenant_environment_mapping m ON e.id = m.environment_id " +
                   "WHERE m.tenant_id = :tenantId", nativeQuery = true)
    List<K8sEnvironment> findAllByTenantId(@Param("tenantId") UUID tenantId);
}
