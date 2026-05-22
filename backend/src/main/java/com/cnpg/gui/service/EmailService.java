package com.cnpg.gui.service;

import com.cnpg.gui.domain.EmailSettings;
import com.cnpg.gui.repository.EmailSettingsRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Properties;

import java.io.UnsupportedEncodingException;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final EmailSettingsRepository emailSettingsRepository;

    public Optional<EmailSettings> getSettings() {
        List<EmailSettings> settings = emailSettingsRepository.findAll();
        return settings.isEmpty() ? Optional.empty() : Optional.of(settings.get(0));
    }

    public void saveSettings(EmailSettings settings) {
        Optional<EmailSettings> existing = getSettings();
        if (existing.isPresent()) {
            EmailSettings current = existing.get();
            current.setEnabled(settings.isEnabled());
            current.setHost(settings.getHost());
            current.setPort(settings.getPort());
            current.setUsername(settings.getUsername());
            current.setPassword(settings.getPassword());
            current.setFromEmail(settings.getFromEmail());
            current.setFromName(settings.getFromName());
            current.setEncryptionType(settings.getEncryptionType());
            current.setAuthEnabled(settings.isAuthEnabled());
            current.setUpdatedAt(java.time.LocalDateTime.now());
            emailSettingsRepository.save(current);
        } else {
            emailSettingsRepository.save(settings);
        }
    }

    public void sendEmail(String to, String subject, String body) throws MessagingException, UnsupportedEncodingException {
        EmailSettings settings = getSettings().orElseThrow(() -> new RuntimeException("Email settings not configured"));
        
        if (!settings.isEnabled()) {
            log.warn("Email service is disabled. Skipping email to {}", to);
            return;
        }

        JavaMailSenderImpl mailSender = createMailSender(settings);
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(settings.getFromEmail(), settings.getFromName());
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(body, true);

        mailSender.send(message);
        log.info("Email sent successfully to {}", to);
    }

    public void sendInvitationEmail(String to, String username, String role) {
        String subject = "You have been invited to the Poyraz-CNPG Platform";
        String body = "<html><body style='font-family: Arial, sans-serif;'>" +
                "<div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>" +
                "<h2 style='color: #2563eb;'>Welcome!</h2>" +
                "<p>Hello <b>" + username + "</b>,</p>" +
                "<p>You have been invited to the Poyraz-CNPG platform with <b>" + role + "</b> permissions.</p>" +
                "<p>You can log in to the system with your username.</p>" +
                "<div style='margin-top: 30px;'>" +
                "<a href='http://localhost:3000' style='background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;'>Go to Platform</a>" +
                "</div>" +
                "<p style='margin-top: 40px; font-size: 12px; color: #64748b;'>This email was sent automatically. Please do not reply.</p>" +
                "</div>" +
                "</body></html>";
        try {
            sendEmail(to, subject, body);
        } catch (Exception e) {
            log.error("Failed to send invitation email to {}", to, e);
        }
    }


    public void testConnection(EmailSettings settings) throws MessagingException {
        JavaMailSenderImpl mailSender = createMailSender(settings);
        mailSender.testConnection();
    }

    public void testConnectionAndSendEmail(EmailSettings settings, String toEmail) throws MessagingException, java.io.UnsupportedEncodingException {
        JavaMailSenderImpl mailSender = createMailSender(settings);
        mailSender.testConnection();

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(settings.getFromEmail(), settings.getFromName());
        helper.setTo(toEmail);
        helper.setSubject("Test Email — Poyraz-CNPG SMTP Test");

        String body = "<html><body style='font-family: Arial, sans-serif;'>" +
                "<div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>" +
                "<h2 style='color: #2563eb;'>SMTP Test Successful!</h2>" +
                "<p>Hello,</p>" +
                "<p>This is a test email sent from the Poyraz-CNPG system to verify your SMTP settings.</p>" +
                "<p>If you received this email, your email configuration is working correctly!</p>" +
                "<p style='margin-top: 40px; font-size: 12px; color: #64748b;'>This email was sent automatically. Please do not reply.</p>" +
                "</div>" +
                "</body></html>";
        helper.setText(body, true);

        mailSender.send(message);
        log.info("Test email sent successfully to {}", toEmail);
    }

    private JavaMailSenderImpl createMailSender(EmailSettings settings) {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(settings.getHost());
        mailSender.setPort(settings.getPort());

        if (settings.isAuthEnabled()) {
            mailSender.setUsername(settings.getUsername());
            mailSender.setPassword(settings.getPassword());
        }

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", String.valueOf(settings.isAuthEnabled()));
        
        if ("STARTTLS".equals(settings.getEncryptionType())) {
            props.put("mail.smtp.starttls.enable", "true");
        } else if ("SSL".equals(settings.getEncryptionType())) {
            props.put("mail.smtp.ssl.enable", "true");
            props.put("mail.smtp.socketFactory.port", String.valueOf(settings.getPort()));
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
        }

        props.put("mail.debug", "false");

        return mailSender;
    }
}
