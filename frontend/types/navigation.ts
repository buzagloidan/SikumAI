import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Upload: undefined;
  Quiz: { jobId: string };
  Subscription: undefined;
  OAuthCallback: undefined;
  ApiTest: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type UploadScreenProps = NativeStackScreenProps<RootStackParamList, 'Upload'>;
export type QuizScreenProps = NativeStackScreenProps<RootStackParamList, 'Quiz'>;
export type SubscriptionScreenProps = NativeStackScreenProps<RootStackParamList, 'Subscription'>;
export type OAuthCallbackScreenProps = NativeStackScreenProps<RootStackParamList, 'OAuthCallback'>;
export type ApiTestScreenProps = NativeStackScreenProps<RootStackParamList, 'ApiTest'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export type PrivacyPolicyScreenProps = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;
export type TermsOfServiceScreenProps = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 