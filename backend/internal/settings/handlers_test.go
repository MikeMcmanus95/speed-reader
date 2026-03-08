package settings

import (
	"errors"
	"testing"
)

func TestMapSettingsErrorUserNotFound(t *testing.T) {
	err := errors.Join(errors.New("repository failure"), ErrUserNotFound)

	status, message := mapSettingsError(err, "internal fallback")
	if status != 404 {
		t.Fatalf("expected 404 status, got %d", status)
	}
	if message != "user not found" {
		t.Fatalf("expected user not found message, got %q", message)
	}
}

func TestMapSettingsErrorValidation(t *testing.T) {
	err := newValidationError("defaultWpm must be between 50 and 1000")

	status, message := mapSettingsError(err, "internal fallback")
	if status != 400 {
		t.Fatalf("expected 400 status, got %d", status)
	}
	if message != err.Error() {
		t.Fatalf("expected validation message %q, got %q", err.Error(), message)
	}
}

func TestMapSettingsErrorInternalFallback(t *testing.T) {
	status, message := mapSettingsError(errors.New("boom"), "failed to update settings")
	if status != 500 {
		t.Fatalf("expected 500 status, got %d", status)
	}
	if message != "failed to update settings" {
		t.Fatalf("expected fallback message, got %q", message)
	}
}
