package com.cnpg.gui.service;

import com.cnpg.gui.kubernetes.K8sClientManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryService {

    private final ClusterService clusterService;
    private final K8sClientManager k8sClientManager;

    public List<String> listDatabases(UUID environmentId, String namespace, String clusterName) {
        log.info("QueryService.listDatabases: Fetching databases via kubectl exec on cluster: {}", clusterName);
        
        String podName = getPrimaryPodName(environmentId, namespace, clusterName);
        String command = "psql -U postgres -X -t -A -c \"SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres'\"";
        
        String output = clusterService.execCommand(environmentId, namespace, podName, command);
        if (output == null || output.startsWith("Error:")) {
            log.error("Failed to list databases: {}", output);
            return List.of();
        }

        return Arrays.stream(output.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public List<String> listTables(UUID environmentId, String namespace, String clusterName, String database) {
        log.info("QueryService.listTables: Fetching tables via kubectl exec on cluster: {}, db: {}", clusterName, database);
        
        String podName = getPrimaryPodName(environmentId, namespace, clusterName);
        String command = "psql -U postgres -d " + database + " -X -t -A -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\"";
        
        String output = clusterService.execCommand(environmentId, namespace, podName, command);
        if (output == null || output.startsWith("Error:")) {
            log.error("Failed to list tables: {}", output);
            return List.of();
        }

        return Arrays.stream(output.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public List<Map<String, Object>> executeQuery(UUID environmentId, String namespace, String clusterName, String database, String sql) {
        log.info("QueryService.executeQuery: SQL Execution via kubectl exec on cluster: {}, db: {}", clusterName, database);
        
        String podName = getPrimaryPodName(environmentId, namespace, clusterName);
        // Using unaligned pipe separated format with footer off for easy parsing
        String command = "psql -U postgres -d " + database + " -X -A -F '|' -P footer=off -c \"" + sql.replace("\"", "\\\"") + "\"";
        
        String output = clusterService.execCommand(environmentId, namespace, podName, command);
        if (output == null || output.startsWith("Error:")) {
            log.error("SQL Execution failed: {}", output);
            throw new com.cnpg.gui.exception.CnpGuiException("DB_ERR", "SQL Error: " + output, 400);
        }

        List<Map<String, Object>> results = new ArrayList<>();
        String[] lines = output.split("\n");
        if (lines.length > 0) {
            String[] headers = lines[0].split("\\|");
            for (int i = 1; i < lines.length; i++) {
                String[] values = lines[i].split("\\|");
                Map<String, Object> row = new LinkedHashMap<>();
                for (int j = 0; j < headers.length; j++) {
                    String val = j < values.length ? values[j] : null;
                    row.put(headers[j], val);
                }
                results.add(row);
            }
        }
        return results;
    }

    private String getPrimaryPodName(UUID environmentId, String namespace, String clusterName) {
        try {
            io.fabric8.kubernetes.client.KubernetesClient client = k8sClientManager.getClient(environmentId);
            var pods = client.pods().inNamespace(namespace)
                    .withLabel("cnpg.io/cluster", clusterName)
                    .withLabel("cnpg.io/instanceRole", "primary")
                    .list().getItems();
            
            if (pods.isEmpty()) {
                // Fallback to any pod of the cluster if primary label not found
                pods = client.pods().inNamespace(namespace)
                        .withLabel("cnpg.io/cluster", clusterName)
                        .list().getItems();
            }
            
            if (pods.isEmpty()) {
                throw new RuntimeException("No pods found for cluster " + clusterName);
            }
            return pods.get(0).getMetadata().getName();
        } catch (Exception e) {
            log.error("Failed to find pod for cluster {}: {}", clusterName, e.getMessage());
            throw new RuntimeException("Could not find suitable pod for query execution", e);
        }
    }
}
