package com.cnpg.gui.service;

import com.cnpg.gui.annotation.Audit;
import com.cnpg.gui.kubernetes.K8sClientManager;
import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BackupService {

    private final K8sClientManager k8sClientManager;

    private static final CustomResourceDefinitionContext CNPG_BACKUP_CONTEXT = new CustomResourceDefinitionContext.Builder()
            .withGroup("postgresql.cnpg.io")
            .withVersion("v1")
            .withPlural("backups")
            .withScope("Namespaced")
            .build();

    @Audit(action = "BACKUP_CREATE")
    public void createBackup(UUID environmentId, String namespace, String clusterName, String backupName) {
        log.info("Initiating manual backup '{}' for cluster '{}' in namespace '{}'", backupName, clusterName,
                namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            GenericKubernetesResource backup = new GenericKubernetesResourceBuilder()
                    .withApiVersion("postgresql.cnpg.io/v1")
                    .withKind("Backup")
                    .withNewMetadata()
                    .withName(backupName)
                    .withNamespace(namespace)
                    .endMetadata()
                    .addToAdditionalProperties("spec", Map.of("cluster", Map.of("name", clusterName)))
                    .build();

            client.genericKubernetesResources(CNPG_BACKUP_CONTEXT)
                    .inNamespace(namespace)
                    .resource(backup)
                    .create();
            log.info("Successfully created Backup CRD for '{}'", backupName);
        } catch (Exception e) {
            log.error("Failed to create backup '{}': {}", backupName, e.getMessage());
            throw e;
        }
    }

    @Audit(action = "BACKUP_DELETE")
    public void deleteBackup(UUID environmentId, String namespace, String backupName) {
        log.info("Requesting deletion of backup '{}' in namespace '{}'", backupName, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            client.genericKubernetesResources(CNPG_BACKUP_CONTEXT)
                    .inNamespace(namespace)
                    .withName(backupName)
                    .delete();
            log.info("Backup deletion request for '{}' sent", backupName);
        } catch (Exception e) {
            log.error("Failed to delete backup '{}': {}", backupName, e.getMessage());
            throw e;
        }
    }

    public java.util.List<Map<String, Object>> listBackups(UUID environmentId, String namespace) {
        log.info("Listing backups for environment: {}, namespace: {}", environmentId, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            var query = client.genericKubernetesResources(CNPG_BACKUP_CONTEXT);

            List<GenericKubernetesResource> resources;
            if (namespace == null || namespace.isEmpty() || "all".equalsIgnoreCase(namespace)) {
                resources = query.inAnyNamespace().list().getItems();
            } else {
                resources = query.inNamespace(namespace).list().getItems();
            }

            return resources.stream().map(r -> {
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("name", r.getMetadata().getName());
                map.put("namespace", r.getMetadata().getNamespace());
                map.put("creationTimestamp", r.getMetadata().getCreationTimestamp());

                // Flatten cluster name for frontend consumption
                try {
                    Map<String, Object> spec = (Map<String, Object>) r.getAdditionalProperties().get("spec");
                    if (spec != null) {
                        Map<String, Object> clusterRef = (Map<String, Object>) spec.get("cluster");
                        if (clusterRef != null) {
                            map.put("cluster", clusterRef.get("name"));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to extract cluster name for backup {}: {}", r.getMetadata().getName(),
                            e.getMessage());
                }

                map.putAll(r.getAdditionalProperties());
                return map;
            }).toList();
        } catch (Exception e) {
            log.error("Failed to list backups: {}", e.getMessage());
            return java.util.List.of();
        }
    }

    public java.util.List<Map<String, Object>> listScheduledBackups(UUID environmentId, String namespace) {
        log.info("Listing scheduled backups for environment: {}, namespace: {}", environmentId, namespace);
        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);
            CustomResourceDefinitionContext context = new CustomResourceDefinitionContext.Builder()
                    .withGroup("postgresql.cnpg.io")
                    .withVersion("v1")
                    .withPlural("scheduledbackups")
                    .withScope("Namespaced")
                    .build();

            var query = client.genericKubernetesResources(context);
            List<GenericKubernetesResource> resources;
            if (namespace == null || namespace.isEmpty() || "all".equalsIgnoreCase(namespace)) {
                resources = query.inAnyNamespace().list().getItems();
            } else {
                resources = query.inNamespace(namespace).list().getItems();
            }

            return resources.stream().map(r -> {
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("name", r.getMetadata().getName());
                map.put("namespace", r.getMetadata().getNamespace());
                map.putAll(r.getAdditionalProperties());
                return map;
            }).toList();
        } catch (Exception e) {
            log.error("Failed to list scheduled backups: {}", e.getMessage());
            return java.util.List.of();
        }
    }

    public Map<String, Object> testS3ConnectionFromOperator(
            UUID environmentId,
            String namespace,
            String endpoint,
            String bucket,
            String accessKey,
            String secretKey,
            boolean skipVerify) {
        log.info("Testing S3 connection from CNPG Operator Pod in environment '{}' and namespace '{}'", environmentId, namespace);
        Map<String, Object> result = new java.util.LinkedHashMap<>();

        // Validate inputs
        if (endpoint == null || endpoint.isBlank()) {
            result.put("success", false);
            result.put("message", "Endpoint URL is empty");
            return result;
        }
        if (bucket == null || bucket.isBlank()) {
            result.put("success", false);
            result.put("message", "Bucket name is empty");
            return result;
        }
        if (accessKey == null || accessKey.isBlank() || secretKey == null || secretKey.isBlank()) {
            result.put("success", false);
            result.put("message", "Access Key or Secret Key is missing");
            return result;
        }

        try {
            KubernetesClient client = k8sClientManager.getClient(environmentId);

            // Step 1: Find CNPG operator pod dynamically across all namespaces
            io.fabric8.kubernetes.api.model.Pod operatorPod = null;
            String operatorNamespace = null;

            // 1.1 Search in all namespaces by standard CNPG label
            try {
                var list = client.pods().inAnyNamespace().withLabel("app.kubernetes.io/name", "cloudnative-pg").list().getItems();
                if (list != null && !list.isEmpty()) {
                    operatorPod = list.stream()
                        .filter(p -> p.getStatus() != null && "Running".equalsIgnoreCase(p.getStatus().getPhase()))
                        .findFirst()
                        .orElse(list.get(0));
                }
            } catch (Exception e) {
                log.warn("Failed to search operator pod dynamically by label in all namespaces: {}", e.getMessage());
            }

            // 1.2 Fallback: Search in all namespaces by alternate label
            if (operatorPod == null) {
                try {
                    var list = client.pods().inAnyNamespace().withLabel("app", "cloudnative-pg").list().getItems();
                    if (list != null && !list.isEmpty()) {
                        operatorPod = list.stream()
                            .filter(p -> p.getStatus() != null && "Running".equalsIgnoreCase(p.getStatus().getPhase()))
                            .findFirst()
                            .orElse(list.get(0));
                    }
                } catch (Exception e) {
                    log.warn("Failed to search operator pod by alternate label: {}", e.getMessage());
                }
            }

            // 1.3 Fallback: Search in all namespaces by pod name pattern matching
            if (operatorPod == null) {
                try {
                    var list = client.pods().inAnyNamespace().list().getItems();
                    if (list != null) {
                        operatorPod = list.stream()
                            .filter(p -> p.getMetadata().getName() != null && (
                                p.getMetadata().getName().contains("cnpg-controller-manager") ||
                                p.getMetadata().getName().contains("cloudnative-pg")
                            ))
                            .filter(p -> p.getStatus() != null && "Running".equalsIgnoreCase(p.getStatus().getPhase()))
                            .findFirst()
                            .orElse(null);
                    }
                } catch (Exception e) {
                    log.warn("Failed to search operator pod by name: {}", e.getMessage());
                }
            }

            if (operatorPod != null) {
                operatorNamespace = operatorPod.getMetadata().getNamespace();
            }

            if (operatorPod == null) {
                log.warn("CNPG operator pod not found in cluster. Falling back to local backend test.");
                return testS3Connection(endpoint, bucket, accessKey, secretKey, skipVerify);
            }

            String podName = operatorPod.getMetadata().getName();
            log.info("Found CNPG Operator Pod '{}' in namespace '{}'", podName, operatorNamespace);

            // Step 2: Sign the S3 HEAD request (Signature V4)
            String bucketUrl = endpoint.endsWith("/") ? endpoint + bucket : endpoint + "/" + bucket;
            java.net.URL url = new java.net.URL(bucketUrl);

            String dateStamp = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC)
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
            String shortDate = dateStamp.substring(0, 8);
            String region = "us-east-1";
            String service = "s3";

            String host = url.getHost() + (url.getPort() > 0 ? ":" + url.getPort() : "");
            String canonicalUri = url.getPath().isEmpty() ? "/" : url.getPath();
            String canonicalQueryString = "";
            String payloadHash = sha256Hex("");
            String canonicalHeaders = "host:" + host + "\nx-amz-content-sha256:" + payloadHash + "\nx-amz-date:" + dateStamp + "\n";
            String signedHeaders = "host;x-amz-content-sha256;x-amz-date";
            String canonicalRequest = "HEAD\n" + canonicalUri + "\n" + canonicalQueryString + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;

            String credentialScope = shortDate + "/" + region + "/" + service + "/aws4_request";
            String stringToSign = "AWS4-HMAC-SHA256\n" + dateStamp + "\n" + credentialScope + "\n" + sha256Hex(canonicalRequest);

            byte[] kDate = hmacSHA256(("AWS4" + secretKey).getBytes(java.nio.charset.StandardCharsets.UTF_8), shortDate);
            byte[] kRegion = hmacSHA256(kDate, region);
            byte[] kService = hmacSHA256(kRegion, service);
            byte[] kSigning = hmacSHA256(kService, "aws4_request");

            String signature = bytesToHex(hmacSHA256(kSigning, stringToSign));
            String authHeader = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

            // Step 3: Run curl command inside the operator pod
            String curlCmd = String.format(
                    "curl -s -o /dev/null -w \"%%{http_code}\" -X HEAD " +
                    "-H \"Host: %s\" " +
                    "-H \"x-amz-date: %s\" " +
                    "-H \"x-amz-content-sha256: %s\" " +
                    "-H \"Authorization: %s\" " +
                    "%s " +
                    "--connect-timeout 10 " +
                    "\"%s\"",
                    host,
                    dateStamp,
                    payloadHash,
                    authHeader.replace("\"", "\\\""),
                    (skipVerify ? "--insecure" : ""),
                    bucketUrl
            );

            log.info("Executing S3 test curl in pod '{}': {}", podName, curlCmd);

            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            java.io.ByteArrayOutputStream error = new java.io.ByteArrayOutputStream();

            io.fabric8.kubernetes.client.dsl.ExecWatch watch = null;
            try {
                watch = client.pods().inNamespace(operatorNamespace).withName(podName)
                        .writingOutput(output)
                        .writingError(error)
                        .exec("sh", "-c", curlCmd);

                // Wait for execution to finish
                int lastSize = -1;
                int sameCount = 0;
                for (int i = 0; i < 120; i++) {
                    Thread.sleep(100);
                    int currentSize = output.size() + error.size();
                    if (currentSize > 0 && currentSize == lastSize) {
                        sameCount++;
                        if (sameCount >= 3) break;
                    } else if (currentSize == 0 && i > 10) {
                        sameCount++;
                        if (sameCount >= 5) break;
                    } else {
                        sameCount = 0;
                    }
                    lastSize = currentSize;
                }
            } finally {
                if (watch != null) {
                    try {
                        watch.close();
                    } catch (Exception ignore) {}
                }
            }

            String responseCodeStr = output.toString().trim();
            String errorMsg = error.toString().trim();

            log.info("S3 curl output: responseCode='{}', error='{}'", responseCodeStr, errorMsg);

            if (responseCodeStr.isEmpty() && (!errorMsg.isEmpty() || output.size() == 0)) {
                if (errorMsg.contains("executable file not found") || errorMsg.contains("OCI runtime exec failed") || errorMsg.contains("no such file or directory")) {
                    log.warn("CNPG operator pod lacks shell. Falling back to local backend S3 test.");
                    return testS3Connection(endpoint, bucket, accessKey, secretKey, skipVerify);
                }
            }

            int responseCode = 0;
            try {
                responseCode = Integer.parseInt(responseCodeStr);
            } catch (NumberFormatException e) {
                log.warn("Failed to parse HTTP status code from curl output '{}', falling back to local test.", responseCodeStr);
                return testS3Connection(endpoint, bucket, accessKey, secretKey, skipVerify);
            }

            result.put("operatorPod", podName);
            result.put("operatorNamespace", operatorNamespace);
            result.put("responseCode", responseCode);

            if (responseCode == 200) {
                result.put("success", true);
                result.put("message", "✓ S3 connection successful from operator pod. Bucket '" + bucket + "' is accessible.");
            } else if (responseCode == 301 || responseCode == 307) {
                result.put("success", true);
                result.put("message", "✓ Endpoint reachable from operator pod. Bucket exists (redirect response).");
            } else if (responseCode == 403) {
                result.put("success", false);
                result.put("message", "✗ Access denied from operator pod. Check your Access Key and Secret Key.");
            } else if (responseCode == 404) {
                result.put("success", false);
                result.put("message", "✗ Bucket '" + bucket + "' not found from operator pod. Verify the bucket name.");
            } else if (responseCode == 0) {
                result.put("success", false);
                result.put("message", "✗ Cannot reach S3 endpoint from operator pod: Connection refused or timed out.");
            } else {
                result.put("success", false);
                result.put("message", "✗ Unexpected response code from operator pod: " + responseCode);
            }

        } catch (Exception e) {
            log.error("Failed to run in-cluster S3 test from operator pod: {}", e.getMessage(), e);
            log.warn("Falling back to local backend S3 test.");
            return testS3Connection(endpoint, bucket, accessKey, secretKey, skipVerify);
        }

        return result;
    }

    public Map<String, Object> testS3Connection(String endpoint, String bucket, String accessKey, String secretKey,
            boolean skipVerify) {
        log.info("Testing S3 connection to {} (Bucket: {}) with skipVerify={}", endpoint, bucket, skipVerify);
        Map<String, Object> result = new java.util.LinkedHashMap<>();

        // Step 1: Validate inputs
        if (endpoint == null || endpoint.isBlank()) {
            result.put("success", false);
            result.put("message", "Endpoint URL is empty");
            return result;
        }
        if (bucket == null || bucket.isBlank()) {
            result.put("success", false);
            result.put("message", "Bucket name is empty");
            return result;
        }
        if (accessKey == null || accessKey.isBlank() || secretKey == null || secretKey.isBlank()) {
            result.put("success", false);
            result.put("message", "Access Key or Secret Key is missing");
            return result;
        }

        try {
            // Step 2: Test endpoint reachability
            String bucketUrl = endpoint.endsWith("/") ? endpoint + bucket : endpoint + "/" + bucket;
            java.net.URL url = new java.net.URL(bucketUrl);

            // Build SSL context if skipVerify
            if (skipVerify && bucketUrl.startsWith("https")) {
                javax.net.ssl.TrustManager[] trustAll = new javax.net.ssl.TrustManager[] {
                        new javax.net.ssl.X509TrustManager() {
                            public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                                return null;
                            }

                            public void checkClientTrusted(java.security.cert.X509Certificate[] certs,
                                    String authType) {
                            }

                            public void checkServerTrusted(java.security.cert.X509Certificate[] certs,
                                    String authType) {
                            }
                        }
                };
                javax.net.ssl.SSLContext sc = javax.net.ssl.SSLContext.getInstance("TLS");
                sc.init(null, trustAll, new java.security.SecureRandom());
                javax.net.ssl.HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
                javax.net.ssl.HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
            }

            // Step 3: Create AWS Signature V4 signed request for HEAD bucket
            String dateStamp = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC)
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
            String shortDate = dateStamp.substring(0, 8);
            String region = "us-east-1";
            String service = "s3";

            // Canonical request
            String host = url.getHost() + (url.getPort() > 0 ? ":" + url.getPort() : "");
            String canonicalUri = url.getPath().isEmpty() ? "/" : url.getPath();
            String canonicalQueryString = "";
            String payloadHash = sha256Hex("");
            String canonicalHeaders = "host:" + host + "\nx-amz-content-sha256:" + payloadHash + "\nx-amz-date:"
                    + dateStamp + "\n";
            String signedHeaders = "host;x-amz-content-sha256;x-amz-date";
            String canonicalRequest = "HEAD\n" + canonicalUri + "\n" + canonicalQueryString + "\n" + canonicalHeaders
                    + "\n" + signedHeaders + "\n" + payloadHash;

            // String to sign
            String credentialScope = shortDate + "/" + region + "/" + service + "/aws4_request";
            String stringToSign = "AWS4-HMAC-SHA256\n" + dateStamp + "\n" + credentialScope + "\n"
                    + sha256Hex(canonicalRequest);

            // Signing key
            byte[] kDate = hmacSHA256(("AWS4" + secretKey).getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    shortDate);
            byte[] kRegion = hmacSHA256(kDate, region);
            byte[] kService = hmacSHA256(kRegion, service);
            byte[] kSigning = hmacSHA256(kService, "aws4_request");

            String signature = bytesToHex(hmacSHA256(kSigning, stringToSign));
            String authHeader = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope + ", SignedHeaders="
                    + signedHeaders + ", Signature=" + signature;

            // Make the request
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            connection.setRequestMethod("HEAD");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Host", host);
            connection.setRequestProperty("x-amz-date", dateStamp);
            connection.setRequestProperty("x-amz-content-sha256", payloadHash);
            connection.setRequestProperty("Authorization", authHeader);

            int responseCode = connection.getResponseCode();
            log.info("S3 HEAD bucket response code: {}", responseCode);

            if (responseCode == 200) {
                result.put("success", true);
                result.put("message", "✓ Connection successful. Bucket '" + bucket + "' is accessible.");
                result.put("responseCode", responseCode);
            } else if (responseCode == 301 || responseCode == 307) {
                result.put("success", true);
                result.put("message", "✓ Endpoint reachable. Bucket exists (redirect response).");
                result.put("responseCode", responseCode);
            } else if (responseCode == 403) {
                result.put("success", false);
                result.put("message", "✗ Access denied. Check your Access Key and Secret Key.");
                result.put("responseCode", responseCode);
            } else if (responseCode == 404) {
                result.put("success", false);
                result.put("message", "✗ Bucket '" + bucket + "' not found. Verify the bucket name.");
                result.put("responseCode", responseCode);
            } else {
                result.put("success", false);
                result.put("message", "✗ Unexpected response code: " + responseCode);
                result.put("responseCode", responseCode);
            }
        } catch (java.net.ConnectException e) {
            result.put("success", false);
            result.put("message", "✗ Cannot reach endpoint: Connection refused. Check the endpoint URL.");
        } catch (java.net.SocketTimeoutException e) {
            result.put("success", false);
            result.put("message", "✗ Connection timed out. Endpoint may be unreachable.");
        } catch (java.net.UnknownHostException e) {
            result.put("success", false);
            result.put("message", "✗ Unknown host. DNS resolution failed for the endpoint.");
        } catch (Exception e) {
            log.warn("S3 connection test failed: {}", e.getMessage());
            result.put("success", false);
            result.put("message", "✗ Test failed: " + e.getMessage());
        }
        return result;
    }

    private String sha256Hex(String data) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private byte[] hmacSHA256(byte[] key, String data) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
