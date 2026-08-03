import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  DayPlan,
  Meal,
  MenuPlan,
  TiktokRecipe,
  clearWeeklyPlan,
  fetchUserRecipes,
  fetchWeeklyPlan,
  generateMenuPlan,
  generateMenuTeaser,
  getWeekKey,
  saveUserRecipe,
  swapMeal as apiSwapMeal,
} from '@/services/api';
import { supabase } from '@/lib/supabase';
import { deleteDietaryEnergySample, writeDietaryEnergy } from '@/lib/health';
import { useProfile } from '@/context/ProfileContext';
import { usePurchases } from '@/context/PurchasesContext';

const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });

// ─── Types ───────────────────────────────────────────────────────────────────

type DayKey = string; // "Monday", "Tuesday", …
type MealOverrides = Record<DayKey, Record<number, Partial<Meal>>>;

// One-off asks for a single (re)generation — not persisted to the profile.
export interface RegenerateOptions {
  includedRecipes?: string;
  selectedRecipeIds?: string[];
  generalNotes?: string;
}

// The app only ever shows the plan for the current real-world week, so a weekday
// name (DayKey) maps 1:1 to a calendar date within it — needed to persist logs
// against an actual date rather than an ambiguous "Monday" that recurs every week.
const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dateKeyForDay(day: DayKey): string {
  const targetIdx = WEEKDAY_ORDER.indexOf(day);
  const now = new Date();
  const currentIdx = (now.getDay() + 6) % 7; // Mon=0..Sun=6
  const d = new Date(now);
  d.setDate(d.getDate() + (targetIdx - currentIdx));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface ExtraMeal {
  id: string;
  healthkitUuid?: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  source: 'barcode' | 'ai' | 'manual';
}

// rating: 1–5 stars per logged plan meal
type MealRatings = Record<DayKey, Record<number, number>>;
// optional user note per logged plan meal
type MealDescriptions = Record<DayKey, Record<number, string>>;

interface MenuContextValue {
  plan: MenuPlan | null;
  isLoading: boolean;
  error: string | null;
  planExistsInDB: boolean;
  refresh: (opts?: RegenerateOptions) => void;
  // logging
  loggedMeals: Record<DayKey, Set<number>>;
  logMeal: (day: DayKey, idx: number) => void;
  getEatenCalories: (day: DayKey) => number;
  getEatenMacros: (day: DayKey) => { protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  // ratings & descriptions
  mealRatings: MealRatings;
  mealDescriptions: MealDescriptions;
  rateMeal: (day: DayKey, idx: number, rating: number) => void;
  describeMeal: (day: DayKey, idx: number, description: string) => void;
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
  // extra meals logged outside the plan
  extraMeals: Record<DayKey, ExtraMeal[]>;
  addExtraMeal: (day: DayKey, meal: Omit<ExtraMeal, 'id' | 'healthkitUuid'>) => void;
  editExtraMeal: (day: DayKey, id: string, meal: Omit<ExtraMeal, 'id' | 'healthkitUuid'>) => void;
  removeExtraMeal: (day: DayKey, id: string) => void;
  // persist current plan (with overrides) to Supabase
  persistCurrentPlan: () => Promise<void>;
  // effective meal (base + overrides)
  getEffectiveDayPlan: (day: DayKey) => DayPlan | null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const MenuContext = createContext<MenuContextValue>({
  plan: null, isLoading: false, error: null, planExistsInDB: false, refresh: () => {},
  loggedMeals: {}, logMeal: () => {}, getEatenCalories: () => 0,
  getEatenMacros: () => ({ protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }),
  mealRatings: {}, mealDescriptions: {}, rateMeal: () => {}, describeMeal: () => {},
  lockedMeals: {}, lockMeal: () => {},
  editMealName: () => {},
  swappingMeal: null, swapMeal: async () => {},
  addTiktokMeal: () => {},
  applyMealOverride: () => {},
  extraMeals: {}, addExtraMeal: () => {}, editExtraMeal: () => {}, removeExtraMeal: () => {},
  persistCurrentPlan: async () => {},
  getEffectiveDayPlan: () => null,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRatingsSummary(
  plan: MenuPlan | null,
  mealRatings: MealRatings,
  mealOverrides: MealOverrides,
): string {
  const items: string[] = [];
  plan?.days.forEach(d => {
    d.meals.forEach((meal, idx) => {
      const rating = mealRatings[d.day]?.[idx];
      if (rating == null) return;
      const name = mealOverrides[d.day]?.[idx]?.name ?? meal.name;
      items.push(`${name}: ${rating}/5`);
    });
  });
  if (items.length === 0) return '';
  return `User meal ratings from this week (use to guide next week — favour highly-rated meals/ingredients and avoid low-rated ones): ${items.join(', ')}.`;
}

const RATINGS_KEY = (weekKey: string) => `lydo_meal_ratings_${weekKey}`;
const DESCRIPTIONS_KEY = (weekKey: string) => `lydo_meal_descriptions_${weekKey}`;

/*
  Required Supabase migration (run once in SQL editor):

  create table if not exists public.meal_ratings (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    week_key text not null,
    day text not null,
    meal_index integer not null,
    meal_name text default '',
    rating integer check (rating between 1 and 5),
    description text default '',
    created_at timestamptz default now(),
    unique(user_id, week_key, day, meal_index)
  );
  alter table public.meal_ratings enable row level security;
  create policy "manage own ratings" on public.meal_ratings
    for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
*/

async function upsertRatingToSupabase(
  userId: string,
  weekKey: string,
  day: string,
  mealIndex: number,
  mealName: string,
  rating: number | null,
  description: string,
) {
  try {
    await supabase.from('meal_ratings').upsert(
      { user_id: userId, week_key: weekKey, day, meal_index: mealIndex, meal_name: mealName, rating, description },
      { onConflict: 'user_id,week_key,day,meal_index' },
    );
  } catch { /* silently fail — local state is still saved */ }
}

function getMealName(plan: MenuPlan | null, overrides: MealOverrides, day: string, idx: number): string {
  const baseMeal = plan?.days.find(d => d.day === day)?.meals[idx];
  return overrides[day]?.[idx]?.name ?? baseMeal?.name ?? '';
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const { isPremium, isReady: purchasesReady } = usePurchases();
  const [plan, setPlan] = useState<MenuPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planExistsInDB, setPlanExistsInDB] = useState(false);
  const [loggedMeals, setLoggedMeals] = useState<Record<DayKey, Set<number>>>({});
  // healthkit_uuid of the Apple Health sample written for each logged plan-meal slot —
  // needed to delete the right sample again on unlog. Not exposed via context value.
  const [loggedMealHealthkitIds, setLoggedMealHealthkitIds] = useState<Record<DayKey, Record<number, string>>>({});
  const [lockedMeals, setLockedMeals] = useState<Record<DayKey, Set<number>>>({});
  const [mealOverrides, setMealOverrides] = useState<MealOverrides>({});
  const [swappingMeal, setSwappingMeal] = useState<{ day: DayKey; idx: number } | null>(null);
  const [extraMeals, setExtraMeals] = useState<Record<DayKey, ExtraMeal[]>>({});
  const [mealRatings, setMealRatings] = useState<MealRatings>({});
  const [mealDescriptions, setMealDescriptions] = useState<MealDescriptions>({});

  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const isPremiumRef = useRef(isPremium);
  useEffect(() => { isPremiumRef.current = isPremium; }, [isPremium]);

  const planRef = useRef(plan);
  useEffect(() => { planRef.current = plan; }, [plan]);

  const mealRatingsRef = useRef(mealRatings);
  useEffect(() => { mealRatingsRef.current = mealRatings; }, [mealRatings]);

  const mealDescriptionsRef = useRef(mealDescriptions);
  useEffect(() => { mealDescriptionsRef.current = mealDescriptions; }, [mealDescriptions]);

  const mealOverridesRef = useRef(mealOverrides);
  useEffect(() => { mealOverridesRef.current = mealOverrides; }, [mealOverrides]);

  const loggedMealHealthkitIdsRef = useRef(loggedMealHealthkitIds);
  useEffect(() => { loggedMealHealthkitIdsRef.current = loggedMealHealthkitIds; }, [loggedMealHealthkitIds]);

  const extraMealsRef = useRef(extraMeals);
  useEffect(() => { extraMealsRef.current = extraMeals; }, [extraMeals]);

  const didInitialLoad = useRef(false);

  // Load ratings/descriptions: Supabase is source of truth, AsyncStorage is fast cache
  useEffect(() => {
    const weekKey = getWeekKey();

    // 1. Load from AsyncStorage immediately (fast)
    AsyncStorage.getItem(RATINGS_KEY(weekKey)).then(raw => {
      if (raw) try { setMealRatings(JSON.parse(raw)); } catch { /* ignore */ }
    }).catch(() => {});
    AsyncStorage.getItem(DESCRIPTIONS_KEY(weekKey)).then(raw => {
      if (raw) try { setMealDescriptions(JSON.parse(raw)); } catch { /* ignore */ }
    }).catch(() => {});

    // 2. Fetch from Supabase (may override cache with fresher cross-device data)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('meal_ratings')
          .select('day, meal_index, rating, description')
          .eq('user_id', session.user.id)
          .eq('week_key', weekKey);
        if (!data || data.length === 0) return;
        const ratings: MealRatings = {};
        const descriptions: MealDescriptions = {};
        for (const row of data) {
          if (!ratings[row.day]) ratings[row.day] = {};
          if (!descriptions[row.day]) descriptions[row.day] = {};
          if (row.rating != null) ratings[row.day][row.meal_index] = row.rating;
          if (row.description) descriptions[row.day][row.meal_index] = row.description;
        }
        if (Object.keys(ratings).length > 0) {
          setMealRatings(ratings);
          AsyncStorage.setItem(RATINGS_KEY(weekKey), JSON.stringify(ratings)).catch(() => {});
        }
        if (Object.keys(descriptions).length > 0) {
          setMealDescriptions(descriptions);
          AsyncStorage.setItem(DESCRIPTIONS_KEY(weekKey), JSON.stringify(descriptions)).catch(() => {});
        }
      } catch { /* offline — AsyncStorage data is fine */ }
    })();
  }, []);

  // Load persisted logged meals (plan-meal toggles + extra items) for the current
  // week so they survive app restarts — see supabase/migrations/*_create_logged_meals.sql.
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const dayForDate: Record<string, DayKey> = {};
        WEEKDAY_ORDER.forEach(d => { dayForDate[dateKeyForDay(d)] = d; });
        const { data } = await supabase
          .from('logged_meals')
          .select('id, logged_date, kind, plan_day, plan_meal_index, name, calories, protein_g, carbs_g, fat_g, fiber_g, meal_source, healthkit_uuid')
          .eq('user_id', session.user.id)
          .in('logged_date', Object.keys(dayForDate));
        if (!data || data.length === 0) return;

        const logged: Record<DayKey, Set<number>> = {};
        const healthkitIds: Record<DayKey, Record<number, string>> = {};
        const extras: Record<DayKey, ExtraMeal[]> = {};

        for (const row of data) {
          if (row.kind === 'plan' && row.plan_day && row.plan_meal_index != null) {
            const day = row.plan_day as DayKey;
            (logged[day] ??= new Set()).add(row.plan_meal_index);
            if (row.healthkit_uuid) (healthkitIds[day] ??= {})[row.plan_meal_index] = row.healthkit_uuid;
          } else if (row.kind === 'extra') {
            const day = dayForDate[row.logged_date];
            if (!day) continue;
            (extras[day] ??= []).push({
              id: row.id,
              healthkitUuid: row.healthkit_uuid ?? undefined,
              name: row.name,
              calories: row.calories,
              protein_g: row.protein_g,
              carbs_g: row.carbs_g,
              fat_g: row.fat_g,
              fiber_g: row.fiber_g ?? undefined,
              source: row.meal_source,
            });
          }
        }

        if (Object.keys(logged).length > 0) {
          setLoggedMeals(logged);
          setLoggedMealHealthkitIds(healthkitIds);
        }
        if (Object.keys(extras).length > 0) setExtraMeals(extras);
      } catch { /* offline — falls back to empty local state */ }
    })();
  }, []);

  // Best-effort cleanup of persisted plan-meal-toggle rows when the plan itself is
  // regenerated (meal indices no longer mean the same thing) — mirrors the local
  // setLoggedMeals({}) resets in load() below. Never touches HealthKit: those are
  // real eaten-calorie records independent of which plan the app is recommending.
  const clearPersistedPlanLogsForWeek = useCallback(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.from('logged_meals').delete()
          .eq('user_id', session.user.id)
          .eq('kind', 'plan')
          .in('logged_date', WEEKDAY_ORDER.map(dateKeyForDay));
      } catch { /* best effort */ }
    })();
  }, []);

  const load = useCallback(async (forceRegenerate = false, regenOpts?: RegenerateOptions) => {
    if (didInitialLoad.current && !forceRegenerate) return;
    didInitialLoad.current = true;

    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const weekKey = getWeekKey();

      // Free tier: Day-1 teaser only (Haiku) — never spend a Sonnet week on a non-payer.
      // The full plan generates automatically once isPremium flips true (see effect below).
      // Cached under a namespaced key (distinct from the full-plan weekKey row) so
      // reopening the app doesn't fire a fresh Haiku call every time.
      if (!isPremiumRef.current) {
        const teaserKey = `${weekKey}-teaser-${TODAY}`;

        if (!forceRegenerate) {
          const cachedTeaser = await fetchWeeklyPlan(teaserKey);
          if (cachedTeaser) {
            setPlan(cachedTeaser);
            setPlanExistsInDB(false);
            setLoggedMeals({});
            setLoggedMealHealthkitIds({});
            clearPersistedPlanLogsForWeek();
            setLockedMeals({});
            setMealOverrides({});
            return;
          }
        }

        const p = profileRef.current;
        const teaser = await generateMenuTeaser({
          targetCalories: p.daily_calories,
          preferences: p.preferences || undefined,
          dietaryRestrictions: p.dietary_restrictions || undefined,
          teaserDay: TODAY,
          userId,
        });
        setPlan(teaser);
        setPlanExistsInDB(false);
        setLoggedMeals({});
        setLoggedMealHealthkitIds({});
        clearPersistedPlanLogsForWeek();
        setLockedMeals({});
        setMealOverrides({});
        return;
      }

      if (!forceRegenerate) {
        const cached = await fetchWeeklyPlan(weekKey);
        if (cached) {
          setPlanExistsInDB(true);
          setPlan(cached);
          prefetchNextWeek(userId).catch(() => {});
          return;
        }
      } else if (userId) {
        await clearWeeklyPlan(userId).catch(() => {});
      }

      setPlanExistsInDB(false);

      const rawPantry = await AsyncStorage.getItem('lydo_pantry').catch(() => null);
      const pantryItems: string[] = rawPantry ? JSON.parse(rawPantry) : [];

      const rawAppliances = await AsyncStorage.getItem('lydo_kitchen_appliances').catch(() => null);
      const applianceCounts: Record<string, number> = rawAppliances ? JSON.parse(rawAppliances) : {};
      const kitchenAppliances = Object.entries(applianceCounts)
        .filter(([, count]) => count > 0)
        .map(([name]) => name);

      const p = profileRef.current;
      const ratingsSummary = buildRatingsSummary(planRef.current, mealRatingsRef.current, mealOverridesRef.current);

      let selectedRecipes: Awaited<ReturnType<typeof fetchUserRecipes>> = [];
      if (regenOpts?.selectedRecipeIds?.length) {
        const saved = await fetchUserRecipes().catch(() => []);
        const idSet = new Set(regenOpts.selectedRecipeIds);
        selectedRecipes = saved.filter(r => idSet.has(r.id));
      }

      const fresh = await generateMenuPlan({
        days: 7,
        mealsPerDay: 3,
        targetCalories: p.daily_calories,
        preferences: p.preferences || undefined,
        dietaryRestrictions: p.dietary_restrictions || undefined,
        userId,
        weeklyBudget: p.weekly_budget_eur,
        pantryItems,
        kitchenAppliances,
        mealRatingsSummary: ratingsSummary,
        includedRecipes: regenOpts?.includedRecipes,
        selectedRecipes,
        generalNotes: regenOpts?.generalNotes,
      });
      setPlan(fresh);
      setPlanExistsInDB(true);
      setLoggedMeals({});
      setLoggedMealHealthkitIds({});
      clearPersistedPlanLogsForWeek();
      setLockedMeals({});
      setMealOverrides({});
      fresh.days.forEach(day =>
        day.meals.forEach(meal =>
          saveUserRecipe(meal, userId).catch(() => {})
        )
      );
      prefetchNextWeek(userId).catch(() => {});
    } catch (err) {
      didInitialLoad.current = false;
      const raw = (err as Error).message ?? '';
      if (raw.includes('credit') || raw.includes('billing') || raw.includes('balance')) {
        setError('__credits__');
      } else if (raw.startsWith('{') || raw.startsWith('4') || raw.startsWith('5')) {
        setError('__server__');
      } else {
        setError(raw);
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // stable — reads via refs

  async function prefetchNextWeek(userId?: string) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    if (dayOfWeek < 3) return;

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (8 - (today.getDay() || 7)));
    const nextWeekKey = getWeekKey(nextMonday);

    const existing = await fetchWeeklyPlan(nextWeekKey);
    if (existing) return;

    const rawPantry = await AsyncStorage.getItem('lydo_pantry').catch(() => null);
    const pantryItems: string[] = rawPantry ? JSON.parse(rawPantry) : [];

    const rawAppliances = await AsyncStorage.getItem('lydo_kitchen_appliances').catch(() => null);
    const applianceCounts: Record<string, number> = rawAppliances ? JSON.parse(rawAppliances) : {};
    const kitchenAppliances = Object.entries(applianceCounts)
      .filter(([, count]) => count > 0)
      .map(([name]) => name);

    const p = profileRef.current;
    const ratingsSummary = buildRatingsSummary(planRef.current, mealRatingsRef.current, mealOverridesRef.current);

    await generateMenuPlan({
      days: 7, mealsPerDay: 3,
      targetCalories: p.daily_calories,
      preferences: p.preferences || undefined,
      dietaryRestrictions: p.dietary_restrictions || undefined,
      userId,
      weeklyBudget: p.weekly_budget_eur,
      pantryItems,
      kitchenAppliances,
      mealRatingsSummary: ratingsSummary,
    });
    console.log(`Next week plan pre-generated: ${nextWeekKey}`);
  }

  // Wait for RevenueCat's entitlement check to resolve before deciding teaser vs. full plan —
  // otherwise a premium user on cold start could briefly get gated to the free teaser path.
  useEffect(() => { if (purchasesReady) load(); }, [load, purchasesReady]);

  // Upgrade from teaser to the full Sonnet week the moment entitlement flips on —
  // covers purchase, restore, and Customer Center changes from any screen, not just the paywall.
  const prevPremiumRef = useRef(isPremium);
  useEffect(() => {
    if (isPremium && !prevPremiumRef.current && didInitialLoad.current) {
      load(true);
    }
    prevPremiumRef.current = isPremium;
  }, [isPremium, load]);

  // ── Logging ────────────────────────────────────────────────────────────────

  const logMeal = useCallback((day: DayKey, idx: number) => {
    let wasLogged = false;
    setLoggedMeals(prev => {
      const s = new Set(prev[day] ?? []);
      wasLogged = s.has(idx);
      wasLogged ? s.delete(idx) : s.add(idx);
      return { ...prev, [day]: new Set(s) };
    });

    const loggedDate = dateKeyForDay(day);

    if (!wasLogged) {
      // newly logged -> write to Apple Health + persist a row so it survives restarts
      const meal = planRef.current?.days.find(d => d.day === day)?.meals[idx];
      if (!meal) return;
      const overrides = mealOverridesRef.current[day]?.[idx];
      const name = overrides?.name ?? meal.name;
      const calories = overrides?.calories ?? meal.calories;
      const protein_g = overrides?.protein_g ?? meal.protein_g;
      const carbs_g = overrides?.carbs_g ?? meal.carbs_g;
      const fat_g = overrides?.fat_g ?? meal.fat_g;
      const fiber_g = overrides?.fiber_g ?? meal.fiber_g;

      (async () => {
        const healthkitUuid = await writeDietaryEnergy(calories, new Date());
        if (healthkitUuid) {
          setLoggedMealHealthkitIds(prev => ({ ...prev, [day]: { ...prev[day], [idx]: healthkitUuid } }));
        }
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await supabase.from('logged_meals').upsert(
            {
              user_id: session.user.id, logged_date: loggedDate, kind: 'plan',
              plan_day: day, plan_meal_index: idx,
              name, calories, protein_g, carbs_g, fat_g, fiber_g: fiber_g ?? null,
              meal_source: 'plan', healthkit_uuid: healthkitUuid,
            },
            { onConflict: 'user_id,logged_date,plan_day,plan_meal_index' },
          );
        } catch { /* local toggle still stands, will retry to persist next hydrate */ }
      })();
    } else {
      // unlogged -> delete the persisted row + its Apple Health sample
      const healthkitUuid = loggedMealHealthkitIdsRef.current[day]?.[idx];
      setLoggedMealHealthkitIds(prev => {
        const dayIds = { ...prev[day] };
        delete dayIds[idx];
        return { ...prev, [day]: dayIds };
      });
      if (healthkitUuid) deleteDietaryEnergySample(healthkitUuid).catch(() => {});
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await supabase.from('logged_meals').delete()
            .eq('user_id', session.user.id).eq('kind', 'plan')
            .eq('logged_date', loggedDate).eq('plan_day', day).eq('plan_meal_index', idx);
        } catch { /* best effort */ }
      })();
    }
  }, []);

  const getEatenCalories = useCallback((day: DayKey): number => {
    const dayPlan = plan?.days.find(d => d.day === day);
    const logged = loggedMeals[day] ?? new Set<number>();
    const overrides = mealOverrides[day] ?? {};
    const planCals = (dayPlan?.meals ?? []).reduce((sum, meal, i) => {
      if (!logged.has(i)) return sum;
      return sum + (overrides[i]?.calories ?? meal.calories);
    }, 0);
    const extraCals = (extraMeals[day] ?? []).reduce((sum, m) => sum + m.calories, 0);
    return planCals + extraCals;
  }, [plan, loggedMeals, mealOverrides, extraMeals]);

  const getEatenMacros = useCallback((day: DayKey) => {
    const dayPlan = plan?.days.find(d => d.day === day);
    const logged = loggedMeals[day] ?? new Set<number>();
    const overrides = mealOverrides[day] ?? {};
    const planMacros = (dayPlan?.meals ?? []).reduce((acc, meal, i) => {
      if (!logged.has(i)) return acc;
      const m = { ...meal, ...overrides[i] };
      return {
        protein_g: acc.protein_g + m.protein_g,
        carbs_g: acc.carbs_g + m.carbs_g,
        fat_g: acc.fat_g + m.fat_g,
        fiber_g: acc.fiber_g + (m.fiber_g ?? 0),
      };
    }, { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
    return (extraMeals[day] ?? []).reduce((acc, m) => ({
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
      fiber_g: acc.fiber_g + (m.fiber_g ?? 0),
    }), planMacros);
  }, [plan, loggedMeals, mealOverrides, extraMeals]);

  // ── Ratings & Descriptions ─────────────────────────────────────────────────

  const rateMeal = useCallback((day: DayKey, idx: number, rating: number) => {
    const weekKey = getWeekKey();
    setMealRatings(prev => {
      const updated = { ...prev, [day]: { ...prev[day], [idx]: rating } };
      AsyncStorage.setItem(RATINGS_KEY(weekKey), JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    // Persist to Supabase (include current description so it isn't cleared)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const mealName = getMealName(planRef.current, mealOverridesRef.current, day, idx);
      const description = mealDescriptionsRef.current[day]?.[idx] ?? '';
      upsertRatingToSupabase(session.user.id, weekKey, day, idx, mealName, rating, description);
    });
  }, []);

  const describeMeal = useCallback((day: DayKey, idx: number, description: string) => {
    const weekKey = getWeekKey();
    setMealDescriptions(prev => {
      const updated = { ...prev, [day]: { ...prev[day], [idx]: description } };
      AsyncStorage.setItem(DESCRIPTIONS_KEY(weekKey), JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    // Persist to Supabase (include current rating so it isn't cleared)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const mealName = getMealName(planRef.current, mealOverridesRef.current, day, idx);
      const rating = mealRatingsRef.current[day]?.[idx] ?? null;
      upsertRatingToSupabase(session.user.id, weekKey, day, idx, mealName, rating, description);
    });
  }, []);

  // ── Extra meals ────────────────────────────────────────────────────────────

  const addExtraMeal = useCallback((day: DayKey, meal: Omit<ExtraMeal, 'id' | 'healthkitUuid'>) => {
    const tempId = `${Date.now()}-${Math.random()}`;
    const entry: ExtraMeal = { ...meal, id: tempId };
    setExtraMeals(prev => ({ ...prev, [day]: [...(prev[day] ?? []), entry] }));

    (async () => {
      const healthkitUuid = await writeDietaryEnergy(meal.calories, new Date());
      let realId = tempId;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data } = await supabase.from('logged_meals').insert({
            user_id: session.user.id, logged_date: dateKeyForDay(day), kind: 'extra',
            name: meal.name, calories: meal.calories, protein_g: meal.protein_g,
            carbs_g: meal.carbs_g, fat_g: meal.fat_g, fiber_g: meal.fiber_g ?? null,
            meal_source: meal.source, healthkit_uuid: healthkitUuid,
          }).select('id').single();
          if (data) realId = data.id;
        }
      } catch { /* local entry still stands, just won't persist across restarts */ }
      setExtraMeals(prev => ({
        ...prev,
        [day]: (prev[day] ?? []).map(m => (m.id === tempId ? { ...m, id: realId, healthkitUuid: healthkitUuid ?? undefined } : m)),
      }));
    })();
  }, []);

  const editExtraMeal = useCallback((day: DayKey, id: string, meal: Omit<ExtraMeal, 'id' | 'healthkitUuid'>) => {
    const prevEntry = (extraMealsRef.current[day] ?? []).find(m => m.id === id);
    setExtraMeals(prev => ({
      ...prev,
      [day]: (prev[day] ?? []).map(m => (m.id === id ? { ...meal, id, healthkitUuid: m.healthkitUuid } : m)),
    }));

    (async () => {
      const newHealthkitUuid = await writeDietaryEnergy(meal.calories, new Date());
      if (prevEntry?.healthkitUuid) deleteDietaryEnergySample(prevEntry.healthkitUuid).catch(() => {});
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('logged_meals').update({
            name: meal.name, calories: meal.calories, protein_g: meal.protein_g,
            carbs_g: meal.carbs_g, fat_g: meal.fat_g, fiber_g: meal.fiber_g ?? null,
            meal_source: meal.source, healthkit_uuid: newHealthkitUuid,
          }).eq('id', id).eq('user_id', session.user.id);
        }
      } catch { /* best effort */ }
      if (newHealthkitUuid) {
        setExtraMeals(prev => ({
          ...prev,
          [day]: (prev[day] ?? []).map(m => (m.id === id ? { ...m, healthkitUuid: newHealthkitUuid } : m)),
        }));
      }
    })();
  }, []);

  const removeExtraMeal = useCallback((day: DayKey, id: string) => {
    const prevEntry = (extraMealsRef.current[day] ?? []).find(m => m.id === id);
    setExtraMeals(prev => ({ ...prev, [day]: (prev[day] ?? []).filter(m => m.id !== id) }));

    if (prevEntry?.healthkitUuid) deleteDietaryEnergySample(prevEntry.healthkitUuid).catch(() => {});
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.from('logged_meals').delete().eq('id', id).eq('user_id', session.user.id);
      } catch { /* best effort */ }
    })();
  }, []);

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
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
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
      .upsert({ week_key: weekKey, user_id: userId, plan_text: JSON.stringify({ days: effectiveDays }), created_at: new Date().toISOString() });
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
      steps: recipe.steps ?? [],
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
    const fiber_g = meals.reduce((s, m) => s + (m.fiber_g ?? 0), 0);
    return { ...base, meals, total_calories, protein_g, carbs_g, fat_g, fiber_g };
  }, [plan, mealOverrides]);

  return (
    <MenuContext.Provider value={{
      plan, isLoading, error, planExistsInDB, refresh: (opts) => load(true, opts),
      loggedMeals, logMeal, getEatenCalories, getEatenMacros,
      mealRatings, mealDescriptions, rateMeal, describeMeal,
      lockedMeals, lockMeal,
      editMealName,
      swappingMeal, swapMeal,
      addTiktokMeal,
      applyMealOverride,
      extraMeals, addExtraMeal, editExtraMeal, removeExtraMeal,
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
