package sharing

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Visibility represents document visibility
type Visibility string

const (
	VisibilityPrivate Visibility = "private"
	VisibilityPublic  Visibility = "public"
)

// SharedDocument represents a document accessed via share token
type SharedDocument struct {
	ID         uuid.UUID  `json:"id"`
	Title      string     `json:"title"`
	TokenCount int        `json:"tokenCount"`
	ChunkCount int        `json:"chunkCount"`
	CreatedAt  time.Time  `json:"createdAt"`
	OwnerName  string     `json:"ownerName"`
}

// ShareInfo represents sharing information for a document
type ShareInfo struct {
	ShareToken *uuid.UUID `json:"shareToken,omitempty"`
	ShareURL   string     `json:"shareUrl,omitempty"`
	Visibility Visibility `json:"visibility"`
}

// Service handles document sharing operations
type Service struct {
	db          *sql.DB
	frontendURL string
}

// NewService creates a new sharing service
func NewService(db *sql.DB, frontendURL string) *Service {
	return &Service{
		db:          db,
		frontendURL: frontendURL,
	}
}

// GenerateShareToken creates a share token for a document
func (s *Service) GenerateShareToken(ctx context.Context, docID, userID uuid.UUID) (*ShareInfo, error) {
	// Verify ownership
	if !s.isOwner(ctx, docID, userID) {
		return nil, fmt.Errorf("not authorized to share this document")
	}

	shareToken := uuid.New()

	query := `
		UPDATE documents
		SET share_token = $2
		WHERE id = $1 AND user_id = $3
		RETURNING visibility
	`

	var visibility string
	err := s.db.QueryRowContext(ctx, query, docID, shareToken, userID).Scan(&visibility)
	if err != nil {
		return nil, fmt.Errorf("failed to generate share token: %w", err)
	}

	return &ShareInfo{
		ShareToken: &shareToken,
		ShareURL:   s.buildShareURL(shareToken),
		Visibility: Visibility(visibility),
	}, nil
}

// RevokeShareToken removes the share token from a document
func (s *Service) RevokeShareToken(ctx context.Context, docID, userID uuid.UUID) error {
	// Verify ownership
	if !s.isOwner(ctx, docID, userID) {
		return fmt.Errorf("not authorized to modify this document")
	}

	query := `
		UPDATE documents
		SET share_token = NULL
		WHERE id = $1 AND user_id = $2
	`

	result, err := s.db.ExecContext(ctx, query, docID, userID)
	if err != nil {
		return fmt.Errorf("failed to revoke share token: %w", err)
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

// SetVisibility sets the visibility of a document
func (s *Service) SetVisibility(ctx context.Context, docID, userID uuid.UUID, visibility Visibility) (*ShareInfo, error) {
	// Verify ownership
	if !s.isOwner(ctx, docID, userID) {
		return nil, fmt.Errorf("not authorized to modify this document")
	}

	query := `
		UPDATE documents
		SET visibility = $2
		WHERE id = $1 AND user_id = $3
		RETURNING share_token
	`

	var shareToken sql.NullString
	err := s.db.QueryRowContext(ctx, query, docID, visibility, userID).Scan(&shareToken)
	if err != nil {
		return nil, fmt.Errorf("failed to set visibility: %w", err)
	}

	info := &ShareInfo{
		Visibility: visibility,
	}

	if shareToken.Valid {
		token, _ := uuid.Parse(shareToken.String)
		info.ShareToken = &token
		info.ShareURL = s.buildShareURL(token)
	}

	return info, nil
}

// GetShareInfo retrieves sharing information for a document
func (s *Service) GetShareInfo(ctx context.Context, docID, userID uuid.UUID) (*ShareInfo, error) {
	// Verify ownership
	if !s.isOwner(ctx, docID, userID) {
		return nil, fmt.Errorf("not authorized to view this document")
	}

	query := `
		SELECT share_token, visibility
		FROM documents
		WHERE id = $1 AND user_id = $2
	`

	var shareToken sql.NullString
	var visibility string
	err := s.db.QueryRowContext(ctx, query, docID, userID).Scan(&shareToken, &visibility)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("document not found")
		}
		return nil, fmt.Errorf("failed to get share info: %w", err)
	}

	info := &ShareInfo{
		Visibility: Visibility(visibility),
	}

	if shareToken.Valid {
		token, _ := uuid.Parse(shareToken.String)
		info.ShareToken = &token
		info.ShareURL = s.buildShareURL(token)
	}

	return info, nil
}

// CanAccessDocument checks if a user can read a document
func (s *Service) CanAccessDocument(ctx context.Context, docID uuid.UUID, userID *uuid.UUID) (bool, error) {
	query := `
		SELECT user_id, visibility
		FROM documents
		WHERE id = $1
	`

	var ownerID sql.NullString
	var visibility string
	err := s.db.QueryRowContext(ctx, query, docID).Scan(&ownerID, &visibility)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("failed to check access: %w", err)
	}

	// Public documents are accessible to everyone
	if visibility == string(VisibilityPublic) {
		return true, nil
	}

	// For private documents, check ownership
	if userID == nil {
		return false, nil
	}

	if ownerID.Valid {
		owner, _ := uuid.Parse(ownerID.String)
		return owner == *userID, nil
	}

	return false, nil
}

// GetDocumentByShareToken retrieves a document by share token (read-only access)
func (s *Service) GetDocumentByShareToken(ctx context.Context, shareToken uuid.UUID) (*SharedDocument, error) {
	query := `
		SELECT d.id, d.title, d.token_count, d.chunk_count, d.created_at, u.name
		FROM documents d
		JOIN users u ON d.user_id = u.id
		WHERE d.share_token = $1 AND d.status = 'ready'
	`

	doc := &SharedDocument{}
	err := s.db.QueryRowContext(ctx, query, shareToken).Scan(
		&doc.ID, &doc.Title, &doc.TokenCount, &doc.ChunkCount, &doc.CreatedAt, &doc.OwnerName,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("shared document not found")
		}
		return nil, fmt.Errorf("failed to get shared document: %w", err)
	}

	return doc, nil
}

// isOwner checks if a user owns a document
func (s *Service) isOwner(ctx context.Context, docID, userID uuid.UUID) bool {
	query := `SELECT 1 FROM documents WHERE id = $1 AND user_id = $2`
	var exists int
	err := s.db.QueryRowContext(ctx, query, docID, userID).Scan(&exists)
	return err == nil
}

// buildShareURL builds the frontend share URL
func (s *Service) buildShareURL(shareToken uuid.UUID) string {
	return fmt.Sprintf("%s/shared/%s", s.frontendURL, shareToken.String())
}
