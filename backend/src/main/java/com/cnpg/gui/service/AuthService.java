package com.cnpg.gui.service;

import com.cnpg.gui.domain.User;
import com.cnpg.gui.exception.CnpGuiException;
import com.cnpg.gui.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final LdapService ldapService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    /**
     * @param authTypeHint "local" or "ldap" — hint from frontend.
     *                     Backend always decides based on the authType in DB,
     *                     but hints produce more descriptive error messages in case of mismatch.
     */
    public String authenticate(String username, String password, String authTypeHint) {
        log.info("Login attempt: user={}, authTypeHint={}", username, authTypeHint);
        Optional<User> userOpt = userService.findByUsername(username);

        if (userOpt.isPresent()) {
            User user = userOpt.get();

            // ── Is account active? ─────────────────────────────────────────────
            if (!"active".equals(user.getStatus())) {
                log.warn("Login failed: account disabled for user {}", username);
                throw new CnpGuiException("AUTH_002", "This user account has been disabled.", 403);
            }

            // ── Auth-type mismatch check ──────────────────────────────
            log.info("User '{}' found in DB. AuthType: {}", username, user.getAuthType());

            // Give a meaningful error if the user selected the wrong tab
            if ("ldap".equalsIgnoreCase(authTypeHint) && "local".equals(user.getAuthType())) {
                log.warn("Login failed: auth-type mismatch — user {} is LOCAL but hint says LDAP", username);
                throw new CnpGuiException("AUTH_005",
                        "This account is defined with local authentication. " +
                                "Please use the 'Local Account' option.",
                        401);
            }
            if ("local".equalsIgnoreCase(authTypeHint) && "ldap".equals(user.getAuthType())) {
                log.warn("Login failed: auth-type mismatch — user {} is LDAP but hint says LOCAL", username);
                throw new CnpGuiException("AUTH_005",
                        "This account uses corporate LDAP authentication. " +
                                "Please select the 'Enterprise LDAP' option.",
                        401);
            }

            // ── Local authentication ───────────────────────────────────────
            if ("local".equals(user.getAuthType())) {
                log.info("Performing LOCAL password check for user: {}", username);
                if (user.getPasswordHash() == null) {
                    log.warn("Login failed: local user {} has no password set", username);
                    throw new CnpGuiException("AUTH_006",
                            "No password has been defined for this account. Please contact your administrator.", 401);
                }
                if (passwordEncoder.matches(password, user.getPasswordHash())) {
                    log.info("Local login successful: user={}", username);
                    userService.updateLastLogin(user);
                    return generateToken(user);
                }
                log.warn("Login failed: wrong password for local user {}", username);
                throw new CnpGuiException("AUTH_001", "Invalid username or password.", 401);

                // ── LDAP authentication ────────────────────────────────────────
            } else if ("ldap".equals(user.getAuthType())) {
                log.info("Performing LDAP authentication for user: {} (Skipping DB password check)", username);
                Optional<com.cnpg.gui.domain.LdapSettings> ldapSettings = ldapService.getActiveSettings();
                if (ldapSettings.isEmpty()) {
                    log.warn("Login failed: LDAP user '{}' but LDAP service not configured/enabled", username);
                    throw new CnpGuiException("AUTH_004",
                            "This account is defined with LDAP authentication, but the LDAP service is not active. " +
                                    "Please contact the system administrator.",
                            401);
                }
                if (ldapService.authenticate(username, password)) {
                    log.info("LDAP login successful: user={}", username);
                    userService.updateLastLogin(user);
                    return generateToken(user);
                }
                log.warn("Login failed: invalid LDAP credentials for user {}", username);
                throw new CnpGuiException("AUTH_001", "Invalid LDAP username or password.", 401);
            }

        } else {
            // ── User not in DB → try LDAP auto-provision ──────────────
            Optional<com.cnpg.gui.domain.LdapSettings> ldapSettings = ldapService.getActiveSettings();
            if (ldapSettings.isPresent() && ldapService.authenticate(username, password)) {
                log.info("LDAP user '{}' first login — auto-provisioning as VIEWER...", username);
                User newUser = new User();
                newUser.setUsername(username);
                newUser.setAuthType("ldap");
                newUser.setRole("VIEWER");
                newUser.setStatus("active");
                User savedUser = userService.createUser(newUser);
                return generateToken(savedUser);
            }
        }

        log.warn("Login failed: no matching account for user {}", username);
        throw new CnpGuiException("AUTH_001", "Invalid username or password.", 401);
    }

    private String generateToken(User user) {
        String tenantId = user.getTenant() != null ? user.getTenant().getId().toString() : "";
        return jwtUtil.generateToken(user.getUsername(), user.getRole(), tenantId);
    }
}
