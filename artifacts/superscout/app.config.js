const IS_EAS_BUILD = process.env.EAS_BUILD === "true";

const config = {
  expo: {
    name: "SuperScout",
    slug: "superscout",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "superscout",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#0D0D1A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "pro.superscout.app",
      buildNumber: "1",
      infoPlist: {
        NSPhotoLibraryAddUsageDescription:
          "SuperScout needs access to save your Squad Card to your photos",
      },
    },
    android: {
      package: "pro.superscout.app",
      versionCode: 1,
    },
    web: {
      favicon: "./assets/images/icon.png",
    },
    plugins: [
      ["expo-router", { origin: "https://replit.com/" }],
      "expo-font",
      "expo-web-browser",
      ...(IS_EAS_BUILD
        ? ["react-native-purchases", ["expo-media-library"]]
        : []),
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};

module.exports = config;
