import { Colors } from '@/constants/theme';
import { DEFAULT_PROFILE, useProfile, UserProfile } from '@/context/ProfileContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};
const GOAL_DELTA = { lose: -500, maintain: 0, gain: 300 };

function calcStats(p: UserProfile) {
  if (!p.height_cm || !p.weight_kg || !p.age) return null;
  const bmi = p.weight_kg / (p.height_cm / 100) ** 2;
  // Mifflin-St Jeor (gender-neutral midpoint)
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age - 78;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[p.activity_level];
  const recommended = Math.round(tdee + GOAL_DELTA[p.goal]);
  return { bmi: Math.round(bmi * 10) / 10, tdee: Math.round(tdee), recommended };
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
  const { profile, saving, saveProfile } = useProfile();

  const [draft, setDraft] = useState<UserProfile>(profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(profile); }, [profile]);

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

  const num = (v: number | null) => (v == null ? '' : String(v));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saved ? colors.surface3 : colors.lime, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.background} size="small" />
              : <Text style={[styles.saveBtnText, { color: saved ? colors.lime : colors.background }]}>
                  {saved ? '✓ Saved' : 'Save'}
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
                  <Text style={[styles.statLabel, { color: colors.text3 }]}>BMI</Text>
                  <Text style={[styles.statSub, { color: bmiCategory(stats.bmi).color }]}>{bmiCategory(stats.bmi).label}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: colors.text }]}>{stats.tdee}</Text>
                  <Text style={[styles.statLabel, { color: colors.text3 }]}>TDEE</Text>
                  <Text style={[styles.statSub, { color: colors.text3 }]}>kcal/day</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: colors.lime }]}>{stats.recommended}</Text>
                  <Text style={[styles.statLabel, { color: colors.text3 }]}>Target</Text>
                  <Text style={[styles.statSub, { color: colors.text3 }]}>kcal/day</Text>
                </View>
              </View>
            </View>
          )}

          {/* Personal info */}
          <SectionHeader title="Personal Info" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FieldRow label="Name" value={draft.name} onChangeText={v => set('name', v)} placeholder="Your name" colors={colors} />
            <FieldRow label="Age" value={num(draft.age)} onChangeText={v => set('age', v)} placeholder="25" unit="yr" keyboard="numeric" colors={colors} />
            <FieldRow label="Height" value={num(draft.height_cm)} onChangeText={v => set('height_cm', v)} placeholder="175" unit="cm" keyboard="numeric" colors={colors} />
            <FieldRow label="Weight" value={num(draft.weight_kg)} onChangeText={v => set('weight_kg', v)} placeholder="70" unit="kg" keyboard="decimal-pad" colors={colors} />
          </View>

          {/* Goal */}
          <SectionHeader title="Goal" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PillSelector
              value={draft.goal}
              onChange={v => set('goal', v)}
              colors={colors}
              options={[
                { key: 'lose', label: 'Lose Weight' },
                { key: 'maintain', label: 'Maintain' },
                { key: 'gain', label: 'Gain Muscle' },
              ]}
            />
          </View>

          {/* Activity */}
          <SectionHeader title="Activity Level" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PillSelector
              value={draft.activity_level}
              onChange={v => set('activity_level', v)}
              colors={colors}
              options={[
                { key: 'sedentary', label: 'Sedentary' },
                { key: 'light', label: 'Light' },
                { key: 'moderate', label: 'Moderate' },
                { key: 'active', label: 'Active' },
                { key: 'very_active', label: 'Very Active' },
              ]}
            />
          </View>

          {/* Nutrition */}
          <SectionHeader title="Nutrition" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FieldRow
              label="Daily Target"
              value={num(draft.daily_calories)}
              onChangeText={v => set('daily_calories', v)}
              placeholder="2000"
              unit="kcal"
              keyboard="numeric"
              colors={colors}
            />
            {stats && (
              <Text style={[styles.hint, { color: colors.text3 }]}>
                Calculated target: {stats.recommended} kcal based on your stats
              </Text>
            )}
            <FieldRow
              label="Preferences"
              value={draft.preferences}
              onChangeText={v => set('preferences', v)}
              placeholder="e.g. Mediterranean, high protein…"
              colors={colors}
              multiline
            />
            <FieldRow
              label="Restrictions"
              value={draft.dietary_restrictions}
              onChangeText={v => set('dietary_restrictions', v)}
              placeholder="e.g. gluten-free, no shellfish…"
              colors={colors}
              multiline
            />
          </View>

          {/* Budget */}
          <SectionHeader title="Budget" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FieldRow
              label="Weekly Groceries"
              value={num(draft.weekly_budget_eur)}
              onChangeText={v => set('weekly_budget_eur', v)}
              placeholder="80"
              unit="€"
              keyboard="decimal-pad"
              colors={colors}
            />
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
});
