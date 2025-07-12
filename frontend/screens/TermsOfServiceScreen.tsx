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

type TermsOfServiceNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TermsOfServiceScreen() {
  const navigation = useNavigation<TermsOfServiceNavigationProp>();
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
        <Text style={styles.title}>תנאי שימוש</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>עודכן לאחרונה: 15 במרץ, 2025</Text>
        
        <Text style={styles.sectionTitle}>1. קבלת התנאים</Text>
        <Text style={styles.paragraph}>
          ברוכים הבאים ל-SikumAI. האפליקציה והשירותים המוצעים בה (להלן: "השירות") מופעלים על ידי SikumAI (להלן: "אנחנו", "שלנו"). על ידי גישה או שימוש בשירות, אתה מסכים להיות מחויב לתנאים אלה (להלן: "תנאי השימוש").
        </Text>
        
        <Text style={styles.sectionTitle}>2. שינויים בתנאים</Text>
        <Text style={styles.paragraph}>
          אנו רשאים לעדכן את תנאי השימוש מעת לעת. אנו נודיע לך על כל שינויים מהותיים באמצעות הודעה באפליקציה או באמצעות כתובת הדואר האלקטרוני שסיפקת לנו. המשך השימוש שלך בשירות לאחר שינויים כאלה מהווה את הסכמתך לתנאים המעודכנים.
        </Text>
        
        <Text style={styles.sectionTitle}>3. פרטיות</Text>
        <Text style={styles.paragraph}>
          השימוש שלך בשירות כפוף גם למדיניות הפרטיות שלנו, אשר מפרטת כיצד אנו אוספים, משתמשים ומשתפים מידע אישי. אנא עיין במדיניות הפרטיות שלנו.
        </Text>
        
        <Text style={styles.sectionTitle}>4. חשבונות משתמשים</Text>
        <Text style={styles.paragraph}>
          כדי להשתמש בחלק מהתכונות של השירות שלנו, עליך ליצור חשבון. אתה אחראי לשמירה על סודיות החשבון ואתה מקבל אחריות מלאה לכל הפעילויות שמתרחשות תחת החשבון שלך.
        </Text>
        
        <Text style={styles.sectionTitle}>5. תכני משתמש</Text>
        <Text style={styles.paragraph}>
          אתה שומר על כל הזכויות והבעלות בכל התוכן שאתה מעלה לשירות. עם זאת, אתה מעניק לנו רישיון לאחסן, להשתמש ולעבד את התוכן שלך כדי לספק את השירות.
        </Text>
        <Text style={styles.paragraph}>
          אתה מסכים שלא תעלה תוכן שהוא בלתי חוקי, מזיק, מאיים, פוגעני, מטריד, משמיץ, גס, מגונה, או בעייתי בכל דרך אחרת.
        </Text>
        
        <Text style={styles.sectionTitle}>6. מגבלות שימוש</Text>
        <Text style={styles.paragraph}>
          אתה מסכים שלא:
        </Text>
        <Text style={styles.listItem}>• תשתמש בשירות בכל דרך בלתי חוקית או אסורה</Text>
        <Text style={styles.listItem}>• תפר כל חוקים, תקנות או זכויות של צד שלישי</Text>
        <Text style={styles.listItem}>• תתערב או תפגע בפעולה התקינה של השירות</Text>
        <Text style={styles.listItem}>• תעקוף אמצעי אבטחה כלשהם</Text>
        <Text style={styles.listItem}>• תיצור מספר חשבונות למטרות זדוניות</Text>
        
        <Text style={styles.sectionTitle}>7. רכישות ותשלומים</Text>
        <Text style={styles.paragraph}>
          אנו מציעים תכניות מנוי שונות. תשלומים עבור מנויים נגבים באמצעות חנות האפליקציות במכשיר שלך. כל המחירים כוללים מיסים ישימים אלא אם צוין אחרת.
        </Text>
        <Text style={styles.paragraph}>
          כל המנויים מתחדשים אוטומטית אלא אם תבטל לפחות 24 שעות לפני סיום תקופת המנוי הנוכחית. ניתן לנהל ולבטל את המנוי שלך דרך הגדרות החשבון בחנות האפליקציות.
        </Text>
        
        <Text style={styles.sectionTitle}>8. הגבלת אחריות</Text>
        <Text style={styles.paragraph}>
          השירות מסופק "כמות שהוא" ו"כפי שהוא זמין", ללא כל התחייבות, מפורשת או משתמעת.
        </Text>
        <Text style={styles.paragraph}>
          בשום מקרה אנחנו לא נהיה אחראים לכל נזק עקיף, מקרי, מיוחד, תוצאתי או עונשי, כולל אובדן רווחים או נתונים, הנובעים מהשימוש שלך או אי-היכולת להשתמש בשירות.
        </Text>
        
        <Text style={styles.sectionTitle}>9. סיום</Text>
        <Text style={styles.paragraph}>
          אנו רשאים לסיים או להשעות את הגישה שלך לכל או חלק מהשירות, מיד, ללא הודעה מוקדמת או אחריות, מכל סיבה שהיא, כולל אך לא רק, הפרה של תנאי השימוש.
        </Text>
        
        <Text style={styles.sectionTitle}>10. הדין החל</Text>
        <Text style={styles.paragraph}>
          תנאי שימוש אלה יהיו כפופים ויפורשו בהתאם לחוקי מדינת ישראל, ללא התחשבות בכללי ברירת הדין שלה.
        </Text>
        
        <Text style={styles.sectionTitle}>11. צור קשר</Text>
        <Text style={styles.paragraph}>
          אם יש לך שאלות או חששות לגבי תנאי השימוש שלנו, אנא צור קשר בכתובת:
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