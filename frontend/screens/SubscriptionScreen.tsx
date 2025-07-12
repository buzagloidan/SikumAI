import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import { useLemonSqueezy } from '../contexts/LemonSqueezyContext';
import { supabase } from '../supabaseClient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import ApplePayLogo from '../assets/apple-pay-logo';
import Constants from 'expo-constants';

type SubscriptionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Subscription'>;

export default function SubscriptionScreen() {
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const { user, subscriptionStatus, refreshSubscriptionStatus } = useSession();
  const { purchaseSubscription, isLoading: lemonSqueezyLoading } = useLemonSqueezy();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Animation values for the plans
  const monthlyScale = useSharedValue(0.95);
  const yearlyScale = useSharedValue(1.05);
  
  // Add focus effect to refresh subscription status
  useFocusEffect(
    React.useCallback(() => {
      refreshSubscriptionStatus();
    }, [refreshSubscriptionStatus])
  );

  // Check for successful purchase
  useEffect(() => {
    const checkSuccess = async () => {
      // Get URL parameters
      const params = new URLSearchParams(window.location.search);
      const success = params.get('success');
      
      if (success === 'true') {
        // Clear the success parameter from URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Show success message
        Alert.alert(
          'תודה על הרכישה!',
          'המנוי שלך פעיל כעת. תוכל ליהנות מכל יתרונות SikumAI פרימיום.',
          [
            {
              text: 'אישור',
              onPress: () => {
                refreshSubscriptionStatus();
                navigation.navigate('Home');
              }
            }
          ]
        );
      }
    };

    if (Platform.OS === 'web') {
      checkSuccess();
    }
  }, [navigation, refreshSubscriptionStatus]);
  
  // Show loading state using only LemonSqueezy
  const isLoading = lemonSqueezyLoading;
  
  const handlePlanSelection = (plan: 'monthly' | 'yearly') => {
    if (plan === 'monthly') {
      monthlyScale.value = withTiming(1.05, { duration: 200 });
      yearlyScale.value = withTiming(0.95, { duration: 200 });
    } else {
      monthlyScale.value = withTiming(0.95, { duration: 200 });
      yearlyScale.value = withTiming(1.05, { duration: 200 });
    }
    setSelectedPlan(plan);
  };
  
  const monthlyAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: monthlyScale.value }]
    };
  });
  
  const yearlyAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: yearlyScale.value }]
    };
  });
  
  const handleSubscribe = async () => {
    console.log('[SubscriptionScreen] handleSubscribe called');
    console.log('[SubscriptionScreen] Selected plan:', selectedPlan);
    
    if (isProcessing) {
      console.log('[SubscriptionScreen] Already processing, ignoring');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Use LemonSqueezy for all platforms
      try {
        console.log('[SubscriptionScreen] Using LemonSqueezy for purchase');
        await purchaseSubscription(selectedPlan);
        console.log('[SubscriptionScreen] LemonSqueezy process initiated successfully');
      } catch (error) {
        console.error('[SubscriptionScreen] LemonSqueezy error:', error);
        if (error instanceof Error && error.message === 'You already have an active subscription') {
          Alert.alert('כבר יש לך מנוי פעיל!', 'אתה נהנה מכל יתרונות SikumAI פרימיום.');
          navigation.navigate('Home');
        } else {
          Alert.alert('שגיאה', 'אירעה שגיאה בעת הרכישה. אנא נסה שוב מאוחר יותר.');
        }
      }
    } catch (error) {
      console.error('[SubscriptionScreen] Subscription error:', error);
      Alert.alert(
        'שגיאה',
        'אירעה שגיאה בעת הרכישה. אנא נסה שוב מאוחר יותר.',
        [{ text: 'אישור', style: 'default' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackButton = () => {
    navigation.goBack();
  };

  // Always show the pricing/subscription UI
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>מנוי SikumAI פרימיום</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>הטבות חברי פרימיום</Text>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• העלאות בלתי מוגבלות של מסמכים</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• יצירת בוחן ללא הגבלה</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• תמיכה במסמכים ארוכים</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• תמיכה מועדפת 24/7</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• ללא פרסומות</Text>
          </View>
        </View>
        
        <View style={styles.plansContainer}>
          {/* Monthly Plan */}
          <Animated.View style={[
            styles.planCard,
            monthlyAnimatedStyle,
            selectedPlan === 'monthly' && styles.selectedPlan
          ]}>
            <TouchableOpacity
              style={styles.planContent}
              onPress={() => handlePlanSelection('monthly')}
              activeOpacity={0.8}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planTitle}>מנוי חודשי</Text>
                <View style={styles.planPriceContainer}>
                  <Text style={styles.planPrice}>₪19.90</Text>
                  <Text style={styles.planPeriod}>/חודש</Text>
                </View>
              </View>
              
              <View style={styles.planDetails}>
                <Text style={styles.planDetailsText}>• חיוב חודשי</Text>
                <Text style={styles.planDetailsText}>• ביטול בכל עת</Text>
                <Text style={styles.planDetailsText}>• נסה חינם לשבוע</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
          
          {/* Yearly Plan */}
          <Animated.View style={[
            styles.planCard,
            yearlyAnimatedStyle,
            selectedPlan === 'yearly' && styles.selectedPlan,
            styles.bestValuePlan
          ]}>
            <View style={styles.bestValueTag}>
              <Text style={styles.bestValueText}>הכי משתלם</Text>
            </View>
            
            <TouchableOpacity
              style={styles.planContent}
              onPress={() => handlePlanSelection('yearly')}
              activeOpacity={0.8}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planTitle}>מנוי שנתי</Text>
                <View style={styles.planPriceContainer}>
                  <Text style={styles.planPrice}>₪199.90</Text>
                  <Text style={styles.planPeriod}>/שנה</Text>
                </View>
              </View>
              
              <View style={styles.savingsContainer}>
                <Text style={styles.savingsText}>17% הנחה</Text>
                <Text style={styles.originalPrice}>₪238.80</Text>
              </View>
              
              <View style={styles.planDetails}>
                <Text style={styles.planDetailsText}>• חיוב שנתי</Text>
                <Text style={styles.planDetailsText}>• חסכון של ₪38.90</Text>
                <Text style={styles.planDetailsText}>• ₪16.66 בלבד לחודש</Text>
                <Text style={styles.planDetailsText}>• נסה חינם לשבוע</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        <TouchableOpacity
          style={styles.subscribeButton}
          onPress={handleSubscribe}
          disabled={isProcessing || isLoading}
        >
          {isProcessing || isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.subscribeButtonText}>
              רכוש מנוי{selectedPlan === 'monthly' ? ' חודשי' : ' שנתי'}
            </Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            ברכישת מנוי, אתה מסכים ל{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => navigation.navigate('TermsOfService')}
            >
              תנאי השימוש
            </Text>
            {' '}ו{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              מדיניות הפרטיות
            </Text>
            {' '}שלנו.
          </Text>
          <Text style={styles.termsText}>
            החיוב יתבצע דרך חשבון ה-{Platform.OS === 'ios' ? 'Apple' : 'Google'} שלך. המנוי יתחדש אוטומטית אלא אם הביטול יבוצע לפחות 24 שעות לפני סיום תקופת המנוי הנוכחית.
          </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    zIndex: 1000,
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
    textAlign: 'center',
    lineHeight: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  featuresContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'right',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'flex-end',
  },
  featureText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'right',
  },
  plansContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  selectedPlan: {
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  bestValuePlan: {
    backgroundColor: 'white',
  },
  bestValueTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 2,
  },
  bestValueText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  planContent: {
    padding: 20,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  planPeriod: {
    fontSize: 14,
    color: '#777',
    marginLeft: 4,
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'flex-end',
  },
  savingsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9500',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  planDetails: {
    alignItems: 'flex-end',
  },
  planDetailsText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    textAlign: 'right',
  },
  subscribeButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  termsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  termsText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  termsLink: {
    textDecorationLine: 'underline',
    color: '#4A90E2',
  },
}); 