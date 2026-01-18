package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	data := map[string]string{"message": "hello"}

	writeJSON(w, http.StatusOK, data)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}

	var result map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if result["message"] != "hello" {
		t.Errorf("expected message 'hello', got '%s'", result["message"])
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusBadRequest, "invalid input")

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var result ErrorResponse
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if result.Error != "invalid input" {
		t.Errorf("expected error 'invalid input', got '%s'", result.Error)
	}
}

func TestCreateDocumentRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{
			name:    "valid request",
			body:    `{"title": "Test", "content": "Hello world"}`,
			wantErr: false,
		},
		{
			name:    "missing title",
			body:    `{"content": "Hello world"}`,
			wantErr: true,
		},
		{
			name:    "missing content",
			body:    `{"title": "Test"}`,
			wantErr: true,
		},
		{
			name:    "invalid json",
			body:    `{invalid}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req CreateDocumentRequest
			err := json.NewDecoder(bytes.NewBufferString(tt.body)).Decode(&req)

			if tt.wantErr {
				if err == nil && req.Title != "" && req.Content != "" {
					t.Error("expected validation to fail")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestUpdateReadingStateRequest_JSON(t *testing.T) {
	body := `{"tokenIndex": 100, "wpm": 400, "chunkSize": 2}`

	var req UpdateReadingStateRequest
	err := json.NewDecoder(bytes.NewBufferString(body)).Decode(&req)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if req.TokenIndex != 100 {
		t.Errorf("expected tokenIndex 100, got %d", req.TokenIndex)
	}
	if req.WPM != 400 {
		t.Errorf("expected wpm 400, got %d", req.WPM)
	}
	if req.ChunkSize != 2 {
		t.Errorf("expected chunkSize 2, got %d", req.ChunkSize)
	}
}

func TestGenerateTitleFromContent(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		maxWords int
		want     string
	}{
		{
			name:     "short content",
			content:  "Hello world",
			maxWords: 6,
			want:     "Hello world",
		},
		{
			name:     "exactly max words",
			content:  "One two three four five six",
			maxWords: 6,
			want:     "One two three four five six...",
		},
		{
			name:     "more than max words",
			content:  "One two three four five six seven eight nine ten",
			maxWords: 6,
			want:     "One two three four five six...",
		},
		{
			name:     "empty content",
			content:  "",
			maxWords: 6,
			want:     "Untitled Document",
		},
		{
			name:     "whitespace only",
			content:  "   \n\t  ",
			maxWords: 6,
			want:     "Untitled Document",
		},
		{
			name:     "single word",
			content:  "Hello",
			maxWords: 6,
			want:     "Hello",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := generateTitleFromContent(tt.content, tt.maxWords)
			if got != tt.want {
				t.Errorf("generateTitleFromContent() = %q, want %q", got, tt.want)
			}
		})
	}
}
