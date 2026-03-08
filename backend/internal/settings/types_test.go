package settings

import (
	"encoding/json"
	"testing"
)

func TestSettingsMergePauseMultipliersUsesFieldPresence(t *testing.T) {
	current := DefaultSettings()

	updatedComma := 2.7
	merged := current.Merge(&UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{
			Comma: &updatedComma,
		},
	})

	if merged.PauseMultipliers.Comma != updatedComma {
		t.Fatalf("expected comma to update to %v, got %v", updatedComma, merged.PauseMultipliers.Comma)
	}
	if merged.PauseMultipliers.Sentence != current.PauseMultipliers.Sentence {
		t.Fatalf("expected sentence to remain %v, got %v", current.PauseMultipliers.Sentence, merged.PauseMultipliers.Sentence)
	}
	if merged.PauseMultipliers.Paragraph != current.PauseMultipliers.Paragraph {
		t.Fatalf("expected paragraph to remain %v, got %v", current.PauseMultipliers.Paragraph, merged.PauseMultipliers.Paragraph)
	}
}

func TestSettingsMergePauseMultipliersAppliesExplicitZeroValue(t *testing.T) {
	current := DefaultSettings()

	zero := 0.0
	merged := current.Merge(&UpdateSettingsRequest{
		PauseMultipliers: &PauseMultipliersUpdate{
			Comma: &zero,
		},
	})

	if merged.PauseMultipliers.Comma != 0.0 {
		t.Fatalf("expected explicit zero comma to be applied, got %v", merged.PauseMultipliers.Comma)
	}
}

func TestUpdateSettingsRequestPauseMultipliersUnmarshalDistinguishesMissingAndExplicitValues(t *testing.T) {
	var missingCommaReq UpdateSettingsRequest
	if err := json.Unmarshal([]byte(`{"pauseMultipliers":{"sentence":1.9}}`), &missingCommaReq); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	if missingCommaReq.PauseMultipliers == nil {
		t.Fatal("expected pauseMultipliers to be present")
	}
	if missingCommaReq.PauseMultipliers.Comma != nil {
		t.Fatal("expected comma to be nil when omitted")
	}
	if missingCommaReq.PauseMultipliers.Sentence == nil || *missingCommaReq.PauseMultipliers.Sentence != 1.9 {
		t.Fatalf("expected sentence=1.9, got %+v", missingCommaReq.PauseMultipliers.Sentence)
	}

	var explicitZeroReq UpdateSettingsRequest
	if err := json.Unmarshal([]byte(`{"pauseMultipliers":{"comma":0}}`), &explicitZeroReq); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	if explicitZeroReq.PauseMultipliers == nil || explicitZeroReq.PauseMultipliers.Comma == nil {
		t.Fatal("expected comma to be present when explicitly set")
	}
	if *explicitZeroReq.PauseMultipliers.Comma != 0.0 {
		t.Fatalf("expected explicit zero comma, got %v", *explicitZeroReq.PauseMultipliers.Comma)
	}
}
