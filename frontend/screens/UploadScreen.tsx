import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { useSession } from '../contexts/SessionContext';
import { RootStackParamList } from '../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getApiUrl as getConfigApiUrl } from '../utils/apiConfig';

type UploadScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FileAsset {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  file?: File;
}

export default function UploadScreen() {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileAsset | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [dailyUploadsLeft, setDailyUploadsLeft] = useState<boolean | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  
  const navigation = useNavigation<UploadScreenNavigationProp>();
  const { user } = useSession();

  // Check subscription and daily upload limits on mount
  useEffect(() => {
    if (user) {
      checkSubscriptionStatus();
    }
  }, [user]);

  const checkSubscriptionStatus = async () => {
    if (!user) return;
    
    try {
      console.log("Checking subscription status for user:", user.id);
      setSubscriptionLoading(true);
      
      // Check if user has active subscription
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
      console.log("User has active subscription:", hasActiveSubscription);
      
      // Check daily upload limit regardless of subscription status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Count all uploads from today, regardless of status
      const { data: todayUploads, error: uploadsError } = await supabase
        .from('uploads')
        .select('id, status')
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());
        
      if (uploadsError) {
        console.error('Error checking uploads:', uploadsError);
        return;
      }
      
      // Count the number of uploads (including any in progress)
      const uploadCount = todayUploads ? todayUploads.length : 0;
      console.log(`User has made ${uploadCount} uploads today`);
      
      if (hasActiveSubscription) {
        // Premium users have 10 uploads per day
        const hasUploadsLeft = uploadCount < 10;
        setDailyUploadsLeft(hasUploadsLeft);
        console.log("Premium user has daily uploads left:", hasUploadsLeft);
      } else {
        // Free users have 1 upload per day
        const hasUploadsLeft = uploadCount < 1;
        setDailyUploadsLeft(hasUploadsLeft);
        console.log("Free user has daily uploads left:", hasUploadsLeft);
      }
    } catch (error) {
      console.error('Error checking upload limits:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const activateTestSubscription = async () => {
    if (!user) return;
    
    try {
      setSubscriptionLoading(true);
      
      const apiUrl = getConfigApiUrl('testing/create_subscription');
      console.log("Activating test subscription at:", apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        Alert.alert('הצלחה', 'מנוי פרימיום הופעל בהצלחה. כעת תוכל להעלות עד 10 קבצים ביום.');
        setHasSubscription(true);
        setDailyUploadsLeft(true);
      } else {
        Alert.alert('שגיאה', 'לא ניתן היה להפעיל מנוי לבדיקה: ' + (data.error || 'שגיאה לא ידועה'));
      }
    } catch (error) {
      console.error('Error activating test subscription:', error);
      Alert.alert('שגיאה', error instanceof Error ? error.message : 'אירעה שגיאה בהפעלת המנוי לבדיקה');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const pickDocument = async () => {
    // First check if the user has uploads left
    if (user && dailyUploadsLeft === false) {
      // Show limit message before picking document
      if (Platform.OS === 'web') {
        window.alert(hasSubscription 
          ? 'הגעת למכסה היומית - מנוי פרימיום מוגבל ל-10 העלאות ביום. נסה שוב מחר.'
          : 'הגעת למכסה היומית - ללא מנוי, ניתן להעלות קובץ אחד בלבד ביום. שקול לרכוש מנוי פרימיום לקבלת יותר העלאות.');
        
        // Optionally offer to navigate to subscription page
        if (!hasSubscription && window.confirm('האם ברצונך לעבור למסך המנויים?')) {
          navigation.navigate('Subscription');
        }
        return;
      } else {
        Alert.alert(
          'הגעת למכסה היומית', 
          hasSubscription 
            ? 'מנוי פרימיום מוגבל ל-10 העלאות ביום. נסה שוב מחר.' 
            : 'ללא מנוי, ניתן להעלות קובץ אחד בלבד ביום. שקול לרכוש מנוי פרימיום לקבלת יותר העלאות.',
          [
            { text: 'בטל', style: 'cancel' },
            { text: 'עבור למסך המנויים', onPress: () => navigation.navigate('Subscription') }
          ]
        );
        return;
      }
    }
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        return;
      }
      
      console.log("Document picked:", result.assets[0]);
      
      // Store the selected file
      if (Platform.OS === 'web') {
        // For web, we can get the actual File object
        // Check if we have access to the File object directly (Expo SDK 48+)
        if (result.assets[0].file) {
          console.log("File object available directly:", result.assets[0].file);
          setSelectedFile({
            ...result.assets[0],
            uri: URL.createObjectURL(result.assets[0].file),
            name: result.assets[0].name,
            file: result.assets[0].file
          });
        } else {
          // Fallback to regular approach
          setSelectedFile(result.assets[0]);
        }
      } else {
        // Normal approach for native
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      if (Platform.OS === 'web') {
        window.alert('אירעה שגיאה בבחירת הקובץ');
      } else {
        Alert.alert('שגיאה', 'אירעה שגיאה בבחירת הקובץ');
      }
    }
  };

  const pickImage = async () => {
    // Use platform-specific implementation
    if (Platform.OS === 'web') {
      // Web implementation - just show an alert
      Alert.alert('הערה', 'בחירת תמונות דרך הדפדפן אינה נתמכת עדיין, נא השתמש באפליקציה');
    } else {
      try {
        // Implementation for native platforms - we'll mock this to avoid import issues
        Alert.alert('הודעה', 'בוחר תמונה... (מדמה פעולה עבור הדגמה)');
        
        // Simulate successful image selection after delay
        setTimeout(() => {
          const mockImageAsset: FileAsset = {
            uri: 'https://example.com/sample-image.jpg',
            name: 'sample-image.jpg',
            mimeType: 'image/jpeg',
            size: 1024,
          };
          setSelectedFile(mockImageAsset);
        }, 1000);
      } catch (error) {
        console.error('Error picking image:', error);
        Alert.alert('שגיאה', 'אירעה שגיאה בבחירת התמונה');
      }
    }
  };

  // Use the proper API utility
  const apiUrl = getConfigApiUrl('api/upload');

  const uploadFile = async () => {
    if (!selectedFile || !user) {
      if (Platform.OS === 'web') {
        window.alert('אנא בחר קובץ להעלאה תחילה');
      } else {
        Alert.alert('שגיאה', 'אנא בחר קובץ להעלאה תחילה');
      }
      return;
    }
    
    try {
      // Pre-check upload limits before starting the upload process
      await checkSubscriptionStatus();
      
      // Verify again that the user can upload
      if (dailyUploadsLeft === false) {
        if (Platform.OS === 'web') {
          window.alert(hasSubscription 
            ? 'הגעת למכסה היומית - מנוי פרימיום מוגבל ל-10 העלאות ביום. נסה שוב מחר.'
            : 'הגעת למכסה היומית - ללא מנוי, ניתן להעלות קובץ אחד בלבד ביום. שקול לרכוש מנוי פרימיום לקבלת יותר העלאות.');
          
          // Optionally offer to navigate to subscription page
          if (!hasSubscription && window.confirm('האם ברצונך לעבור למסך המנויים?')) {
            navigation.navigate('Subscription');
          }
          return;
        } else {
          Alert.alert(
            'הגעת למכסה היומית', 
            hasSubscription 
              ? 'מנוי פרימיום מוגבל ל-10 העלאות ביום. נסה שוב מחר.' 
              : 'ללא מנוי, ניתן להעלות קובץ אחד בלבד ביום. שקול לרכוש מנוי פרימיום לקבלת יותר העלאות.',
            [
              { text: 'בטל', style: 'cancel' },
              { text: 'עבור למסך המנויים', onPress: () => navigation.navigate('Subscription') }
            ]
          );
          return;
        }
      }
      
      try {
        // Check file size on web platform
        if (Platform.OS === 'web') {
          // Get file size
          let fileSize = 0;
          if (selectedFile.file instanceof File) {
            fileSize = selectedFile.file.size;
          } else if (selectedFile.size) {
            fileSize = selectedFile.size;
          }
          
          // Check if file is too large (50MB limit)
          const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
          if (fileSize > MAX_FILE_SIZE) {
            window.alert(`הקובץ גדול מדי (${(fileSize / (1024 * 1024)).toFixed(2)}MB). הגודל המקסימלי המותר הוא 50MB.`);
            return;
          }
          
          // Check if file is empty
          if (fileSize === 0) {
            window.alert('הקובץ שבחרת ריק או לא תקין. אנא בחר קובץ אחר.');
            return;
          }
        }
        
        // Make API request to upload endpoint
        console.log("Sending request to:", apiUrl);
        
        console.log("Starting upload process...");
        console.log("Selected file:", selectedFile);
        console.log("User:", user.id);
        
        setUploading(true);
        setProcessingStatus('מעלה קובץ...');
        
        // Create form data for upload
        const formData = new FormData();
        formData.append('user_id', user.id);
        
        // Handle file differently based on platform
        if (Platform.OS === 'web') {
          // For web, we need to fetch the file and create a proper File object
          try {
            console.log("Web platform detected, preparing file");
            
            // Determine MIME type from filename if not available
            const getMimeType = (filename: string) => {
              if (filename.endsWith('.pdf')) return 'application/pdf';
              if (filename.endsWith('.txt')) return 'text/plain';
              if (filename.endsWith('.doc')) return 'application/msword';
              if (filename.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              if (filename.endsWith('.ppt') || filename.endsWith('.pptx')) 
                return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
              return 'application/pdf'; // Default to PDF
            };
            
            // If we have the file object directly (from our enhanced pickDocument function)
            if (selectedFile.file instanceof File) {
              console.log("File object already available:", selectedFile.file);
              
              // Get proper mime type
              const mimeType = selectedFile.file.type === 'application/octet-stream' 
                ? getMimeType(selectedFile.file.name)
                : selectedFile.file.type;
                
              // Create a new File with the correct MIME type if needed
              if (selectedFile.file.type === 'application/octet-stream') {
                const newFile = new File(
                  [selectedFile.file], 
                  selectedFile.file.name, 
                  { type: mimeType }
                );
                formData.append('file', newFile);
                console.log("Created new file with correct MIME type:", mimeType);
              } else {
                formData.append('file', selectedFile.file);
              }
            }
            // If selectedFile is a File object itself 
            else if (selectedFile instanceof File) {
              console.log("Selected file is a File object");
              
              // Get proper mime type
              const mimeType = selectedFile.type === 'application/octet-stream' 
                ? getMimeType(selectedFile.name)
                : selectedFile.type;
                
              if (selectedFile.type === 'application/octet-stream') {
                const newFile = new File(
                  [selectedFile], 
                  selectedFile.name, 
                  { type: mimeType }
                );
                formData.append('file', newFile);
                console.log("Created new file with correct MIME type:", mimeType);
              } else {
                formData.append('file', selectedFile);
              }
            } 
            // Otherwise, try to fetch it as a blob
            else {
              console.log("Fetching file from URI:", selectedFile.uri);
              const response = await fetch(selectedFile.uri);
              const blob = await response.blob();
              console.log("Created blob from URI:", blob);
              
              // Get proper mime type
              const mimeType = getMimeType(selectedFile.name);
              
              // Create a File from the blob with the correct MIME type
              const file = new File([blob], selectedFile.name, { type: mimeType });
              formData.append('file', file);
              console.log("Created file from blob with type:", mimeType);
            }
          } catch (error) {
            console.error("Error preparing file for web upload:", error);
            throw new Error("Could not prepare file for upload");
          }
        } else {
          // For native platforms, use the React Native approach
          console.log("Native platform detected, using RN file object");
          const fileToUpload = {
            uri: selectedFile.uri,
            name: selectedFile.name,
            type: selectedFile.mimeType || 'application/pdf' // Default to PDF instead of octet-stream
          } as any;
          
          formData.append('file', fileToUpload);
        }
        
        console.log("FormData created with file:", selectedFile.name);
        
        // Debugging FormData
        if (Platform.OS === 'web') {
          for (const pair of (formData as any).entries()) {
            console.log(`FormData contains: ${pair[0]}, ${typeof pair[1]} ${pair[1] instanceof File ? 'File' : pair[1] instanceof Blob ? 'Blob' : 'Other'}`);
          }
        }
        
        setProcessingStatus('מנתח את תוכן הקובץ...');
        
        console.log("About to fetch with FormData");
        
        // Get the session token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          throw new Error('לא נמצא טוקן הזדהות. אנא התחבר מחדש.');
        }
        
        console.log("Including Authorization token in request headers");
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log("Response received with status:", response.status);
        console.log("Response headers:", response.headers);
        
        // Handle different HTTP status codes
        if (!response.ok) {
          console.error("Error response:", response);
          
          if (response.status === 413) {
            throw new Error('הקובץ גדול מדי. אנא העלה קובץ שגודלו עד 50MB.');
          } else if (response.status === 415) {
            throw new Error('סוג הקובץ אינו נתמך. אנא העלה קובץ מסוג PDF, DOC, DOCX, PPT, PPTX או TXT.');
          } else if (response.status === 500) {
            // Try to get detailed error from response
            let errorText;
            try {
              errorText = await response.text();
              console.error("Error response body:", errorText);
            } catch (e) {
              errorText = "Unknown server error";
            }
            throw new Error(`שגיאת שרת: ${response.status}. פרטים: ${errorText}`);
          } else {
            const errorText = await response.text();
            console.error("Error response body:", errorText);
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { error: errorText || "Unknown error occurred" };
            }
            throw new Error(errorData.error || `שגיאה: ${response.status} ${response.statusText}`);
          }
        }
        
        const responseText = await response.text();
        console.log("Raw response:", responseText);
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse JSON response:", e);
          throw new Error('קיבלנו תשובה לא תקינה מהשרת');
        }
        
        console.log("Parsed response data:", responseData);
        
        if (responseData.success) {
          setProcessingStatus('יוצר שאלות...');
          console.log("Navigating to Quiz with jobId:", responseData.job_id);
          
          // Wait for processing to complete or navigate immediately with job ID
          navigation.navigate('Quiz', { jobId: responseData.job_id });
          
          // Reset state
          setUploading(false);
          setProcessingStatus(null);
          setSelectedFile(null);
        } else {
          throw new Error(responseData.message || 'אירעה שגיאה ביצירת השאלות');
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        
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
        // File size error
        else if (error instanceof Error && error.message.includes('גדול מדי')) {
          errorTitle = 'קובץ גדול מדי';
          errorMessage = error.message;
        }
        // Server error
        else if (error instanceof Error && error.message.includes('500')) {
          errorTitle = 'שגיאת שרת';
          errorMessage = 'אירעה שגיאה בשרת בעת עיבוד הקובץ. אנא נסה שוב מאוחר יותר או העלה קובץ אחר.';
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
        
        setUploading(false);
        setProcessingStatus(null);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      
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
      // File size error
      else if (error instanceof Error && error.message.includes('גדול מדי')) {
        errorTitle = 'קובץ גדול מדי';
        errorMessage = error.message;
      }
      // Server error
      else if (error instanceof Error && error.message.includes('500')) {
        errorTitle = 'שגיאת שרת';
        errorMessage = 'אירעה שגיאה בשרת בעת עיבוד הקובץ. אנא נסה שוב מאוחר יותר או העלה קובץ אחר.';
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
      
      setUploading(false);
      setProcessingStatus(null);
    }
  };

  const renderFilePreview = () => {
    if (!selectedFile) return null;
    
    const isImage = selectedFile.mimeType?.startsWith('image/');
    
    return (
      <View style={styles.filePreview}>
        {isImage ? (
          <Image 
            source={{ uri: selectedFile.uri }} 
            style={styles.imagePreview} 
            resizeMode="contain"
          />
        ) : (
          <View style={styles.docPreview}>
            <Text style={styles.docPreviewText}>{selectedFile.name}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>העלאת חומרי לימוד</Text>
        <Text style={styles.subtitle}>העלה מסמכים או תמונות כדי ליצור בחנים אינטראקטיביים</Text>
        
        {/* Subscription Status Indicator */}
        <View style={styles.statusContainer}>
          {hasSubscription === true && (
            <>
              <Text style={[styles.statusText, dailyUploadsLeft === false ? styles.warningText : null]}>
                {dailyUploadsLeft === true
                  ? 'מנוי פרימיום - נותרו לך עוד העלאות היום'
                  : 'הגעת למכסה היומית - מנוי פרימיום מוגבל ל-10 העלאות ביום'}
              </Text>
              {dailyUploadsLeft === true && (
                <Text style={styles.limitExplanation}>
                  מנוי פרימיום מאפשר עד 10 העלאות ביום
                </Text>
              )}
            </>
          )}
          {hasSubscription === false && (
            <>
              <Text style={[styles.statusText, dailyUploadsLeft === false ? styles.warningText : null]}>
                {dailyUploadsLeft === true 
                  ? 'אין לך מנוי - נותרה לך העלאה אחת היום' 
                  : 'הגעת למכסה היומית - אנא רכוש מנוי פרימיום לקבלת יותר העלאות'}
              </Text>
              {dailyUploadsLeft === true && (
                <Text style={styles.limitExplanation}>
                  ללא מנוי, ניתן להעלות קובץ אחד בלבד ביום. מנוי פרימיום מאפשר עד 10 העלאות ביום.
                </Text>
              )}
            </>
          )}
          
          {/* Testing only - activation button */}
          <TouchableOpacity
            style={[
              styles.testButton,
              subscriptionLoading && styles.disabledButton
            ]}
            onPress={activateTestSubscription}
            disabled={subscriptionLoading || hasSubscription === true}
          >
            {subscriptionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.testButtonText}>הפעל מנוי פרימיום (לצורכי בדיקה)</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {renderFilePreview()}
        
        {uploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.statusText}>{processingStatus}</Text>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.pickButton}
              onPress={pickDocument}
              disabled={uploading}
            >
              <Text style={styles.buttonText}>בחר מסמך</Text>
            </TouchableOpacity>
            
            {selectedFile && (
              <TouchableOpacity 
                style={[
                  styles.uploadButton,
                  dailyUploadsLeft === false && styles.disabledButton
                ]}
                onPress={uploadFile}
                disabled={uploading || dailyUploadsLeft === false}
              >
                <Text style={styles.uploadButtonText}>
                  {dailyUploadsLeft === false 
                    ? 'הגעת למכסה היומית' 
                    : 'העלה וצור בוחן'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filePreview: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  docPreview: {
    width: '100%',
    padding: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPreviewText: {
    color: '#333',
    fontSize: 16,
  },
  uploadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  statusContainer: {
    backgroundColor: '#f0f8ff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#9c27b0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  warningText: {
    color: '#e53935',
    fontWeight: 'bold',
  },
  limitExplanation: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
}); 