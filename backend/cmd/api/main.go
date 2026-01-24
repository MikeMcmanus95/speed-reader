package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/exp/slog"

	"github.com/joho/godotenv"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/config"
	"github.com/mikepersonal/speed-reader/backend/internal/database"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
	httpHandler "github.com/mikepersonal/speed-reader/backend/internal/http"
	"github.com/mikepersonal/speed-reader/backend/internal/logging"
	"github.com/mikepersonal/speed-reader/backend/internal/settings"
	"github.com/mikepersonal/speed-reader/backend/internal/sharing"
	"github.com/mikepersonal/speed-reader/backend/internal/storage"
	"github.com/mikepersonal/speed-reader/backend/internal/telemetry"
)

func main() {
	ctx := context.Background()

	// Load environment variables (ignore error - may not have .env file)
	_ = godotenv.Load()

	// Load configuration
	cfg := config.Load()

	// Initialize OpenTelemetry
	otelShutdown, err := telemetry.InitOTel(ctx, telemetry.Config{
		ServiceName:  cfg.ServiceName,
		Version:      cfg.Version,
		Environment:  cfg.Environment,
		NodeID:       cfg.NodeID,
		OTLPEndpoint: cfg.OTLPEndpoint,
		AxiomToken:   cfg.AxiomToken,
		AxiomDataset: cfg.AxiomDataset,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize telemetry: %v\n", err)
		os.Exit(1)
	}

	// Create structured logger
	logger := logging.NewLogger(logging.Config{
		Level:       cfg.LogLevel,
		ServiceName: cfg.ServiceName,
		Version:     cfg.Version,
		NodeID:      cfg.NodeID,
		Environment: cfg.Environment,
	})
	slog.SetDefault(logger)

	// Create PII sanitizer
	sanitizer := logging.NewSanitizer(cfg.LogSalt)

	logger.Info("starting application",
		slog.String("port", cfg.Port),
		slog.String("environment", cfg.Environment),
	)

	// Connect to database with retry logic
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		logger.Error("failed to open database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	// Verify database connection with retries
	maxRetries := 30
	retryInterval := 2 * time.Second
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := db.Ping(); err != nil {
			lastErr = err
			logger.Warn("failed to ping database, retrying...",
				slog.String("error", err.Error()),
				slog.Int("attempt", i+1),
				slog.Int("max_attempts", maxRetries),
			)
			time.Sleep(retryInterval)
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		logger.Error("failed to connect to database after retries", slog.String("error", lastErr.Error()))
		os.Exit(1)
	}
	logger.Info("connected to database")

	// Run database migrations
	logger.Info("running database migrations...")
	if err := database.RunMigrations(db); err != nil {
		logger.Error("failed to run migrations", slog.String("error", err.Error()))
		os.Exit(1)
	}
	logger.Info("database migrations complete")

	// Create storage directory if it doesn't exist
	if err := os.MkdirAll(cfg.StoragePath, 0755); err != nil {
		logger.Error("failed to create storage directory", slog.String("error", err.Error()))
		os.Exit(1)
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

	// Initialize settings service
	settingsRepo := settings.NewRepository(db)
	settingsService := settings.NewService(settingsRepo)

	// Create router with all dependencies
	router := httpHandler.NewRouter(&httpHandler.RouterDeps{
		DocService:      docService,
		AuthService:     authService,
		SharingService:  sharingService,
		SettingsService: settingsService,
		FrontendURL:     cfg.FrontendURL,
		SecureCookie:    cfg.SecureCookie,
		Logger:          logger,
		Sanitizer:       sanitizer,
	})

	// Setup graceful shutdown
	shutdownCh := make(chan os.Signal, 1)
	signal.Notify(shutdownCh, os.Interrupt, syscall.SIGTERM)

	// Start server in goroutine
	addr := fmt.Sprintf(":%s", cfg.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		logger.Info("server starting", slog.String("addr", addr))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	// Wait for shutdown signal
	<-shutdownCh
	logger.Info("shutting down...")

	// Graceful shutdown with timeout
	shutdownCtx, cancel := context.WithTimeout(ctx, 30*1000*1000*1000) // 30 seconds
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("server shutdown failed", slog.String("error", err.Error()))
	}

	// Shutdown telemetry
	if err := otelShutdown(shutdownCtx); err != nil {
		logger.Error("telemetry shutdown failed", slog.String("error", err.Error()))
	}

	logger.Info("shutdown complete")
}
