import { UserProfile } from '@/context/ProfileContext';

// Single source of truth for BMR/TDEE math — previously duplicated (and
// slightly inconsistent) between app/onboarding.tsx and app/(tabs)/progress.tsx.

export const ACTIVITY_MULTIPLIERS: Record<UserProfile['activity_level'], number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

// Mifflin-St Jeor, gender-neutral midpoint (no sex field in UserProfile).
export function calcBMR(p: UserProfile): number | null {
  if (!p.weight_kg || !p.height_cm || !p.age) return null;
  return 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age - 78;
}

export function calcTDEE(p: UserProfile): number {
  const bmr = calcBMR(p);
  if (bmr == null) return 2000;
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[p.activity_level] ?? 1.55));
}

// deficitKcal only applies to goal 'lose' (defaults to the standard 500 kcal/day
// deficit); 'gain' always uses a fixed +300 surplus, 'maintain' uses tdee as-is.
export function calcRecommendedCalories(p: UserProfile, deficitKcal = 500): number {
  const tdee = calcTDEE(p);
  const delta = p.goal === 'gain' ? 300 : p.goal === 'lose' ? -deficitKcal : 0;
  return Math.round(tdee + delta);
}
