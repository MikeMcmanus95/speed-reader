package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Service orchestrates authentication operations
type Service struct {
	repo        *Repository
	jwtManager  *JWTManager
	csrfManager *CSRFManager
	googleOAuth *GoogleOAuth
}

// NewService creates a new auth service
func NewService(repo *Repository, jwtManager *JWTManager, csrfManager *CSRFManager, googleOAuth *GoogleOAuth) *Service {
	return &Service{
		repo:        repo,
		jwtManager:  jwtManager,
		csrfManager: csrfManager,
		googleOAuth: googleOAuth,
	}
}

// GetGoogleAuthURL returns the Google OAuth URL
func (s *Service) GetGoogleAuthURL() string {
	state := generateState()
	return s.googleOAuth.GetAuthURL(state)
}

// HandleGoogleCallback processes the Google OAuth callback
func (s *Service) HandleGoogleCallback(ctx context.Context, code string) (*AuthResponse, string, error) {
	// Exchange code for tokens
	oauthToken, err := s.googleOAuth.ExchangeCode(ctx, code)
	if err != nil {
		return nil, "", fmt.Errorf("failed to exchange code: %w", err)
	}

	// Get user info from Google
	googleUser, err := s.googleOAuth.GetUserInfo(ctx, oauthToken)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get user info: %w", err)
	}

	var user *User

	// Check if user already exists with this Google ID
	existingUser, err := s.repo.GetUserByGoogleID(ctx, googleUser.ID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to check existing user: %w", err)
	}

	if existingUser != nil {
		// User exists, update info if needed
		user = existingUser
	} else {
		// Create new OAuth user
		user, err = s.repo.CreateOrUpdateOAuthUser(ctx, googleUser.ToCreateOAuthUserParams())
		if err != nil {
			return nil, "", fmt.Errorf("failed to create OAuth user: %w", err)
		}
	}

	// Generate tokens
	accessToken, expiresAt, err := s.jwtManager.GenerateAccessToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token
	refreshExpiresAt := time.Now().Add(RefreshTokenDuration)
	if err := s.repo.StoreRefreshToken(ctx, refreshToken, user.ID, refreshExpiresAt); err != nil {
		return nil, "", fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &AuthResponse{
		User:      user,
		Token:     accessToken,
		ExpiresAt: expiresAt,
	}, refreshToken, nil
}

// RefreshAccessToken refreshes the access token using a refresh token
func (s *Service) RefreshAccessToken(ctx context.Context, refreshTokenStr string) (*AuthResponse, string, error) {
	// Validate refresh token
	storedToken, err := s.repo.GetRefreshToken(ctx, refreshTokenStr)
	if err != nil {
		return nil, "", fmt.Errorf("invalid refresh token: %w", err)
	}

	// Check expiration
	if storedToken.ExpiresAt.Before(time.Now()) {
		_ = s.repo.DeleteRefreshToken(ctx, refreshTokenStr)
		return nil, "", fmt.Errorf("refresh token expired")
	}

	// Get user
	user, err := s.repo.GetUserByID(ctx, storedToken.UserID)
	if err != nil {
		return nil, "", fmt.Errorf("user not found: %w", err)
	}

	// Generate new access token
	accessToken, expiresAt, err := s.jwtManager.GenerateAccessToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// Rotate refresh token
	_ = s.repo.DeleteRefreshToken(ctx, refreshTokenStr)
	newRefreshToken, err := GenerateRefreshToken()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate new refresh token: %w", err)
	}

	refreshExpiresAt := time.Now().Add(RefreshTokenDuration)
	if err := s.repo.StoreRefreshToken(ctx, newRefreshToken, user.ID, refreshExpiresAt); err != nil {
		return nil, "", fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &AuthResponse{
		User:      user,
		Token:     accessToken,
		ExpiresAt: expiresAt,
	}, newRefreshToken, nil
}

// Logout invalidates all refresh tokens for a user
func (s *Service) Logout(ctx context.Context, userID uuid.UUID) error {
	return s.repo.DeleteUserRefreshTokens(ctx, userID)
}

// GetCurrentUser retrieves the current user from a user ID
func (s *Service) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*User, error) {
	return s.repo.GetUserByID(ctx, userID)
}

// ValidateAccessToken validates an access token and returns claims
func (s *Service) ValidateAccessToken(tokenString string) (*JWTClaims, error) {
	return s.jwtManager.ValidateAccessToken(tokenString)
}

// GenerateCSRFToken generates a new CSRF token
func (s *Service) GenerateCSRFToken() (string, error) {
	return s.csrfManager.GenerateToken()
}

// ValidateCSRFToken validates a CSRF token
func (s *Service) ValidateCSRFToken(token string) bool {
	return s.csrfManager.ValidateToken(token)
}

// generateState generates a random state string for OAuth
func generateState() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return base64.URLEncoding.EncodeToString(bytes)
}

// GetExtensionGoogleAuthURL returns the Google OAuth URL for Chrome extensions
func (s *Service) GetExtensionGoogleAuthURL(extensionID string) string {
	// Encode extension ID in state
	// Format: ext:<extension_id>:<random_state>
	state := "ext:" + extensionID + ":" + generateState()
	return s.googleOAuth.GetExtensionAuthURL(state)
}

// HandleExtensionGoogleCallback processes the Google OAuth callback for Chrome extensions
// Returns auth response, refresh token, extension ID, and any error
func (s *Service) HandleExtensionGoogleCallback(ctx context.Context, code string, state string) (*AuthResponse, string, string, error) {
	// Parse state to extract extension ID
	// Format: ext:<extension_id>:<random_state>
	if len(state) < 4 || state[:4] != "ext:" {
		return nil, "", "", fmt.Errorf("invalid state format")
	}

	parts := splitState(state[4:])
	if len(parts) < 2 {
		return nil, "", "", fmt.Errorf("invalid state format: missing extension_id")
	}

	extensionID := parts[0]

	// Exchange code for tokens using extension-specific redirect URL
	oauthToken, err := s.googleOAuth.ExchangeCodeForExtension(ctx, code)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to exchange code: %w", err)
	}

	// Get user info from Google
	googleUser, err := s.googleOAuth.GetUserInfo(ctx, oauthToken)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to get user info: %w", err)
	}

	var user *User

	// Check if user already exists with this Google ID
	existingUser, err := s.repo.GetUserByGoogleID(ctx, googleUser.ID)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to check existing user: %w", err)
	}

	if existingUser != nil {
		// User exists, update info if needed
		user = existingUser
	} else {
		// Create new OAuth user
		user, err = s.repo.CreateOrUpdateOAuthUser(ctx, googleUser.ToCreateOAuthUserParams())
		if err != nil {
			return nil, "", "", fmt.Errorf("failed to create OAuth user: %w", err)
		}
	}

	// Generate tokens
	accessToken, expiresAt, err := s.jwtManager.GenerateAccessToken(user)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token
	refreshExpiresAt := time.Now().Add(RefreshTokenDuration)
	if err := s.repo.StoreRefreshToken(ctx, refreshToken, user.ID, refreshExpiresAt); err != nil {
		return nil, "", "", fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &AuthResponse{
		User:      user,
		Token:     accessToken,
		ExpiresAt: expiresAt,
	}, refreshToken, extensionID, nil
}

// splitState splits the state string by colons
func splitState(state string) []string {
	var parts []string
	var current string
	for _, c := range state {
		if c == ':' {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}
