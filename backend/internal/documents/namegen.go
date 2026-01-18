package documents

import (
	"fmt"
	"math/rand"
	"time"
)

var (
	// Adjectives themed around reading, wisdom, and nocturnal atmosphere
	adjectives = []string{
		// Nocturnal/atmospheric
		"Midnight", "Twilight", "Starlit", "Moonlit", "Shadowy",
		"Velvet", "Dusky", "Amber", "Crimson", "Golden",
		// Intellectual/scholarly
		"Curious", "Wandering", "Ancient", "Mystic", "Wise",
		"Noble", "Clever", "Swift", "Silent", "Whispering",
		// Nature-inspired
		"Emerald", "Silver", "Sapphire", "Copper", "Ivory",
		"Gentle", "Radiant", "Hidden", "Forgotten", "Eternal",
	}

	// Nouns themed around readers, creatures, and literary concepts
	nouns = []string{
		// Creatures (nocturnal/wise)
		"Owl", "Raven", "Fox", "Wolf", "Moth",
		"Hare", "Badger", "Hedgehog", "Finch", "Wren",
		// Scholarly figures
		"Scholar", "Scribe", "Sage", "Bard", "Poet",
		"Reader", "Dreamer", "Wanderer", "Seeker", "Keeper",
		// Literary objects
		"Quill", "Scroll", "Tome", "Chronicle", "Sonnet",
		"Ballad", "Fable", "Verse", "Chapter", "Inkwell",
	}

	rng = rand.New(rand.NewSource(time.Now().UnixNano()))
)

// GenerateRandomTitle creates a fun random document name
// using the pattern "Adjective Noun" (e.g., "Midnight Scholar", "Curious Owl")
func GenerateRandomTitle() string {
	adj := adjectives[rng.Intn(len(adjectives))]
	noun := nouns[rng.Intn(len(nouns))]
	return fmt.Sprintf("%s %s", adj, noun)
}
