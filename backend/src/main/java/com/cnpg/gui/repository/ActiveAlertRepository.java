package com.cnpg.gui.repository;

import com.cnpg.gui.domain.ActiveAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ActiveAlertRepository extends JpaRepository<ActiveAlert, UUID> {

    List<ActiveAlert> findByStatus(String status);

    List<ActiveAlert> findByTenantId(UUID tenantId);

    List<ActiveAlert> findByStatusAndTenantId(String status, UUID tenantId);

    Optional<ActiveAlert> findByRuleIdAndClusterNameAndStatus(UUID ruleId, String clusterName, String status);

    List<ActiveAlert> findByClusterName(String clusterName);

    List<ActiveAlert> findByStatusAndClusterName(String status, String clusterName);
}
