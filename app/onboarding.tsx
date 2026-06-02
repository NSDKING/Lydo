import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PROFILE, UserProfile } from '@/context/ProfileContext';
import { Colors } from '@/constants/theme';

const HEALTH_PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Height,
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.StepCount,
    ],
    write: [],
  },
};

const C = Colors.dark;

type StepId = 'welcome' | 'auth' | 'personal' | 'body' | 'goal' | 'deficit' | 'activity' | 'nutrition' | 'budget' | 'done';
const STEPS: StepId[] = ['welcome', 'auth', 'personal', 'body', 'goal', 'deficit', 'activity', 'nutrition', 'budget', 'done'];
const TOTAL_PROGRESS = STEPS.length - 2; // 8: auth → budget

function calcTDEE(p: UserProfile): number {
  if (!p.weight_kg || !p.height_cm || !p.age) return 2000;
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + 5;
  const mult = ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as Record<string, number>)[p.activity_level] ?? 1.55;
  return Math.round(bmr * mult);
}

function calcRecommended(p: UserProfile, deficitKcal: number): number {
  const tdee = calcTDEE(p);
  const delta = p.goal === 'gain' ? 300 : p.goal === 'lose' ? -deficitKcal : 0;
  return tdee + delta;
}

export default function Onboarding() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(DEFAULT_PROFILE);
  const [deficitKcal, setDeficitKcal] = useState(500);
  const [customDeficit, setCustomDeficit] = useState('');
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');

  const step = STEPS[idx];
  const isProgressStep = step !== 'welcome' && step !== 'done';
  const progressIdx = idx - 1; // auth=0, personal=1, ..., budget=6
  const progressPct = isProgressStep ? progressIdx / TOTAL_PROGRESS : step === 'done' ? 1 : 0;

  const upd = (f: Partial<UserProfile>) => setDraft(p => ({ ...p, ...f }));

  const importFromHealth = () => {
    if (Platform.OS !== 'ios') return;
    setHealthLoading(true);
    setHealthError('');
    try {
      AppleHealthKit.initHealthKit(HEALTH_PERMISSIONS, (err) => {
        if (err) {
          setHealthLoading(false);
          setHealthError('Could not access Apple Health. Allow access in Settings → Health → Lydo.');
          return;
        }

        // Height: HealthKit returns inches — convert to cm
        AppleHealthKit.getLatestHeight({}, (_hErr, height) => {
          if (!_hErr && height?.value) upd({ height_cm: Math.round(height.value * 2.54) });
        });

        // Weight: request in kg directly
        AppleHealthKit.getLatestWeight({ unit: 'kilogram' as any }, (_wErr, weight) => {
          if (!_wErr && weight?.value) upd({ weight_kg: parseFloat(weight.value.toFixed(1)) });
        });

        // Estimate activity from average daily steps over last 7 days
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        AppleHealthKit.getDailyStepCountSamples(
          { startDate: weekAgo, endDate: new Date().toISOString() },
          (_sErr, samples) => {
            setHealthLoading(false);
            if (_sErr || !samples?.length) return;
            const avg = samples.reduce((s, r) => s + r.value, 0) / samples.length;
            const level =
              avg < 5000  ? 'sedentary' :
              avg < 7500  ? 'light'     :
              avg < 10000 ? 'moderate'  :
              avg < 12500 ? 'active'    : 'very_active';
            upd({ activity_level: level as UserProfile['activity_level'] });
          },
        );
      });
    } catch {
      setHealthLoading(false);
      setHealthError('Apple Health is not available. Make sure you are using a device build (not Expo Go).');
    }
  };

  const back = () => {
    if (step === 'activity' && draft.goal !== 'lose') {
      setIdx(i => i - 2); // skip past deficit step
      return;
    }
    setIdx(i => i - 1);
  };

  const next = () => {
    if (step === 'goal' && draft.goal !== 'lose') {
      setIdx(i => i + 2); // skip deficit step
      return;
    }
    if (step === 'activity') {
      const rec = calcRecommended(draft, deficitKcal);
      setDraft(p => ({ ...p, daily_calories: rec }));
    }
    setIdx(i => i + 1);
  };

  async function doAppleAuth() {
    setAuthError('');
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token from Apple');

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      const uid = data.session?.user?.id;
      if (uid) {
        // Pre-fill name from Apple on first sign-in (Apple only provides it once)
        const given = credential.fullName?.givenName ?? '';
        const family = credential.fullName?.familyName ?? '';
        const fullName = `${given} ${family}`.trim();
        if (fullName) upd({ name: fullName });

        // If profile already exists, go straight to app
        const { data: prof } = await supabase
          .from('user_profiles').select('user_id').eq('user_id', uid).single();
        if (prof) { router.replace('/(tabs)'); return; }
      }

      next(); // New user — continue to profile setup
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return; // User dismissed the sheet
      setAuthError(e.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function doFinish() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles').upsert({
          ...draft, user_id: user.id, updated_at: new Date().toISOString(),
        });
      }
    } catch { /* silently fail */ } finally {
      setLoading(false);
      router.replace('/(tabs)');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {isProgressStep && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.round(progressPct * 100)}%` as any }]} />
              </View>
              <Text style={s.progressLabel}>{progressIdx + 1}/{TOTAL_PROGRESS}</Text>
            </View>
          )}

          {step === 'welcome' && (
            <View style={s.stepWrap}>
              <Text style={s.bigEmoji}>🥗</Text>
              <Text style={s.heading}>Lydo</Text>
              <Text style={s.sub}>Your AI-powered nutrition companion</Text>
              <Text style={s.body}>
                Get personalized weekly meal plans, track your calories, and shop smart at Lidl.
              </Text>
              <Btn label="Get Started" onPress={() => setIdx(1)} />
            </View>
          )}

          {step === 'auth' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>Welcome</Text>
              <Text style={s.sub}>Sign in to get started</Text>

              {authError ? <Text style={s.error}>{authError}</Text> : null}

              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={14}
                style={s.appleBtn}
                onPress={doAppleAuth}
              />

              {loading && (
                <View style={s.loadingRow}>
                  <ActivityIndicator color={C.lime} />
                </View>
              )}

              <Text style={s.privacyNote}>
                Your Apple ID is used only for authentication. We never see your password.
              </Text>
            </View>
          )}

          {step === 'personal' && (
            <View style={s.stepWrap}>
              <BackBtn onPress={back} />
              <Text style={s.heading}>About You</Text>
              <Text style={s.sub}>Help us personalize your experience</Text>
              <Field label="Name" value={draft.name} onChangeText={v => upd({ name: v })} />
              <Field
                label="Age"
                value={draft.age?.toString() ?? ''}
                onChangeText={v => upd({ age: v ? (parseInt(v) || null) : null })}
                keyboardType="number-pad"
              />
              <Btn label="Continue" onPress={next} />
            </View>
          )}

          {step === 'body' && (
            <View style={s.stepWrap}>
              <BackBtn onPress={back} />
              <Text style={s.heading}>Your Body</Text>
              <Text style={s.sub}>Used to calculate your energy needs</Text>

              {Platform.OS === 'ios' && (
                <>
                  <TouchableOpacity
                    style={[s.healthBtn, healthLoading && { opacity: 0.6 }]}
                    onPress={importFromHealth}
                    disabled={healthLoading}
                  >
                    {healthLoading
                      ? <ActivityIndicator color={C.lime} size="small" style={{ marginRight: 8 }} />
                      : <Text style={s.healthBtnIcon}>❤️</Text>
                    }
                    <Text style={s.healthBtnText}>
                      {healthLoading ? 'Reading from Health…' : 'Import from Apple Health'}
                    </Text>
                  </TouchableOpacity>
                  {healthError ? <Text style={[s.error, { marginTop: -8, marginBottom: 8 }]}>{healthError}</Text> : null}
                </>
              )}

              <Field
                label="Height (cm)"
                value={draft.height_cm?.toString() ?? ''}
                onChangeText={v => upd({ height_cm: v ? (parseFloat(v) || null) : null })}
                keyboardType="decimal-pad"
              />
              <Field
                label="Weight (kg)"
                value={draft.weight_kg?.toString() ?? ''}
                onChangeText={v => upd({ weight_kg: v ? (parseFloat(v) || null) : null })}
                keyboardType="decimal-pad"
              />
              <Btn label="Continue" onPress={next} />
            </View>
          )}

          {step === 'goal' && (
            <View style={s.stepWrap}>
              <BackBtn onPress={back} />
              <Text style={s.heading}>Your Goal</Text>
              <Text style={s.sub}>What are you trying to achieve?</Text>
              {(
                [
                  { id: 'lose', label: 'Lose Weight', desc: '~300 kcal deficit per day' },
                  { id: 'maintain', label: 'Maintain Weight', desc: 'Eat at your TDEE' },
                  { id: 'gain', label: 'Gain Weight', desc: '~300 kcal surplus per day' },
                ] as const
              ).map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.optCard, draft.goal === opt.id && s.optCardActive]}
                  onPress={() => upd({ goal: opt.id })}
                >
                  <Text style={[s.optLabel, draft.goal === opt.id && s.optLabelActive]}>{opt.label}</Text>
                  <Text style={s.optDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
              <Btn label="Continue" onPress={next} />
            </View>
          )}

          {step === 'deficit' && (
            <View style={s.stepWrap}>
              <BackBtn onPress={back} />
              <Text style={s.heading}>Calorie Deficit</Text>
              <Text style={s.sub}>How aggressive do you want your cut?</Text>
              {(
                [
                  { kcal: 250, label: 'Small Deficit',  desc: '−250 kcal/day · Slow, sustainable loss (~0.25 kg/week)' },
                  { kcal: 500, label: 'Medium Deficit', desc: '−500 kcal/day · Steady loss (~0.5 kg/week)' },
                  { kcal: 750, label: 'Big Deficit',    desc: '−750 kcal/day · Faster loss (~0.75 kg/week)' },
                ] as const
              ).map(opt => (
                <TouchableOpacity
                  key={opt.kcal}
                  style={[s.optCard, deficitKcal === opt.kcal && customDeficit === '' && s.optCardActive]}
                  onPress={() => { setDeficitKcal(opt.kcal); setCustomDeficit(''); }}
                >
                  <Text style={[s.optLabel, deficitKcal === opt.kcal && customDeficit === '' && s.optLabelActive]}>{opt.label}</Text>
                  <Text style={s.optDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.optCard, customDeficit !== '' && s.optCardActive]}
                onPress={() => { if (customDeficit === '') setCustomDeficit('400'); }}
              >
                <Text style={[s.optLabel, customDeficit !== '' && s.optLabelActive]}>Custom</Text>
                <Text style={s.optDesc}>Set your own daily calorie deficit</Text>
              </TouchableOpacity>
              {customDeficit !== '' && (
                <Field
                  label="My deficit (kcal/day)"
                  value={customDeficit}
                  onChangeText={v => {
                    setCustomDeficit(v);
                    const n = parseInt(v);
                    if (n > 0) setDeficitKcal(n);
                  }}
                  keyboardType="number-pad"
                />
              )}
              <Btn label="Continue" onPress={next} />
            </View>
          )}

          {step === 'activity' && (
            <View style={s.stepWrap}>
              <BackBtn onPress={back} />
              <Text style={s.heading}>Activity Level</Text>
              <Text style={s.sub}>How active are you on a typical week?</Text>
              {(
                [
                  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
                  { id: 'light', label: 'Light', desc: 'Exercise 1–3 days/week' },
                  { id: 'moderate', label: 'Moderate', desc: 'Exercise 3–5 days/week' },
                  { id: 'active', label: 'Active', desc: 'Hard exercise 6–7 days/week' },
                  { id: 'very_active', label: 'Very Active', desc: 'Very hard exercise or physical job' },
                ] as const
              ).map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.optCard, draft.activity_level === opt.id && s.optCardActive]}
                  onPress={() => upd({ activity_level: opt.id })}
                >
                  <Text style={[s.optLabel, draft.activity_level === opt.id && s.optLabelActive]}>{opt.label}</Text>
                  <Text style={s.optDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
              <Btn label="Continue" onPress={next} />
            </View>
          )}

          {step === 'nutrition' && (
            <View style={s.stepWrap}>
              <BackBtn onPress={back} />
              <Text style={s.heading}>Nutrition Goals</Text>
              <Text style={s.sub}>Fine-tune your daily targets</Text>
              {(draft.height_cm && draft.weight_kg && draft.age) ? (
                <View style={s.hintBox}>
                  <Text style={s.hintText}>Estimated TDEE: {calcTDEE(draft)} kcal/day</Text>
                </View>
              ) : null}
              <Field
                label="Daily Calories (kcal)"
                value={draft.daily_calories.toString()}
                onChangeText={v => upd({ daily_calories: v ? (parseInt(v) || 2000) : 2000 })}
                keyboardType="number-pad"
              />
              <Field
                label="Food Preferences"
                value={draft.preferences}
                onChangeText={v => upd({ preferences: v })}
                placeholder="e.g. Mediterranean, low-carb…"
                multiline
              />
              <Field
                label="Dietary Restrictions"
                value={draft.dietary_restrictions}
                onChangeText={v => upd({ dietary_restrictions: v })}
                placeholder="e.g. gluten-free, nut allergy…"
                multiline
              />
              <Btn label="Continue" onPress={next} />
            </View>
          )}

          {step === 'budget' && (
            <View style={s.stepWrap}>
              <BackBtn onPress={back} />
              <Text style={s.heading}>Weekly Budget</Text>
              <Text style={s.sub}>How much do you spend on groceries per week?</Text>
              <View style={s.quickRow}>
                {[50, 80, 100, 150].map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[s.quickBtn, draft.weekly_budget_eur === v && s.quickBtnActive]}
                    onPress={() => upd({ weekly_budget_eur: v })}
                  >
                    <Text style={[s.quickBtnText, draft.weekly_budget_eur === v && s.quickBtnTextActive]}>€{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field
                label="Or enter a custom amount (€)"
                value={draft.weekly_budget_eur.toString()}
                onChangeText={v => upd({ weekly_budget_eur: v ? (parseFloat(v) || 80) : 80 })}
                keyboardType="decimal-pad"
              />
              <Btn label="Continue" onPress={next} />
            </View>
          )}

          {step === 'done' && (
            <View style={s.stepWrap}>
              <Text style={s.bigEmoji}>🎉</Text>
              <Text style={s.heading}>You're all set!</Text>
              <Text style={s.sub}>Your profile is ready</Text>
              <Text style={s.body}>
                We'll generate your first personalized weekly meal plan based on your goals and preferences.
              </Text>
              <Btn label="Start Tracking" onPress={doFinish} loading={loading} />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function Btn({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity style={s.btn} onPress={onPress} disabled={loading}>
      {loading
        ? <ActivityIndicator color={C.background} />
        : <Text style={s.btnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.backBtn} onPress={onPress}>
      <Text style={s.backBtnText}>← Back</Text>
    </TouchableOpacity>
  );
}

function Field({
  label, value, onChangeText, keyboardType, autoCapitalize, secureTextEntry, placeholder, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder ?? ''}
        placeholderTextColor={C.text3}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },

  progressWrap: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, marginBottom: 36, gap: 12 },
  progressTrack: { flex: 1, height: 4, backgroundColor: C.surface3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.lime, borderRadius: 2 },
  progressLabel: { fontSize: 12, color: C.text3, minWidth: 32, textAlign: 'right' },

  stepWrap: { paddingTop: 24 },

  bigEmoji: { fontSize: 64, textAlign: 'center', marginBottom: 20 },
  heading: { fontSize: 30, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 15, color: C.text2, textAlign: 'center', marginBottom: 28 },
  body: { fontSize: 15, color: C.text2, textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  appleBtn: {
    width: '100%',
    height: 56,
    marginTop: 8,
  },
  loadingRow: { alignItems: 'center', marginTop: 20 },
  privacyNote: {
    fontSize: 12,
    color: C.text3,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },

  btn: {
    backgroundColor: C.lime,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: C.background },

  backBtn: { marginBottom: 12 },
  backBtnText: { fontSize: 14, color: C.text3 },

  error: { fontSize: 13, color: C.red, marginBottom: 8, textAlign: 'center' },

  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 11, color: C.text3, marginBottom: 6,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: 14 },

  optCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  optCardActive: { borderColor: C.lime, backgroundColor: C.limeDim },
  optLabel: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 2 },
  optLabelActive: { color: C.lime },
  optDesc: { fontSize: 13, color: C.text3 },

  hintBox: {
    backgroundColor: C.limeDim2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.limeDim,
  },
  hintText: { fontSize: 14, color: C.lime, textAlign: 'center', fontWeight: '600' },

  healthBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 20,
  },
  healthBtnIcon: { fontSize: 16 },
  healthBtnText: { fontSize: 14, fontWeight: '600', color: C.lime },

  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  quickBtnActive: { backgroundColor: C.limeDim, borderColor: C.lime },
  quickBtnText: { fontSize: 15, fontWeight: '600', color: C.text2 },
  quickBtnTextActive: { color: C.lime },
});
