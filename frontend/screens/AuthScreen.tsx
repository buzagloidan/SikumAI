import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import RobotLogo from '../assets/robot-logo';
import GoogleIcon from '../components/GoogleIcon';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  
  const navigation = useNavigation();
  const { signInWithGoogle, signInWithApple, session } = useSession();
  
  // Check if Apple Authentication is available on this device
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      setAppleAuthAvailable(isAvailable);
    };
    
    checkAppleAuthAvailability();
  }, []);
  
  useEffect(() => {
    if (session) {
      navigation.navigate('Home' as never);
    }
  }, [session, navigation]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    
    try {
      await signInWithGoogle();
      // Note: The actual sign-in will be handled by the auth state change listener
      // in the SessionContext as it's a redirect flow
    } catch (error) {
      console.error('Google sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      await signInWithApple();
    } catch (error) {
      console.error('Apple sign-in error:', error);
    } finally {
      setIsAppleLoading(false);
    }
  };

  const openTermsOfService = () => {
    navigation.navigate('TermsOfService');
  };

  const openPrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.headerContainer}>
          <RobotLogo style={styles.logo} />
          <Text style={styles.title}>
            SikumAI
          </Text>
          <Text style={styles.subtitle}>
            יצירת בחנים חכמים מחומרי הלימוד שלך
          </Text>
        </View>

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            ברוכים הבאים ל-SikumAI
          </Text>
          <Text style={styles.descriptionText}>
            האפליקציה שהופכת את חומרי הלימוד שלך לבחנים אינטראקטיביים חכמים בלחיצת כפתור
          </Text>
        </View>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#4A90E2" />
          ) : (
            <>
              <GoogleIcon size={24} style={styles.googleLogo} />
              <Text style={styles.googleButtonText}>
                התחבר עם Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Show Apple Sign In button on iOS devices and web */}
        {(Platform.OS === 'ios' || Platform.OS === 'web') && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            disabled={isAppleLoading}
          >
            {isAppleLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={24} color="white" style={styles.appleLogo} />
                <Text style={styles.appleButtonText}>
                  התחבר עם Apple
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.termsText}>
          בהתחברות אתה מסכים ל
          <Text style={styles.linkText} onPress={openTermsOfService}>
            תנאי השימוש
          </Text> ול
          <Text style={styles.linkText} onPress={openPrivacyPolicy}>
            מדיניות הפרטיות
          </Text>
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  welcomeContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleLogo: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 18,
    color: '#444',
    fontWeight: '500',
  },
  appleButton: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  appleLogo: {
    marginRight: 12,
  },
  appleButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  termsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  linkText: {
    color: '#4A90E2',
    textDecorationLine: 'underline',
  },
}); 