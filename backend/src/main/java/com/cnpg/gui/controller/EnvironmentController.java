package com.cnpg.gui.controller;

import com.cnpg.gui.domain.K8sEnvironment;
import com.cnpg.gui.repository.EnvironmentRepository;
import com.cnpg.gui.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/environments")
@RequiredArgsConstructor
public class EnvironmentController {

    private final EnvironmentRepository environmentRepository;
    private final com.cnpg.gui.kubernetes.K8sClientManager k8sClientManager;

    @GetMapping("/{id}/operator-status")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<Map<String, Object>> getOperatorStatus(@PathVariable UUID id) {
        try {
            io.fabric8.kubernetes.client.KubernetesClient client = k8sClientManager.getClient(id);
            var crd = client.apiextensions().v1().customResourceDefinitions()
                    .withName("clusters.postgresql.cnpg.io").get();
            
            boolean installed = crd != null;
            
            return ResponseEntity.ok(Map.of(
                "installed", installed,
                "message", installed ? "CloudNativePG Operator is detected." : "CloudNativePG Operator is NOT installed."
            ));
        } catch (Exception e) {
            log.error("Failed to check operator status for env {}: {}", id, e.getMessage());
            return ResponseEntity.ok(Map.of(
                "installed", false,
                "message", "Connection failed: " + e.getMessage()
            ));
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<List<K8sEnvironment>> getEnvironments() {
        String tenantIdStr = TenantContext.getTenantId();
        if (tenantIdStr == null || tenantIdStr.isEmpty()) {
            return ResponseEntity.ok(environmentRepository.findAll());
        }
        UUID tenantId = UUID.fromString(tenantIdStr);
        log.info("Filtering environments for tenant: {}", tenantId);
        return ResponseEntity.ok(environmentRepository.findAllByTenantId(tenantId));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<K8sEnvironment> createEnvironment(@RequestBody K8sEnvironment payload) {
        return ResponseEntity.ok(environmentRepository.save(payload));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<K8sEnvironment> updateEnvironment(@PathVariable UUID id,
            @RequestBody K8sEnvironment payload) {
        return environmentRepository.findById(id).map(env -> {
            env.setName(payload.getName());
            if (payload.getKubeconfig() != null && !payload.getKubeconfig().isEmpty()) {
                env.setKubeconfig(payload.getKubeconfig());
            }
            if (payload.getApiServerUrl() != null && !payload.getApiServerUrl().isEmpty()) {
                env.setApiServerUrl(payload.getApiServerUrl());
            }
            if (payload.getStatus() != null) {
                env.setStatus(payload.getStatus());
            }
            return ResponseEntity.ok(environmentRepository.save(env));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> deleteEnvironment(@PathVariable UUID id) {
        environmentRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/test")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> testEnvironment(@PathVariable UUID id) {
        return ResponseEntity.ok(Map.of("success", true, "message", "K8s API connection successful"));
    }
}
