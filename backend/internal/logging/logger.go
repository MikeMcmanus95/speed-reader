package logging

import (
	"io"
	"os"
	"strings"

	"golang.org/x/exp/slog"
)

// Config holds logger configuration
type Config struct {
	Level       string // debug, info, warn, error
	ServiceName string
	Version     string
	NodeID      string
	Environment string
}

// NewLogger creates a production-ready slog.Logger
func NewLogger(cfg Config) *slog.Logger {
	level := parseLevel(cfg.Level)

	var handler slog.Handler
	if cfg.Environment == "development" {
		// Text handler for development (easier to read)
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level:     level,
			AddSource: true,
		})
	} else {
		// JSON handler for production (structured logging)
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level:     level,
			AddSource: true,
		})
	}

	// Wrap with OtelHandler to inject trace context
	handler = NewOtelHandler(handler)

	// Create logger with default attributes
	logger := slog.New(handler).With(
		slog.String("service", cfg.ServiceName),
		slog.String("version", cfg.Version),
		slog.String("node_id", cfg.NodeID),
		slog.String("env", cfg.Environment),
	)

	return logger
}

// NewLoggerWithWriter creates a logger that writes to a specific writer (useful for testing)
func NewLoggerWithWriter(w io.Writer, cfg Config) *slog.Logger {
	level := parseLevel(cfg.Level)

	var handler slog.Handler
	if cfg.Environment == "development" {
		handler = slog.NewTextHandler(w, &slog.HandlerOptions{
			Level:     level,
			AddSource: false,
		})
	} else {
		handler = slog.NewJSONHandler(w, &slog.HandlerOptions{
			Level:     level,
			AddSource: false,
		})
	}

	handler = NewOtelHandler(handler)

	return slog.New(handler).With(
		slog.String("service", cfg.ServiceName),
		slog.String("version", cfg.Version),
		slog.String("node_id", cfg.NodeID),
		slog.String("env", cfg.Environment),
	)
}

func parseLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
