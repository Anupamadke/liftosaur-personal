/**
 * AIAssistant.tsx
 * Drop-in AI chat panel for Liftosaur.
 *
 * Features:
 * - Conversational chat with Gemini
 * - Quick-action buttons (Suggest progression, Analyze progress, etc.)
 * - API key settings modal
 * - Persists API key in MMKV storage
 *
 * Integration:
 *   1. Add this to a new screen or modal in Liftosaur
 *   2. Pass `workoutHistory` from Liftosaur's state
 *   3. Pass `userGoals` if available
 *
 * Deps already in Liftosaur: react-native-mmkv, react-native-safe-area-context
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createMMKV } from "react-native-mmkv";

import { WorkoutAIAnalyzer, buildWorkoutContext } from "../ai/workoutAnalyzer";
import type { WorkoutRecord, UserGoals } from "../ai/workoutAnalyzer";
import { AI_STORAGE_KEYS } from "../ai/geminiService";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const storage = createMMKV({ id: "liftosaur-ai" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  emoji: string;
  buildPrompt: () => Promise<string>;
}

interface AIAssistantProps {
  workoutHistory?: WorkoutRecord[];
  userGoals?: UserGoals;
  /** Called when user dismisses the panel (if used as modal) */
  onClose?: () => void;
  /** Dark or light theme */
  theme?: "dark" | "light";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function genId(): string {
  return Math.random().toString(36).slice(2);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Settings Modal
// ---------------------------------------------------------------------------
interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  currentKey: string;
}

function SettingsModal({ visible, onClose, onSave, currentKey }: SettingsModalProps) {
  const [draft, setDraft] = useState(currentKey);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Gemini API Key</Text>
          <Text style={styles.modalBody}>
            Get a free key at{" "}
            <Text style={styles.link}>aistudio.google.com</Text>
            {"\n\n"}Your key is stored locally on-device only. Never sent anywhere except Google's API.
          </Text>
          <TextInput
            style={styles.keyInput}
            placeholder="AIza..."
            placeholderTextColor="#888"
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !draft.trim() && styles.saveBtnDisabled]}
              onPress={() => {
                if (!draft.trim()) return;
                onSave(draft.trim());
                onClose();
              }}
              disabled={!draft.trim()}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.avatarDot}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
        ]}
      >
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
          {message.text}
        </Text>
        <Text style={styles.bubbleTime}>{formatTime(message.timestamp)}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AIAssistant({
  workoutHistory = [],
  userGoals,
  onClose,
  theme = "dark",
}: AIAssistantProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [apiKey, setApiKey] = useState<string>(
    () => storage.getString(AI_STORAGE_KEYS.GEMINI_API_KEY) ?? ""
  );
  const [analyzer, setAnalyzer] = useState<WorkoutAIAnalyzer | null>(
    () => (apiKey ? new WorkoutAIAnalyzer(apiKey) : null)
  );

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: apiKey
        ? "Hi! I'm your AI coach. Ask me anything about your training, or use the quick actions below."
        : "Set your Gemini API key (tap ⚙️) to get started. It's free at aistudio.google.com",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const workoutContext = buildWorkoutContext(workoutHistory, 10);

  const handleSaveKey = useCallback((key: string) => {
    storage.set(AI_STORAGE_KEYS.GEMINI_API_KEY, key);
    setApiKey(key);
    setAnalyzer(new WorkoutAIAnalyzer(key));
    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        role: "assistant",
        text: "API key saved! I'm ready to help with your training.",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const addMessage = useCallback((role: "user" | "assistant", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: genId(), role, text, timestamp: new Date() },
    ]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !analyzer || isLoading) return;

      addMessage("user", text);
      setInputText("");
      setIsLoading(true);

      try {
        const reply = await analyzer.chat(text, workoutContext);
        addMessage("assistant", reply);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        addMessage(
          "assistant",
          `Error: ${message}. Check your API key in settings.`
        );
      } finally {
        setIsLoading(false);
      }
    },
    [analyzer, isLoading, workoutContext, addMessage]
  );

  // Quick action buttons
  const quickActions: QuickAction[] = [
    {
      emoji: "📈",
      label: "Next weights",
      buildPrompt: async () => {
        if (!analyzer) throw new Error("No API key");
        return analyzer.suggestProgression(workoutHistory, userGoals);
      },
    },
    {
      emoji: "📊",
      label: "Analyze progress",
      buildPrompt: async () => {
        if (!analyzer) throw new Error("No API key");
        return analyzer.analyzeProgress(workoutHistory, userGoals);
      },
    },
    {
      emoji: "🗓️",
      label: "Make program",
      buildPrompt: async () => {
        if (!analyzer) throw new Error("No API key");
        return analyzer.generateProgram(
          userGoals ?? { primaryGoal: "strength", daysPerWeek: 3 }
        );
      },
    },
    {
      emoji: "💪",
      label: "Deload advice",
      buildPrompt: async () => {
        if (!analyzer) throw new Error("No API key");
        return analyzer.chat(
          "Based on my training history, do I need a deload? If yes, what should it look like?",
          workoutContext
        );
      },
    },
  ];

  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      if (!analyzer || isLoading) return;
      addMessage("user", action.label);
      setIsLoading(true);
      try {
        const reply = await action.buildPrompt();
        addMessage("assistant", reply);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        addMessage("assistant", `Error: ${message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [analyzer, isLoading, addMessage]
  );

  const isDark = theme === "dark";

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 60}
    >
      {/* Header */}
      <View style={[styles.header, isDark ? styles.headerDark : styles.headerLight]}>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>AI Coach</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />

      {/* Setup banner - shown when no API key */}
      {!apiKey && (
        <TouchableOpacity
          style={styles.setupBanner}
          onPress={() => setShowSettings(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.setupBannerEmoji}>🔑</Text>
          <View style={styles.setupBannerText}>
            <Text style={styles.setupBannerTitle}>Tap here to set up your free Gemini API key</Text>
            <Text style={styles.setupBannerSub}>Get it free at aistudio.google.com · Takes 1 minute</Text>
          </View>
          <Text style={styles.setupBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>
            Thinking...
          </Text>
        </View>
      )}

      {/* Quick actions */}
      {!isLoading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickActionsScroll}
          contentContainerStyle={styles.quickActionsContent}
        >
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.quickBtn, !analyzer && styles.quickBtnDisabled]}
              onPress={() => handleQuickAction(action)}
              disabled={!analyzer}
            >
              <Text style={styles.quickBtnEmoji}>{action.emoji}</Text>
              <Text style={styles.quickBtnLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={[styles.inputRow, isDark ? styles.inputRowDark : styles.inputRowLight]}>
        <TextInput
          style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
          placeholder={analyzer ? "Ask your coach..." : "Add API key to chat"}
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage(inputText)}
          blurOnSubmit={false}
          editable={!!analyzer && !isLoading}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() || !analyzer || isLoading) && styles.sendBtnDisabled,
          ]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || !analyzer || isLoading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveKey}
        currentKey={apiKey}
      />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: "#1a1a1a" },
  containerLight: { backgroundColor: "#f5f5f5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerDark: { backgroundColor: "#242424", borderBottomColor: "#333" },
  headerLight: { backgroundColor: "#fff", borderBottomColor: "#e0e0e0" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#333" },
  headerRight: { flexDirection: "row", gap: 8 },
  headerBtn: { padding: 8 },
  headerBtnText: { fontSize: 18 },

  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  bubbleRow: { flexDirection: "row", marginVertical: 4, alignItems: "flex-end" },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAI: { justifyContent: "flex-start" },

  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  avatarText: { fontSize: 10, color: "#fff", fontWeight: "700" },

  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleUser: { backgroundColor: "#4CAF50", borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: "#2c2c2c", borderBottomLeftRadius: 4 },

  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextAI: { color: "#e8e8e8" },

  bubbleTime: { fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4, textAlign: "right" },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: { fontSize: 13, color: "#888" },

  quickActionsScroll: { maxHeight: 64 },
  quickActionsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  quickBtn: {
    backgroundColor: "#2c2c2c",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#444",
  },
  quickBtnDisabled: { opacity: 0.4 },
  quickBtnEmoji: { fontSize: 14 },
  quickBtnLabel: { fontSize: 12, color: "#ccc" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  inputRowDark: { backgroundColor: "#242424", borderTopColor: "#333" },
  inputRowLight: { backgroundColor: "#fff", borderTopColor: "#e0e0e0" },

  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  inputDark: { backgroundColor: "#333", color: "#fff" },
  inputLight: { backgroundColor: "#f0f0f0", color: "#333" },

  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#333" },
  sendBtnText: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: -2 },

  // Setup banner (shown when no API key)
  setupBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a1f00",
    borderWidth: 1,
    borderColor: "#7a5c00",
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  setupBannerEmoji: { fontSize: 22 },
  setupBannerText: { flex: 1 },
  setupBannerTitle: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  setupBannerSub: { color: "#aaa", fontSize: 11, marginTop: 2 },
  setupBannerArrow: { color: "#888", fontSize: 22, lineHeight: 24 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#242424",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 12 },
  modalBody: { fontSize: 13, color: "#aaa", lineHeight: 20, marginBottom: 16 },
  link: { color: "#4CAF50" },
  keyInput: {
    backgroundColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#fff",
    marginBottom: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#333",
    alignItems: "center",
  },
  cancelBtnText: { color: "#ccc", fontWeight: "600" },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: "#3a6e3a" },
  saveBtnText: { color: "#fff", fontWeight: "600" },

  textLight: { color: "#fff" },
});

export default AIAssistant;
