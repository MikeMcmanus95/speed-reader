package config

import (
	"os"
)

const (
	// MaxPasteSize is the maximum allowed paste size (1MB)
	MaxPasteSize = 1 * 1024 * 1024

	// ChunkSize is the number of tokens per chunk file
	ChunkSize = 5000
)

// Config holds the application configuration
type Config struct {
	Port        string
	DatabaseURL string
	StoragePath string
}

// Load reads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://speedreader:speedreader@localhost:5432/speedreader?sslmode=disable"),
		StoragePath: getEnv("STORAGE_PATH", "./data"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
