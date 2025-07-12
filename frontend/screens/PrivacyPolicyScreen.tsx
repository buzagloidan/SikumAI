import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSession } from '../contexts/SessionContext';

type PrivacyPolicyNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation<PrivacyPolicyNavigationProp>();
  const { user } = useSession();
  
  const handleBack = () => {
    // If we have a navigation history, go back
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Otherwise, go to Auth screen if not logged in, or Home if logged in
      navigation.navigate(user ? 'Home' : 'Auth');
    }
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>מדיניות פרטיות</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>עודכן לאחרונה: 15 במרץ, 2025</Text>
        
        <Text style={styles.sectionTitle}>מבוא</Text>
        <Text style={styles.paragraph}>
          ברוכים הבאים למדיניות הפרטיות של SikumAI. מדיניות זו מסבירה כיצד אנו אוספים, משתמשים, מגלים ומגנים על המידע האישי שלך כאשר אתה משתמש באפליקציה שלנו.
        </Text>
        
        <Text style={styles.sectionTitle}>מידע שאנו אוספים</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>מידע שאתה מספק לנו:</Text> אנו אוספים מידע שאתה מספק לנו כאשר אתה יוצר חשבון, כגון שם, כתובת דואר אלקטרוני ותמונת פרופיל.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>מסמכים שאתה מעלה:</Text> אנו מעבדים ושומרים את המסמכים שאתה מעלה לאפליקציה לצורך יצירת בחנים.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>מידע שימוש:</Text> אנו אוספים מידע על האופן שבו אתה משתמש באפליקציה, כולל לוגים, נתוני שימוש ומידע על המכשיר שלך.
        </Text>
        
        <Text style={styles.sectionTitle}>כיצד אנו משתמשים במידע</Text>
        <Text style={styles.paragraph}>
          אנו משתמשים במידע שאנו אוספים כדי:
        </Text>
        <Text style={styles.listItem}>• לספק, לתחזק ולשפר את האפליקציה שלנו</Text>
        <Text style={styles.listItem}>• ליצור בחנים מותאמים אישית מהמסמכים שלך</Text>
        <Text style={styles.listItem}>• לנהל את החשבון שלך ולספק תמיכת לקוחות</Text>
        <Text style={styles.listItem}>• לשלוח לך עדכונים, התראות והודעות קשורות</Text>
        <Text style={styles.listItem}>• להבין כיצד משתמשים באפליקציה שלנו ולשפר אותה</Text>
        
        <Text style={styles.sectionTitle}>שיתוף מידע</Text>
        <Text style={styles.paragraph}>
          אנו לא מוכרים או משכירים את המידע האישי שלך לצדדים שלישיים. עם זאת, אנו עשויים לשתף מידע עם:
        </Text>
        <Text style={styles.listItem}>• ספקי שירות שעוזרים לנו להפעיל את האפליקציה</Text>
        <Text style={styles.listItem}>• שותפים עסקיים כאשר נדרש לספק את השירות</Text>
        <Text style={styles.listItem}>• רשויות ציבוריות כאשר נדרש על פי חוק</Text>
        
        <Text style={styles.sectionTitle}>אבטחת נתונים</Text>
        <Text style={styles.paragraph}>
          אנו מיישמים אמצעי אבטחה הולמים כדי להגן על המידע האישי שלך מפני אובדן, גישה בלתי מורשית, שינוי או חשיפה. עם זאת, אף שיטת העברה או אחסון אלקטרונית אינה בטוחה ב-100%.
        </Text>
        
        <Text style={styles.sectionTitle}>זכויות הפרטיות שלך</Text>
        <Text style={styles.paragraph}>
          בהתאם לחוקי הפרטיות הרלוונטיים, יתכן שיש לך זכויות מסוימות בנוגע למידע האישי שלך, כולל הזכות לגשת, לתקן, למחוק ולהגביל את העיבוד של המידע האישי שלך.
        </Text>
        
        <Text style={styles.sectionTitle}>שינויים במדיניות הפרטיות</Text>
        <Text style={styles.paragraph}>
          אנו עשויים לעדכן את מדיניות הפרטיות הזו מעת לעת. אנו נודיע לך על כל שינויים מהותיים באמצעות הודעה באפליקציה או באמצעות כתובת הדואר האלקטרוני שסיפקת לנו.
        </Text>
        
        <Text style={styles.sectionTitle}>צור קשר</Text>
        <Text style={styles.paragraph}>
          אם יש לך שאלות או חששות לגבי מדיניות הפרטיות שלנו, אנא צור קשר בכתובת:
        </Text>
        <Text style={styles.contactInfo}>hello@sikumai.com</Text>
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
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'right',
  },
  paragraph: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
    textAlign: 'right',
  },
  bold: {
    fontWeight: 'bold',
  },
  listItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'right',
    paddingRight: 16,
  },
  contactInfo: {
    fontSize: 16,
    color: '#4A90E2',
    marginBottom: 12,
    textAlign: 'right',
  },
}); 