import { JSX, Component, ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTrackedState } from "../TrackedStateContext";
import { AIAssistant } from "../../components/AIAssistant";
import { mapLiftosaurHistory } from "../../utils/workoutMapper";

// ---------------------------------------------------------------------------
// Error Boundary - catches any render crash in AIAssistant
// ---------------------------------------------------------------------------
interface IEBState { error: string | null }
class AIErrorBoundary extends Component<{ children: ReactNode }, IEBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: unknown): IEBState {
    return { error: String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.errBox}>
          <Text style={styles.errTitle}>⚠️ AI Coach Error</Text>
          <Text style={styles.errMsg}>{this.state.error}</Text>
          <Text style={styles.errHint}>
            Screenshot this and share with the developer to get it fixed.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Inner screen - wrapped by the error boundary
// ---------------------------------------------------------------------------
function AIScreenInner(): JSX.Element {
  const state = useTrackedState();

  let workoutHistory = [];
  try {
    workoutHistory = mapLiftosaurHistory(state.storage.history);
  } catch (_e) {
    // If mapper fails, proceed with empty history
  }

  const units = state.storage.settings.units;
  const theme = state.storage.settings.theme;

  return (
    <AIAssistant
      workoutHistory={workoutHistory}
      userGoals={{
        primaryGoal: "strength",
        weightUnit: units === "metric" ? "kg" : "lbs",
      }}
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}

// ---------------------------------------------------------------------------
// Exported screen
// ---------------------------------------------------------------------------
export function NavScreenAI(): JSX.Element {
  return (
    <AIErrorBoundary>
      <AIScreenInner />
    </AIErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errBox: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errTitle: { fontSize: 20, fontWeight: "700", color: "#dc2626", marginBottom: 12 },
  errMsg: {
    fontSize: 13,
    color: "#444",
    textAlign: "center",
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errHint: { fontSize: 12, color: "#888", textAlign: "center" },
});
