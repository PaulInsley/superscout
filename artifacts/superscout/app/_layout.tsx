import * as Sentry from "@sentry/react-native";
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
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import SignInScreen from "./onboarding/SignInScreen";
import NotificationConsentScreen from "@/components/NotificationConsentScreen";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  debug: __DEV__,
  enabled: true,
  tracesSampleRate: 0.2,
});

SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

const queryClient = new QueryClient();

type AppScreen = "loading" | "onboarding" | "signIn" | "notificationConsent" | "main";

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [screen, setScreen] = useState<AppScreen>("loading");
  const initialLoadDone = useRef(false);

  const refreshRoute = useCallback(async () => {
    try {
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      if (onboardingDone !== "true") {
        setScreen("onboarding");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      setScreen(session ? "main" : "signIn");
    } catch (err) {
      console.warn("[Layout] route refresh failed:", err);
      setScreen("onboarding");
    }
  }, []);

  useEffect(() => {
    refreshRoute().then(() => { initialLoadDone.current = true; });
  }, [refreshRoute]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      () => {
        if (initialLoadDone.current) {
          refreshRoute();
        }
      },
    );
    return () => subscription.unsubscribe();
  }, [refreshRoute]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && screen !== "loading") {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, screen]);

  if (!fontsLoaded && !fontError) return null;
  if (screen === "loading") return null;

  const handleOnboardingComplete = async () => {
    await refreshRoute();
    const consentShown = await AsyncStorage.getItem("notification_consent_shown");
    if (consentShown !== "true") {
      setScreen("notificationConsent");
      return;
    }
  };

  const handleNotificationConsent = async (enabled: boolean) => {
    await AsyncStorage.setItem("notification_consent_shown", "true");
    if (enabled) {
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
      } catch (err) {
        console.warn("[RootLayout] push notification setup failed:", err);
      }
    }
    await refreshRoute();
  };

  const handleSignInSuccess = () => {
    refreshRoute();
  };

  const handleGoToSignUp = () => {
    setScreen("onboarding");
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SubscriptionProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              {screen === "onboarding" && (
                <OnboardingFlow onComplete={handleOnboardingComplete} />
              )}
              {screen === "signIn" && (
                <SignInScreen
                  onSignInSuccess={handleSignInSuccess}
                  onGoToSignUp={handleGoToSignUp}
                />
              )}
              {screen === "notificationConsent" && (
                <NotificationConsentScreen
                  onEnable={() => handleNotificationConsent(true)}
                  onSkip={() => handleNotificationConsent(false)}
                />
              )}
              {screen === "main" && <RootLayoutNav />}
            </GestureHandlerRootView>
          </SubscriptionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
