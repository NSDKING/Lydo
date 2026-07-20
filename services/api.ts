import { API_URL } from '@/constants/config';
import { supabase } from '@/lib/supabase';

export interface Meal {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
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
  fiber_g?: number;
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
      .from('weekly_plans')
      .select('plan_text')
      .eq('week_key', weekKey)
      .eq('user_id', session.user.id)
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
  weeklyBudget?: number;
  pantryItems?: string[];
  kitchenAppliances?: string[];
  mealRatingsSummary?: string;
}): Promise<MenuPlan> {
  const data = await post<{ plan: MenuPlan }>('/menu/generate', {
    days: params?.days ?? 7,
    mealsPerDay: params?.mealsPerDay ?? 3,
    targetCalories: params?.targetCalories ?? 2000,
    preferences: params?.preferences ?? '',
    dietaryRestrictions: params?.dietaryRestrictions ?? '',
    userId: params?.userId,
    weeklyBudget: params?.weeklyBudget,
    pantryItems: params?.pantryItems ?? [],
    kitchenAppliances: params?.kitchenAppliances ?? [],
    mealRatingsSummary: params?.mealRatingsSummary ?? '',
  });
  return data.plan;
}

export async function generateMenuTeaser(params?: {
  preferences?: string;
  dietaryRestrictions?: string;
  targetCalories?: number;
  mealsPerDay?: number;
  teaserDay?: string;
  userId?: string;
}): Promise<MenuPlan> {
  const data = await post<{ plan: MenuPlan }>('/menu/teaser', {
    mealsPerDay: params?.mealsPerDay ?? 3,
    targetCalories: params?.targetCalories ?? 2000,
    preferences: params?.preferences ?? '',
    dietaryRestrictions: params?.dietaryRestrictions ?? '',
    teaserDay: params?.teaserDay,
    userId: params?.userId,
  }, 60_000);
  return data.plan;
}

export async function clearWeeklyPlan(userId: string): Promise<void> {
  await post('/menu/clear', { userId }, 10_000);
}

// Permanently deletes the user's Supabase Auth identity and every row they own
// (profile, plans, ratings, recipes, grocery state, usage counters). Irreversible.
export async function deleteAccount(userId: string): Promise<void> {
  await post('/account/delete', { userId }, 15_000);
}

export async function fetchMealSteps(mealName: string, ingredients: string[], lang = 'en'): Promise<string[]> {
  const data = await post<{ steps: string[] }>('/meal/steps', { mealName, ingredients, lang }, 30_000);
  return data.steps;
}

export async function swapMeal(dayPlan: DayPlan, mealIndex: number, preferences?: string): Promise<Meal> {
  const { data: { session } } = await supabase.auth.getSession();
  const data = await post<{ meal: Meal }>('/menu/swap', { dayPlan, mealIndex, preferences, userId: session?.user?.id }, 60_000);
  return data.meal;
}

// ─── TikTok ───────────────────────────────────────────────────────────────────

// Fetch TikTok page metadata on the device (not the backend) to avoid cloud IP blocks.
async function fetchTiktokMeta(url: string): Promise<{ title: string; description: string }> {
  const MOBILE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  // 1. Try oEmbed first — officially supported, most reliable
  try {
    const oembedRes = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': MOBILE_UA } },
    );
    if (oembedRes.ok) {
      const j = await oembedRes.json() as { title?: string };
      if (j.title && j.title.length > 10) {
        return { title: j.title, description: j.title };
      }
    }
  } catch { /* fall through */ }

  // 2. Fall back to raw HTML og: tags
  const htmlRes = await fetch(url, {
    headers: { 'User-Agent': MOBILE_UA, 'Accept': 'text/html' },
  });
  if (!htmlRes.ok) throw new Error(`Could not fetch TikTok page (HTTP ${htmlRes.status})`);
  const html = await htmlRes.text();

  const ogTag = (prop: string): string => {
    const m =
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : '';
  };

  const title = ogTag('og:title') || ogTag('twitter:title') || 'TikTok Recipe';
  const description = ogTag('og:description') || ogTag('twitter:description') || title;
  return { title, description };
}

export async function analyzeTiktok(url: string): Promise<TiktokRecipe> {
  // Fetch metadata on device (bypasses Railway IP block), then send text to backend for Claude extraction
  const { title, description } = await fetchTiktokMeta(url);
  const data = await post<{ recipe: TiktokRecipe }>('/tiktok/analyze', { title, description }, 60_000);
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
  fiber_g?: number | null;
  weight_g?: number | null;
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
  recipe: Pick<Meal, 'name' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'ingredients' | 'lidl_products_used'> & { weight_g?: number | null },
  userId?: string,
): Promise<string> {
  const uid = userId ?? (await supabase.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error('Not authenticated');
  const payload: Record<string, unknown> = {
    user_id: uid,
    name: recipe.name,
    calories: recipe.calories,
    protein_g: recipe.protein_g,
    carbs_g: recipe.carbs_g,
    fat_g: recipe.fat_g,
    ingredients: recipe.ingredients,
    lidl_products_used: recipe.lidl_products_used,
  };
  if (recipe.weight_g != null) payload.weight_g = recipe.weight_g;
  const { data, error } = await supabase
    .from('user_recipes')
    .insert(payload)
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
