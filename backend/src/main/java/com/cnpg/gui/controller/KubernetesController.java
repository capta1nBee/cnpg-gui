package com.cnpg.gui.controller;

import com.cnpg.gui.service.KubernetesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/k8s")
@RequiredArgsConstructor
public class KubernetesController {

    private final KubernetesService kubernetesService;

    @GetMapping("/namespaces")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<List<String>> listNamespaces(@RequestHeader("X-Environment-ID") UUID environmentId) {
        return ResponseEntity.ok(kubernetesService.listNamespaces(environmentId));
    }

    @GetMapping("/storage-classes")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<List<String>> listStorageClasses(@RequestHeader("X-Environment-ID") UUID environmentId) {
        return ResponseEntity.ok(kubernetesService.listStorageClasses(environmentId));
    }
}
