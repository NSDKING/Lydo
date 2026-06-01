import { API_URL } from '@/constants/config';
import { supabase } from '@/lib/supabase';

export interface Meal {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  steps?: string[];
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
    const { data } = await supabase
      .from('weekly_plans')
      .select('plan_text')
      .eq('week_key', weekKey)
      .maybeSingle();
    if (!data?.plan_text) return null;
    return JSON.parse(data.plan_text) as MenuPlan;
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
  userId?: string;
}): Promise<MenuPlan> {
  const data = await post<{ plan: MenuPlan }>('/menu/generate', {
    days: params?.days ?? 7,
    mealsPerDay: params?.mealsPerDay ?? 3,
    targetCalories: params?.targetCalories ?? 2000,
    preferences: params?.preferences ?? '',
    dietaryRestrictions: params?.dietaryRestrictions ?? '',
    userId: params?.userId,
  });
  return data.plan;
}

export async function fetchMealSteps(mealName: string, ingredients: string[]): Promise<string[]> {
  const data = await post<{ steps: string[] }>('/meal/steps', { mealName, ingredients }, 30_000);
  return data.steps;
}

export async function swapMeal(dayPlan: DayPlan, mealIndex: number, preferences?: string): Promise<Meal> {
  const data = await post<{ meal: Meal }>('/menu/swap', { dayPlan, mealIndex, preferences }, 60_000);
  return data.meal;
}

// ─── TikTok ───────────────────────────────────────────────────────────────────

export async function analyzeTiktok(url: string): Promise<TiktokRecipe> {
  const data = await post<{ recipe: TiktokRecipe }>('/tiktok/analyze', { tiktokUrl: url }, 120_000);
  return data.recipe;
}

export async function fetchLidlCatalog(): Promise<LidlPromoDetail[]> {
  const { data } = await supabase
    .from('lidl_promos')
    .select('title, price, old_price, discount_percent, image_url')
    .eq('available', true)
    .order('discount_percent', { ascending: false, nullsFirst: false })
    .limit(1000);

  const rows = (data as LidlPromoDetail[] | null) ?? [];

  // Deduplicate by title — keep the row with the most data (prefers discounted/imaged rows)
  const seen = new Map<string, LidlPromoDetail>();
  for (const row of rows) {
    const key = row.title.toLowerCase();
    const existing = seen.get(key);
    if (!existing) { seen.set(key, row); continue; }
    // Prefer: has discount_percent > has image_url > any
    const score = (r: LidlPromoDetail) => (r.discount_percent ? 2 : 0) + (r.image_url ? 1 : 0);
    if (score(row) > score(existing)) seen.set(key, row);
  }

  return [...seen.values()];
}

export async function adaptRecipeWithLidl(
  title: string,
  ingredients: string[]
): Promise<{ adaptedIngredients: AdaptedIngredient[] }> {
  return post('/recipe/adapt', { title, ingredients }, 60_000);
}

export async function scanFoodWithAI(imageBase64: string): Promise<{
  name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; notes?: string;
}> {
  return post('/food/scan', { imageBase64 }, 30_000);
}

// ─── User Recipes (Supabase direct) ──────────────────────────────────────────

export interface UserRecipe {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  lidl_products_used: string[];
  created_at: string;
}

export async function fetchUserRecipes(): Promise<UserRecipe[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from('user_recipes')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });
  return (data as UserRecipe[] | null) ?? [];
}

export async function saveUserRecipe(
  recipe: Pick<Meal, 'name' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'ingredients' | 'lidl_products_used'>,
  userId?: string,
): Promise<string> {
  const uid = userId ?? (await supabase.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('user_recipes')
    .insert({
      user_id: uid,
      name: recipe.name,
      calories: recipe.calories,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
      ingredients: recipe.ingredients,
      lidl_products_used: recipe.lidl_products_used,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function deleteUserRecipe(id: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('user_recipes').delete().eq('id', id).eq('user_id', session.user.id);
}
