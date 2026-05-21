package com.cnpg.gui.service;

import com.cnpg.gui.kubernetes.K8sClientManager;
import io.fabric8.kubernetes.api.model.Event;
import io.fabric8.kubernetes.client.KubernetesClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final K8sClientManager k8sClientManager;
    private final ClusterService clusterService;

    public Map<String, Object> getMetrics(UUID environmentId, String namespace) {
        log.info("Fetching dashboard metrics for environment: {}", environmentId);
        KubernetesClient client = k8sClientManager.getClient(environmentId);
        
        List<Map<String, Object>> clusters = clusterService.listClusters(environmentId, null, namespace);
        
        int totalClusters = clusters.size();
        int totalReplicas = 0;
        double totalStorageGi = 0.0;
        
        Map<String, Long> distribution = new HashMap<>();
        
        for (Map<String, Object> cluster : clusters) {
            // Count instances
            Map<String, Object> spec = (Map<String, Object>) cluster.get("spec");
            if (spec != null) {
                Object instances = spec.get("instances");
                if (instances instanceof Number) {
                    totalReplicas += ((Number) instances).intValue();
                } else if (instances instanceof String) {
                    totalReplicas += Integer.parseInt((String) instances);
                }

                // Storage calculation
                Map<String, Object> storage = (Map<String, Object>) spec.get("storage");
                if (storage != null && storage.get("size") != null) {
                    String sizeStr = (String) storage.get("size");
                    totalStorageGi += parseStorageSize(sizeStr);
                }
            }
            
            // Distribution by namespace (if multiple namespaces are supported in the future)
            String ns = (String) cluster.get("namespace");
            distribution.put(ns, distribution.getOrDefault(ns, 0L) + 1);
            cluster.put("metadata", cluster.get("metadata")); // Ensure metadata is preserved if already present
        }

        // Fetch Recent Events (CNPG related)
        List<Map<String, String>> recentEvents = client.v1().events().inAnyNamespace().list().getItems().stream()
                .filter(e -> e.getInvolvedObject().getKind().equals("Cluster") || e.getInvolvedObject().getApiVersion().contains("cnpg"))
                .sorted((a, b) -> b.getMetadata().getCreationTimestamp().compareTo(a.getMetadata().getCreationTimestamp()))
                .limit(5)
                .map(e -> {
                    Map<String, String> ev = new HashMap<>();
                    ev.put("message", e.getMessage());
                    ev.put("reason", e.getReason());
                    ev.put("type", e.getType());
                    ev.put("object", e.getInvolvedObject().getName());
                    ev.put("timestamp", e.getMetadata().getCreationTimestamp());
                    return ev;
                })
                .collect(Collectors.toList());

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("totalClusters", totalClusters);
        metrics.put("totalReplicas", totalReplicas);
        metrics.put("totalStorage", String.format("%.1f GB", totalStorageGi));
        metrics.put("distribution", distribution);
        metrics.put("recentEvents", recentEvents);
        metrics.put("isHealthy", totalClusters > 0);
        
        return metrics;
    }

    private double parseStorageSize(String size) {
        try {
            if (size == null || size.isEmpty()) return 0.0;
            String numeric = size.replaceAll("[^0-9.]", "");
            double val = Double.parseDouble(numeric);
            if (size.toUpperCase().contains("TI")) return val * 1024;
            if (size.toUpperCase().contains("GI")) return val;
            if (size.toUpperCase().contains("MI")) return val / 1024;
            return val;
        } catch (Exception e) {
            return 0.0;
        }
    }
}
