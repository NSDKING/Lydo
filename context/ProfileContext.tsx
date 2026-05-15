import { supabase } from '@/lib/supabase';
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
};

interface ProfileContextValue {
  profile: UserProfile;
  saving: boolean;
  saveProfile: (p: UserProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: DEFAULT_PROFILE,
  saving: false,
  saveProfile: async () => {},
});

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);

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
    <ProfileContext.Provider value={{ profile, saving, saveProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
