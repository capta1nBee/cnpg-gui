package com.cnpg.gui.repository;

import com.cnpg.gui.domain.K8sEnvironment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface K8sEnvironmentRepository extends JpaRepository<K8sEnvironment, UUID> {
}
