package com.cnpg.gui.domain;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "email_settings")
public class EmailSettings {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    private boolean enabled = false;
    
    @Column(name = "host")
    private String host;
    
    @Column(name = "port")
    private int port = 587;
    
    @Column(name = "username")
    private String username;
    
    @Column(name = "password")
    private String password;
    
    @Column(name = "from_email")
    private String fromEmail;
    
    @Column(name = "from_name")
    private String fromName;
    
    @Column(name = "encryption_type") // NONE, SSL, STARTTLS
    private String encryptionType = "STARTTLS";

    @Column(name = "auth_enabled")
    private boolean authEnabled = true;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
