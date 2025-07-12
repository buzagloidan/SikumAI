import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Alert,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Switch,
  Share
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import { RootStackParamList } from '../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../supabaseClient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';
import { useIsFocused } from '@react-navigation/native';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { user, signOut } = useSession();
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: user?.email || '',
    avatarUrl: ''
  });
  
  // Animation values for the upgrade card
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  
  useEffect(() => {
    if (user) {
      checkSubscriptionStatus();
      fetchUserProfile();
      
      // Start animation
      startPulseAnimation();
    }
  }, [user]);
  
  // Pulse animation for the upgrade card
  const startPulseAnimation = () => {
    scale.value = withSpring(1.05, { damping: 2 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 2 });
      setTimeout(startPulseAnimation, 3000);
    }, 1500);
  };
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotate.value}deg` }
      ]
    };
  });
  
  const checkSubscriptionStatus = async () => {
    if (!user) return;
    
    try {
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1);
      
      if (subscriptionError) {
        console.error('Error checking subscription:', subscriptionError);
        return;
      }
      
      const hasActiveSubscription = subscriptionData && subscriptionData.length > 0;
      setHasSubscription(hasActiveSubscription);
    } catch (error) {
      console.error('Error checking subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      if (data) {
        setProfileData({
          fullName: data.full_name || '',
          email: user.email || '',
          avatarUrl: data.avatar_url || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בהתנתקות, אנא נסה שוב');
    }
  };
  
  const handleDeleteAccount = async () => {
    console.log('Delete account button clicked');
    
    // For web compatibility, use window.confirm instead of Alert on web
    const shouldDelete = Platform.OS === 'web' 
      ? window.confirm('האם אתה בטוח שברצונך למחוק את החשבון שלך? פעולה זו לא ניתנת לביטול ותמחק את כל הנתונים שלך.')
      : await new Promise(resolve => {
          Alert.alert(
            'מחיקת חשבון',
            'האם אתה בטוח שברצונך למחוק את החשבון שלך? פעולה זו לא ניתנת לביטול ותמחק את כל הנתונים שלך.',
            [
              { text: 'ביטול', style: 'cancel', onPress: () => resolve(false) },
              { text: 'מחיקה', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });
    
    console.log('First confirmation result:', shouldDelete);
    
    if (!shouldDelete) {
      console.log('User cancelled deletion at first prompt');
      return;
    }
    
    // Second confirmation
    const finalConfirmation = Platform.OS === 'web'
      ? window.confirm('לאחר מחיקת החשבון, לא ניתן יהיה לשחזר את הנתונים שלך. האם אתה בטוח?')
      : await new Promise(resolve => {
          Alert.alert(
            'אישור סופי',
            'לאחר מחיקת החשבון, לא ניתן יהיה לשחזר את הנתונים שלך. האם אתה בטוח?',
            [
              { text: 'ביטול', style: 'cancel', onPress: () => resolve(false) },
              { text: 'כן, מחק את החשבון שלי', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });
    
    console.log('Final confirmation result:', finalConfirmation);
    
    if (!finalConfirmation) {
      console.log('User cancelled deletion at final prompt');
      return;
    }
    
    // User confirmed both times, proceed with deletion
    setIsLoading(true);
    console.log('Beginning account deletion process');
    
    try {
      // Get the session to verify we're logged in
      console.log('Checking session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      console.log('Session check result:', { 
        hasSession: !!sessionData?.session,
        error: sessionError ? sessionError.message : null 
      });
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!sessionData.session) {
        console.error('No active session found');
        throw new Error('No active session found. Please log in again.');
      }
      
      console.log('Session found, user is logged in with ID:', sessionData.session.user.id);
      
      // Try direct table deletion first if RPC fails
      try {
        // Call the api_delete_user_account RPC function to handle deletion
        console.log('Calling api_delete_user_account RPC function...');
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('api_delete_user_account');
          
        if (rpcError) {
          console.error('Error calling api_delete_user_account:', rpcError);
          console.log('RPC failed, falling back to direct deletion...');
          throw rpcError;
        }
        
        console.log('RPC function result:', rpcData);
      } catch (rpcError) {
        // Fallback: delete data directly if RPC fails
        console.log('Falling back to direct data deletion...');
        
        // Delete user uploads
        console.log('Deleting user uploads...');
        const { error: uploadsError } = await supabase
          .from('uploads')
          .delete()
          .eq('user_id', sessionData.session.user.id);
          
        if (uploadsError) {
          console.error('Error deleting uploads:', uploadsError);
        } else {
          console.log('Uploads deleted successfully');
        }
        
        // Delete user subscriptions
        console.log('Deleting user subscriptions...');
        const { error: subscriptionsError } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', sessionData.session.user.id);
          
        if (subscriptionsError) {
          console.error('Error deleting subscriptions:', subscriptionsError);
        } else {
          console.log('Subscriptions deleted successfully');
        }
        
        // Update profile to mark as deleted
        console.log('Marking profile as deleted...');
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            is_deleted: true,
            deletion_date: new Date().toISOString(),
            full_name: '[Deleted User]',
            avatar_url: null
          })
          .eq('id', sessionData.session.user.id);
          
        if (profileError) {
          console.error('Error marking profile as deleted:', profileError);
        } else {
          console.log('Profile marked as deleted successfully');
        }
      }
      
      // Account data deleted, sign out
      console.log('User data cleaned up, signing out...');
      await signOut();
      
      if (Platform.OS === 'web') {
        window.alert('נתוני החשבון שלך נמחקו בהצלחה והחשבון סומן למחיקה מלאה.');
      } else {
        Alert.alert(
          'החשבון נמחק',
          'נתוני החשבון שלך נמחקו בהצלחה והחשבון סומן למחיקה מלאה.'
        );
      }
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error deleting account:', error);
      
      if (Platform.OS === 'web') {
        window.alert('אירעה שגיאה בתהליך מחיקת החשבון. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
      } else {
        Alert.alert(
          'שגיאה',
          'אירעה שגיאה בתהליך מחיקת החשבון. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRateApp = () => {
    // Get App Store URL from environment variables or use feedback URL as fallback
    const appStoreUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_APP_STORE_URL || 
                        process.env.EXPO_PUBLIC_APP_STORE_URL;
    const feedbackUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_FEEDBACK_URL || 
                       process.env.EXPO_PUBLIC_FEEDBACK_URL;
    
    // Use appropriate store URL based on platform
    const storeUrl = Platform.OS === 'ios' 
      ? (appStoreUrl || 'https://apps.apple.com')
      : (feedbackUrl || 'https://sikumai.com/feedback');
      
    Linking.canOpenURL(storeUrl).then(supported => {
      if (supported) {
        Linking.openURL(storeUrl);
      } else {
        Alert.alert('שגיאה', 'לא ניתן לפתוח את חנות האפליקציות');
      }
    });
  };
  
  const handleShareApp = async () => {
    // Get site URL from environment variables
    const siteUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SITE_URL || 
                   process.env.EXPO_PUBLIC_SITE_URL || 
                   'https://sikumai.com';
                   
    if (Platform.OS === 'ios') {
      // Use the Share API for iOS
      try {
        const message = `בדקו את SikumAI - האפליקציה שהופכת חומרי לימוד לבחנים אינטראקטיביים! ${siteUrl}`;
        await Share.share({
          message: message,
          url: siteUrl
        });
      } catch (error) {
        console.error('Error sharing:', error);
        Alert.alert('שגיאה', 'לא ניתן לשתף את האפליקציה');
      }
    } else {
      // Use WhatsApp sharing for other platforms
      const message = `בדקו את SikumAI - האפליקציה שהופכת חומרי לימוד לבחנים אינטראקטיביים! ${siteUrl}`;
      const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('שגיאה', 'WhatsApp אינו מותקן במכשיר');
        }
      });
    }
  };
  
  const handleGetHelp = () => {
    const supportEmail = 'hello@sikumai.com';
    Linking.openURL(`mailto:${supportEmail}?subject=SikumAI תמיכה`);
  };
  
  const handleUpgradeToPro = () => {
    try {
      console.log('[SettingsScreen] Navigating to subscription screen');
      navigation.navigate('Subscription');
    } catch (error) {
      console.error('[SettingsScreen] Error navigating to subscription screen:', error);
      
      // Show a friendly error message if navigation fails
      if (Platform.OS === 'web') {
        window.alert('אירעה שגיאה בניסיון להציג את מסך המנויים. אנא נסה שוב מאוחר יותר.');
      } else {
        Alert.alert(
          'שגיאה בניווט', 
          'אירעה שגיאה בניסיון להציג את מסך המנויים. אנא נסה שוב מאוחר יותר.'
        );
      }
    }
  };
  
  // Add new function to handle subscription management
  const handleManageSubscription = async () => {
    // Navigate to subscription screen for all platforms
    navigation.navigate('Subscription');
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>טוען הגדרות...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>הגדרות</Text>
          <View style={styles.placeholder} />
        </View>
        
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {profileData.avatarUrl ? (
              <Image 
                source={{ uri: profileData.avatarUrl }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {profileData.fullName.charAt(0) || profileData.email.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>
            {profileData.fullName || 'משתמש SikumAI'}
          </Text>
          <Text style={styles.profileEmail}>{profileData.email}</Text>
          <View style={styles.accountTypeContainer}>
            <Text style={[
              styles.accountTypeText,
              hasSubscription ? styles.premiumText : styles.freeText
            ]}>
              {hasSubscription ? 'חשבון פרימיום' : 'חשבון חינמי'}
            </Text>
          </View>
        </View>
        
        {/* Subscription Section */}
        {Platform.OS !== 'ios' && (
          <View style={styles.subscriptionSection}>
            <Text style={styles.subscriptionSectionTitle}>מנוי</Text>
            
            <TouchableOpacity 
              style={styles.subscriptionItem}
              onPress={hasSubscription ? handleManageSubscription : handleUpgradeToPro}
            >
              <View style={styles.subscriptionItemLeft}>
                <Text style={styles.subscriptionItemText}>
                  {hasSubscription ? 'נהל את המנוי שלך' : 'שדרג לפרימיום'}
                </Text>
                <Text style={styles.subscriptionItemDescription}>
                  {hasSubscription ? 'מנוי פעיל' : 'העלאות ללא הגבלה, יצירת בחנים, ועוד'}
                </Text>
              </View>
              <View style={[styles.subscriptionItemIcon, hasSubscription ? styles.premiumIcon : {}]}>
                <Text style={styles.settingsItemIconText}>👑</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Upgrade Card - show only if no subscription */}
        {!hasSubscription && Platform.OS !== 'ios' && (
          <Animated.View style={[styles.upgradeCard, animatedStyle]}>
            <LinearGradient
              colors={['#4A90E2', '#5DA8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientBackground}
            >
              <View style={styles.upgradeContent}>
                <View style={styles.upgradeHeader}>
                  <Text style={styles.upgradeTitle}>שדרג לחשבון פרימיום</Text>
                  <Text style={styles.premiumBadge}>PREMIUM</Text>
                </View>
                <Text style={styles.upgradeDescription}>
                  קבל העלאות ללא הגבלה, תמיכה מועדפת ועוד הטבות ייחודיות!
                </Text>
                <TouchableOpacity 
                  style={styles.upgradeButton}
                  onPress={handleUpgradeToPro}
                >
                  <Text style={styles.upgradeButtonText}>שדרג עכשיו</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.upgradeIconContainer}>
                <Text style={styles.upgradeIcon}>⭐️</Text>
                <Text style={styles.upgradeIconSub}>✨</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
        
        {/* Settings Options */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>כללי</Text>
          
          {/* Rate App */}
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={handleRateApp}
          >
            <View style={styles.settingsItemLeft}>
              <Text style={styles.settingsItemText}>דרג את האפליקציה</Text>
            </View>
            <View style={styles.settingsItemIcon}>
              <Text style={styles.settingsItemIconText}>⭐️</Text>
            </View>
          </TouchableOpacity>
          
          {/* Share App */}
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={handleShareApp}
          >
            <View style={styles.settingsItemLeft}>
              <Text style={styles.settingsItemText}>שתף את SikumAI</Text>
            </View>
            <View style={styles.settingsItemIcon}>
              <Text style={styles.settingsItemIconText}>📤</Text>
            </View>
          </TouchableOpacity>
          
          {/* Get Help */}
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={handleGetHelp}
          >
            <View style={styles.settingsItemLeft}>
              <Text style={styles.settingsItemText}>קבל עזרה</Text>
            </View>
            <View style={styles.settingsItemIcon}>
              <Text style={styles.settingsItemIconText}>🛟</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>משפטי</Text>
          
          {/* Privacy Policy */}
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <View style={styles.settingsItemLeft}>
              <Text style={styles.settingsItemText}>מדיניות פרטיות</Text>
            </View>
            <View style={styles.settingsItemIcon}>
              <Text style={styles.settingsItemIconText}>🔒</Text>
            </View>
          </TouchableOpacity>
          
          {/* Terms of Service */}
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={() => navigation.navigate('TermsOfService')}
          >
            <View style={styles.settingsItemLeft}>
              <Text style={styles.settingsItemText}>תנאי שימוש</Text>
            </View>
            <View style={styles.settingsItemIcon}>
              <Text style={styles.settingsItemIconText}>📜</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>חשבון</Text>
          
          {/* Sign Out */}
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={handleSignOut}
          >
            <View style={styles.settingsItemLeft}>
              <Text style={styles.settingsItemText}>התנתק</Text>
            </View>
            <View style={styles.settingsItemIcon}>
              <Text style={styles.settingsItemIconText}>🚪</Text>
            </View>
          </TouchableOpacity>
          
          {/* Delete Account */}
          <TouchableOpacity 
            style={[styles.settingsItem, styles.deleteItem]}
            onPress={handleDeleteAccount}
          >
            <View style={styles.settingsItemLeft}>
              <Text style={[styles.settingsItemText, styles.deleteText]}>מחק חשבון</Text>
            </View>
            <View style={[styles.settingsItemIcon, styles.deleteIcon]}>
              <Text style={styles.settingsItemIconText}>🗑️</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>SikumAI גרסה 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  profileSection: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  accountTypeContainer: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  premiumText: {
    color: '#ff9500',
  },
  freeText: {
    color: '#4A90E2',
  },
  upgradeCard: {
    borderRadius: 16,
    margin: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  gradientBackground: {
    flexDirection: 'row',
    padding: 20,
  },
  upgradeContent: {
    flex: 1,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  premiumBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  upgradeDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  upgradeButtonText: {
    color: '#4A90E2',
    fontWeight: 'bold',
    fontSize: 16,
  },
  upgradeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: 60,
  },
  upgradeIcon: {
    fontSize: 40,
  },
  upgradeIconSub: {
    fontSize: 20,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  settingsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'right',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsItemLeft: {
    flex: 1,
    alignItems: 'flex-end',
  },
  settingsItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
  },
  settingsItemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'right',
  },
  settingsItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  settingsItemIconText: {
    fontSize: 18,
  },
  deleteItem: {
    borderBottomWidth: 0,
  },
  deleteText: {
    color: '#FF3B30',
  },
  deleteIcon: {
    backgroundColor: '#ffebe9',
  },
  versionContainer: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
  premiumIcon: {
    backgroundColor: '#FFD700',
  },
  subscriptionSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  subscriptionSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 16,
    textAlign: 'right',
  },
  subscriptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  subscriptionItemLeft: {
    flex: 1,
    alignItems: 'flex-end',
  },
  subscriptionItemText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  subscriptionItemDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  subscriptionItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  section: {
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  levelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelButton: {
    padding: 8,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 8,
  },
  activeLevelButton: {
    backgroundColor: '#4A90E2',
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeLevelText: {
    color: 'white',
  },
}); 