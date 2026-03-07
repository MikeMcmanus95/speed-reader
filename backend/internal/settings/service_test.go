package settings

import "testing"

func TestValidateUpdate_PauseMultipliersOmittedFieldAllowed(t *testing.T) {
	svc := &Service{}
	update := &UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{},
	}

	if err := svc.validateUpdate(update); err != nil {
		t.Fatalf("expected omitted pause multipliers fields to validate, got %v", err)
	}
}

func TestValidateUpdate_PauseMultipliersExplicitZeroRejected(t *testing.T) {
	svc := &Service{}
	update := &UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{
			Comma: float64Ptr(0),
		},
	}

	err := svc.validateUpdate(update)
	if err == nil {
		t.Fatal("expected explicit zero pause multiplier to fail validation")
	}
	if !isValidationError(err) {
		t.Fatalf("expected typed validation error, got %T", err)
	}
	if err.Error() != "pauseMultipliers.comma must be between 1.0 and 5.0" {
		t.Fatalf("unexpected validation message: %q", err.Error())
	}
}
