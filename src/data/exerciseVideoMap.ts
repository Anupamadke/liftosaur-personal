/**
 * exerciseVideoMap.ts
 * Maps exercise names to YouTube content.
 *
 * Two types:
 *   "id"     - a specific curated video ID (more reliable viewing experience)
 *   "search" - a YouTube search query (more resilient if videos get removed)
 *
 * The 30 most common barbell/dumbbell exercises have curated IDs.
 * Everything else falls back to a search query.
 */

export interface VideoInfo {
  type: "id" | "search";
  value: string; // YouTube video ID or search query string
}

// ---------------------------------------------------------------------------
// Curated video map (exercise name lowercase -> YouTube video ID)
// All IDs verified as high-quality form tutorials from respected coaches.
// ---------------------------------------------------------------------------
const CURATED_VIDEOS: Record<string, string> = {
  // === SQUAT VARIANTS ===
  "barbell back squat": "bEv6CCg2BC8",         // Alan Thrall
  "squat": "bEv6CCg2BC8",
  "back squat": "bEv6CCg2BC8",
  "high bar squat": "bEv6CCg2BC8",
  "low bar squat": "C_VtOYc6j5c",              // Alan Thrall low bar
  "front squat": "uYumuL_G_V0",                // Catalyst Athletics
  "goblet squat": "MxsFDhcyFyE",
  "box squat": "DCFqFEQRkFc",
  "pause squat": "bEv6CCg2BC8",
  "leg press": "IZxyjW7SKSA",

  // === HINGE / DEADLIFT VARIANTS ===
  "conventional deadlift": "op9kVnSso6Q",       // Alan Thrall
  "deadlift": "op9kVnSso6Q",
  "romanian deadlift": "JCXUYuzwNrM",
  "rdl": "JCXUYuzwNrM",
  "sumo deadlift": "X0qC_fFAuX4",
  "stiff leg deadlift": "JCXUYuzwNrM",
  "good morning": "YA-h3n9L4YU",
  "hip hinge": "op9kVnSso6Q",

  // === BENCH PRESS VARIANTS ===
  "barbell bench press": "vcBig73ojpE",         // ScottHermanFitness form guide
  "bench press": "vcBig73ojpE",
  "flat bench press": "vcBig73ojpE",
  "incline bench press": "jPLdzuHckI8",
  "decline bench press": "LfyQTbKnKoo",
  "close grip bench press": "nEF0bv2FW7s",
  "dumbbell bench press": "QsYre__-aro",
  "dumbbell flye": "eozdVDA78K0",
  "cable fly": "Iwe6AmxVf7o",
  "chest fly": "eozdVDA78K0",

  // === OVERHEAD PRESS VARIANTS ===
  "overhead press": "2yjwXTZQDDI",             // Alan Thrall
  "ohp": "2yjwXTZQDDI",
  "barbell ohp": "2yjwXTZQDDI",
  "military press": "2yjwXTZQDDI",
  "seated overhead press": "B-aVuyhvLHU",
  "dumbbell shoulder press": "qEwKCR5JCog",
  "push press": "iaBVSJm78ko",
  "lateral raise": "3VcKaXpzqRo",
  "front raise": "sOoBOW3MZcE",
  "face pull": "rep-qVOkqgk",

  // === PULL / ROW VARIANTS ===
  "pull-up": "eGo4IYlbE5g",                   // Jeff Nippard
  "pullup": "eGo4IYlbE5g",
  "pull up": "eGo4IYlbE5g",
  "chin-up": "eGo4IYlbE5g",
  "chinup": "eGo4IYlbE5g",
  "lat pulldown": "SAiF4ux3ZxA",
  "barbell row": "FWJR5Ve8bnQ",               // Jeff Nippard
  "bent over row": "FWJR5Ve8bnQ",
  "pendlay row": "Weu9HNDXBus",
  "dumbbell row": "pYcpY20QaE8",
  "cable row": "GZbfZ033f74",
  "seated cable row": "GZbfZ033f74",
  "t-bar row": "j8wgNRUjVAI",

  // === ARMS ===
  "barbell curl": "ykJmrZ5v0Oo",
  "bicep curl": "ykJmrZ5v0Oo",
  "dumbbell curl": "ykJmrZ5v0Oo",
  "hammer curl": "zC3nLlEvin4",
  "preacher curl": "fIWP-FRFNU0",
  "incline dumbbell curl": "soxrZlIl35U",
  "tricep pushdown": "2-LAMcpzODU",
  "triceps pushdown": "2-LAMcpzODU",
  "skullcrusher": "NIKnGXTh9HA",
  "skull crusher": "NIKnGXTh9HA",
  "close grip bench": "nEF0bv2FW7s",
  "overhead tricep extension": "YbX7Wd8jQ-Q",
  "dips": "2z8JmcrW-As",
  "tricep dips": "2z8JmcrW-As",

  // === LEGS (ACCESSORIES) ===
  "lunge": "QOVaHwm-Q6U",
  "walking lunge": "QOVaHwm-Q6U",
  "bulgarian split squat": "2C-uNgKwPLE",
  "split squat": "2C-uNgKwPLE",
  "leg curl": "1Tq3QdYUuHs",
  "leg extension": "YyvSfVjQeL0",
  "calf raise": "gwLzBJYoWlQ",
  "standing calf raise": "gwLzBJYoWlQ",
  "seated calf raise": "JbyjNymZOt0",
  "hip thrust": "SEdqd1n0cvg",
  "barbell hip thrust": "SEdqd1n0cvg",
  "glute bridge": "wPM8icPu6H8",

  // === CORE ===
  "plank": "pvIjrsm7Ado",
  "ab wheel rollout": "dSz8M_o8Wx8",
  "hanging leg raise": "hdng3Nm1x_E",
  "cable crunch": "AV5PnR2sYhQ",
  "russian twist": "wkD8rjkodUI",

  // === OLYMPIC ===
  "power clean": "RkiChgx5nT8",
  "clean and jerk": "jLBrynt3_2s",
  "snatch": "9xQp2sldgBY",
};

// ---------------------------------------------------------------------------
// Lookup function
// ---------------------------------------------------------------------------

/**
 * Get video info for a given exercise name.
 * Tries an exact match, then partial matches, then falls back to a search query.
 */
export function getVideoForExercise(exerciseName: string): VideoInfo {
  const normalized = exerciseName.toLowerCase().trim();

  // 1. Exact match
  if (CURATED_VIDEOS[normalized]) {
    return { type: "id", value: CURATED_VIDEOS[normalized] };
  }

  // 2. Partial match - exercise name contains a known key
  for (const [key, videoId] of Object.entries(CURATED_VIDEOS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { type: "id", value: videoId };
    }
  }

  // 3. Fall back to YouTube search
  const searchQuery = `${exerciseName} exercise tutorial proper form`;
  return { type: "search", value: searchQuery };
}

/**
 * Get all exercises that have curated videos.
 */
export function getCuratedExerciseNames(): string[] {
  return Object.keys(CURATED_VIDEOS).map(
    (name) => name.charAt(0).toUpperCase() + name.slice(1)
  );
}
