package logging

import (
	"strings"
	"testing"
)

func TestSanitizer_UserID(t *testing.T) {
	s := NewSanitizer("test-salt")

	tests := []struct {
		name     string
		input    string
		wantLen  int
		prefix   string
	}{
		{"empty", "", 0, ""},
		{"valid uuid", "550e8400-e29b-41d4-a716-446655440000", 13, "user_"},
		{"simple id", "12345", 13, "user_"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := s.UserID(tt.input)
			if tt.input == "" {
				if result != "" {
					t.Errorf("expected empty string for empty input, got %q", result)
				}
				return
			}
			if !strings.HasPrefix(result, tt.prefix) {
				t.Errorf("expected prefix %q, got %q", tt.prefix, result)
			}
			if len(result) != tt.wantLen {
				t.Errorf("expected length %d, got %d for %q", tt.wantLen, len(result), result)
			}
		})
	}

	// Test determinism: same input should produce same output
	result1 := s.UserID("test-user-123")
	result2 := s.UserID("test-user-123")
	if result1 != result2 {
		t.Errorf("expected deterministic output: %q != %q", result1, result2)
	}

	// Different inputs should produce different outputs
	different := s.UserID("different-user")
	if result1 == different {
		t.Error("different inputs should produce different outputs")
	}
}

func TestSanitizer_Email(t *testing.T) {
	s := NewSanitizer("test-salt")

	tests := []struct {
		name       string
		input      string
		wantDomain string
	}{
		{"empty", "", ""},
		{"valid email", "user@example.com", "example.com"},
		{"gmail", "test.user@gmail.com", "gmail.com"},
		{"no at sign", "invalid-email", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := s.Email(tt.input)
			if tt.input == "" {
				if result != "" {
					t.Errorf("expected empty string for empty input, got %q", result)
				}
				return
			}
			if tt.wantDomain != "" && !strings.HasSuffix(result, "@"+tt.wantDomain) {
				t.Errorf("expected domain %q, got %q", tt.wantDomain, result)
			}
			// Should not contain original local part
			if tt.wantDomain != "" && strings.Contains(result, "user") {
				t.Error("result should not contain original local part")
			}
		})
	}
}

func TestSanitizer_Filename(t *testing.T) {
	s := NewSanitizer("test-salt")

	tests := []struct {
		name    string
		input   string
		wantExt string
	}{
		{"empty", "", ""},
		{"with extension", "document.pdf", ".pdf"},
		{"multiple dots", "my.document.txt", ".txt"},
		{"no extension", "README", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := s.Filename(tt.input)
			if tt.input == "" {
				if result != "" {
					t.Errorf("expected empty for empty input, got %q", result)
				}
				return
			}
			if !strings.HasPrefix(result, "file_") {
				t.Errorf("expected prefix file_, got %q", result)
			}
			if tt.wantExt != "" && !strings.HasSuffix(result, tt.wantExt) {
				t.Errorf("expected extension %q, got %q", tt.wantExt, result)
			}
		})
	}
}

func TestSanitizer_IPAddress(t *testing.T) {
	s := NewSanitizer("test-salt")

	tests := []struct {
		name   string
		input  string
		want   string
	}{
		{"empty", "", ""},
		{"ipv4", "192.168.1.100", "192.168.x.x"},
		{"ipv4 public", "8.8.8.8", "8.8.x.x"},
		{"ipv6", "2001:0db8:85a3:0000:0000:8a2e:0370:7334", "2001:0db8::x"},
		{"ipv6 short", "::1", "1::x"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := s.IPAddress(tt.input)
			if result != tt.want {
				t.Errorf("expected %q, got %q", tt.want, result)
			}
		})
	}
}

func TestSanitizer_FormField(t *testing.T) {
	s := NewSanitizer("test-salt")

	tests := []struct {
		name      string
		fieldName string
		value     string
		redacted  bool
	}{
		{"empty value", "username", "", false},
		{"password field", "password", "secret123", true},
		{"password in name", "user_password", "secret123", true},
		{"token field", "auth_token", "abc123", true},
		{"api key", "api_key", "xyz789", true},
		{"normal field", "username", "john", false},
		{"email field", "email", "user@example.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := s.FormField(tt.fieldName, tt.value)
			if tt.value == "" {
				if result != "" {
					t.Errorf("expected empty for empty value, got %q", result)
				}
				return
			}
			if tt.redacted {
				if result != "[REDACTED]" {
					t.Errorf("expected [REDACTED], got %q", result)
				}
			} else {
				if result == "[REDACTED]" {
					t.Errorf("expected non-redacted value for %q", tt.fieldName)
				}
				if result == tt.value {
					t.Errorf("expected pseudonymized value, got original %q", result)
				}
			}
		})
	}
}

func TestSanitizer_DocumentTitle(t *testing.T) {
	s := NewSanitizer("test-salt")

	tests := []struct {
		name     string
		input    string
		want     string
		truncate bool
	}{
		{"empty", "", "", false},
		{"short title", "My Document", "My Document", false},
		{"exactly 50", strings.Repeat("a", 50), strings.Repeat("a", 50), false},
		{"long title", strings.Repeat("a", 60), strings.Repeat("a", 47) + "...", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := s.DocumentTitle(tt.input)
			if result != tt.want {
				t.Errorf("expected %q, got %q", tt.want, result)
			}
		})
	}
}

func TestSanitizer_Determinism(t *testing.T) {
	s1 := NewSanitizer("same-salt")
	s2 := NewSanitizer("same-salt")
	s3 := NewSanitizer("different-salt")

	input := "test-input-123"

	// Same salt should produce same output
	if s1.UserID(input) != s2.UserID(input) {
		t.Error("same salt should produce deterministic output")
	}

	// Different salt should produce different output
	if s1.UserID(input) == s3.UserID(input) {
		t.Error("different salt should produce different output")
	}
}
