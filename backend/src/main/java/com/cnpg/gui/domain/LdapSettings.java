package com.cnpg.gui.domain;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "ldap_settings")
public class LdapSettings {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    private boolean enabled = false;
    private String url;
    
    @Column(name = "bind_dn")
    private String bindDn;
    
    @Column(name = "bind_password")
    private String bindPassword;
    
    @Column(name = "base_dn")
    private String baseDn;
    
    @Column(name = "user_filter")
    private String userFilter;
    
    @Column(name = "username_attribute")
    private String usernameAttribute;
    
    @Column(name = "email_attribute")
    private String emailAttribute;
    
    @Column(name = "tls_enabled")
    private boolean tlsEnabled = false;

    @Column(name = "sync_interval_minutes")
    private Integer syncIntervalMinutes = 60;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
