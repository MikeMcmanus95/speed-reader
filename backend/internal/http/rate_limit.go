package http

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mikepersonal/speed-reader/backend/internal/auth"
	"golang.org/x/time/rate"
)

const (
	defaultRequestsPerMinute = 60.0
	defaultBurst             = 20
	defaultMaxEntries        = 10000
	defaultEntryTTL          = 10 * time.Minute
	defaultSweepInterval     = time.Minute
)

// RateLimitConfig defines behavior for a rate limiter middleware.
type RateLimitConfig struct {
	RequestsPerMinute float64
	Burst             int
	MaxEntries        int
	EntryTTL          time.Duration
	SweepInterval     time.Duration
}

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type limiterStore struct {
	mu        sync.Mutex
	config    RateLimitConfig
	keyFn     func(*http.Request) string
	entries   map[string]*limiterEntry
	lastSweep time.Time
}

func normalizeRateLimitConfig(config RateLimitConfig) RateLimitConfig {
	if config.RequestsPerMinute <= 0 {
		config.RequestsPerMinute = defaultRequestsPerMinute
	}
	if config.Burst <= 0 {
		config.Burst = defaultBurst
	}
	if config.MaxEntries <= 0 {
		config.MaxEntries = defaultMaxEntries
	}
	if config.EntryTTL <= 0 {
		config.EntryTTL = defaultEntryTTL
	}
	if config.SweepInterval <= 0 {
		config.SweepInterval = defaultSweepInterval
	}
	return config
}

func newLimiterStore(config RateLimitConfig, keyFn func(*http.Request) string) *limiterStore {
	return &limiterStore{
		config:  normalizeRateLimitConfig(config),
		keyFn:   keyFn,
		entries: make(map[string]*limiterEntry),
	}
}

func (store *limiterStore) allow(r *http.Request) bool {
	now := time.Now()
	key := store.keyFn(r)
	if key == "" {
		key = "unknown"
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	if store.lastSweep.IsZero() || now.Sub(store.lastSweep) >= store.config.SweepInterval {
		store.pruneStaleLocked(now)
		store.lastSweep = now
	}

	entry, ok := store.entries[key]
	if !ok {
		if len(store.entries) >= store.config.MaxEntries {
			store.evictOldestLocked()
		}
		entry = &limiterEntry{
			limiter: rate.NewLimiter(rate.Limit(store.config.RequestsPerMinute/60.0), store.config.Burst),
		}
		store.entries[key] = entry
	}

	entry.lastSeen = now
	return entry.limiter.AllowN(now, 1)
}

func (store *limiterStore) pruneStaleLocked(now time.Time) {
	for key, entry := range store.entries {
		if now.Sub(entry.lastSeen) > store.config.EntryTTL {
			delete(store.entries, key)
		}
	}
}

func (store *limiterStore) evictOldestLocked() {
	var oldestKey string
	var oldestAt time.Time
	first := true

	for key, entry := range store.entries {
		if first || entry.lastSeen.Before(oldestAt) {
			oldestKey = key
			oldestAt = entry.lastSeen
			first = false
		}
	}

	if oldestKey != "" {
		delete(store.entries, oldestKey)
	}
}

func retryAfterSeconds(config RateLimitConfig) int {
	if config.RequestsPerMinute <= 0 {
		return 1
	}
	seconds := int(60.0 / config.RequestsPerMinute)
	if seconds < 1 {
		return 1
	}
	return seconds
}

func rateLimitMiddleware(config RateLimitConfig, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	normalized := normalizeRateLimitConfig(config)
	store := newLimiterStore(normalized, keyFn)
	retryAfter := retryAfterSeconds(normalized)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !store.allow(r) {
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				writeJSON(w, http.StatusTooManyRequests, ErrorResponse{Error: "rate limit exceeded"})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func ipKey(r *http.Request) string {
	addr := strings.TrimSpace(r.RemoteAddr)
	if addr == "" {
		return "ip:unknown"
	}

	host, _, err := net.SplitHostPort(addr)
	if err == nil && host != "" {
		return "ip:" + host
	}

	return "ip:" + addr
}

func actorKey(r *http.Request) string {
	if userID, ok := auth.UserIDFromContext(r.Context()); ok {
		return "user:" + userID.String()
	}
	return ipKey(r)
}

// IPRateLimit returns middleware that rate limits requests per source IP address.
func IPRateLimit(config RateLimitConfig) func(http.Handler) http.Handler {
	return rateLimitMiddleware(config, ipKey)
}

// ActorRateLimit returns middleware that rate limits authenticated users by user ID and falls back to IP.
func ActorRateLimit(config RateLimitConfig) func(http.Handler) http.Handler {
	return rateLimitMiddleware(config, actorKey)
}
