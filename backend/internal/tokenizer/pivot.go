package tokenizer

import "unicode/utf8"

// CalculatePivot returns the center position of a word
// This aligns the middle of the word with the focus line for consistent reading
func CalculatePivot(word string) int {
	length := utf8.RuneCountInString(word)
	if length == 0 {
		return 0
	}
	return length / 2
}
