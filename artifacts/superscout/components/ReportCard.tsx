import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

export interface ReportCardData {
  gameweek: number;
  total_points: number;
  average_points: number;
  rank_movement: number;
  overall_rank: number;
  captain_name: string;
  captain_points: number;
  star_rating: number;
  decision_quality_score: number;
  captain_quality_score: number;
  transfer_quality_score: number;
  commentary: string;
  season?: string;
}

interface ReportCardProps {
  data: ReportCardData;
  captureMode?: boolean;
  streakCount?: number;
}

function getStarLabel(stars: number): string {
  switch (stars) {
    case 5:
      return "Perfect week";
    case 4:
      return "Great decision-making";
    case 3:
      return "Solid decisions";
    case 2:
      return "Room to improve";
    default:
      return "Tough week";
  }
}

const ReportCard = forwardRef<View, ReportCardProps>(
  ({ data, captureMode = false, streakCount }, ref) => {
    const width = captureMode ? 1080 : undefined;
    const scale = captureMode ? 1 : 1;
    const fs = (size: number) => size * scale;

    const pointsDiff = data.total_points - data.average_points;
    const isGreenArrow = data.rank_movement > 0;
    const isRedArrow = data.rank_movement < 0;

    return (
      <View
        ref={ref}
        style={[
          styles.container,
          captureMode && { width, padding: 60 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontSize: fs(22) }]}>
            Gameweek {data.gameweek} Report Card
          </Text>
          <Text style={[styles.headerSeason, { fontSize: fs(13) }]}>
            {data.season ?? "2025-26"}
          </Text>
        </View>

        <View style={styles.starsSection}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Text
                key={i}
                style={[
                  styles.star,
                  {
                    fontSize: fs(captureMode ? 56 : 40),
                    color: i <= data.star_rating ? "#f59e0b" : "#333",
                  },
                ]}
              >
                ★
              </Text>
            ))}
          </View>
          <Text style={[styles.starLabel, { fontSize: fs(16) }]}>
            {data.star_rating} out of 5 — {getStarLabel(data.star_rating)}
          </Text>
          <Text style={[styles.qualityScore, { fontSize: fs(13) }]}>
            Decision quality: {data.decision_quality_score}/100
          </Text>
        </View>

        <View style={styles.pointsSection}>
          <View style={styles.pointsRow}>
            <View style={styles.pointsItem}>
              <Text style={[styles.pointsValue, { fontSize: fs(28) }]}>
                {data.total_points}
              </Text>
              <Text style={[styles.pointsLabel, { fontSize: fs(12) }]}>
                Your points
              </Text>
            </View>
            <View style={styles.pointsItem}>
              <Text style={[styles.pointsValue, { fontSize: fs(28) }]}>
                {data.average_points}
              </Text>
              <Text style={[styles.pointsLabel, { fontSize: fs(12) }]}>
                Average
              </Text>
            </View>
            <View style={styles.pointsItem}>
              <Text
                style={[
                  styles.pointsValue,
                  {
                    fontSize: fs(28),
                    color: pointsDiff >= 0 ? "#22c55e" : "#ef4444",
                  },
                ]}
              >
                {pointsDiff >= 0 ? "+" : ""}
                {pointsDiff}
              </Text>
              <Text style={[styles.pointsLabel, { fontSize: fs(12) }]}>
                Difference
              </Text>
            </View>
          </View>

          {data.rank_movement !== 0 && (
            <View style={styles.rankRow}>
              <Feather
                name={isGreenArrow ? "arrow-up" : "arrow-down"}
                size={fs(16)}
                color={isGreenArrow ? "#22c55e" : "#ef4444"}
              />
              <Text
                style={[
                  styles.rankText,
                  {
                    fontSize: fs(14),
                    color: isGreenArrow ? "#22c55e" : "#ef4444",
                  },
                ]}
              >
                {Math.abs(data.rank_movement).toLocaleString()} places
              </Text>
              <Text style={[styles.rankOverall, { fontSize: fs(12) }]}>
                Overall rank: {data.overall_rank?.toLocaleString() ?? "N/A"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.captainSection}>
          <Text style={[styles.sectionTitle, { fontSize: fs(14) }]}>
            Captain Review
          </Text>
          <View style={styles.captainRow}>
            <Text style={[styles.captainIcon, { fontSize: fs(20) }]}>
              ©
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.captainName, { fontSize: fs(16) }]}>
                {data.captain_name}
              </Text>
              <Text style={[styles.captainPoints, { fontSize: fs(13) }]}>
                {data.captain_points} pts (captain)
              </Text>
            </View>
            <View
              style={[
                styles.captainBadge,
                {
                  backgroundColor:
                    data.captain_quality_score >= 70
                      ? "#22c55e20"
                      : data.captain_quality_score >= 40
                        ? "#f59e0b20"
                        : "#ef444420",
                },
              ]}
            >
              <Text
                style={[
                  styles.captainBadgeText,
                  {
                    fontSize: fs(12),
                    color:
                      data.captain_quality_score >= 70
                        ? "#22c55e"
                        : data.captain_quality_score >= 40
                          ? "#f59e0b"
                          : "#ef4444",
                  },
                ]}
              >
                {data.captain_quality_score >= 70
                  ? "Great pick"
                  : data.captain_quality_score >= 40
                    ? "Decent pick"
                    : "Missed opportunity"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.commentarySection}>
          <Text style={[styles.commentary, { fontSize: fs(14) }]}>
            "{data.commentary}"
          </Text>
        </View>

        {(streakCount ?? 0) > 0 && (
          <View style={styles.streakSection}>
            <Text style={[styles.streakIcon, { fontSize: fs(18) }]}>
              🔥
            </Text>
            <Text style={[styles.streakText, { fontSize: fs(13) }]}>
              {streakCount} GW streak
            </Text>
          </View>
        )}

        {captureMode && (
          <View style={styles.branding}>
            <Text style={styles.brandingText}>SuperScout</Text>
            <Text style={styles.brandingSub}>
              AI-Powered FPL Coach
            </Text>
          </View>
        )}
      </View>
    );
  },
);

ReportCard.displayName = "ReportCard";
export default ReportCard;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0D0D1A",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "700",
  },
  headerSeason: {
    color: "#666",
    marginTop: 4,
  },
  starsSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
  },
  star: {
    lineHeight: 48,
  },
  starLabel: {
    color: "#fff",
    fontWeight: "600",
    marginTop: 10,
  },
  qualityScore: {
    color: "#888",
    marginTop: 4,
  },
  pointsSection: {
    backgroundColor: "#161625",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pointsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  pointsItem: {
    alignItems: "center",
  },
  pointsValue: {
    color: "#fff",
    fontWeight: "700",
  },
  pointsLabel: {
    color: "#888",
    marginTop: 4,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 6,
  },
  rankText: {
    fontWeight: "600",
  },
  rankOverall: {
    color: "#888",
    marginLeft: 8,
  },
  captainSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    color: "#888",
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  captainRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161625",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  captainIcon: {
    color: "#f59e0b",
    fontWeight: "700",
  },
  captainName: {
    color: "#fff",
    fontWeight: "600",
  },
  captainPoints: {
    color: "#888",
    marginTop: 2,
  },
  captainBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  captainBadgeText: {
    fontWeight: "600",
  },
  commentarySection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#1a1a2e",
    marginHorizontal: 16,
  },
  commentary: {
    color: "#ccc",
    lineHeight: 22,
    fontStyle: "italic",
  },
  streakSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
    gap: 6,
  },
  streakIcon: {},
  streakText: {
    color: "#f97316",
    fontWeight: "600",
  },
  branding: {
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#1a1a2e",
  },
  brandingText: {
    color: "#00ff87",
    fontSize: 16,
    fontWeight: "700",
  },
  brandingSub: {
    color: "#666",
    fontSize: 11,
    marginTop: 2,
  },
});
