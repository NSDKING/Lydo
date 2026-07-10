import {
  configurePurchases,
  getCurrentOffering,
  getCustomerInfo,
  hasPremiumEntitlement,
  loginPurchases,
  logoutPurchases,
  purchasePackage,
  restorePurchases as restorePurchasesApi,
  subscribeToCustomerInfoUpdates,
} from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

interface PurchasesContextValue {
  isReady: boolean;
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  restore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextValue>({
  isReady: false,
  isPremium: false,
  customerInfo: null,
  offering: null,
  purchase: async () => {},
  restore: async () => {},
  refresh: async () => {},
});

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const loggedInUserId = useRef<string | null>(null);

  const applyCustomerInfo = useCallback((info: CustomerInfo | null) => {
    setCustomerInfo(info);
  }, []);

  const refresh = useCallback(async () => {
    const info = await getCustomerInfo();
    applyCustomerInfo(info);
    const current = await getCurrentOffering();
    setOffering(current);
  }, [applyCustomerInfo]);

  // Configure the SDK once, then keep RevenueCat's identity in sync with Supabase auth.
  useEffect(() => {
    (async () => {
      try {
        await configurePurchases();
        await refresh();

        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id ?? null;
        if (uid) {
          loggedInUserId.current = uid;
          const info = await loginPurchases(uid);
          if (info) applyCustomerInfo(info);
        }
      } finally {
        setIsReady(true);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid && uid !== loggedInUserId.current) {
        loggedInUserId.current = uid;
        const info = await loginPurchases(uid);
        if (info) applyCustomerInfo(info);
      } else if (!uid && loggedInUserId.current) {
        loggedInUserId.current = null;
        const info = await logoutPurchases();
        if (info) applyCustomerInfo(info);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time entitlement updates (renewals, cancellations, purchases made on another device).
  useEffect(() => {
    return subscribeToCustomerInfoUpdates(applyCustomerInfo);
  }, [applyCustomerInfo]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const info = await purchasePackage(pkg);
    applyCustomerInfo(info);
  }, [applyCustomerInfo]);

  const restore = useCallback(async () => {
    const info = await restorePurchasesApi();
    applyCustomerInfo(info);
  }, [applyCustomerInfo]);

  const isPremium = hasPremiumEntitlement(customerInfo);

  return (
    <PurchasesContext.Provider value={{ isReady, isPremium, customerInfo, offering, purchase, restore, refresh }}>
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  return useContext(PurchasesContext);
}
