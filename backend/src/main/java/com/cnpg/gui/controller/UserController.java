package com.cnpg.gui.controller;

import com.cnpg.gui.domain.User;
import com.cnpg.gui.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.findAll());
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        return ResponseEntity.ok(userService.createUser(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<User> toggleStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.toggleUserStatus(id));
    }

    @PutMapping("/me/password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateMyPassword(@RequestBody Map<String, String> payload) {
        String username = org.springframework.security.core.context.SecurityContextHolder.getContext()
                .getAuthentication().getName();
        String newPassword = payload.get("newPassword");
        if (newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "New password is required"));
        }

        return userService.findByUsername(username).map(user -> {
            if ("ldap".equalsIgnoreCase(user.getAuthType())) {
                return ResponseEntity.badRequest().body(Map.of("error", "LDAP users cannot change password here"));
            }
            user.setPasswordHash(newPassword);
            userService.createUser(user);
            return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
        }).orElse(ResponseEntity.status(401).build());
    }
}
