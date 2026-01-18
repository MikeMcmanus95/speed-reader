package config

import (
	"os"
	"strconv"
)

const (
	// MaxGuestPasteSize is the maximum allowed paste size for guest users (1MB)
	MaxGuestPasteSize = 1 * 1024 * 1024

	// MaxAuthPasteSize is the maximum allowed paste size for authenticated users (10MB)
	MaxAuthPasteSize = 10 * 1024 * 1024

	// MaxPasteSize is kept for backward compatibility (same as guest limit)
	// Deprecated: Use MaxGuestPasteSize or MaxAuthPasteSize instead
	MaxPasteSize = MaxGuestPasteSize

	// ChunkSize is the number of tokens per chunk file
	ChunkSize = 5000

	// DefaultGuestDocTTLDays is the default TTL for guest documents
	DefaultGuestDocTTLDays = 30
)

// Config holds the application configuration
type Config struct {
	Port        string
	DatabaseURL string
	StoragePath string

	// Auth configuration
	JWTSecret          string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	CSRFSecret         string
	FrontendURL        string
	GuestDocTTLDays    int
	SecureCookie       bool
}

// Load reads configuration from environment variables
func Load() *Config {
	guestTTL, _ := strconv.Atoi(getEnv("GUEST_DOC_TTL_DAYS", "30"))
	if guestTTL <= 0 {
		guestTTL = DefaultGuestDocTTLDays
	}

	secureCookie := getEnv("SECURE_COOKIE", "false") == "true"

	return &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://speedreader:speedreader@localhost:5432/speedreader?sslmode=disable"),
		StoragePath:        getEnv("STORAGE_PATH", "./data"),
		JWTSecret:          getEnv("JWT_SECRET", "dev-jwt-secret-change-in-production"),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/google/callback"),
		CSRFSecret:         getEnv("CSRF_SECRET", "dev-csrf-secret-change-in-production"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:5173"),
		GuestDocTTLDays:    guestTTL,
		SecureCookie:       secureCookie,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
