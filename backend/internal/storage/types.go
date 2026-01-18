package storage

// Token represents a single word with RSVP metadata
type Token struct {
	Text            string  `json:"text"`
	Pivot           int     `json:"pivot"`
	IsSentenceEnd   bool    `json:"isSentenceEnd"`
	IsParagraphEnd  bool    `json:"isParagraphEnd"`
	PauseMultiplier float64 `json:"pauseMultiplier"`
	SentenceIndex   int     `json:"sentenceIndex"`
	ParagraphIndex  int     `json:"paragraphIndex"`
}

// Chunk represents a collection of tokens for storage
type Chunk struct {
	ChunkIndex int     `json:"chunkIndex"`
	Tokens     []Token `json:"tokens"`
}
