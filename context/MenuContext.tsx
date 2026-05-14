import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  DayPlan,
  Meal,
  MenuPlan,
  TiktokRecipe,
  fetchWeeklyPlan,
  generateMenuPlan,
  getWeekKey,
  saveUserRecipe,
  swapMeal as apiSwapMeal,
} from '@/services/api';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type DayKey = string; // "Monday", "Tuesday", …
type MealOverrides = Record<DayKey, Record<number, Partial<Meal>>>;

interface MenuContextValue {
  plan: MenuPlan | null;
  isLoading: boolean;
  error: string | null;
  planExistsInDB: boolean;                          // true = loaded from cache, false = AI ran
  refresh: () => void;                              // force-regenerate
  // logging
  loggedMeals: Record<DayKey, Set<number>>;
  logMeal: (day: DayKey, idx: number) => void;
  getEatenCalories: (day: DayKey) => number;
  getEatenMacros: (day: DayKey) => { protein_g: number; carbs_g: number; fat_g: number };
  // locking
  lockedMeals: Record<DayKey, Set<number>>;
  lockMeal: (day: DayKey, idx: number) => void;
  // edit (name override)
  editMealName: (day: DayKey, idx: number, name: string) => void;
  // swap (AI replacement)
  swappingMeal: { day: DayKey; idx: number } | null;
  swapMeal: (day: DayKey, idx: number) => Promise<void>;
  // add TikTok recipe to a specific day slot
  addTiktokMeal: (day: DayKey, slotIdx: number, recipe: TiktokRecipe) => void;
  // apply any meal directly (used by swap modal preview confirm)
  applyMealOverride: (day: DayKey, idx: number, meal: Meal) => void;
  // persist current plan (with overrides) to Supabase
  persistCurrentPlan: () => Promise<void>;
  // effective meal (base + overrides)
  getEffectiveDayPlan: (day: DayKey) => DayPlan | null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const MenuContext = createContext<MenuContextValue>({
  plan: null, isLoading: false, error: null, planExistsInDB: false, refresh: () => {},
  loggedMeals: {}, logMeal: () => {}, getEatenCalories: () => 0,
  getEatenMacros: () => ({ protein_g: 0, carbs_g: 0, fat_g: 0 }),
  lockedMeals: {}, lockMeal: () => {},
  editMealName: () => {},
  swappingMeal: null, swapMeal: async () => {},
  addTiktokMeal: () => {},
  applyMealOverride: () => {},
  persistCurrentPlan: async () => {},
  getEffectiveDayPlan: () => null,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<MenuPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planExistsInDB, setPlanExistsInDB] = useState(false);
  const [loggedMeals, setLoggedMeals] = useState<Record<DayKey, Set<number>>>({});
  const [lockedMeals, setLockedMeals] = useState<Record<DayKey, Set<number>>>({});
  const [mealOverrides, setMealOverrides] = useState<MealOverrides>({});
  const [swappingMeal, setSwappingMeal] = useState<{ day: DayKey; idx: number } | null>(null);

  // Load: check Supabase cache first, run AI only if planExistsInDB is false
  const load = useCallback(async (forceRegenerate = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const weekKey = getWeekKey();

      if (!forceRegenerate) {
        const cached = await fetchWeeklyPlan(weekKey);
        if (cached) {
          setPlanExistsInDB(true);   // plan found in DB — skip AI
          setPlan(cached);
          return;
        }
      }

      // planExistsInDB is false — AI generation required
      setPlanExistsInDB(false);
      const fresh = await generateMenuPlan({ days: 7, mealsPerDay: 3, targetCalories: 2000 });
      setPlan(fresh);
      setPlanExistsInDB(true);       // will be persisted by the backend after this
      setLoggedMeals({});
      setLockedMeals({});
      setMealOverrides({});
      // Fire-and-forget: save all generated meals to user_recipes
      fresh.days.forEach(day =>
        day.meals.forEach(meal =>
          saveUserRecipe(meal).catch(() => {})
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Logging ────────────────────────────────────────────────────────────────

  const logMeal = useCallback((day: DayKey, idx: number) => {
    setLoggedMeals(prev => {
      const s = new Set(prev[day] ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      return { ...prev, [day]: new Set(s) };
    });
  }, []);

  const getEatenCalories = useCallback((day: DayKey): number => {
    const dayPlan = plan?.days.find(d => d.day === day);
    if (!dayPlan) return 0;
    const logged = loggedMeals[day] ?? new Set<number>();
    const overrides = mealOverrides[day] ?? {};
    return dayPlan.meals.reduce((sum, meal, i) => {
      if (!logged.has(i)) return sum;
      return sum + (overrides[i]?.calories ?? meal.calories);
    }, 0);
  }, [plan, loggedMeals, mealOverrides]);

  const getEatenMacros = useCallback((day: DayKey) => {
    const dayPlan = plan?.days.find(d => d.day === day);
    if (!dayPlan) return { protein_g: 0, carbs_g: 0, fat_g: 0 };
    const logged = loggedMeals[day] ?? new Set<number>();
    const overrides = mealOverrides[day] ?? {};
    return dayPlan.meals.reduce((acc, meal, i) => {
      if (!logged.has(i)) return acc;
      const m = { ...meal, ...overrides[i] };
      return { protein_g: acc.protein_g + m.protein_g, carbs_g: acc.carbs_g + m.carbs_g, fat_g: acc.fat_g + m.fat_g };
    }, { protein_g: 0, carbs_g: 0, fat_g: 0 });
  }, [plan, loggedMeals, mealOverrides]);

  // ── Locking ────────────────────────────────────────────────────────────────

  const lockMeal = useCallback((day: DayKey, idx: number) => {
    setLockedMeals(prev => {
      const s = new Set(prev[day] ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      return { ...prev, [day]: new Set(s) };
    });
  }, []);

  // ── Edit ───────────────────────────────────────────────────────────────────

  const editMealName = useCallback((day: DayKey, idx: number, name: string) => {
    setMealOverrides(prev => ({
      ...prev,
      [day]: { ...prev[day], [idx]: { ...prev[day]?.[idx], name } },
    }));
  }, []);

  // ── Swap ───────────────────────────────────────────────────────────────────

  const swapMeal = useCallback(async (day: DayKey, idx: number) => {
    const effectiveDay = plan?.days.find(d => d.day === day);
    if (!effectiveDay) return;
    setSwappingMeal({ day, idx });
    try {
      const newMeal = await apiSwapMeal(effectiveDay, idx);
      setMealOverrides(prev => ({
        ...prev,
        [day]: { ...prev[day], [idx]: newMeal },
      }));
    } catch (err) {
      console.warn('Swap failed:', (err as Error).message);
    } finally {
      setSwappingMeal(null);
    }
  }, [plan]);

  // ── Apply any meal override directly ──────────────────────────────────────

  const applyMealOverride = useCallback((day: DayKey, idx: number, meal: Meal) => {
    setMealOverrides(prev => ({
      ...prev,
      [day]: { ...prev[day], [idx]: meal },
    }));
  }, []);

  // ── Persist current plan (with overrides) to Supabase ─────────────────────

  const persistCurrentPlan = useCallback(async () => {
    if (!plan) return;
    const weekKey = getWeekKey();
    const effectiveDays = plan.days.map(d => {
      const overrides = mealOverrides[d.day] ?? {};
      const meals = d.meals.map((meal, i) =>
        overrides[i] ? { ...meal, ...overrides[i] } as Meal : meal
      );
      return { ...d, meals };
    });
    await supabase
      .from('weekly_plans')
      .upsert({ week_key: weekKey, plan_text: JSON.stringify({ days: effectiveDays }), created_at: new Date().toISOString() });
  }, [plan, mealOverrides]);

  // ── Add TikTok meal ────────────────────────────────────────────────────────

  const addTiktokMeal = useCallback((day: DayKey, slotIdx: number, recipe: TiktokRecipe) => {
    const meal: Meal = {
      name: recipe.title,
      calories: recipe.macros.calories,
      protein_g: recipe.macros.protein_g,
      carbs_g: recipe.macros.carbs_g,
      fat_g: recipe.macros.fat_g,
      ingredients: recipe.ingredients,
      lidl_products_used: [],
    };
    setMealOverrides(prev => ({
      ...prev,
      [day]: { ...prev[day], [slotIdx]: meal },
    }));
  }, []);

  // ── Effective day plan (base + overrides) ──────────────────────────────────

  const getEffectiveDayPlan = useCallback((day: DayKey): DayPlan | null => {
    const base = plan?.days.find(d => d.day === day) ?? null;
    if (!base) return null;
    const overrides = mealOverrides[day] ?? {};
    const meals = base.meals.map((meal, i) =>
      overrides[i] ? { ...meal, ...overrides[i] } as Meal : meal
    );
    const total_calories = meals.reduce((s, m) => s + m.calories, 0);
    const protein_g = meals.reduce((s, m) => s + m.protein_g, 0);
    const carbs_g = meals.reduce((s, m) => s + m.carbs_g, 0);
    const fat_g = meals.reduce((s, m) => s + m.fat_g, 0);
    return { ...base, meals, total_calories, protein_g, carbs_g, fat_g };
  }, [plan, mealOverrides]);

  return (
    <MenuContext.Provider value={{
      plan, isLoading, error, planExistsInDB, refresh: () => load(true),
      loggedMeals, logMeal, getEatenCalories, getEatenMacros,
      lockedMeals, lockMeal,
      editMealName,
      swappingMeal, swapMeal,
      addTiktokMeal,
      applyMealOverride,
      persistCurrentPlan,
      getEffectiveDayPlan,
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
