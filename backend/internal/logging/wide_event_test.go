package logging

import (
	"bytes"
	"context"
	"sync"
	"testing"
	"time"

	"golang.org/x/exp/slog"
)

func TestWideEvent_Add(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	we := NewWideEvent(logger)

	we.AddString("key1", "value1")
	we.AddInt("key2", 42)
	we.AddBool("key3", true)

	we.Emit(context.Background(), slog.LevelInfo, "test event")

	output := buf.String()
	if output == "" {
		t.Error("expected output to be non-empty")
	}
	if !bytes.Contains(buf.Bytes(), []byte("key1")) {
		t.Error("expected output to contain key1")
	}
	if !bytes.Contains(buf.Bytes(), []byte("value1")) {
		t.Error("expected output to contain value1")
	}
	if !bytes.Contains(buf.Bytes(), []byte("key2")) {
		t.Error("expected output to contain key2")
	}
}

func TestWideEvent_AddDuration(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	we := NewWideEvent(logger)

	we.AddDuration("latency", 100*time.Millisecond)
	we.Emit(context.Background(), slog.LevelInfo, "test event")

	if !bytes.Contains(buf.Bytes(), []byte("latency_ms")) {
		t.Error("expected output to contain latency_ms")
	}
}

func TestWideEvent_AddError(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	we := NewWideEvent(logger)

	// Test nil error doesn't add anything
	we.AddError(nil)
	we.Emit(context.Background(), slog.LevelInfo, "test event")

	if bytes.Contains(buf.Bytes(), []byte("error")) {
		t.Error("nil error should not add error field")
	}
}

func TestWideEvent_ContextPropagation(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	we := NewWideEvent(logger)

	ctx := ContextWithWideEvent(context.Background(), we)
	retrieved := WideEventFromContext(ctx)

	if retrieved != we {
		t.Error("expected retrieved WideEvent to be same as original")
	}

	// Test with empty context
	nilWe := WideEventFromContext(context.Background())
	if nilWe != nil {
		t.Error("expected nil WideEvent from empty context")
	}
}

func TestWideEvent_ConcurrentAccess(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	we := NewWideEvent(logger)

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			we.AddInt("concurrent_key", n)
			we.AddString("concurrent_str", "value")
		}(i)
	}
	wg.Wait()

	// Should not panic, and should have all attributes
	we.Emit(context.Background(), slog.LevelInfo, "concurrent test")
}
