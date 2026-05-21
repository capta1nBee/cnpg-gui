package com.cnpg.gui.domain;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;

@Data
@Entity
@Table(name = "alert_rules")
public class AlertRule {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "cluster_name")
    private String clusterName;

    @Column(name = "metric_type")
    private String metricType;

    private Double threshold;
    private String comparison = ">";
    
    @Column(name = "duration_minutes")
    private Integer durationMinutes = 5;
    
    private String status = "active";
}
