import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AdaptedIngredient,
  LidlPromoDetail,
  Meal,
  UserRecipe,
  adaptRecipeWithLidl,
  fetchLidlCatalog,
  fetchMealSteps,
  fetchUserRecipes,
  saveUserRecipe,
  swapMeal as apiSwapMeal,
} from '@/services/api';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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

type SwapPhase = 'choose' | 'ai' | 'my-recipes' | 'loading' | 'preview';

interface SwapState {
  day: string;
  idx: number;
  phase: SwapPhase;
  preferences: string;
  candidate: Meal | null;
  error: string | null;
  userRecipes: UserRecipe[];
  loadingRecipes: boolean;
  cheapening: boolean;
  cheapenError: string | null;
  adaptedIngredients: AdaptedIngredient[] | null;
  saveToRecipes: boolean;
  savedOk: boolean;
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
  const [stepsCache, setStepsCache] = useState<Record<string, string[]>>({});
  const [stepsLoadingName, setStepsLoadingName] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [swapState, setSwapState] = useState<SwapState | null>(null);
  const [catalog, setCatalog] = useState<LidlPromoDetail[]>([]);

  React.useEffect(() => {
    fetchLidlCatalog().then(setCatalog).catch(() => {});
  }, []);

  const dayPlan = getEffectiveDayPlan(selectedDay);
  const logged  = loggedMeals[selectedDay]  ?? new Set<number>();
  const locked  = lockedMeals[selectedDay]  ?? new Set<number>();
  const barPercent = dayPlan ? Math.min(100, Math.round((dayPlan.total_calories / 2000) * 100)) : 0;

  const getMealAccent    = (idx: number) => [colors.orange, colors.lime, colors.blue, '#c47fff'][idx % 4];
  const getMealAccentDim = (idx: number) => [`${colors.orange}22`, `${colors.lime}22`, `${colors.blue}22`, 'rgba(196,127,255,0.13)'][idx % 4];

  const commitEdit = (idx: number) => {
    if (editDraft.trim()) editMealName(selectedDay, idx, editDraft.trim());
    setEditingIdx(null);
    setEditDraft('');
  };

  const openSwapModal = (day: string, idx: number) =>
    setSwapState({ day, idx, phase: 'choose', preferences: '', candidate: null, error: null,
      userRecipes: [], loadingRecipes: false, cheapening: false, cheapenError: null,
      adaptedIngredients: null, saveToRecipes: false, savedOk: false });

  const patchSwap = (patch: Partial<SwapState>) =>
    setSwapState(s => s ? { ...s, ...patch } : null);

  const runAISwap = async () => {
    if (!swapState) return;
    const dp = getEffectiveDayPlan(swapState.day);
    if (!dp) return;
    patchSwap({ phase: 'loading', error: null });
    try {
      const meal = await apiSwapMeal(dp, swapState.idx, swapState.preferences || undefined);
      patchSwap({ phase: 'preview', candidate: meal, adaptedIngredients: null });
    } catch (e) {
      patchSwap({ phase: 'ai', error: (e as Error).message });
    }
  };

  const loadMyRecipes = async () => {
    patchSwap({ phase: 'my-recipes', loadingRecipes: true, error: null, userRecipes: [] });
    try {
      const recipes = await fetchUserRecipes();
      patchSwap({ loadingRecipes: false, userRecipes: recipes });
    } catch (e) {
      patchSwap({ loadingRecipes: false, error: (e as Error).message });
    }
  };

  const selectSavedRecipe = (r: UserRecipe) => {
    const meal: Meal = {
      name: r.name, calories: r.calories, protein_g: r.protein_g,
      carbs_g: r.carbs_g, fat_g: r.fat_g,
      ingredients: r.ingredients, lidl_products_used: r.lidl_products_used,
    };
    patchSwap({ phase: 'preview', candidate: meal, adaptedIngredients: null });
  };

  const runCheapen = async () => {
    if (!swapState?.candidate) return;
    patchSwap({ cheapening: true, cheapenError: null });
    try {
      const result = await adaptRecipeWithLidl(swapState.candidate.name, swapState.candidate.ingredients);
      patchSwap({ cheapening: false, adaptedIngredients: result.adaptedIngredients });
    } catch (e) {
      patchSwap({ cheapening: false, cheapenError: (e as Error).message });
    }
  };

  const applyCheapenToCandidate = () => {
    if (!swapState?.candidate || !swapState.adaptedIngredients) return;
    const lidlProducts = swapState.adaptedIngredients
      .filter(a => a.lidlProduct)
      .map(a => a.lidlProduct as string);
    patchSwap({ candidate: { ...swapState.candidate, lidl_products_used: lidlProducts } });
  };

  const confirmSwap = async () => {
    if (!swapState?.candidate) return;
    applyMealOverride(swapState.day, swapState.idx, swapState.candidate);
    persistCurrentPlan().catch(console.warn);
    if (swapState.saveToRecipes) {
      try {
        await saveUserRecipe(swapState.candidate);
        patchSwap({ savedOk: true });
      } catch { /* non-fatal */ }
    }
    setSwapState(null);
  };

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').trim();
  const STOP = new Set(['lidl', 'avec', 'les', 'pour', 'dans', 'des', 'une', 'and', 'the']);

  // Convert any weight/volume string to a common unit (grams or ml)
  const toGrams = (s: string): number | null => {
    let m = s.match(/(\d+\.?\d*)\s*kg/i);  if (m) return +m[1] * 1000;
    m = s.match(/(\d+\.?\d*)\s*g\b/i);     if (m) return +m[1];
    return null;
  };
  const toMl = (s: string): number | null => {
    let m = s.match(/(\d+\.?\d*)\s*l\b/i); if (m) return +m[1] * 1000;
    m = s.match(/(\d+\.?\d*)\s*cl\b/i);    if (m) return +m[1] * 10;
    m = s.match(/(\d+\.?\d*)\s*ml\b/i);    if (m) return +m[1];
    return null;
  };
  const toUnits = (s: string): number | null => {
    let m = s.match(/x\s*(\d+)/i) || s.match(/(\d+)\s*x\b/i); if (m) return +m[1];
    m = s.match(/(\d+)\s*(pcs?|pieces?|units?|tranches?|oeufs?|eggs?)/i); if (m) return +m[1];
    return null;
  };

  const portionRatio = (ingredient: string, catalogTitle: string): number => {
    const ig = toGrams(ingredient), cg = toGrams(catalogTitle);
    if (ig && cg) return Math.min(1, ig / cg);
    const im = toMl(ingredient), cm = toMl(catalogTitle);
    if (im && cm) return Math.min(1, im / cm);
    const iu = toUnits(ingredient), cu = toUnits(catalogTitle);
    if (iu && cu) return Math.min(1, iu / cu);
    return 0.3; // can't parse — assume ~30% of package
  };

  const mealCost = (meal: Meal): number | null => {
    if (!catalog.length || !meal.lidl_products_used.length) return null;
    let total = 0; let matched = 0;
    for (const productName of meal.lidl_products_used) {
      const words = norm(productName).split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
      if (!words.length) continue;
      let best: LidlPromoDetail | undefined; let bestScore = 0;
      for (const item of catalog) {
        const score = words.filter(w => norm(item.title).includes(w)).length;
        if (score > bestScore) { bestScore = score; best = item; }
      }
      if (!best || bestScore === 0) continue;

      // Find the ingredient line that best matches this product
      const ingLine = meal.ingredients.find(ing =>
        words.some(w => norm(ing).includes(w))
      ) ?? '';

      const ratio = portionRatio(ingLine, best.title);
      total += ratio * parseFloat(best.price);
      matched++;
    }
    return matched > 0 ? parseFloat(total.toFixed(2)) : null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.weekLabel, { color: colors.lime }]}>THIS WEEK</Text>
              <Text style={[styles.title, { color: colors.text }]}>Meal Plan</Text>
            </View>
            <TouchableOpacity
              style={[styles.regenBtn, { borderColor: colors.border2, backgroundColor: colors.surface2 }]}
              onPress={refresh} disabled={isLoading}
            >
              <Text style={[styles.regenIcon, { color: colors.text2 }]}>⟳</Text>
              <Text style={[styles.regenText, { color: colors.text2 }]}>{isLoading ? 'Generating…' : 'Regenerate'}</Text>
            </TouchableOpacity>
          </View>
        </View>

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
              { val: `${dayPlan.carbs_g}g`,   label: 'CARB', color: colors.blue },
              { val: `${dayPlan.fat_g}g`,     label: 'FAT',  color: colors.orange },
            ].map(m => (
              <View key={m.label} style={styles.macroPill}>
                <Text style={[styles.macroVal, { color: m.color }]}>{m.val}</Text>
                <Text style={[styles.macroKey, { color: colors.text3 }]}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
          {DAYS.map(day => {
            const active = selectedDay === day.key;
            return (
              <TouchableOpacity key={day.key}
                style={[styles.dayChip, { backgroundColor: colors.surface, borderColor: colors.border },
                  active && { borderColor: colors.lime, backgroundColor: colors.limeDim }]}
                onPress={() => { setSelectedDay(day.key); setExpandedMeal(null); setEditingIdx(null); }}
              >
                <Text style={[styles.dayChipLabel, { color: colors.text3 }]}>{day.short}</Text>
                <Text style={[styles.dayChipName, { color: active ? colors.lime : colors.text2 }]}>{day.key.slice(0, 3)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.daySummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.dsLabel, { color: colors.text3 }]}>Day Total</Text>
            <Text style={[styles.dsVal, { color: colors.text }]}>
              <Text style={{ color: colors.lime }}>{dayPlan ? dayPlan.total_calories.toLocaleString() : '—'}</Text>{' kcal'}
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

        <View style={styles.mealsSection}>
          {isLoading && (
            <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.lime} />
              <Text style={[styles.loadingText, { color: colors.text3 }]}>Generating your meal plan…</Text>
            </View>
          )}
          {error && <Text style={[styles.errorText, { color: colors.orange }]}>{error}</Text>}

          {!isLoading && dayPlan?.meals.map((meal, idx) => {
            const expanded  = expandedMeal === idx;
            const isLogged  = logged.has(idx);
            const isLocked  = locked.has(idx);
            const isSwapping = swappingMeal?.day === selectedDay && swappingMeal?.idx === idx;
            const isEditing  = editingIdx === idx;
            const accent    = getMealAccent(idx);
            const accentDim = getMealAccentDim(idx);
            const mealType  = MEAL_TYPES[idx] ?? 'Meal';
            const isLidl    = meal.lidl_products_used.length > 0;
            const cost      = mealCost(meal);

            return (
              <TouchableOpacity key={idx} activeOpacity={0.88}
                style={[styles.mealCard,
                  { backgroundColor: expanded ? colors.surface2 : colors.surface,
                    borderColor: expanded ? accent : colors.border,
                    opacity: isSwapping ? 0.5 : 1 }]}
                onPress={() => {
                  const next = expanded ? null : idx;
                  setExpandedMeal(next);
                  setEditingIdx(null);
                  if (next !== null && !stepsCache[meal.name] && stepsLoadingName !== meal.name) {
                    setStepsLoadingName(meal.name);
                    fetchMealSteps(meal.name, meal.ingredients).then(steps => {
                      setStepsCache(c => ({ ...c, [meal.name]: steps }));
                    }).finally(() => setStepsLoadingName(null));
                  }
                }}
              >
                <View style={styles.mealCardHeader}>
                  <View style={[styles.mealTypePill, { backgroundColor: accentDim }]}>
                    <Text style={[styles.mealTypePillText, { color: accent }]}>{mealType}</Text>
                  </View>
                  <View style={styles.mealHeaderRight}>
                    <Text style={[styles.mealKcal, { color: colors.text3 }]}>
                      <Text style={{ color: colors.text2 }}>{meal.calories}</Text> kcal
                    </Text>
                    {cost !== null && (
                      <Text style={[styles.mealCost, { color: colors.lime }]}>~€{cost.toFixed(2)}</Text>
                    )}
                  </View>
                  {isLocked && <Text style={styles.lockIcon}>🔒</Text>}
                  {isSwapping && <ActivityIndicator size="small" color={accent} />}
                </View>

                {isEditing ? (
                  <TextInput
                    style={[styles.mealNameInput, { color: colors.text, borderColor: accent }]}
                    value={editDraft} onChangeText={setEditDraft}
                    onBlur={() => commitEdit(idx)} onSubmitEditing={() => commitEdit(idx)} autoFocus
                  />
                ) : (
                  <Text style={[styles.mealName, { color: isLogged ? colors.text2 : colors.text }]}>{meal.name}</Text>
                )}

                <View style={styles.mealMeta}>
                  {isLidl && (
                    <View style={[styles.lidlTag, { backgroundColor: colors.limeDim2, borderColor: 'rgba(181,242,61,0.2)' }]}>
                      <Text style={[styles.lidlTagText, { color: colors.lime }]}>Lidl</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.mealMacrosRow, { borderTopColor: colors.border }]}>
                  {[
                    { val: `${meal.protein_g}g`, label: 'Protein', color: colors.lime },
                    { val: `${meal.carbs_g}g`,   label: 'Carbs',   color: colors.blue },
                    { val: `${meal.fat_g}g`,     label: 'Fat',     color: colors.orange },
                    { val: `${meal.calories}`,   label: 'kcal',    color: colors.text },
                  ].map((m, i, arr) => (
                    <View key={i} style={[styles.macroBlock, { borderColor: colors.border }, i === arr.length - 1 && styles.macroBlockLast]}>
                      <Text style={[styles.macroBlockVal, { color: m.color }]}>{m.val}</Text>
                      <Text style={[styles.macroBlockLabel, { color: colors.text3 }]}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                {expanded && (
                  <View style={[styles.stepsBox, { borderTopColor: colors.border }]}>
                    <Text style={[styles.stepsLabel, { color: colors.text3 }]}>RECIPE</Text>
                    {stepsLoadingName === meal.name
                      ? <ActivityIndicator color={colors.lime} style={{ marginVertical: 8 }} />
                      : (stepsCache[meal.name] ?? []).map((step, si) => (
                          <View key={si} style={styles.stepRow}>
                            <View style={[styles.stepNum, { backgroundColor: colors.limeDim }]}>
                              <Text style={[styles.stepNumText, { color: colors.lime }]}>{si + 1}</Text>
                            </View>
                            <Text style={[styles.stepText, { color: colors.text2 }]}>{step}</Text>
                          </View>
                        ))
                    }
                  </View>
                )}

                {expanded && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: isLocked ? colors.lime : colors.border, backgroundColor: isLocked ? colors.limeDim : 'transparent' }]}
                      onPress={(e) => { e.stopPropagation?.(); lockMeal(selectedDay, idx); }}
                    >
                      <Text style={styles.actionBtnIcon}>{isLocked ? '🔒' : '🔓'}</Text>
                      <Text style={[styles.actionBtnLabel, { color: isLocked ? colors.lime : colors.text3 }]}>{isLocked ? 'Locked' : 'Lock'}</Text>
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
                      <Text style={[styles.actionBtnLabel, { color: isLogged ? colors.lime : colors.text3 }]}>{isLogged ? 'Logged' : 'Log'}</Text>
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

      <Modal visible={!!swapState} animationType="slide" transparent onRequestClose={() => setSwapState(null)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {swapState && (
              <SwapModal
                state={swapState}
                colors={colors}
                onAIGenerate={runAISwap}
                onLoadMyRecipes={loadMyRecipes}
                onSelectRecipe={selectSavedRecipe}
                onCheapen={runCheapen}
                onApplyCheapen={applyCheapenToCandidate}
                onConfirm={confirmSwap}
                onPatch={patchSwap}
                onClose={() => setSwapState(null)}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Swap Modal ───────────────────────────────────────────────────────────────

interface SwapModalProps {
  state: SwapState;
  colors: any;
  onAIGenerate: () => void;
  onLoadMyRecipes: () => void;
  onSelectRecipe: (r: UserRecipe) => void;
  onCheapen: () => void;
  onApplyCheapen: () => void;
  onConfirm: () => void;
  onPatch: (p: Partial<SwapState>) => void;
  onClose: () => void;
}

function SwapModal({ state, colors, onAIGenerate, onLoadMyRecipes, onSelectRecipe, onCheapen, onApplyCheapen, onConfirm, onPatch, onClose }: SwapModalProps) {
  const set = (p: Partial<SwapState>) => onPatch(p);

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

        {/* ── choose ── */}
        {state.phase === 'choose' && (
          <View style={styles.chooseGrid}>
            <TouchableOpacity
              style={[styles.chooseCard, { borderColor: colors.lime, backgroundColor: `${colors.lime}10` }]}
              onPress={() => set({ phase: 'ai' })}
            >
              <Text style={styles.chooseIcon}>🤖</Text>
              <Text style={[styles.chooseTitle, { color: colors.text }]}>AI Generate</Text>
              <Text style={[styles.chooseDesc, { color: colors.text3 }]}>Let AI suggest a new meal, optionally with your preferences</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chooseCard, { borderColor: colors.blue, backgroundColor: `${colors.blue}10` }]}
              onPress={onLoadMyRecipes}
            >
              <Text style={styles.chooseIcon}>📖</Text>
              <Text style={[styles.chooseTitle, { color: colors.text }]}>My Recipes</Text>
              <Text style={[styles.chooseDesc, { color: colors.text3 }]}>Pick from your saved personal recipes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ai input ── */}
        {state.phase === 'ai' && (
          <View style={styles.inputPhase}>
            <Text style={[styles.inputLabel, { color: colors.text3 }]}>PREFERENCES (OPTIONAL)</Text>
            <TextInput
              style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface2 }]}
              placeholder="e.g. high protein, vegetarian, quick to make…"
              placeholderTextColor={colors.text3}
              value={state.preferences}
              onChangeText={v => set({ preferences: v })}
              multiline numberOfLines={3}
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

        {/* ── my recipes ── */}
        {state.phase === 'my-recipes' && (
          <View>
            {state.loadingRecipes && (
              <View style={styles.loadingPhase}>
                <ActivityIndicator color={colors.lime} size="large" />
                <Text style={[styles.loadingMsg, { color: colors.text3 }]}>Loading your recipes…</Text>
              </View>
            )}
            {!state.loadingRecipes && state.userRecipes.length === 0 && (
              <View style={styles.emptyRecipes}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved recipes yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.text3 }]}>Save a meal from the Today tab or after generating an AI swap</Text>
              </View>
            )}
            {!state.loadingRecipes && state.userRecipes.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.savedRecipeRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                onPress={() => onSelectRecipe(r)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.savedRecipeName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.savedRecipeMeta, { color: colors.text3 }]}>
                    {r.calories} kcal · P {r.protein_g}g · C {r.carbs_g}g · F {r.fat_g}g
                  </Text>
                  {r.lidl_products_used.length > 0 && (
                    <Text style={[styles.savedRecipeLidl, { color: colors.lime }]}>🛒 Lidl products included</Text>
                  )}
                </View>
                <Text style={[styles.savedRecipeArrow, { color: colors.text3 }]}>›</Text>
              </TouchableOpacity>
            ))}
            {state.error && <Text style={[styles.errorMsg, { color: colors.orange }]}>{state.error}</Text>}
            <TouchableOpacity style={[styles.backBtn, { marginTop: 12 }]} onPress={() => set({ phase: 'choose', error: null })}>
              <Text style={[styles.backBtnText, { color: colors.text3 }]}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── loading ── */}
        {state.phase === 'loading' && (
          <View style={styles.loadingPhase}>
            <ActivityIndicator color={colors.lime} size="large" />
            <Text style={[styles.loadingMsg, { color: colors.text3 }]}>Generating your meal…</Text>
          </View>
        )}

        {/* ── preview ── */}
        {state.phase === 'preview' && state.candidate && (
          <View style={styles.previewPhase}>
            <Text style={[styles.inputLabel, { color: colors.text3 }]}>NEW MEAL PREVIEW</Text>

            {/* Candidate card */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface2, borderColor: colors.lime }]}>
              <Text style={[styles.previewName, { color: colors.text }]}>{state.candidate.name}</Text>
              <View style={styles.previewMacros}>
                {[
                  { v: `${state.candidate.protein_g}g`, l: 'Protein', c: colors.lime },
                  { v: `${state.candidate.carbs_g}g`,   l: 'Carbs',   c: colors.blue },
                  { v: `${state.candidate.fat_g}g`,     l: 'Fat',     c: colors.orange },
                  { v: `${state.candidate.calories}`,   l: 'kcal',    c: colors.text },
                ].map(m => (
                  <View key={m.l} style={styles.previewMacroItem}>
                    <Text style={[styles.previewMacroVal, { color: m.c }]}>{m.v}</Text>
                    <Text style={[styles.previewMacroLabel, { color: colors.text3 }]}>{m.l}</Text>
                  </View>
                ))}
              </View>
              {state.candidate.ingredients.length > 0 && (
                <View style={styles.previewIngredients}>
                  <Text style={[styles.inputLabel, { color: colors.text3, marginBottom: 6 }]}>INGREDIENTS</Text>
                  {state.candidate.ingredients.map((ing, i) => (
                    <Text key={i} style={[styles.previewIngr, { color: colors.text2 }]}>• {ing}</Text>
                  ))}
                </View>
              )}
              {state.candidate.lidl_products_used.length > 0 && (
                <View style={[styles.lidlApplied, { backgroundColor: `${colors.lime}12`, borderColor: `${colors.lime}30` }]}>
                  <Text style={[styles.lidlAppliedTitle, { color: colors.lime }]}>🛒 Lidl products applied</Text>
                  {state.candidate.lidl_products_used.map((p, i) => (
                    <Text key={i} style={[styles.previewIngr, { color: colors.lime }]}>• {p}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* Cheapen with Lidl */}
            {!state.adaptedIngredients && (
              <TouchableOpacity
                style={[styles.cheapenBtn, { borderColor: colors.lime, backgroundColor: `${colors.lime}0f` }]}
                onPress={onCheapen}
                disabled={state.cheapening}
              >
                {state.cheapening
                  ? <ActivityIndicator color={colors.lime} size="small" />
                  : <Text style={styles.cheapenIcon}>🛒</Text>
                }
                <Text style={[styles.cheapenText, { color: colors.lime }]}>
                  {state.cheapening ? 'Finding Lidl substitutes…' : 'Cheapen with Lidl'}
                </Text>
              </TouchableOpacity>
            )}
            {state.cheapenError && <Text style={[styles.errorMsg, { color: colors.orange }]}>{state.cheapenError}</Text>}

            {/* Substitution results */}
            {state.adaptedIngredients && (
              <View style={[styles.cheapenResults, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.text3, marginBottom: 10 }]}>LIDL SUBSTITUTIONS</Text>
                {state.adaptedIngredients.map((item, i) => (
                  <View key={i} style={[styles.substitutionRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.subOriginal, { color: colors.text3 }]}>{item.original}</Text>
                    {item.lidlProduct
                      ? <Text style={[styles.subProduct, { color: colors.lime }]}>→ {item.lidlProduct}</Text>
                      : <Text style={[styles.subProduct, { color: colors.text3 }]}>→ Not available at Lidl</Text>
                    }
                    {item.note ? <Text style={[styles.subNote, { color: colors.text3 }]}>{item.note}</Text> : null}
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.applyBtn, { backgroundColor: colors.lime }]}
                  onPress={onApplyCheapen}
                >
                  <Text style={[styles.primaryBtnText, { color: colors.background }]}>Apply Lidl substitutions</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Save to My Recipes toggle */}
            <View style={[styles.saveToggleRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={[styles.saveToggleLabel, { color: colors.text }]}>Save to My Recipes</Text>
              <Switch
                value={state.saveToRecipes}
                onValueChange={v => set({ saveToRecipes: v })}
                trackColor={{ false: colors.surface3, true: colors.lime }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.lime }]} onPress={onConfirm}>
              <Text style={[styles.primaryBtnText, { color: colors.background }]}>Use This Meal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={() => set({ phase: state.userRecipes.length > 0 ? 'my-recipes' : 'ai', candidate: null, adaptedIngredients: null })}
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
  mealHeaderRight: { flex: 1, alignItems: 'flex-end', gap: 2 },
  mealKcal: { fontSize: 12, textAlign: 'right' },
  mealCost: { fontSize: 11, fontWeight: '600', textAlign: 'right' },
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
  stepsBox: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  stepsLabel: { fontSize: 9, letterSpacing: 0.14, textTransform: 'uppercase', marginBottom: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 4 },
  actionBtnIcon: { fontSize: 16 },
  actionBtnLabel: { fontSize: 10, fontWeight: '600' },
  logBtn: { marginVertical: 10, marginHorizontal: 16, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  logBtnText: { fontSize: 14, fontWeight: '600' },
  // modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  // choose
  chooseGrid: { gap: 12, marginBottom: 8 },
  chooseCard: { borderWidth: 1.5, borderRadius: 20, padding: 20, gap: 8 },
  chooseIcon: { fontSize: 32 },
  chooseTitle: { fontSize: 18, fontWeight: '700' },
  chooseDesc: { fontSize: 13, lineHeight: 18 },
  // input
  inputPhase: { gap: 12 },
  inputLabel: { fontSize: 10, letterSpacing: 0.14, textTransform: 'uppercase' },
  textArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 90, textAlignVertical: 'top' },
  errorMsg: { fontSize: 13 },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { fontSize: 14 },
  // my recipes
  savedRecipeRow: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedRecipeName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  savedRecipeMeta: { fontSize: 12 },
  savedRecipeLidl: { fontSize: 11, marginTop: 4 },
  savedRecipeArrow: { fontSize: 22 },
  emptyRecipes: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  // loading
  loadingPhase: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  loadingMsg: { fontSize: 15 },
  // preview
  previewPhase: { gap: 14 },
  previewCard: { borderWidth: 1.5, borderRadius: 20, padding: 18, gap: 12 },
  previewName: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
  previewMacros: { flexDirection: 'row' },
  previewMacroItem: { flex: 1, alignItems: 'center' },
  previewMacroVal: { fontSize: 15, fontWeight: '700' },
  previewMacroLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.08 },
  previewIngredients: { gap: 4 },
  previewIngr: { fontSize: 13, lineHeight: 20 },
  lidlApplied: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  lidlAppliedTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  // cheapen
  cheapenBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18 },
  cheapenIcon: { fontSize: 18 },
  cheapenText: { fontSize: 15, fontWeight: '600' },
  cheapenResults: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 4 },
  substitutionRow: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1 },
  subOriginal: { fontSize: 12, marginBottom: 2 },
  subProduct: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  subNote: { fontSize: 11, fontStyle: 'italic' },
  applyBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  // save toggle
  saveToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  saveToggleLabel: { fontSize: 15, fontWeight: '500' },
});
