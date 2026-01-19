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

// Visibility represents document visibility
type Visibility string

const (
	VisibilityPrivate Visibility = "private"
	VisibilityPublic  Visibility = "public"
)

// Document represents a stored document
type Document struct {
	ID         uuid.UUID      `json:"id"`
	UserID     *uuid.UUID     `json:"userId,omitempty"`
	Title      string         `json:"title"`
	Status     DocumentStatus `json:"status"`
	TokenCount int            `json:"tokenCount"`
	ChunkCount int            `json:"chunkCount"`
	Visibility Visibility     `json:"visibility"`
	ShareToken *uuid.UUID     `json:"shareToken,omitempty"`
	ExpiresAt  *time.Time     `json:"expiresAt,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	HasContent bool           `json:"hasContent"` // True if original content is stored (for editing)
}

// ReadingState represents the user's reading progress
type ReadingState struct {
	UserID     uuid.UUID `json:"userId"`
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

// CreateParams contains parameters for creating a document
type CreateParams struct {
	Title     string
	Content   string // Original text content for editing
	UserID    uuid.UUID
	ExpiresAt *time.Time
}

// Create inserts a new document
func (r *Repository) Create(ctx context.Context, params *CreateParams) (*Document, error) {
	doc := &Document{
		ID:         uuid.New(),
		UserID:     &params.UserID,
		Title:      params.Title,
		Status:     StatusPending,
		Visibility: VisibilityPrivate,
		ExpiresAt:  params.ExpiresAt,
		CreatedAt:  time.Now(),
		HasContent: params.Content != "",
	}

	query := `
		INSERT INTO documents (id, user_id, title, status, token_count, chunk_count, visibility, expires_at, created_at, content)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	// Store content as NULL if empty (for backward compatibility)
	var content *string
	if params.Content != "" {
		content = &params.Content
	}

	_, err := r.db.ExecContext(ctx, query,
		doc.ID, doc.UserID, doc.Title, doc.Status, doc.TokenCount, doc.ChunkCount, doc.Visibility, doc.ExpiresAt, doc.CreatedAt, content)
	if err != nil {
		return nil, fmt.Errorf("failed to insert document: %w", err)
	}

	return doc, nil
}

// GetByID retrieves a document by ID
func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Document, error) {
	query := `
		SELECT id, user_id, title, status, token_count, chunk_count, visibility, share_token, expires_at, created_at, content IS NOT NULL
		FROM documents
		WHERE id = $1
	`

	doc := &Document{}
	var userID, shareToken sql.NullString
	var expiresAt sql.NullTime
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&doc.ID, &userID, &doc.Title, &doc.Status, &doc.TokenCount, &doc.ChunkCount, &doc.Visibility, &shareToken, &expiresAt, &doc.CreatedAt, &doc.HasContent)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("document not found")
		}
		return nil, fmt.Errorf("failed to get document: %w", err)
	}

	if userID.Valid {
		uid, _ := uuid.Parse(userID.String)
		doc.UserID = &uid
	}
	if shareToken.Valid {
		st, _ := uuid.Parse(shareToken.String)
		doc.ShareToken = &st
	}
	if expiresAt.Valid {
		doc.ExpiresAt = &expiresAt.Time
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

// GetReadingState retrieves the reading state for a document and user
func (r *Repository) GetReadingState(ctx context.Context, userID, docID uuid.UUID) (*ReadingState, error) {
	query := `
		SELECT user_id, doc_id, token_index, wpm, chunk_size, updated_at
		FROM reading_state
		WHERE user_id = $1 AND doc_id = $2
	`

	state := &ReadingState{}
	err := r.db.QueryRowContext(ctx, query, userID, docID).Scan(
		&state.UserID, &state.DocID, &state.TokenIndex, &state.WPM, &state.ChunkSize, &state.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return default state if not found
			return &ReadingState{
				UserID:     userID,
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
		INSERT INTO reading_state (user_id, doc_id, token_index, wpm, chunk_size, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, doc_id) DO UPDATE SET
			token_index = EXCLUDED.token_index,
			wpm = EXCLUDED.wpm,
			chunk_size = EXCLUDED.chunk_size,
			updated_at = EXCLUDED.updated_at
	`

	state.UpdatedAt = time.Now()
	_, err := r.db.ExecContext(ctx, query,
		state.UserID, state.DocID, state.TokenIndex, state.WPM, state.ChunkSize, state.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to upsert reading state: %w", err)
	}

	return nil
}

// Delete removes a document owned by a user
func (r *Repository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	query := `DELETE FROM documents WHERE id = $1 AND user_id = $2`

	result, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("document not found or not owned by user")
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

// List retrieves all documents for a user with their reading progress
func (r *Repository) List(ctx context.Context, userID uuid.UUID) ([]DocumentWithProgress, error) {
	query := `
		SELECT d.id, d.user_id, d.title, d.status, d.token_count, d.chunk_count, d.visibility, d.share_token, d.expires_at, d.created_at,
			   d.content IS NOT NULL,
			   COALESCE(rs.token_index, 0), COALESCE(rs.wpm, 300), COALESCE(rs.updated_at, d.created_at)
		FROM documents d
		LEFT JOIN reading_state rs ON d.id = rs.doc_id AND rs.user_id = $1
		WHERE d.user_id = $1
		ORDER BY COALESCE(rs.updated_at, d.created_at) DESC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	defer rows.Close()

	var docs []DocumentWithProgress
	for rows.Next() {
		var doc DocumentWithProgress
		var docUserID, shareToken sql.NullString
		var expiresAt sql.NullTime
		err := rows.Scan(
			&doc.ID, &docUserID, &doc.Title, &doc.Status, &doc.TokenCount, &doc.ChunkCount, &doc.Visibility, &shareToken, &expiresAt, &doc.CreatedAt,
			&doc.HasContent,
			&doc.TokenIndex, &doc.WPM, &doc.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document: %w", err)
		}
		if docUserID.Valid {
			uid, _ := uuid.Parse(docUserID.String)
			doc.UserID = &uid
		}
		if shareToken.Valid {
			st, _ := uuid.Parse(shareToken.String)
			doc.ShareToken = &st
		}
		if expiresAt.Valid {
			doc.ExpiresAt = &expiresAt.Time
		}
		docs = append(docs, doc)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating documents: %w", err)
	}

	return docs, nil
}

// UpdateTitle updates only the title of a document owned by a user
func (r *Repository) UpdateTitle(ctx context.Context, id, userID uuid.UUID, title string) error {
	query := `UPDATE documents SET title = $2 WHERE id = $1 AND user_id = $3`

	result, err := r.db.ExecContext(ctx, query, id, title, userID)
	if err != nil {
		return fmt.Errorf("failed to update title: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("document not found or not owned by user")
	}

	return nil
}

// GetContent retrieves only the content field for a document
func (r *Repository) GetContent(ctx context.Context, id uuid.UUID) (string, bool, error) {
	query := `SELECT content FROM documents WHERE id = $1`

	var content sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(&content)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", false, fmt.Errorf("document not found")
		}
		return "", false, fmt.Errorf("failed to get content: %w", err)
	}

	if !content.Valid {
		return "", false, nil // Document exists but has no content (old document)
	}

	return content.String, true, nil
}

// UpdateContent updates the content of a document owned by a user
func (r *Repository) UpdateContent(ctx context.Context, id, userID uuid.UUID, content string) error {
	query := `UPDATE documents SET content = $2 WHERE id = $1 AND user_id = $3`

	result, err := r.db.ExecContext(ctx, query, id, content, userID)
	if err != nil {
		return fmt.Errorf("failed to update content: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("document not found or not owned by user")
	}

	return nil
}

// TransferOwnership transfers all documents from one user to another (for guest merge)
func (r *Repository) TransferOwnership(ctx context.Context, fromUserID, toUserID uuid.UUID) error {
	// Transfer documents
	docQuery := `UPDATE documents SET user_id = $2, expires_at = NULL WHERE user_id = $1`
	_, err := r.db.ExecContext(ctx, docQuery, fromUserID, toUserID)
	if err != nil {
		return fmt.Errorf("failed to transfer documents: %w", err)
	}

	// Transfer reading states
	rsQuery := `UPDATE reading_state SET user_id = $2 WHERE user_id = $1`
	_, err = r.db.ExecContext(ctx, rsQuery, fromUserID, toUserID)
	if err != nil {
		return fmt.Errorf("failed to transfer reading states: %w", err)
	}

	return nil
}

// DeleteExpiredGuestDocuments deletes documents that have expired
func (r *Repository) DeleteExpiredGuestDocuments(ctx context.Context) ([]uuid.UUID, error) {
	query := `
		DELETE FROM documents
		WHERE expires_at < NOW()
		RETURNING id
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to delete expired documents: %w", err)
	}
	defer rows.Close()

	var deletedIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan deleted ID: %w", err)
		}
		deletedIDs = append(deletedIDs, id)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating deleted IDs: %w", err)
	}

	return deletedIDs, nil
}

// IsOwner checks if a user owns a document
func (r *Repository) IsOwner(ctx context.Context, docID, userID uuid.UUID) (bool, error) {
	query := `SELECT 1 FROM documents WHERE id = $1 AND user_id = $2`
	var exists int
	err := r.db.QueryRowContext(ctx, query, docID, userID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check ownership: %w", err)
	}
	return true, nil
}
