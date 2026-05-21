package com.cnpg.gui.controller;

import com.cnpg.gui.domain.EmailSettings;
import com.cnpg.gui.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/settings/email")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class EmailSettingsController {

    private final EmailService emailService;

    @GetMapping
    public ResponseEntity<EmailSettings> getSettings() {
        return emailService.getSettings()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping
    public ResponseEntity<Void> saveSettings(@RequestBody EmailSettings settings) {
        emailService.saveSettings(settings);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/test")
    public ResponseEntity<String> testConnection(@RequestBody EmailSettings settings) {
        try {
            emailService.testConnection(settings);
            return ResponseEntity.ok("Connection Successful");
        } catch (Exception e) {
            log.error("Email connection test failed", e);
            return ResponseEntity.badRequest().body("Connection Failed: " + e.getMessage());
        }
    }
}

