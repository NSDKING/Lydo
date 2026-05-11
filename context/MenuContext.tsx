import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { generateMenuPlan, MenuPlan } from '@/services/api';

interface MenuContextValue {
  plan: MenuPlan | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const MenuContext = createContext<MenuContextValue>({
  plan: null,
  isLoading: false,
  error: null,
  refresh: () => {},
});

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<MenuPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateMenuPlan({
        days: 7,
        mealsPerDay: 3,
        targetCalories: 2000,
      });
      setPlan(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <MenuContext.Provider value={{ plan, isLoading, error, refresh: load }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
