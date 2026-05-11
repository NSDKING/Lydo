import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { generateMenuPlan, MenuPlan } from '@/services/api';

interface LoggedMeals {
  [day: string]: Set<number>;
}

interface Macros {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface MenuContextValue {
  plan: MenuPlan | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  loggedMeals: LoggedMeals;
  logMeal: (day: string, mealIndex: number) => void;
  getEatenCalories: (day: string) => number;
  getEatenMacros: (day: string) => Macros;
}

const MenuContext = createContext<MenuContextValue>({
  plan: null,
  isLoading: false,
  error: null,
  refresh: () => {},
  loggedMeals: {},
  logMeal: () => {},
  getEatenCalories: () => 0,
  getEatenMacros: () => ({ protein_g: 0, carbs_g: 0, fat_g: 0 }),
});

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<MenuPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeals>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateMenuPlan({ days: 7, mealsPerDay: 3, targetCalories: 2000 });
      setPlan(result);
      setLoggedMeals({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logMeal = useCallback((day: string, mealIndex: number) => {
    setLoggedMeals(prev => {
      const daySet = new Set(prev[day] ?? []);
      if (daySet.has(mealIndex)) {
        daySet.delete(mealIndex);
      } else {
        daySet.add(mealIndex);
      }
      return { ...prev, [day]: new Set(daySet) };
    });
  }, []);

  const getEatenCalories = useCallback((day: string): number => {
    const dayPlan = plan?.days.find(d => d.day === day);
    if (!dayPlan) return 0;
    const logged = loggedMeals[day] ?? new Set<number>();
    return dayPlan.meals.reduce((sum, meal, i) => sum + (logged.has(i) ? meal.calories : 0), 0);
  }, [plan, loggedMeals]);

  const getEatenMacros = useCallback((day: string): Macros => {
    const dayPlan = plan?.days.find(d => d.day === day);
    if (!dayPlan) return { protein_g: 0, carbs_g: 0, fat_g: 0 };
    const logged = loggedMeals[day] ?? new Set<number>();
    return dayPlan.meals.reduce(
      (acc, meal, i) => logged.has(i)
        ? { protein_g: acc.protein_g + meal.protein_g, carbs_g: acc.carbs_g + meal.carbs_g, fat_g: acc.fat_g + meal.fat_g }
        : acc,
      { protein_g: 0, carbs_g: 0, fat_g: 0 }
    );
  }, [plan, loggedMeals]);

  return (
    <MenuContext.Provider value={{ plan, isLoading, error, refresh: load, loggedMeals, logMeal, getEatenCalories, getEatenMacros }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
