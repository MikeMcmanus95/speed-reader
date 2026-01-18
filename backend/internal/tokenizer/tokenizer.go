package tokenizer

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/mikepersonal/speed-reader/backend/internal/storage"
)

// Pause multipliers for different punctuation
const (
	PauseNormal    = 1.0
	PauseComma     = 1.3
	PauseSentence  = 1.8
	PauseParagraph = 2.2
)

var (
	// Patterns for text normalization
	multipleSpaces = regexp.MustCompile(`\s+`)
	smartQuotes    = strings.NewReplacer(
		"\u201c", "\"", // left double quote
		"\u201d", "\"", // right double quote
		"\u2018", "'",  // left single quote
		"\u2019", "'",  // right single quote
		"\u2014", "-",  // em dash
		"\u2013", "-",  // en dash
	)
)

// Tokenize processes raw text into a slice of tokens with RSVP metadata
func Tokenize(text string) []storage.Token {
	// Normalize text
	text = normalizeText(text)

	// Split into paragraphs
	paragraphs := splitParagraphs(text)

	var tokens []storage.Token
	paragraphIndex := 0
	sentenceIndex := 0

	for _, paragraph := range paragraphs {
		if strings.TrimSpace(paragraph) == "" {
			continue
		}

		// Split paragraph into sentences
		sentences := splitSentences(paragraph)

		for sentenceInParagraph, sentence := range sentences {
			words := strings.Fields(sentence)
			wordCount := len(words)

			for i, word := range words {
				if word == "" {
					continue
				}

				isLastWordInSentence := i == wordCount-1
				isLastSentenceInParagraph := sentenceInParagraph == len(sentences)-1
				isLastWord := isLastWordInSentence && isLastSentenceInParagraph

				token := storage.Token{
					Text:           word,
					Pivot:          CalculatePivot(stripPunctuation(word)),
					IsSentenceEnd:  isLastWordInSentence,
					IsParagraphEnd: isLastWord,
					SentenceIndex:  sentenceIndex,
					ParagraphIndex: paragraphIndex,
				}

				// Calculate pause multiplier based on punctuation
				token.PauseMultiplier = calculatePauseMultiplier(word, isLastWord)

				tokens = append(tokens, token)
			}

			sentenceIndex++
		}

		paragraphIndex++
	}

	return tokens
}

// normalizeText cleans up the input text
func normalizeText(text string) string {
	// Replace smart quotes and dashes
	text = smartQuotes.Replace(text)

	// Normalize whitespace (but preserve paragraph breaks)
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		lines[i] = multipleSpaces.ReplaceAllString(strings.TrimSpace(line), " ")
	}

	return strings.Join(lines, "\n")
}

// splitParagraphs divides text into paragraphs
func splitParagraphs(text string) []string {
	// Split on double newlines or more
	paragraphSplitter := regexp.MustCompile(`\n\s*\n`)
	paragraphs := paragraphSplitter.Split(text, -1)

	// Also treat single newlines as paragraph breaks for simple texts
	var result []string
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}

	return result
}

// splitSentences divides text into sentences, respecting abbreviations
func splitSentences(text string) []string {
	var sentences []string
	var currentSentence strings.Builder
	words := strings.Fields(text)

	for i, word := range words {
		currentSentence.WriteString(word)

		// Check if this word ends a sentence
		if isSentenceEnd(word) && !IsAbbreviation(word) {
			sentences = append(sentences, strings.TrimSpace(currentSentence.String()))
			currentSentence.Reset()
		} else if i < len(words)-1 {
			currentSentence.WriteString(" ")
		}
	}

	// Add remaining text as final sentence
	if currentSentence.Len() > 0 {
		sentences = append(sentences, strings.TrimSpace(currentSentence.String()))
	}

	return sentences
}

// isSentenceEnd checks if a word ends with sentence-ending punctuation
func isSentenceEnd(word string) bool {
	if len(word) == 0 {
		return false
	}

	lastChar := word[len(word)-1]
	return lastChar == '.' || lastChar == '!' || lastChar == '?'
}

// calculatePauseMultiplier determines the pause based on punctuation
func calculatePauseMultiplier(word string, isParagraphEnd bool) float64 {
	if len(word) == 0 {
		return PauseNormal
	}

	if isParagraphEnd {
		return PauseParagraph
	}

	lastChar := word[len(word)-1]

	switch lastChar {
	case '.', '!', '?':
		return PauseSentence
	case ',', ';', ':':
		return PauseComma
	default:
		return PauseNormal
	}
}

// stripPunctuation removes punctuation from a word for pivot calculation
func stripPunctuation(word string) string {
	return strings.TrimFunc(word, func(r rune) bool {
		return unicode.IsPunct(r)
	})
}
