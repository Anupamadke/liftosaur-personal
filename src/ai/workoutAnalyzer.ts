/**
 * workoutAnalyzer.ts
 * Builds AI prompts from Liftosaur workout data and returns actionable insights.
 *
 * How to wire up:
 *   1. Extract workout data from Liftosaur's state (IHistoryRecord[], IProgram, etc.)
 *   2. Pass it to the appropriate builder function below
 *   3. Feed the result into GeminiService.analyze() or GeminiService.chat()
 */

import { GeminiService, type ChatMessage } from "./geminiService";

// ---------------------------------------------------------------------------
// Lightweight types - mirrors Liftosaur's data shapes (simplified)
// You can pass richer data; extra fields are ignored.
// ---------------------------------------------------------------------------

export interface WorkoutSet {
  reps: number;
  weight: number; // kg or lbs
  isCompleted: boolean;
}

export interface WorkoutExercise {
  name: string; // e.g. "Squat", "Bench Press"
  sets: WorkoutSet[];
}

export interface WorkoutRecord {
  date: string; // ISO date string
  programName?: string;
  dayName?: string;
  exercises: WorkoutExercise[];
}

export interface UserGoals {
  primaryGoal?: "strength" | "hypertrophy" | "endurance" | "weight_loss";
  targetBodyWeight?: number;
  specificLifts?: { exercise: string; targetWeight: number }[];
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  daysPerWeek?: number;
  weightUnit?: "kg" | "lbs";
}

// ---------------------------------------------------------------------------
// System prompt - sets the AI's persona
// ---------------------------------------------------------------------------

export const WORKOUT_SYSTEM_PROMPT = `You are an expert strength and conditioning coach with deep knowledge of:
- Powerlifting, bodybuilding, and general strength training
- Progressive overload, periodization, and deload strategies
- Exercise form, biomechanics, and injury prevention
- Evidence-based training science

You have access to the user's actual workout history. Always:
- Give specific, actionable advice (exact weights, reps, sets)
- Reference their actual recent performance when relevant
- Keep responses concise - 3-5 sentences max unless asked for more
- Use metric (kg) unless the user's data shows lbs
- Be direct and confident, not wishy-washy`;

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

/**
 * Summarize the last N workouts into a compact context string for the AI.
 */
export function buildWorkoutContext(
  history: WorkoutRecord[],
  lastN: number = 10
): string {
  const recent = history.slice(-lastN);

  if (recent.length === 0) {
    return "No workout history available yet.";
  }

  const lines: string[] = ["=== Recent Workout History ==="];

  for (const workout of recent) {
    lines.push(`\n[${workout.date}] ${workout.dayName ?? workout.programName ?? "Workout"}`);
    for (const ex of workout.exercises) {
      const completedSets = ex.sets.filter((s) => s.isCompleted);
      if (completedSets.length === 0) continue;
      const setStr = completedSets
        .map((s) => `${s.reps}x${s.weight}`)
        .join(", ");
      lines.push(`  ${ex.name}: ${setStr}`);
    }
  }

  return lines.join("\n");
}

/**
 * Compute 1-rep max using Epley formula: weight * (1 + reps/30)
 */
function epley1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Get the estimated 1RM history for a specific exercise.
 */
export function get1RMHistory(
  history: WorkoutRecord[],
  exerciseName: string
): { date: string; estimated1RM: number }[] {
  const normalizedTarget = exerciseName.toLowerCase();
  const result: { date: string; estimated1RM: number }[] = [];

  for (const workout of history) {
    const exercise = workout.exercises.find((e) =>
      e.name.toLowerCase().includes(normalizedTarget)
    );
    if (!exercise) continue;

    const best = exercise.sets
      .filter((s) => s.isCompleted && s.weight > 0 && s.reps > 0)
      .reduce(
        (max, s) => {
          const rm = epley1RM(s.weight, s.reps);
          return rm > max.rm ? { rm, s } : max;
        },
        { rm: 0, s: null as WorkoutSet | null }
      );

    if (best.rm > 0) {
      result.push({ date: workout.date, estimated1RM: best.rm });
    }
  }

  return result;
}

/**
 * Calculate total weekly volume (sets x reps x weight) per muscle group.
 */
export function getWeeklyVolume(
  history: WorkoutRecord[]
): Record<string, number> {
  // Simple exercise-to-muscle mapping
  const MUSCLE_MAP: Record<string, string> = {
    squat: "Legs",
    "leg press": "Legs",
    lunge: "Legs",
    deadlift: "Back",
    "romanian deadlift": "Back",
    "bent over row": "Back",
    "pull-up": "Back",
    pullup: "Back",
    "lat pulldown": "Back",
    "bench press": "Chest",
    "incline bench": "Chest",
    "chest fly": "Chest",
    "overhead press": "Shoulders",
    "shoulder press": "Shoulders",
    lateral: "Shoulders",
    "bicep curl": "Biceps",
    curl: "Biceps",
    "tricep": "Triceps",
    "triceps": "Triceps",
    "push-up": "Chest",
    pushup: "Chest",
    "calf raise": "Legs",
    plank: "Core",
    "ab ": "Core",
    crunch: "Core",
  };

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const volume: Record<string, number> = {};

  const recentWorkouts = history.filter(
    (w) => new Date(w.date) >= oneWeekAgo
  );

  for (const workout of recentWorkouts) {
    for (const ex of workout.exercises) {
      const nameLower = ex.name.toLowerCase();
      const muscle = Object.entries(MUSCLE_MAP).find(([key]) =>
        nameLower.includes(key)
      )?.[1] ?? "Other";

      const workoutVolume = ex.sets
        .filter((s) => s.isCompleted)
        .reduce((sum, s) => sum + s.reps * s.weight, 0);

      volume[muscle] = (volume[muscle] ?? 0) + workoutVolume;
    }
  }

  return volume;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Suggest next workout weights/sets based on recent history.
 */
export function buildProgressionPrompt(
  history: WorkoutRecord[],
  goals: UserGoals = {}
): string {
  const context = buildWorkoutContext(history, 6);
  const goalStr = goals.primaryGoal
    ? `User's goal: ${goals.primaryGoal}. Experience: ${goals.experienceLevel ?? "unknown"}.`
    : "";

  return `${context}

${goalStr}

Based on this history, what weights and reps should I use in my NEXT workout? Give specific numbers for each exercise I've been doing. Apply appropriate progressive overload (typically +2.5kg for upper body, +5kg for lower body when sets are completed cleanly).`;
}

/**
 * Generate a full training program.
 */
export function buildProgramGenerationPrompt(goals: UserGoals): string {
  const {
    primaryGoal = "strength",
    daysPerWeek = 3,
    experienceLevel = "intermediate",
    weightUnit = "kg",
    specificLifts = [],
  } = goals;

  const liftGoalsStr =
    specificLifts.length > 0
      ? `Target lifts: ${specificLifts.map((l) => `${l.exercise} @ ${l.targetWeight}${weightUnit}`).join(", ")}.`
      : "";

  return `Create a ${daysPerWeek}-day/week training program for a ${experienceLevel} lifter with the goal of ${primaryGoal}.
${liftGoalsStr}

Format as:
Day X - [Name]
- Exercise: sets x reps @ weight (or % of 1RM)

Include:
- Main compound lifts
- Accessory work
- Progression rules (when to increase weight)
- Deload frequency

Keep it practical and evidence-based. Use ${weightUnit}.`;
}

/**
 * Get form tips and cues for a specific exercise.
 */
export function buildFormTipsPrompt(exerciseName: string): string {
  return `Give me the 5 most important form cues for ${exerciseName}. Focus on:
1. Setup and positioning
2. The most common mistakes that cause injury or reduce performance
3. One cue I can think about during the lift

Be specific and practical, not generic. Max 150 words.`;
}

/**
 * Analyze overall progress and identify plateaus.
 */
export function buildProgressAnalysisPrompt(
  history: WorkoutRecord[],
  goals: UserGoals = {}
): string {
  const context = buildWorkoutContext(history, 20);

  return `${context}

Analyze my training progress over this period:
1. Which lifts are progressing well?
2. Which lifts are plateaued or regressing? (same weight/reps 3+ sessions)
3. Am I training with sufficient frequency and volume for my goal (${goals.primaryGoal ?? "general strength"})?
4. What is my ONE most important adjustment to make right now?

Be direct and specific. Reference my actual numbers.`;
}

// ---------------------------------------------------------------------------
// High-level analyzer class
// ---------------------------------------------------------------------------

export class WorkoutAIAnalyzer {
  private gemini: GeminiService;
  private chatHistory: ChatMessage[] = [];

  constructor(apiKey: string) {
    this.gemini = new GeminiService({ apiKey, model: "gemini-2.0-flash" });
  }

  async suggestProgression(
    history: WorkoutRecord[],
    goals?: UserGoals
  ): Promise<string> {
    const prompt = buildProgressionPrompt(history, goals);
    return this.gemini.analyze(prompt, WORKOUT_SYSTEM_PROMPT);
  }

  async generateProgram(goals: UserGoals): Promise<string> {
    const prompt = buildProgramGenerationPrompt(goals);
    return this.gemini.analyze(prompt, WORKOUT_SYSTEM_PROMPT);
  }

  async getFormTips(exerciseName: string): Promise<string> {
    const prompt = buildFormTipsPrompt(exerciseName);
    return this.gemini.analyze(prompt, WORKOUT_SYSTEM_PROMPT);
  }

  async analyzeProgress(
    history: WorkoutRecord[],
    goals?: UserGoals
  ): Promise<string> {
    const prompt = buildProgressAnalysisPrompt(history, goals);
    return this.gemini.analyze(prompt, WORKOUT_SYSTEM_PROMPT);
  }

  /** Conversational chat - maintains history automatically */
  async chat(
    userMessage: string,
    workoutContext?: string
  ): Promise<string> {
    const systemWithContext = workoutContext
      ? `${WORKOUT_SYSTEM_PROMPT}\n\n${workoutContext}`
      : WORKOUT_SYSTEM_PROMPT;

    const reply = await this.gemini.chat(
      userMessage,
      this.chatHistory,
      systemWithContext
    );

    // Store in history for next turn
    this.chatHistory.push({ role: "user", text: userMessage });
    this.chatHistory.push({ role: "model", text: reply });

    // Keep last 20 messages to avoid context bloat
    if (this.chatHistory.length > 20) {
      this.chatHistory = this.chatHistory.slice(-20);
    }

    return reply;
  }

  clearHistory(): void {
    this.chatHistory = [];
  }
}
