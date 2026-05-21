package com.cnpg.gui.repository;

import com.cnpg.gui.domain.EmailSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface EmailSettingsRepository extends JpaRepository<EmailSettings, UUID> {
}
