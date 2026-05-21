package com.cnpg.gui.repository;

import com.cnpg.gui.domain.AlertRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AlertRuleRepository extends JpaRepository<AlertRule, UUID> {
    List<AlertRule> findByTenantId(UUID tenantId);
}
