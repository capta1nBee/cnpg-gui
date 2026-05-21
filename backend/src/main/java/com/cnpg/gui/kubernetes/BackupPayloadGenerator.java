package com.cnpg.gui.kubernetes;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class BackupPayloadGenerator {

    public GenericKubernetesResource generateBackupResource(String backupName, String clusterName, String namespace) {
        return new GenericKubernetesResourceBuilder()
                .withApiVersion("postgresql.k8s.io/v1")
                .withKind("Backup")
                .withNewMetadata()
                    .withName(backupName)
                    .withNamespace(namespace)
                .endMetadata()
                .addToAdditionalProperties("spec", Map.of("cluster", Map.of("name", clusterName)))
                .build();
    }
}
