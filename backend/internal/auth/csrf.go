package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"
)

const (
	// CSRFTokenDuration is the lifetime of a CSRF token
	CSRFTokenDuration = 1 * time.Hour
)

// CSRFManager handles CSRF token operations
type CSRFManager struct {
	secret []byte
}

// NewCSRFManager creates a new CSRF manager
func NewCSRFManager(secret string) *CSRFManager {
	return &CSRFManager{secret: []byte(secret)}
}

// GenerateToken generates a new CSRF token
func (m *CSRFManager) GenerateToken() (string, error) {
	// Generate random bytes
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// Create timestamp (for optional expiration checking)
	timestamp := time.Now().Unix()
	message := append(randomBytes, byte(timestamp>>56), byte(timestamp>>48), byte(timestamp>>40), byte(timestamp>>32),
		byte(timestamp>>24), byte(timestamp>>16), byte(timestamp>>8), byte(timestamp))

	// Create HMAC signature
	mac := hmac.New(sha256.New, m.secret)
	mac.Write(message)
	signature := mac.Sum(nil)

	// Combine message and signature
	token := append(message, signature...)
	return base64.URLEncoding.EncodeToString(token), nil
}

// ValidateToken validates a CSRF token
func (m *CSRFManager) ValidateToken(tokenString string) bool {
	token, err := base64.URLEncoding.DecodeString(tokenString)
	if err != nil {
		return false
	}

	// Token must be at least 40 bytes (32 random + 8 timestamp) + 32 bytes signature
	if len(token) < 72 {
		return false
	}

	// Split message and signature
	message := token[:40]
	providedSignature := token[40:]

	// Verify signature
	mac := hmac.New(sha256.New, m.secret)
	mac.Write(message)
	expectedSignature := mac.Sum(nil)

	if !hmac.Equal(providedSignature, expectedSignature) {
		return false
	}

	// Optionally check expiration (extract timestamp from message)
	timestamp := int64(message[32])<<56 | int64(message[33])<<48 | int64(message[34])<<40 | int64(message[35])<<32 |
		int64(message[36])<<24 | int64(message[37])<<16 | int64(message[38])<<8 | int64(message[39])

	if time.Unix(timestamp, 0).Add(CSRFTokenDuration).Before(time.Now()) {
		return false
	}

	return true
}
