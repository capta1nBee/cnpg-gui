package com.cnpg.gui.service;

import com.cnpg.gui.kubernetes.K8sClientManager;
import io.fabric8.kubernetes.api.model.Namespace;
import io.fabric8.kubernetes.api.model.storage.StorageClass;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class KubernetesService {

    private final K8sClientManager k8sClientManager;

    public List<String> listNamespaces(UUID environmentId) {
        log.info("Fetching namespaces for environment: {}", environmentId);
        return k8sClientManager.getClient(environmentId).namespaces().list().getItems().stream()
                .map(ns -> ns.getMetadata().getName())
                .collect(Collectors.toList());
    }

    public List<String> listStorageClasses(UUID environmentId) {
        log.info("Fetching storage classes for environment: {}", environmentId);
        return k8sClientManager.getClient(environmentId).storage().storageClasses().list().getItems().stream()
                .map(sc -> sc.getMetadata().getName())
                .collect(Collectors.toList());
    }
}
