package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

type titleFixture struct {
	Cases []struct {
		Name     string `json:"name"`
		Content  string `json:"content"`
		MaxWords int    `json:"maxWords"`
		Expected string `json:"expected"`
	} `json:"cases"`
}

func TestHarnessEvalGenerateTitleFixtures(t *testing.T) {
	fixturePath := filepath.Join("testdata", "harness_generate_title.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture %s: %v", fixturePath, err)
	}

	var fixture titleFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("failed to parse fixture JSON: %v", err)
	}

	for _, tc := range fixture.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			got := generateTitleFromContent(tc.Content, tc.MaxWords)
			if got != tc.Expected {
				t.Fatalf("generateTitleFromContent() = %q, want %q", got, tc.Expected)
			}
		})
	}
}

func TestHarnessEvalWriteErrorContract(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusBadRequest, "invalid request body")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	if got := w.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("content-type = %q, want application/json", got)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON body: %v", err)
	}

	if body["error"] != "invalid request body" {
		t.Fatalf("error field = %q, want %q", body["error"], "invalid request body")
	}
}
