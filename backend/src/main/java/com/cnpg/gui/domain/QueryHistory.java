package com.cnpg.gui.domain;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "query_history")
@Data
public class QueryHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "username")
    private String username;

    @Column(name = "environment_id", nullable = false)
    private UUID environmentId;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "namespace", nullable = false)
    private String namespace;

    @Column(name = "cluster_name", nullable = false)
    private String clusterName;

    @Column(name = "query_text", columnDefinition = "TEXT", nullable = false)
    private String queryText;

    @Column(name = "row_count")
    private Integer rowCount;

    @Column(name = "status")
    private String status; // SUCCESS, FAILED

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
