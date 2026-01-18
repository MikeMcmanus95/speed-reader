package auth

import (
	"time"

	"github.com/google/uuid"
)

// User represents an authenticated user
type User struct {
	ID        uuid.UUID  `json:"id"`
	Email     *string    `json:"email,omitempty"`
	GoogleID  *string    `json:"-"`
	Name      string     `json:"name"`
	AvatarURL *string    `json:"avatarUrl,omitempty"`
	IsGuest   bool       `json:"isGuest"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

// CreateGuestUserParams contains parameters for creating a guest user
type CreateGuestUserParams struct {
	Name string
}

// CreateOAuthUserParams contains parameters for creating/updating an OAuth user
type CreateOAuthUserParams struct {
	Email     string
	GoogleID  string
	Name      string
	AvatarURL string
}

// RefreshToken represents a refresh token stored in the database
type RefreshToken struct {
	TokenHash string
	UserID    uuid.UUID
	ExpiresAt time.Time
	CreatedAt time.Time
}

// TokenPair represents an access token and refresh token pair
type TokenPair struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"-"` // Not exposed in JSON, sent via cookie
	ExpiresAt    time.Time `json:"expiresAt"`
}

// AuthResponse is the response returned after successful authentication
type AuthResponse struct {
	User      *User     `json:"user"`
	Token     string    `json:"accessToken"`
	ExpiresAt time.Time `json:"expiresAt"`
}
