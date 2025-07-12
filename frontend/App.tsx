import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator, Platform, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { SessionProvider } from './contexts/SessionContext';
import { LemonSqueezyProvider } from './contexts/LemonSqueezyContext';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import QuizScreen from './screens/QuizScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import OAuthCallbackScreen from './screens/OAuthCallbackScreen';
import ApiTestScreen from './screens/ApiTestScreen';
import SettingsScreen from './screens/SettingsScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from './screens/TermsOfServiceScreen';
import * as Linking from 'expo-linking';
import { supabase } from './supabaseClient';
import * as WebBrowser from 'expo-web-browser';
import NotificationService from './services/NotificationService';
import Constants from 'expo-constants';

// Ignore specific warnings that might affect the UI
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

// Initialize error handling
const handleError = (error: Error, isFatal?: boolean) => {
  console.error('App Error:', error, isFatal ? '(Fatal)' : '');
  // You can add more error reporting here
};

// Set up global error handler
if (Platform.OS !== 'web' && typeof ErrorUtils !== 'undefined') {
  ErrorUtils.setGlobalHandler(handleError);
}

// Initialize WebBrowser for OAuth
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (error) {
  console.error('WebBrowser initialization error:', error);
}

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(console.warn);

// Create the navigator
const Stack = createNativeStackNavigator();

// Get site URL from env or fall back to default scheme
const siteUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SITE_URL || 
               process.env.EXPO_PUBLIC_SITE_URL;

// Deep linking configuration
const linking = {
  prefixes: ['sikumai://', ...(siteUrl ? [siteUrl] : [])],
  config: {
    initialRouteName: 'Home' as const,
    screens: {
      Auth: 'auth',
      Home: '',
      Upload: 'upload',
      Quiz: 'quiz/:id',
      Subscription: 'subscription',
      OAuthCallback: 'auth/callback',
      Settings: 'settings',
      PrivacyPolicy: 'privacypolicy',
      TermsOfService: 'termsofservice',
    },
  },
};

// Error boundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorDetail}>{this.state.error?.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  // Separate useEffect for notifications to not block app initialization
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        if (Platform.OS !== 'web') {
          const hasPermission = await NotificationService.requestPermissions().catch(() => false);
          if (hasPermission) {
            await NotificationService.scheduleDailyReminder().catch(console.error);
          }
        }
      } catch (err) {
        console.error('Notification setup failed:', err);
        // Don't set error state - let app continue without notifications
      }
    };

    // Run notification setup in background
    setupNotifications();
  }, []);

  useEffect(() => {
    // Initialize essential services
    const init = async () => {
      try {
        // Initialize WebBrowser
        await WebBrowser.maybeCompleteAuthSession();
        
        // Mark app as ready
        setIsReady(true);

        // Wait a moment to ensure the UI is ready before hiding splash screen
        setTimeout(async () => {
          await SplashScreen.hideAsync().catch(err => {
            console.warn('Error hiding splash screen:', err);
          });
        }, 300);
      } catch (error) {
        console.error('Initialization error:', error);
        setIsReady(true); // Still mark as ready to avoid hanging
        setTimeout(async () => {
          await SplashScreen.hideAsync().catch(console.warn);
        }, 300);
      }
    };

    init();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <SessionProvider>
            <LemonSqueezyProvider>
              <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                  headerShown: false,
                }}
              >
                <Stack.Screen name="Auth" component={AuthScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Upload" component={UploadScreen} />
                <Stack.Screen name="Quiz" component={QuizScreen} />
                <Stack.Screen name="Subscription" component={SubscriptionScreen} />
                <Stack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
                <Stack.Screen name="ApiTest" component={ApiTestScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
              </Stack.Navigator>
              <StatusBar style="auto" />
            </LemonSqueezyProvider>
          </SessionProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    marginBottom: 10,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
