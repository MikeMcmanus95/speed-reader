package settings

import (
	"testing"
)

func TestValidateUpdateAllowsOmittedPauseMultiplierFields(t *testing.T) {
	service := &Service{}

	err := service.validateUpdate(&UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{},
	})
	if err != nil {
		t.Fatalf("expected omitted pause fields to be allowed, got error: %v", err)
	}
}

func TestValidateUpdateRejectsExplicitZeroPauseMultiplier(t *testing.T) {
	service := &Service{}
	zero := 0.0

	err := service.validateUpdate(&UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{
			Comma: &zero,
		},
	})
	if err == nil {
		t.Fatal("expected validation error for explicit zero comma multiplier")
	}

	validationErr, ok := err.(*ValidationError)
	if !ok {
		t.Fatalf("expected ValidationError, got %T", err)
	}
	if validationErr.Error() != "pauseMultipliers.comma must be between 1.0 and 5.0" {
		t.Fatalf("unexpected validation message: %q", validationErr.Error())
	}
}
