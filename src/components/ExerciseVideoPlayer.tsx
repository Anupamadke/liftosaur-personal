/**
 * ExerciseVideoPlayer.tsx
 * Opens YouTube search for an exercise tutorial - same approach as the Lyfta app.
 * Tapping opens YouTube app (or browser) with a search for the exercise.
 * No WebView embedding - avoids error 153 (embedding disabled by video owner).
 */

import React from "react";
import { TouchableOpacity, Text, View, StyleSheet, Linking } from "react-native";

interface ExerciseVideoPlayerProps {
  exerciseName: string;
  /** Unused - kept for API compatibility */
  collapsible?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export function ExerciseVideoPlayer({ exerciseName }: ExerciseVideoPlayerProps) {
  const openYouTube = () => {
    const query = encodeURIComponent(`how to ${exerciseName} instructions`);
    const url = `https://m.youtube.com/results?search_query=${query}#searching`;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <TouchableOpacity style={styles.btn} onPress={openYouTube} activeOpacity={0.75}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>▶</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Watch Tutorial on YouTube</Text>
        <Text style={styles.sub}>{exerciseName} - form & instructions</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FF0000",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 2,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  sub: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  arrow: {
    color: "#555",
    fontSize: 22,
    lineHeight: 24,
  },
});

export default ExerciseVideoPlayer;
