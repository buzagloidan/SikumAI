import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSession } from '../contexts/SessionContext';
import { supabase } from '../supabaseClient';
import { getBaseApiUrl as getConfigBaseUrl } from '../utils/apiConfig';
import { Ionicons } from '@expo/vector-icons';

type QuizScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type QuizScreenRouteProp = RouteProp<RootStackParamList, 'Quiz'>;

// Sample quiz data structure
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  correct_option_index?: number;
  explanation?: string;
}

interface QuizState {
  currentQuestionIndex: number;
  answers: (number | null)[];
  score: number | null;
  showResults: boolean;
  showFeedback: boolean;
}

// Define Hebrew option prefixes
const OPTION_PREFIXES = ['א. ', 'ב. ', 'ג. ', 'ד. '];

// Helper function to get base API URL
const getBaseApiUrl = () => {
  // Use the same API configuration as in HomeScreen
  return getConfigBaseUrl();
};

export default function QuizScreen() {
  const route = useRoute<QuizScreenRouteProp>();
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const { jobId } = route.params;
  const { user } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestionIndex: 0,
    answers: [],
    score: null,
    showResults: false,
    showFeedback: false,
  });
  const [resultsSaved, setResultsSaved] = useState(false);
  
  // Load quiz questions (would fetch from API in a real app)
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        
        // Try to load questions with retry for auth errors
        await loadQuestionsWithRetry();
      } catch (error) {
        console.error('Error loading questions:', error);
        Alert.alert('שגיאה', error instanceof Error ? error.message : 'אירעה שגיאה בטעינת השאלות');
        setLoading(false);
        // Navigate back to the home screen on error
        navigation.navigate('Home');
      }
    };
    
    // Helper function to load questions with token refresh and retry
    const loadQuestionsWithRetry = async (retryCount = 0) => {
      try {
        // Get the session token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          throw new Error('לא נמצא טוקן הזדהות. אנא התחבר מחדש.');
        }
        
        const baseUrl = getBaseApiUrl();
        const apiUrl = `${baseUrl}/api/quiz/${jobId}`;
        console.log("Fetching quiz data from:", apiUrl);
        
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Handle 401 Unauthorized errors specifically
        if (response.status === 401 && retryCount < 2) {
          console.log("Auth error, attempting to refresh session...");
          
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
            
            console.log("Session refreshed successfully, retrying request...");
            // Retry the request after refreshing token
            return await loadQuestionsWithRetry(retryCount + 1);
          } catch (refreshError) {
            console.error("Error during token refresh:", refreshError);
            throw new Error('אירעה שגיאה בחידוש ההזדהות. אנא התחבר מחדש.');
          }
        }
        
        if (!response.ok) {
          throw new Error(`שגיאה בטעינת השאלות: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Determine where the questions are in the response
        let questionsData;
        if (data.questions) {
          questionsData = data.questions;
        } else if (data.data && data.data.questions) {
          questionsData = data.data.questions;
        } else if (Array.isArray(data)) {
          questionsData = data;
        } else {
          // If we can't find a questions array, try to extract questions from the response
          questionsData = [data]; 
        }
        
        if (!questionsData || questionsData.length === 0) {
          throw new Error('לא נמצאו שאלות לבוחן זה');
        }
        
        // Format the questions to match our UI requirements
        const formattedQuestions: QuizQuestion[] = [];
        
        // Process each question individually with proper error handling
        for (let i = 0; i < questionsData.length; i++) {
          try {
            const q = questionsData[i];
            
            // Verify each field exists before using it
            const question = q.question || `שאלה ${i + 1}`;
            const options = Array.isArray(q.options) ? q.options : ["א. אפשרות 1", "ב. אפשרות 2", "γ. אפשרות 3", "δ. אפשרות 4"];
            
            // Handle the critical correct_option_index to correctAnswer conversion
            let correctAnswer: number = 0;
            if (q.correctAnswer !== undefined) {
              correctAnswer = q.correctAnswer;
            } else if (q.correct_option_index !== undefined) {
              correctAnswer = q.correct_option_index;
            }
            
            formattedQuestions.push({
              id: q.id || `question_${i}`,
              question,
              options,
              correctAnswer,
              explanation: q.explanation || 'לא נמצא הסבר לשאלה זו'
            });
            
          } catch (err) {
            console.error(`Error processing question ${i}:`, err);
            // Continue processing other questions instead of failing completely
          }
        }
        
        if (formattedQuestions.length === 0) {
          throw new Error('לא ניתן היה לעבד את השאלות שהתקבלו');
        }
        
        setQuestions(formattedQuestions);
        setQuizState(prev => ({
          ...prev,
          answers: new Array(formattedQuestions.length).fill(null),
        }));
        setLoading(false);
      } catch (error) {
        throw error;
      }
    };
    
    if (jobId) {
      loadQuestions();
    }
  }, [jobId, navigation, user?.id]);
  
  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...quizState.answers];
    newAnswers[quizState.currentQuestionIndex] = answerIndex;
    
    setQuizState(prev => ({
      ...prev,
      answers: newAnswers,
      showFeedback: true,
    }));
  };
  
  const saveQuizResults = async (score: number) => {
    if (resultsSaved) return; // Prevent duplicate saves
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No authentication token available');
        return;
      }
      
      const baseUrl = getBaseApiUrl();
      const apiUrl = `${baseUrl}/api/quiz/${jobId}/complete`;
      console.log("Saving quiz results to:", apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          answers: quizState.answers,
          score: score,
          question_count: questions.length
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save quiz results: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Quiz results saved successfully:", data);
      setResultsSaved(true);
      
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };
  
  const goToNextQuestion = () => {
    if (quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        showFeedback: false,
      }));
    } else {
      // Calculate final score
      const score = quizState.answers.reduce((total: number, answer, index) => {
        return total + (answer === questions[index].correctAnswer ? 1 : 0);
      }, 0);
      
      setQuizState(prev => ({
        ...prev,
        score,
        showResults: true,
      }));
      
      // Save the quiz results
      saveQuizResults(score);
    }
  };
  
  const goToPreviousQuestion = () => {
    if (quizState.currentQuestionIndex > 0) {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex - 1,
        showFeedback: false,
      }));
    }
  };
  
  const restartQuiz = () => {
    setQuizState({
      currentQuestionIndex: 0,
      answers: new Array(questions.length).fill(null),
      score: null,
      showResults: false,
      showFeedback: false,
    });
  };
  
  const goToHome = () => {
    navigation.navigate('Home');
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>טוען שאלות...</Text>
      </View>
    );
  }
  
  if (quizState.showResults) {
    const scorePercentage = Math.round((quizState.score! / questions.length) * 100);
    let resultMessage = '';
    let resultColor = '#4A90E2';
    
    if (scorePercentage >= 90) {
      resultMessage = 'מצויין! כל הכבוד!';
      resultColor = '#4CAF50';
    } else if (scorePercentage >= 70) {
      resultMessage = 'טוב מאוד!';
      resultColor = '#8BC34A';
    } else if (scorePercentage >= 50) {
      resultMessage = 'כל הכבוד על ההתקדמות!';
      resultColor = '#FFC107';
    } else {
      resultMessage = 'נסה שוב, אתה יכול להשתפר!';
      resultColor = '#FF5722';
    }
    
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultHeaderContainer}>
            <Text style={styles.resultTitle}>תוצאות הבוחן</Text>
            <View style={styles.scoreCircle}>
              <Text style={styles.scorePercentage}>{scorePercentage}%</Text>
              <Text style={styles.scoreText}>
                {quizState.score} מתוך {questions.length}
              </Text>
            </View>
            <Text style={[styles.resultMessage, {color: resultColor}]}>{resultMessage}</Text>
          </View>
          
          <View style={styles.resultSummary}>
            {questions.map((question, index) => {
              // Add null check for question
              if (!question) return null;
              
              // Safely access answers and correct answers
              const userAnswer = quizState.answers[index] ?? 0;
              const userAnswerText = question.options?.[userAnswer] || 'לא נענה';
              const correctAnswerText = question.options?.[question.correctAnswer] || 'אין תשובה נכונה';
              
              return (
                <View key={`question_${index}`} style={styles.resultQuestion}>
                  <Text style={styles.resultQuestionText}>
                    {index + 1}. {question.question || `שאלה ${index + 1}`}
                  </Text>
                  <View style={[
                    styles.resultAnswerContainer,
                    userAnswer === question.correctAnswer 
                      ? styles.correctAnswerContainer 
                      : styles.wrongAnswerContainer
                  ]}>
                    <Text style={styles.resultAnswerText}>
                      תשובתך: {userAnswerText}
                      {userAnswer !== question.correctAnswer &&
                        `\nהתשובה הנכונה: ${correctAnswerText}`
                      }
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          
          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.button} onPress={restartQuiz}>
              <Text style={styles.buttonText}>נסה שוב</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.homeButton]} onPress={goToHome}>
              <Text style={[styles.buttonText, styles.homeButtonText]}>חזור לדף הבית</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  
  const currentQuestion = questions[quizState.currentQuestionIndex];
  const selectedAnswer = quizState.answers[quizState.currentQuestionIndex];
  const isCorrect = selectedAnswer !== null && currentQuestion && selectedAnswer === currentQuestion.correctAnswer;
  
  // Safety check - if no current question, go back to home
  if (!currentQuestion) {
    // If questions array exists but current question doesn't, this is likely a data issue
    if (questions.length > 0) {
      console.error('Current question is undefined even though questions array exists');
    }
    
    // Navigate back to home with a proper message
    useEffect(() => {
      if (!loading && !currentQuestion) {
        Alert.alert(
          'שגיאה בטעינת השאלון',
          'לא ניתן היה לטעון את השאלון כראוי. אנא נסה שוב.',
          [{ text: 'חזור', onPress: () => navigation.navigate('Home') }]
        );
      }
    }, [loading, currentQuestion]);
    
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>אירעה שגיאה בטעינת השאלון</Text>
        <TouchableOpacity style={styles.button} onPress={goToHome}>
          <Text style={styles.buttonText}>חזור לדף הבית</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.exitButton} onPress={goToHome}>
          <Ionicons name="close" size={24} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>סיכוםAI</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.quizContainer}>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              שאלה {quizState.currentQuestionIndex + 1} מתוך {questions.length}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((quizState.currentQuestionIndex + 1) / questions.length) * 100}%` }
                ]} 
              />
            </View>
          </View>
          
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
          
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  selectedAnswer === index && styles.selectedOption,
                  quizState.showFeedback && selectedAnswer === index && isCorrect && styles.correctOptionHighlight,
                  quizState.showFeedback && selectedAnswer === index && !isCorrect && styles.wrongOptionHighlight,
                  quizState.showFeedback && selectedAnswer !== index && index === currentQuestion.correctAnswer && styles.correctOptionHighlight,
                ]}
                onPress={() => !quizState.showFeedback && handleAnswer(index)}
                disabled={quizState.showFeedback}
              >
                <Text style={[
                  styles.optionText,
                  selectedAnswer === index && styles.selectedOptionText,
                  quizState.showFeedback && selectedAnswer === index && isCorrect && styles.correctOptionText,
                  quizState.showFeedback && selectedAnswer === index && !isCorrect && styles.wrongOptionText,
                  quizState.showFeedback && selectedAnswer !== index && index === currentQuestion.correctAnswer && styles.correctOptionText,
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {quizState.showFeedback && (
            <View style={styles.feedbackContainer}>
              <Text style={[
                styles.feedbackTitle,
                isCorrect ? styles.correctFeedbackTitle : styles.wrongFeedbackTitle
              ]}>
                {isCorrect ? '✓ תשובה נכונה!' : '✗ תשובה שגויה'}
              </Text>
              <Text style={styles.explanationText}>
                {currentQuestion.explanation}
              </Text>
            </View>
          )}
          
          <View style={styles.navigationButtons}>
            {/* Left side button - should be "הבא" (Next) */}
            <TouchableOpacity 
              style={[
                styles.navButton, 
                styles.nextButton,
                (selectedAnswer === null && !quizState.showFeedback) && styles.disabledButton,
              ]} 
              onPress={goToNextQuestion}
              disabled={selectedAnswer === null && !quizState.showFeedback}
            >
              <Text style={[styles.navButtonText, styles.nextButtonText]}>
                {quizState.currentQuestionIndex === questions.length - 1 ? 'סיים' : 'הבא'}
              </Text>
            </TouchableOpacity>
            
            {/* Right side button - should be "הקודם" (Previous) */}
            {quizState.currentQuestionIndex > 0 && (
              <TouchableOpacity 
                style={[styles.navButton, styles.prevButton]} 
                onPress={goToPreviousQuestion}
              >
                <Text style={[styles.navButtonText, styles.prevButtonText]}>הקודם</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  quizContainer: {
    padding: 20,
    paddingBottom: 40,
    minHeight: '100%',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
  },
  questionText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'right',
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedOption: {
    borderColor: '#4A90E2',
    backgroundColor: '#ECF4FD',
  },
  correctOptionHighlight: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
  },
  wrongOptionHighlight: {
    borderColor: '#F44336',
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
  },
  selectedOptionText: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  correctOptionText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  wrongOptionText: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  prevButton: {
    backgroundColor: '#f1f1f1',
  },
  nextButton: {
    backgroundColor: '#4A90E2',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButtonText: {
    color: 'white',
  },
  prevButtonText: {
    color: '#333',
  },
  feedbackContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxWidth: '100%',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  correctFeedbackTitle: {
    color: '#4CAF50',
  },
  wrongFeedbackTitle: {
    color: '#F44336',
  },
  explanationText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
    lineHeight: 20,
  },
  resultHeaderContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scorePercentage: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreText: {
    fontSize: 14,
    color: 'white',
  },
  resultMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultSummary: {
    marginBottom: 32,
  },
  resultQuestion: {
    marginBottom: 16,
  },
  resultQuestionText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'right',
  },
  resultAnswerContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  correctAnswerContainer: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  wrongAnswerContainer: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  resultAnswerText: {
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 20,
  },
  buttonsContainer: {
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  homeButton: {
    backgroundColor: '#f1f1f1',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  homeButtonText: {
    color: '#333',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  exitButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40, // Same size as exit button for balanced spacing
  },
}); 