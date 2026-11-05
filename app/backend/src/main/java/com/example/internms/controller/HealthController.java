package com.example.internms.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

@RestController
public class HealthController {
    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        try (Connection connection = dataSource.getConnection()) {
            if (!connection.isValid(2)) throw new SQLException("Invalid connection");
            return ResponseEntity.ok(Map.of(
                    "service", "intern-management", "status", "UP", "portals", "admin-intern-v1",
                    "database", connection.getMetaData().getDatabaseProductName()));
        } catch (SQLException error) {
            return ResponseEntity.status(503).body(Map.of("service", "intern-management", "status", "DOWN"));
        }
    }

    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of("service", "intern-management", "client", "npm run client", "health", "/api/health");
    }
}
