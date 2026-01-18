package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Repository handles database operations for auth
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new auth repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// CreateGuestUser creates a new guest user
func (r *Repository) CreateGuestUser(ctx context.Context, params *CreateGuestUserParams) (*User, error) {
	user := &User{
		ID:        uuid.New(),
		Name:      params.Name,
		IsGuest:   true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	query := `
		INSERT INTO users (id, name, is_guest, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.Name, user.IsGuest, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create guest user: %w", err)
	}

	return user, nil
}

// CreateOrUpdateOAuthUser creates a new user or updates an existing one via OAuth
func (r *Repository) CreateOrUpdateOAuthUser(ctx context.Context, params *CreateOAuthUserParams) (*User, error) {
	user := &User{
		ID:        uuid.New(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Use UPSERT to handle both new users and returning users
	query := `
		INSERT INTO users (id, email, google_id, name, avatar_url, is_guest, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, false, $6, $7)
		ON CONFLICT (google_id) DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			avatar_url = EXCLUDED.avatar_url,
			is_guest = false,
			updated_at = EXCLUDED.updated_at
		RETURNING id, email, google_id, name, avatar_url, is_guest, created_at, updated_at
	`

	var avatarURL sql.NullString
	if params.AvatarURL != "" {
		avatarURL.String = params.AvatarURL
		avatarURL.Valid = true
	}

	var email, googleID, avatar sql.NullString
	err := r.db.QueryRowContext(ctx, query,
		user.ID, params.Email, params.GoogleID, params.Name, avatarURL, user.CreatedAt, user.UpdatedAt,
	).Scan(&user.ID, &email, &googleID, &user.Name, &avatar, &user.IsGuest, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create/update OAuth user: %w", err)
	}

	if email.Valid {
		user.Email = &email.String
	}
	if googleID.Valid {
		user.GoogleID = &googleID.String
	}
	if avatar.Valid {
		user.AvatarURL = &avatar.String
	}

	return user, nil
}

// GetUserByID retrieves a user by ID
func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, email, google_id, name, avatar_url, is_guest, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	user := &User{}
	var email, googleID, avatarURL sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID, &email, &googleID, &user.Name, &avatarURL, &user.IsGuest, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if email.Valid {
		user.Email = &email.String
	}
	if googleID.Valid {
		user.GoogleID = &googleID.String
	}
	if avatarURL.Valid {
		user.AvatarURL = &avatarURL.String
	}

	return user, nil
}

// GetUserByGoogleID retrieves a user by Google ID
func (r *Repository) GetUserByGoogleID(ctx context.Context, googleID string) (*User, error) {
	query := `
		SELECT id, email, google_id, name, avatar_url, is_guest, created_at, updated_at
		FROM users
		WHERE google_id = $1
	`

	user := &User{}
	var email, gID, avatarURL sql.NullString
	err := r.db.QueryRowContext(ctx, query, googleID).Scan(
		&user.ID, &email, &gID, &user.Name, &avatarURL, &user.IsGuest, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found is not an error for this query
		}
		return nil, fmt.Errorf("failed to get user by google ID: %w", err)
	}

	if email.Valid {
		user.Email = &email.String
	}
	if gID.Valid {
		user.GoogleID = &gID.String
	}
	if avatarURL.Valid {
		user.AvatarURL = &avatarURL.String
	}

	return user, nil
}

// MergeGuestToOAuth upgrades a guest user to an OAuth user
func (r *Repository) MergeGuestToOAuth(ctx context.Context, guestID uuid.UUID, params *CreateOAuthUserParams) (*User, error) {
	query := `
		UPDATE users SET
			email = $2,
			google_id = $3,
			name = $4,
			avatar_url = $5,
			is_guest = false,
			updated_at = $6
		WHERE id = $1
		RETURNING id, email, google_id, name, avatar_url, is_guest, created_at, updated_at
	`

	var avatarURL sql.NullString
	if params.AvatarURL != "" {
		avatarURL.String = params.AvatarURL
		avatarURL.Valid = true
	}

	user := &User{}
	var email, googleID, avatar sql.NullString
	err := r.db.QueryRowContext(ctx, query,
		guestID, params.Email, params.GoogleID, params.Name, avatarURL, time.Now(),
	).Scan(&user.ID, &email, &googleID, &user.Name, &avatar, &user.IsGuest, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to merge guest to OAuth: %w", err)
	}

	if email.Valid {
		user.Email = &email.String
	}
	if googleID.Valid {
		user.GoogleID = &googleID.String
	}
	if avatar.Valid {
		user.AvatarURL = &avatar.String
	}

	return user, nil
}

// DeleteUser deletes a user
func (r *Repository) DeleteUser(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
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

// hashToken creates a SHA-256 hash of a token
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// StoreRefreshToken stores a refresh token in the database
func (r *Repository) StoreRefreshToken(ctx context.Context, token string, userID uuid.UUID, expiresAt time.Time) error {
	query := `
		INSERT INTO refresh_tokens (token_hash, user_id, expires_at, created_at)
		VALUES ($1, $2, $3, $4)
	`

	tokenHash := hashToken(token)
	_, err := r.db.ExecContext(ctx, query, tokenHash, userID, expiresAt, time.Now())
	if err != nil {
		return fmt.Errorf("failed to store refresh token: %w", err)
	}

	return nil
}

// GetRefreshToken retrieves a refresh token and its associated user
func (r *Repository) GetRefreshToken(ctx context.Context, token string) (*RefreshToken, error) {
	query := `
		SELECT token_hash, user_id, expires_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`

	tokenHash := hashToken(token)
	rt := &RefreshToken{}
	err := r.db.QueryRowContext(ctx, query, tokenHash).Scan(
		&rt.TokenHash, &rt.UserID, &rt.ExpiresAt, &rt.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("refresh token not found")
		}
		return nil, fmt.Errorf("failed to get refresh token: %w", err)
	}

	return rt, nil
}

// DeleteRefreshToken deletes a refresh token
func (r *Repository) DeleteRefreshToken(ctx context.Context, token string) error {
	query := `DELETE FROM refresh_tokens WHERE token_hash = $1`

	tokenHash := hashToken(token)
	_, err := r.db.ExecContext(ctx, query, tokenHash)
	if err != nil {
		return fmt.Errorf("failed to delete refresh token: %w", err)
	}

	return nil
}

// DeleteUserRefreshTokens deletes all refresh tokens for a user
func (r *Repository) DeleteUserRefreshTokens(ctx context.Context, userID uuid.UUID) error {
	query := `DELETE FROM refresh_tokens WHERE user_id = $1`

	_, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to delete user refresh tokens: %w", err)
	}

	return nil
}

// DeleteExpiredRefreshTokens deletes all expired refresh tokens
func (r *Repository) DeleteExpiredRefreshTokens(ctx context.Context) (int64, error) {
	query := `DELETE FROM refresh_tokens WHERE expires_at < NOW()`

	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired refresh tokens: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rows, nil
}
