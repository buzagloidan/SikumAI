import React, { createContext, useState, useEffect, useContext } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '../supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type SubscriptionStatus = 'active' | 'inactive' | 'loading';

type SessionContextType = {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  subscriptionStatus: SubscriptionStatus;
  refreshSubscriptionStatus: () => Promise<void>;
  loading: boolean;
  profileData: {
    fullName: string;
    email: string;
    avatarUrl: string;
  };
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('loading');
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    avatarUrl: '',
  });
  
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    console.log('[SessionContext] Initializing auth state...');
    
    // Check if we have a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[SessionContext] Initial session check:', {
        hasSession: !!session,
        userId: session?.user?.id,
        timestamp: new Date().toISOString(),
        userObject: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          aud: session.user.aud
        } : null
      });
      
      if (session?.user) {
        setUser(session.user);
        console.log('[SessionContext] User state updated:', {
          id: session.user.id,
          timestamp: new Date().toISOString()
        });
      }
      setSession(session);
      
      if (session?.user) {
        console.log('[SessionContext] Active session found, refreshing data...');
        refreshSubscriptionStatus();
        // Add small delay to ensure user state is set
        setTimeout(() => {
          fetchUserProfile();
        }, 100);
      } else {
        console.log('[SessionContext] No active session');
        setSubscriptionStatus('inactive');
      }
      
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[SessionContext] Auth state changed:', {
        hasSession: !!session,
        userId: session?.user?.id,
        timestamp: new Date().toISOString(),
        event: _event,
        userObject: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          aud: session.user.aud
        } : null
      });
      
      if (session?.user) {
        setUser(session.user);
        console.log('[SessionContext] User state updated in auth change:', {
          id: session.user.id,
          timestamp: new Date().toISOString()
        });
      }
      setSession(session);
      
      if (session?.user) {
        console.log('[SessionContext] New session detected, refreshing data...');
        refreshSubscriptionStatus();
        // Add small delay to ensure user state is set
        setTimeout(() => {
          fetchUserProfile();
        }, 100);
      } else {
        console.log('[SessionContext] Session ended');
        setSubscriptionStatus('inactive');
      }
      
      setLoading(false);
    });

    return () => {
      console.log('[SessionContext] Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const refreshSubscriptionStatus = async () => {
    if (!user) return;
    
    setSubscriptionStatus('loading');
    
    try {
      // Check subscription status from the user_subscriptions table
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.log('Error checking subscription:', error);
        setSubscriptionStatus('inactive');
        return;
      }
      
      // If no subscription found, status is inactive
      if (!data) {
        console.log('No subscription found for user');
        setSubscriptionStatus('inactive');
        return;
      }
      
      setSubscriptionStatus(data.status === 'active' ? 'active' : 'inactive');
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setSubscriptionStatus('inactive');
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      Alert.alert(
        'הרשמה בוצעה בהצלחה',
        'נשלח מייל אימות לכתובת שהזנת. אנא אשר את המייל כדי להשלים את ההרשמה.'
      );
    } catch (error) {
      console.error('Error signing up:', error);
      Alert.alert('שגיאה בהרשמה', error instanceof Error ? error.message : 'אירעה שגיאה לא ידועה');
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in:', error);
      Alert.alert('שגיאה בהתחברות', error instanceof Error ? error.message : 'אירעה שגיאה לא ידועה');
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Different approach for web vs mobile
      if (Platform.OS === 'web') {
        // Web flow - use OAuth with redirect
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            // Use the custom domain in production, or public domain from Railway environment variable if available
            redirectTo: typeof window !== 'undefined' && window.location.hostname !== 'localhost'
              ? `${window.location.origin}/auth/callback`
              : window.location.origin + '/auth/callback',
          },
        });
        
        if (error) throw error;
      } else {
        // Mobile flow - use appropriate URL format for the environment
        let redirectUrl = makeRedirectUri({
          scheme: 'sikumai',
          path: 'auth/callback',
        });
        
        console.log('Using redirect URL:', redirectUrl);
        
        // Use Supabase's OAuth flow
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });
        
        if (error) throw error;
        if (!data?.url) throw new Error('No URL returned from Supabase');
        
        // Open the URL in a browser
        console.log('Opening URL:', data.url);
        
        try {
          // Use openAuthSessionAsync for authentication
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectUrl
          );
          
          console.log('Auth result:', result.type);
          
          if (result.type === 'success') {
            // If success, get the code from URL
            const { url } = result;
            console.log('Success URL:', url);
            
            // Parse the URL to get code
            const parsedUrl = new URL(url);
            const code = parsedUrl.searchParams.get('code');
            
            if (!code) {
              console.error('No code found in URL');
              return;
            }
            
            console.log('Got code from URL, exchanging for session');
            
            // Exchange code for session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging code for session:', error);
              throw error;
            }
            
            console.log('Session exchanged successfully');
            setSession(data.session);
            setUser(data.session?.user ?? null);
            
            if (data.session) {
              refreshSubscriptionStatus();
            }
          }
        } catch (e) {
          console.error('Error during auth session:', e);
        }
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      Alert.alert('שגיאה בהתחברות עם Google', error instanceof Error ? error.message : 'אירעה שגיאה לא ידועה');
    }
  };

  const signOut = async () => {
    try {
      // First clear the local state
      setUser(null);
      setSession(null);
      setSubscriptionStatus('inactive');
      setProfileData({
        fullName: '',
        email: '',
        avatarUrl: '',
      });

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Force clear the stored session from AsyncStorage
      await AsyncStorage.removeItem('supabase-auth-token');
      
      // Only navigate if we have access to navigation
      try {
        navigation.navigate('Auth');
      } catch (navError) {
        console.log('Navigation not available during sign out');
      }
      
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('שגיאה בהתנתקות', error instanceof Error ? error.message : 'אירעה שגיאה לא ידועה');
    }
  };

  const signInWithApple = async () => {
    try {
      console.log('Starting Apple Sign In process...');
      
      // Different approach for web vs mobile
      if (Platform.OS === 'web') {
        // Web flow - use OAuth with redirect
        console.log('Using web OAuth flow for Apple Sign In');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: typeof window !== 'undefined' && window.location.hostname !== 'localhost'
              ? `${window.location.origin}/auth/callback`
              : window.location.origin + '/auth/callback',
            skipBrowserRedirect: false,
          },
        });
        
        if (error) throw error;
        console.log('Web OAuth initiated successfully');
      } else {
        // Mobile flow - use native Apple Authentication
        // Check if Apple Authentication is available on this device
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('Apple Authentication available:', isAvailable);
        
        if (!isAvailable) {
          Alert.alert('התחברות עם Apple', 'התחברות עם Apple אינה זמינה במכשיר זה');
          return;
        }

        // Request sign-in with Apple
        console.log('Requesting Apple authentication...');
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        
        console.log('Received Apple credentials:', {
          hasIdentityToken: !!credential.identityToken,
          hasFullName: !!(credential.fullName?.givenName || credential.fullName?.familyName),
          email: credential.email ? 'Present' : 'Not present'
        });

        // Use the credential's identityToken to sign in with Supabase
        if (credential.identityToken) {
          console.log('Attempting Supabase sign in with Apple token...');
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });

          if (error) {
            console.error('Supabase Apple sign-in error:', error);
            throw error;
          }
          
          console.log('Supabase sign in successful:', {
            hasSession: !!data.session,
            userId: data.session?.user?.id
          });
          
          // Ensure session is properly stored
          if (data.session) {
            // Force session persistence
            await supabase.auth.setSession(data.session);
            
            // Update local state
            setSession(data.session);
            setUser(data.session.user);
            
            // Verify session was stored
            const { data: sessionCheck } = await supabase.auth.getSession();
            console.log('Session verification:', {
              sessionExists: !!sessionCheck.session,
              userId: sessionCheck.session?.user?.id
            });
            
            if (!sessionCheck.session) {
              throw new Error('Failed to persist session');
            }
            
            // Update subscription status and profile
            await refreshSubscriptionStatus();
            
            // Store user info if it's a first-time sign in
            if (credential.fullName && (credential.fullName.givenName || credential.fullName.familyName)) {
              console.log('Updating user profile with Apple name data...');
              const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                  id: data.session.user.id,
                  first_name: credential.fullName.givenName,
                  last_name: credential.fullName.familyName,
                  updated_at: new Date().toISOString(),
                });

              if (updateError) {
                console.error('Error updating user profile:', updateError);
              } else {
                console.log('User profile updated successfully');
              }
            }
          } else {
            throw new Error('No session data received from Supabase');
          }
        } else {
          throw new Error('לא התקבל טוקן זיהוי מ-Apple');
        }
      }
    } catch (error: any) {
      // Don't show an alert for cancelled request
      if (error.code === 'ERR_CANCELED') {
        console.log('User cancelled Apple sign in');
        return;
      }
      
      console.error('Error signing in with Apple:', error);
      Alert.alert('שגיאה בהתחברות עם Apple', error instanceof Error ? error.message : 'אירעה שגיאה לא ידועה');
    }
  };

  const fetchUserProfile = async () => {
    console.log('[SessionContext] fetchUserProfile called:', {
      hasUser: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString(),
      userState: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        aud: user.aud
      } : null
    });

    if (!user) {
      console.log('[SessionContext] No user in state, checking session...');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('[SessionContext] Found user in session, updating state:', {
          id: session.user.id,
          timestamp: new Date().toISOString()
        });
        setUser(session.user);
        // Continue with the profile fetch using session user
        await fetchProfileWithUser(session.user);
      } else {
        console.log('[SessionContext] No user in session either, skipping profile fetch');
        return;
      }
    } else {
      await fetchProfileWithUser(user);
    }
  };

  const fetchProfileWithUser = async (currentUser: any) => {
    try {
      console.log('[SessionContext] Fetching profile with user:', {
        userId: currentUser.id,
        timestamp: new Date().toISOString()
      });

      // Get user metadata from OAuth if available
      const userMetadata = currentUser.user_metadata || {};
      const oauthName = userMetadata.full_name || userMetadata.name || '';
      const oauthPicture = userMetadata.avatar_url || userMetadata.picture || '';

      // First check if profile exists
      const { data: profileExists, error: checkError } = await supabase
        .from('profiles')
        .select('id, created_at, full_name, avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle();
        
      console.log('[SessionContext] Profile existence check:', {
        exists: !!profileExists,
        error: checkError ? `${checkError.code}: ${checkError.message}` : null,
        timestamp: new Date().toISOString()
      });

      if (!profileExists && !checkError) {
        console.log('[SessionContext] Creating new profile with OAuth data...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{ 
            id: currentUser.id,
            email: currentUser.email,
            full_name: oauthName,
            avatar_url: oauthPicture,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
          
        console.log('[SessionContext] Profile creation result:', {
          success: !!newProfile,
          error: createError ? `${createError.code}: ${createError.message}` : null,
          timestamp: new Date().toISOString()
        });

        if (createError) {
          throw createError;
        }

        // Set profile data from newly created profile
        setProfileData({
          fullName: oauthName,
          email: currentUser.email || '',
          avatarUrl: oauthPicture
        });
        return;
      }

      // If profile exists but doesn't have name/avatar, update it with OAuth data
      if (profileExists && (!profileExists.full_name || !profileExists.avatar_url) && (oauthName || oauthPicture)) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            full_name: oauthName || profileExists.full_name,
            avatar_url: oauthPicture || profileExists.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentUser.id);

        if (updateError) {
          console.error('[SessionContext] Error updating profile with OAuth data:', updateError);
        }
      }

      // Now fetch the full profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        console.log('[SessionContext] Profile fetched successfully:', {
          profileId: data.id,
          timestamp: new Date().toISOString()
        });
        setProfileData({
          fullName: data.full_name || oauthName || '',
          email: currentUser.email || '',
          avatarUrl: data.avatar_url || oauthPicture || ''
        });
      }
    } catch (error) {
      console.error('[SessionContext] Error in profile operations:', {
        error,
        userId: currentUser.id,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        user,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        signInWithApple,
        subscriptionStatus,
        refreshSubscriptionStatus,
        loading,
        profileData,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}; 