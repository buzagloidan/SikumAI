// Standalone app config without requiring app.json
module.exports = {
  name: "SikumAI",
  slug: "sikumai",
  version: "1.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/expo-splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  scheme: "sikumai",
  assetBundlePatterns: [
    "assets/*.png"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.sikumai.app",
    buildNumber: "58",
    infoPlist: {
      NSCameraUsageDescription: "SikumAI needs camera access to scan documents for creating quizzes",
      NSPhotoLibraryUsageDescription: "SikumAI needs access to your photos to upload documents for creating quizzes",
      UIBackgroundModes: [
        "fetch",
        "remote-notification"
      ],
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false
    },
    usesIcloudStorage: false,
    associatedDomains: [
      "applinks:sikumai.com",
      "applinks:*.sikumai.com"
    ]
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.sikumai.app",
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "READ_MEDIA_AUDIO"
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "sikumai",
            host: "*"
          }
        ],
        category: [
          "BROWSABLE",
          "DEFAULT"
        ]
      }
    ]
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
    output: "single",
    staticRenderingEnabled: false,
    build: {
      babel: {
        include: [
          "node_modules/@expo/vector-icons",
          "node_modules/react-native-svg",
          "node_modules/react-native-web"
        ]
      }
    }
  },
  plugins: [
    [
      "expo-build-properties",
      {
        "ios": {
          "useFrameworks": "static",
          "deploymentTarget": "15.1",
          "flipper": false,
          "enableSonarNativeMetrics": false
        }
      }
    ],
    "expo-splash-screen"
  ],
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "YOUR_EAS_PROJECT_ID_PLACEHOLDER"
    },
    // These values will be overridden by environment variables 
    // (e.g., from a .env file) during the build process.
    // It's good practice to not hardcode production secrets here.
    // process.env.VARIABLE_NAME is how Expo accesses them.
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ujaafvzorxllabjtixip.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqYWFmdnpvcnhsbGFianRpeGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MTU0MDgsImV4cCI6MjA1NTk5MTQwOH0.vaaMirlhfeojVTeXSWHBW18OhobBRcNHRVFX5olOVFY",
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || "https://sikumai-production.up.railway.app",
    EXPO_PUBLIC_SITE_URL: process.env.EXPO_PUBLIC_SITE_URL || "https://sikumai.com",
    EXPO_PUBLIC_APP_STORE_URL: process.env.EXPO_PUBLIC_APP_STORE_URL || "https://apps.apple.com/il/app/%D7%A1%D7%99%D7%9B%D7%95%D7%9Dai-%D7%9C%D7%9E%D7%99%D7%93%D7%94-%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%90%D7%A7%D7%98%D7%99%D7%91%D7%99%D7%AA/id6743373915",
    EXPO_PUBLIC_FEEDBACK_URL: process.env.EXPO_PUBLIC_FEEDBACK_URL || "YOUR_FEEDBACK_URL_PLACEHOLDER"
  },
  updates: {
    url: process.env.EXPO_PUBLIC_UPDATE_URL || "YOUR_UPDATE_URL_PLACEHOLDER"
  },
  runtimeVersion: {
    policy: "appVersion"
  },
  owner: process.env.EXPO_PUBLIC_OWNER || "your-expo-username",
  sdkVersion: "53.0.0",
  platforms: [
    "ios",
    "android",
    "web"
  ]
}; 