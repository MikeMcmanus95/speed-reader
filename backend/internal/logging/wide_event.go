package logging

import (
	"context"
	"sync"
	"time"

	"golang.org/x/exp/slog"
)

// wideEventKey is the context key for WideEvent
type wideEventKey struct{}

// WideEvent accumulates attributes throughout a request lifecycle,
// emitting a single "wide" log event at the end with all collected data.
type WideEvent struct {
	mu     sync.RWMutex
	attrs  []slog.Attr
	logger *slog.Logger
}

// NewWideEvent creates a new WideEvent attached to the given logger
func NewWideEvent(logger *slog.Logger) *WideEvent {
	return &WideEvent{
		logger: logger,
		attrs:  make([]slog.Attr, 0, 16), // Pre-allocate for typical request
	}
}

// ContextWithWideEvent returns a new context with the WideEvent attached
func ContextWithWideEvent(ctx context.Context, we *WideEvent) context.Context {
	return context.WithValue(ctx, wideEventKey{}, we)
}

// WideEventFromContext retrieves the WideEvent from context, or nil if not present
func WideEventFromContext(ctx context.Context) *WideEvent {
	we, _ := ctx.Value(wideEventKey{}).(*WideEvent)
	return we
}

// Add adds a generic attribute
func (we *WideEvent) Add(key string, value any) {
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.Any(key, value))
}

// AddString adds a string attribute
func (we *WideEvent) AddString(key, value string) {
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.String(key, value))
}

// AddInt adds an integer attribute
func (we *WideEvent) AddInt(key string, value int) {
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.Int(key, value))
}

// AddInt64 adds an int64 attribute
func (we *WideEvent) AddInt64(key string, value int64) {
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.Int64(key, value))
}

// AddBool adds a boolean attribute
func (we *WideEvent) AddBool(key string, value bool) {
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.Bool(key, value))
}

// AddDuration adds a duration attribute (formatted as milliseconds)
func (we *WideEvent) AddDuration(key string, value time.Duration) {
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.Float64(key+"_ms", float64(value.Nanoseconds())/1e6))
}

// AddError adds an error attribute
func (we *WideEvent) AddError(err error) {
	if err == nil {
		return
	}
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.String("error", err.Error()))
}

// AddGroup adds a group of attributes
func (we *WideEvent) AddGroup(name string, attrs ...slog.Attr) {
	we.mu.Lock()
	defer we.mu.Unlock()
	we.attrs = append(we.attrs, slog.Group(name, attrsToAny(attrs)...))
}

// Emit logs the accumulated event at the specified level
func (we *WideEvent) Emit(ctx context.Context, level slog.Level, msg string) {
	we.mu.RLock()
	attrs := make([]any, len(we.attrs))
	for i, attr := range we.attrs {
		attrs[i] = attr
	}
	we.mu.RUnlock()

	we.logger.LogAttrs(ctx, level, msg, anyToAttrs(attrs)...)
}

// attrsToAny converts []slog.Attr to []any for slog.Group
func attrsToAny(attrs []slog.Attr) []any {
	result := make([]any, len(attrs))
	for i, attr := range attrs {
		result[i] = attr
	}
	return result
}

// anyToAttrs converts []any back to []slog.Attr for LogAttrs
func anyToAttrs(attrs []any) []slog.Attr {
	result := make([]slog.Attr, len(attrs))
	for i, attr := range attrs {
		if a, ok := attr.(slog.Attr); ok {
			result[i] = a
		}
	}
	return result
}
