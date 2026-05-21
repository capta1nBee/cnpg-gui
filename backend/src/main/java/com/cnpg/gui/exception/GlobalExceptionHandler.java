package com.cnpg.gui.exception;

import com.cnpg.gui.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CnpGuiException.class)
    public ResponseEntity<ErrorResponse> handleCnpGuiException(CnpGuiException ex) {
        log.error("Application error [{}]: {}", ex.getCode(), ex.getMessage());
        
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .error(ErrorResponse.ErrorDetail.builder()
                        .code(ex.getCode())
                        .message(ex.getMessage())
                        .timestamp(LocalDateTime.now())
                        .requestId(UUID.randomUUID().toString())
                        .build())
                .build();
        
        return ResponseEntity.status(ex.getStatus()).body(response);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException ex) {
        log.error("Unhandled runtime exception: ", ex);
        
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .error(ErrorResponse.ErrorDetail.builder()
                        .code("SYS_001")
                        .message("An unexpected system error occurred.")
                        .timestamp(LocalDateTime.now())
                        .requestId(UUID.randomUUID().toString())
                        .build())
                .build();
        
        return ResponseEntity.status(500).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneralException(Exception ex) {
        log.error("General exception: ", ex);
        
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .error(ErrorResponse.ErrorDetail.builder()
                        .code("SYS_000")
                        .message("System error: " + ex.getMessage())
                        .timestamp(LocalDateTime.now())
                        .requestId(UUID.randomUUID().toString())
                        .build())
                .build();
        
        return ResponseEntity.status(500).body(response);
    }
}
