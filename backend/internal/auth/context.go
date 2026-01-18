package auth

import (
	"context"

	"github.com/google/uuid"
)

type contextKey string

const (
	userContextKey   contextKey = "user"
	userIDContextKey contextKey = "userID"
)

// ContextWithUser adds a user to the context
func ContextWithUser(ctx context.Context, user *User) context.Context {
	ctx = context.WithValue(ctx, userContextKey, user)
	ctx = context.WithValue(ctx, userIDContextKey, user.ID)
	return ctx
}

// UserFromContext extracts the user from the context
func UserFromContext(ctx context.Context) (*User, bool) {
	user, ok := ctx.Value(userContextKey).(*User)
	return user, ok
}

// UserIDFromContext extracts the user ID from the context
func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userIDContextKey).(uuid.UUID)
	return id, ok
}

// MustUserIDFromContext extracts the user ID from the context or panics
func MustUserIDFromContext(ctx context.Context) uuid.UUID {
	id, ok := UserIDFromContext(ctx)
	if !ok {
		panic("user ID not found in context")
	}
	return id
}
