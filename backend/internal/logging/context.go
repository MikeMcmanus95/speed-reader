package logging

import (
	"context"

	"golang.org/x/exp/slog"
)

// loggerKey is the context key for storing the logger
type loggerKey struct{}

// ContextWithLogger returns a new context with the logger attached
func ContextWithLogger(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey{}, logger)
}

// LoggerFromContext retrieves the logger from context.
// Returns the provided fallback logger if no logger is in the context.
func LoggerFromContext(ctx context.Context, fallback *slog.Logger) *slog.Logger {
	if logger, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok {
		return logger
	}
	return fallback
}

// L is a convenience function for getting a logger from context.
// If no logger is found, it returns the default slog logger.
func L(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok {
		return logger
	}
	return slog.Default()
}

// With returns a new logger with the given attributes added.
// If ctx has a logger, it uses that; otherwise uses the default logger.
func With(ctx context.Context, args ...any) *slog.Logger {
	return L(ctx).With(args...)
}
