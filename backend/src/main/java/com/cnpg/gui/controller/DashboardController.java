package com.cnpg.gui.controller;

import com.cnpg.gui.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/metrics")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'ADMIN', 'VIEWER')")
    public ResponseEntity<Map<String, Object>> getMetrics(
            @RequestHeader("X-Environment-ID") UUID environmentId,
            @RequestHeader(value = "X-Namespace", defaultValue = "all") String namespace) {
        return ResponseEntity.ok(dashboardService.getMetrics(environmentId, namespace));
    }
}
