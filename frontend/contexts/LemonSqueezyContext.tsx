import React, { createContext, useState, useContext } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import { useSession } from './SessionContext';

// Define the store URLs for your LemonSqueezy products (production only)
const STORE_URLS = {
  monthly: 'https://sikumai.lemonsqueezy.com/buy/dbdfbf08-de0b-484d-90ff-bd19ef3ed935',
  yearly: 'https://sikumai.lemonsqueezy.com/buy/55e16ba5-865d-44b5-91fa-2be88bb85d1f'
};

type LemonSqueezyContextType = {
  isLoading: boolean;
  purchaseSubscription: (type: 'monthly' | 'yearly') => Promise<void>;
};

const LemonSqueezyContext = createContext<LemonSqueezyContextType | undefined>(undefined);

export const LemonSqueezyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user, subscriptionStatus } = useSession();

  const webPurchaseSubscription = async (type: 'monthly' | 'yearly') => {
    if (!user) {
      throw new Error('User must be logged in to purchase a subscription');
    }

    if (subscriptionStatus === 'active') {
      throw new Error('You already have an active subscription');
    }

    const storeUrl = STORE_URLS[type];
    if (!storeUrl) {
      throw new Error('Invalid subscription type');
    }

    // Add the user ID as custom data
    const urlWithCustomData = `${storeUrl}?checkout[custom][user_id]=${user.id}`;

    // Open the LemonSqueezy checkout in a new window
    window.open(urlWithCustomData, '_blank');
  };

  // For mobile platforms, redirect to browser checkout
  const mobilePurchaseSubscription = async (type: 'monthly' | 'yearly') => {
    if (!user) {
      throw new Error('User must be logged in to purchase a subscription');
    }

    if (subscriptionStatus === 'active') {
      throw new Error('You already have an active subscription');
    }

    const storeUrl = STORE_URLS[type];
    if (!storeUrl) {
      throw new Error('Invalid subscription type');
    }

    // Add the user ID as custom data
    const urlWithCustomData = `${storeUrl}?checkout[custom][user_id]=${user.id}`;

    // Open in browser
    const canOpen = await Linking.canOpenURL(urlWithCustomData);
    if (canOpen) {
      await Linking.openURL(urlWithCustomData);
    } else {
      throw new Error('Could not open browser for checkout');
    }
  };

  const purchaseSubscription = Platform.OS === 'web' ? webPurchaseSubscription : mobilePurchaseSubscription;

  return (
    <LemonSqueezyContext.Provider
      value={{
        isLoading,
        purchaseSubscription
      }}
    >
      {children}
    </LemonSqueezyContext.Provider>
  );
};

export const useLemonSqueezy = () => {
  const context = useContext(LemonSqueezyContext);
  if (context === undefined) {
    throw new Error('useLemonSqueezy must be used within a LemonSqueezyProvider');
  }
  return context;
}; 