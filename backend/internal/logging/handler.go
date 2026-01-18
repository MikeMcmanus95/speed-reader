package logging

import (
	"context"

	"go.opentelemetry.io/otel/trace"
	"golang.org/x/exp/slog"
)

// OtelHandler wraps slog.Handler to inject trace_id and span_id from OpenTelemetry context
type OtelHandler struct {
	inner slog.Handler
}

// NewOtelHandler creates a new OtelHandler wrapping the given handler
func NewOtelHandler(inner slog.Handler) *OtelHandler {
	return &OtelHandler{inner: inner}
}

// Enabled implements slog.Handler
func (h *OtelHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

// Handle implements slog.Handler, injecting trace context
func (h *OtelHandler) Handle(ctx context.Context, record slog.Record) error {
	// Extract trace context from OpenTelemetry
	spanCtx := trace.SpanContextFromContext(ctx)
	if spanCtx.IsValid() {
		record.AddAttrs(
			slog.String("trace_id", spanCtx.TraceID().String()),
			slog.String("span_id", spanCtx.SpanID().String()),
		)
		if spanCtx.IsSampled() {
			record.AddAttrs(slog.Bool("sampled", true))
		}
	}

	return h.inner.Handle(ctx, record)
}

// WithAttrs implements slog.Handler
func (h *OtelHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &OtelHandler{inner: h.inner.WithAttrs(attrs)}
}

// WithGroup implements slog.Handler
func (h *OtelHandler) WithGroup(name string) slog.Handler {
	return &OtelHandler{inner: h.inner.WithGroup(name)}
}
