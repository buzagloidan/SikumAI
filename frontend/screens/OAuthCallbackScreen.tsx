import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../supabaseClient';

export default function OAuthCallbackScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    // Handle the OAuth callback
    const handleOAuthCallback = async () => {
      try {
        // The session should be automatically set by Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('OAuth callback error:', error);
          setTimeout(() => {
            navigation.navigate('Auth' as never);
          }, 1000);
          return;
        }
        
        if (data?.session) {
          console.log('OAuth sign-in successful');
          setTimeout(() => {
            navigation.navigate('Home' as never);
          }, 1000);
        } else {
          console.log('No session found after OAuth');
          setTimeout(() => {
            navigation.navigate('Auth' as never);
          }, 1000);
        }
      } catch (error) {
        console.error('Error handling OAuth callback:', error);
        setTimeout(() => {
          navigation.navigate('Auth' as never);
        }, 1000);
      }
    };

    handleOAuthCallback();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.text}>מתחבר...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f9fc',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
}); 