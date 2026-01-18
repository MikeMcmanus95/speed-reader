package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"

	"github.com/joho/godotenv"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/config"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
	httpHandler "github.com/mikepersonal/speed-reader/backend/internal/http"
	"github.com/mikepersonal/speed-reader/backend/internal/sharing"
	"github.com/mikepersonal/speed-reader/backend/internal/storage"
)

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	// Load configuration
	cfg := config.Load()

	// Connect to database
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Verify database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to database")

	// Create storage directory if it doesn't exist
	if err := os.MkdirAll(cfg.StoragePath, 0755); err != nil {
		log.Fatalf("Failed to create storage directory: %v", err)
	}

	// Initialize auth services
	authRepo := auth.NewRepository(db)
	jwtManager := auth.NewJWTManager(cfg.JWTSecret)
	csrfManager := auth.NewCSRFManager(cfg.CSRFSecret)
	googleOAuth := auth.NewGoogleOAuth(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURL)
	authService := auth.NewService(authRepo, jwtManager, csrfManager, googleOAuth)

	// Initialize document services
	chunkStore := storage.NewChunkStore(cfg.StoragePath)
	docRepo := documents.NewRepository(db)
	docService := documents.NewService(docRepo, chunkStore, cfg.GuestDocTTLDays)

	// Initialize sharing service
	sharingService := sharing.NewService(db, cfg.FrontendURL)

	// Create router with all dependencies
	router := httpHandler.NewRouter(&httpHandler.RouterDeps{
		DocService:     docService,
		AuthService:    authService,
		SharingService: sharingService,
		FrontendURL:    cfg.FrontendURL,
		SecureCookie:   cfg.SecureCookie,
	})

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
