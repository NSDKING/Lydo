import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAYS = [
  { key: 'Monday',    short: 'Mon' },
  { key: 'Tuesday',   short: 'Tue' },
  { key: 'Wednesday', short: 'Wed' },
  { key: 'Thursday',  short: 'Thu' },
  { key: 'Friday',    short: 'Fri' },
  { key: 'Saturday',  short: 'Sat' },
  { key: 'Sunday',    short: 'Sun' },
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });

export default function PlanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const {
    isLoading, error, refresh,
    loggedMeals, logMeal,
    lockedMeals, lockMeal,
    editMealName, swapMeal, swappingMeal,
    getEffectiveDayPlan,
  } = useMenu();

  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const dayPlan = getEffectiveDayPlan(selectedDay);
  const logged = loggedMeals[selectedDay] ?? new Set<number>();
  const locked = lockedMeals[selectedDay] ?? new Set<number>();

  const barPercent = dayPlan
    ? Math.min(100, Math.round((dayPlan.total_calories / 2000) * 100))
    : 0;

  const getMealAccent = (idx: number) =>
    [colors.orange, colors.lime, colors.blue, '#c47fff'][idx % 4];
  const getMealAccentDim = (idx: number) =>
    [`${colors.orange}22`, `${colors.lime}22`, `${colors.blue}22`, 'rgba(196,127,255,0.13)'][idx % 4];

  const commitEdit = (idx: number) => {
    if (editDraft.trim()) editMealName(selectedDay, idx, editDraft.trim());
    setEditingIdx(null);
    setEditDraft('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.weekLabel, { color: colors.lime }]}>THIS WEEK</Text>
              <Text style={[styles.title, { color: colors.text }]}>Meal Plan</Text>
            </View>
            <TouchableOpacity
              style={[styles.regenBtn, { borderColor: colors.border2, backgroundColor: colors.surface2 }]}
              onPress={refresh}
              disabled={isLoading}
            >
              <Text style={[styles.regenIcon, { color: colors.text2 }]}>⟳</Text>
              <Text style={[styles.regenText, { color: colors.text2 }]}>
                {isLoading ? 'Generating…' : 'Regenerate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Budget strip */}
        <View style={[styles.budgetStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.budgetSublabel, { color: colors.text3 }]}>Daily Budget</Text>
            <Text style={[styles.budgetAmount, { color: colors.lime }]}>
              {dayPlan ? `${dayPlan.total_calories.toLocaleString()} kcal` : '— kcal'}
            </Text>
          </View>
          <View style={styles.budgetMacros}>
            {dayPlan && [
              { val: `${dayPlan.protein_g}g`, label: 'PRO', color: colors.lime },
              { val: `${dayPlan.carbs_g}g`, label: 'CARB', color: colors.blue },
              { val: `${dayPlan.fat_g}g`, label: 'FAT', color: colors.orange },
            ].map(m => (
              <View key={m.label} style={styles.macroPill}>
                <Text style={[styles.macroVal, { color: m.color }]}>{m.val}</Text>
                <Text style={[styles.macroKey, { color: colors.text3 }]}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Day tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
          {DAYS.map(day => {
            const active = selectedDay === day.key;
            return (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  active && { borderColor: colors.lime, backgroundColor: colors.limeDim },
                ]}
                onPress={() => { setSelectedDay(day.key); setExpandedMeal(null); setEditingIdx(null); }}
              >
                <Text style={[styles.dayChipLabel, { color: colors.text3 }]}>{day.short}</Text>
                <Text style={[styles.dayChipName, { color: active ? colors.lime : colors.text2 }]}>{day.key.slice(0, 3)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Day summary bar */}
        <View style={[styles.daySummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.dsLabel, { color: colors.text3 }]}>Day Total</Text>
            <Text style={[styles.dsVal, { color: colors.text }]}>
              <Text style={{ color: colors.lime }}>
                {dayPlan ? dayPlan.total_calories.toLocaleString() : '—'}
              </Text>{' kcal'}
            </Text>
          </View>
          <View style={styles.dsBarWrap}>
            <View style={styles.dsBarLabel}>
              <Text style={[styles.dsBarText, { color: colors.text3 }]}>Goal</Text>
              <Text style={[styles.dsBarText, { color: colors.text3 }]}>{barPercent}%</Text>
            </View>
            <View style={[styles.dsBarTrack, { backgroundColor: colors.surface3 }]}>
              <View style={[styles.dsBarFill, { backgroundColor: colors.lime, width: `${barPercent}%` } as ViewStyle]} />
            </View>
          </View>
        </View>

        {/* Meals */}
        <View style={styles.mealsSection}>
          {isLoading && (
            <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.lime} />
              <Text style={[styles.loadingText, { color: colors.text3 }]}>Generating your meal plan…</Text>
            </View>
          )}

          {error && <Text style={[styles.errorText, { color: colors.orange }]}>{error}</Text>}

          {!isLoading && dayPlan?.meals.map((meal, idx) => {
            const expanded = expandedMeal === idx;
            const isLogged = logged.has(idx);
            const isLocked = locked.has(idx);
            const isSwapping = swappingMeal?.day === selectedDay && swappingMeal?.idx === idx;
            const isEditing = editingIdx === idx;
            const accent = getMealAccent(idx);
            const accentDim = getMealAccentDim(idx);
            const mealType = MEAL_TYPES[idx] ?? 'Meal';
            const isLidl = meal.lidl_products_used.length > 0;

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.88}
                style={[
                  styles.mealCard,
                  {
                    backgroundColor: expanded ? colors.surface2 : colors.surface,
                    borderColor: expanded ? accent : colors.border,
                    opacity: isSwapping ? 0.5 : 1,
                  },
                ]}
                onPress={() => { setExpandedMeal(expanded ? null : idx); setEditingIdx(null); }}
              >
                {/* Card header */}
                <View style={styles.mealCardHeader}>
                  <View style={[styles.mealTypePill, { backgroundColor: accentDim }]}>
                    <Text style={[styles.mealTypePillText, { color: accent }]}>{mealType}</Text>
                  </View>
                  <Text style={[styles.mealKcal, { color: colors.text3 }]}>
                    <Text style={{ color: colors.text2 }}>{meal.calories}</Text> kcal
                  </Text>
                  {isLocked && <Text style={styles.lockIcon}>🔒</Text>}
                  {isSwapping && <ActivityIndicator size="small" color={accent} />}
                </View>

                {/* Meal name — editable */}
                {isEditing ? (
                  <TextInput
                    style={[styles.mealNameInput, { color: colors.text, borderColor: accent }]}
                    value={editDraft}
                    onChangeText={setEditDraft}
                    onBlur={() => commitEdit(idx)}
                    onSubmitEditing={() => commitEdit(idx)}
                    autoFocus
                  />
                ) : (
                  <Text style={[styles.mealName, { color: isLogged ? colors.text2 : colors.text }]}>
                    {meal.name}
                  </Text>
                )}

                {/* Source badges */}
                <View style={styles.mealMeta}>
                  {isLidl && (
                    <View style={[styles.lidlTag, { backgroundColor: colors.limeDim2, borderColor: 'rgba(181,242,61,0.2)' }]}>
                      <Text style={[styles.lidlTagText, { color: colors.lime }]}>Lidl</Text>
                    </View>
                  )}
                </View>

                {/* Macro row */}
                <View style={[styles.mealMacrosRow, { borderTopColor: colors.border }]}>
                  {[
                    { val: `${meal.protein_g}g`, label: 'Protein', color: colors.lime },
                    { val: `${meal.carbs_g}g`, label: 'Carbs', color: colors.blue },
                    { val: `${meal.fat_g}g`, label: 'Fat', color: colors.orange },
                    { val: `${meal.calories}`, label: 'kcal', color: colors.text },
                  ].map((m, i, arr) => (
                    <View key={i} style={[styles.macroBlock, { borderColor: colors.border }, i === arr.length - 1 && styles.macroBlockLast]}>
                      <Text style={[styles.macroBlockVal, { color: m.color }]}>{m.val}</Text>
                      <Text style={[styles.macroBlockLabel, { color: colors.text3 }]}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Action buttons — visible when expanded */}
                {expanded && (
                  <View style={styles.actionRow}>
                    {/* Lock */}
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: isLocked ? colors.lime : colors.border, backgroundColor: isLocked ? colors.limeDim : 'transparent' }]}
                      onPress={(e) => { e.stopPropagation?.(); lockMeal(selectedDay, idx); }}
                    >
                      <Text style={styles.actionBtnIcon}>{isLocked ? '🔒' : '🔓'}</Text>
                      <Text style={[styles.actionBtnLabel, { color: isLocked ? colors.lime : colors.text3 }]}>
                        {isLocked ? 'Locked' : 'Lock'}
                      </Text>
                    </TouchableOpacity>

                    {/* Edit */}
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: colors.border }]}
                      onPress={(e) => { e.stopPropagation?.(); setEditDraft(meal.name); setEditingIdx(idx); }}
                    >
                      <Text style={styles.actionBtnIcon}>✏️</Text>
                      <Text style={[styles.actionBtnLabel, { color: colors.text3 }]}>Edit</Text>
                    </TouchableOpacity>

                    {/* Swap */}
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: colors.border, opacity: isLocked ? 0.4 : 1 }]}
                      onPress={(e) => { e.stopPropagation?.(); if (!isLocked) swapMeal(selectedDay, idx); }}
                      disabled={isLocked || isSwapping}
                    >
                      {isSwapping
                        ? <ActivityIndicator size="small" color={colors.blue} />
                        : <Text style={styles.actionBtnIcon}>🔁</Text>
                      }
                      <Text style={[styles.actionBtnLabel, { color: colors.text3 }]}>Swap</Text>
                    </TouchableOpacity>

                    {/* Log */}
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: isLogged ? colors.lime : colors.border, backgroundColor: isLogged ? colors.limeDim : 'transparent' }]}
                      onPress={(e) => { e.stopPropagation?.(); logMeal(selectedDay, idx); }}
                    >
                      <Text style={styles.actionBtnIcon}>{isLogged ? '✅' : '☑️'}</Text>
                      <Text style={[styles.actionBtnLabel, { color: isLogged ? colors.lime : colors.text3 }]}>
                        {isLogged ? 'Logged' : 'Log'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Quick log button always visible */}
                <TouchableOpacity
                  style={[styles.logBtn, { backgroundColor: isLogged ? colors.surface3 : colors.lime }]}
                  onPress={(e) => { e.stopPropagation?.(); logMeal(selectedDay, idx); }}
                >
                  <Text style={[styles.logBtnText, { color: isLogged ? colors.text2 : colors.background }]}>
                    {isLogged ? '✓ Logged' : 'Log Meal'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingTop: 20, paddingHorizontal: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  weekLabel: { fontSize: 10, letterSpacing: 0.14, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '700' },
  regenBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
  regenIcon: { fontSize: 14 },
  regenText: { fontSize: 12, fontWeight: '500' },
  budgetStrip: { marginHorizontal: 24, marginTop: 16, borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  budgetSublabel: { fontSize: 10, letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 2 },
  budgetAmount: { fontSize: 22, fontWeight: '600' },
  budgetMacros: { flexDirection: 'row', gap: 12 },
  macroPill: { alignItems: 'center', gap: 1 },
  macroVal: { fontSize: 13, fontWeight: '500' },
  macroKey: { fontSize: 9, letterSpacing: 0.08, textTransform: 'uppercase' },
  dayScroll: { marginTop: 16, paddingHorizontal: 24 },
  dayScrollContent: { gap: 8, paddingRight: 24 },
  dayChip: { alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, minWidth: 60 },
  dayChipLabel: { fontSize: 10, letterSpacing: 0.08, textTransform: 'uppercase' },
  dayChipName: { fontSize: 13, fontWeight: '600' },
  daySummary: { marginHorizontal: 24, marginTop: 14, borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  dsLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.1 },
  dsVal: { fontSize: 18 },
  dsBarWrap: { flex: 1 },
  dsBarLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dsBarText: { fontSize: 10 },
  dsBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  dsBarFill: { height: '100%', borderRadius: 3 },
  mealsSection: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 100, gap: 12 },
  loadingCard: { borderRadius: 16, borderWidth: 1, paddingVertical: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 13, textAlign: 'center', marginVertical: 8 },
  mealCard: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  mealCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 10 },
  mealTypePill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8 },
  mealTypePillText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  mealKcal: { flex: 1, fontSize: 12, textAlign: 'right' },
  lockIcon: { fontSize: 13 },
  mealName: { fontSize: 17, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 6 },
  mealNameInput: { fontSize: 17, fontWeight: '600', marginHorizontal: 16, marginBottom: 6, borderBottomWidth: 1.5, paddingBottom: 4 },
  mealMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  lidlTag: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  lidlTagText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  mealMacrosRow: { flexDirection: 'row', borderTopWidth: 1, marginTop: 4 },
  macroBlock: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRightWidth: 1 },
  macroBlockLast: { borderRightWidth: 0 },
  macroBlockVal: { fontSize: 13, fontWeight: '700' },
  macroBlockLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.08 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 4 },
  actionBtnIcon: { fontSize: 16 },
  actionBtnLabel: { fontSize: 10, fontWeight: '600' },
  logBtn: { marginVertical: 10, marginHorizontal: 16, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  logBtnText: { fontSize: 14, fontWeight: '600' },
});
