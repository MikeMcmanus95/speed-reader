package tokenizer

import "unicode/utf8"

// CalculatePivot returns the optimal recognition point (ORP) for a word
// The ORP is approximately 30% into the word, which is where the eye
// naturally focuses for fastest recognition
func CalculatePivot(word string) int {
	length := utf8.RuneCountInString(word)
	if length == 0 {
		return 0
	}

	// Handle short words
	if length <= 1 {
		return 0
	}
	if length <= 3 {
		return 1
	}
	if length <= 5 {
		return 1
	}

	// For longer words, aim for approximately 30% position
	// but slightly weighted toward the beginning
	pivot := (length * 3) / 10
	if pivot < 1 {
		pivot = 1
	}

	return pivot
}
