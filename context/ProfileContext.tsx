import { supabase } from '@/lib/supabase';
import { getAverageDailySteps, requestHealthPermissions } from '@/lib/health';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/*
  Supabase table (run once in SQL editor):

  create table if not exists public.user_profiles (
    id uuid primary key default gen_random_uuid(),
    user_id text unique not null,
    name text default '',
    age integer,
    height_cm numeric(5,1),
    weight_kg numeric(5,1),
    goal text default 'maintain',
    activity_level text default 'moderate',
    daily_calories integer default 2000,
    weekly_budget_eur numeric(8,2) default 80,
    preferences text default '',
    dietary_restrictions text default '',
    updated_at timestamptz default now()
  );
  -- household-size scaling (dano Pro feature):
  -- alter table public.user_profiles add column household_size integer default 1;
  alter table public.user_profiles enable row level security;
  create policy "manage own profile" on public.user_profiles
    for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
*/

export interface UserProfile {
  name: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: 'lose' | 'maintain' | 'gain';
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  daily_calories: number;
  weekly_budget_eur: number;
  preferences: string;
  dietary_restrictions: string;
  // TODO: add column to supabase: alter table public.user_profiles add column kitchen_equipment text default '';
  kitchen_equipment: string;
  // Number of people to scale shopping-list ingredient quantities for (dano Pro only).
  household_size: number;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: null,
  height_cm: null,
  weight_kg: null,
  goal: 'maintain',
  activity_level: 'moderate',
  daily_calories: 2000,
  weekly_budget_eur: 80,
  preferences: '',
  dietary_restrictions: '',
  kitchen_equipment: '',
  household_size: 1,
};

interface ProfileContextValue {
  profile: UserProfile;
  saving: boolean;
  saveProfile: (p: UserProfile) => Promise<void>;
  // Step-derived activity level from Apple Health, offered as a suggestion the user
  // must explicitly accept — never applied automatically. null until resolved, or if
  // HealthKit is unavailable/unauthorized/this platform isn't iOS.
  suggestedActivityLevel: UserProfile['activity_level'] | null;
  suggestedAvgSteps: number | null;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: DEFAULT_PROFILE,
  saving: false,
  saveProfile: async () => {},
  suggestedActivityLevel: null,
  suggestedAvgSteps: null,
});

// Trailing-14-day average steps/day -> activity level band. Thresholds are a
// starting point, not clinically derived — tune post-launch if needed.
function activityLevelFromSteps(avgSteps: number): UserProfile['activity_level'] {
  if (avgSteps < 5000) return 'sedentary';
  if (avgSteps < 7500) return 'light';
  if (avgSteps < 10000) return 'moderate';
  if (avgSteps < 12500) return 'active';
  return 'very_active';
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [suggestedActivityLevel, setSuggestedActivityLevel] = useState<UserProfile['activity_level'] | null>(null);
  const [suggestedAvgSteps, setSuggestedAvgSteps] = useState<number | null>(null);

  // Ask for HealthKit permission once on mount; if granted, derive a suggested
  // activity level from recent steps. Never touches `profile`/`daily_calories`
  // directly — see the accept action in the Profile screen.
  useEffect(() => {
    (async () => {
      const granted = await requestHealthPermissions();
      if (!granted) return;
      const avgSteps = await getAverageDailySteps(14);
      if (avgSteps == null) return;
      setSuggestedAvgSteps(avgSteps);
      setSuggestedActivityLevel(activityLevelFromSteps(avgSteps));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const userId = await getUserId();
        if (!userId) return;
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (data) {
          setProfile({
            name: data.name ?? '',
            age: data.age ?? null,
            height_cm: data.height_cm ?? null,
            weight_kg: data.weight_kg ?? null,
            goal: data.goal ?? 'maintain',
            activity_level: data.activity_level ?? 'moderate',
            daily_calories: data.daily_calories ?? 2000,
            weekly_budget_eur: data.weekly_budget_eur ?? 80,
            preferences: data.preferences ?? '',
            dietary_restrictions: data.dietary_restrictions ?? '',
            kitchen_equipment: data.kitchen_equipment ?? '',
            household_size: data.household_size ?? 1,
          });
        }
      } catch { /* table may not exist yet */ }
    })();
  }, []);

  const saveProfile = useCallback(async (p: UserProfile) => {
    setProfile(p);
    setSaving(true);
    try {
      const userId = await getUserId();
      if (!userId) return;
      await supabase.from('user_profiles').upsert({
        user_id: userId,
        ...p,
        updated_at: new Date().toISOString(),
      });
    } catch { /* silently fail */ } finally {
      setSaving(false);
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, saving, saveProfile, suggestedActivityLevel, suggestedAvgSteps }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
