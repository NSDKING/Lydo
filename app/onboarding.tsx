import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PROFILE, UserProfile } from '@/context/ProfileContext';
import { Colors } from '@/constants/theme';
import { useLang } from '@/context/LangContext';

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
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(DEFAULT_PROFILE);
  const [deficitKcal, setDeficitKcal] = useState(500);
  const [customDeficit, setCustomDeficit] = useState('');
  const step = STEPS[idx];
  const isProgressStep = step !== 'welcome' && step !== 'done';
  const progressIdx = idx - 1; // auth=0, personal=1, ..., budget=6
  const progressPct = isProgressStep ? progressIdx / TOTAL_PROGRESS : step === 'done' ? 1 : 0;

  const upd = (f: Partial<UserProfile>) => setDraft(p => ({ ...p, ...f }));

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
              <Text style={s.sub}>{t('ob_tagline')}</Text>
              <Text style={s.body}>{t('ob_body')}</Text>
              <Btn label={t('ob_cta')} onPress={() => setIdx(1)} />
            </View>
          )}

          {step === 'auth' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>{t('ob_authTitle')}</Text>
              <Text style={s.sub}>{t('ob_authSub')}</Text>

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

              <Text style={s.privacyNote}>{t('ob_applePrivacy')}</Text>
            </View>
          )}

          {step === 'personal' && (
            <View style={s.stepWrap}>
              <BackBtn label={t('back')} onPress={back} />
              <Text style={s.heading}>{t('ob_personalTitle')}</Text>
              <Text style={s.sub}>{t('ob_personalSub')}</Text>
              <Field label={t('ob_name')} value={draft.name} onChangeText={v => upd({ name: v })} />
              <Field
                label={t('ob_age')}
                value={draft.age?.toString() ?? ''}
                onChangeText={v => upd({ age: v ? (parseInt(v) || null) : null })}
                keyboardType="number-pad"
              />
              <Btn label={t('continue')} onPress={next} />
            </View>
          )}

          {step === 'body' && (
            <View style={s.stepWrap}>
              <BackBtn label={t('back')} onPress={back} />
              <Text style={s.heading}>{t('ob_bodyTitle')}</Text>
              <Text style={s.sub}>{t('ob_bodySub')}</Text>

              <Field
                label={t('ob_height')}
                value={draft.height_cm?.toString() ?? ''}
                onChangeText={v => upd({ height_cm: v ? (parseFloat(v) || null) : null })}
                keyboardType="decimal-pad"
              />
              <Field
                label={t('ob_weight')}
                value={draft.weight_kg?.toString() ?? ''}
                onChangeText={v => upd({ weight_kg: v ? (parseFloat(v) || null) : null })}
                keyboardType="decimal-pad"
              />
              <Btn label={t('continue')} onPress={next} />
            </View>
          )}

          {step === 'goal' && (
            <View style={s.stepWrap}>
              <BackBtn label={t('back')} onPress={back} />
              <Text style={s.heading}>{t('ob_goalTitle')}</Text>
              <Text style={s.sub}>{t('ob_goalSub')}</Text>
              {(
                [
                  { id: 'lose',     label: t('ob_lose'),     desc: t('ob_loseDesc') },
                  { id: 'maintain', label: t('ob_maintain'), desc: t('ob_maintainDesc') },
                  { id: 'gain',     label: t('ob_gain'),     desc: t('ob_gainDesc') },
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
              <Btn label={t('continue')} onPress={next} />
            </View>
          )}

          {step === 'deficit' && (
            <View style={s.stepWrap}>
              <BackBtn label={t('back')} onPress={back} />
              <Text style={s.heading}>{t('ob_deficitTitle')}</Text>
              <Text style={s.sub}>{t('ob_deficitSub')}</Text>
              {(
                [
                  { kcal: 250, label: t('ob_defSmall'), desc: t('ob_defSmallDesc') },
                  { kcal: 500, label: t('ob_defMed'),   desc: t('ob_defMedDesc') },
                  { kcal: 750, label: t('ob_defBig'),   desc: t('ob_defBigDesc') },
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
                <Text style={[s.optLabel, customDeficit !== '' && s.optLabelActive]}>{t('custom')}</Text>
                <Text style={s.optDesc}>{t('ob_defCustomDesc')}</Text>
              </TouchableOpacity>
              {customDeficit !== '' && (
                <Field
                  label={t('ob_defMyLabel')}
                  value={customDeficit}
                  onChangeText={v => {
                    setCustomDeficit(v);
                    const n = parseInt(v);
                    if (n > 0) setDeficitKcal(n);
                  }}
                  keyboardType="number-pad"
                />
              )}
              <Btn label={t('continue')} onPress={next} />
            </View>
          )}

          {step === 'activity' && (
            <View style={s.stepWrap}>
              <BackBtn label={t('back')} onPress={back} />
              <Text style={s.heading}>{t('ob_activityTitle')}</Text>
              <Text style={s.sub}>{t('ob_activitySub')}</Text>
              {(
                [
                  { id: 'sedentary',  label: t('ob_sedentary'),  desc: t('ob_sedentaryDesc') },
                  { id: 'light',      label: t('ob_light'),      desc: t('ob_lightDesc') },
                  { id: 'moderate',   label: t('ob_moderate'),   desc: t('ob_moderateDesc') },
                  { id: 'active',     label: t('ob_active'),     desc: t('ob_activeDesc') },
                  { id: 'very_active',label: t('ob_veryActive'), desc: t('ob_veryActiveDesc') },
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
              <Btn label={t('continue')} onPress={next} />
            </View>
          )}

          {step === 'nutrition' && (
            <View style={s.stepWrap}>
              <BackBtn label={t('back')} onPress={back} />
              <Text style={s.heading}>{t('ob_nutritionTitle')}</Text>
              <Text style={s.sub}>{t('ob_nutritionSub')}</Text>
              {(draft.height_cm && draft.weight_kg && draft.age) ? (
                <View style={s.hintBox}>
                  <Text style={s.hintText}>{t('ob_tdeeLabel')}: {calcTDEE(draft)} {t('ob_tdeeUnit')}</Text>
                </View>
              ) : null}
              <Field
                label={t('ob_dailyCal')}
                value={draft.daily_calories.toString()}
                onChangeText={v => upd({ daily_calories: v ? (parseInt(v) || 2000) : 2000 })}
                keyboardType="number-pad"
              />
              <Field
                label={t('ob_prefs')}
                value={draft.preferences}
                onChangeText={v => upd({ preferences: v })}
                placeholder={t('ob_prefsPlaceholder')}
                multiline
              />
              <Field
                label={t('ob_restrictions')}
                value={draft.dietary_restrictions}
                onChangeText={v => upd({ dietary_restrictions: v })}
                placeholder={t('ob_restrictionsPlaceholder')}
                multiline
              />
              <Btn label={t('continue')} onPress={next} />
            </View>
          )}

          {step === 'budget' && (
            <View style={s.stepWrap}>
              <BackBtn label={t('back')} onPress={back} />
              <Text style={s.heading}>{t('ob_budgetTitle')}</Text>
              <Text style={s.sub}>{t('ob_budgetSub')}</Text>
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
                label={t('ob_budgetCustom')}
                value={draft.weekly_budget_eur.toString()}
                onChangeText={v => upd({ weekly_budget_eur: v ? (parseFloat(v) || 80) : 80 })}
                keyboardType="decimal-pad"
              />
              <Btn label={t('continue')} onPress={next} />
            </View>
          )}

          {step === 'done' && (
            <View style={s.stepWrap}>
              <Text style={s.bigEmoji}>🎉</Text>
              <Text style={s.heading}>{t('ob_doneTitle')}</Text>
              <Text style={s.sub}>{t('ob_doneSub')}</Text>
              <Text style={s.body}>{t('ob_doneBody')}</Text>
              <Btn label={t('ob_doneCta')} onPress={doFinish} loading={loading} />
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

function BackBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.backBtn} onPress={onPress}>
      <Text style={s.backBtnText}>{label}</Text>
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
