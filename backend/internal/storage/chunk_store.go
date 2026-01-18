package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ChunkStore handles reading and writing token chunks to disk
type ChunkStore struct {
	basePath string
}

// NewChunkStore creates a new ChunkStore with the given base path
func NewChunkStore(basePath string) *ChunkStore {
	return &ChunkStore{basePath: basePath}
}

// docPath returns the directory path for a document's chunks
func (s *ChunkStore) docPath(docID string) string {
	return filepath.Join(s.basePath, fmt.Sprintf("doc_%s", docID))
}

// chunkPath returns the file path for a specific chunk
func (s *ChunkStore) chunkPath(docID string, chunkIndex int) string {
	return filepath.Join(s.docPath(docID), fmt.Sprintf("chunk_%d.json", chunkIndex))
}

// WriteChunk writes a chunk of tokens to disk
func (s *ChunkStore) WriteChunk(docID string, chunkIndex int, tokens []Token) error {
	docDir := s.docPath(docID)
	if err := os.MkdirAll(docDir, 0755); err != nil {
		return fmt.Errorf("failed to create doc directory: %w", err)
	}

	chunk := Chunk{
		ChunkIndex: chunkIndex,
		Tokens:     tokens,
	}

	data, err := json.Marshal(chunk)
	if err != nil {
		return fmt.Errorf("failed to marshal chunk: %w", err)
	}

	chunkFile := s.chunkPath(docID, chunkIndex)
	if err := os.WriteFile(chunkFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write chunk file: %w", err)
	}

	return nil
}

// ReadChunk reads a chunk of tokens from disk
func (s *ChunkStore) ReadChunk(docID string, chunkIndex int) (*Chunk, error) {
	chunkFile := s.chunkPath(docID, chunkIndex)

	data, err := os.ReadFile(chunkFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("chunk not found: %w", err)
		}
		return nil, fmt.Errorf("failed to read chunk file: %w", err)
	}

	var chunk Chunk
	if err := json.Unmarshal(data, &chunk); err != nil {
		return nil, fmt.Errorf("failed to unmarshal chunk: %w", err)
	}

	return &chunk, nil
}

// DeleteDocument removes all chunks for a document
func (s *ChunkStore) DeleteDocument(docID string) error {
	docDir := s.docPath(docID)
	if err := os.RemoveAll(docDir); err != nil {
		return fmt.Errorf("failed to delete document directory: %w", err)
	}
	return nil
}
