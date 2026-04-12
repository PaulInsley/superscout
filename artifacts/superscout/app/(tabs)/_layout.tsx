import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "person.3", selected: "person.3.fill" }} />
        <Label>Players</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="captain">
        <Icon sf={{ default: "crown", selected: "crown.fill" }} />
        <Label>Captain</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transfers">
        <Icon sf={{ default: "arrow.left.arrow.right", selected: "arrow.left.arrow.right" }} />
        <Label>Transfers</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="banter">
        <Icon sf={{ default: "flame", selected: "flame.fill" }} />
        <Label>Banter</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="card">
        <Icon sf={{ default: "square.and.arrow.up", selected: "square.and.arrow.up.fill" }} />
        <Label>Card</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="squad">
        <Icon sf={{ default: "sportscourt", selected: "sportscourt.fill" }} />
        <Label>My Squad</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Players",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.3" tintColor={color} size={24} />
            ) : (
              <Feather name="users" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="captain"
        options={{
          title: "Captain",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="crown" tintColor={color} size={24} />
            ) : (
              <Feather name="award" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="transfers"
        options={{
          title: "Transfers",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.left.arrow.right" tintColor={color} size={24} />
            ) : (
              <Feather name="repeat" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="banter"
        options={{
          title: "Banter",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="flame" tintColor={color} size={24} />
            ) : (
              <Feather name="message-circle" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: "Card",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.and.arrow.up" tintColor={color} size={24} />
            ) : (
              <Feather name="share" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: "My Squad",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="sportscourt" tintColor={color} size={24} />
            ) : (
              <Feather name="shield" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="gearshape" tintColor={color} size={24} />
            ) : (
              <Feather name="settings" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
