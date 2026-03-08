package settings

import "errors"

var (
	// ErrUserNotFound indicates the settings user does not exist.
	ErrUserNotFound = errors.New("user not found")
)

// ValidationError represents an invalid settings update payload.
type ValidationError struct {
	message string
}

func (e *ValidationError) Error() string {
	return e.message
}

func newValidationError(message string) *ValidationError {
	return &ValidationError{message: message}
}
