import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";
import {
  requestPushPermissions,
  getExpoPushToken,
  registerTokenWithServer,
} from "@/services/notifications/pushNotificationService";
import { supabase } from "@/services/supabase";
import OnboardingFlow, {
  ONBOARDING_COMPLETE_KEY,
} from "./onboarding/OnboardingFlow";

SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((value) => {
        setShowOnboarding(value !== "true");
      })
      .catch(() => {
        setShowOnboarding(true);
      })
      .finally(() => {
        setOnboardingChecked(true);
      });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).then((val) => {
            if (val !== "true") {
              setShowOnboarding(true);
            }
          });
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && onboardingChecked) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, onboardingChecked]);

  if (!fontsLoaded && !fontError) return null;
  if (!onboardingChecked) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SubscriptionProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                {showOnboarding ? (
                  <OnboardingFlow
                    onComplete={async () => {
                      setShowOnboarding(false);
                      try {
                        const granted = await requestPushPermissions();
                        if (granted) {
                          const token = await getExpoPushToken();
                          if (token) {
                            const domain = process.env.EXPO_PUBLIC_DOMAIN;
                            if (domain) {
                              const { getAuthenticatedUserId } = await import("@/services/auth");
                              const authUserId = await getAuthenticatedUserId();
                              if (authUserId) {
                                await registerTokenWithServer(
                                  `https://${domain}/api`,
                                  authUserId,
                                  token,
                                );
                              }
                            }
                          }
                        }
                      } catch {}
                    }}
                  />
                ) : (
                  <RootLayoutNav />
                )}
            </GestureHandlerRootView>
          </SubscriptionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
