package com.cnpg.gui.controller;

import com.cnpg.gui.domain.LdapSettings;
import com.cnpg.gui.repository.LdapSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/settings/ldap")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class LdapSettingsController {

    private final LdapSettingsRepository ldapSettingsRepository;
    private final com.cnpg.gui.service.LdapService ldapService;

    @GetMapping
    public ResponseEntity<LdapSettings> getSettings() {
        return ldapSettingsRepository.findAll().stream()
                .findFirst()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(new LdapSettings()));
    }

    @PostMapping
    public ResponseEntity<LdapSettings> saveSettings(@RequestBody LdapSettings settings) {
        ldapSettingsRepository.findAll().stream().findFirst().ifPresent(existing -> {
            settings.setId(existing.getId());
        });
        settings.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(ldapSettingsRepository.save(settings));
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody LdapSettings settings) {
        try {
            boolean success = ldapService.testConnection(settings);
            return ResponseEntity.ok(Map.of(
                    "success", success,
                    "message", success ? "LDAP Connection Successful!" : "LDAP Connection Failed"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", e.getMessage()));
        }
    }
}
