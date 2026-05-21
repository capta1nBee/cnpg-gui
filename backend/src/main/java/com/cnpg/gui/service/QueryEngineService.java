package com.cnpg.gui.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class QueryEngineService {

    public List<Map<String, Object>> executeQuery(String jdbcUrl, String username, String password, String query) {
        log.info("QueryEngineService.executeQuery: Connecting to {} with username {}", jdbcUrl, username);
        log.debug("QueryEngineService.executeQuery: Password length is {}, query: {}", password != null ? password.length() : 0, query);
        List<Map<String, Object>> resultList = new ArrayList<>();
        
        // For MVP, directly connect using JDBC
        // Read/Write separation is handled by connecting to the replica service URL for SELECTs
        // and primary service URL for DML/DDL.
        try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password);
             Statement stmt = conn.createStatement()) {
            
            boolean isResultSet = stmt.execute(query);
            if (isResultSet) {
                try (ResultSet rs = stmt.getResultSet()) {
                    int columnCount = rs.getMetaData().getColumnCount();
                    while (rs.next()) {
                        Map<String, Object> row = new HashMap<>();
                        for (int i = 1; i <= columnCount; i++) {
                            row.put(rs.getMetaData().getColumnName(i), rs.getObject(i));
                        }
                        resultList.add(row);
                    }
                }
            } else {
                resultList.add(Map.of("updated_rows", stmt.getUpdateCount()));
            }
        } catch (Exception e) {
            log.error("Query execution failed", e);
            resultList.add(Map.of("error", e.getMessage()));
        }
        
        return resultList;
    }
}
