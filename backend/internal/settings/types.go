package settings

// FontSize represents the RSVP display font size preference
type FontSize string

const (
	FontSizeSmall  FontSize = "small"
	FontSizeMedium FontSize = "medium"
	FontSizeLarge  FontSize = "large"
)

// PauseMultipliers contains pause duration multipliers for different punctuation types
type PauseMultipliers struct {
	Comma     float64 `json:"comma"`
	Sentence  float64 `json:"sentence"`
	Paragraph float64 `json:"paragraph"`
}

// Settings represents user preferences stored in the database
type Settings struct {
	DefaultWPM       int              `json:"defaultWpm"`
	DefaultChunkSize int              `json:"defaultChunkSize"`
	AutoPlayOnOpen   bool             `json:"autoPlayOnOpen"`
	PauseMultipliers PauseMultipliers `json:"pauseMultipliers"`
	FontSize         FontSize         `json:"fontSize"`
}

// DefaultSettings returns the application default settings
func DefaultSettings() *Settings {
	return &Settings{
		DefaultWPM:       300,
		DefaultChunkSize: 1,
		AutoPlayOnOpen:   false,
		PauseMultipliers: PauseMultipliers{
			Comma:     1.3,
			Sentence:  1.8,
			Paragraph: 2.2,
		},
		FontSize: FontSizeMedium,
	}
}

// UpdateSettingsRequest represents a partial update to settings
// All fields are pointers so we can distinguish between "not provided" and "set to zero value"
type UpdateSettingsRequest struct {
	DefaultWPM       *int              `json:"defaultWpm,omitempty"`
	DefaultChunkSize *int              `json:"defaultChunkSize,omitempty"`
	AutoPlayOnOpen   *bool             `json:"autoPlayOnOpen,omitempty"`
	PauseMultipliers *PauseMultipliers `json:"pauseMultipliers,omitempty"`
	FontSize         *FontSize         `json:"fontSize,omitempty"`
}

// Merge applies the update request to settings, returning a new Settings with updates applied
func (s *Settings) Merge(update *UpdateSettingsRequest) *Settings {
	result := *s // Copy current settings

	if update.DefaultWPM != nil {
		result.DefaultWPM = *update.DefaultWPM
	}
	if update.DefaultChunkSize != nil {
		result.DefaultChunkSize = *update.DefaultChunkSize
	}
	if update.AutoPlayOnOpen != nil {
		result.AutoPlayOnOpen = *update.AutoPlayOnOpen
	}
	if update.PauseMultipliers != nil {
		// Merge individual multiplier fields (0 means "keep existing")
		if update.PauseMultipliers.Comma != 0 {
			result.PauseMultipliers.Comma = update.PauseMultipliers.Comma
		}
		if update.PauseMultipliers.Sentence != 0 {
			result.PauseMultipliers.Sentence = update.PauseMultipliers.Sentence
		}
		if update.PauseMultipliers.Paragraph != 0 {
			result.PauseMultipliers.Paragraph = update.PauseMultipliers.Paragraph
		}
	}
	if update.FontSize != nil {
		result.FontSize = *update.FontSize
	}

	return &result
}
