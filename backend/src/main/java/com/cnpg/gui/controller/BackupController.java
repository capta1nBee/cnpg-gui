package com.cnpg.gui.controller;

import com.cnpg.gui.service.BackupService;
import com.cnpg.gui.service.ClusterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/backups")
@RequiredArgsConstructor
public class BackupController {

    private final BackupService backupService;
    private final ClusterService clusterService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<List<Map<String, Object>>> listBackups(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader(value = "X-Namespace", required = false) String namespace) {
        return ResponseEntity.ok(backupService.listBackups(environmentId, namespace));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> createBackup(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader("X-Namespace") String namespace,
            @RequestBody Map<String, String> payload) {
        backupService.createBackup(environmentId, namespace, payload.get("clusterName"), payload.get("backupName"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{backupName}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> deleteBackup(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader("X-Namespace") String namespace,
            @PathVariable String backupName) {
        backupService.deleteBackup(environmentId, namespace, backupName);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/restore/pitr")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Void> pitrRestore(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader("X-Namespace") String namespace,
            @RequestBody Map<String, Object> payload) {

        clusterService.restoreCluster(
                environmentId,
                namespace,
                (String) payload.get("newClusterName"),
                (String) payload.get("sourceClusterName"),
                (String) payload.get("targetTime"),
                (String) payload.get("targetXID"),
                (String) payload.get("targetLSN"),
                (String) payload.get("targetName"),
                payload.get("targetImmediate") != null ? Boolean.valueOf(payload.get("targetImmediate").toString())
                        : null,
                (String) payload.get("backupID"),
                payload.get("exclusive") != null ? Boolean.valueOf(payload.get("exclusive").toString()) : null,
                (String) payload.get("method"));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/scheduled")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<List<Map<String, Object>>> listScheduledBackups(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader("X-Namespace") String namespace) {
        return ResponseEntity.ok(backupService.listScheduledBackups(environmentId, namespace));
    }

    @PostMapping("/test-s3")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> testS3(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader(value = "X-Namespace", required = false) String namespace,
            @RequestBody Map<String, Object> payload) {
        String endpoint = (String) payload.get("endpointUrl");
        String bucket = (String) payload.get("bucketName");
        String accessKey = (String) payload.get("accessKey");
        String secretKey = (String) payload.get("secretKey");
        boolean skipVerify = (boolean) payload.getOrDefault("skipVerify", false);

        Map<String, Object> result = backupService.testS3ConnectionFromOperator(
                environmentId, namespace, endpoint, bucket, accessKey, secretKey, skipVerify);
        return ResponseEntity.ok(result);
    }
}
