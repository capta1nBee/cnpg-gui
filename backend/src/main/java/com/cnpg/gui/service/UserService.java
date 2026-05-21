package com.cnpg.gui.service;

import com.cnpg.gui.domain.User;
import com.cnpg.gui.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public User createUser(User user) {
        if (user.getPassword() != null) {
            user.setPasswordHash(passwordEncoder.encode(user.getPassword()));
        } else if (user.getPasswordHash() != null) {
            user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        }
        
        User savedUser = userRepository.save(user);
        
        if (savedUser.getEmail() != null && !savedUser.getEmail().isBlank()) {
            emailService.sendInvitationEmail(savedUser.getEmail(), savedUser.getUsername(), savedUser.getRole());
        }
        
        return savedUser;
    }


    public void updateLastLogin(User user) {
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);
    }

    public void deleteUser(UUID id) {
        userRepository.deleteById(id);
    }

    public User toggleUserStatus(UUID id) {
        return userRepository.findById(id).map(user -> {
            String newStatus = "active".equalsIgnoreCase(user.getStatus()) ? "disabled" : "active";
            user.setStatus(newStatus);
            return userRepository.save(user);
        }).orElseThrow(() -> new RuntimeException("User not found"));
    }
}

