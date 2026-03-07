package settings

import (
	"errors"
	"fmt"
)

var (
	// ErrUserNotFound indicates the requested user record does not exist.
	ErrUserNotFound = errors.New("settings user not found")
)

// ValidationError represents an invalid settings update payload.
type ValidationError struct {
	message string
}

func (e *ValidationError) Error() string {
	return e.message
}

func newValidationError(format string, args ...interface{}) error {
	return &ValidationError{
		message: fmt.Sprintf(format, args...),
	}
}

func isValidationError(err error) bool {
	var validationErr *ValidationError
	return errors.As(err, &validationErr)
}
