package documents

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/config"
	"github.com/mikepersonal/speed-reader/backend/internal/storage"
	"github.com/mikepersonal/speed-reader/backend/internal/tokenizer"
)

// Service orchestrates document operations
type Service struct {
	repo       *Repository
	chunkStore *storage.ChunkStore
}

// NewService creates a new document service
func NewService(repo *Repository, chunkStore *storage.ChunkStore) *Service {
	return &Service{
		repo:       repo,
		chunkStore: chunkStore,
	}
}

// CreateDocument creates a new document and processes its content
func (s *Service) CreateDocument(ctx context.Context, title, content string) (*Document, error) {
	// Create document record
	doc, err := s.repo.Create(ctx, title)
	if err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	// Update status to processing
	if err := s.repo.UpdateStatus(ctx, doc.ID, StatusProcessing, 0, 0); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	// Tokenize content
	tokens := tokenizer.Tokenize(content)
	tokenCount := len(tokens)

	// Write tokens to chunks
	chunkCount := 0
	for i := 0; i < tokenCount; i += config.ChunkSize {
		end := i + config.ChunkSize
		if end > tokenCount {
			end = tokenCount
		}

		if err := s.chunkStore.WriteChunk(doc.ID.String(), chunkCount, tokens[i:end]); err != nil {
			// Update status to error
			_ = s.repo.UpdateStatus(ctx, doc.ID, StatusError, 0, 0)
			return nil, fmt.Errorf("failed to write chunk %d: %w", chunkCount, err)
		}
		chunkCount++
	}

	// Update document with final status and counts
	if err := s.repo.UpdateStatus(ctx, doc.ID, StatusReady, tokenCount, chunkCount); err != nil {
		return nil, fmt.Errorf("failed to update document status: %w", err)
	}

	doc.Status = StatusReady
	doc.TokenCount = tokenCount
	doc.ChunkCount = chunkCount

	return doc, nil
}

// GetDocument retrieves a document by ID
func (s *Service) GetDocument(ctx context.Context, id uuid.UUID) (*Document, error) {
	return s.repo.GetByID(ctx, id)
}

// GetTokens retrieves tokens for a specific chunk
func (s *Service) GetTokens(ctx context.Context, docID uuid.UUID, chunkIndex int) (*storage.Chunk, error) {
	// Verify document exists
	doc, err := s.repo.GetByID(ctx, docID)
	if err != nil {
		return nil, err
	}

	if chunkIndex < 0 || chunkIndex >= doc.ChunkCount {
		return nil, fmt.Errorf("chunk index out of range: %d (max: %d)", chunkIndex, doc.ChunkCount-1)
	}

	return s.chunkStore.ReadChunk(docID.String(), chunkIndex)
}

// GetReadingState retrieves reading state for a document
func (s *Service) GetReadingState(ctx context.Context, docID uuid.UUID) (*ReadingState, error) {
	// Verify document exists
	if _, err := s.repo.GetByID(ctx, docID); err != nil {
		return nil, err
	}

	return s.repo.GetReadingState(ctx, docID)
}

// UpdateReadingState updates reading state for a document
func (s *Service) UpdateReadingState(ctx context.Context, state *ReadingState) error {
	// Verify document exists
	if _, err := s.repo.GetByID(ctx, state.DocID); err != nil {
		return err
	}

	return s.repo.UpsertReadingState(ctx, state)
}

// DeleteDocument removes a document and its chunks
func (s *Service) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	// Delete from database first
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	// Delete chunk files
	return s.chunkStore.DeleteDocument(id.String())
}
