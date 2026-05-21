package com.cnpg.gui.repository;

import com.cnpg.gui.domain.LdapSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface LdapSettingsRepository extends JpaRepository<LdapSettings, UUID> {
}
