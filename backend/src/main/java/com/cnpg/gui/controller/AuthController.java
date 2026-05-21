package com.cnpg.gui.controller;

import com.cnpg.gui.service.AuthService;
import com.cnpg.gui.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        try {
            // authType hint from frontend (optional — backend validates from DB)
            String authTypeHint = credentials.getOrDefault("authType", "");

            String token = authService.authenticate(
                    credentials.get("username"),
                    credentials.get("password"),
                    authTypeHint
            );
            return userService.findByUsername(credentials.get("username"))
                    .map(user -> ResponseEntity.ok(Map.of(
                            "token",    token,
                            "role",     user.getRole(),
                            "username", user.getUsername(),
                            "authType", user.getAuthType() != null ? user.getAuthType() : "local"
                    )))
                    .orElse(ResponseEntity.ok(Map.of("token", token)));
        } catch (com.cnpg.gui.exception.CnpGuiException e) {
            // Use the exact HTTP status from the exception (401, 403, etc.)
            return ResponseEntity.status(e.getStatus()).body(Map.of(
                    "error", e.getMessage(),
                    "code",  e.getCode()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        String username = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userService.findByUsername(username)
                .map(user -> ResponseEntity.ok(Map.of(
                        "username", user.getUsername(),
                        "role", user.getRole(),
                        "authType", user.getAuthType() != null ? user.getAuthType() : "local",
                        "email", user.getEmail() != null ? user.getEmail() : ""
                )))
                .orElse(ResponseEntity.status(401).build());
    }
}
