package com.cnpg.gui.config;

import com.cnpg.gui.domain.User;
import com.cnpg.gui.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AppStartupRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${superadmin.user:admin}")
    private String superAdminUser;

    @Value("${superadmin.password:admin}")
    private String superAdminPassword;

    @Override
    public void run(String... args) {
        if (userRepository.findByUsername(superAdminUser).isEmpty()) {
            User admin = new User();
            admin.setUsername(superAdminUser);
            admin.setAuthType("local");
            admin.setPasswordHash(passwordEncoder.encode(superAdminPassword));
            admin.setRole("SUPERADMIN");
            admin.setStatus("active");
            
            userRepository.save(admin);
            log.info("Superadmin user '{}' created successfully.", superAdminUser);
        } else {
            log.info("Superadmin user '{}' already exists. Skipping creation.", superAdminUser);
        }
    }
}
