package com.cnpg.gui.controller;

import com.cnpg.gui.domain.ActiveAlert;
import com.cnpg.gui.domain.AlertRule;
import com.cnpg.gui.domain.NotificationChannel;
import com.cnpg.gui.repository.ActiveAlertRepository;
import com.cnpg.gui.repository.AlertRuleRepository;
import com.cnpg.gui.repository.NotificationChannelRepository;
import com.cnpg.gui.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
public class AlertController {

    private final AlertRuleRepository alertRuleRepository;
    private final NotificationChannelRepository notificationChannelRepository;
    private final ActiveAlertRepository activeAlertRepository;
    private final com.cnpg.gui.service.AlertEvaluatorService alertEvaluatorService;

    @PostMapping("/channels/{id}/test")
    public ResponseEntity<Void> testChannel(@PathVariable UUID id) {
        return notificationChannelRepository.findById(id)
                .map(channel -> {
                    alertEvaluatorService.sendTestNotification(channel);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Active Alerts (OPEN/CLOSED) — visible to all roles including VIEWER
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/active")
    public ResponseEntity<List<ActiveAlert>> getActiveAlerts(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String clusterName) {
        String tenantId = TenantContext.getTenantId();
        List<ActiveAlert> alerts;

        if (tenantId != null && !tenantId.isEmpty()) {
            UUID tid = UUID.fromString(tenantId);
            if (status != null && !status.isEmpty()) {
                alerts = activeAlertRepository.findByStatusAndTenantId(status.toUpperCase(), tid);
            } else {
                alerts = activeAlertRepository.findByTenantId(tid);
            }
        } else {
            if (status != null && !status.isEmpty()) {
                alerts = activeAlertRepository.findByStatus(status.toUpperCase());
            } else {
                alerts = activeAlertRepository.findAll();
            }
        }

        // Filter by cluster if provided
        if (clusterName != null && !clusterName.isEmpty()) {
            alerts = alerts.stream()
                    .filter(a -> clusterName.equalsIgnoreCase(a.getClusterName()))
                    .toList();
        }

        return ResponseEntity.ok(alerts);
    }

    @GetMapping("/active/open")
    public ResponseEntity<List<ActiveAlert>> getOpenAlerts() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId != null && !tenantId.isEmpty()) {
            return ResponseEntity.ok(activeAlertRepository.findByStatusAndTenantId("OPEN", UUID.fromString(tenantId)));
        }
        return ResponseEntity.ok(activeAlertRepository.findByStatus("OPEN"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Alert Rules — ADMIN/SUPERADMIN for write, VIEWER for read
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/rules")
    public ResponseEntity<List<AlertRule>> getRules() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isEmpty()) return ResponseEntity.ok(alertRuleRepository.findAll());
        return ResponseEntity.ok(alertRuleRepository.findByTenantId(UUID.fromString(tenantId)));
    }

    @PostMapping("/rules")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<AlertRule> createRule(@RequestBody AlertRule rule) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId != null && !tenantId.isEmpty()) rule.setTenantId(UUID.fromString(tenantId));
        return ResponseEntity.ok(alertRuleRepository.save(rule));
    }

    @DeleteMapping("/rules/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> deleteRule(@PathVariable UUID id) {
        alertRuleRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/channels")
    public ResponseEntity<List<NotificationChannel>> getChannels() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isEmpty()) return ResponseEntity.ok(notificationChannelRepository.findAll());
        return ResponseEntity.ok(notificationChannelRepository.findByTenantId(UUID.fromString(tenantId)));
    }

    @PostMapping("/channels")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<NotificationChannel> createChannel(@RequestBody NotificationChannel channel) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId != null && !tenantId.isEmpty()) channel.setTenantId(UUID.fromString(tenantId));
        return ResponseEntity.ok(notificationChannelRepository.save(channel));
    }

    @PutMapping("/channels/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<NotificationChannel> updateChannel(@PathVariable UUID id, @RequestBody NotificationChannel channel) {
        return notificationChannelRepository.findById(id)
                .map(existing -> {
                    existing.setChannelType(channel.getChannelType());
                    existing.setTargetConfig(channel.getTargetConfig());
                    existing.setEnabled(channel.isEnabled());
                    return ResponseEntity.ok(notificationChannelRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/channels/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> deleteChannel(@PathVariable UUID id) {
        notificationChannelRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/rules/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<AlertRule> updateRule(@PathVariable UUID id, @RequestBody AlertRule rule) {
        return alertRuleRepository.findById(id)
                .map(existing -> {
                    existing.setMetricType(rule.getMetricType());
                    existing.setComparison(rule.getComparison());
                    existing.setThreshold(rule.getThreshold());
                    existing.setClusterName(rule.getClusterName());
                    existing.setDurationMinutes(rule.getDurationMinutes());
                    existing.setStatus(rule.getStatus());
                    return ResponseEntity.ok(alertRuleRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
