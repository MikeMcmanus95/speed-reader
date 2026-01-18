package tokenizer

// abbreviations is a set of common abbreviations that shouldn't end sentences
var abbreviations = map[string]bool{
	// Titles
	"Mr.":   true,
	"Mrs.":  true,
	"Ms.":   true,
	"Dr.":   true,
	"Prof.": true,
	"Sr.":   true,
	"Jr.":   true,
	"Rev.":  true,
	"Gen.":  true,
	"Col.":  true,
	"Capt.": true,
	"Lt.":   true,
	"Sgt.":  true,

	// Geographic
	"St.":   true,
	"Ave.":  true,
	"Blvd.": true,
	"Rd.":   true,
	"Mt.":   true,

	// Countries/States
	"U.S.":  true,
	"U.K.":  true,
	"U.N.":  true,
	"E.U.":  true,

	// Business
	"Inc.":  true,
	"Corp.": true,
	"Ltd.":  true,
	"Co.":   true,
	"LLC.":  true,

	// Academic
	"Ph.D.": true,
	"M.D.":  true,
	"B.A.":  true,
	"M.A.":  true,
	"B.S.":  true,
	"M.S.":  true,

	// Time
	"a.m.": true,
	"p.m.": true,
	"A.M.": true,
	"P.M.": true,

	// Common
	"etc.": true,
	"vs.":  true,
	"e.g.": true,
	"i.e.": true,
	"no.":  true,
	"No.":  true,
	"vol.": true,
	"Vol.": true,
	"fig.": true,
	"Fig.": true,
	"approx.": true,
	"est.": true,
}

// IsAbbreviation checks if a word is a known abbreviation
func IsAbbreviation(word string) bool {
	return abbreviations[word]
}
