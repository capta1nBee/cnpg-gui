package com.cnpg.gui.repository;

import com.cnpg.gui.domain.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
}
