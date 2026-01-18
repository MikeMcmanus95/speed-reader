package documents

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"github.com/mikepersonal/speed-reader/backend/internal/config"
	"github.com/mikepersonal/speed-reader/backend/internal/storage"
	"github.com/mikepersonal/speed-reader/backend/internal/tokenizer"
)

// Service orchestrates document operations
type Service struct {
	repo            *Repository
	chunkStore      *storage.ChunkStore
	guestDocTTLDays int
}

// NewService creates a new document service
func NewService(repo *Repository, chunkStore *storage.ChunkStore, guestDocTTLDays int) *Service {
	return &Service{
		repo:            repo,
		chunkStore:      chunkStore,
		guestDocTTLDays: guestDocTTLDays,
	}
}

// CreateDocument creates a new document and processes its content
func (s *Service) CreateDocument(ctx context.Context, title, content string) (*Document, error) {
	// Get user from context
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("user not found in context")
	}

	// Set expiration for guest documents
	var expiresAt *time.Time
	if user.IsGuest {
		t := time.Now().AddDate(0, 0, s.guestDocTTLDays)
		expiresAt = &t
	}

	// Create document record
	doc, err := s.repo.Create(ctx, &CreateParams{
		Title:     title,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	})
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

// GetDocument retrieves a document by ID with access control
func (s *Service) GetDocument(ctx context.Context, id uuid.UUID) (*Document, error) {
	doc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check access
	if err := s.checkAccess(ctx, doc); err != nil {
		return nil, err
	}

	return doc, nil
}

// GetTokens retrieves tokens for a specific chunk
func (s *Service) GetTokens(ctx context.Context, docID uuid.UUID, chunkIndex int) (*storage.Chunk, error) {
	// Verify document exists and user has access
	doc, err := s.GetDocument(ctx, docID)
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
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("user not found in context")
	}

	// Verify document exists and user has access
	if _, err := s.GetDocument(ctx, docID); err != nil {
		return nil, err
	}

	return s.repo.GetReadingState(ctx, user.ID, docID)
}

// UpdateReadingState updates reading state for a document
func (s *Service) UpdateReadingState(ctx context.Context, state *ReadingState) error {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return fmt.Errorf("user not found in context")
	}

	// Verify document exists and user has access
	if _, err := s.GetDocument(ctx, state.DocID); err != nil {
		return err
	}

	state.UserID = user.ID
	return s.repo.UpsertReadingState(ctx, state)
}

// DeleteDocument removes a document and its chunks
func (s *Service) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return fmt.Errorf("user not found in context")
	}

	// Delete from database first (checks ownership)
	if err := s.repo.Delete(ctx, id, user.ID); err != nil {
		return err
	}

	// Delete chunk files
	return s.chunkStore.DeleteDocument(id.String())
}

// ListDocuments retrieves all documents for the current user with their reading progress
func (s *Service) ListDocuments(ctx context.Context) ([]DocumentWithProgress, error) {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("user not found in context")
	}

	return s.repo.List(ctx, user.ID)
}

// UpdateDocumentTitle updates the title of a document
func (s *Service) UpdateDocumentTitle(ctx context.Context, id uuid.UUID, title string) error {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return fmt.Errorf("user not found in context")
	}

	return s.repo.UpdateTitle(ctx, id, user.ID, title)
}

// checkAccess verifies the user has access to a document
func (s *Service) checkAccess(ctx context.Context, doc *Document) error {
	// Public documents are accessible to everyone
	if doc.Visibility == VisibilityPublic {
		return nil
	}

	// Get user from context
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return fmt.Errorf("access denied: not authenticated")
	}

	// Check ownership
	if doc.UserID != nil && *doc.UserID == user.ID {
		return nil
	}

	return fmt.Errorf("access denied: not the owner")
}

// GetRepository returns the underlying repository (for cleanup jobs)
func (s *Service) GetRepository() *Repository {
	return s.repo
}

// GetChunkStore returns the underlying chunk store (for cleanup jobs)
func (s *Service) GetChunkStore() *storage.ChunkStore {
	return s.chunkStore
}
