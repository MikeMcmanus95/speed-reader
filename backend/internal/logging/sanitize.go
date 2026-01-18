package logging

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"
)

// Sanitizer provides methods for pseudonymizing PII in logs.
// Uses HMAC-SHA256 for deterministic but irreversible pseudonymization.
type Sanitizer struct {
	salt []byte
}

// NewSanitizer creates a new Sanitizer with the given salt.
// The salt should be a secret value that remains constant across deployments
// to ensure consistent pseudonymization.
func NewSanitizer(salt string) *Sanitizer {
	return &Sanitizer{salt: []byte(salt)}
}

// UserID pseudonymizes a user ID, returning a shortened hash.
// Output format: "user_<8-char-hash>"
func (s *Sanitizer) UserID(id string) string {
	if id == "" {
		return ""
	}
	return "user_" + s.hash(id)[:8]
}

// Email pseudonymizes an email, preserving the domain for debugging.
// Output format: "<8-char-hash>@domain.com"
func (s *Sanitizer) Email(email string) string {
	if email == "" {
		return ""
	}
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return s.hash(email)[:8]
	}
	return s.hash(parts[0])[:8] + "@" + parts[1]
}

// Filename pseudonymizes a filename, preserving the extension for debugging.
// Output format: "file_<8-char-hash>.ext"
func (s *Sanitizer) Filename(filename string) string {
	if filename == "" {
		return ""
	}
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	return "file_" + s.hash(base)[:8] + ext
}

// IPAddress masks an IP address, preserving network prefix for geographic debugging.
// IPv4: "192.168.x.x", IPv6: first 2 non-empty segments + "::x"
func (s *Sanitizer) IPAddress(ip string) string {
	if ip == "" {
		return ""
	}

	// Handle IPv6
	if strings.Contains(ip, ":") {
		parts := strings.Split(ip, ":")
		// Filter out empty parts and get first two non-empty segments
		var nonEmpty []string
		for _, p := range parts {
			if p != "" {
				nonEmpty = append(nonEmpty, p)
			}
		}
		if len(nonEmpty) >= 2 {
			return nonEmpty[0] + ":" + nonEmpty[1] + "::x"
		} else if len(nonEmpty) == 1 {
			return nonEmpty[0] + "::x"
		}
		return "::x"
	}

	// Handle IPv4
	parts := strings.Split(ip, ".")
	if len(parts) >= 2 {
		return parts[0] + "." + parts[1] + ".x.x"
	}
	return "x.x.x.x"
}

// FormField redacts or pseudonymizes form field values based on field name.
// Sensitive fields (password, token, secret, key, etc.) are fully redacted.
// Other fields are pseudonymized.
func (s *Sanitizer) FormField(fieldName, value string) string {
	if value == "" {
		return ""
	}

	lower := strings.ToLower(fieldName)
	sensitivePatterns := []string{
		"password", "passwd", "secret", "token", "key", "auth",
		"credential", "credit", "card", "cvv", "ssn", "social",
	}

	for _, pattern := range sensitivePatterns {
		if strings.Contains(lower, pattern) {
			return "[REDACTED]"
		}
	}

	return s.hash(value)[:8]
}

// DocumentTitle sanitizes a document title, truncating and hashing if too long.
// Titles under 50 chars are returned as-is (they're user-created content, not PII).
func (s *Sanitizer) DocumentTitle(title string) string {
	if title == "" {
		return ""
	}
	if len(title) <= 50 {
		return title
	}
	return title[:47] + "..."
}

// hash returns the HMAC-SHA256 hash of the input as a hex string
func (s *Sanitizer) hash(input string) string {
	h := hmac.New(sha256.New, s.salt)
	h.Write([]byte(input))
	return hex.EncodeToString(h.Sum(nil))
}
