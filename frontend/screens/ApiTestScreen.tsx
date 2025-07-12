import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';

export default function ApiTestScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  const testPing = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // Test the ping endpoint
      const apiUrl = 'http://192.168.1.223:5001/ping';
      console.log("Testing ping endpoint:", apiUrl);
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      setResult(JSON.stringify(data, null, 2));
      console.log("Ping successful:", data);
    } catch (error) {
      console.error("Error testing ping:", error);
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      Alert.alert('שגיאת התחברות', 'לא ניתן להתחבר לשרת. אנא ודא שהשרת פעיל וגלוי ברשת שלך.');
    } finally {
      setLoading(false);
    }
  };
  
  const testDebug = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // Test the debug endpoint
      const apiUrl = 'http://192.168.1.223:5001/debug';
      console.log("Testing debug endpoint:", apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
      console.log("Debug test successful:", data);
    } catch (error) {
      console.error("Error testing debug endpoint:", error);
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      Alert.alert('שגיאת התחברות', 'לא ניתן להתחבר לשרת. אנא ודא שהשרת פעיל וגלוי ברשת שלך.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>בדיקת חיבור ל-API</Text>
        <Text style={styles.subtitle}>בדוק את החיבור לשרת האחורי</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button}
            onPress={testPing}
            disabled={loading}
          >
            <Text style={styles.buttonText}>בדוק חיבור בסיסי (Ping)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={testDebug}
            disabled={loading}
          >
            <Text style={styles.buttonText}>בדוק נקודת קצה Debug</Text>
          </TouchableOpacity>
        </View>
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loadingText}>בודק חיבור...</Text>
          </View>
        )}
        
        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>תוצאת הבדיקה:</Text>
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{result}</Text>
            </View>
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
    gap: 16,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 15,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  resultContainer: {
    marginTop: 30,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
}); 