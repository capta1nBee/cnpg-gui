package com.cnpg.gui.domain;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;

@Data
@Entity
@Table(name = "notification_channels")
public class NotificationChannel {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "channel_type")
    private String channelType;

    @Column(name = "target_config", columnDefinition = "TEXT")
    private String targetConfig;

    private boolean enabled = true;
}
