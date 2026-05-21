package com.cnpg.gui.domain;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "active_alerts")
public class ActiveAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "rule_id")
    private UUID ruleId;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "cluster_name")
    private String clusterName;

    @Column(name = "metric_type")
    private String metricType;

    private String comparison;
    private Double threshold;

    @Column(name = "current_value")
    private Double currentValue;

    /** OPEN or CLOSED */
    private String status = "OPEN";

    /** CRITICAL or WARNING */
    private String severity;

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "last_evaluated_at")
    private LocalDateTime lastEvaluatedAt;

    /** Whether OPEN notification was sent */
    @Column(name = "open_notified")
    private boolean openNotified = false;

    /** Whether CLOSED notification was sent */
    @Column(name = "close_notified")
    private boolean closeNotified = false;
}
