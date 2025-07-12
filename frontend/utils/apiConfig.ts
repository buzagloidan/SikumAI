import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get API URL from environment variables or constants
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || 
               process.env.EXPO_PUBLIC_API_URL || 
               'YOUR_API_URL';

/**
 * Returns the base API URL
 */
export const getBaseApiUrl = (): string => {
  return API_URL;
};

/**
 * Returns the full URL for a specific API endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getBaseApiUrl();
  // Ensure endpoint starts with a slash
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
}; 