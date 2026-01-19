package storage

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
)

func TestChunkStore_WriteAndRead(t *testing.T) {
	// Create temp directory
	tmpDir, err := os.MkdirTemp("", "chunkstore_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	store := NewChunkStore(tmpDir)
	docID := uuid.New()

	tokens := []Token{
		{Text: "Hello", Pivot: 1, IsSentenceEnd: false, PauseMultiplier: 1.0},
		{Text: "world.", Pivot: 2, IsSentenceEnd: true, PauseMultiplier: 1.8},
	}

	// Write chunk
	err = store.WriteChunk(docID, 0, tokens)
	if err != nil {
		t.Fatalf("WriteChunk failed: %v", err)
	}

	// Verify file exists
	chunkPath := filepath.Join(tmpDir, "doc_"+docID.String(), "chunk_0.json")
	if _, err := os.Stat(chunkPath); os.IsNotExist(err) {
		t.Error("chunk file was not created")
	}

	// Read chunk
	chunk, err := store.ReadChunk(docID, 0)
	if err != nil {
		t.Fatalf("ReadChunk failed: %v", err)
	}

	if chunk.ChunkIndex != 0 {
		t.Errorf("expected chunk index 0, got %d", chunk.ChunkIndex)
	}

	if len(chunk.Tokens) != 2 {
		t.Fatalf("expected 2 tokens, got %d", len(chunk.Tokens))
	}

	if chunk.Tokens[0].Text != "Hello" {
		t.Errorf("expected first token 'Hello', got '%s'", chunk.Tokens[0].Text)
	}

	if chunk.Tokens[1].IsSentenceEnd != true {
		t.Error("expected second token to be sentence end")
	}
}

func TestChunkStore_ReadNonexistent(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "chunkstore_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	store := NewChunkStore(tmpDir)

	_, err = store.ReadChunk(uuid.New(), 0)
	if err == nil {
		t.Error("expected error when reading nonexistent chunk")
	}
}

func TestChunkStore_MultipleChunks(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "chunkstore_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	store := NewChunkStore(tmpDir)
	docID := uuid.New()

	// Write multiple chunks
	for i := 0; i < 3; i++ {
		tokens := []Token{
			{Text: "chunk", Pivot: 2},
			{Text: string(rune('0' + i)), Pivot: 0},
		}
		err := store.WriteChunk(docID, i, tokens)
		if err != nil {
			t.Fatalf("WriteChunk %d failed: %v", i, err)
		}
	}

	// Read and verify each chunk
	for i := 0; i < 3; i++ {
		chunk, err := store.ReadChunk(docID, i)
		if err != nil {
			t.Fatalf("ReadChunk %d failed: %v", i, err)
		}
		if chunk.ChunkIndex != i {
			t.Errorf("chunk %d: expected index %d, got %d", i, i, chunk.ChunkIndex)
		}
	}
}

func TestChunkStore_DeleteDocument(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "chunkstore_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	store := NewChunkStore(tmpDir)
	docID := uuid.New()

	// Create a chunk
	tokens := []Token{{Text: "test", Pivot: 1}}
	err = store.WriteChunk(docID, 0, tokens)
	if err != nil {
		t.Fatalf("WriteChunk failed: %v", err)
	}

	// Delete document
	err = store.DeleteDocument(docID)
	if err != nil {
		t.Fatalf("DeleteDocument failed: %v", err)
	}

	// Verify directory is gone
	docDir := filepath.Join(tmpDir, "doc_"+docID.String())
	if _, err := os.Stat(docDir); !os.IsNotExist(err) {
		t.Error("document directory should be deleted")
	}
}
