import { JSX } from "react";
import { useTrackedState } from "../TrackedStateContext";
import { AIAssistant } from "../../components/AIAssistant";
import { mapLiftosaurHistory } from "../../utils/workoutMapper";

export function NavScreenAI(): JSX.Element {
  const state = useTrackedState();
  const workoutHistory = mapLiftosaurHistory(state.storage.history);

  return (
    <AIAssistant
      workoutHistory={workoutHistory}
      userGoals={{
        primaryGoal: "strength",
        weightUnit: state.storage.settings.units === "metric" ? "kg" : "lbs",
      }}
      theme={state.storage.settings.theme === "dark" ? "dark" : "light"}
    />
  );
}
