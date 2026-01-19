package main

import (
	"context"
	"database/sql"
	"log"
	"time"

	_ "github.com/lib/pq"

	"github.com/mikepersonal/speed-reader/backend/internal/config"
	"github.com/mikepersonal/speed-reader/backend/internal/documents"
	"github.com/mikepersonal/speed-reader/backend/internal/storage"
)

func main() {
	log.Println("Starting document cleanup job...")
	startTime := time.Now()

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

	// Initialize services
	chunkStore := storage.NewChunkStore(cfg.StoragePath)
	docRepo := documents.NewRepository(db)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Delete expired documents from database
	deletedIDs, err := docRepo.DeleteExpiredGuestDocuments(ctx)
	if err != nil {
		log.Fatalf("Failed to delete expired documents: %v", err)
	}

	log.Printf("Deleted %d expired documents from database", len(deletedIDs))

	// Delete chunk files for each deleted document
	var chunkDeleteErrors int
	for _, id := range deletedIDs {
		if err := chunkStore.DeleteDocument(id); err != nil {
			log.Printf("Warning: failed to delete chunks for document %s: %v", id, err)
			chunkDeleteErrors++
		}
	}

	duration := time.Since(startTime)
	log.Printf("Cleanup completed in %v", duration)
	log.Printf("Summary: %d documents deleted, %d chunk deletion errors", len(deletedIDs), chunkDeleteErrors)
}
