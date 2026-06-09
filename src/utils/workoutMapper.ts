/**
 * workoutMapper.ts
 * Converts Liftosaur's IHistoryRecord[] into the simpler WorkoutRecord[]
 * shape used by the AI coach and progress charts.
 */

import type { IHistoryRecord } from "../types";
import type { WorkoutRecord } from "../ai/workoutAnalyzer";

/**
 * Converts a camelCase exercise ID like "benchPress" into "Bench Press".
 * Falls back to the raw id if something unexpected happens.
 */
function exerciseIdToName(id: string): string {
  try {
    return id
      .replace(/([A-Z])/g, " $1")
      .trim()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return id;
  }
}

/**
 * Convert Liftosaur history records to the simplified WorkoutRecord[] shape.
 * @param records - from state.storage.history
 */
export function mapLiftosaurHistory(records: IHistoryRecord[]): WorkoutRecord[] {
  return records
    .filter((r) => r.vtype === "history_record" && r.endTime != null)
    .map((record) => ({
      date: record.date,
      programName: record.programName,
      dayName: record.dayName,
      exercises: record.entries.map((entry) => ({
        name: exerciseIdToName(entry.exercise.id),
        sets: entry.sets.map((set) => ({
          reps: set.completedReps ?? set.reps ?? 0,
          weight: set.completedWeight?.value ?? set.weight?.value ?? 0,
          isCompleted: set.isCompleted ?? false,
        })),
      })),
    }));
}
