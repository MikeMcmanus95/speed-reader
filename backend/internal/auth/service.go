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

// CreateGuestUser creates a new guest user and returns auth tokens
func (s *Service) CreateGuestUser(ctx context.Context) (*AuthResponse, string, error) {
	// Generate a guest name
	guestName := generateGuestName()

	user, err := s.repo.CreateGuestUser(ctx, &CreateGuestUserParams{
		Name: guestName,
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to create guest user: %w", err)
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

// GetGoogleAuthURL returns the Google OAuth URL
func (s *Service) GetGoogleAuthURL(guestUserID *uuid.UUID) string {
	// Encode guest user ID in state for merge after OAuth
	state := generateState()
	if guestUserID != nil {
		state = guestUserID.String() + ":" + state
	}
	return s.googleOAuth.GetAuthURL(state)
}

// HandleGoogleCallback processes the Google OAuth callback
func (s *Service) HandleGoogleCallback(ctx context.Context, code string, state string) (*AuthResponse, string, error) {
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

	// Parse guest user ID from state (if present)
	var guestUserID *uuid.UUID
	if len(state) > 37 && state[36] == ':' {
		if id, err := uuid.Parse(state[:36]); err == nil {
			guestUserID = &id
		}
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
	} else if guestUserID != nil {
		// Merge guest user to OAuth user
		user, err = s.repo.MergeGuestToOAuth(ctx, *guestUserID, googleUser.ToCreateOAuthUserParams())
		if err != nil {
			// If merge fails (guest doesn't exist), create new user
			user, err = s.repo.CreateOrUpdateOAuthUser(ctx, googleUser.ToCreateOAuthUserParams())
			if err != nil {
				return nil, "", fmt.Errorf("failed to create OAuth user: %w", err)
			}
		}
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

	// If there was a guest user and we merged or created a different user,
	// delete the old guest user's refresh tokens
	if guestUserID != nil && user.ID != *guestUserID {
		_ = s.repo.DeleteUserRefreshTokens(ctx, *guestUserID)
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

// generateGuestName generates a random guest name
func generateGuestName() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return fmt.Sprintf("Guest-%s", base64.URLEncoding.EncodeToString(bytes)[:6])
}

// generateState generates a random state string for OAuth
func generateState() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return base64.URLEncoding.EncodeToString(bytes)
}
