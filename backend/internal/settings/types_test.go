package settings

import (
	"encoding/json"
	"testing"
)

func float64Ptr(v float64) *float64 {
	return &v
}

func TestUpdateSettingsRequest_PauseMultipliersFieldPresence(t *testing.T) {
	var req UpdateSettingsRequest
	if err := json.Unmarshal([]byte(`{"pauseMultipliers":{"comma":0}}`), &req); err != nil {
		t.Fatalf("failed to decode request: %v", err)
	}

	if req.PauseMultipliers == nil {
		t.Fatal("expected pauseMultipliers to be present")
	}
	if req.PauseMultipliers.Comma == nil {
		t.Fatal("expected comma field to be present")
	}
	if *req.PauseMultipliers.Comma != 0 {
		t.Fatalf("expected comma to decode as explicit 0, got %v", *req.PauseMultipliers.Comma)
	}
	if req.PauseMultipliers.Sentence != nil {
		t.Fatal("expected sentence to be omitted")
	}
	if req.PauseMultipliers.Paragraph != nil {
		t.Fatal("expected paragraph to be omitted")
	}
}

func TestSettingsMerge_PauseMultipliersUseFieldPresence(t *testing.T) {
	settings := DefaultSettings()
	updatedSentence := 2.7
	update := &UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{
			Sentence: &updatedSentence,
		},
	}

	merged := settings.Merge(update)

	if merged.PauseMultipliers.Comma != settings.PauseMultipliers.Comma {
		t.Fatalf("expected comma to stay %v, got %v", settings.PauseMultipliers.Comma, merged.PauseMultipliers.Comma)
	}
	if merged.PauseMultipliers.Sentence != updatedSentence {
		t.Fatalf("expected sentence to be updated to %v, got %v", updatedSentence, merged.PauseMultipliers.Sentence)
	}
	if merged.PauseMultipliers.Paragraph != settings.PauseMultipliers.Paragraph {
		t.Fatalf("expected paragraph to stay %v, got %v", settings.PauseMultipliers.Paragraph, merged.PauseMultipliers.Paragraph)
	}
}

func TestSettingsMerge_PauseMultipliersApplyExplicitZero(t *testing.T) {
	settings := DefaultSettings()
	update := &UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{
			Comma: float64Ptr(0),
		},
	}

	merged := settings.Merge(update)

	if merged.PauseMultipliers.Comma != 0 {
		t.Fatalf("expected explicit zero update to be applied, got %v", merged.PauseMultipliers.Comma)
	}
}
