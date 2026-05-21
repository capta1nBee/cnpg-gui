package com.cnpg.gui.kubernetes;

import com.cnpg.gui.domain.K8sEnvironment;
import com.cnpg.gui.repository.K8sEnvironmentRepository;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class K8sClientManager {

    private final K8sEnvironmentRepository environmentRepository;
    private final Map<UUID, KubernetesClient> clientPool = new ConcurrentHashMap<>();

    public KubernetesClient getClient(UUID environmentId) {
        return clientPool.computeIfAbsent(environmentId, id -> {
            Optional<K8sEnvironment> envOpt = environmentRepository.findById(id);
            if (envOpt.isEmpty()) {
                throw new RuntimeException("K8s Environment not found: " + id);
            }
            K8sEnvironment env = envOpt.get();
            try {
                Config config = Config.fromKubeconfig(env.getKubeconfig());
                return new KubernetesClientBuilder().withConfig(config).build();
            } catch (Exception e) {
                log.error("Failed to build Kubernetes client for environment {}", env.getName(), e);
                throw new RuntimeException("Failed to initialize Kubernetes client", e);
            }
        });
    }

    public void removeClient(UUID environmentId) {
        KubernetesClient client = clientPool.remove(environmentId);
        if (client != null) {
            client.close();
            log.info("Kubernetes client closed for environment: {}", environmentId);
        }
    }
}
