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

interface GenerateParams {
  preferences?: string;
  dietaryRestrictions?: string;
  targetCalories?: number;
  days?: number;
  mealsPerDay?: number;
}

export async function generateMenuPlan(params?: GenerateParams): Promise<MenuPlan> {
  const response = await fetch(`${API_URL}/menu/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify({
      days: params?.days ?? 7,
      mealsPerDay: params?.mealsPerDay ?? 3,
      targetCalories: params?.targetCalories ?? 2000,
      preferences: params?.preferences ?? '',
      dietaryRestrictions: params?.dietaryRestrictions ?? '',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data as any).plan as MenuPlan;
}
