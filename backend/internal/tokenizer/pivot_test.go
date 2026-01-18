package tokenizer

import "testing"

func TestCalculatePivot(t *testing.T) {
	tests := []struct {
		word     string
		expected int
	}{
		{"", 0},
		{"a", 0},
		{"be", 1},
		{"the", 1},
		{"word", 2},
		{"hello", 2},
		{"reading", 3},
		{"extraordinary", 6},
	}

	for _, tt := range tests {
		t.Run(tt.word, func(t *testing.T) {
			result := CalculatePivot(tt.word)
			if result != tt.expected {
				t.Errorf("CalculatePivot(%q) = %d, want %d", tt.word, result, tt.expected)
			}
		})
	}
}

func TestCalculatePivot_Unicode(t *testing.T) {
	// Test with unicode characters
	tests := []struct {
		word     string
		expected int
	}{
		{"café", 2},
		{"日本語", 1}, // 3 runes -> pivot at center
		{"über", 2},
	}

	for _, tt := range tests {
		t.Run(tt.word, func(t *testing.T) {
			result := CalculatePivot(tt.word)
			if result != tt.expected {
				t.Errorf("CalculatePivot(%q) = %d, want %d", tt.word, result, tt.expected)
			}
		})
	}
}
