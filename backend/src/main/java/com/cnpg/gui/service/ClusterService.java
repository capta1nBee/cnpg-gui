package com.cnpg.gui.service;

import com.cnpg.gui.annotation.Audit;
import com.cnpg.gui.exception.CnpGuiException;
import com.cnpg.gui.kubernetes.K8sClientManager;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.api.model.Secret;
import io.fabric8.kubernetes.api.model.SecretBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext;
import io.fabric8.kubernetes.client.dsl.base.PatchContext;
import io.fabric8.kubernetes.client.dsl.base.PatchType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;
import java.util.Base64;

@Slf4j
@Service
public class ClusterService {

    private final K8sClientManager k8sClientManager;
    private final SimpMessagingTemplate messagingTemplate;

    public ClusterService(K8sClientManager k8sClientManager, SimpMessagingTemplate messagingTemplate) {
        this.k8sClientManager = k8sClientManager;
        this.messagingTemplate = messagingTemplate;
    }

    private static final CustomResourceDefinitionContext CNPG_CLUSTER_CONTEXT = new CustomResourceDefinitionContext.Builder()
            .withGroup("postgresql.cnpg.io")
            .withVersion("v1")
            .withPlural("clusters")
            .withScope("Namespaced")
            .build();

    public List<Map<String, Object>> listClusters(UUID environmentId, String kubeconfig, String namespace) {
        log.info("Listing clusters for environment: {}, namespace: {}", environmentId, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            var query = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT);

            List<GenericKubernetesResource> resources;
            if (namespace == null || namespace.isEmpty() || "all".equalsIgnoreCase(namespace)) {
                resources = query.inAnyNamespace().list().getItems();
            } else {
                resources = query.inNamespace(namespace).list().getItems();
            }

            log.info("Successfully fetched {} clusters", resources.size());
            return resources.stream().map(r -> {
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("name", r.getMetadata().getName());
                map.put("namespace", r.getMetadata().getNamespace());
                map.put("creationTimestamp", r.getMetadata().getCreationTimestamp());
                map.put("metadata", r.getMetadata());
                map.putAll(r.getAdditionalProperties());
                return map;
            }).toList();
        } catch (Exception e) {
            log.error("Failed to list clusters for environment {}: {}", environmentId, e.getMessage());
            throw new CnpGuiException("K8S_001", "An error occurred while listing Kubernetes clusters: " + e.getMessage(),
                    500);
        }
    }

    public Map<String, Object> getCluster(UUID environmentId, String namespace, String name) {
        log.info("Fetching cluster {} in namespace {} for environment {}", name, namespace, environmentId);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            GenericKubernetesResource resource = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .withName(name)
                    .get();
            if (resource == null) {
                throw new CnpGuiException("K8S_004", "Cluster not found: " + name, 404);
            }
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("name", resource.getMetadata().getName());
            map.put("namespace", resource.getMetadata().getNamespace());
            map.put("creationTimestamp", resource.getMetadata().getCreationTimestamp());
            map.put("metadata", resource.getMetadata());
            map.putAll(resource.getAdditionalProperties());

            // Fetch real pods for this cluster
            try {
                List<Map<String, Object>> podDetails = client.pods().inNamespace(namespace)
                        .withLabel("cnpg.io/cluster", name)
                        .list().getItems().stream()
                        .map(p -> {
                            Map<String, Object> podMap = new java.util.HashMap<>();
                            podMap.put("name", p.getMetadata().getName());
                            podMap.put("status", p.getStatus().getPhase());
                            podMap.put("ready", p.getStatus().getConditions().stream()
                                    .anyMatch(c -> "Ready".equals(c.getType()) && "True".equals(c.getStatus())));
                            return podMap;
                        })
                        .sorted((a, b) -> ((String) a.get("name")).compareTo((String) b.get("name")))
                        .toList();

                if (!podDetails.isEmpty()) {
                    Map<String, Object> status = (Map<String, Object>) map.getOrDefault("status",
                            new java.util.HashMap<>());
                    status.put("instancesDetails", podDetails);
                    // Also keep instanceNames for compatibility if needed
                    status.put("instanceNames", podDetails.stream().map(pd -> pd.get("name")).toList());
                    map.put("status", status);
                }
            } catch (Exception e) {
                log.warn("Failed to fetch real pods for cluster {}: {}", name, e.getMessage());
            }

            return map;
        } catch (CnpGuiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to fetch cluster {}: {}", name, e.getMessage());
            throw new CnpGuiException("K8S_001", "Error fetching cluster details: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "CLUSTER_CREATE")
    public void createCluster(UUID environmentId, String kubeconfig, String namespace, String base64Yaml) {
        log.info("Starting Base64-Decoded Cluster Deployment. Namespace: {}", namespace);

        String yamlPayload;
        try {
            byte[] decodedBytes = java.util.Base64.getDecoder().decode(base64Yaml.trim());
            yamlPayload = new String(decodedBytes, java.nio.charset.StandardCharsets.UTF_8);
            log.info("Successfully decoded YAML Payload:\n{}", yamlPayload);
        } catch (Exception e) {
            log.error("Failed to decode Base64 YAML: {}", e.getMessage());
            throw new CnpGuiException("K8S_003", "Invalid Base64 format: " + e.getMessage(), 400);
        }

        StringBuilder errorMessages = new StringBuilder();
        boolean hasError = false;

        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            // 1. Simple but effective split
            String[] segments = yamlPayload.split("---");
            log.info("Split decoded manifest into {} segments", segments.length);

            for (int i = 0; i < segments.length; i++) {
                String doc = segments[i].trim();
                if (doc.isEmpty() || doc.length() < 10)
                    continue; // Skip empty or junk segments

                log.info("Applying Resource Piece #{} (Length: {})", i + 1, doc.length());

                try {
                    // 2. Use Generic Resource Unmarshal - The most stable path in Fabric8
                    // This avoids all 'HasMetadata' and 'RawExtension' casting issues
                    io.fabric8.kubernetes.api.model.GenericKubernetesResource resource = client
                            .getKubernetesSerialization()
                            .unmarshal(doc, io.fabric8.kubernetes.api.model.GenericKubernetesResource.class);

                    if (resource != null) {
                        client.resource(resource).inNamespace(namespace).createOrReplace();
                        log.info("Successfully deployed Piece #{} (Kind: {})", i + 1, resource.getKind());
                    }
                } catch (Exception docEx) {
                    hasError = true;
                    log.error("Failed to deploy Piece #{}: {}", i + 1, docEx.getMessage());
                    errorMessages.append("Piece #").append(i + 1).append(": ").append(docEx.getMessage()).append("; ");
                }
            }

            if (hasError) {
                throw new CnpGuiException("K8S_003",
                        "Deployment failed for some components: " + errorMessages.toString(), 400);
            }

            log.info("Bulletproof deployment finished successfully.");
        } catch (CnpGuiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Critical deployment failure: {}", e.getMessage(), e);
            throw new CnpGuiException("K8S_003", "Critical error during cluster creation: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "CLUSTER_DELETE")
    public void deleteCluster(UUID environmentId, String namespace, String name) {
        log.info("Deleting cluster: {} in namespace: {}", name, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace).withName(name).delete();
            log.info("Cluster {} deletion request sent to Kubernetes", name);

            // Cleanup associated resources
            try {
                io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext poolerCtx = new io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext.Builder()
                        .withGroup("postgresql.cnpg.io").withVersion("v1").withPlural("poolers").withScope("Namespaced")
                        .build();
                client.genericKubernetesResources(poolerCtx).inNamespace(namespace).withName(name + "-pooler").delete();
            } catch (Exception e) {
                log.warn("Pooler cleanup failed or not found: {}", e.getMessage());
            }

            try {
                io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext backupCtx = new io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext.Builder()
                        .withGroup("postgresql.cnpg.io").withVersion("v1").withPlural("scheduledbackups")
                        .withScope("Namespaced").build();
                client.genericKubernetesResources(backupCtx).inNamespace(namespace).withName(name + "-scheduled-backup")
                        .delete();
            } catch (Exception e) {
                log.warn("Scheduled backup cleanup failed or not found: {}", e.getMessage());
            }

            try {
                client.secrets().inNamespace(namespace).withName(name + "-s3-creds").delete();
                client.secrets().inNamespace(namespace).withName(name + "-user-auth").delete();
                client.secrets().inNamespace(namespace).withLabel("cnpg.io/cluster", name).delete();
                // Also clean ExternalSecrets if any exist with that label
                io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext esCtx = new io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext.Builder()
                        .withGroup("external-secrets.io").withVersion("v1beta1").withPlural("externalsecrets")
                        .withScope("Namespaced").build();
                client.genericKubernetesResources(esCtx).inNamespace(namespace).withLabel("cnpg.io/cluster", name)
                        .delete();
            } catch (Exception e) {
                log.warn("Secrets cleanup failed: {}", e.getMessage());
            }

        } catch (Exception e) {
            log.error("Failed to delete cluster {}: {}", name, e.getMessage());
            throw new CnpGuiException("K8S_002", "Failed to delete cluster: " + name, 500);
        }
    }

    @Audit(action = "CLUSTER_SCALE")
    @SuppressWarnings("unchecked")
    public void scaleCluster(UUID environmentId, String namespace, String name, int instances) {
        log.info("Scaling cluster {} to {} instances in namespace {}", name, instances, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            GenericKubernetesResource resource = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace).withName(name).get();
            if (resource != null) {
                Map<String, Object> spec = (Map<String, Object>) resource.getAdditionalProperties().get("spec");
                if (spec != null) {
                    spec.put("instances", instances);
                    client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace).resource(resource)
                            .update();
                    log.info("Successfully patched instances to {} for cluster {}", instances, name);

                    // WebSocket Broadcast
                    messagingTemplate.convertAndSend("/topic/cluster-status/" + name,
                            (Object) Map.of("action", "SCALE", "instances", instances, "status", "PATCHED"));
                }
            } else {
                log.warn("Cluster {} not found for scaling in namespace {}", name, namespace);
            }
        } catch (Exception e) {
            log.error("Scaling failed for cluster {}: {}", name, e.getMessage());
            throw e;
        }
    }

    @Audit(action = "CLUSTER_UPGRADE")
    @SuppressWarnings("unchecked")
    public void upgradeCluster(UUID environmentId, String namespace, String name, String pgVersion) {
        log.info("Upgrading cluster {} to PG version {} in namespace {}", name, pgVersion, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            var resource = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace).withName(name)
                    .get();
            if (resource != null) {
                Map<String, Object> spec = (Map<String, Object>) resource.getAdditionalProperties().get("spec");
                if (spec != null) {
                    spec.put("imageName", "ghcr.io/cloudnative-pg/postgresql:" + pgVersion);
                    client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace).resource(resource)
                            .update();
                    log.info("Successfully patched imageName to version {} for cluster {}", pgVersion, name);
                }
            }
        } catch (Exception e) {
            log.error("Upgrade failed for cluster {}: {}", name, e.getMessage());
            throw e;
        }
    }

    @Audit(action = "CLUSTER_FAILOVER")
    @SuppressWarnings("unchecked")
    public void failoverCluster(UUID environmentId, String namespace, String name, String targetInstance) {
        log.info("Triggering Switchover for cluster {} in namespace {}. Target: {}", name, namespace, targetInstance);

        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            // 1. Get the Cluster
            GenericKubernetesResource cluster = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .withName(name)
                    .get();

            if (cluster == null) {
                throw new CnpGuiException("K8S_004", "Cluster not found: " + name, 404);
            }

            // 2. Find the current primary
            Map<String, Object> status = (Map<String, Object>) cluster.getAdditionalProperties().get("status");

            String currentPrimary = status != null
                    ? (String) status.get("currentPrimary")
                    : null;

            log.info("Current primary instance: {}", currentPrimary);

            // 3. Normalize the target pod name
            String expectedPodName = targetInstance;

            if (!targetInstance.startsWith(name)) {
                expectedPodName = targetInstance.contains("-")
                        ? targetInstance
                        : name + "-" + targetInstance;
            }

            // 4. Check if the pod actually exists
            var targetPod = client.pods()
                    .inNamespace(namespace)
                    .withName(expectedPodName)
                    .get();

            if (targetPod == null) {
                throw new CnpGuiException(
                        "K8S_007",
                        "Target instance " + targetInstance +
                                " does not exist. Expected pod name: " + expectedPodName,
                        400);
            }

            ObjectMapper mapper = new ObjectMapper();

            Map<String, Object> patch = Map.of(
                    "metadata", Map.of(
                            "annotations", Map.of(
                                    "cnpg.io/primaryUpdateStrategy", "switchover",
                                    "cnpg.io/switchover", expectedPodName)));

            // Map → JSON string
            String patchJson = mapper.writeValueAsString(patch);

            client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .withName(name)
                    .patch(PatchContext.of(PatchType.JSON_MERGE), patchJson);

            log.info("Switchover annotation applied for target: {}", expectedPodName);

            // 6. Notification
            messagingTemplate.convertAndSend(
                    "/topic/cluster-status/" + name,
                    Map.of(
                            "action", "FAILOVER",
                            "target", targetInstance,
                            "oldPrimary", currentPrimary != null ? currentPrimary : "unknown",
                            "status", "TRIGGERED"));

        } catch (CnpGuiException e) {
            throw e;

        } catch (Exception e) {
            log.error("Switchover failed for cluster {}: {}", name, e.getMessage(), e);

            throw new CnpGuiException(
                    "K8S_007",
                    "Failover operation failed: " + e.getMessage(),
                    500);
        }
    }

    @Audit(action = "CLUSTER_FORCE_FAILOVER")
    public void forceFailover(UUID environmentId, String namespace, String name) {
        log.info("Triggering FORCE failover for cluster {}", name);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .withName(name)
                    .edit(r -> {
                        Map<String, String> annotations = r.getMetadata().getAnnotations();
                        if (annotations == null)
                            annotations = new java.util.HashMap<>();

                        // Set force failover strategy - this triggers a failover (non-graceful)
                        annotations.put("cnpg.io/primaryUpdateStrategy", "failover");
                        // Add timestamp to force reconciliation
                        annotations.put("cnpg.io/reconciliationLoop", String.valueOf(System.currentTimeMillis()));

                        r.getMetadata().setAnnotations(annotations);
                        return r;
                    });

            log.info("Force failover applied to cluster {}", name);
        } catch (Exception e) {
            log.error("Force failover failed for cluster {}: {}", name, e.getMessage());
            throw new com.cnpg.gui.exception.CnpGuiException("K8S_010",
                    "Forced Failover operation failed: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "CLUSTER_STORAGE_RESIZE")
    @SuppressWarnings("unchecked")
    public void resizeStorage(UUID environmentId, String namespace, String name, String newSize) {
        log.info("Resizing storage for cluster {} to {} in namespace {}", name, newSize, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .withName(name)
                    .edit(r -> {
                        Map<String, Object> spec = (Map<String, Object>) r.getAdditionalProperties().get("spec");
                        if (spec == null) {
                            spec = new java.util.HashMap<>();
                            r.getAdditionalProperties().put("spec", spec);
                        }

                        Map<String, Object> storage = (Map<String, Object>) spec.get("storage");
                        if (storage == null) {
                            storage = new java.util.HashMap<>();
                            spec.put("storage", storage);
                        }

                        Map<String, Object> pvcTemplate = (Map<String, Object>) storage.get("pvcTemplate");
                        if (pvcTemplate == null) {
                            pvcTemplate = new java.util.HashMap<>();
                            storage.put("pvcTemplate", pvcTemplate);
                        }

                        Map<String, Object> resources = (Map<String, Object>) pvcTemplate.get("resources");
                        if (resources == null) {
                            resources = new java.util.HashMap<>();
                            pvcTemplate.put("resources", resources);
                        }

                        Map<String, Object> requests = (Map<String, Object>) resources.get("requests");
                        if (requests == null) {
                            requests = new java.util.HashMap<>();
                            resources.put("requests", requests);
                        }

                        // Set both size and requests
                        storage.put("size", newSize);
                        requests.put("storage", newSize);

                        log.info("Storage config updated: size={}, pvc.resources.requests.storage={}", newSize,
                                newSize);
                        return r;
                    });

            log.info("Storage resize applied to K8s", name);
        } catch (Exception e) {
            log.error("Storage resize failed for cluster {}: {}", name, e.getMessage());
            throw new com.cnpg.gui.exception.CnpGuiException("K8S_011",
                    "Failed to update storage size: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "CLUSTER_RESTORE")
    @SuppressWarnings("unchecked")
    public void restoreCluster(UUID environmentId, String namespace, String newClusterName, String sourceClusterName,
            String targetTime, String targetXID, String targetLSN, String targetName,
            Boolean targetImmediate, String backupID, Boolean exclusive, String method) {
        log.info("Restoring new cluster {} from source {} in namespace {}. Method: {}, Time: {}, LSN: {}",
                newClusterName, sourceClusterName, namespace, method, targetTime, targetLSN);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            // Get source cluster to copy storage/config
            var source = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace)
                    .withName(sourceClusterName).get();
            Map<String, Object> sourceSpec = null;
            if (source != null) {
                sourceSpec = (Map<String, Object>) source.getAdditionalProperties().get("spec");
            }

            Map<String, Object> recoveryBlock = new java.util.HashMap<>();
            recoveryBlock.put("source", sourceClusterName);

            Map<String, Object> targetMap = new java.util.HashMap<>();
            if (targetTime != null && !targetTime.isEmpty())
                targetMap.put("targetTime", targetTime);
            if (targetXID != null && !targetXID.isEmpty())
                targetMap.put("targetXID", targetXID);
            if (targetLSN != null && !targetLSN.isEmpty())
                targetMap.put("targetLSN", targetLSN);
            if (targetName != null && !targetName.isEmpty())
                targetMap.put("targetName", targetName);
            if (targetImmediate != null)
                targetMap.put("targetImmediate", targetImmediate);
            if (backupID != null && !backupID.isEmpty())
                targetMap.put("backupID", backupID);
            if (exclusive != null)
                targetMap.put("exclusive", exclusive);

            if (!targetMap.isEmpty()) {
                recoveryBlock.put("recoveryTarget", targetMap);
            }

            if (method != null && !method.isEmpty()) {
                recoveryBlock.put("method", method);
            }

            Map<String, Object> spec = new java.util.HashMap<>();
            spec.put("instances", sourceSpec != null ? sourceSpec.getOrDefault("instances", 3) : 3);
            spec.put("bootstrap", Map.of("recovery", recoveryBlock));

            if (sourceSpec != null) {
                if (sourceSpec.containsKey("storage"))
                    spec.put("storage", sourceSpec.get("storage"));
                if (sourceSpec.containsKey("imageName"))
                    spec.put("imageName", sourceSpec.get("imageName"));

                // Copy barmanObjectStore to externalClusters to enable recovery from source
                if (sourceSpec.containsKey("backup")) {
                    Map<String, Object> backup = (Map<String, Object>) sourceSpec.get("backup");
                    if (backup != null && backup.containsKey("barmanObjectStore")) {
                        Map<String, Object> extCluster = new java.util.HashMap<>();
                        extCluster.put("name", sourceClusterName);
                        extCluster.put("barmanObjectStore", backup.get("barmanObjectStore"));
                        spec.put("externalClusters", java.util.List.of(extCluster));
                        log.info("Copied barmanObjectStore to externalClusters for recovery");
                    }
                }
            }

            io.fabric8.kubernetes.api.model.GenericKubernetesResource restoredCluster = new io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder()
                    .withApiVersion("postgresql.cnpg.io/v1")
                    .withKind("Cluster")
                    .withNewMetadata()
                    .withName(newClusterName)
                    .withNamespace(namespace)
                    .endMetadata()
                    .addToAdditionalProperties("spec", spec)
                    .build();

            client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .resource(restoredCluster)
                    .create();
            log.info("Restore request for cluster {} successfully sent", newClusterName);
        } catch (io.fabric8.kubernetes.client.KubernetesClientException e) {
            log.error("Kubernetes Restore failed for {}: {}", newClusterName, e.getMessage());
            if (e.getCode() == 409) {
                throw new com.cnpg.gui.exception.CnpGuiException("K8S_409",
                        "A cluster with this name already exists: " + newClusterName, 409);
            }
            throw new com.cnpg.gui.exception.CnpGuiException("K8S_012", "Restore operation failed: " + e.getMessage(),
                    500);
        } catch (Exception e) {
            log.error("Restore failed for {}: {}", newClusterName, e.getMessage());
            throw new com.cnpg.gui.exception.CnpGuiException("K8S_012", "Restore operation failed: " + e.getMessage(),
                    500);
        }
    }

    @Audit(action = "CLUSTER_UPGRADE_MAJOR")
    public void majorUpgradeCluster(UUID environmentId, String namespace, String name, String targetVersion) {
        log.info("Starting major version upgrade for cluster {} to PG {} in namespace {}", name, targetVersion,
                namespace);
        try {
            // Major upgrades in CNPG typically involve a rolling update or specific
            // migration steps.
            // For now, we trigger a standard upgrade which CNPG handles for compatible
            // versions.
            upgradeCluster(environmentId, namespace, name, targetVersion);
            log.info("Major upgrade request for {} initiated", name);
        } catch (Exception e) {
            log.error("Major upgrade failed: {}", e.getMessage());
            throw e;
        }
    }

    @Audit(action = "CLUSTER_SUSPEND")
    public void suspendCluster(UUID environmentId, String namespace, String name, boolean suspend) {
        log.info("{} cluster {} in namespace {}", suspend ? "Suspending" : "Resuming", name, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            GenericKubernetesResource resource = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace).withName(name).get();
            if (resource != null) {
                Map<String, String> annotations = resource.getMetadata().getAnnotations();
                if (annotations == null) {
                    annotations = new java.util.HashMap<>();
                }
                if (suspend) {
                    annotations.put("cnpg.io/hibernation", "on");
                } else {
                    annotations.remove("cnpg.io/hibernation");
                }
                resource.getMetadata().setAnnotations(annotations);
                client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace).resource(resource)
                        .update();
                log.info("Hibernation annotation {} for cluster {}", suspend ? "applied" : "removed", name);
            }
        } catch (Exception e) {
            log.error("Suspend/Resume failed for cluster {}: {}", name, e.getMessage());
            throw e;
        }
    }

    public String getPodLogs(UUID environmentId, String namespace, String podName) {
        log.info("Fetching logs for pod {} in namespace {}", podName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            return client.pods().inNamespace(namespace).withName(podName).tailingLines(100).getLog();
        } catch (Exception e) {
            log.error("Failed to fetch logs for pod {}: {}", podName, e.getMessage());
            return "Error fetching logs: " + e.getMessage();
        }
    }

    public List<Map<String, String>> listClusterUsers(UUID environmentId, String namespace, String clusterName) {
        log.info("Listing users for cluster {} in namespace {}", clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            // In CNPG, application users are often represented by secrets labeled with the
            // cluster name
            java.util.Set<io.fabric8.kubernetes.api.model.Secret> allSecrets = new java.util.HashSet<>();

            // 1. Find by label
            allSecrets.addAll(client.secrets().inNamespace(namespace)
                    .withLabel("cnpg.io/cluster", clusterName)
                    .list().getItems());

            // 2. Find by known names (fallback for old clusters without labels)
            try {
                io.fabric8.kubernetes.api.model.Secret sa = client.secrets().inNamespace(namespace)
                        .withName(clusterName + "-user-auth").get();
                if (sa != null)
                    allSecrets.add(sa);
            } catch (Exception ignored) {
            }

            try {
                io.fabric8.kubernetes.api.model.Secret ss = client.secrets().inNamespace(namespace)
                        .withName(clusterName + "-superuser").get();
                if (ss != null)
                    allSecrets.add(ss);
            } catch (Exception ignored) {
            }

            return allSecrets.stream()
                    .map(s -> {
                        Map<String, String> user = new java.util.HashMap<>();
                        user.put("name", s.getMetadata().getName());
                        user.put("username", s.getMetadata().getName().replace(clusterName + "-", ""));
                        user.put("secretName", s.getMetadata().getName());
                        return user;
                    }).toList();
        } catch (Exception e) {
            log.error("Failed to list users: {}", e.getMessage());
            return List.of();
        }
    }

    @Audit(action = "CLUSTER_USER_CREATE")
    public void createClusterUser(UUID environmentId, String namespace, String clusterName, String username,
            String password) {
        log.info("Creating user {} for cluster {} in namespace {}", username, clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            String secretName = clusterName + "-" + username;

            io.fabric8.kubernetes.api.model.Secret secret = new io.fabric8.kubernetes.api.model.SecretBuilder()
                    .withNewMetadata()
                    .withName(secretName)
                    .withNamespace(namespace)
                    .addToLabels("cnpg.io/cluster", clusterName)
                    .endMetadata()
                    .addToData("username", java.util.Base64.getEncoder().encodeToString(username.getBytes()))
                    .addToData("password", java.util.Base64.getEncoder().encodeToString(password.getBytes()))
                    .build();

            client.secrets().inNamespace(namespace).resource(secret).create();
            log.info("User secret {} created successfully", secretName);
        } catch (Exception e) {
            log.error("Failed to create user: {}", e.getMessage());
            throw new CnpGuiException("K8S_005", "Failed to create user: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "CLUSTER_HBA_UPDATE")
    @SuppressWarnings("unchecked")
    public void updateHbaRules(UUID environmentId, String namespace, String clusterName, List<String> rules) {
        log.info("Updating HBA rules for cluster {} in namespace {}", clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            var resource = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace)
                    .withName(clusterName).get();
            if (resource != null) {
                Map<String, Object> spec = (Map<String, Object>) resource.getAdditionalProperties().get("spec");
                if (spec != null) {
                    Map<String, Object> postgresql = (Map<String, Object>) spec.getOrDefault("postgresql",
                            new java.util.HashMap<>());
                    postgresql.put("pg_hba", rules);
                    spec.put("postgresql", postgresql);
                    client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace).resource(resource)
                            .update();
                    log.info("HBA rules updated for cluster {}", clusterName);
                }
            }
        } catch (Exception e) {
            log.error("Failed to update HBA rules: {}", e.getMessage());
            throw new CnpGuiException("K8S_006", "Failed to update HBA rules: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "CLUSTER_UPDATE_ROLES")
    public void updateManagedRoles(UUID environmentId, String namespace, String clusterName, List<Map<String, Object>> roles) {
        log.info("Updating managed roles for cluster {} in namespace {}", clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            var resource = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace)
                    .withName(clusterName).get();
            if (resource != null) {
                // Handle Secrets for roles that have passwords provided
                for (Map<String, Object> role : roles) {
                    String roleName = (String) role.get("name");
                    String password = (String) role.get("password");
                    if (roleName != null && !roleName.isEmpty() && password != null && !password.isEmpty()) {
                        String secretName = clusterName + "-" + roleName + "-auth";
                        log.info("Creating/Updating secret {} for role {}", secretName, roleName);
                        
                        Secret secret = new SecretBuilder()
                            .withNewMetadata()
                                .withName(secretName)
                                .withNamespace(namespace)
                                .addToLabels("cnpg.io/cluster", clusterName)
                            .endMetadata()
                            .withType("kubernetes.io/basic-auth")
                            .addToData("username", Base64.getEncoder().encodeToString(roleName.getBytes()))
                            .addToData("password", Base64.getEncoder().encodeToString(password.getBytes()))
                            .build();
                        
                        client.secrets().inNamespace(namespace).resource(secret).createOrReplace();
                    }
                }

                Map<String, Object> spec = (Map<String, Object>) resource.getAdditionalProperties().get("spec");
                if (spec != null) {
                    Map<String, Object> managed = (Map<String, Object>) spec.getOrDefault("managed",
                            new java.util.HashMap<>());
                    
                    // Remove password from roles before saving to Cluster spec to keep it clean
                    List<Map<String, Object>> cleanRoles = roles.stream().map(r -> {
                        Map<String, Object> copy = new HashMap<>(r);
                        copy.remove("password");
                        return copy;
                    }).toList();

                    managed.put("roles", cleanRoles);
                    spec.put("managed", managed);
                    client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT).inNamespace(namespace).resource(resource)
                            .update();
                    log.info("Managed roles updated for cluster {}", clusterName);
                }
            }
        } catch (Exception e) {
            log.error("Failed to update managed roles: {}", e.getMessage());
            throw new CnpGuiException("K8S_006", "Failed to update managed roles: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "POD_DELETE")
    public void deletePod(UUID environmentId, String namespace, String podName) {
        log.info("Deleting pod {} in namespace {}", podName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            client.pods().inNamespace(namespace).withName(podName).delete();
        } catch (Exception e) {
            log.error("Failed to delete pod {}: {}", podName, e.getMessage());
            throw new CnpGuiException("K8S_008", "Failed to delete pod: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "INSTANCE_FENCE")
    @SuppressWarnings("unchecked")
    public void fenceInstance(UUID environmentId, String namespace, String clusterName, String instanceName,
            boolean fence) {
        log.info("{} instance {} in cluster {}", fence ? "Fencing" : "Unfencing", instanceName, clusterName);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            var cluster = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .withName(clusterName)
                    .get();

            if (cluster != null) {
                Map<String, Object> spec = (Map<String, Object>) cluster.getAdditionalProperties().get("spec");
                if (spec == null) {
                    spec = new java.util.HashMap<>();
                    cluster.getAdditionalProperties().put("spec", spec);
                }

                List<String> fencedInstances = (List<String>) spec.getOrDefault("fencedInstances",
                        new java.util.ArrayList<String>());
                if (fence) {
                    if (!fencedInstances.contains(instanceName)) {
                        fencedInstances.add(instanceName);
                    }
                } else {
                    fencedInstances.remove(instanceName);
                }
                spec.put("fencedInstances", fencedInstances);

                client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                        .inNamespace(namespace)
                        .resource(cluster)
                        .update();
            }
        } catch (Exception e) {
            log.error("Failed to fence/unfence instance {}: {}", instanceName, e.getMessage());
            throw new CnpGuiException("K8S_009", "Failed to stop/start instance: " + e.getMessage(), 500);
        }
    }

    @Audit(action = "POD_EXEC")
    public String execCommand(UUID environmentId, String namespace, String podName, String command) {
        log.info("Executing command in pod {} in namespace {}: {}", podName, namespace, command);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            java.io.ByteArrayOutputStream error = new java.io.ByteArrayOutputStream();

            io.fabric8.kubernetes.client.dsl.ExecWatch watch = client.pods().inNamespace(namespace).withName(podName)
                    .writingOutput(output)
                    .writingError(error)
                    .exec("sh", "-c", command);

            // Dynamic TTY Wait: Fast execution feel (like WebSocket)
            int lastSize = -1;
            int sameCount = 0;
            for (int i = 0; i < 100; i++) { // Max 10 seconds
                Thread.sleep(100);
                int currentSize = output.size() + error.size();
                if (currentSize > 0 && currentSize == lastSize) {
                    sameCount++;
                    if (sameCount >= 3)
                        break; // Output stabilized for 300ms, exit early
                } else if (currentSize == 0 && i > 5) {
                    sameCount++;
                    if (sameCount >= 3)
                        break; // Command returned no output
                } else {
                    sameCount = 0;
                }
                lastSize = currentSize;
            }

            watch.close();

            String outStr = output.toString();
            String errStr = error.toString();
            return outStr + (errStr.isEmpty() ? "" : "\n" + errStr);
        } catch (Exception e) {
            log.error("Failed to execute command: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    @Audit(action = "CLUSTER_PG_DUMP_TRIGGER")
    public void triggerPgDump(UUID environmentId, String namespace, String podName, String user, String db) {
        log.info("Triggering background pg_dump in pod {}/{} for database {}", namespace, podName, db);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            // Ensure directory exists, set status to RUNNING, execute dump, set final status
            String command = "mkdir -p /controller/tmp && echo RUNNING > /controller/tmp/backup_status.txt && " +
                             "(nohup sh -c 'pg_dump -U " + user + " " + db + " > /controller/tmp/backup.sql 2>/dev/null; " +
                             "if [ $? -eq 0 ]; then echo DONE > /controller/tmp/backup_status.txt; " +
                             "else echo FAILED > /controller/tmp/backup_status.txt; fi' > /dev/null 2>&1 &)";
            
            log.info("Executing pg_dump trigger command: {}", command);
            
            // Clean previous state files before starting
            execCommand(environmentId, namespace, podName, "rm -f /controller/tmp/backup.sql /controller/tmp/backup_status.txt");

            io.fabric8.kubernetes.client.dsl.ExecWatch watch = client.pods().inNamespace(namespace).withName(podName)
                    .writingOutput(new java.io.ByteArrayOutputStream())
                    .exec("sh", "-c", command);

            Thread.sleep(500); // Give it a moment to detach
            watch.close();
        } catch (Exception e) {
            log.error("Failed to trigger pg_dump: {}", e.getMessage());
            throw new com.cnpg.gui.exception.CnpGuiException("K8S_014", "Failed to start pg_dump: " + e.getMessage(), 500);
        }
    }

    public String checkPgDumpStatus(UUID environmentId, String namespace, String podName) {
        try {
            String status = execCommand(environmentId, namespace, podName, "cat /controller/tmp/backup_status.txt 2>/dev/null");
            if (status == null || status.isBlank()) {
                return "IDLE";
            }
            
            String trimmedStatus = status.trim();
            if (trimmedStatus.contains("DONE")) return "COMPLETED";
            if (trimmedStatus.contains("RUNNING")) return "RUNNING";
            if (trimmedStatus.contains("FAILED")) return "FAILED";
            
            return "IDLE";
        } catch (Exception e) {
            log.error("Error checking pg_dump status: {}", e.getMessage());
            return "ERROR";
        }
    }

    @Audit(action = "CLUSTER_PG_DUMP_DOWNLOAD")
    public void downloadPgDumpFile(UUID environmentId, String namespace, String podName, java.io.OutputStream out) {
        log.info("Downloading /controller/tmp/backup.sql from pod {} in namespace {}", podName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            // Wait up to 5 minutes for download transfer
            java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);

            io.fabric8.kubernetes.client.dsl.ExecWatch watch = client.pods().inNamespace(namespace).withName(podName)
                    .writingOutput(out)
                    .usingListener(new io.fabric8.kubernetes.client.dsl.ExecListener() {
                        @Override
                        public void onOpen() {
                        }

                        @Override
                        public void onFailure(Throwable t,
                                io.fabric8.kubernetes.client.dsl.ExecListener.Response response) {
                            latch.countDown();
                        }

                        @Override
                        public void onClose(int code, String reason) {
                            latch.countDown();
                        }
                    })
                    .exec("cat", "/controller/tmp/backup.sql");

            latch.await(5, java.util.concurrent.TimeUnit.MINUTES);
            watch.close();
            out.flush();
            // Cleanup after download
            execCommand(environmentId, namespace, podName,
                    "rm -f /controller/tmp/backup.sql /controller/tmp/backup_status.txt");
        } catch (Exception e) {
            log.error("Download failed", e);
            throw new com.cnpg.gui.exception.CnpGuiException("K8S_015", "Download failed: " + e.getMessage(), 500);
        }
    }

    public java.util.Map<String, String> getSuperuserCredentials(UUID environmentId, String namespace,
            String clusterName) {
        log.info("Fetching superuser credentials for cluster {} in namespace {}", clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            String[] secretSuffixes = { "-superuser", "-app", "-user-auth" };

            for (String suffix : secretSuffixes) {
                String secretName = clusterName + suffix;
                var secret = client.secrets().inNamespace(namespace).withName(secretName).get();

                if (secret != null && secret.getData() != null) {
                    Map<String, String> data = secret.getData();
                    String encodedPass = data.get("password");
                    if (encodedPass == null)
                        encodedPass = data.get("PASS");

                    String encodedUser = data.get("username");
                    if (encodedUser == null)
                        encodedUser = data.get("user");

                    if (encodedPass != null) {
                        String user = (encodedUser != null)
                                ? new String(java.util.Base64.getDecoder().decode(encodedUser)).trim()
                                : "postgres";
                        String pass = new String(java.util.Base64.getDecoder().decode(encodedPass)).trim();

                        log.info("Found credentials in secret {}: user={}", secretName, user);
                        return java.util.Map.of("username", user, "password", pass);
                    }
                }
            }

            throw new CnpGuiException("K8S_010", "Superuser credentials not found in any standard secrets", 404);
        } catch (CnpGuiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to fetch superuser credentials for {}: {}", clusterName, e.getMessage());
            throw new CnpGuiException("K8S_010", "Credential fetching failed: " + e.getMessage(), 500);
        }
    }

    public String getServiceIp(UUID environmentId, String namespace, String clusterName) {
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            String serviceName = clusterName + "-rw";
            var svc = client.services().inNamespace(namespace).withName(serviceName).get();
            if (svc != null && svc.getSpec() != null) {
                return svc.getSpec().getClusterIP();
            }
            return serviceName + "." + namespace + ".svc.cluster.local";
        } catch (Exception e) {
            return clusterName + "-rw." + namespace + ".svc.cluster.local";
        }
    }

    
    public Map<String, String> getS3Credentials(UUID environmentId, String namespace, String clusterName) {
        log.info("Fetching S3 credentials for cluster {} in namespace {}", clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            String secretName = clusterName + "-s3-creds";
            var secret = client.secrets().inNamespace(namespace).withName(secretName).get();

            if (secret != null && secret.getData() != null) {
                Map<String, String> data = secret.getData();
                String encodedAccessKey = data.get("ACCESS_KEY_ID");
                String encodedSecretKey = data.get("SECRET_ACCESS_KEY");

                String accessKey = encodedAccessKey != null
                        ? new String(Base64.getDecoder().decode(encodedAccessKey)).trim()
                        : "";
                String secretKey = encodedSecretKey != null
                        ? new String(Base64.getDecoder().decode(encodedSecretKey)).trim()
                        : "";

                log.info("Successfully decoded S3 credentials from secret {}", secretName);
                return Map.of("accessKeyId", accessKey, "secretAccessKey", secretKey);
            }

            log.warn("S3 credentials secret {} not found", secretName);
            return Map.of("accessKeyId", "", "secretAccessKey", "");
        } catch (Exception e) {
            log.error("Failed to fetch S3 credentials for {}: {}", clusterName, e.getMessage());
            return Map.of("accessKeyId", "", "secretAccessKey", "");
        }
    }

    
    public Map<String, String> getBootstrapCredentials(UUID environmentId, String namespace, String clusterName) {
        log.info("Fetching bootstrap credentials for cluster {} in namespace {}", clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            String secretName = clusterName + "-user-auth";
            var secret = client.secrets().inNamespace(namespace).withName(secretName).get();

            if (secret != null && secret.getData() != null) {
                Map<String, String> data = secret.getData();
                String encodedUser = data.get("username");
                String encodedPass = data.get("password");

                String username = encodedUser != null
                        ? new String(Base64.getDecoder().decode(encodedUser)).trim()
                        : "appuser";
                String password = encodedPass != null
                        ? new String(Base64.getDecoder().decode(encodedPass)).trim()
                        : "";

                log.info("Successfully decoded bootstrap credentials from secret {}", secretName);
                return Map.of("username", username, "password", password);
            }

            log.warn("Bootstrap credentials secret {} not found", secretName);
            return Map.of("username", "appuser", "password", "");
        } catch (Exception e) {
            log.error("Failed to fetch bootstrap credentials for {}: {}", clusterName, e.getMessage());
            return Map.of("username", "appuser", "password", "");
        }
    }

    
    @SuppressWarnings("unchecked")
    public Map<String, Object> getPoolerForCluster(UUID environmentId, String namespace, String clusterName) {
        log.info("Fetching Pooler CRD for cluster {} in namespace {}", clusterName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            CustomResourceDefinitionContext poolerCtx = new CustomResourceDefinitionContext.Builder()
                    .withGroup("postgresql.cnpg.io")
                    .withVersion("v1")
                    .withPlural("poolers")
                    .withScope("Namespaced")
                    .build();

            // Try common naming convention: {cluster}-pooler
            String poolerName = clusterName + "-pooler";
            GenericKubernetesResource pooler = client.genericKubernetesResources(poolerCtx)
                    .inNamespace(namespace)
                    .withName(poolerName)
                    .get();

            if (pooler == null) {
                // Also try listing all poolers for this cluster
                var poolers = client.genericKubernetesResources(poolerCtx)
                        .inNamespace(namespace)
                        .list().getItems();

                for (var p : poolers) {
                    Map<String, Object> spec = (Map<String, Object>) p.getAdditionalProperties().get("spec");
                    if (spec != null) {
                        Map<String, Object> clusterRef = (Map<String, Object>) spec.get("cluster");
                        if (clusterRef != null && clusterName.equals(clusterRef.get("name"))) {
                            pooler = p;
                            break;
                        }
                    }
                }
            }

            if (pooler != null) {
                Map<String, Object> result = new HashMap<>();
                Map<String, Object> spec = (Map<String, Object>) pooler.getAdditionalProperties().get("spec");
                if (spec != null) {
                    result.put("enabled", true);
                    result.put("type", spec.getOrDefault("type", "rw"));
                    result.put("instances", spec.getOrDefault("instances", 2));

                    Map<String, Object> pgbouncer = (Map<String, Object>) spec.get("pgbouncer");
                    if (pgbouncer != null) {
                        result.put("poolMode", pgbouncer.getOrDefault("poolMode", "session"));
                        Map<String, Object> params = (Map<String, Object>) pgbouncer.get("parameters");
                        if (params != null) {
                            String maxConn = String.valueOf(params.getOrDefault("max_client_conn", "100"));
                            result.put("maxConnections", maxConn);
                        } else {
                            result.put("maxConnections", "100");
                        }
                    }
                }
                log.info("Found Pooler CRD for cluster {}", clusterName);
                return result;
            }

            log.info("No Pooler CRD found for cluster {}", clusterName);
            return Map.of("enabled", false);
        } catch (Exception e) {
            log.warn("Failed to fetch Pooler CRD for {}: {}", clusterName, e.getMessage());
            return Map.of("enabled", false);
        }
    }

    
    @SuppressWarnings("unchecked")
    public Map<String, Object> getClusterUsersAndRoles(UUID environmentId, String namespace, String clusterName) {
        log.info("Fetching users and roles for cluster {} in namespace {}", clusterName, namespace);
        Map<String, Object> result = new HashMap<>();

        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            // 1. Get secrets with decoded username
            java.util.Set<io.fabric8.kubernetes.api.model.Secret> allSecrets = new java.util.HashSet<>();

            allSecrets.addAll(client.secrets().inNamespace(namespace)
                    .withLabel("cnpg.io/cluster", clusterName)
                    .list().getItems());

            try {
                Secret sa = client.secrets().inNamespace(namespace).withName(clusterName + "-user-auth").get();
                if (sa != null)
                    allSecrets.add(sa);
            } catch (Exception ignored) {
            }

            try {
                Secret ss = client.secrets().inNamespace(namespace).withName(clusterName + "-superuser").get();
                if (ss != null)
                    allSecrets.add(ss);
            } catch (Exception ignored) {
            }

            try {
                Secret sapp = client.secrets().inNamespace(namespace).withName(clusterName + "-app").get();
                if (sapp != null)
                    allSecrets.add(sapp);
            } catch (Exception ignored) {
            }

            List<Map<String, String>> secretUsers = allSecrets.stream()
                    .filter(s -> s.getData() != null)
                    .filter(s -> {
                        String sName = s.getMetadata().getName();
                        return sName.endsWith("-superuser") || sName.endsWith("-auth");
                    })
                    .map(s -> {
                        Map<String, String> user = new HashMap<>();
                        user.put("secretName", s.getMetadata().getName());
                        user.put("type", s.getType() != null ? s.getType() : "Opaque");

                        // Decode username from secret data
                        String encodedUser = s.getData().get("username");
                        if (encodedUser == null)
                            encodedUser = s.getData().get("user");
                        if (encodedUser != null) {
                            try {
                                user.put("username", new String(Base64.getDecoder().decode(encodedUser)).trim());
                            } catch (Exception e) {
                                user.put("username", s.getMetadata().getName().replace(clusterName + "-", ""));
                            }
                        } else {
                            user.put("username", s.getMetadata().getName().replace(clusterName + "-", ""));
                        }

                        // Check if password exists (don't send actual password for listing)
                        boolean hasPassword = s.getData().containsKey("password") || s.getData().containsKey("PASS");
                        user.put("hasPassword", String.valueOf(hasPassword));

                        return user;
                    }).toList();

            result.put("secretUsers", secretUsers);

            // 2. Get managed roles from cluster spec
            GenericKubernetesResource cluster = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                    .inNamespace(namespace)
                    .withName(clusterName)
                    .get();

            if (cluster != null) {
                Map<String, Object> spec = (Map<String, Object>) cluster.getAdditionalProperties().get("spec");
                if (spec != null) {
                    Map<String, Object> managed = (Map<String, Object>) spec.get("managed");
                    if (managed != null) {
                        List<Map<String, Object>> roles = (List<Map<String, Object>>) managed.get("roles");
                        if (roles != null) {
                            List<Map<String, Object>> enrichedRoles = new ArrayList<>();
                            for (Map<String, Object> role : roles) {
                                Map<String, Object> enrichedRole = new HashMap<>(role);
                                Map<String, Object> ps = (Map<String, Object>) role.get("passwordSecret");
                                if (ps != null) {
                                    String secretName = (String) ps.get("name");
                                    if (secretName != null) {
                                        try {
                                            Secret secret = client.secrets().inNamespace(namespace).withName(secretName)
                                                    .get();
                                            if (secret != null && secret.getData() != null) {
                                                String encodedPass = secret.getData().get("password");
                                                if (encodedPass == null)
                                                    encodedPass = secret.getData().get("PASS");
                                                if (encodedPass != null) {
                                                    enrichedRole.put("password",
                                                            new String(Base64.getDecoder().decode(encodedPass)).trim());
                                                    enrichedRole.put("passwordSecret", secretName); // Ensure it's just
                                                                                                    // the name string
                                                                                                    // for frontend
                                                }
                                            }
                                        } catch (Exception e) {
                                            log.warn("Failed to fetch password for managed role {}: {}",
                                                    role.get("name"), e.getMessage());
                                        }
                                    }
                                }
                                enrichedRoles.add(enrichedRole);
                            }
                            result.put("managedRoles", enrichedRoles);
                        } else {
                            result.put("managedRoles", List.of());
                        }
                    } else {
                        result.put("managedRoles", List.of());
                    }
                } else {
                    result.put("managedRoles", List.of());
                }
            } else {
                result.put("managedRoles", List.of());
            }

        } catch (Exception e) {
            log.error("Failed to list users and roles: {}", e.getMessage());
            result.put("secretUsers", List.of());
            result.put("managedRoles", List.of());
        }

        return result;
    }
}
