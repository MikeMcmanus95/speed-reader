package documents

import (
	"strings"
	"testing"
)

func TestGenerateRandomTitle(t *testing.T) {
	// Generate multiple titles to check the format
	for i := 0; i < 10; i++ {
		title := GenerateRandomTitle()

		// Should have exactly two words (Adjective Noun)
		words := strings.Split(title, " ")
		if len(words) != 2 {
			t.Errorf("Expected 2 words, got %d: %q", len(words), title)
		}

		// Both words should start with uppercase
		for _, word := range words {
			if word == "" {
				t.Errorf("Empty word in title: %q", title)
				continue
			}
			if word[0] < 'A' || word[0] > 'Z' {
				t.Errorf("Word should start with uppercase: %q in %q", word, title)
			}
		}
	}
}

func TestGenerateRandomTitle_Uniqueness(t *testing.T) {
	// Generate many titles and check they're not all the same
	titles := make(map[string]bool)
	for i := 0; i < 50; i++ {
		title := GenerateRandomTitle()
		titles[title] = true
	}

	// With 30 adjectives × 30 nouns = 900 combinations,
	// generating 50 titles should produce at least a few unique ones
	if len(titles) < 10 {
		t.Errorf("Expected at least 10 unique titles, got %d", len(titles))
	}
}
