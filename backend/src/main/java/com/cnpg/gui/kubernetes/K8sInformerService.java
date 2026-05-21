package com.cnpg.gui.kubernetes;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext;
import io.fabric8.kubernetes.client.informers.ResourceEventHandler;
import io.fabric8.kubernetes.client.informers.SharedIndexInformer;
import io.fabric8.kubernetes.client.informers.SharedInformerFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class K8sInformerService {

    private final K8sClientManager k8sClientManager;
    private final SimpMessagingTemplate messagingTemplate;
    private SharedInformerFactory informerFactory;

    private static final CustomResourceDefinitionContext CNPG_CLUSTER_CONTEXT = new CustomResourceDefinitionContext.Builder()
            .withGroup("postgresql.k8s.io")
            .withVersion("v1")
            .withPlural("clusters")
            .withScope("Namespaced")
            .build();

    public void startWatching(UUID environmentId, String namespace) {
        KubernetesClient client = k8sClientManager.getClient(environmentId);
        informerFactory = client.informers();

        SharedIndexInformer<GenericKubernetesResource> clusterInformer = client.genericKubernetesResources(CNPG_CLUSTER_CONTEXT)
                .inNamespace(namespace)
                .inform();

        clusterInformer.addEventHandler(new ResourceEventHandler<GenericKubernetesResource>() {
            @Override
            public void onAdd(GenericKubernetesResource cluster) {
                log.info("Cluster added: {}", cluster.getMetadata().getName());
                String name = cluster.getMetadata().getName();
                Integer instances = (Integer) ((Map) cluster.getAdditionalProperties().get("spec")).get("instances");
                messagingTemplate.convertAndSend("/topic/cluster-status/" + name, 
                        (Object) Map.of("action", "SCALE", "instances", instances, "status", "PATCHED"));
            }

            @Override
            public void onUpdate(GenericKubernetesResource oldCluster, GenericKubernetesResource newCluster) {
                log.info("Cluster updated: {}", newCluster.getMetadata().getName());
                // Emit WebSocket event for status change
            }

            @Override
            public void onDelete(GenericKubernetesResource cluster, boolean deletedFinalStateUnknown) {
                log.info("Cluster deleted: {}", cluster.getMetadata().getName());
                // Emit WebSocket event
            }
        });

        informerFactory.startAllRegisteredInformers();
        log.info("Started informers for environment {} namespace {}", environmentId, namespace);
    }

    @PreDestroy
    public void stopWatching() {
        if (informerFactory != null) {
            informerFactory.stopAllRegisteredInformers();
        }
    }
}
