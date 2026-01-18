package documents

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// DocumentStatus represents the processing status of a document
type DocumentStatus string

const (
	StatusPending    DocumentStatus = "pending"
	StatusProcessing DocumentStatus = "processing"
	StatusReady      DocumentStatus = "ready"
	StatusError      DocumentStatus = "error"
)

// Document represents a stored document
type Document struct {
	ID         uuid.UUID      `json:"id"`
	Title      string         `json:"title"`
	Status     DocumentStatus `json:"status"`
	TokenCount int            `json:"tokenCount"`
	ChunkCount int            `json:"chunkCount"`
	CreatedAt  time.Time      `json:"createdAt"`
}

// ReadingState represents the user's reading progress
type ReadingState struct {
	DocID      uuid.UUID `json:"docId"`
	TokenIndex int       `json:"tokenIndex"`
	WPM        int       `json:"wpm"`
	ChunkSize  int       `json:"chunkSize"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// Repository handles database operations for documents
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new document repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new document
func (r *Repository) Create(ctx context.Context, title string) (*Document, error) {
	doc := &Document{
		ID:        uuid.New(),
		Title:     title,
		Status:    StatusPending,
		CreatedAt: time.Now(),
	}

	query := `
		INSERT INTO documents (id, title, status, token_count, chunk_count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.db.ExecContext(ctx, query,
		doc.ID, doc.Title, doc.Status, doc.TokenCount, doc.ChunkCount, doc.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert document: %w", err)
	}

	return doc, nil
}

// GetByID retrieves a document by ID
func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Document, error) {
	query := `
		SELECT id, title, status, token_count, chunk_count, created_at
		FROM documents
		WHERE id = $1
	`

	doc := &Document{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&doc.ID, &doc.Title, &doc.Status, &doc.TokenCount, &doc.ChunkCount, &doc.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("document not found")
		}
		return nil, fmt.Errorf("failed to get document: %w", err)
	}

	return doc, nil
}

// UpdateStatus updates the document status and counts
func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status DocumentStatus, tokenCount, chunkCount int) error {
	query := `
		UPDATE documents
		SET status = $2, token_count = $3, chunk_count = $4
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id, status, tokenCount, chunkCount)
	if err != nil {
		return fmt.Errorf("failed to update document: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("document not found")
	}

	return nil
}

// GetReadingState retrieves the reading state for a document
func (r *Repository) GetReadingState(ctx context.Context, docID uuid.UUID) (*ReadingState, error) {
	query := `
		SELECT doc_id, token_index, wpm, chunk_size, updated_at
		FROM reading_state
		WHERE doc_id = $1
	`

	state := &ReadingState{}
	err := r.db.QueryRowContext(ctx, query, docID).Scan(
		&state.DocID, &state.TokenIndex, &state.WPM, &state.ChunkSize, &state.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return default state if not found
			return &ReadingState{
				DocID:      docID,
				TokenIndex: 0,
				WPM:        300,
				ChunkSize:  1,
				UpdatedAt:  time.Now(),
			}, nil
		}
		return nil, fmt.Errorf("failed to get reading state: %w", err)
	}

	return state, nil
}

// UpsertReadingState creates or updates reading state
func (r *Repository) UpsertReadingState(ctx context.Context, state *ReadingState) error {
	query := `
		INSERT INTO reading_state (doc_id, token_index, wpm, chunk_size, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (doc_id) DO UPDATE SET
			token_index = EXCLUDED.token_index,
			wpm = EXCLUDED.wpm,
			chunk_size = EXCLUDED.chunk_size,
			updated_at = EXCLUDED.updated_at
	`

	state.UpdatedAt = time.Now()
	_, err := r.db.ExecContext(ctx, query,
		state.DocID, state.TokenIndex, state.WPM, state.ChunkSize, state.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to upsert reading state: %w", err)
	}

	return nil
}

// Delete removes a document and its reading state
func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM documents WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("document not found")
	}

	return nil
}

// DocumentWithProgress combines document metadata with reading progress
type DocumentWithProgress struct {
	Document
	TokenIndex int       `json:"tokenIndex"`
	WPM        int       `json:"wpm"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// List retrieves all documents with their reading progress
func (r *Repository) List(ctx context.Context) ([]DocumentWithProgress, error) {
	query := `
		SELECT d.id, d.title, d.status, d.token_count, d.chunk_count, d.created_at,
			   COALESCE(rs.token_index, 0), COALESCE(rs.wpm, 300), COALESCE(rs.updated_at, d.created_at)
		FROM documents d
		LEFT JOIN reading_state rs ON d.id = rs.doc_id
		ORDER BY COALESCE(rs.updated_at, d.created_at) DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	defer rows.Close()

	var docs []DocumentWithProgress
	for rows.Next() {
		var doc DocumentWithProgress
		err := rows.Scan(
			&doc.ID, &doc.Title, &doc.Status, &doc.TokenCount, &doc.ChunkCount, &doc.CreatedAt,
			&doc.TokenIndex, &doc.WPM, &doc.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document: %w", err)
		}
		docs = append(docs, doc)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating documents: %w", err)
	}

	return docs, nil
}

// UpdateTitle updates only the title of a document
func (r *Repository) UpdateTitle(ctx context.Context, id uuid.UUID, title string) error {
	query := `UPDATE documents SET title = $2 WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id, title)
	if err != nil {
		return fmt.Errorf("failed to update title: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("document not found")
	}

	return nil
}
