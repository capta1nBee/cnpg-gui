package com.cnpg.gui.repository;

import com.cnpg.gui.domain.QueryHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QueryHistoryRepository extends JpaRepository<QueryHistory, UUID> {
    List<QueryHistory> findByUsernameOrderByTimestampDesc(String username);
}
