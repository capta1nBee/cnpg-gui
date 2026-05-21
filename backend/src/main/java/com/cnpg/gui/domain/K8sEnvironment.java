package com.cnpg.gui.domain;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "k8s_environments")
public class K8sEnvironment {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String kubeconfig;

    @Column(name = "api_server_url")
    private String apiServerUrl;

    @Column(columnDefinition = "VARCHAR(20) DEFAULT 'active'")
    private String status = "active";

    @Column(name = "is_default")
    private boolean isDefault = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
