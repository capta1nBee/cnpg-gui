package com.cnpg.gui.exception;

import lombok.Getter;

@Getter
public class CnpGuiException extends RuntimeException {
    private final String code;
    private final int status;

    public CnpGuiException(String code, String message, int status) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
