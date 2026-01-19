package tokenizer

import "unicode/utf8"

// CalculatePivot returns the Optimal Recognition Point (ORP) for a word.
//
// The ORP is the character position where the eye should fixate for fastest
// word recognition during RSVP (Rapid Serial Visual Presentation) reading.
//
// Research shows the ORP varies by word length:
//   - Very short (1-2): center/only character
//   - Short (3-5): ~33-40% into word
//   - Medium (6-9): ~25-33% into word (classic ORP zone)
//   - Long (10+): ~25-30% into word
//
// Examples:
//
//	"I"             (1) -> 0 (100%)
//	"be"            (2) -> 1 (50%)
//	"the"           (3) -> 1 (33%)
//	"word"          (4) -> 1 (25%)
//	"hello"         (5) -> 2 (40%)
//	"reader"        (6) -> 2 (33%)
//	"reading"       (7) -> 2 (29%)
//	"research"      (8) -> 2 (25%)
//	"important"     (9) -> 3 (33%)
//	"recognized"   (10) -> 3 (30%)
//	"information"  (11) -> 3 (27%)
//	"presentation" (12) -> 4 (33%)
//	"extraordinary"(13) -> 4 (31%)
//
// Based on research by Rayner (1979), O'Regan & Lévy-Schoen (1987),
// and modern RSVP optimization studies.
//
// Returns a zero-based rune index (Unicode-safe).
func CalculatePivot(word string) int {
	length := utf8.RuneCountInString(word)

	switch {
	case length <= 1:
		return 0
	case length == 2:
		return 1
	case length <= 5:
		// Short words: (length-1)/2
		// 3 -> 1 (33%), 4 -> 1 (25%), 5 -> 2 (40%)
		return (length - 1) / 2
	case length <= 9:
		// Medium words: length/3
		// 6 -> 2 (33%), 7 -> 2 (29%), 8 -> 2 (25%), 9 -> 3 (33%)
		return length / 3
	default:
		// Long words: length/4 + 1
		// 10 -> 3 (30%), 12 -> 4 (33%), 16 -> 5 (31%), 20 -> 6 (30%)
		return length/4 + 1
	}
}
