package tokenizer

import "testing"

func TestCalculatePivot(t *testing.T) {
	tests := []struct {
		word     string
		expected int
		note     string
	}{
		// Edge cases
		{"", 0, "empty string"},

		// Very short words (1-2 chars)
		{"a", 0, "1 char: 100%"},
		{"I", 0, "1 char: 100%"},
		{"be", 1, "2 chars: 50%"},
		{"is", 1, "2 chars: 50%"},

		// Short words (3-5 chars) - aim for ~33-40%
		{"the", 1, "3 chars: 33%"},
		{"and", 1, "3 chars: 33%"},
		{"word", 1, "4 chars: 25%"},
		{"test", 1, "4 chars: 25%"},
		{"hello", 2, "5 chars: 40%"},
		{"world", 2, "5 chars: 40%"},

		// Medium words (6-9 chars) - aim for ~25-33%
		{"reader", 2, "6 chars: 33%"},
		{"Amazon", 2, "6 chars: 33%"},
		{"reading", 2, "7 chars: 29%"},
		{"research", 2, "8 chars: 25%"},
		{"important", 3, "9 chars: 33%"},

		// Long words (10-13 chars) - aim for ~25-30%
		{"recognized", 3, "10 chars: 30%"},
		{"information", 3, "11 chars: 27%"},
		{"presentation", 4, "12 chars: 33%"},
		{"extraordinary", 4, "13 chars: 31%"},

		// Very long words (14+ chars)
		{"implementations", 4, "15 chars: 27%"},
		{"responsibilities", 5, "16 chars: 31%"},
		{"internationalization", 6, "20 chars: 30%"},
	}

	for _, tt := range tests {
		t.Run(tt.word, func(t *testing.T) {
			result := CalculatePivot(tt.word)
			if result != tt.expected {
				t.Errorf("CalculatePivot(%q) = %d, want %d (%s)", tt.word, result, tt.expected, tt.note)
			}
		})
	}
}

func TestCalculatePivot_Unicode(t *testing.T) {
	// Test with unicode characters - pivot is based on rune count, not byte count
	tests := []struct {
		word     string
		expected int
		note     string
	}{
		{"café", 1, "4 runes with accent: 25%"},
		{"日本語", 1, "3 runes (Japanese): 33%"},
		{"über", 1, "4 runes with umlaut: 25%"},
		{"naïve", 2, "5 runes with diaeresis: 40%"},
		{"Москва", 2, "6 runes (Cyrillic): 33%"},
	}

	for _, tt := range tests {
		t.Run(tt.word, func(t *testing.T) {
			result := CalculatePivot(tt.word)
			if result != tt.expected {
				t.Errorf("CalculatePivot(%q) = %d, want %d (%s)", tt.word, result, tt.expected, tt.note)
			}
		})
	}
}
