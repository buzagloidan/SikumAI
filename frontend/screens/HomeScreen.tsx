import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Dimensions, 
  ActivityIndicator, 
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  Animated as RNAnimated,
  Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import { RootStackParamList } from '../types/navigation';
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../supabaseClient';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { getBaseApiUrl as getConfigBaseUrl, getApiUrl as getConfigApiUrl } from '../utils/apiConfig';
import * as FileSystem from 'expo-file-system';
import GoogleIcon from '../components/GoogleIcon';
import AppLogo from '../assets/logo';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';

// Import university logos
const tauLogo = require('../assets/tau.png');
const technionLogo = require('../assets/technion.png');
const hebrewLogo = require('../assets/hebrew.png');
const bguLogo = require('../assets/bgu.png');

// Import App Store badge
const appStoreBadge = require('../assets/app-store-badge.png');

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const WINDOW_WIDTH = Dimensions.get('window').width;

// Loading dots component for visual feedback
const LoadingDots = () => {
  const [dots, setDots] = useState('...');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return <Text style={styles.loadingDots}>{dots}</Text>;
};

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { signOut, user, signInWithGoogle, signInWithApple, loading: sessionLoading } = useSession();
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [statistics, setStatistics] = useState({
    average_score: 0,
    questions_count: 0,
    uploads_count: 0
  });
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [expandedAccordion, setExpandedAccordion] = useState<number | null>(null);

  // Add dynamic loading messages
  const [loadingMessages, setLoadingMessages] = useState([
    'מנתח את תוכן הקובץ...',
    'מחלק את הטקסט לנושאים...',
    'מזהה מושגים מרכזיים...',
    'בונה שאלות חכמות...',
    'מכין את הבוחן עבורך...',
    'כמעט סיימנו...',
  ]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isPulsating, setIsPulsating] = useState(false);

  // Add animated value for pulsating effect
  const pulseAnim = useRef(new RNAnimated.Value(0.7)).current;
  
  // Function to start progress animation - moved up before use
  const startProgressAnimation = () => {
    // Cycle through messages
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 4000);
    
    // Animate progress bar
    let progress = 30;
    const progressInterval = setInterval(() => {
      // Increase progress slowly between 30% and 90%
      if (progress < 90) {
        progress += Math.random() * 3;
        setUploadProgress(Math.min(progress, 90));
      }
    }, 2000);
    
    // Start pulsating effect
    setIsPulsating(true);
    
    // Clean up intervals when component unmounts
    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  };
  
  // Helper function for upload with token refresh and retry - moved up before use
  const uploadWithRetry = async (apiUrl: string, formData: FormData, retryCount = 0) => {
    try {
      // Get the session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('לא נמצא טוקן הזדהות. אנא התחבר מחדש.');
      }
      
      console.log("Including Authorization token in request headers");
      
      // Update progress to show we're about to send the request
      setUploadProgress(25);
      
      console.log("Sending request with form data:", {
        uri: apiUrl,
        file_size: formData.get('file') instanceof File ? (formData.get('file') as File).size : 'unknown',
        file_type: formData.get('file') instanceof File ? (formData.get('file') as File).type : 'unknown',
        file_name: formData.get('file') instanceof File ? (formData.get('file') as File).name : 'unknown',
      });
      
      // Make a simpler request without credentials mode
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log("Received response:", {
        status: response.status,
        statusText: response.statusText
      });
      
      // Handle different HTTP status codes
      if (response.status === 401 && retryCount < 2) {
        console.log("Auth error during upload, attempting to refresh session...");
        
        try {
          // Force a session refresh
          const { data, error } = await supabase.auth.refreshSession();
          
          if (error) {
            console.error("Failed to refresh session:", error);
            throw new Error('הטוקן פג תוקף ולא ניתן לחדש אותו. אנא התחבר מחדש.');
          }
          
          // Check if we actually got a new token
          if (!data.session) {
            throw new Error('לא ניתן לחדש את ההזדהות. אנא התחבר מחדש.');
          }
          
          console.log("Session refreshed successfully, retrying upload...");
          // Retry the upload after refreshing token
          return await uploadWithRetry(apiUrl, formData, retryCount + 1);
        } catch (refreshError) {
          console.error("Error during token refresh:", refreshError);
          throw new Error('אירעה שגיאה בחידוש ההזדהות. אנא התחבר מחדש.');
        }
      } else if (response.status >= 400) {
        // For any error response, try to get the error message
        let errorMessage = `שגיאה בהעלאת הקובץ: ${response.status}`;
        try {
          const errorText = await response.text();
          console.error("Error response body:", errorText);
          
          // Try to parse the JSON if possible
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {
            // If not JSON, just use the text
            if (errorText) {
              errorMessage = errorText;
            }
          }
          
          // Check for known error patterns
          if (errorText.includes('Free users are limited') || 
              errorText.includes('upgrade to premium') ||
              errorText.includes('daily limit') ||
              errorText.includes('premium_limit_reached') ||
              errorText.includes('מכסת ההעלאות היומית')) {
            
            // Check if this is a premium user limit message
            const isPremiumLimit = errorText.includes('premium_limit_reached') || 
                                  errorText.includes('למשתמשי פרימיום');
            
            if (isPremiumLimit) {
              // Premium user reached their limit
              const message = 'הגעת למכסת ההעלאות היומית למשתמשי פרימיום (10/10).';
              
              // Reset loading states
              setUploading(false);
              setUploadStatus(null);
              setUploadProgress(0);
              
              if (Platform.OS === 'web') {
                window.alert(message);
              } else {
                Alert.alert('מגבלת העלאות יומית', message);
              }
              return; // Exit without showing another error
            } else {
              // Free user reached their limit with upgrade option
              
              // Reset loading states
              setUploading(false);
              setUploadStatus(null);
              setUploadProgress(0);
              
              if (Platform.OS === 'web') {
                if (window.confirm('הגעת למכסת ההעלאות היומית למשתמשי החינם. האם ברצונך לשדרג למנוי פרימיום?')) {
                  navigation.navigate('Subscription');
                  return; // Exit without showing another error
                }
              } else {
                Alert.alert(
                  'מגבלת העלאות יומית',
                  'הגעת למכסת ההעלאות היומית למשתמשי החינם. האם ברצונך לשדרג למנוי פרימיום?',
                  [
                    { 
                      text: 'ביטול', 
                      style: 'cancel',
                      onPress: () => {
                        // Ensure loading states are reset
                        setUploading(false);
                        setUploadStatus(null);
                        setUploadProgress(0);
                      }
                    },
                    { 
                      text: 'שדרוג למנוי פרימיום', 
                      onPress: () => {
                        // Reset loading states before navigation
                        setUploading(false);
                        setUploadStatus(null);
                        setUploadProgress(0);
                        navigation.navigate('Subscription');
                      }
                    }
                  ]
                );
                return; // Exit without showing another error
              }
            }
          }
        } catch (e) {
          console.error("Failed to read error response:", e);
        }
        
        throw new Error(errorMessage);
      }
      
      // Once upload is complete, show processing message
      setUploadProgress(70);
      setUploadStatus(loadingMessages[currentMessageIndex]);
      
      // Read the response
      let responseText;
      try {
        responseText = await response.text();
        console.log("Response body:", responseText || "Empty response");
      } catch (e) {
        console.error("Error reading response:", e);
        throw new Error("לא ניתן היה לקרוא את תשובת השרת");
      }
      
      // Try to parse the response
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error('השרת החזיר תשובה לא תקינה');
      }
      
      console.log("Parsed response data:", responseData);
      
      if (responseData.success) {
        setUploadProgress(100);
        setUploadStatus('הבוחן מוכן!');
        setIsPulsating(false);
        
        // Small delay to show completion before navigating
        setTimeout(() => {
          // Navigate to Quiz with job ID
          navigation.navigate('Quiz', { jobId: responseData.job_id });
          
          // Reset upload state
          setUploading(false);
          setUploadStatus(null);
          setUploadProgress(0);
          
          // Refresh quizzes list
          fetchRecentQuizzes();
        }, 500);
      } else {
        throw new Error(responseData.message || 'אירעה שגיאה ביצירת השאלות');
      }
    } catch (error) {
      throw error;
    }
  };
  
  // Create pulsating animation when isPulsating changes
  useEffect(() => {
    let animationLoop: RNAnimated.CompositeAnimation;
    
    if (isPulsating) {
      // Create looping pulse animation
      animationLoop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      );
      
      // Start the animation
      animationLoop.start();
    } else {
      // Reset to full opacity when not pulsating
      RNAnimated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    
    // Clean up animation on component unmount or when isPulsating changes
    return () => {
      if (animationLoop) {
        animationLoop.stop();
      }
    };
  }, [isPulsating, pulseAnim]);

  // Fetch recent quizzes for authenticated users
  useEffect(() => {
    if (user) {
      fetchRecentQuizzes();
      fetchUserStatistics();
    }
  }, [user]);

  const toggleAccordion = (index: number) => {
    setExpandedAccordion(expandedAccordion === index ? null : index);
  };

  const fetchRecentQuizzes = async () => {
    if (!user) return;
    
    try {
      setLoadingQuizzes(true);
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      
      setRecentQuizzes(data || []);
    } catch (error) {
      console.error('Error fetching recent quizzes:', error);
    } finally {
      setLoadingQuizzes(false);
    }
  };

  // Helper function to get base API URL
  const getBaseApiUrl = () => {
    // Use the imported utility
    return getConfigBaseUrl();
  };

  const fetchUserStatistics = async () => {
    if (!user) return;
    
    try {
      setLoadingStatistics(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No authentication token available');
        return;
      }

      const baseUrl = await getBaseApiUrl();
      const apiUrl = `${baseUrl}/api/user/statistics`;
      console.log("Fetching user statistics from:", apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("User statistics:", data);
      
      if (data.success && data.statistics) {
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoadingStatistics(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in with Google:', error);
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsAppleSigningIn(true);
      await signInWithApple();
    } catch (error) {
      console.error('Error signing in with Apple:', error);
    } finally {
      setIsAppleSigningIn(false);
    }
  };

  const pickAndUploadDocument = async () => {
    try {
      console.log("pickAndUploadDocument: Function started");
      // Check if user is authenticated first
      if (!user) {
        console.log("pickAndUploadDocument: User not authenticated");
        Alert.alert('שגיאה', 'יש להתחבר כדי להעלות קבצים');
        return;
      }

      console.log("pickAndUploadDocument: Checking upload limits");
      // Check daily upload limits before picking file
      const { data: todayUploads, error: limitsError } = await supabase
        .from('uploads')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', new Date().toISOString().split('T')[0]); // Today's uploads

      if (limitsError) {
        console.error('Error checking upload limits:', limitsError);
      } else {
        console.log('Today\'s uploads:', todayUploads);
        
        // Get subscription status - Fix: Check user_subscriptions table instead of subscriptions
        const { data: subscriptions, error: subError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1);
        
        console.log('Subscription check result:', subscriptions);
          
        const hasPremium = subscriptions && subscriptions.length > 0;
        const uploadCount = todayUploads ? todayUploads.length : 0;
        const dailyLimit = hasPremium ? "unlimited" : 1;
        
        console.log(`User subscription status - Premium: ${hasPremium}, Uploads: ${uploadCount}/${dailyLimit}`);
        
        // Premium users have unlimited uploads, only check limits for free users
        if (!hasPremium && uploadCount >= 1) {
          console.log(`User has reached daily limit: ${uploadCount}/1`);
          
          // Reset loading states when hitting upload limits
          setUploading(false);
          setUploadStatus(null);
          setUploadProgress(0);
          
          Alert.alert(
            'מגבלת העלאות יומית',
            `הגעת למכסת ההעלאות היומית למשתמשי החינם (${uploadCount}/1). האם ברצונך לשדרג למנוי פרימיום עם העלאות ללא הגבלה?`,
            [
              { 
                text: 'ביטול',
                style: 'cancel',
                onPress: () => {
                  // Additional reset of loading states on cancel
                  setUploading(false);
                  setUploadStatus(null);
                  setUploadProgress(0);
                }
              },
              { 
                text: 'שדרוג למנוי פרימיום', 
                onPress: () => {
                  // Reset loading states before navigation
                  setUploading(false);
                  setUploadStatus(null);
                  setUploadProgress(0);
                  navigation.navigate('Subscription');
                }
              }
            ]
          );
          return;
        }
      }

      // If we're on web, we'll use the file input handler directly
      // Only proceed with document picker on native platforms
      if (Platform.OS !== 'web') {
        console.log("pickAndUploadDocument: Opening document picker on native platform");
      // Proceed with file picking if below upload limit
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
          console.log("pickAndUploadDocument: Document picker was canceled");
        return;
      }
      
        console.log("pickAndUploadDocument: Document picked:", result.assets[0]);
      
      // Start upload process
      await uploadDocument(result.assets[0]);
      } else {
        console.log("pickAndUploadDocument: On web platform, file input should be handling the file selection");
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בבחירת הקובץ');
    }
  };
  
  const uploadDocument = async (fileAsset: any): Promise<void> => {
    if (!user) {
      console.log("uploadDocument: User not authenticated");
      Alert.alert('שגיאה', 'יש להתחבר כדי להעלות קבצים');
      return;
    }
    
    try {
      console.log("uploadDocument: Starting upload process with fileAsset:", fileAsset);
      
      // Add extra diagnostics for Android uploads
      if (Platform.OS === 'web' && fileAsset.isAndroid) {
        console.log("uploadDocument: Special Android file details:", {
          name: fileAsset.name,
          size: fileAsset.size,
          mimeType: fileAsset.mimeType,
          fileType: fileAsset.file?.type,
          hasUri: !!fileAsset.uri,
          isChrome: fileAsset.isChrome,
          browserInfo: navigator.userAgent
        });
      }
      
      setUploading(true);
      setUploadStatus('מכין את הקובץ...');
      setUploadProgress(5);
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('user_id', user.id);
      
      // Handle file differently based on platform
      if (Platform.OS === 'web') {
        try {
          console.log("uploadDocument: Web platform detected, preparing file");
          // Determine MIME type from filename if not available
          const getMimeType = (filename: string) => {
            if (filename.endsWith('.pdf')) return 'application/pdf';
            if (filename.endsWith('.txt')) return 'text/plain';
            if (filename.endsWith('.doc')) return 'application/msword';
            if (filename.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            if (filename.endsWith('.ppt') || filename.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            return fileAsset.mimeType || 'application/pdf'; // Default to PDF if unknown
          };
          
          const mimeType = fileAsset.mimeType || getMimeType(fileAsset.name);
          console.log("Using MIME type:", mimeType);
          
          // Check file size - limit to 50MB to avoid potential server issues
          const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
          if (fileAsset.size && fileAsset.size > MAX_FILE_SIZE) {
            throw new Error(`הקובץ גדול מדי (${(fileAsset.size / (1024 * 1024)).toFixed(2)}MB). הגודל המקסימלי המותר הוא 50MB.`);
          }
          
          // Special handling for Android Chrome
          if (fileAsset.isAndroid && fileAsset.isChrome) {
            console.log("Special handling for Android Chrome browser");
            
            try {
              // Chrome browser file handling - use multiple methods
              console.log("Chrome file object details:", {
                fileType: fileAsset.file?.type,
                fileName: fileAsset.file?.name,
                fileSize: fileAsset.file?.size
              });
              
              // Direct approach - use the File object directly
              formData.append('file', fileAsset.file, fileAsset.name);
              console.log("Added Chrome Android file to form data directly");
              
              // Verify the file was added
              if (!formData.has('file')) {
                console.log("Direct append failed, trying Blob approach");
                
                // Try with explicitly creating a new blob
                try {
                  // Create a blob copy with explicit type
                  const blob = new Blob([fileAsset.file], { type: mimeType });
                  formData.append('file', blob, fileAsset.name);
                  console.log("Added file as new blob with explicit type");
                } catch (blobError) {
                  console.error("Blob approach failed:", blobError);
                  
                  // Last resort - create empty placeholder and notify user
                  const emptyBlob = new Blob(['File access error placeholder'], { type: 'text/plain' });
                  formData.append('file', emptyBlob, 'error.txt');
                  window.alert('לא ניתן לקרוא את הקובץ בדפדפן Chrome. אנא נסה להוריד את האפליקציה או להשתמש בדפדפן אחר.');
                  throw new Error("Failed to access file on Android Chrome - suggest using the app instead");
                }
              }
            } catch (androidChromeError) {
              console.error("Error with all Android Chrome approaches:", androidChromeError);
              throw new Error("לא ניתן לקרוא את הקובץ באמצעות Chrome באנדרואיד. אנא התקן את האפליקציה מחנות האפליקציות או השתמש בדפדפן אחר.");
            }
          }
          // Simplified Android handling (non-Chrome)
          else if (fileAsset.isAndroid) {
            console.log("Special handling for Android browser");
            
            try {
              console.log("Android file object details:", {
                fileType: fileAsset.file?.type,
                fileName: fileAsset.file?.name,
                fileSize: fileAsset.file?.size,
                isFile: fileAsset.file instanceof File,
                properties: Object.getOwnPropertyNames(fileAsset.file || {})
              });
              
              // Special handling for emulators - try a couple of approaches
              
              // Approach 1: Just append the file directly first
              console.log("Approach 1: Direct file append");
              formData.append('file', fileAsset.file);
              
              // Log form data content for debugging
              if (formData.has('file')) {
                console.log("Added Android file directly to form data - success");
              } else {
                console.log("File not appended to form data - trying alternative");
                
                // Approach 2: Create explicit type file
                console.log("Approach 2: Creating explicit type file");
                const explicitTypeFile = new File(
                  [fileAsset.file], 
                  fileAsset.name, 
                  { type: mimeType }
                );
                formData.append('file', explicitTypeFile);
                console.log("Added Android file with explicit type:", mimeType);
                
                // Approach 3: If both fail, try blob-based approach
                if (!formData.has('file')) {
                  console.log("Approach 3: Blob-based approach");
                  try {
                    // Create a blob from file and use that
                    const blob = new Blob([fileAsset.file], { type: mimeType });
                    formData.append('file', blob, fileAsset.name);
                    console.log("Added blob to form data");
                  } catch (blobError) {
                    console.error("Error with blob approach:", blobError);
                    throw new Error("Failed to process file. Please try again with a different file.");
                  }
                }
              }
            } catch (androidError) {
              console.error("Error with all Android file approaches:", androidError);
              
              // Last resort approach - manual blob construction
              try {
                console.log("Last resort approach: Manual blob construction");
                // Create a simple blob with empty content just to have something
                const emptyBlob = new Blob(['Placeholder for failed file upload'], { type: 'text/plain' });
                formData.append('file', emptyBlob, 'placeholder.txt');
                console.error("Using placeholder file due to Android emulator file access issues");
                
                // Show an alert to the user about the problem
                if (Platform.OS === 'web') {
                  window.alert('אירעה שגיאה בקריאת הקובץ. אנא נסה שוב עם קובץ אחר או השתמש באפליקציה המותקנת במקום בדפדפן.');
                }
              } catch (lastError) {
                console.error("All approaches failed:", lastError);
                throw new Error("Could not access file. Please try using the installed app instead of the browser.");
              }
            }
          }
          // Standard handling for all other browsers
          else if (fileAsset.file) {
            // File is a File or Blob object
            if (fileAsset.file instanceof File) {
              // Check size
              if (fileAsset.file.size > MAX_FILE_SIZE) {
                throw new Error(`הקובץ גדול מדי (${(fileAsset.file.size / (1024 * 1024)).toFixed(2)}MB). הגודל המקסימלי המותר הוא 50MB.`);
              }
              
              // Append with correct MIME type if needed
              if (!fileAsset.file.type || fileAsset.file.type === 'application/octet-stream') {
                const typedFile = new File(
                  [fileAsset.file], 
                  fileAsset.file.name, 
                  { type: mimeType }
                );
                formData.append('file', typedFile);
                console.log("Appended file with corrected MIME type:", typedFile.type);
              } else {
                formData.append('file', fileAsset.file);
                console.log("Appended file directly:", fileAsset.file.type);
              }
            } 
            // File from URI
            else if (fileAsset.uri) {
              console.log("Fetching file from URI:", fileAsset.uri);
              const response = await fetch(fileAsset.uri);
              const blob = await response.blob();
              console.log("Created blob from URI:", blob);
              // Create a File from the blob with the correct MIME type
              const file = new File([blob], fileAsset.name, { type: mimeType });
              formData.append('file', file);
              console.log("Created file from blob with type:", file.type);
            } 
            // Fallback
            else {
              console.log("Using fallback file handling");
              formData.append('file', fileAsset.file);
            }
          } else {
            throw new Error("קובץ לא תקין או ריק");
          }
        } catch (error) {
          console.error("Error preparing file for web upload:", error);
          throw new Error("Could not prepare file for upload");
        }
      } else {
        console.log("uploadDocument: Native platform detected, using RN file object");
        const fileToUpload = {
          uri: fileAsset.uri,
          name: fileAsset.name,
          type: fileAsset.mimeType || 'application/pdf' // Default to PDF instead of octet-stream
        } as any;
        
        formData.append('file', fileToUpload);
      }
      
      // Start progress animation
      startProgressAnimation();
      
      // Update progress
      setUploadProgress(15);
      setUploadStatus('מעלה את הקובץ...');
      
      // Determine API URL based on platform
      const getApiUrl = () => {
        // Use the imported utility
        return getConfigApiUrl('api/upload');
      };

      const apiUrl = await getApiUrl();
      
      console.log("Sending request to:", apiUrl);
      
      // Upload with token refresh and retry
      await uploadWithRetry(apiUrl, formData);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Reset loading states
      setUploading(false);
      setUploadStatus(null);
      setUploadProgress(0);
      
      // Enhanced error handling for different types of errors
      let errorMessage = '';
      let errorTitle = 'שגיאה';
      
      // Check for specific error types
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorTitle = 'שגיאת התחברות';
        errorMessage = 'לא ניתן להתחבר לשרת. אנא ודא שיש לך חיבור אינטרנט פעיל.';
      } 
      // Check for timeout or worker terminated errors
      else if (error instanceof Error && 
        (error.message.includes('timeout') || 
         error.message.includes('worker') || 
         error.message.includes('terminated'))) {
        errorTitle = 'הקובץ גדול או מורכב מדי';
        errorMessage = 'העיבוד של הקובץ נכשל כי הוא גדול מדי או מורכב מדי. נסה להעלות קובץ קטן יותר או לחלק אותו למספר קבצים קטנים.';
      }
      // Server error
      else if (error instanceof Error && error.message.includes('500')) {
        errorTitle = 'שגיאת שרת';
        errorMessage = 'אירעה שגיאה בשרת בעת עיבוד הקובץ. אנא נסה שוב מאוחר יותר או העלה קובץ אחר.';
      }
      // Memory error
      else if (error instanceof Error && error.message.includes('memory')) {
        errorTitle = 'זיכרון לא מספיק';
        errorMessage = 'אין מספיק זיכרון לעבד את הקובץ. נסה להעלות קובץ קטן יותר.';
      }
      // Default case - use error message or generic message
      else {
        errorMessage = error instanceof Error ? error.message : 'אירעה שגיאה בהעלאת הקובץ. אנא נסה שוב.';
      }
      
      // Show the error
      if (Platform.OS === 'web') {
        window.alert(`${errorTitle}: ${errorMessage}`);
      } else {
        Alert.alert(errorTitle, errorMessage, [{ text: 'הבנתי', style: 'default' }]);
      }
      
      throw error;
    }
  };

  const renderUploadProgress = () => {
    if (!uploading) return null;
    
    return (
      <View style={styles.uploadProgressContainer}>
        <Text style={styles.uploadStatusText}>
          {currentMessageIndex < loadingMessages.length 
            ? loadingMessages[currentMessageIndex] 
            : 'מנתח את תוכן הקובץ...'}
        </Text>
        <LoadingDots />
        <View style={styles.progressBarContainer}>
          <RNAnimated.View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${uploadProgress}%`,
                opacity: pulseAnim
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
      </View>
    );
  };

  // Helper function to decode encoded filenames
  const decodeFileName = (filename: string) => {
    if (!filename) return 'Unnamed File';
    
    // Check if the filename is hex-encoded (like "E2_80_8E_E2_81_A8_D7_9C_D7_9E...")
    if (filename.match(/^([0-9A-F]{2}_)+/)) {
      try {
        // Regex to match hex values: E2_80_8E
        const regex = /([0-9A-F]{2})_?/g;
        let match;
        let decodedName = '';
        
        // Reset regex
        regex.lastIndex = 0;
        
        // Extract all hex values and convert them to characters
        while ((match = regex.exec(filename)) !== null) {
          decodedName += String.fromCharCode(parseInt(match[1], 16));
        }
        
        // If there's a file extension, keep it
        const extensionMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
        if (extensionMatch) {
          return decodedName + extensionMatch[0];
        }
        
        return decodedName;
      } catch (error) {
        console.error('Error decoding filename:', error);
        return filename;
      }
    }
    
    return filename;
  };

  // If still loading the session, show a loading spinner
  if (sessionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" style={styles.loadingSpinner} />
      </View>
    );
  }

  // If user is authenticated, show the dashboard
  if (user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <LinearGradient
                colors={['#4A90E2', '#5DA8FF']}
                style={styles.settingsButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="settings-outline" size={22} color="white" />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.welcome}>ברוך הבא, {user?.user_metadata?.full_name || user?.email}</Text>
          </View>

          {uploading ? (
            renderUploadProgress()
          ) : (
            <>
              {/* Daily Statistics Section */}
              <View style={styles.statisticsContainer}>
                <Text style={styles.statisticsTitle}>סיכום יומי</Text>
                
                <View style={styles.statisticsGrid}>
                  <View style={styles.statisticItem}>
                    <View style={styles.statisticIconContainer}>
                      <Text style={styles.statisticIcon}>📊</Text>
                    </View>
                    <Text style={styles.statisticValue}>
                      {loadingStatistics ? '...' : statistics.average_score}
                    </Text>
                    <Text style={styles.statisticLabel}>ציון ממוצע</Text>
                  </View>
                  
                  <View style={styles.statisticItem}>
                    <View style={styles.statisticIconContainer}>
                      <Text style={styles.statisticIcon}>❓</Text>
                    </View>
                    <Text style={styles.statisticValue}>
                      {loadingStatistics ? '...' : statistics.questions_count}
                    </Text>
                    <Text style={styles.statisticLabel}>שאלות שהושלמו</Text>
                  </View>
                  
                  <View style={styles.statisticItem}>
                    <View style={styles.statisticIconContainer}>
                      <Text style={styles.statisticIcon}>📄</Text>
                    </View>
                    <Text style={styles.statisticValue}>
                      {loadingStatistics ? '...' : statistics.uploads_count}
                    </Text>
                    <Text style={styles.statisticLabel}>מסמכים שהועלו</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {recentQuizzes.length > 0 && (
            <View style={styles.recentQuizzesContainer}>
              <Text style={styles.recentQuizzesTitle}>הבחנים האחרונים שלך</Text>
              
              {recentQuizzes.map((quiz) => (
                <TouchableOpacity 
                  key={quiz.id}
                  style={styles.quizItem} 
                  onPress={() => navigation.navigate('Quiz', { jobId: quiz.id })}
                >
                  <View style={styles.quizDetails}>
                    <Text style={styles.quizName} numberOfLines={1}>
                      {decodeFileName(quiz.file_name)}
                    </Text>
                    <Text style={styles.quizDate}>
                      {new Date(quiz.created_at).toLocaleDateString('he-IL')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
        <FloatingUploadButton 
          onPress={pickAndUploadDocument} 
          user={user} 
          uploadDocument={uploadDocument}
          navigation={navigation}
          supabase={supabase}
          setLoadingState={(isLoading) => {
            if (!isLoading) {
              setUploading(false);
              setUploadStatus(null);
              setUploadProgress(0);
            }
          }}
        />
      </SafeAreaView>
    );
  }

  // If user is not authenticated, show the landing page
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Fancy Blur Header */}
      {Platform.OS !== 'ios' && (
        <View style={styles.fancyHeader}>
          {/* Blur Effects */}
          {(Platform.OS === 'web') ? (
            <>
              <BlurView intensity={1} style={[styles.blurLayer, { top: '0%', height: '20%', zIndex: 1 }]} />
              <BlurView intensity={2} style={[styles.blurLayer, { top: '12.5%', height: '20%', zIndex: 2 }]} />
              <BlurView intensity={4} style={[styles.blurLayer, { top: '25%', height: '20%', zIndex: 3 }]} />
              <BlurView intensity={8} style={[styles.blurLayer, { top: '37.5%', height: '20%', zIndex: 4 }]} />
              <BlurView intensity={16} style={[styles.blurLayer, { top: '50%', height: '20%', zIndex: 5 }]} />
              <BlurView intensity={32} style={[styles.blurLayer, { top: '62.5%', height: '20%', zIndex: 6 }]} />
              <BlurView intensity={64} style={[styles.blurLayer, { top: '75%', height: '20%', zIndex: 7 }]} />
            </>
          ) : (
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.8)']}
              style={styles.gradientLayer}
            />
          )}
          
          {/* Header Content */}
          <View style={styles.headerContent}>
            <View style={styles.logoTitleContainer}>
              <AppLogo style={styles.headerLogo} />
              <Text style={styles.headerTitle}>סיכוםAI</Text>
            </View>
            
            {/* App Store Download Button - only shown on Web */}
            {Platform.OS === 'web' && (
              <TouchableOpacity 
                style={styles.appStoreButton}
                onPress={() => {
                  // Get App Store URL from environment variables or use default
                  const appStoreUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_APP_STORE_URL || 
                                     process.env.EXPO_PUBLIC_APP_STORE_URL || 
                                     'https://apps.apple.com/app/id6743373915';
                  Linking.openURL(appStoreUrl);
                }}
              >
                <Text style={styles.appStoreButtonText}>הורד עכשיו</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      <ScrollView style={styles.landingContainer} contentContainerStyle={styles.landingContent}>
        <View style={styles.landingHeader}>
          <AppLogo style={styles.landingLogoComponent} />
          <Text style={styles.logoText}>סיכוםAI</Text>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>למד בחכמה, לא בקושי</Text>
            <Text style={styles.heroDescription}>
              סיכוםAI הופכת את חומרי הלימוד שלך לבחנים אינטראקטיביים בשניות, עם בינה מלאכותית מתקדמת.
            </Text>
            <TouchableOpacity
              style={styles.googleSignInButton}
              onPress={handleGoogleSignIn}
              disabled={isGoogleSigningIn}
            >
              {isGoogleSigningIn ? (
                <ActivityIndicator size="small" color="#4A90E2" />
              ) : (
                <>
                  <GoogleIcon size={24} style={styles.googleLogo} />
                  <Text style={styles.googleSignInText}>התחברות עם Google</Text>
                </>
              )}
            </TouchableOpacity>

            {(Platform.OS === 'ios' || Platform.OS === 'web') && (
              <TouchableOpacity
                style={styles.appleSignInButton}
                onPress={handleAppleSignIn}
                disabled={isAppleSigningIn}
              >
                {isAppleSigningIn ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={24} color="white" style={styles.appleLogo} />
                    <Text style={styles.appleSignInText}>התחברות עם Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Trusted By Section */}
        <View style={styles.clientsSection}>
          <Text style={styles.clientsTitle}>בשימוש על ידי סטודנטים</Text>
          <View style={styles.clientsLogos}>
            <View style={styles.logoContainer}>
              <Image source={tauLogo} style={styles.universityLogoImage} resizeMode="contain" />
            </View>
            <View style={styles.logoContainer}>
              <Image source={technionLogo} style={styles.universityLogoImage} resizeMode="contain" />
            </View>
            <View style={styles.logoContainer}>
              <Image source={hebrewLogo} style={styles.universityLogoImage} resizeMode="contain" />
            </View>
            <View style={styles.logoContainer}>
              <Image source={bguLogo} style={styles.universityLogoImage} resizeMode="contain" />
            </View>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>למה סיכוםAI?</Text>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>⚡️</Text>
            <Text style={styles.featureTitle}>מהיר ופשוט</Text>
            <Text style={styles.featureDescription}>
              פשוט העלה PDF, מסמך Word או מצגות, ותוך שניות תקבל בוחן אינטראקטיבי מותאם אישית.
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🧠</Text>
            <Text style={styles.featureTitle}>בינה מלאכותית מתקדמת</Text>
            <Text style={styles.featureDescription}>
              השאלות נוצרות בעזרת בינה מלאכותית מתקדמת, המזהה מושגים מפתח ומייצרת שאלות אפקטיביות ללמידה.
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🇮🇱</Text>
            <Text style={styles.featureTitle}>תמיכה מלאה בעברית</Text>
            <Text style={styles.featureDescription}>
              פותח במיוחד עבור סטודנטים ישראלים, עם תמיכה מלאה בעברית ובחומרי לימוד בשפה העברית.
            </Text>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>שאלות נפוצות</Text>
          <View style={styles.accordionContainer}>
            <TouchableOpacity 
              style={styles.accordionItem}
              onPress={() => toggleAccordion(0)}
            >
              <Text style={styles.accordionTitle}>מה זה סיכוםAI?</Text>
              <Ionicons 
                name={expandedAccordion === 0 ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#333" 
              />
            </TouchableOpacity>
            {expandedAccordion === 0 && (
              <View style={styles.accordionContent}>
                <Text style={styles.accordionText}>
                  סיכוםAI משתמש בבינה מלאכותית להפוך את חומרי הלימוד שלך לבחנים אינטראקטיביים. אנחנו מנתחים את התוכן, מזהים מושגי מפתח ויוצרים שאלות שיעזרו לך להטמיע את החומר בצורה יעילה.
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.accordionItem}
              onPress={() => toggleAccordion(1)}
            >
              <Text style={styles.accordionTitle}>איך סיכוםAI עובד?</Text>
              <Ionicons 
                name={expandedAccordion === 1 ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#333" 
              />
            </TouchableOpacity>
            {expandedAccordion === 1 && (
              <View style={styles.accordionContent}>
                <Text style={styles.accordionText}>
                  פשוט העלה מסמך PDF, Word או מצגת, ואלגוריתם הבינה המלאכותית שלנו ינתח את התוכן, יזהה מושגים מרכזיים, ויצור בחן מותאם אישית. התהליך לוקח רק כמה שניות והתוצאה היא בחן אינטראקטיבי שמסייע לך להבין ולזכור את החומר.
                </Text>
              </View>
            )}
            
            {(Platform.OS !== 'ios') && (
              <>
                <TouchableOpacity 
                  style={styles.accordionItem}
                  onPress={() => toggleAccordion(2)}
                >
                  <Text style={styles.accordionTitle}>האם סיכוםAI בחינם?</Text>
                  <Ionicons 
                    name={expandedAccordion === 2 ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#333" 
                  />
                </TouchableOpacity>
                {expandedAccordion === 2 && (
                  <View style={styles.accordionContent}>
                    <Text style={styles.accordionText}>
                      כן, סיכוםAI מציע חשבון חינמי שמאפשר לך לייצר בוחן מדי יום. למשתמשים שזקוקים ליותר, אנחנו מציעים תוכנית פרימיום עם אפשרויות נוספות וללא הגבלה על מספר הבחנים.
                    </Text>
                  </View>
                )}
              </>
            )}

          <TouchableOpacity
              style={styles.accordionItem}
              onPress={() => toggleAccordion(3)}
            >
              <Text style={styles.accordionTitle}>האם סיכוםAI זמין גם בנייד?</Text>
              <Ionicons 
                name={expandedAccordion === 3 ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#333" 
              />
          </TouchableOpacity>
            {expandedAccordion === 3 && (
              <View style={styles.accordionContent}>
                <Text style={styles.accordionText}>
                  כן, סיכוםAI זמין באפליקציה ייעודית ל-iOS וכן דרך הדפדפן בכל מכשיר.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer Section */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 סיכוםAI - כל הזכויות שמורות</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
              <Text style={styles.footerLink}>מדיניות פרטיות</Text>
            </TouchableOpacity>
            <Text style={styles.footerLinkSeparator}>•</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
              <Text style={styles.footerLink}>תנאי שימוש</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f9fc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, // Add padding for Android devices
  },
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f9fc',
  },
  loadingSpinner: {
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 16, // Added top padding for better spacing
    marginTop: 10,  // Added top margin for better spacing
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  welcome: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  settingsButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    padding: 16,
  },
  menuItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightedMenuItem: {
    backgroundColor: '#4A90E2',
  },
  menuItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 8,
    textAlign: 'right',
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  recentQuizzesContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recentQuizzesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 16,
    textAlign: 'right',
  },
  quizItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  quizDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  quizName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    textAlign: 'right',
  },
  quizDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  signOutButton: {
    margin: 20,
    backgroundColor: '#f44336',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Landing page styles
  landingContainer: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  landingContent: {
    paddingBottom: 40,
  },
  landingHeader: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  landingLogoComponent: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  landingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 8,
  },
  landingTagline: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    maxWidth: '80%',
    marginBottom: 20,
  },
  heroSection: {
    padding: 20,
    alignItems: 'center',
  },
  heroImagePlaceholder: {
    width: WINDOW_WIDTH * 0.9,
    height: 200,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImageText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroImageSubtext: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  heroTextContainer: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    maxWidth: '90%',
  },
  googleSignInButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 200,
  },
  googleLogo: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleSignInText: {
    fontSize: 16,
    color: '#444',
    fontWeight: '500',
  },
  featuresSection: {
    padding: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  clientsSection: {
    padding: 20,
    marginTop: 20,
  },
  clientsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  clientsLogos: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    marginHorizontal: 10,
  },
  logoContainer: {
    alignItems: 'center',
    width: '22%',
    marginBottom: 15,
    marginHorizontal: 5,
  },
  universityLogoImage: {
    width: 80,
    height: 80,
    marginBottom: 0,
  },
  faqSection: {
    padding: 20,
    marginTop: 20,
  },
  accordionContainer: {
    marginBottom: 16,
  },
  accordionItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  accordionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
    textAlign: 'right',
  },
  accordionContent: {
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  accordionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerLink: {
    fontSize: 14,
    color: '#4A90E2',
    marginHorizontal: 4,
    padding: 4,
  },
  footerLinkSeparator: {
    fontSize: 14,
    color: '#999',
    marginHorizontal: 4,
  },
  subscriptionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  subscriptionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  debugButton: {
    backgroundColor: '#FFD700',
  },
  uploadButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    margin: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  uploadButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  uploadProgressContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#4A90E2',
  },
  progressBarContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  pulsatingFill: {
    opacity: 0.8,
    // We can't use actual animations here, but we make it visually distinct
  },
  loadingDots: {
    fontSize: 16,
    marginTop: -8,
    marginBottom: 10,
    color: '#4A90E2',
    textAlign: 'center',
  },
  statisticsContainer: {
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
  statisticsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  statisticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statisticItem: {
    alignItems: 'center',
    flex: 1,
  },
  statisticIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statisticIcon: {
    fontSize: 24,
  },
  statisticValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  statisticLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    shadowColor: '#1565C0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderRadius: 30,
  },
  floatingButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,      // Add white border/frame
    borderColor: 'white', // Set the border color to white
  },
  floatingButtonIconContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    padding: 2,
  },
  appleSignInButton: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  appleLogo: {
    marginRight: 12,
  },
  appleSignInText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  headerButtonsText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
    textAlign: 'center',
  },
  fancyHeader: {
    width: '100%',
    height: 120,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  blurLayer: {
    position: 'absolute',
    width: '100%',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  gradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: '100%',
    zIndex: 10,
  },
  logoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 50,
    height: 50,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginLeft: 10,
  },
  downloadButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#4A90E2',
    textAlign: 'center',
    marginTop: 8,
  },
  appStoreButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    flexDirection: 'row', // Add this to align icon and text
  },
  appStoreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8, // Add spacing between text and icon
  },
  appStoreIcon: {
    fontSize: 24,
    marginLeft: 8,
  },
});

// Define the FloatingUploadButton component after styles
const FloatingUploadButton = ({ 
  onPress, 
  user, 
  uploadDocument, 
  navigation,
  supabase,
  setLoadingState
}: { 
  onPress: () => void; 
  user: any; 
  uploadDocument: (fileAsset: any) => Promise<void>;
  navigation: any;
  supabase: any;
  setLoadingState?: (isLoading: boolean) => void;
}): React.ReactElement => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isChrome, setIsChrome] = useState(false);

  // Helper function to determine MIME type from filename
  const getMimeTypeFromFilename = (filename: string) => {
    if (filename.endsWith('.pdf')) return 'application/pdf';
    if (filename.endsWith('.txt')) return 'text/plain';
    if (filename.endsWith('.doc')) return 'application/msword';
    if (filename.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (filename.endsWith('.ppt') || filename.endsWith('.pptx')) 
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'application/octet-stream'; // Default
  };

  // Detect mobile browser on component mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const androidRegex = /android/i;
      const chromeRegex = /chrome|chromium/i;
      
      const isMobile = mobileRegex.test(userAgent.toLowerCase());
      const isAndroidDevice = androidRegex.test(userAgent.toLowerCase());
      const isChromeDevice = chromeRegex.test(userAgent.toLowerCase());
      
      setIsMobileBrowser(isMobile);
      setIsAndroid(isAndroidDevice);
      setIsChrome(isChromeDevice);
      
      console.log("FloatingUploadButton: Mobile browser detected:", isMobile);
      console.log("FloatingUploadButton: Android browser detected:", isAndroidDevice);
      console.log("FloatingUploadButton: Chrome browser detected:", isChromeDevice);
      console.log("FloatingUploadButton: User agent:", userAgent);
    }
  }, []);
  
  // Handle Android Chrome file selection
  const handleAndroidFileSelection = async (file: File) => {
    console.log("Android Chrome file selected:", file.name, file.type, file.size);
    
    try {
      if (!user) {
        window.alert('יש להתחבר כדי להעלות קבצים');
        return;
      }
      
      // Check upload limits first
      const { data: todayUploads } = await supabase
        .from('uploads')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', new Date().toISOString().split('T')[0]);
      
      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1);
      
      const hasPremium = subscriptions && subscriptions.length > 0;
      const uploadCount = todayUploads ? todayUploads.length : 0;
      const freeUserLimit = 1;
      
      if (!hasPremium && uploadCount >= freeUserLimit) {
        if (window.confirm(`הגעת למכסת ההעלאות היומית לחשבונות חינם (${uploadCount}/${freeUserLimit}). האם ברצונך לשדרג למנוי פרימיום?`)) {
          navigation.navigate('Subscription');
        }
        return;
      }
      
      // Set loading state
      if (setLoadingState) {
        setLoadingState(true);
      }
      
      // Create a file asset object optimized for Chrome on Android
      const mimeType = file.type || getMimeTypeFromFilename(file.name);
      const fileAsset = {
        name: file.name,
        mimeType: mimeType,
        size: file.size,
        file: file,
        isAndroid: true,
        isChrome: true
      };
      
      // Call the upload function
      await uploadDocument(fileAsset);
    } catch (error: any) {
      console.error("Error in Android Chrome file handling:", error);
      if (setLoadingState) {
        setLoadingState(false);
      }
      window.alert(`אירעה שגיאה בהעלאת הקובץ: ${error.message || 'שגיאה לא ידועה'}`);
    }
  };
  
  const handleButtonPress = () => {
    console.log("FloatingUploadButton: Button pressed");
    
    if (Platform.OS === 'web') {
      console.log("FloatingUploadButton: Running on web platform");
      
      // Handle Android device
      if (isAndroid) {
        console.log("FloatingUploadButton: Android browser detected");
        
        try {
          // Create a temporary, highly visible file input for Android
          const tempInput = document.createElement('input');
          tempInput.type = 'file';
          tempInput.accept = '.pdf,.txt,.doc,.docx,.ppt,.pptx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          
          // Style to make it more tappable on mobile
          tempInput.style.position = 'fixed';
          tempInput.style.top = '0';
          tempInput.style.left = '0';
          tempInput.style.width = '100%';
          tempInput.style.height = '100%';
          tempInput.style.opacity = '0.01'; // Nearly invisible but still interactive
          tempInput.style.zIndex = '9999';
          tempInput.style.fontSize = '16px'; // Prevent zoom on mobile
          
          // Add change event listener
          tempInput.addEventListener('change', (event: any) => {
            const files = event.target.files;
            if (files && files.length > 0) {
              handleAndroidFileSelection(files[0]);
            }
            // Remove the temp input after use
            document.body.removeChild(tempInput);
          });
          
          // Add to document and trigger click
          document.body.appendChild(tempInput);
          tempInput.click();
          
        } catch (error) {
          console.error("Error creating Android file input:", error);
          // Fallback to normal file input
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }
      } else {
        // Non-Android browsers just use the regular input
        if (fileInputRef.current) {
          console.log("FloatingUploadButton: Clicking file input");
          fileInputRef.current.click();
        }
      }
    } else {
      console.log("FloatingUploadButton: Running on native platform, calling onPress");
      // On native mobile, use normal DocumentPicker via onPress
      onPress();
    }
  };
  
  const handleFileChange = async (event: any) => {
    if (!event || !event.target || !event.target.files) {
      console.log("handleFileChange: No file selected or event malformed");
      return;
    }
    
    try {
      const file = event.target.files[0];
      if (!file) {
        console.log("handleFileChange: No file in event.target.files");
        return;
      }
      
      console.log("handleFileChange: File selected:", file.name);
      
      if (!user) {
        Alert.alert('שגיאה', 'יש להתחבר כדי להעלות קבצים');
        return;
      }
      
      // Create a clean file asset with all needed properties
      const fileAsset = {
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        isAndroid,
        isChrome,
        uri: URL.createObjectURL(file)
      };
      
      console.log("handleFileChange: Prepared fileAsset:", {
        name: fileAsset.name,
        size: fileAsset.size,
        mimeType: fileAsset.mimeType,
        isAndroid: fileAsset.isAndroid,
        isChrome: fileAsset.isChrome
      });
      
      // Process file upload
      await uploadDocument(fileAsset);
    } catch (error) {
      console.error("handleFileChange error:", error);
      Alert.alert('שגיאה', 'אירעה שגיאה בעת בחירת הקובץ');
    }
  };

  return (
    <TouchableOpacity 
      style={styles.floatingButton}
      onPress={handleButtonPress}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={['#4A90E2', '#5DA8FF']}
        style={styles.floatingButtonGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="add" size={30} color="white" />
      </LinearGradient>
      
      {/* Regular file input for non-Android browsers */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={handleFileChange}
          style={{ 
            display: 'none'
          }}
        />
      )}
    </TouchableOpacity>
  );
}; 
