import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSubscription } from "@/lib/revenuecat";
import { logSubscriptionEvent, updateUserSubscriptionTier } from "@/services/subscriptionEvents";

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
}

export default function Paywall({ visible, onClose }: PaywallProps) {
  const insets = useSafeAreaInsets();
  const { offerings, purchase, restore, isPurchasing, isRestoring } = useSubscription();
  const [error, setError] = useState<string | null>(null);

  const currentOffering = offerings?.current;
  const annualPackage = currentOffering?.annual;
  const monthlyPackage = currentOffering?.monthly;

  const seasonPassPrice = annualPackage?.product.priceString || "£29.99/year";
  const monthlyPrice = monthlyPackage?.product.priceString || "£4.99/month";

  const handlePurchase = async (pkg: any) => {
    if (!pkg) return;
    setError(null);
    try {
      await purchase(pkg);

      const productId = pkg?.product?.identifier || "";
      const toTier = productId.includes("season_pass") ? "season_pass" as const : "pro_monthly" as const;
      logSubscriptionEvent({
        eventType: "signup",
        fromTier: "free",
        toTier,
      });
      updateUserSubscriptionTier(toTier);

      onClose();
    } catch (err: any) {
      if (err?.userCancelled) return;
      setError("Couldn't complete the purchase — check your connection and try again.");
    }
  };

  const handleRestore = async () => {
    setError(null);
    try {
      const customerInfo = await restore();

      const proEntitlement = customerInfo?.entitlements?.active?.["pro"];
      if (proEntitlement) {
        const productId = proEntitlement.productIdentifier || "";
        const toTier = productId.includes("season_pass") ? "season_pass" as const : "pro_monthly" as const;
        logSubscriptionEvent({
          eventType: "resubscribe",
          fromTier: "free",
          toTier,
        });
        updateUserSubscriptionTier(toTier);
      }

      onClose();
    } catch (err: any) {
      setError("Couldn't restore purchases. Please try again.");
    }
  };

  const isWorking = isPurchasing || isRestoring;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
          <Feather name="x" size={24} color="#ffffff" />
        </Pressable>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <Text style={styles.headline}>Unlock SuperScout Pro</Text>
            <Text style={styles.subtitle}>Better decisions in 2 minutes, not 30.</Text>
          </View>

          <View style={styles.benefits}>
            <View style={styles.benefitRow}>
              <Feather name="mic" size={18} color="#00ff87" />
              <Text style={styles.benefitText}>All 3 vibes — Expert, Critic, and Fanboy</Text>
            </View>
            <View style={styles.benefitRow}>
              <Feather name="layers" size={18} color="#00ff87" />
              <Text style={styles.benefitText}>Full choice architecture — see every option, not just one</Text>
            </View>
            <View style={styles.benefitRow}>
              <Feather name="share-2" size={18} color="#00ff87" />
              <Text style={styles.benefitText}>AI-powered Squad Cards your mates will actually screenshot</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.buttonsContainer}>
            <Pressable
              onPress={() => handlePurchase(annualPackage)}
              disabled={isWorking || !annualPackage}
              style={({ pressed }) => [
                styles.seasonPassButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>Best value</Text>
              </View>
              {isPurchasing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.seasonPassTitle}>Season Pass</Text>
                  <Text style={styles.seasonPassPrice}>{seasonPassPrice}</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => handlePurchase(monthlyPackage)}
              disabled={isWorking || !monthlyPackage}
              style={({ pressed }) => [
                styles.monthlyButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.monthlyTitle}>Pro Monthly</Text>
              <Text style={styles.monthlyPrice}>{monthlyPrice}</Text>
            </Pressable>
          </View>

          <Pressable onPress={handleRestore} disabled={isWorking} style={styles.restoreButton}>
            {isRestoring ? (
              <ActivityIndicator size="small" color="#8888aa" />
            ) : (
              <Text style={styles.restoreText}>Restore purchases</Text>
            )}
          </Pressable>

          <Text style={styles.legalText}>
            By subscribing you agree to our{" "}
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL("https://superscout.pro/privacy")}
            >
              Privacy Policy
            </Text>
            {" "}and{" "}
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL("https://superscout.pro/terms")}
            >
              Terms of Service
            </Text>
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "web" ? 20 : 56,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: "center",
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 16,
    color: "#8888aa",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  benefits: {
    width: "100%",
    gap: 16,
    marginBottom: 32,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  benefitText: {
    fontSize: 15,
    color: "#ffffff",
    flex: 1,
    fontFamily: "Inter_500Medium",
    lineHeight: 21,
  },
  errorContainer: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  buttonsContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  seasonPassButton: {
    backgroundColor: "#4338ca",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    position: "relative",
  },
  bestValueBadge: {
    position: "absolute",
    top: -10,
    backgroundColor: "#00ff87",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bestValueText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0D0D1A",
    fontFamily: "Inter_700Bold",
  },
  seasonPassTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 2,
    fontFamily: "Inter_700Bold",
  },
  seasonPassPrice: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
  },
  monthlyButton: {
    backgroundColor: "#1e1e2e",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  monthlyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 2,
    fontFamily: "Inter_600SemiBold",
  },
  monthlyPrice: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
  },
  restoreButton: {
    paddingVertical: 12,
  },
  restoreText: {
    fontSize: 14,
    color: "#8888aa",
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
  legalText: {
    fontSize: 11,
    color: "#666680",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  legalLink: {
    color: "#8888aa",
    textDecorationLine: "underline",
  },
});
