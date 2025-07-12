declare module 'react-native-purchases' {
  export enum LOG_LEVEL {
    VERBOSE = 'VERBOSE',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
  }

  export interface CustomerInfo {
    entitlements: {
      active: {
        [key: string]: any;
      };
      all: {
        [key: string]: any;
      };
    };
    allPurchasedProductIdentifiers: string[];
    allExpirationDates: {
      [key: string]: string;
    };
    latestExpirationDate: string | null;
    firstSeen: string;
    originalAppUserId: string;
    requestDate: string;
    allPurchaseDates: {
      [key: string]: string;
    };
    originalApplicationVersion: string | null;
    originalPurchaseDate: string | null;
    managementURL: string | null;
  }

  export interface PurchasesPackage {
    identifier: string;
    packageType: string;
    product: {
      identifier: string;
      description: string;
      title: string;
      price: number;
      priceString: string;
      currencyCode: string;
      [key: string]: any;
    };
    offeringIdentifier: string;
    [key: string]: any;
  }

  export interface PurchasesOffering {
    identifier: string;
    description: string;
    availablePackages: PurchasesPackage[];
    serverDescription: string;
    [key: string]: any;
  }

  export interface PurchasesOfferings {
    current: PurchasesOffering | null;
    all: {
      [key: string]: PurchasesOffering;
    };
    [key: string]: any;
  }

  export type CustomerInfoUpdateListener = (customerInfo: CustomerInfo) => void;

  export interface ListenerRemover {
    remove: () => void;
  }

  export interface PurchasesConfiguration {
    apiKey: string;
    appUserID?: string;
    userDefaultsSuiteName?: string;
    observerMode?: boolean;
    useAmazon?: boolean;
  }

  export default class Purchases {
    static setLogLevel(level: LOG_LEVEL): void;
    static configure(configuration: PurchasesConfiguration): Promise<void>;
    static getOfferings(): Promise<PurchasesOfferings>;
    static getCustomerInfo(): Promise<CustomerInfo>;
    static purchasePackage(aPackage: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }>;
    static restorePurchases(): Promise<CustomerInfo>;
    static addCustomerInfoUpdateListener(listener: CustomerInfoUpdateListener): ListenerRemover;
  }
} 