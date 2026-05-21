package com.cnpg.gui.aspect;

import com.cnpg.gui.annotation.Audit;
import com.cnpg.gui.domain.AuditLog;
import com.cnpg.gui.repository.AuditLogRepository;
import com.cnpg.gui.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.time.LocalDateTime;
import java.util.UUID;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditLogRepository auditLogRepository;

    @AfterReturning(pointcut = "@annotation(auditAnnotation)", returning = "result")
    public void logSuccessfulAction(JoinPoint joinPoint, Audit auditAnnotation, Object result) {
        saveLog(auditAnnotation.action(), "SUCCESS", null, joinPoint);
    }

    @AfterThrowing(pointcut = "@annotation(auditAnnotation)", throwing = "ex")
    public void logFailedAction(JoinPoint joinPoint, Audit auditAnnotation, Exception ex) {
        saveLog(auditAnnotation.action(), "FAILED", ex.getMessage(), joinPoint);
    }

    private void saveLog(String action, String status, String errorMessage, JoinPoint joinPoint) {
        String username = SecurityContextHolder.getContext().getAuthentication() != null ? 
                SecurityContextHolder.getContext().getAuthentication().getName() : "SYSTEM";
        
        String tenantId = TenantContext.getTenantId();
        
        AuditLog auditLog = new AuditLog();
        auditLog.setAction(action);
        auditLog.setUsername(username);
        auditLog.setStatus(status);
        if (errorMessage != null) {
            auditLog.setErrorMessage(errorMessage);
        }
        auditLog.setTimestamp(LocalDateTime.now());
        
        // Capture Source IP
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String ip = request.getHeader("X-Forwarded-For");
                if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
                    ip = request.getRemoteAddr();
                }
                auditLog.setSourceIp(ip);
                auditLog.setUserAgent(request.getHeader("User-Agent"));
            }
        } catch (Exception e) {
            log.warn("Failed to capture IP for audit log: {}", e.getMessage());
        }

        // Capture Resource Name from arguments
        try {
            Object[] args = joinPoint.getArgs();
            if (args != null && args.length >= 3) {
                // Heuristic: for most cluster operations, name is the 3rd argument (index 2)
                // or the newClusterName for restore.
                String resourceName = args[2].toString();
                if (resourceName.length() < 100) { // Safety check
                    auditLog.setResourceName(resourceName);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to capture resource name for audit log: {}", e.getMessage());
        }

        if (tenantId != null && !tenantId.isEmpty()) {
            auditLog.setTenantId(UUID.fromString(tenantId));
        }

        auditLogRepository.save(auditLog);
        log.info("Audit Log saved: {} - {} by {} [IP: {}, Resource: {}]", 
                action, status, username, auditLog.getSourceIp(), auditLog.getResourceName());
    }
}
