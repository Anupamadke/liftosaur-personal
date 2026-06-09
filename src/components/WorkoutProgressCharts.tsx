/**
 * WorkoutProgressCharts.tsx
 * Beautiful progress visualization using react-native-svg (already in Liftosaur's deps).
 *
 * Charts included:
 *   1. <OneRMProgressChart>    - Estimated 1RM over time for a single exercise
 *   2. <VolumeBarChart>        - Weekly training volume as bars
 *   3. <MuscleGroupPieChart>   - Muscle group distribution (donut chart)
 *   4. <WorkoutFrequencyChart> - Workout frequency heatmap
 *   5. <ProgressDashboard>     - All charts combined - drop this onto a screen
 *
 * Integration:
 *   import { ProgressDashboard } from "../components/WorkoutProgressCharts";
 *   // Pass workout history from Liftosaur's state
 *   <ProgressDashboard history={workoutHistory} exerciseName="Squat" />
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Svg, Path, Rect, Circle, SvgText, Line, G, Defs, LinearGradient, Stop } from "./primitives/svg";

import {
  get1RMHistory,
  getWeeklyVolume,
  type WorkoutRecord,
} from "../ai/workoutAnalyzer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 180;
const PADDING = { top: 20, right: 16, bottom: 40, left: 48 };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function normalizeData(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate().toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 1. 1RM Progress Line Chart
// ---------------------------------------------------------------------------
interface OneRMProgressChartProps {
  history: WorkoutRecord[];
  exerciseName: string;
}

export function OneRMProgressChart({
  history,
  exerciseName,
}: OneRMProgressChartProps) {
  const data = useMemo(
    () => get1RMHistory(history, exerciseName).slice(-20),
    [history, exerciseName]
  );

  if (data.length < 2) {
    return (
      <ChartCard title={`${exerciseName} - 1RM Progress`}>
        <Text style={styles.emptyText}>
          Need at least 2 sessions to show progress.
        </Text>
      </ChartCard>
    );
  }

  const values = data.map((d) => d.estimated1RM);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const points = data.map((d, i) => ({
    x: PADDING.left + (i / (data.length - 1)) * innerW,
    y: PADDING.top + innerH - ((d.estimated1RM - minVal) / range) * innerH,
    val: d.estimated1RM,
    date: d.date,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${PADDING.top + innerH}` +
    ` L ${points[0].x} ${PADDING.top + innerH} Z`;

  // Y-axis labels
  const yLabels = [minVal, (minVal + maxVal) / 2, maxVal].map((v) => ({
    label: `${Math.round(v)}`,
    y:
      PADDING.top +
      innerH -
      ((v - minVal) / range) * innerH,
  }));

  // X-axis labels - show first, middle, last
  const xIndices = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <ChartCard
      title={`${exerciseName} - Est. 1RM`}
      subtitle={`Peak: ${Math.round(maxVal)}kg`}
    >
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4CAF50" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#4CAF50" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yLabels.map((yl, i) => (
          <G key={i}>
            <Line
              x1={PADDING.left}
              y1={yl.y}
              x2={PADDING.left + innerW}
              y2={yl.y}
              stroke="#333"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <SvgText
              x={PADDING.left - 6}
              y={yl.y + 4}
              fill="#666"
              fontSize="10"
              textAnchor="end"
            >
              {yl.label}
            </SvgText>
          </G>
        ))}

        {/* Area fill */}
        <Path d={areaD} fill="url(#lineGrad)" />

        {/* Line */}
        <Path d={pathD} stroke="#4CAF50" strokeWidth="2" fill="none" />

        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#4CAF50" />
        ))}

        {/* X labels */}
        {xIndices.map((idx) => (
          <SvgText
            key={idx}
            x={points[idx].x}
            y={PADDING.top + innerH + 20}
            fill="#666"
            fontSize="10"
            textAnchor="middle"
          >
            {shortDate(data[idx].date)}
          </SvgText>
        ))}

        {/* Latest value label */}
        <SvgText
          x={points[points.length - 1].x}
          y={points[points.length - 1].y - 8}
          fill="#4CAF50"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
        >
          {Math.round(points[points.length - 1].val)}kg
        </SvgText>
      </Svg>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Weekly Volume Bar Chart
// ---------------------------------------------------------------------------
interface VolumeBarChartProps {
  history: WorkoutRecord[];
}

export function VolumeBarChart({ history }: VolumeBarChartProps) {
  const volumeByMuscle = useMemo(() => getWeeklyVolume(history), [history]);

  const entries = Object.entries(volumeByMuscle)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7);

  if (entries.length === 0) {
    return (
      <ChartCard title="Weekly Volume by Muscle Group">
        <Text style={styles.emptyText}>No workouts in the last 7 days.</Text>
      </ChartCard>
    );
  }

  const maxVal = Math.max(...entries.map(([, v]) => v));
  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const barWidth = (innerW / entries.length) * 0.6;
  const barGap = innerW / entries.length;

  const COLORS = [
    "#4CAF50", "#2196F3", "#FF9800", "#E91E63",
    "#9C27B0", "#00BCD4", "#FF5722",
  ];

  return (
    <ChartCard title="Weekly Volume" subtitle="This week (kg lifted)">
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Bars */}
        {entries.map(([muscle, volume], i) => {
          const barH = (volume / maxVal) * innerH;
          const x = PADDING.left + i * barGap + (barGap - barWidth) / 2;
          const y = PADDING.top + innerH - barH;
          const color = COLORS[i % COLORS.length];

          return (
            <G key={muscle}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={color}
                rx={3}
              />
              {/* Label below bar */}
              <SvgText
                x={x + barWidth / 2}
                y={PADDING.top + innerH + 14}
                fill="#888"
                fontSize="9"
                textAnchor="middle"
              >
                {muscle.length > 5 ? muscle.slice(0, 5) : muscle}
              </SvgText>
              {/* Value on top of bar */}
              {barH > 20 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 4}
                  fill={color}
                  fontSize="9"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {Math.round(volume / 1000)}k
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Axis line */}
        <Line
          x1={PADDING.left}
          y1={PADDING.top + innerH}
          x2={PADDING.left + innerW}
          y2={PADDING.top + innerH}
          stroke="#333"
          strokeWidth="1"
        />
      </Svg>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Muscle Group Donut Chart
// ---------------------------------------------------------------------------
export function MuscleGroupDonutChart({ history }: { history: WorkoutRecord[] }) {
  const volumeByMuscle = useMemo(() => getWeeklyVolume(history), [history]);
  const entries = Object.entries(volumeByMuscle).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <ChartCard title="Muscle Group Split">
        <Text style={styles.emptyText}>No data for this week.</Text>
      </ChartCard>
    );
  }

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const COLORS = [
    "#4CAF50", "#2196F3", "#FF9800", "#E91E63",
    "#9C27B0", "#00BCD4", "#FF5722",
  ];

  const cx = CHART_WIDTH / 2;
  const cy = CHART_HEIGHT / 2;
  const outerR = 65;
  const innerR = 38;

  // Build pie slices
  const slices: { d: string; color: string; label: string; pct: number }[] = [];
  let currentAngle = -Math.PI / 2;

  for (let i = 0; i < entries.length; i++) {
    const [muscle, volume] = entries[i];
    const pct = volume / total;
    const angle = pct * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");

    slices.push({ d, color: COLORS[i % COLORS.length], label: muscle, pct });
    currentAngle = endAngle;
  }

  return (
    <ChartCard title="Muscle Group Split" subtitle="This week">
      <View style={styles.donutRow}>
        <Svg width={CHART_HEIGHT} height={CHART_HEIGHT}>
          {slices.map((slice, i) => (
            <Path key={i} d={slice.d} fill={slice.color} />
          ))}
          <SvgText
            x={cx}
            y={cy - 6}
            fill="#fff"
            fontSize="11"
            textAnchor="middle"
          >
            Volume
          </SvgText>
          <SvgText
            x={cx}
            y={cy + 10}
            fill="#aaa"
            fontSize="10"
            textAnchor="middle"
          >
            split
          </SvgText>
        </Svg>
        {/* Legend */}
        <View style={styles.legend}>
          {entries.slice(0, 6).map(([muscle], i) => (
            <View key={muscle} style={styles.legendRow}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: COLORS[i % COLORS.length] },
                ]}
              />
              <Text style={styles.legendLabel}>
                {muscle}{" "}
                <Text style={styles.legendPct}>
                  {Math.round(slices[i].pct * 100)}%
                </Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 4. Simple stat cards row
// ---------------------------------------------------------------------------
interface StatCardData {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function StatCards({ stats }: { stats: StatCardData[] }) {
  return (
    <View style={styles.statsRow}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={[styles.statCard, { borderTopColor: stat.color ?? "#4CAF50" }]}
        >
          <Text style={[styles.statValue, { color: stat.color ?? "#4CAF50" }]}>
            {stat.value}
          </Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
          {stat.sub && <Text style={styles.statSub}>{stat.sub}</Text>}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5. Full Dashboard - drop this on a screen
// ---------------------------------------------------------------------------
interface ProgressDashboardProps {
  history: WorkoutRecord[];
  /** Which exercise to show 1RM for. Defaults to most frequently done. */
  exerciseName?: string;
}

export function ProgressDashboard({
  history,
  exerciseName,
}: ProgressDashboardProps) {
  const [selectedExercise, setSelectedExercise] = useState(
    exerciseName ?? ""
  );

  // Find the most trained exercises from history
  const topExercises = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const workout of history) {
      for (const ex of workout.exercises) {
        counts[ex.name] = (counts[ex.name] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);
  }, [history]);

  const activeExercise =
    selectedExercise || topExercises[0] || "Squat";

  // Summary stats
  const stats = useMemo((): StatCardData[] => {
    const totalWorkouts = history.length;
    const thisWeek = history.filter(
      (w) => new Date(w.date) >= new Date(Date.now() - 7 * 86400000)
    ).length;
    const totalSets = history.reduce(
      (sum, w) => sum + w.exercises.reduce((s, e) => s + e.sets.filter((st) => st.isCompleted).length, 0),
      0
    );
    const rmData = get1RMHistory(history, activeExercise);
    const bestRM = rmData.length ? Math.max(...rmData.map((d) => d.estimated1RM)) : 0;

    return [
      { label: "Total Workouts", value: String(totalWorkouts), sub: `${thisWeek} this week`, color: "#4CAF50" },
      { label: "Total Sets", value: String(totalSets), sub: "all time", color: "#2196F3" },
      { label: `${activeExercise} 1RM`, value: bestRM ? `${Math.round(bestRM)}kg` : "N/A", sub: "estimated", color: "#FF9800" },
    ];
  }, [history, activeExercise]);

  return (
    <ScrollView
      style={styles.dashboard}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.dashboardContent}
    >
      <Text style={styles.dashboardTitle}>Progress</Text>

      {/* Summary stats */}
      <StatCards stats={stats} />

      {/* Exercise selector for 1RM chart */}
      {topExercises.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.exercisePicker}
          contentContainerStyle={styles.exercisePickerContent}
        >
          {topExercises.map((name) => (
            <TouchableOpacity
              key={name}
              style={[
                styles.exerciseChip,
                activeExercise === name && styles.exerciseChipActive,
              ]}
              onPress={() => setSelectedExercise(name)}
            >
              <Text
                style={[
                  styles.exerciseChipText,
                  activeExercise === name && styles.exerciseChipTextActive,
                ]}
              >
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 1RM chart */}
      <OneRMProgressChart history={history} exerciseName={activeExercise} />

      {/* Volume bar chart */}
      <VolumeBarChart history={history} />

      {/* Muscle group split */}
      <MuscleGroupDonutChart history={history} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  cardHeader: { marginBottom: 12 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  cardSubtitle: { color: "#888", fontSize: 12, marginTop: 2 },
  emptyText: { color: "#666", fontSize: 13, textAlign: "center", paddingVertical: 24 },

  dashboard: { flex: 1, backgroundColor: "#141414" },
  dashboardContent: { padding: 16, paddingBottom: 32 },
  dashboardTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    padding: 12,
    borderTopWidth: 3,
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { color: "#aaa", fontSize: 11, marginTop: 2 },
  statSub: { color: "#666", fontSize: 10, marginTop: 1 },

  exercisePicker: { marginBottom: 12 },
  exercisePickerContent: { gap: 8, paddingHorizontal: 0 },
  exerciseChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#333",
  },
  exerciseChipActive: { backgroundColor: "#1b3a1b", borderColor: "#4CAF50" },
  exerciseChipText: { color: "#888", fontSize: 12 },
  exerciseChipTextActive: { color: "#4CAF50", fontWeight: "600" },

  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legend: { flex: 1, paddingLeft: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendLabel: { color: "#ccc", fontSize: 11 },
  legendPct: { color: "#888", fontSize: 10 },
});

export default ProgressDashboard;
