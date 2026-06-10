/**
 * AIAssistant.tsx - AI Coach for Liftosaur (personal build)
 * Uses Google Gemini (free API from aistudio.google.com)
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
  ScrollView,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createMMKV } from "react-native-mmkv";
import { WorkoutAIAnalyzer, buildWorkoutContext } from "../ai/workoutAnalyzer";
import type { WorkoutRecord, UserGoals } from "../ai/workoutAnalyzer";
import { AI_STORAGE_KEYS } from "../ai/geminiService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface AIAssistantProps {
  workoutHistory?: WorkoutRecord[];
  userGoals?: UserGoals;
  onClose?: () => void;
  theme?: "dark" | "light";
}

function genId(): string {
  return Math.random().toString(36).slice(2);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Setup Screen - shown when no API key
// ---------------------------------------------------------------------------
function SetupScreen({ onSave, isDark }: { onSave: (key: string) => void; isDark: boolean }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    const key = draft.trim();
    if (key.length < 20) {
      setError("Please paste your full API key from Google AI Studio");
      return;
    }
    onSave(key);
  };

  return (
    <ScrollView
      contentContainerStyle={[setup.container, isDark && { backgroundColor: "#1a1a1a" }]}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: isDark ? "#1a1a1a" : "#fff" }}
    >
      {/* Icon */}
      <Text style={setup.robot}>🤖</Text>
      <Text style={[setup.title, isDark && { color: "#fff" }]}>Set Up AI Coach</Text>
      <Text style={[setup.subtitle, isDark && { color: "#aaa" }]}>
        AI Coach uses Google Gemini to analyse your workouts and give personalised advice.
        The free tier is more than enough for personal use.
      </Text>

      {/* Step 1 */}
      <View style={setup.step}>
        <View style={setup.stepNum}><Text style={setup.stepNumText}>1</Text></View>
        <View style={setup.stepBody}>
          <Text style={setup.stepTitle}>Get your free API key</Text>
          <Text style={setup.stepDesc}>Takes about 1 minute. No credit card needed.</Text>
          <TouchableOpacity
            style={setup.linkBtn}
            onPress={() => Linking.openURL("https://aistudio.google.com/apikey")}
          >
            <Text style={setup.linkBtnText}>Open aistudio.google.com →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Step 2 */}
      <View style={setup.step}>
        <View style={setup.stepNum}><Text style={setup.stepNumText}>2</Text></View>
        <View style={setup.stepBody}>
          <Text style={setup.stepTitle}>Sign in with Google and click "Get API key"</Text>
          <Text style={setup.stepDesc}>Then click "Create API key" → copy the full key</Text>
        </View>
      </View>

      {/* Step 3 */}
      <View style={setup.step}>
        <View style={setup.stepNum}><Text style={setup.stepNumText}>3</Text></View>
        <View style={setup.stepBody}>
          <Text style={setup.stepTitle}>Paste your key below</Text>
        </View>
      </View>

      <TextInput
        style={[setup.input, error ? setup.inputError : null]}
        placeholder="Paste your API key"
        placeholderTextColor="#666"
        value={draft}
        onChangeText={(t) => { setDraft(t); setError(""); }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text style={setup.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[setup.saveBtn, !draft.trim() && setup.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!draft.trim()}
      >
        <Text style={setup.saveBtnText}>Save & Start Chatting</Text>
      </TouchableOpacity>

      <Text style={setup.note}>
        🔒 Your key is stored only on this phone. It is never sent anywhere except Google's servers.
      </Text>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View style={[bubble.row, isUser ? bubble.rowUser : bubble.rowAI]}>
      {!isUser && (
        <View style={bubble.avatar}>
          <Text style={bubble.avatarText}>AI</Text>
        </View>
      )}
      <View style={[bubble.wrap, isUser ? bubble.wrapUser : bubble.wrapAI]}>
        <Text style={[bubble.text, isUser ? bubble.textUser : bubble.textAI]}>{message.text}</Text>
        <Text style={bubble.time}>{formatTime(message.timestamp)}</Text>
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

  // Lazy MMKV init - inside component so errors are caught by Error Boundary
  const storageRef = useRef<ReturnType<typeof createMMKV> | null>(null);
  if (!storageRef.current) {
    storageRef.current = createMMKV({ id: "liftosaur-ai" });
  }
  const storage = storageRef.current;

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
      text: "Hi! I'm your AI coach powered by Gemini. Ask me anything about your training, or use the quick actions below. 💪",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const workoutContext = buildWorkoutContext(workoutHistory, 10);

  const handleSaveKey = useCallback((key: string) => {
    storage.set(AI_STORAGE_KEYS.GEMINI_API_KEY, key);
    setApiKey(key);
    setAnalyzer(new WorkoutAIAnalyzer(key));
  }, []);

  const addMessage = useCallback((role: "user" | "assistant", text: string) => {
    setMessages((prev) => [...prev, { id: genId(), role, text, timestamp: new Date() }]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !analyzer || isLoading) return;
      setInputText("");
      addMessage("user", text);
      setIsLoading(true);
      try {
        const systemPrompt = `You are a knowledgeable, friendly personal fitness coach. 
The user's recent workout data:\n${workoutContext}\n
Give concise, actionable advice. Use metric or imperial units based on their preference.`;
        const reply = await analyzer.gemini.chat(text, [], systemPrompt);
        addMessage("assistant", reply);
      } catch (e) {
        addMessage("assistant", `Sorry, I hit an error: ${String(e)}. Check your API key in Settings.`);
      } finally {
        setIsLoading(false);
      }
    },
    [analyzer, isLoading, addMessage, workoutContext]
  );

  const quickActions = [
    {
      label: "Suggest Progression",
      emoji: "💪",
      prompt: "Based on my recent workouts, what weights should I increase and by how much?",
    },
    {
      label: "Analyse Progress",
      emoji: "📊",
      prompt: "Analyse my recent training progress. What's going well and what needs attention?",
    },
    {
      label: "Deload Check",
      emoji: "😴",
      prompt: "Do I need a deload week? Analyse my volume and fatigue from recent sessions.",
    },
    {
      label: "Suggest Program",
      emoji: "🎯",
      prompt: "Based on my current lifts and goals, suggest a good training program for me.",
    },
  ];

  const isDark = theme === "dark";

  // Show setup screen if no API key
  if (!apiKey) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#1a1a1a" : "#fff" }}>
        <SetupScreen onSave={handleSaveKey} isDark={isDark} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[chat.container, isDark ? chat.dark : chat.light]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 60}
    >
      {/* Header */}
      <View style={[chat.header, isDark ? chat.headerDark : chat.headerLight]}>
        <Text style={[chat.headerTitle, isDark && chat.textLight]}>🤖 AI Coach</Text>
        <TouchableOpacity
          onPress={() => {
            storage.delete(AI_STORAGE_KEYS.GEMINI_API_KEY);
            setApiKey("");
            setAnalyzer(null);
          }}
          style={chat.changeKeyBtn}
        >
          <Text style={chat.changeKeyBtnText}>Change Key</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={chat.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {isLoading && (
        <View style={chat.loadingRow}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={[chat.loadingText, isDark && chat.textLight]}>Thinking...</Text>
        </View>
      )}

      {/* Quick actions */}
      {!isLoading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={chat.quickScroll}
          contentContainerStyle={chat.quickContent}
        >
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={chat.quickBtn}
              onPress={() => sendMessage(action.prompt)}
            >
              <Text style={chat.quickEmoji}>{action.emoji}</Text>
              <Text style={chat.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={[chat.inputRow, isDark ? chat.inputRowDark : chat.inputRowLight]}>
        <TextInput
          style={[chat.input, isDark ? chat.inputDark : chat.inputLight]}
          placeholder="Ask your coach..."
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          blurOnSubmit={false}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[chat.sendBtn, (!inputText.trim() || isLoading) && chat.sendBtnOff]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || isLoading}
        >
          <Text style={chat.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Setup screen styles
// ---------------------------------------------------------------------------
const setup = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: "#fff",
  },
  robot: { fontSize: 56, textAlign: "center", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center", color: "#1a1a1a", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 20, marginBottom: 28 },
  step: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepNumText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "#555", lineHeight: 18 },
  linkBtn: {
    marginTop: 8,
    backgroundColor: "#ede9fe",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  linkBtnText: { color: "#7c3aed", fontWeight: "600", fontSize: 13 },
  input: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1a1a1a",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    marginBottom: 6,
  },
  inputError: { borderColor: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 12, marginBottom: 8 },
  saveBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  saveBtnDisabled: { backgroundColor: "#c4b5fd" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  note: { fontSize: 12, color: "#9ca3af", textAlign: "center", lineHeight: 18 },
});

// ---------------------------------------------------------------------------
// Chat screen styles
// ---------------------------------------------------------------------------
const bubble = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 12 },
  rowUser: { justifyContent: "flex-end" },
  rowAI: { justifyContent: "flex-start", gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  avatarText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  wrap: { maxWidth: "75%", borderRadius: 16, padding: 10 },
  wrapUser: { backgroundColor: "#7c3aed", borderBottomRightRadius: 4 },
  wrapAI: { backgroundColor: "#f3f4f6", borderBottomLeftRadius: 4 },
  text: { fontSize: 14, lineHeight: 20 },
  textUser: { color: "#fff" },
  textAI: { color: "#1a1a1a" },
  time: { fontSize: 10, color: "#aaa", marginTop: 4, textAlign: "right" },
});

const chat = StyleSheet.create({
  container: { flex: 1 },
  dark: { backgroundColor: "#1a1a1a" },
  light: { backgroundColor: "#f9fafb" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerDark: { backgroundColor: "#111", borderBottomColor: "#333" },
  headerLight: { backgroundColor: "#fff", borderBottomColor: "#e5e7eb" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  textLight: { color: "#fff" },
  changeKeyBtn: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeKeyBtnText: { color: "#7c3aed", fontSize: 12, fontWeight: "600" },

  messageList: { paddingVertical: 12, flexGrow: 1 },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: { color: "#666", fontSize: 13 },

  quickScroll: { maxHeight: 64 },
  quickContent: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ede9fe",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickEmoji: { fontSize: 14 },
  quickLabel: { color: "#7c3aed", fontSize: 13, fontWeight: "600" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  inputRowDark: { backgroundColor: "#111", borderTopColor: "#333" },
  inputRowLight: { backgroundColor: "#fff", borderTopColor: "#e5e7eb" },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
  },
  inputDark: { backgroundColor: "#222", borderColor: "#444", color: "#fff" },
  inputLight: { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb", color: "#1a1a1a" },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnOff: { backgroundColor: "#c4b5fd" },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: -2 },
});

export default AIAssistant;
