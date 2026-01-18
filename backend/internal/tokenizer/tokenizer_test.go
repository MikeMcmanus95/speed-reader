package tokenizer

import (
	"strings"
	"testing"
)

func TestTokenize_BasicSentence(t *testing.T) {
	text := "Hello world."
	tokens := Tokenize(text)

	if len(tokens) != 2 {
		t.Fatalf("expected 2 tokens, got %d", len(tokens))
	}

	if tokens[0].Text != "Hello" {
		t.Errorf("expected first token 'Hello', got '%s'", tokens[0].Text)
	}

	if tokens[1].Text != "world." {
		t.Errorf("expected second token 'world.', got '%s'", tokens[1].Text)
	}

	if !tokens[1].IsSentenceEnd {
		t.Error("expected last token to be sentence end")
	}

	if !tokens[1].IsParagraphEnd {
		t.Error("expected last token to be paragraph end")
	}
}

func TestTokenize_MultipleSentences(t *testing.T) {
	text := "First sentence. Second sentence!"
	tokens := Tokenize(text)

	if len(tokens) != 4 {
		t.Fatalf("expected 4 tokens, got %d", len(tokens))
	}

	// Check sentence boundaries
	if !tokens[1].IsSentenceEnd {
		t.Error("expected 'sentence.' to be sentence end")
	}

	if !tokens[3].IsSentenceEnd {
		t.Error("expected 'sentence!' to be sentence end")
	}
}

func TestTokenize_Abbreviations(t *testing.T) {
	text := "Dr. Smith went to the U.S. today."
	tokens := Tokenize(text)

	// Should be one sentence (abbreviations shouldn't break it)
	sentenceCount := 0
	for _, token := range tokens {
		if token.IsSentenceEnd {
			sentenceCount++
		}
	}

	if sentenceCount != 1 {
		t.Errorf("expected 1 sentence, got %d", sentenceCount)
	}
}

func TestTokenize_Paragraphs(t *testing.T) {
	text := "First paragraph.\n\nSecond paragraph."
	tokens := Tokenize(text)

	paragraphCount := 0
	for _, token := range tokens {
		if token.IsParagraphEnd {
			paragraphCount++
		}
	}

	if paragraphCount != 2 {
		t.Errorf("expected 2 paragraphs, got %d", paragraphCount)
	}
}

func TestTokenize_PauseMultipliers(t *testing.T) {
	tests := []struct {
		text     string
		expected float64
	}{
		{"word", PauseNormal},
		{"word,", PauseComma},
		{"word.", PauseSentence},
		{"word!", PauseSentence},
		{"word?", PauseSentence},
	}

	for _, tt := range tests {
		t.Run(tt.text, func(t *testing.T) {
			// Add extra text to avoid paragraph end multiplier
			text := tt.text + " another"
			tokens := Tokenize(text)

			if len(tokens) == 0 {
				t.Fatal("expected at least one token")
			}

			if tokens[0].PauseMultiplier != tt.expected {
				t.Errorf("expected pause multiplier %.1f, got %.1f",
					tt.expected, tokens[0].PauseMultiplier)
			}
		})
	}
}

func TestTokenize_PivotCalculation(t *testing.T) {
	text := "a be the quick extraordinary"
	tokens := Tokenize(text)

	// Check that pivot is calculated for each word
	for _, token := range tokens {
		if token.Pivot < 0 {
			t.Errorf("pivot should be non-negative for '%s', got %d",
				token.Text, token.Pivot)
		}
		if token.Pivot >= len(token.Text) {
			t.Errorf("pivot should be less than word length for '%s'",
				token.Text)
		}
	}
}

func TestTokenize_SmartQuotes(t *testing.T) {
	text := "\u201cHello,\u201d she said. \u201cGoodbye!\u201d"
	tokens := Tokenize(text)

	// Check that smart quotes were converted
	foundDoubleQuote := false
	for _, token := range tokens {
		if strings.Contains(token.Text, "\"") {
			foundDoubleQuote = true
		}
		if strings.Contains(token.Text, "\u201c") || strings.Contains(token.Text, "\u201d") {
			t.Error("smart quotes should be converted to regular quotes")
		}
	}

	if !foundDoubleQuote {
		t.Error("expected to find converted double quotes")
	}
}

func TestTokenize_EmptyInput(t *testing.T) {
	tokens := Tokenize("")
	if len(tokens) != 0 {
		t.Errorf("expected 0 tokens for empty input, got %d", len(tokens))
	}
}

func TestTokenize_WhitespaceOnly(t *testing.T) {
	tokens := Tokenize("   \n\n   \t   ")
	if len(tokens) != 0 {
		t.Errorf("expected 0 tokens for whitespace input, got %d", len(tokens))
	}
}

// Benchmark tokenization performance
func BenchmarkTokenize_100kWords(b *testing.B) {
	// Generate ~100k words of text
	words := []string{"the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"}
	var builder strings.Builder
	for i := 0; i < 12500; i++ { // 12500 * 8 = 100k words
		for _, word := range words {
			builder.WriteString(word)
			builder.WriteString(" ")
		}
		if i%100 == 0 {
			builder.WriteString(". ")
		}
	}
	text := builder.String()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Tokenize(text)
	}
}
