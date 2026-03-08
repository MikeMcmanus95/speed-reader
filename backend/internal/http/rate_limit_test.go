package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mikepersonal/speed-reader/backend/internal/auth"
)

func TestIPRateLimit_BlocksAfterBurst(t *testing.T) {
	handler := IPRateLimit(RateLimitConfig{
		RequestsPerMinute: 60,
		Burst:             2,
		MaxEntries:        100,
		EntryTTL:          time.Minute,
		SweepInterval:     time.Second,
	})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	statuses := make([]int, 0, 3)
	for range 3 {
		req := httptest.NewRequest(http.MethodGet, "/api/shared/test", nil)
		req.RemoteAddr = "203.0.113.7:1234"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		statuses = append(statuses, rec.Code)
	}

	if statuses[0] != http.StatusOK || statuses[1] != http.StatusOK {
		t.Fatalf("expected first two requests to pass, got %v", statuses[:2])
	}
	if statuses[2] != http.StatusTooManyRequests {
		t.Fatalf("expected third request to be rate-limited, got %d", statuses[2])
	}
}

func TestIPRateLimit_SeparatesClientsByIP(t *testing.T) {
	handler := IPRateLimit(RateLimitConfig{
		RequestsPerMinute: 60,
		Burst:             1,
		MaxEntries:        100,
		EntryTTL:          time.Minute,
		SweepInterval:     time.Second,
	})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	reqA1 := httptest.NewRequest(http.MethodGet, "/api/shared/test", nil)
	reqA1.RemoteAddr = "198.51.100.10:3000"
	recA1 := httptest.NewRecorder()
	handler.ServeHTTP(recA1, reqA1)
	if recA1.Code != http.StatusOK {
		t.Fatalf("first request from client A failed: %d", recA1.Code)
	}

	reqA2 := httptest.NewRequest(http.MethodGet, "/api/shared/test", nil)
	reqA2.RemoteAddr = "198.51.100.10:3000"
	recA2 := httptest.NewRecorder()
	handler.ServeHTTP(recA2, reqA2)
	if recA2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request from client A should be limited, got %d", recA2.Code)
	}

	reqB1 := httptest.NewRequest(http.MethodGet, "/api/shared/test", nil)
	reqB1.RemoteAddr = "198.51.100.11:3000"
	recB1 := httptest.NewRecorder()
	handler.ServeHTTP(recB1, reqB1)
	if recB1.Code != http.StatusOK {
		t.Fatalf("first request from client B should not be limited, got %d", recB1.Code)
	}
}

func TestActorRateLimit_UsesUserIDWhenPresent(t *testing.T) {
	handler := ActorRateLimit(RateLimitConfig{
		RequestsPerMinute: 60,
		Burst:             1,
		MaxEntries:        100,
		EntryTTL:          time.Minute,
		SweepInterval:     time.Second,
	})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	userA := &auth.User{ID: uuid.New()}
	userB := &auth.User{ID: uuid.New()}

	reqA1 := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	reqA1.RemoteAddr = "203.0.113.55:5555"
	reqA1 = reqA1.WithContext(auth.ContextWithUser(reqA1.Context(), userA))
	recA1 := httptest.NewRecorder()
	handler.ServeHTTP(recA1, reqA1)
	if recA1.Code != http.StatusOK {
		t.Fatalf("first request for user A failed: %d", recA1.Code)
	}

	reqA2 := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	reqA2.RemoteAddr = "203.0.113.55:5555"
	reqA2 = reqA2.WithContext(auth.ContextWithUser(reqA2.Context(), userA))
	recA2 := httptest.NewRecorder()
	handler.ServeHTTP(recA2, reqA2)
	if recA2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request for user A should be limited, got %d", recA2.Code)
	}

	reqB1 := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	reqB1.RemoteAddr = "203.0.113.55:5555"
	reqB1 = reqB1.WithContext(auth.ContextWithUser(reqB1.Context(), userB))
	recB1 := httptest.NewRecorder()
	handler.ServeHTTP(recB1, reqB1)
	if recB1.Code != http.StatusOK {
		t.Fatalf("user B should have independent quota, got %d", recB1.Code)
	}
}
