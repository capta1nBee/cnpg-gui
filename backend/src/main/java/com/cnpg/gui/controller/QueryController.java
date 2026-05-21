package com.cnpg.gui.controller;

import com.cnpg.gui.service.QueryService;
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
@RequestMapping("/api/v1/query")
@RequiredArgsConstructor
public class QueryController {

    private final QueryService queryService;

    @GetMapping("/databases")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<List<String>> listDatabases(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestParam String namespace,
            @RequestParam String clusterName) {
        log.info("API Request: /databases - cluster: {}, namespace: {}, envId: {}", clusterName, namespace, environmentId);
        return ResponseEntity.ok(queryService.listDatabases(environmentId, namespace, clusterName));
    }

    @GetMapping("/tables")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<List<String>> listTables(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestParam String namespace,
            @RequestParam String clusterName,
            @RequestParam String database) {
        log.info("API Request: /tables - cluster: {}, database: {}, namespace: {}", clusterName, database, namespace);
        return ResponseEntity.ok(queryService.listTables(environmentId, namespace, clusterName, database));
    }

    @PostMapping("/execute")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> executeQuery(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestBody Map<String, String> payload) {
        log.info("API Request: /execute - clusterName: {}, database: {}, namespace: {}", payload.get("clusterName"), payload.get("database"), payload.get("namespace"));
        log.debug("API Request: /execute - Payload full content: {}", payload);
        return ResponseEntity.ok(queryService.executeQuery(
            environmentId,
            payload.get("namespace"),
            payload.get("clusterName"),
            payload.get("database"),
            payload.get("query")
        ));
    }
}
