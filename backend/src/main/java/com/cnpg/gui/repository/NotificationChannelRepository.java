package com.cnpg.gui.repository;

import com.cnpg.gui.domain.NotificationChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface NotificationChannelRepository extends JpaRepository<NotificationChannel, UUID> {
    List<NotificationChannel> findByTenantId(UUID tenantId);
}
