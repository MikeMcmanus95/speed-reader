package settings

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Service handles business logic for user settings
type Service struct {
	repo *Repository
}

// NewService creates a new settings service
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// GetSettings retrieves settings for a user, returning defaults if not set
func (s *Service) GetSettings(ctx context.Context, userID uuid.UUID) (*Settings, error) {
	settings, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if settings == nil {
		return DefaultSettings(), nil
	}

	return settings, nil
}

// UpdateSettings applies a partial update to user settings
func (s *Service) UpdateSettings(ctx context.Context, userID uuid.UUID, update *UpdateSettingsRequest) (*Settings, error) {
	// Validate the update
	if err := s.validateUpdate(update); err != nil {
		return nil, err
	}

	// Get current settings (or defaults)
	current, err := s.GetSettings(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Merge the update into current settings
	merged := current.Merge(update)

	// Save to database
	if err := s.repo.Update(ctx, userID, merged); err != nil {
		return nil, err
	}

	return merged, nil
}

// validateUpdate validates the update request
func (s *Service) validateUpdate(update *UpdateSettingsRequest) error {
	if update.DefaultWPM != nil {
		if *update.DefaultWPM < 50 || *update.DefaultWPM > 1000 {
			return fmt.Errorf("defaultWpm must be between 50 and 1000")
		}
	}

	if update.DefaultChunkSize != nil {
		if *update.DefaultChunkSize < 1 || *update.DefaultChunkSize > 10 {
			return fmt.Errorf("defaultChunkSize must be between 1 and 10")
		}
	}

	if update.PauseMultipliers != nil {
		// PauseMultipliers must have all three fields with valid ranges when provided
		// Values of 0.0 are considered missing/unset
		if update.PauseMultipliers.Comma != 0 {
			if update.PauseMultipliers.Comma < 1.0 || update.PauseMultipliers.Comma > 5.0 {
				return fmt.Errorf("pauseMultipliers.comma must be between 1.0 and 5.0")
			}
		}
		if update.PauseMultipliers.Sentence != 0 {
			if update.PauseMultipliers.Sentence < 1.0 || update.PauseMultipliers.Sentence > 5.0 {
				return fmt.Errorf("pauseMultipliers.sentence must be between 1.0 and 5.0")
			}
		}
		if update.PauseMultipliers.Paragraph != 0 {
			if update.PauseMultipliers.Paragraph < 1.0 || update.PauseMultipliers.Paragraph > 5.0 {
				return fmt.Errorf("pauseMultipliers.paragraph must be between 1.0 and 5.0")
			}
		}
	}

	if update.FontSize != nil {
		switch *update.FontSize {
		case FontSizeSmall, FontSizeMedium, FontSizeLarge:
			// Valid
		default:
			return fmt.Errorf("fontSize must be 'small', 'medium', or 'large'")
		}
	}

	return nil
}
