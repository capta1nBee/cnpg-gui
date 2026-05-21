package com.cnpg.gui.service;

import com.cnpg.gui.domain.LdapSettings;
import com.cnpg.gui.repository.LdapSettingsRepository;
import com.unboundid.ldap.sdk.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LdapService {

    private final LdapSettingsRepository ldapSettingsRepository;

    public Optional<LdapSettings> getActiveSettings() {
        List<LdapSettings> settings = ldapSettingsRepository.findAll();
        if (settings.isEmpty())
            return Optional.empty();
        LdapSettings setting = settings.get(0);
        return setting.isEnabled() ? Optional.of(setting) : Optional.empty();
    }

    public boolean authenticate(String username, String password) {
        Optional<LdapSettings> settingsOpt = getActiveSettings();
        if (settingsOpt.isEmpty()) {
            log.warn("LDAP is not enabled or configured");
            return false;
        }

        LdapSettings settings = settingsOpt.get();
        log.info("Starting LDAP authentication for user: {} (URL: {})", username, settings.getUrl());

        try (LDAPConnection connection = connect(settings)) {
            // First bind with admin to search for the user
            log.info("Attempting admin bind with DN: {}", settings.getBindDn());
            connection.bind(settings.getBindDn(), settings.getBindPassword());
            log.info("Admin bind successful");

            String rawFilter = settings.getUserFilter();
            if (rawFilter == null || !rawFilter.contains("{username}")) {
                log.error("CRITICAL LDAP CONFIG ERROR: User Filter is missing '{username}' placeholder! Current filter: {}. " +
                        "This would cause the search to return the wrong user.", rawFilter);
                return false;
            }

            String filterString = rawFilter.replace("{username}", username);
            log.info("Searching for user with filter: {} in base DN: {}", filterString, settings.getBaseDn());

            SearchRequest searchRequest = new SearchRequest(
                    settings.getBaseDn(),
                    SearchScope.SUB,
                    filterString,
                    settings.getUsernameAttribute(),
                    settings.getEmailAttribute());
            searchRequest.setSizeLimit(1);

            SearchResultEntry entry = null;
            try {
                SearchResult result = connection.search(searchRequest);
                if (result.getEntryCount() > 0) {
                    entry = result.getSearchEntries().get(0);
                    log.info("LDAP user found. Resolved DN: {}", entry.getDN());
                } else {
                    log.warn("LDAP user not found with filter: {}", filterString);
                }
            } catch (LDAPSearchException searchEx) {
                if (searchEx.getResultCode() == ResultCode.SIZE_LIMIT_EXCEEDED) {
                    log.info("LDAP size limit exceeded for '{}', using first entry found", username);
                    if (searchEx.getSearchEntries() != null && !searchEx.getSearchEntries().isEmpty()) {
                        entry = searchEx.getSearchEntries().get(0);
                        log.info("LDAP user found (partial result). Resolved DN: {}", entry.getDN());
                    }
                } else {
                    log.error("LDAP search failed: {} (ResultCode: {})", searchEx.getMessage(),
                            searchEx.getResultCode());
                    throw searchEx;
                }
            }

            if (entry == null) {
                return false;
            }

            String userDn = entry.getDN();

            // Try to bind with the actual user's credentials
            log.info("Attempting user bind for DN: {}", userDn);
            try (LDAPConnection userConnection = connect(settings)) {
                userConnection.bind(userDn, password);
                log.info("LDAP bind successful for user: {}", username);
                return true;
            } catch (LDAPException e) {
                if (e.getResultCode() == ResultCode.INVALID_CREDENTIALS) {
                    log.warn("Invalid LDAP credentials for user: {} (DN: {}). Diagnostic: {}",
                            username, userDn, e.getDiagnosticMessage());
                } else {
                    log.error("LDAP user bind error for {}: {} (ResultCode: {}, Diagnostic: {})",
                            username, e.getMessage(), e.getResultCode(), e.getDiagnosticMessage());
                }
                return false;
            }

        } catch (LDAPException e) {
            log.error("LDAP overall error for user {}: {} (ResultCode: {})",
                    username, e.getMessage(), e.getResultCode());
            return false;
        }
    }

    public boolean testConnection(LdapSettings settings) {
        try (LDAPConnection connection = connect(settings)) {
            connection.bind(settings.getBindDn(), settings.getBindPassword());
            return connection.isConnected();
        } catch (Exception e) {
            log.error("LDAP connection test failed: ", e);
            throw new RuntimeException("LDAP Connection Failed: " + e.getMessage());
        }
    }

    public void syncUsers() {
        log.info("LDAP User Sync triggered");
        // Logic to search all users in Base DN and auto-provision/update in local DB
    }

    private LDAPConnection connect(LdapSettings settings) throws LDAPException {
        String url = settings.getUrl();
        try {
            // Clean protocol and leading slashes
            String cleanUrl = url.replace("ldap://", "").replace("ldaps://", "");
            String[] parts = cleanUrl.split(":");

            String host = parts[0].replace("/", "");
            int port = (parts.length > 1) ? Integer.parseInt(parts[1]) : 389;

            log.info("Connecting to LDAP host: {}, port: {}", host, port);
            return new LDAPConnection(host, port);
        } catch (Exception e) {
            log.error("Failed to parse LDAP URL: {}", url);
            throw new LDAPException(ResultCode.PARAM_ERROR, "Invalid LDAP URL format: " + url);
        }
    }
}
