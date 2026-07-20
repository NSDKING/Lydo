import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { useLang } from '@/context/LangContext';
import { DEFAULT_PROFILE, useProfile, UserProfile } from '@/context/ProfileContext';
import { usePurchases } from '@/context/PurchasesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePremiumGate } from '@/hooks/usePremiumGate';
import { calcRecommendedCalories, calcTDEE } from '@/utils/tdee';
import { supabase } from '@/lib/supabase';
import { deleteAccount } from '@/services/api';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Kitchen Appliances ───────────────────────────────────────────────────────

const APPLIANCES_EN = [
  'Oven', 'Microwave', 'Air Fryer', 'Slow Cooker', 'Blender',
  'Food Processor', 'Instant Pot', 'Grill / BBQ', 'Steamer', 'Wok',
];
const APPLIANCES_FR = [
  'Four', 'Micro-ondes', 'Friteuse à air', 'Mijoteuse', 'Mixeur',
  'Robot culinaire', 'Autocuiseur', 'Grill / Barbecue', 'Cuiseur vapeur', 'Wok',
];
const APPLIANCES_KEY = 'lydo_kitchen_appliances';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcStats(p: UserProfile) {
  if (!p.height_cm || !p.weight_kg || !p.age) return null;
  const bmi = p.weight_kg / (p.height_cm / 100) ** 2;
  const tdee = calcTDEE(p);
  const recommended = calcRecommendedCalories(p);
  return { bmi: Math.round(bmi * 10) / 10, tdee, recommended };
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#4d9fff' };
  if (bmi < 25)   return { label: 'Normal', color: '#b5f23d' };
  if (bmi < 30)   return { label: 'Overweight', color: '#ff6b35' };
  return { label: 'Obese', color: '#ff4757' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, colors }: { title: string; colors: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.text3 }]}>{title.toUpperCase()}</Text>
  );
}

function FieldRow({
  label, value, onChangeText, placeholder, unit, keyboard, colors, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; unit?: string; keyboard?: any; colors: any; multiline?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.text2 }]}>{label}</Text>
      <View style={styles.fieldRight}>
        <TextInput
          style={[styles.fieldInput, { color: colors.text }, multiline && { height: 60, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? '—'}
          placeholderTextColor={colors.text3}
          keyboardType={keyboard ?? 'default'}
          returnKeyType="done"
          multiline={multiline}
        />
        {unit ? <Text style={[styles.fieldUnit, { color: colors.text3 }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function PillSelector<T extends string>({
  options, value, onChange, colors,
}: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; colors: any }) {
  return (
    <View style={styles.pillRow}>
      {options.map(opt => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.pill, { borderColor: active ? colors.lime : colors.border, backgroundColor: active ? colors.limeDim : colors.surface3 }]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.pillText, { color: active ? colors.lime : colors.text3 }]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { t, lang, langPref, setLang } = useLang();
  const { profile, saving, saveProfile } = useProfile();
  const { isPremium } = usePurchases();
  const { requirePremium } = usePremiumGate();
  const router = useRouter();

  const [draft, setDraft] = useState<UserProfile>(profile);
  const [saved, setSaved] = useState(false);
  const [applianceCounts, setApplianceCounts] = useState<Record<string, number>>({});

  useEffect(() => { setDraft(profile); }, [profile]);

  useEffect(() => {
    AsyncStorage.getItem(APPLIANCES_KEY).then(raw => {
      if (raw) try { setApplianceCounts(JSON.parse(raw)); } catch { /* ignore */ }
    }).catch(() => {});
  }, []);

  const updateAppliance = (name: string, delta: number) => {
    setApplianceCounts(prev => {
      const next = { ...prev, [name]: Math.max(0, (prev[name] ?? 0) + delta) };
      AsyncStorage.setItem(APPLIANCES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const set = <K extends keyof UserProfile>(key: K, raw: string | UserProfile[K]) => {
    setDraft(prev => {
      let value: UserProfile[K];
      if (typeof DEFAULT_PROFILE[key] === 'number' || DEFAULT_PROFILE[key] === null) {
        const n = parseFloat(raw as string);
        value = (isNaN(n) ? null : n) as UserProfile[K];
      } else {
        value = raw as UserProfile[K];
      }
      return { ...prev, [key]: value };
    });
    setSaved(false);
  };

  const stats = useMemo(() => calcStats(draft), [
    draft.height_cm, draft.weight_kg, draft.age, draft.activity_level, draft.goal,
  ]);

  const handleSave = async () => {
    await saveProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleManageSubscription = () => {
    if (isPremium) {
      RevenueCatUI.presentCustomerCenter();
    } else {
      router.push('/paywall');
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('profileSignOut'), t('profileSignOutMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('profileSignOut'), style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      t('profileResetTitle'),
      t('profileResetMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('profileResetBtn'),
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('user_profiles').delete().eq('user_id', user.id);
            }
            await supabase.auth.signOut();
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profileDeleteAccountTitle'),
      t('profileDeleteAccountMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('profileDeleteAccountBtn'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) await deleteAccount(user.id);
              await supabase.auth.signOut();
            } catch {
              Alert.alert(t('profileDeleteAccountError'));
            }
          },
        },
      ],
    );
  };

  const num = (v: number | null) => (v == null ? '' : String(v));

  const updateHouseholdSize = (delta: number) => {
    requirePremium(() => {
      setDraft(prev => ({ ...prev, household_size: Math.min(8, Math.max(1, prev.household_size + delta)) }));
      setSaved(false);
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profileTitle')}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saved ? colors.surface3 : colors.lime, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.background} size="small" />
              : <Text style={[styles.saveBtnText, { color: saved ? colors.lime : colors.background }]}>
                  {saved ? t('profileSaved') : t('profileSave')}
                </Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Stats card */}
          {stats && (
            <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: bmiCategory(stats.bmi).color }]}>{stats.bmi}</Text>
                  <Text style={[styles.statLabel, { color: colors.text3 }]}>{t('profileBmi')}</Text>
                  <Text style={[styles.statSub, { color: bmiCategory(stats.bmi).color }]}>{bmiCategory(stats.bmi).label}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: colors.text }]}>{stats.tdee}</Text>
                  <Text style={[styles.statLabel, { color: colors.text3 }]}>{t('profileTdee')}</Text>
                  <Text style={[styles.statSub, { color: colors.text3 }]}>kcal/day</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: colors.lime }]}>{stats.recommended}</Text>
                  <Text style={[styles.statLabel, { color: colors.text3 }]}>{t('profileTarget')}</Text>
                  <Text style={[styles.statSub, { color: colors.text3 }]}>kcal/day</Text>
                </View>
              </View>
            </View>
          )}

          {/* Personal info */}
          <SectionHeader title={t('profilePersonal')} colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FieldRow label={t('ob_name')} value={draft.name} onChangeText={v => set('name', v)} placeholder={t('profileNamePlaceholder')} colors={colors} />
            <FieldRow label={t('ob_age')} value={num(draft.age)} onChangeText={v => set('age', v)} placeholder="25" unit={t('profileAgeUnit')} keyboard="numeric" colors={colors} />
            <FieldRow label={t('ob_height')} value={num(draft.height_cm)} onChangeText={v => set('height_cm', v)} placeholder="175" unit="cm" keyboard="numeric" colors={colors} />
            <FieldRow label={t('ob_weight')} value={num(draft.weight_kg)} onChangeText={v => set('weight_kg', v)} placeholder="70" unit="kg" keyboard="decimal-pad" colors={colors} />
          </View>

          {/* Goal */}
          <SectionHeader title={t('profileGoal')} colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PillSelector
              value={draft.goal}
              onChange={v => set('goal', v)}
              colors={colors}
              options={[
                { key: 'lose', label: t('profileLose') },
                { key: 'maintain', label: t('profileMaintain') },
                { key: 'gain', label: t('profileGain') },
              ]}
            />
          </View>

          {/* Activity */}
          <SectionHeader title={t('profileActivity')} colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PillSelector
              value={draft.activity_level}
              onChange={v => set('activity_level', v)}
              colors={colors}
              options={[
                { key: 'sedentary', label: t('profileSedentary') },
                { key: 'light', label: t('profileLight') },
                { key: 'moderate', label: t('profileModerate') },
                { key: 'active', label: t('profileActive') },
                { key: 'very_active', label: t('profileVeryActive') },
              ]}
            />
          </View>

          {/* Nutrition */}
          <SectionHeader title={t('profileNutrition')} colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FieldRow
              label={t('profileDailyTarget')}
              value={num(draft.daily_calories)}
              onChangeText={v => set('daily_calories', v)}
              placeholder="2000"
              unit="kcal"
              keyboard="numeric"
              colors={colors}
            />
            <FieldRow
              label={t('profilePrefs')}
              value={draft.preferences}
              onChangeText={v => set('preferences', v)}
              placeholder={t('profilePrefsPlaceholder')}
              colors={colors}
              multiline
            />
            <FieldRow
              label={t('profileRestrictions')}
              value={draft.dietary_restrictions}
              onChangeText={v => set('dietary_restrictions', v)}
              placeholder={t('profileRestrictionsPlaceholder')}
              colors={colors}
              multiline
            />
          </View>

          {/* Budget */}
          <SectionHeader title={t('profileBudget')} colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FieldRow
              label={t('profileWeeklyGroceries')}
              value={num(draft.weekly_budget_eur)}
              onChangeText={v => set('weekly_budget_eur', v)}
              placeholder="80"
              unit="€"
              keyboard="decimal-pad"
              colors={colors}
            />
          </View>

          {/* Household size */}
          <SectionHeader title={t('profileHousehold')} colors={colors} />
          <Text style={[styles.sectionHint, { color: colors.text3 }]}>{t('profileHouseholdHint')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.applianceRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.applianceName, { color: colors.text }]}>
                {isPremium ? draft.household_size : 1} {t('profileHouseholdPeople')}
              </Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, { backgroundColor: draft.household_size > 1 ? colors.surface3 : colors.surface2, borderColor: colors.border }]}
                  onPress={() => updateHouseholdSize(-1)}
                  disabled={!isPremium || draft.household_size <= 1}
                >
                  <Text style={[styles.stepperBtnText, { color: draft.household_size > 1 ? colors.text : colors.text3 }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepperCount, { color: colors.lime }]}>
                  {isPremium ? draft.household_size : 1}
                </Text>
                <TouchableOpacity
                  style={[styles.stepperBtn, { backgroundColor: colors.surface3, borderColor: colors.border }]}
                  onPress={() => updateHouseholdSize(1)}
                  disabled={isPremium && draft.household_size >= 8}
                >
                  <Text style={[styles.stepperBtnText, { color: colors.lime }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Kitchen Appliances */}
          <SectionHeader title={t('profileAppliances')} colors={colors} />
          <Text style={[styles.sectionHint, { color: colors.text3 }]}>{t('profileAppliancesHint')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(lang === 'fr' ? APPLIANCES_FR : APPLIANCES_EN).map((name, i) => {
              const enName = APPLIANCES_EN[i];
              const count = applianceCounts[enName] ?? 0;
              return (
                <View
                  key={enName}
                  style={[styles.applianceRow, { borderBottomColor: colors.border, borderBottomWidth: i < APPLIANCES_EN.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
                >
                  <Text style={[styles.applianceName, { color: count > 0 ? colors.text : colors.text3 }]}>{name}</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: count > 0 ? colors.surface3 : colors.surface2, borderColor: colors.border }]}
                      onPress={() => updateAppliance(enName, -1)}
                      disabled={count === 0}
                    >
                      <Text style={[styles.stepperBtnText, { color: count > 0 ? colors.text : colors.text3 }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepperCount, { color: count > 0 ? colors.lime : colors.text3 }]}>
                      {count}
                    </Text>
                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: colors.surface3, borderColor: colors.border }]}
                      onPress={() => updateAppliance(enName, 1)}
                    >
                      <Text style={[styles.stepperBtnText, { color: colors.lime }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Language */}
          <SectionHeader title={t('profileLanguage')} colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.pillRow}>
              {([
                { key: 'auto', label: t('profileLangAuto') },
                { key: 'en',   label: t('profileLangEn') },
                { key: 'fr',   label: t('profileLangFr') },
              ] as const).map(opt => {
                const active = langPref === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.pill, { borderColor: active ? colors.lime : colors.border, backgroundColor: active ? colors.limeDim : colors.surface3 }]}
                    onPress={() => setLang(opt.key)}
                  >
                    <Text style={[styles.pillText, { color: active ? colors.lime : colors.text3 }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Account */}
          <SectionHeader title={t('profileAccount')} colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 0 }]}>
            <TouchableOpacity
              style={[styles.accountBtn, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={handleManageSubscription}
            >
              <Text style={[styles.accountBtnText, { color: isPremium ? colors.text2 : colors.lime }]}>
                {isPremium ? t('profileManageSubscription') : t('profileUpgradeToPro')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accountBtn, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={handleSignOut}
            >
              <Text style={[styles.accountBtnText, { color: colors.text2 }]}>{t('profileSignOut')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accountBtn, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={handleResetOnboarding}
            >
              <Text style={[styles.accountBtnText, { color: colors.orange }]}>{t('profileReset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.accountBtn} onPress={handleDeleteAccount}>
              <Text style={[styles.accountBtnText, { color: colors.orange }]}>{t('profileDeleteAccount')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  saveBtn: { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 20, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  // stats card
  statsCard: { margin: 16, borderRadius: 18, borderWidth: 1, padding: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  statSub: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 48, marginHorizontal: 8 },
  // section
  sectionHeader: { fontSize: 10, letterSpacing: 1.2, fontWeight: '700', marginHorizontal: 24, marginTop: 20, marginBottom: 8 },
  // card
  card: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 16 },
  // field
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  fieldLabel: { width: 110, fontSize: 15 },
  fieldRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  fieldInput: { flex: 1, fontSize: 15, textAlign: 'right', paddingVertical: 0 },
  fieldUnit: { fontSize: 13, marginLeft: 6, minWidth: 26 },
  hint: { fontSize: 11, paddingBottom: 10, textAlign: 'right' },
  // pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 14 },
  pill: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
  pillText: { fontSize: 13, fontWeight: '600' },
  accountBtn: { paddingVertical: 16, paddingHorizontal: 18 },
  accountBtnText: { fontSize: 15, fontWeight: '600' },
  sectionHint: { fontSize: 11, marginHorizontal: 24, marginTop: -4, marginBottom: 8 },
  applianceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  applianceName: { flex: 1, fontSize: 15 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: 18, fontWeight: '600', lineHeight: 22 },
  stepperCount: { width: 24, textAlign: 'center', fontSize: 16, fontWeight: '700' },
});
