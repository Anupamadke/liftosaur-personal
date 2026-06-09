/**
 * ExerciseVideoPlayer.tsx
 * Embeds a YouTube tutorial video for a given exercise.
 *
 * Uses react-native-webview (already in Liftosaur's dependencies).
 *
 * Strategy:
 *   1. Check exerciseVideoMap for a known curated video ID
 *   2. Fall back to a YouTube search for "{exerciseName} tutorial form"
 *
 * Integration - add to Liftosaur's exercise detail screen:
 *   import { ExerciseVideoPlayer } from "../components/ExerciseVideoPlayer";
 *   // In render:
 *   <ExerciseVideoPlayer exerciseName="Barbell Back Squat" />
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { getVideoForExercise } from "../data/exerciseVideoMap";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 16:9 aspect ratio
const VIDEO_WIDTH = SCREEN_WIDTH - 32;
const VIDEO_HEIGHT = Math.round(VIDEO_WIDTH * 9 / 16);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExerciseVideoPlayerProps {
  exerciseName: string;
  /** Show collapsed initially with a "Watch tutorial" button. Default: true */
  collapsible?: boolean;
  /** Callback when user opens/closes the player */
  onToggle?: (isOpen: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExerciseVideoPlayer({
  exerciseName,
  collapsible = true,
  onToggle,
}: ExerciseVideoPlayerProps) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const [isLoading, setIsLoading] = useState(true);

  const videoInfo = getVideoForExercise(exerciseName);

  // Build the embed URL
  const embedUrl = videoInfo.type === "id"
    ? `https://www.youtube.com/embed/${videoInfo.value}?autoplay=0&rel=0&modestbranding=1`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(videoInfo.value)}`;

  const toggle = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    setIsLoading(true);
    onToggle?.(next);
  }, [isOpen, onToggle]);

  if (!isOpen) {
    return (
      <TouchableOpacity style={styles.collapsedBtn} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.collapsedBtnIcon}>▶</Text>
        <View>
          <Text style={styles.collapsedBtnTitle}>Watch Tutorial</Text>
          <Text style={styles.collapsedBtnSub}>
            {videoInfo.type === "id" ? "Curated video" : "YouTube search"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Tutorial: {exerciseName}
        </Text>
        <TouchableOpacity onPress={toggle} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Video container */}
      <View style={[styles.videoContainer, { height: VIDEO_HEIGHT }]}>
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loaderText}>Loading video...</Text>
          </View>
        )}
        <WebView
          style={styles.webview}
          source={{ uri: embedUrl }}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // Prevent WebView from stealing focus from the app
          startInLoadingState={false}
        />
      </View>

      {/* Source note */}
      <Text style={styles.sourceNote}>
        {videoInfo.type === "id"
          ? "Curated tutorial video"
          : `YouTube: "${videoInfo.value}"`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#333",
  },

  collapsedBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#333",
    gap: 12,
  },
  collapsedBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF0000",
    textAlign: "center",
    lineHeight: 36,
    fontSize: 14,
    color: "#fff",
    overflow: "hidden",
  },
  collapsedBtnTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  collapsedBtnSub: { color: "#888", fontSize: 12, marginTop: 2 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#242424",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1, marginRight: 8 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: "#aaa", fontSize: 16 },

  videoContainer: {
    width: "100%",
    backgroundColor: "#000",
    position: "relative",
  },
  webview: { flex: 1, backgroundColor: "#000" },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loaderText: { color: "#aaa", marginTop: 8, fontSize: 12 },

  sourceNote: {
    color: "#666",
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 6,
    textAlign: "center",
  },
});

export default ExerciseVideoPlayer;
