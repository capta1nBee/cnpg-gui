package com.cnpg.gui.kubernetes;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.LogWatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogStreamService {

    private final K8sClientManager k8sClientManager;
    private final SimpMessagingTemplate messagingTemplate;
    
    private final Map<String, LogWatch> activeWatches = new ConcurrentHashMap<>();

    public void startLogStream(UUID environmentId, String namespace, String podName) {
        String watchKey = environmentId.toString() + ":" + namespace + ":" + podName;
        if (activeWatches.containsKey(watchKey)) {
            return;
        }

        KubernetesClient client = k8sClientManager.getClient(environmentId);
        
        LogWatch watch = client.pods().inNamespace(namespace).withName(podName).tailingLines(100).watchLog();
        activeWatches.put(watchKey, watch);

        Thread readerThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(watch.getOutput()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    messagingTemplate.convertAndSend("/topic/logs/" + podName, line);
                }
            } catch (Exception e) {
                log.error("Error reading logs for pod {}", podName, e);
            } finally {
                stopLogStream(environmentId, namespace, podName);
            }
        });
        readerThread.start();
    }

    public void stopLogStream(UUID environmentId, String namespace, String podName) {
        String watchKey = environmentId.toString() + ":" + namespace + ":" + podName;
        LogWatch watch = activeWatches.remove(watchKey);
        if (watch != null) {
            watch.close();
        }
    }
}
