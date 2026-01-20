package telemetry

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

// Config holds telemetry configuration
type Config struct {
	ServiceName  string
	Version      string
	Environment  string
	NodeID       string
	OTLPEndpoint string // empty = use stdout exporter
	AxiomToken   string // Axiom API token (for Authorization header)
	AxiomDataset string // Axiom dataset name (for X-Axiom-Dataset header)
}

// ShutdownFunc is called to gracefully shutdown telemetry
type ShutdownFunc func(context.Context) error

// InitOTel initializes OpenTelemetry with the given configuration.
// Returns a shutdown function that should be called on application exit.
func InitOTel(ctx context.Context, cfg Config) (ShutdownFunc, error) {
	// Create resource with service metadata
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.Version),
			semconv.DeploymentEnvironment(cfg.Environment),
			semconv.ServiceInstanceID(cfg.NodeID),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create exporter based on configuration
	var exporter sdktrace.SpanExporter
	if cfg.OTLPEndpoint != "" {
		// Build OTLP options
		opts := []otlptracegrpc.Option{
			otlptracegrpc.WithEndpoint(cfg.OTLPEndpoint),
		}

		// Add Axiom-specific headers if token is provided
		if cfg.AxiomToken != "" {
			headers := map[string]string{
				"Authorization": "Bearer " + cfg.AxiomToken,
			}
			if cfg.AxiomDataset != "" {
				headers["X-Axiom-Dataset"] = cfg.AxiomDataset
			}
			opts = append(opts, otlptracegrpc.WithHeaders(headers))
		} else {
			// No auth - assume local collector, use insecure
			opts = append(opts, otlptracegrpc.WithInsecure())
		}

		// Production: OTLP gRPC exporter
		exporter, err = otlptracegrpc.New(ctx, opts...)
		if err != nil {
			return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
		}
	} else {
		// Development: stdout exporter
		exporter, err = stdouttrace.New(
			stdouttrace.WithPrettyPrint(),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create stdout exporter: %w", err)
		}
	}

	// Create TracerProvider with batching for production
	batcher := sdktrace.NewBatchSpanProcessor(exporter)
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(batcher),
		sdktrace.WithSampler(sdktrace.AlwaysSample()), // TODO: Make sampling rate configurable
	)

	// Set global TracerProvider and propagator
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Return shutdown function
	shutdown := func(ctx context.Context) error {
		// Give the exporter time to flush
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		return tp.Shutdown(ctx)
	}

	return shutdown, nil
}

// Tracer returns a named tracer for creating spans
func Tracer(name string) trace.Tracer {
	return otel.Tracer(name)
}
