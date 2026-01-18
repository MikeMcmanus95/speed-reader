package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	// AccessTokenDuration is the lifetime of an access token
	AccessTokenDuration = 15 * time.Minute

	// RefreshTokenDuration is the lifetime of a refresh token
	RefreshTokenDuration = 7 * 24 * time.Hour
)

// JWTClaims represents the claims in a JWT
type JWTClaims struct {
	UserID  string `json:"uid"`
	IsGuest bool   `json:"guest"`
	jwt.RegisteredClaims
}

// JWTManager handles JWT operations
type JWTManager struct {
	secret []byte
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(secret string) *JWTManager {
	return &JWTManager{secret: []byte(secret)}
}

// GenerateAccessToken generates a new access token for a user
func (m *JWTManager) GenerateAccessToken(user *User) (string, time.Time, error) {
	expiresAt := time.Now().Add(AccessTokenDuration)

	claims := &JWTClaims{
		UserID:  user.ID.String(),
		IsGuest: user.IsGuest,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to sign access token: %w", err)
	}

	return signedToken, expiresAt, nil
}

// ValidateAccessToken validates an access token and returns the claims
func (m *JWTManager) ValidateAccessToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// GetUserIDFromClaims extracts the user ID from JWT claims
func GetUserIDFromClaims(claims *JWTClaims) (uuid.UUID, error) {
	return uuid.Parse(claims.UserID)
}

// GenerateRefreshToken generates a secure random refresh token
func GenerateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate refresh token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}
