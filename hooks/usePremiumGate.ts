import { usePurchases } from '@/context/PurchasesContext';
import { useRouter } from 'expo-router';

// Shared "isPremium check → route to paywall on tap" idiom, previously
// duplicated inline per screen (see app/(tabs)/plan.tsx's isDayGated).
export function usePremiumGate() {
  const { isPremium } = usePurchases();
  const router = useRouter();

  const requirePremium = (onAllowed: () => void) => {
    if (isPremium) onAllowed();
    else router.push('/paywall');
  };

  return { isPremium, requirePremium };
}
