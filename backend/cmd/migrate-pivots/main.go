package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mikepersonal/speed-reader/backend/internal/config"
	"github.com/mikepersonal/speed-reader/backend/internal/storage"
	"github.com/mikepersonal/speed-reader/backend/internal/tokenizer"
)

type migrationStats struct {
	docsProcessed   int64
	chunksProcessed int64
	tokensUpdated   int64
	errors          int64
}

func main() {
	// Parse command line flags
	dryRun := flag.Bool("dry-run", true, "Run in dry-run mode (don't write changes)")
	storagePath := flag.String("storage-path", "", "Path to storage directory (default: from config)")
	workers := flag.Int("workers", 4, "Number of parallel workers")
	flag.Parse()

	log.Println("Pivot Migration Tool")
	log.Println("====================")

	// Load configuration
	cfg := config.Load()
	if *storagePath == "" {
		*storagePath = cfg.StoragePath
	}

	log.Printf("Storage Path: %s", *storagePath)
	log.Printf("Dry Run: %v", *dryRun)
	log.Printf("Workers: %d", *workers)
	log.Println()

	// Discover all document directories
	docDirs, err := discoverDocuments(*storagePath)
	if err != nil {
		log.Fatalf("Failed to discover documents: %v", err)
	}

	if len(docDirs) == 0 {
		log.Println("No documents found to migrate.")
		return
	}

	// Deduplicate document directories (defensive - shouldn't have duplicates from filesystem)
	docDirs = deduplicatePaths(docDirs)

	log.Printf("Found %d documents to migrate", len(docDirs))
	log.Println()

	// Create chunk store
	chunkStore := storage.NewChunkStore(*storagePath)

	// Process documents with worker pool
	stats := &migrationStats{}
	startTime := time.Now()

	workChan := make(chan string, len(docDirs))
	var wg sync.WaitGroup

	// Start workers
	for i := 0; i < *workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for docDir := range workChan {
				docID := strings.TrimPrefix(filepath.Base(docDir), "doc_")
				if err := migrateDocument(chunkStore, docDir, docID, *dryRun, stats); err != nil {
					log.Printf("Error migrating doc %s: %v", docID, err)
					atomic.AddInt64(&stats.errors, 1)
				}
			}
		}()
	}

	// Send work
	for _, docDir := range docDirs {
		workChan <- docDir
	}
	close(workChan)

	// Wait for completion
	wg.Wait()

	// Print summary
	duration := time.Since(startTime)
	log.Println()
	log.Println("Migration Summary")
	log.Println("=================")
	log.Printf("Documents Processed: %d", stats.docsProcessed)
	log.Printf("Chunks Processed: %d", stats.chunksProcessed)
	log.Printf("Tokens Updated: %d", stats.tokensUpdated)
	log.Printf("Errors: %d", stats.errors)
	log.Printf("Duration: %v", duration)

	if *dryRun {
		log.Println()
		log.Println("This was a dry run. No files were modified.")
		log.Println("Run with --dry-run=false to apply changes.")
	} else {
		log.Println()
		log.Println("Migration complete!")
	}
}

// discoverDocuments finds all doc_* directories in the storage path
func discoverDocuments(storagePath string) ([]string, error) {
	var docDirs []string

	entries, err := os.ReadDir(storagePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read storage directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), "doc_") {
			docDirs = append(docDirs, filepath.Join(storagePath, entry.Name()))
		}
	}

	return docDirs, nil
}

// deduplicatePaths removes duplicate paths from a slice (defensive measure)
func deduplicatePaths(paths []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(paths))
	for _, p := range paths {
		if !seen[p] {
			seen[p] = true
			result = append(result, p)
		}
	}
	return result
}

// migrateDocument processes all chunks for a single document.
// Thread safety: Each goroutine processes a unique docID, so file operations don't overlap.
// The stats struct fields are updated atomically. Local variables (docTokensUpdated, tokensUpdated)
// are goroutine-local and don't require synchronization.
func migrateDocument(chunkStore *storage.ChunkStore, docDir, docID string, dryRun bool, stats *migrationStats) error {
	// Find all chunk files
	entries, err := os.ReadDir(docDir)
	if err != nil {
		return fmt.Errorf("failed to read doc directory: %w", err)
	}

	var chunkFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "chunk_") && strings.HasSuffix(entry.Name(), ".json") {
			chunkFiles = append(chunkFiles, entry.Name())
		}
	}

	if len(chunkFiles) == 0 {
		return nil
	}

	docTokensUpdated := int64(0)

	for _, chunkFile := range chunkFiles {
		// Parse chunk index from filename
		var chunkIndex int
		_, err := fmt.Sscanf(chunkFile, "chunk_%d.json", &chunkIndex)
		if err != nil {
			log.Printf("Warning: could not parse chunk index from %s: %v", chunkFile, err)
			continue
		}

		// Read chunk
		chunk, err := chunkStore.ReadChunk(docID, chunkIndex)
		if err != nil {
			return fmt.Errorf("failed to read chunk %d: %w", chunkIndex, err)
		}

		// Update pivots
		tokensUpdated := int64(0)
		for i := range chunk.Tokens {
			strippedWord := tokenizer.StripPunctuation(chunk.Tokens[i].Text)
			newPivot := tokenizer.CalculatePivot(strippedWord)
			if chunk.Tokens[i].Pivot != newPivot {
				chunk.Tokens[i].Pivot = newPivot
				tokensUpdated++
			}
		}

		// Write chunk if not dry run and tokens were updated
		if !dryRun && tokensUpdated > 0 {
			if err := chunkStore.WriteChunk(docID, chunkIndex, chunk.Tokens); err != nil {
				return fmt.Errorf("failed to write chunk %d: %w", chunkIndex, err)
			}
		}

		docTokensUpdated += tokensUpdated
		atomic.AddInt64(&stats.chunksProcessed, 1)
	}

	atomic.AddInt64(&stats.docsProcessed, 1)
	atomic.AddInt64(&stats.tokensUpdated, docTokensUpdated)

	if docTokensUpdated > 0 {
		log.Printf("[%s] %d chunks, %d tokens updated", docID, len(chunkFiles), docTokensUpdated)
	}

	return nil
}
