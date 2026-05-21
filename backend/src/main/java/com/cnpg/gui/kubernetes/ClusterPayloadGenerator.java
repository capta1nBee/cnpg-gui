package com.cnpg.gui.kubernetes;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class ClusterPayloadGenerator {

    public GenericKubernetesResource generateClusterResource(String name, String namespace, Map<String, Object> payload) {
        // Build the basic spec
        Map<String, Object> spec = new HashMap<>();
        spec.put("instances", payload.getOrDefault("instances", 3));
        
        Map<String, Object> storage = new HashMap<>();
        storage.put("size", payload.getOrDefault("storageSize", "10Gi"));
        spec.put("storage", storage);

        Map<String, Object> postgresql = new HashMap<>();
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("shared_buffers", payload.getOrDefault("sharedBuffers", "256MB"));
        postgresql.put("parameters", parameters);
        spec.put("postgresql", postgresql);

        return new GenericKubernetesResourceBuilder()
                .withApiVersion("postgresql.k8s.io/v1")
                .withKind("Cluster")
                .withNewMetadata()
                    .withName(name)
                    .withNamespace(namespace)
                .endMetadata()
                .addToAdditionalProperties("spec", spec)
                .build();
    }
}
