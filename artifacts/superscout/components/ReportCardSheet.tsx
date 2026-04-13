import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Share,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useColors } from "@/hooks/useColors";
import ReportCard from "@/components/ReportCard";
import type { ReportCardData } from "@/components/ReportCard";
import PulseCheck from "@/components/PulseCheck";
import { generateReportCard, fetchReportCard } from "@/services/reportCard";

interface ReportCardSheetProps {
  visible: boolean;
  onClose: () => void;
  gameweek: number;
  managerId: number;
  vibe: string;
  streakCount?: number;
}

export default function ReportCardSheet({
  visible,
  onClose,
  gameweek,
  managerId,
  vibe,
  streakCount,
}: ReportCardSheetProps) {
  const colors = useColors();
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPulse, setShowPulse] = useState(false);
  const [sharing, setSharing] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await fetchReportCard(gameweek, managerId);
      if (!data) {
        data = await generateReportCard(gameweek, managerId, vibe);
      }
      if (data) {
        setReport(data);
        pulseTimerRef.current = setTimeout(() => {
          setShowPulse(true);
        }, 2000);
      } else {
        setError("Could not generate your report card. The gameweek may not be finished yet.");
      }
    } catch (err) {
      console.warn("[ReportCard] load failed:", err);
      setError("Something went wrong loading your report card.");
    } finally {
      setLoading(false);
    }
  }, [gameweek, managerId, vibe]);

  useEffect(() => {
    if (visible && !report && !loading) {
      loadReport();
    }
    return () => {
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, [visible, loadReport]);

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current) return;
    setSharing(true);
    try {
      const uri = await (viewShotRef.current as any).capture();
      if (Platform.OS === "ios") {
        await Share.share({ url: uri });
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (err) {
      console.warn("[ReportCard] share failed:", err);
    } finally {
      setSharing(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    setReport(null);
    setError(null);
    setShowPulse(false);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <View style={{ width: 40 }} />
          <Text style={[styles.topBarTitle, { color: colors.foreground }]}>
            GW{gameweek} Report
          </Text>
          <Pressable onPress={handleClose} hitSlop={12} accessibilityLabel="Close report" accessibilityRole="button">
            <Feather name="x" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Generating your report card...
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              <Pressable
                style={[styles.retryButton, { borderColor: colors.border }]}
                onPress={loadReport}
                accessibilityLabel="Try again"
                accessibilityRole="button"
              >
                <Text style={[styles.retryText, { color: colors.foreground }]}>Try Again</Text>
              </Pressable>
            </View>
          )}

          {report && (
            <>
              <View style={styles.offscreen}>
                <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }}>
                  <ReportCard data={report} captureMode={true} streakCount={streakCount} />
                </ViewShot>
              </View>

              <View style={styles.cardPreview}>
                <ReportCard data={report} captureMode={false} streakCount={streakCount} />
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.shareButton, { backgroundColor: "#00ff87" }]}
                  onPress={handleShare}
                  disabled={sharing}
                  accessibilityLabel="Share report"
                  accessibilityRole="button"
                >
                  {sharing ? (
                    <ActivityIndicator size="small" color="#0D0D1A" />
                  ) : (
                    <>
                      <Feather name="share" size={16} color="#0D0D1A" />
                      <Text style={styles.shareButtonText}>Share Report</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>

        <PulseCheck gameweek={gameweek} visible={showPulse} onDismiss={() => setShowPulse(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
    maxWidth: 280,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "500",
  },
  offscreen: {
    position: "absolute",
    left: -9999,
    top: 0,
  },
  cardPreview: {
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  actions: {
    marginTop: 20,
    alignItems: "center",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    gap: 8,
    width: "100%",
  },
  shareButtonText: {
    color: "#0D0D1A",
    fontSize: 16,
    fontWeight: "700",
  },
});
