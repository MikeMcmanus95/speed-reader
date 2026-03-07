package settings

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// Repository handles database operations for user settings
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new settings repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// GetByUserID retrieves settings for a user, returns nil if not set
func (r *Repository) GetByUserID(ctx context.Context, userID uuid.UUID) (*Settings, error) {
	query := `SELECT settings FROM users WHERE id = $1`

	var settingsJSON sql.NullString
	err := r.db.QueryRowContext(ctx, query, userID).Scan(&settingsJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get settings: %w", err)
	}

	if !settingsJSON.Valid {
		// Settings column is NULL, return nil to indicate no custom settings
		return nil, nil
	}

	var settings Settings
	if err := json.Unmarshal([]byte(settingsJSON.String), &settings); err != nil {
		return nil, fmt.Errorf("failed to parse settings JSON: %w", err)
	}

	return &settings, nil
}

// Update updates settings for a user
func (r *Repository) Update(ctx context.Context, userID uuid.UUID, settings *Settings) error {
	settingsJSON, err := json.Marshal(settings)
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	query := `UPDATE users SET settings = $2, updated_at = NOW() WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, userID, settingsJSON)
	if err != nil {
		return fmt.Errorf("failed to update settings: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}
