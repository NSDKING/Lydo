import { API_URL } from '@/constants/config';

export interface Meal {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  lidl_products_used: string[];
}

export interface DayPlan {
  day: string;
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: Meal[];
}

export interface MenuPlan {
  days: DayPlan[];
}

export interface TiktokRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  macros: { protein_g: number; carbs_g: number; fat_g: number; calories: number };
  prep_time: string;
  difficulty: string;
}

export interface AdaptedIngredient {
  original: string;
  lidlProduct: string | null;
  note: string;
}

export interface LidlPromoDetail {
  title: string;
  price: string;
  old_price?: string;
  discount_percent?: number;
  image_url?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function post<T>(path: string, body: unknown, timeoutMs = 180_000): Promise<T> {
  const { signal, clear } = timeout(timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clear();
  }
}

async function get<T>(path: string, timeoutMs = 15_000): Promise<T> {
  const { signal, clear } = timeout(timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  } finally {
    clear();
  }
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export function getWeekKey(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function fetchWeeklyPlan(weekKey: string): Promise<MenuPlan | null> {
  try {
    const data = await get<{ plan: MenuPlan }>(`/menu/week/${weekKey}`, 10_000);
    return data.plan ?? null;
  } catch {
    return null;
  }
}

export async function generateMenuPlan(params?: {
  preferences?: string;
  dietaryRestrictions?: string;
  targetCalories?: number;
  days?: number;
  mealsPerDay?: number;
}): Promise<MenuPlan> {
  const data = await post<{ plan: MenuPlan }>('/menu/generate', {
    days: params?.days ?? 7,
    mealsPerDay: params?.mealsPerDay ?? 3,
    targetCalories: params?.targetCalories ?? 2000,
    preferences: params?.preferences ?? '',
    dietaryRestrictions: params?.dietaryRestrictions ?? '',
  });
  return data.plan;
}

export async function swapMeal(dayPlan: DayPlan, mealIndex: number): Promise<Meal> {
  const data = await post<{ meal: Meal }>('/menu/swap', { dayPlan, mealIndex }, 60_000);
  return data.meal;
}

// ─── TikTok ───────────────────────────────────────────────────────────────────

export async function analyzeTiktok(url: string): Promise<TiktokRecipe> {
  const data = await post<{ recipe: TiktokRecipe }>('/tiktok/analyze', { tiktokUrl: url }, 120_000);
  return data.recipe;
}

export async function fetchLidlCatalog(): Promise<LidlPromoDetail[]> {
  try {
    const data = await get<{ products: LidlPromoDetail[] }>('/lidl/catalog', 10_000);
    return data.products ?? [];
  } catch {
    return [];
  }
}

export async function adaptRecipeWithLidl(
  title: string,
  ingredients: string[]
): Promise<{ adaptedIngredients: AdaptedIngredient[] }> {
  return post('/recipe/adapt', { title, ingredients }, 60_000);
}
