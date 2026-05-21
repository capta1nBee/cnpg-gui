package com.cnpg.gui.config;

import com.cnpg.gui.kubernetes.K8sClientManager;
import com.cnpg.gui.security.JwtUtil;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.ExecWatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class TerminalWebSocketHandler extends TextWebSocketHandler {

    private final K8sClientManager k8sClientManager;
    private final JwtUtil jwtUtil;

    private final Map<String, ExecWatch> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        Map<String, String> params = parseQueryParams(uri);

        String token = params.get("token");
        String namespace = params.get("namespace");
        String podName = params.get("pod");
        String envId = params.get("env");

        // Validate JWT
        try {
            jwtUtil.getUsername(token);
        } catch (Exception e) {
            log.warn("Terminal WebSocket rejected: invalid token");
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            return;
        }

        if (namespace == null || podName == null || envId == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Missing parameters"));
            return;
        }

        UUID environmentId = UUID.fromString(envId);
        KubernetesClient client = k8sClientManager.getClient(environmentId);

        // Create a thread-safe output stream that sends data to the WebSocket
        OutputStream wsOutputStream = new OutputStream() {
            @Override
            public void write(int b) throws IOException {
                write(new byte[]{(byte) b}, 0, 1);
            }

            @Override
            public void write(byte[] b, int off, int len) throws IOException {
                if (session.isOpen()) {
                    synchronized (session) {
                        try {
                            session.sendMessage(new TextMessage(new String(b, off, len)));
                        } catch (Exception e) {
                            log.debug("Failed to send terminal output: {}", e.getMessage());
                        }
                    }
                }
            }
        };

        // Open interactive exec session with TTY
        ExecWatch watch = client.pods()
                .inNamespace(namespace)
                .withName(podName)
                .redirectingInput()
                .writingOutput(wsOutputStream)
                .writingError(wsOutputStream)
                .withTTY()
                .exec("sh");

        sessions.put(session.getId(), watch);

        log.info("Terminal WebSocket opened for pod {}/{}, session={}", namespace, podName, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        ExecWatch watch = sessions.get(session.getId());
        if (watch != null && watch.getInput() != null) {
            String payload = message.getPayload();

            // Handle resize control messages
            if (payload.startsWith("{\"type\":\"resize\"")) {
                try {
                    // Simple JSON parse for resize: {"type":"resize","cols":N,"rows":N}
                    int colsIdx = payload.indexOf("\"cols\":");
                    int rowsIdx = payload.indexOf("\"rows\":");
                    if (colsIdx > 0 && rowsIdx > 0) {
                        String colsStr = payload.substring(colsIdx + 6).replaceAll("[^0-9].*", "");
                        String rowsStr = payload.substring(rowsIdx + 6).replaceAll("[^0-9].*", "");
                        int cols = Integer.parseInt(colsStr);
                        int rows = Integer.parseInt(rowsStr);
                        watch.resize(cols, rows);
                        log.debug("Terminal resized to {}x{}", cols, rows);
                    }
                } catch (Exception e) {
                    log.debug("Failed to parse resize: {}", e.getMessage());
                }
                return;
            }

            // Regular input - send to pod stdin
            watch.getInput().write(payload.getBytes());
            watch.getInput().flush();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        ExecWatch watch = sessions.remove(session.getId());
        if (watch != null) {
            try {
                watch.close();
            } catch (Exception e) {
                log.debug("Error closing exec watch: {}", e.getMessage());
            }
        }
        log.info("Terminal WebSocket closed: session={}, status={}", session.getId(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("Terminal WebSocket transport error: session={}, error={}", session.getId(), exception.getMessage());
        ExecWatch watch = sessions.remove(session.getId());
        if (watch != null) {
            try {
                watch.close();
            } catch (Exception e) {
                log.debug("Error closing exec watch on transport error: {}", e.getMessage());
            }
        }
    }

    private Map<String, String> parseQueryParams(URI uri) {
        Map<String, String> params = new HashMap<>();
        String query = uri != null ? uri.getQuery() : null;
        if (query != null) {
            for (String param : query.split("&")) {
                String[] pair = param.split("=", 2);
                if (pair.length == 2) {
                    params.put(pair[0], java.net.URLDecoder.decode(pair[1], java.nio.charset.StandardCharsets.UTF_8));
                }
            }
        }
        return params;
    }
}
