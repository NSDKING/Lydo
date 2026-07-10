import { NativeModules, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

// True only when the native RNPurchases module is actually compiled into the binary.
// Returns false in Expo Go and any build that predates adding react-native-purchases.
function isNativeAvailable(): boolean {
  return !!NativeModules.RNPurchases;
}

// RevenueCat Apple App Store API key. Test Store keys ("test_...") are rejected by the
// native SDK in production/TestFlight/App-Store builds, and that rejection crashes the app
// (RN New Architecture bug: native exception -> JSI conversion corrupts the Hermes heap
// instead of raising a catchable JS error). Set EXPO_PUBLIC_REVENUECAT_API_KEY per EAS build
// profile so only local/dev-client builds use the test key.
export const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || 'test_LGbElNrZzBfiFvLxYGzYatoONEP';

// Must match the entitlement identifier configured in the RevenueCat dashboard.
export const ENTITLEMENT_ID = 'dano Pro';

// RevenueCat's reserved package identifiers — must match the "default" Offering's packages.
export const PACKAGE_IDS = {
  monthly: '$rc_monthly',
  yearly: '$rc_annual',
} as const;

let configured = false;

export function isPurchasesConfigured() {
  return configured;
}

export async function configurePurchases(appUserId?: string) {
  if (configured || Platform.OS === 'web') return;
  if (!isNativeAvailable()) {
    console.warn('[purchases] Native module not found — billing unavailable (Expo Go or stale build).');
    return;
  }
  if (!REVENUECAT_API_KEY) {
    console.warn('[purchases] RevenueCat API key not set — running without billing.');
    return;
  }
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: appUserId });
    configured = true;
  } catch (e) {
    console.warn('[purchases] configure failed.', e);
  }
}

// Call once a user signs in, to alias the RevenueCat anonymous ID to your own user ID.
export async function loginPurchases(appUserId: string): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(appUserId);
    return customerInfo;
  } catch (e) {
    console.warn('[purchases] logIn failed', e);
    return null;
  }
}

// Call on sign-out to return to a new anonymous RevenueCat user.
export async function logoutPurchases(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.logOut();
  } catch (e) {
    console.warn('[purchases] logOut failed', e);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function hasPremiumEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return await Purchases.restorePurchases();
}

// Subscribe to real-time entitlement changes (renewals, cancellations, purchases made
// elsewhere). Returns an unsubscribe function. Prefer this over polling on AppState.
export function subscribeToCustomerInfoUpdates(listener: CustomerInfoUpdateListener): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}
