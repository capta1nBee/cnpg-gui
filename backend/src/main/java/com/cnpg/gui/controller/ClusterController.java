package com.cnpg.gui.controller;

import com.cnpg.gui.service.ClusterService;
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
@RequestMapping("/api/v1/clusters")
@RequiredArgsConstructor
public class ClusterController {

    private final ClusterService clusterService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<List<Map<String, Object>>> listClusters(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader(value = "X-Namespace", required = false) String namespace) {
        log.info("API: listClusters called for environment {} and namespace {}", environmentId, namespace);
        return ResponseEntity.ok(clusterService.listClusters(environmentId, null, namespace));
    }

    @GetMapping("/{namespace}/{name}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<Map<String, Object>> getCluster(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        log.info("API: getCluster called for environment {} and namespace {}/{}", environmentId, namespace, name);
        return ResponseEntity.ok(clusterService.getCluster(environmentId, namespace, name));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> createCluster(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader("X-Namespace") String namespace,
            @RequestBody String yamlPayload) {
        clusterService.createCluster(environmentId, null, namespace, yamlPayload);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{namespace}/{name}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> deleteCluster(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        clusterService.deleteCluster(environmentId, namespace, name);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/scale")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> scaleCluster(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, Integer> payload) {
        clusterService.scaleCluster(environmentId, namespace, name, payload.get("instances"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/upgrade")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> upgradeCluster(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> payload) {
        clusterService.upgradeCluster(environmentId, namespace, name, payload.get("version"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/failover")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> failoverCluster(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> payload) {
        clusterService.failoverCluster(environmentId, namespace, name, payload.get("targetInstance"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/suspend")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> suspendCluster(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, Boolean> payload) {
        clusterService.suspendCluster(environmentId, namespace, name, payload.get("suspend"));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{namespace}/{name}/logs/{podName}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<String> getPodLogs(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @PathVariable String podName) {
        return ResponseEntity.ok(clusterService.getPodLogs(environmentId, namespace, podName));
    }

    @GetMapping("/{namespace}/{name}/users")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<List<Map<String, String>>> listClusterUsers(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        return ResponseEntity.ok(clusterService.listClusterUsers(environmentId, namespace, name));
    }

    @PostMapping("/{namespace}/{name}/users")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> createClusterUser(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> payload) {
        clusterService.createClusterUser(environmentId, namespace, name, payload.get("username"), payload.get("password"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/hba")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> updateHbaRules(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, List<String>> payload) {
        clusterService.updateHbaRules(environmentId, namespace, name, payload.get("rules"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/managed-roles")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> updateManagedRoles(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, List<Map<String, Object>>> payload) {
        clusterService.updateManagedRoles(environmentId, namespace, name, payload.get("roles"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{namespace}/pods/{podName}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> deletePod(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String podName) {
        clusterService.deletePod(environmentId, namespace, podName);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/fence")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> fenceInstance(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, Object> payload) {
        clusterService.fenceInstance(environmentId, namespace, name, (String) payload.get("instanceName"), (Boolean) payload.get("fence"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/resize")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> resizeStorage(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody Map<String, String> payload) {
        clusterService.resizeStorage(environmentId, namespace, name, payload.get("newSize"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/force-failover")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> forceFailover(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        clusterService.forceFailover(environmentId, namespace, name);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{namespace}/{name}/exec/{podName}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Map<String, String>> execCommand(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @PathVariable String podName,
            @RequestBody Map<String, String> payload) {
        String output = clusterService.execCommand(environmentId, namespace, podName, payload.get("command"));
        return ResponseEntity.ok(Map.of("output", output));
    }

    @PostMapping("/{namespace}/{name}/pg_dump/{podName}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> triggerPgDump(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @PathVariable String podName,
            @RequestBody Map<String, String> payload) {
        clusterService.triggerPgDump(environmentId, namespace, podName, payload.getOrDefault("user", "postgres"), payload.getOrDefault("db", "postgres"));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{namespace}/{name}/pg_dump/{podName}/status")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Map<String, String>> checkPgDumpStatus(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @PathVariable String podName) {
        String status = clusterService.checkPgDumpStatus(environmentId, namespace, podName);
        return ResponseEntity.ok(Map.of("status", status));
    }

    @GetMapping(value = "/{namespace}/{name}/pg_dump/{podName}", produces = org.springframework.http.MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> downloadPgDump(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name,
            @PathVariable String podName) {
        
        org.springframework.security.core.context.SecurityContext context = org.springframework.security.core.context.SecurityContextHolder.getContext();
        org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody stream = out -> {
            try {
                org.springframework.security.core.context.SecurityContextHolder.setContext(context);
                clusterService.downloadPgDumpFile(environmentId, namespace, podName, out);
            } finally {
                org.springframework.security.core.context.SecurityContextHolder.clearContext();
            }
        };
        
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"backup.sql\"")
                .body(stream);
    }

    // ===== TASK 3: S3 Credentials Decode Endpoint =====
    @GetMapping("/{namespace}/{name}/s3-credentials")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Map<String, String>> getS3Credentials(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        return ResponseEntity.ok(clusterService.getS3Credentials(environmentId, namespace, name));
    }

    // ===== TASK 4: Bootstrap Credentials Decode Endpoint =====
    @GetMapping("/{namespace}/{name}/bootstrap-credentials")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Map<String, String>> getBootstrapCredentials(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        return ResponseEntity.ok(clusterService.getBootstrapCredentials(environmentId, namespace, name));
    }

    // ===== TASK 2: Pooler CRD Endpoint =====
    @GetMapping("/{namespace}/{name}/pooler")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<Map<String, Object>> getPooler(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        return ResponseEntity.ok(clusterService.getPoolerForCluster(environmentId, namespace, name));
    }

    // ===== TASK 5: Enhanced Users & Roles Endpoint =====
    @GetMapping("/{namespace}/{name}/users-roles")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<Map<String, Object>> getClusterUsersAndRoles(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @PathVariable String namespace,
            @PathVariable String name) {
        return ResponseEntity.ok(clusterService.getClusterUsersAndRoles(environmentId, namespace, name));
    }
}

