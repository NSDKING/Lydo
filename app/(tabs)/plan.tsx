import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Meal, analyzeTiktok, swapMeal as apiSwapMeal } from '@/services/api';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

type SwapPhase = 'choose' | 'ai' | 'tiktok' | 'loading' | 'preview';
interface SwapState {
  day: string;
  idx: number;
  phase: SwapPhase;
  preferences: string;
  tiktokUrl: string;
  candidate: Meal | null;
  error: string | null;
}

export default function PlanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const {
    isLoading, error, refresh,
    loggedMeals, logMeal,
    lockedMeals, lockMeal,
    editMealName,
    swappingMeal,
    getEffectiveDayPlan,
    applyMealOverride,
    persistCurrentPlan,
  } = useMenu();

  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [swapState, setSwapState] = useState<SwapState | null>(null);

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

  const openSwapModal = (day: string, idx: number) => {
    setSwapState({ day, idx, phase: 'choose', preferences: '', tiktokUrl: '', candidate: null, error: null });
  };

  const runAISwap = async () => {
    if (!swapState) return;
    const dp = getEffectiveDayPlan(swapState.day);
    if (!dp) return;
    setSwapState(s => s ? { ...s, phase: 'loading', error: null } : null);
    try {
      const meal = await apiSwapMeal(dp, swapState.idx, swapState.preferences || undefined);
      setSwapState(s => s ? { ...s, phase: 'preview', candidate: meal } : null);
    } catch (e) {
      setSwapState(s => s ? { ...s, phase: 'ai', error: (e as Error).message } : null);
    }
  };

  const runTikTokSwap = async () => {
    if (!swapState) return;
    setSwapState(s => s ? { ...s, phase: 'loading', error: null } : null);
    try {
      const recipe = await analyzeTiktok(swapState.tiktokUrl.trim());
      const meal: Meal = {
        name: recipe.title,
        calories: recipe.macros.calories,
        protein_g: recipe.macros.protein_g,
        carbs_g: recipe.macros.carbs_g,
        fat_g: recipe.macros.fat_g,
        ingredients: recipe.ingredients,
        lidl_products_used: [],
      };
      setSwapState(s => s ? { ...s, phase: 'preview', candidate: meal } : null);
    } catch (e) {
      setSwapState(s => s ? { ...s, phase: 'tiktok', error: (e as Error).message } : null);
    }
  };

  const confirmSwap = async () => {
    if (!swapState?.candidate) return;
    applyMealOverride(swapState.day, swapState.idx, swapState.candidate);
    setSwapState(null);
    persistCurrentPlan().catch(console.warn);
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

                {/* Meal name */}
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

                {/* Action buttons */}
                {expanded && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: isLocked ? colors.lime : colors.border, backgroundColor: isLocked ? colors.limeDim : 'transparent' }]}
                      onPress={(e) => { e.stopPropagation?.(); lockMeal(selectedDay, idx); }}
                    >
                      <Text style={styles.actionBtnIcon}>{isLocked ? '🔒' : '🔓'}</Text>
                      <Text style={[styles.actionBtnLabel, { color: isLocked ? colors.lime : colors.text3 }]}>
                        {isLocked ? 'Locked' : 'Lock'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: colors.border }]}
                      onPress={(e) => { e.stopPropagation?.(); setEditDraft(meal.name); setEditingIdx(idx); }}
                    >
                      <Text style={styles.actionBtnIcon}>✏️</Text>
                      <Text style={[styles.actionBtnLabel, { color: colors.text3 }]}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: colors.border, opacity: isLocked ? 0.4 : 1 }]}
                      onPress={(e) => { e.stopPropagation?.(); if (!isLocked) openSwapModal(selectedDay, idx); }}
                      disabled={isLocked || isSwapping}
                    >
                      <Text style={styles.actionBtnIcon}>🔁</Text>
                      <Text style={[styles.actionBtnLabel, { color: colors.text3 }]}>Swap</Text>
                    </TouchableOpacity>

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

      {/* Swap modal */}
      <Modal
        visible={!!swapState}
        animationType="slide"
        transparent
        onRequestClose={() => setSwapState(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {swapState && (
              <SwapModal
                state={swapState}
                colors={colors}
                onChange={setSwapState}
                onAIGenerate={runAISwap}
                onTikTokAnalyze={runTikTokSwap}
                onConfirm={confirmSwap}
                onClose={() => setSwapState(null)}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Swap Modal ───────────────────────────────────────────────────────────────

interface SwapModalProps {
  state: SwapState;
  colors: any;
  onChange: (s: SwapState) => void;
  onAIGenerate: () => void;
  onTikTokAnalyze: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

function SwapModal({ state, colors, onChange, onAIGenerate, onTikTokAnalyze, onConfirm, onClose }: SwapModalProps) {
  const set = (patch: Partial<SwapState>) => onChange({ ...state, ...patch });

  return (
    <>
      <View style={styles.sheetHandle} />
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>Swap Meal</Text>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.surface3 }]} onPress={onClose}>
          <Text style={[styles.closeBtnText, { color: colors.text2 }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── Phase: choose ── */}
        {state.phase === 'choose' && (
          <View style={styles.chooseGrid}>
            <TouchableOpacity
              style={[styles.chooseCard, { borderColor: colors.lime, backgroundColor: `${colors.lime}10` }]}
              onPress={() => set({ phase: 'ai' })}
            >
              <Text style={styles.chooseIcon}>🤖</Text>
              <Text style={[styles.chooseTitle, { color: colors.text }]}>AI Generate</Text>
              <Text style={[styles.chooseDesc, { color: colors.text3 }]}>Let AI suggest a new meal with your preferences</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chooseCard, { borderColor: colors.blue, backgroundColor: `${colors.blue}10` }]}
              onPress={() => set({ phase: 'tiktok' })}
            >
              <Text style={styles.chooseIcon}>🎵</Text>
              <Text style={[styles.chooseTitle, { color: colors.text }]}>From TikTok</Text>
              <Text style={[styles.chooseDesc, { color: colors.text3 }]}>Paste a TikTok recipe video URL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase: ai input ── */}
        {state.phase === 'ai' && (
          <View style={styles.inputPhase}>
            <Text style={[styles.inputLabel, { color: colors.text3 }]}>PREFERENCES (OPTIONAL)</Text>
            <TextInput
              style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface2 }]}
              placeholder="e.g. high protein, vegetarian, quick to make…"
              placeholderTextColor={colors.text3}
              value={state.preferences}
              onChangeText={v => set({ preferences: v })}
              multiline
              numberOfLines={3}
            />
            {state.error && <Text style={[styles.errorMsg, { color: colors.orange }]}>{state.error}</Text>}
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.lime }]} onPress={onAIGenerate}>
              <Text style={[styles.primaryBtnText, { color: colors.background }]}>Generate Meal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => set({ phase: 'choose', error: null })}>
              <Text style={[styles.backBtnText, { color: colors.text3 }]}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase: tiktok input ── */}
        {state.phase === 'tiktok' && (
          <View style={styles.inputPhase}>
            <Text style={[styles.inputLabel, { color: colors.text3 }]}>TIKTOK VIDEO URL</Text>
            <TextInput
              style={[styles.urlInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface2 }]}
              placeholder="https://www.tiktok.com/@..."
              placeholderTextColor={colors.text3}
              value={state.tiktokUrl}
              onChangeText={v => set({ tiktokUrl: v })}
              autoCapitalize="none"
              keyboardType="url"
            />
            {state.error && <Text style={[styles.errorMsg, { color: colors.orange }]}>{state.error}</Text>}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.blue, opacity: state.tiktokUrl.trim() ? 1 : 0.4 }]}
              onPress={onTikTokAnalyze}
              disabled={!state.tiktokUrl.trim()}
            >
              <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Analyze Recipe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => set({ phase: 'choose', error: null })}>
              <Text style={[styles.backBtnText, { color: colors.text3 }]}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase: loading ── */}
        {state.phase === 'loading' && (
          <View style={styles.loadingPhase}>
            <ActivityIndicator color={colors.lime} size="large" />
            <Text style={[styles.loadingMsg, { color: colors.text3 }]}>Generating your meal…</Text>
          </View>
        )}

        {/* ── Phase: preview ── */}
        {state.phase === 'preview' && state.candidate && (
          <View style={styles.previewPhase}>
            <Text style={[styles.previewLabel, { color: colors.text3 }]}>NEW MEAL PREVIEW</Text>
            <View style={[styles.previewCard, { backgroundColor: colors.surface2, borderColor: colors.lime }]}>
              <Text style={[styles.previewName, { color: colors.text }]}>{state.candidate.name}</Text>
              <View style={styles.previewMacros}>
                {[
                  { v: `${state.candidate.protein_g}g`, l: 'Protein', c: colors.lime },
                  { v: `${state.candidate.carbs_g}g`, l: 'Carbs', c: colors.blue },
                  { v: `${state.candidate.fat_g}g`, l: 'Fat', c: colors.orange },
                  { v: `${state.candidate.calories}`, l: 'kcal', c: colors.text },
                ].map(m => (
                  <View key={m.l} style={styles.previewMacroItem}>
                    <Text style={[styles.previewMacroVal, { color: m.c }]}>{m.v}</Text>
                    <Text style={[styles.previewMacroLabel, { color: colors.text3 }]}>{m.l}</Text>
                  </View>
                ))}
              </View>
              {state.candidate.ingredients.length > 0 && (
                <View style={styles.previewIngredients}>
                  <Text style={[styles.previewIngrTitle, { color: colors.text3 }]}>INGREDIENTS</Text>
                  {state.candidate.ingredients.map((ing, i) => (
                    <Text key={i} style={[styles.previewIngr, { color: colors.text2 }]}>• {ing}</Text>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.lime }]} onPress={onConfirm}>
              <Text style={[styles.primaryBtnText, { color: colors.background }]}>Use This Meal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={() => set({ phase: state.tiktokUrl ? 'tiktok' : 'ai', candidate: null })}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text2 }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  // modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  // choose phase
  chooseGrid: { gap: 12, marginBottom: 8 },
  chooseCard: { borderWidth: 1.5, borderRadius: 20, padding: 20, gap: 8 },
  chooseIcon: { fontSize: 32 },
  chooseTitle: { fontSize: 18, fontWeight: '700' },
  chooseDesc: { fontSize: 13, lineHeight: 18 },
  // input phase
  inputPhase: { gap: 12 },
  inputLabel: { fontSize: 10, letterSpacing: 0.14, textTransform: 'uppercase' },
  textArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 90, textAlignVertical: 'top' },
  urlInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  errorMsg: { fontSize: 13 },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { fontSize: 14 },
  // loading phase
  loadingPhase: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  loadingMsg: { fontSize: 15 },
  // preview phase
  previewPhase: { gap: 16 },
  previewLabel: { fontSize: 10, letterSpacing: 0.14, textTransform: 'uppercase' },
  previewCard: { borderWidth: 1.5, borderRadius: 20, padding: 18, gap: 12 },
  previewName: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
  previewMacros: { flexDirection: 'row', gap: 0 },
  previewMacroItem: { flex: 1, alignItems: 'center' },
  previewMacroVal: { fontSize: 15, fontWeight: '700' },
  previewMacroLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.08 },
  previewIngredients: { gap: 6 },
  previewIngrTitle: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.12 },
  previewIngr: { fontSize: 13, lineHeight: 20 },
});
