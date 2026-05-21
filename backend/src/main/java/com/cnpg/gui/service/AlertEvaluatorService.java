package com.cnpg.gui.service;

import com.cnpg.gui.domain.ActiveAlert;
import com.cnpg.gui.domain.AlertRule;
import com.cnpg.gui.domain.NotificationChannel;
import com.cnpg.gui.kubernetes.K8sClientManager;
import com.cnpg.gui.repository.ActiveAlertRepository;
import com.cnpg.gui.repository.AlertRuleRepository;
import com.cnpg.gui.repository.K8sEnvironmentRepository;
import com.cnpg.gui.repository.NotificationChannelRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.ExecWatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Alert Evaluation Engine — Works without Metrics Server.
 *
 * Metric sources (all fetched from primary pod via kubectl exec):
 * - SQL metrics → psql -tAq -c "..." (pg_stat_activity, pg_stat_database, etc.)
 * - CPU → /proc/loadavg
 * - Memory → /proc/meminfo
 * - WAL Size → du -sb /var/lib/postgresql/data/pgdata/pg_wal
 *
 * Runs every 60 seconds, evaluates active alert rules,
 * prevents spam with cooldown protection, sends EMAIL/WEBHOOK notifications
 * when thresholds are exceeded.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertEvaluatorService {

    private final AlertRuleRepository alertRuleRepository;
    private final NotificationChannelRepository notificationChannelRepository;
    private final K8sEnvironmentRepository k8sEnvironmentRepository;
    private final com.cnpg.gui.repository.TenantRepository tenantRepository;
    private final K8sClientManager k8sClientManager;
    private final EmailService emailService;
    private final ObjectMapper objectMapper;
    private final ActiveAlertRepository activeAlertRepository;

    private static final io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext CNPG_CLUSTER_CONTEXT = 
        new io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext.Builder()
            .withGroup("postgresql.cnpg.io")
            .withVersion("v1")
            .withPlural("clusters")
            .withScope("Namespaced")
            .build();



    // ─────────────────────────────────────────────────────────────────────────
    // Scheduler — runs every 60 seconds
    // ─────────────────────────────────────────────────────────────────────────

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void evaluateAlertRules() {
        List<AlertRule> activeRules = alertRuleRepository.findAll().stream()
                .filter(r -> "active".equalsIgnoreCase(r.getStatus()))
                .toList();

        if (activeRules.isEmpty()) {
            log.debug("AlertEvaluator: no active rules, skipping.");
            return;
        }

        log.info("AlertEvaluator: {} active rules are being evaluated...", activeRules.size());
        List<NotificationChannel> channels = notificationChannelRepository.findAll();

        for (AlertRule rule : activeRules) {
            try {
                if ("all".equalsIgnoreCase(rule.getClusterName())) {
                    evaluateRuleForAllClusters(rule, channels);
                } else {
                    evaluateRule(rule, rule.getClusterName(), channels);
                }
            } catch (Exception e) {
                log.error("AlertEvaluator: could not evaluate rule {}: {}", rule.getId(), e.getMessage());
            }
        }
    }

    private void evaluateRuleForAllClusters(AlertRule rule, List<NotificationChannel> channels) {
        for (var env : k8sEnvironmentRepository.findAll()) {
            if (!"active".equalsIgnoreCase(env.getStatus())) continue;
            try {
                KubernetesClient client = k8sClientManager.getClient(env.getId());
                var clusters = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inAnyNamespace().list().getItems();
                for (var cluster : clusters) {
                    String clusterName = cluster.getMetadata().getName();
                    evaluateRule(rule, clusterName, channels);
                }
            } catch (Exception e) {
                log.error("AlertEvaluator: could not fetch cluster list for 'all' rule (env={}): {}", env.getName(), e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rule evaluation
    // ─────────────────────────────────────────────────────────────────────────

    private void evaluateRule(AlertRule rule, String clusterName, List<NotificationChannel> channels) {
        log.info("AlertEvaluator: evaluating rule={}... metric={} cluster={}", 
                rule.getId(), rule.getMetricType(), clusterName);

        Double currentValue = getMetricValue(rule.getMetricType(), clusterName);

        if (currentValue == null) {
            log.warn("AlertEvaluator: could not fetch metric for rule {} ({}) | cluster={}",
                    rule.getId(), rule.getMetricType(), clusterName);
            return;
        }

        boolean breached = evaluateThreshold(currentValue, rule.getComparison(), rule.getThreshold());
        String severity = currentValue > rule.getThreshold() * 1.5 ? "CRITICAL" : "WARNING";

        // Look for an existing OPEN alert for this rule+cluster
        Optional<ActiveAlert> existingOpen = activeAlertRepository
                .findByRuleIdAndClusterNameAndStatus(rule.getId(), clusterName, "OPEN");

        if (breached) {
            if (existingOpen.isPresent()) {
                // Alert already OPEN — update current value, send notification if not yet sent
                ActiveAlert alert = existingOpen.get();
                alert.setCurrentValue(currentValue);
                alert.setSeverity(severity);
                alert.setLastEvaluatedAt(LocalDateTime.now());
                if (!alert.isOpenNotified()) {
                    AlertRule specificRule = cloneRuleWithCluster(rule, clusterName);
                    sendNotifications(specificRule, currentValue, channels, "OPEN", severity);
                    alert.setOpenNotified(true);
                }
                activeAlertRepository.save(alert);
                log.warn("AlertEvaluator: ⚠ ALARM OPEN (existing) | rule={} cluster={} current={}",
                        rule.getId(), clusterName, currentValue);
            } else {
                // New breach — create OPEN alert and send notification
                ActiveAlert alert = new ActiveAlert();
                alert.setRuleId(rule.getId());
                alert.setTenantId(rule.getTenantId());
                alert.setClusterName(clusterName);
                alert.setMetricType(rule.getMetricType());
                alert.setComparison(rule.getComparison());
                alert.setThreshold(rule.getThreshold());
                alert.setCurrentValue(currentValue);
                alert.setStatus("OPEN");
                alert.setSeverity(severity);
                alert.setOpenedAt(LocalDateTime.now());
                alert.setLastEvaluatedAt(LocalDateTime.now());
                alert.setOpenNotified(true);
                activeAlertRepository.save(alert);

                AlertRule specificRule = cloneRuleWithCluster(rule, clusterName);
                sendNotifications(specificRule, currentValue, channels, "OPEN", severity);
                log.warn("AlertEvaluator: ⚠ ALARM OPENED! rule={} | {}[{}] {} {} | current={}",
                        rule.getId(), rule.getMetricType(), clusterName,
                        rule.getComparison(), rule.getThreshold(), currentValue);
            }
        } else {
            // Threshold no longer breached
            if (existingOpen.isPresent()) {
                // Close the alert and send CLOSED notification
                ActiveAlert alert = existingOpen.get();
                alert.setStatus("CLOSED");
                alert.setClosedAt(LocalDateTime.now());
                alert.setCurrentValue(currentValue);
                alert.setLastEvaluatedAt(LocalDateTime.now());
                alert.setCloseNotified(true);
                activeAlertRepository.save(alert);

                AlertRule specificRule = cloneRuleWithCluster(rule, clusterName);
                sendNotifications(specificRule, currentValue, channels, "CLOSED", null);
                log.info("AlertEvaluator: ✅ ALARM CLOSED | rule={} cluster={} current={}",
                        rule.getId(), clusterName, currentValue);
            } else {
                log.debug("AlertEvaluator: rule={} OK | cluster={} {}={} (threshold {} {})",
                        rule.getId(), clusterName, rule.getMetricType(), currentValue,
                        rule.getComparison(), rule.getThreshold());
            }
        }
    }

    private AlertRule cloneRuleWithCluster(AlertRule original, String clusterName) {
        AlertRule clone = new AlertRule();
        clone.setId(original.getId());
        clone.setMetricType(original.getMetricType());
        clone.setClusterName(clusterName);
        clone.setComparison(original.getComparison());
        clone.setThreshold(original.getThreshold());
        clone.setDurationMinutes(original.getDurationMinutes());
        clone.setTenantId(original.getTenantId());
        return clone;
    }

    private boolean evaluateThreshold(double current, String comparison, Double threshold) {
        if (threshold == null)
            return false;
        return switch (comparison) {
            case ">" -> current > threshold;
            case ">=" -> current >= threshold;
            case "<" -> current < threshold;
            case "<=" -> current <= threshold;
            case "==" -> Double.compare(current, threshold) == 0;
            default -> false;
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Metric collection — Metrics Server NOT USED, direct to pod via kubectl exec
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Desteklenen metrik tipleri:
     * SQL (psql):
     * CONNECTION_COUNT, ACTIVE_CONNECTIONS, IDLE_CONNECTIONS,
     * DISK_USAGE_MB, DISK_USAGE_PERCENT,
     * REPLICATION_LAG_SECONDS, CACHE_HIT_RATIO,
     * DEADLOCKS, TRANSACTION_RATE, TMP_FILE_SIZE_MB
     * Sistem (/proc):
     * CPU_LOAD_1M (1-minute load average)
     * MEMORY_USAGE_PERCENT
     * WAL_SIZE_MB (du ile WAL dizini)
     */
    private Double getMetricValue(String metricType, String clusterName) {
        if (metricType == null)
            return null;
        try {
            return switch (metricType.toUpperCase()) {

                // ── Connection Metrics ───────────────────────────────────────
                case "CONNECTION_COUNT" -> queryPsql(clusterName,
                        "SELECT count(*)::float FROM pg_stat_activity WHERE state IS NOT NULL",
                        "connection_count");

                case "ACTIVE_CONNECTIONS" -> queryPsql(clusterName,
                        "SELECT count(*)::float FROM pg_stat_activity WHERE state='active'",
                        "active_connections");

                case "IDLE_CONNECTIONS" -> queryPsql(clusterName,
                        "SELECT count(*)::float FROM pg_stat_activity WHERE state='idle'",
                        "idle_connections");

                // ── Disk metrikleri ───────────────────────────────────────────
                case "DISK_USAGE_MB" -> queryPsql(clusterName,
                        "SELECT round(pg_database_size(current_database()) / 1024.0 / 1024.0, 2)::float",
                        "disk_usage_mb");

                case "DISK_USAGE_PERCENT" -> queryPsql(clusterName,
                        "SELECT round(100.0 * pg_database_size(current_database()) " +
                                "/ NULLIF(pg_tablespace_size('pg_default'), 0), 2)::float",
                        "disk_usage_percent");

                // ── Replikasyon metrikleri ────────────────────────────────────
                // Should be run on replica pod; returns 0 on primary
                case "REPLICATION_LAG_SECONDS" -> queryPsql(clusterName,
                        "SELECT COALESCE(" +
                                "  EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::float," +
                                "  0)",
                        "replication_lag_seconds");

                // ── Performans metrikleri ─────────────────────────────────────
                case "CACHE_HIT_RATIO" -> queryPsql(clusterName,
                        "SELECT COALESCE(" +
                                "  round(100.0 * sum(blks_hit) " +
                                "        / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)::float," +
                                "  100.0) " +
                                "FROM pg_stat_database",
                        "cache_hit_ratio");

                case "DEADLOCKS" -> queryPsql(clusterName,
                        "SELECT COALESCE(sum(deadlocks)::float, 0) FROM pg_stat_database",
                        "deadlocks");

                case "TRANSACTION_RATE" -> queryPsql(clusterName,
                        "SELECT COALESCE(sum(xact_commit + xact_rollback)::float, 0) " +
                                "FROM pg_stat_database",
                        "transaction_rate");

                case "TMP_FILE_SIZE_MB" -> queryPsql(clusterName,
                        "SELECT COALESCE(sum(temp_bytes) / 1024.0 / 1024.0, 0)::float " +
                                "FROM pg_stat_database",
                        "tmp_file_size_mb");

                // ── Sistem metrikleri (Önce Metrics Server / top() API denenir) ────────────
                case "CPU_LOAD_1M", "CPU_USAGE" -> queryCpuUsageFromMetrics(clusterName);
                case "MEMORY_USAGE_PERCENT", "MEMORY_USAGE" -> queryMemoryUsageFromMetrics(clusterName);
                case "WAL_SIZE_MB", "WAL_SIZE" -> queryWalSize(clusterName);

                // ── Aliases (For Frontend Compatibility) ────────────────────────
                case "DISK_USAGE" -> queryPsql(clusterName,
                        "SELECT round(100.0 * pg_database_size(current_database()) " +
                                "/ NULLIF(pg_tablespace_size('pg_default'), 0), 2)::float",
                        "disk_usage_percent");

                case "REPLICATION_LAG" -> queryPsql(clusterName,
                        "SELECT COALESCE(max(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)), 0)::float " +
                                "FROM pg_stat_replication",
                        "replication_lag_bytes");

                default -> {
                    log.warn("AlertEvaluator: unknown metric type: {}", metricType);
                    yield null;
                }
            };
        } catch (Exception e) {
            log.error("AlertEvaluator: getMetricValue failed [{}/{}]: {}",
                    metricType, clusterName, e.getMessage());
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // kubectl exec helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Scans all Kubernetes environments, finds the PRIMARY pod belonging to the given clusterName
     * and runs the psql query within it. Returns a single-line double result.
     */
    private Double queryPsql(String clusterName, String sql, String metricLabel) {
        String result = execInPrimaryPod(clusterName,
                "psql -U postgres -tAq -c \"" + sql + "\"");

        if (result == null || result.isBlank()) {
            log.info("AlertEvaluator: psql result empty [{}/{}]", metricLabel, clusterName);
            return null;
        }

        try {
            double value = Double.parseDouble(result.trim());
            log.info("AlertEvaluator: [{}] cluster={} → {}", metricLabel, clusterName, value);
            return value;
        } catch (NumberFormatException e) {
            log.warn("AlertEvaluator: could not parse psql result [{}/{}]: '{}'",
                    metricLabel, clusterName, result.trim());
            return null;
        }
    }

    /**
     * CPU load average — /proc/loadavg (1-minute).
     * Metrics Server not required; available in every Linux container.
     */
    private Double queryCpuLoad(String clusterName) {
        String result = execInPrimaryPod(clusterName, "cat /proc/loadavg");
        if (result == null || result.isBlank())
            return null;

        try {
            // Format: "0.45 0.52 0.48 1/123 456" → first field = 1-minute load
            String[] parts = result.trim().split("\\s+");
            double load = Double.parseDouble(parts[0]);
            log.info("AlertEvaluator: [cpu_load_1m] cluster={} → {} (1-minute load average)", clusterName, load);
            return load;
        } catch (Exception e) {
            log.warn("AlertEvaluator: /proc/loadavg parse error [{}]: '{}'", clusterName, result.trim());
            return null;
        }
    }

    /**
     * Memory usage percentage — /proc/meminfo.
     * Metrics Server gerekmez.
     */
    private Double queryMemoryUsage(String clusterName) {
        String result = execInPrimaryPod(clusterName, "cat /proc/meminfo");
        if (result == null || result.isBlank())
            return null;

        long totalKb = 0, availableKb = 0;
        for (String line : result.split("\n")) {
            if (line.startsWith("MemTotal:")) {
                totalKb = parseProcMemLine(line);
            } else if (line.startsWith("MemAvailable:")) {
                availableKb = parseProcMemLine(line);
            }
        }

        if (totalKb <= 0) {
            log.warn("AlertEvaluator: /proc/meminfo MemTotal could not be read [{}]", clusterName);
            return null;
        }

        double usedPercent = Math.round(100.0 * (totalKb - availableKb) / totalKb * 100.0) / 100.0;
        log.info("AlertEvaluator: [memory_usage_percent] cluster={} → {}% (total={}KB, available={}KB)",
                clusterName, usedPercent, totalKb, availableKb);
        return usedPercent;
    }

    private long parseProcMemLine(String line) {
        // "MemTotal: 16384000 kB" → 16384000
        try {
            return Long.parseLong(line.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Double queryCpuUsageFromMetrics(String clusterName) {
        try {
            Pod primary = getPrimaryPodObject(clusterName);
            if (primary != null) {
                UUID envId = getContextEnvId(clusterName);
                KubernetesClient client = k8sClientManager.getClient(envId);
                
                var metricsList = client.top().pods().inNamespace(primary.getMetadata().getNamespace())
                        .withName(primary.getMetadata().getName()).metrics();
                
                if (metricsList != null && !metricsList.getItems().isEmpty()) {
                    var podMetrics = metricsList.getItems().get(0);
                    if (podMetrics.getContainers() != null && !podMetrics.getContainers().isEmpty()) {
                        String cpuAmount = podMetrics.getContainers().get(0).getUsage().get("cpu").getAmount();
                        double cores = parseCpuQuantity(cpuAmount);
                        log.info("AlertEvaluator: [CPU_USAGE] cluster={} via MetricsAPI → {} cores", clusterName, cores);
                        return cores;
                    }
                }
            }
        } catch (Exception e) {
            log.debug("AlertEvaluator: Metrics API failed for CPU [{}], using /proc fallback: {}", clusterName, e.getMessage());
        }
        return queryCpuLoad(clusterName);
    }

    private Double queryMemoryUsageFromMetrics(String clusterName) {
        try {
            Pod primary = getPrimaryPodObject(clusterName);
            if (primary != null) {
                UUID envId = getContextEnvId(clusterName);
                KubernetesClient client = k8sClientManager.getClient(envId);
                
                var metricsList = client.top().pods().inNamespace(primary.getMetadata().getNamespace())
                        .withName(primary.getMetadata().getName()).metrics();
                
                if (metricsList != null && !metricsList.getItems().isEmpty()) {
                    var podMetrics = metricsList.getItems().get(0);
                    if (podMetrics.getContainers() != null && !podMetrics.getContainers().isEmpty()) {
                        String memAmount = podMetrics.getContainers().get(0).getUsage().get("memory").getAmount();
                        double usedBytes = parseMemoryQuantity(memAmount);
                        
                        // To get percentage, we still need MemTotal from /proc or pod limits. 
                        // Let's use /proc to get total and Metrics API for used for better accuracy.
                        Double total = getMemTotalFromProc(clusterName);
                        if (total != null && total > 0) {
                            double usedPercent = Math.round(usedBytes / (total * 1024.0) * 100.0 * 100.0) / 100.0;
                            log.info("AlertEvaluator: [MEMORY_USAGE] cluster={} via MetricsAPI → {}% (Used: {} bytes, Total: {} KB)", 
                                    clusterName, usedPercent, usedBytes, total);
                            return usedPercent;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("AlertEvaluator: Metrics API failed for Memory [{}], using /proc fallback: {}", clusterName, e.getMessage());
        }
        return queryMemoryUsage(clusterName);
    }

    private double parseCpuQuantity(String amount) {
        if (amount == null || amount.isBlank()) return 0;
        try {
            if (amount.endsWith("n")) return Double.parseDouble(amount.replace("n", "")) / 1_000_000_000.0;
            if (amount.endsWith("u")) return Double.parseDouble(amount.replace("u", "")) / 1_000_000.0;
            if (amount.endsWith("m")) return Double.parseDouble(amount.replace("m", "")) / 1_000.0;
            return Double.parseDouble(amount);
        } catch (Exception e) { return 0; }
    }

    private double parseMemoryQuantity(String amount) {
        if (amount == null || amount.isBlank()) return 0;
        try {
            String numeric = amount.replaceAll("[^0-9.]", "");
            double val = Double.parseDouble(numeric);
            String unit = amount.replaceAll("[0-9.]", "").toUpperCase();
            return switch (unit) {
                case "KI" -> val * 1024;
                case "MI" -> val * 1024 * 1024;
                case "GI" -> val * 1024 * 1024 * 1024;
                case "TI" -> val * 1024L * 1024 * 1024 * 1024;
                default -> val;
            };
        } catch (Exception e) { return 0; }
    }

    private Double getMemTotalFromProc(String clusterName) {
        String result = execInPrimaryPod(clusterName, "grep MemTotal /proc/meminfo");
        if (result != null && result.contains("MemTotal:")) {
            return (double) parseProcMemLine(result);
        }
        return null;
    }

    private Pod getPrimaryPodObject(String clusterName) {
        for (var env : k8sEnvironmentRepository.findAll()) {
            if (!"active".equalsIgnoreCase(env.getStatus())) continue;
            try {
                KubernetesClient client = k8sClientManager.getClient(env.getId());
                List<Pod> pods = client.pods().inAnyNamespace().withLabel("cnpg.io/cluster", clusterName)
                        .withLabel("cnpg.io/instanceRole", "primary").list().getItems();
                if (!pods.isEmpty()) return pods.get(0);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private UUID getContextEnvId(String clusterName) {
        for (var env : k8sEnvironmentRepository.findAll()) {
            if (!"active".equalsIgnoreCase(env.getStatus())) continue;
            try {
                KubernetesClient client = k8sClientManager.getClient(env.getId());
                boolean exists = !client.pods().inAnyNamespace().withLabel("cnpg.io/cluster", clusterName).list().getItems().isEmpty();
                if (exists) return env.getId();
            } catch (Exception ignored) {}
        }
        return null;
    }

    /**
     * WAL dizini toplam boyutu (MB) — du komutu ile.
     * Metrics Server not required; standard path used in CNPG pods.
     */
    private Double queryWalSize(String clusterName) {
        // Tries standard CNPG WAL paths (Alpine or Debian based images)
        String cmd = "du -sb /var/lib/postgresql/data/pgdata/pg_wal 2>/dev/null " +
                "|| du -sb /var/lib/postgresql/pgdata/pg_wal 2>/dev/null " +
                "|| du -sb /pgdata/pg_wal 2>/dev/null";

        String result = execInPrimaryPod(clusterName, cmd);
        if (result == null || result.isBlank()) {
            log.debug("AlertEvaluator: WAL directory not found [{}]", clusterName);
            return null;
        }

        try {
            // "1048576\t/path" → 1048576 bytes
            long bytes = Long.parseLong(result.trim().split("\\s+")[0]);
            double mb = Math.round(bytes / 1024.0 / 1024.0 * 100.0) / 100.0;
            log.info("AlertEvaluator: [wal_size_mb] cluster={} → {} MB", clusterName, mb);
            return mb;
        } catch (Exception e) {
            log.warn("AlertEvaluator: WAL size parse error [{}]: '{}'", clusterName, result.trim());
            return null;
        }
    }

    /**
     * Finds the PRIMARY pod and executes the command.
     * Scans all K8s environments — clusterName is assumed to be unique.
     * cnpg.io/instanceRole=primary label is automatically assigned by CNPG.
     */
    private String execInPrimaryPod(String clusterName, String command) {
        for (var env : k8sEnvironmentRepository.findAll()) {
            if (!"active".equalsIgnoreCase(env.getStatus()))
                continue;
            try {
                KubernetesClient client = k8sClientManager.getClient(env.getId());

                // Primary pod: cnpg.io/cluster=<name> + cnpg.io/instanceRole=primary
                List<Pod> primaryPods = client.pods()
                        .inAnyNamespace()
                        .withLabel("cnpg.io/cluster", clusterName)
                        .withLabel("cnpg.io/instanceRole", "primary")
                        .list()
                        .getItems();

                if (primaryPods.isEmpty()) {
                    log.info("AlertEvaluator: env={} → primary pod not found for cluster '{}'",
                            env.getName(), clusterName);
                    continue;
                }

                Pod pod = primaryPods.get(0);
                String namespace = pod.getMetadata().getNamespace();
                String podName = pod.getMetadata().getName();

                log.debug("AlertEvaluator: exec → pod={}/{} cmd='{}'", namespace, podName, command);

                ByteArrayOutputStream stdout = new ByteArrayOutputStream();
                ByteArrayOutputStream stderr = new ByteArrayOutputStream();

                try (ExecWatch watch = client.pods()
                        .inNamespace(namespace)
                        .withName(podName)
                        .writingOutput(stdout)
                        .writingError(stderr)
                        .exec("sh", "-c", command)) {

                    // Wait until output stabilizes (max 4 sec)
                    int stableCount = 0;
                    int lastSize = -1;
                    for (int i = 0; i < 40; i++) {
                        Thread.sleep(100);
                        int size = stdout.size() + stderr.size();
                        if (size > 0 && size == lastSize) {
                            if (++stableCount >= 3)
                                break; // 300ms stable → finished
                        } else {
                            stableCount = 0;
                        }
                        lastSize = size;
                    }
                }

                String out = stdout.toString().trim();
                String err = stderr.toString().trim();

                if (!err.isEmpty()) {
                    log.debug("AlertEvaluator: exec stderr [{}]: {}", podName, err);
                }

                return out.isEmpty() ? null : out;

            } catch (Exception e) {
                log.debug("AlertEvaluator: env={} exec error: {}", env.getName(), e.getMessage());
            }
        }

        log.debug("AlertEvaluator: cluster '{}' not found in any environment", clusterName);
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sending notifications
    // ─────────────────────────────────────────────────────────────────────────

    private void sendNotifications(AlertRule rule, double currentValue, List<NotificationChannel> channels,
                                   String alertStatus, String severity) {
        log.info("AlertEvaluator: dispatching notifications for rule={} status={} (total channels={})", 
                rule.getId(), alertStatus, channels.size());
        
        String statusEmoji = "OPEN".equals(alertStatus) ? "⚠" : "✅";
        String subject = String.format("[POYRAZ-CNPG %s] %s %s — %s %s %.2f → current: %.2f",
                statusEmoji, alertStatus, rule.getMetricType(),
                rule.getMetricType(), rule.getComparison(), rule.getThreshold(), currentValue);
        String body = buildAlertEmailBody(rule, currentValue, alertStatus, severity);

        for (NotificationChannel ch : channels) {
            if (!ch.isEnabled()) {
                log.debug("AlertEvaluator: skipping disabled channel id={}", ch.getId());
                continue;
            }
            
            if (rule.getTenantId() != null && ch.getTenantId() != null
                    && !rule.getTenantId().equals(ch.getTenantId())) {
                log.debug("AlertEvaluator: skipping channel id={} (tenant mismatch: rule={} ch={})", 
                        ch.getId(), rule.getTenantId(), ch.getTenantId());
                continue;
            }

            log.info("AlertEvaluator: sending to channel id={} type={}", ch.getId(), ch.getChannelType());
            try {
                if ("EMAIL".equalsIgnoreCase(ch.getChannelType())) {
                    sendEmailNotification(ch, subject, body);
                } else if ("WEBHOOK".equalsIgnoreCase(ch.getChannelType())) {
                    sendWebhookNotification(ch, rule, currentValue, alertStatus, severity);
                } else {
                    log.warn("AlertEvaluator: unsupported channel type: {}", ch.getChannelType());
                }
            } catch (Exception e) {
                log.error("AlertEvaluator: could not send notification [channel={} type={}]: {}",
                        ch.getId(), ch.getChannelType(), e.getMessage(), e);
            }
        }
    }

    /**
     * EMAIL channel — uses the central EmailService.
     * targetConfig: {"toAddresses": "admin@domain.com, dba@domain.com"}
     */
    private void sendEmailNotification(NotificationChannel ch, String subject, String body) throws Exception {
        Map<String, Object> config = objectMapper.readValue(ch.getTargetConfig(), 
            new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        String toAddresses = (String) config.get("toAddresses");
        if (toAddresses == null || toAddresses.isBlank()) {
            log.warn("AlertEvaluator: EMAIL channel {} empty toAddresses, skipping.", ch.getId());
            return;
        }
        for (String addr : toAddresses.split(",")) {
            String to = addr.trim();
            if (!to.isEmpty()) {
                emailService.sendEmail(to, subject, body);
                log.info("AlertEvaluator: alarm email sent → {}", to);
            }
        }
    }

    public void sendTestNotification(NotificationChannel ch) {
        try {
            log.info("AlertEvaluator: sending test notification to channel: {}", ch.getId());
            AlertRule sampleRule = new AlertRule();
            sampleRule.setMetricType("TEST_ALERT");
            sampleRule.setClusterName("sample-cluster");
            sampleRule.setComparison(">");
            sampleRule.setThreshold(90.0);
            sampleRule.setTenantId(ch.getTenantId());
            
            if ("WEBHOOK".equalsIgnoreCase(ch.getChannelType())) {
                sendWebhookNotification(ch, sampleRule, 95.5, "OPEN", "WARNING");
            } else if ("EMAIL".equalsIgnoreCase(ch.getChannelType())) {
                String subject = "TEST Alarm — Poyraz-CNPG Notification Test";
                String body = buildAlertEmailBody(sampleRule, 95.5, "OPEN", "WARNING");
                sendEmailNotification(ch, subject, body);
            }
        } catch (Exception e) {
            log.error("AlertEvaluator: test notification failed: {}", e.getMessage(), e);
            throw new RuntimeException("Test notification failed: " + e.getMessage());
        }
    }

    private void sendWebhookNotification(NotificationChannel ch, AlertRule rule, double currentValue,
                                         String alertStatus, String severity) {
        try {
            Map<String, Object> config = objectMapper.readValue(ch.getTargetConfig(), 
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            String url = (String) config.get("url");
            if (url == null || url.isBlank()) {
                log.warn("AlertEvaluator: Webhook channel {} has no URL configured", ch.getId());
                return;
            }

            String method = config.get("method") != null ? config.get("method").toString() : "POST";
            String headersJson = (String) config.get("headers");

            String tenantName = "Unknown";
            if (rule.getTenantId() != null) {
                tenantName = tenantRepository.findById(rule.getTenantId())
                    .map(t -> t.getName()).orElse("Unknown");
            }

            Map<String, Object> payload = new HashMap<>();
            payload.put("alert", rule.getMetricType());
            payload.put("tenantId", rule.getTenantId());
            payload.put("tenantName", tenantName);
            payload.put("cluster", rule.getClusterName() != null ? rule.getClusterName() : "all");
            payload.put("threshold", rule.getThreshold());
            payload.put("currentValue", currentValue);
            payload.put("comparison", rule.getComparison());
            payload.put("timestamp", LocalDateTime.now().toString());
            payload.put("status", alertStatus);
            payload.put("severity", severity != null ? severity : "INFO");

            java.net.http.HttpClient http = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(10))
                    .build();
                    
            java.net.http.HttpRequest.Builder reqBuilder = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .header("Content-Type", "application/json");

            // Apply custom headers if present
            if (headersJson != null && !headersJson.isBlank()) {
                try {
                    Map<String, String> customHeaders = objectMapper.readValue(headersJson, 
                            new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {});
                    customHeaders.forEach(reqBuilder::header);
                } catch (Exception e) {
                    log.warn("AlertEvaluator: failed to parse webhook custom headers [channel={}]: {}", ch.getId(), e.getMessage());
                }
            }

            String jsonPayload = objectMapper.writeValueAsString(payload);
            
            if ("PUT".equalsIgnoreCase(method)) {
                reqBuilder.PUT(java.net.http.HttpRequest.BodyPublishers.ofString(jsonPayload));
            } else {
                reqBuilder.POST(java.net.http.HttpRequest.BodyPublishers.ofString(jsonPayload));
            }

            java.net.http.HttpResponse<String> response = http.send(reqBuilder.build(), 
                    java.net.http.HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("AlertEvaluator: webhook notification sent → {} [status={} response={}]", 
                        url, alertStatus, response.statusCode());
            } else {
                log.error("AlertEvaluator: webhook returned error [channel={} url={} status={}]: {}", 
                        ch.getId(), url, response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("AlertEvaluator: webhook execution failed [channel={}]: {}", ch.getId(), e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Email body
    // ─────────────────────────────────────────────────────────────────────────

    private String buildAlertEmailBody(AlertRule rule, double currentValue, String alertStatus, String severity) {
        boolean isOpen = "OPEN".equals(alertStatus);
        String borderColor = isOpen ? "#ef4444" : "#22c55e";
        String headerColor = isOpen ? "#ef4444" : "#16a34a";
        String headerIcon = isOpen ? "⚠" : "✅";
        String headerText = isOpen ? "Alarm Triggered — " + (severity != null ? ("🔴".equals(severity) ? "🔴 " : "🟠 ") + severity : "WARNING")
                                   : "Alarm Resolved";
        String valueColor = isOpen ? "#ef4444" : "#16a34a";

        String tenantName = "Unknown";
        if (rule.getTenantId() != null) {
            tenantName = tenantRepository.findById(rule.getTenantId())
                .map(t -> t.getName()).orElse("Unknown");
        }

        return "<html><body style='font-family:Arial,sans-serif;background:#f8fafc;padding:20px'>" +
                "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:12px;" +
                "border:2px solid " + borderColor + ";padding:24px;box-shadow:0 4px 20px rgba(0,0,0,.08)'>" +
                "<h2 style='color:" + headerColor + ";margin:0 0 16px'>" + headerIcon + " " + headerText + "</h2>" +
                "<table style='width:100%;border-collapse:collapse;font-size:14px'>" +
                row("Tenant", tenantName, false) +
                row("Status", alertStatus, true) +
                row("Metric", rule.getMetricType(), false) +
                row("Cluster", rule.getClusterName() != null ? rule.getClusterName() : "All", true) +
                row("Condition", rule.getMetricType() + " " + rule.getComparison() + " " + rule.getThreshold(), false) +
                "<tr><td style='padding:8px;color:#64748b;font-weight:bold'>Current Value</td>" +
                "<td style='padding:8px;color:" + valueColor + ";font-weight:bold'>" + String.format("%.2f", currentValue)
                + "</td></tr>" +
                row("Time", LocalDateTime.now().toString(), true) +
                "</table>" +
                "<p style='margin-top:20px;font-size:11px;color:#94a3b8'>" +
                "This alert was sent automatically by the Poyraz-CNPG platform. " +
                "You can manage alarm rules from the <b>Alerts &amp; Monitoring</b> page.</p>" +
                "</div></body></html>";
    }

    private String row(String label, String value, boolean shaded) {
        String bg = shaded ? "background:#f8fafc;" : "";
        return "<tr style='" + bg + "'>" +
                "<td style='padding:8px;color:#64748b;font-weight:bold'>" + label + "</td>" +
                "<td style='padding:8px'>" + value + "</td></tr>";
    }
}
