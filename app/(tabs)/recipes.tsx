import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AdaptedIngredient,
  adaptRecipeWithLidl,
  analyzeTiktok,
  deleteUserRecipe,
  fetchUserRecipes,
  saveUserRecipe,
  TiktokRecipe,
  UserRecipe,
} from '@/services/api';
import { useShareIntentContext } from 'expo-share-intent';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner'];
const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });

interface ImportState {
  addDay: string | null;
  addSlot: number;
  added: boolean;
  adapting: boolean;
  adaptedIngredients: AdaptedIngredient[] | null;
  adaptError: string | null;
  saving: boolean;
  savedOk: boolean;
}

function defaultImportState(): ImportState {
  return { addDay: null, addSlot: 0, added: false, adapting: false, adaptedIngredients: null, adaptError: null, saving: false, savedOk: false };
}

export default function RecipesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading: planLoading, addTiktokMeal } = useMenu();

  // ── My Recipes (Supabase) ──────────────────────────────────────────────────
  const [myRecipes, setMyRecipes] = useState<UserRecipe[]>([]);
  const [loadingMyRecipes, setLoadingMyRecipes] = useState(false);
  const [expandedMyRecipe, setExpandedMyRecipe] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMyRecipes = useCallback(async () => {
    setLoadingMyRecipes(true);
    try {
      const data = await fetchUserRecipes();
      setMyRecipes(data);
    } finally {
      setLoadingMyRecipes(false);
    }
  }, []);

  useEffect(() => { loadMyRecipes(); }, [loadMyRecipes]);

  const handleDeleteMyRecipe = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteUserRecipe(id);
      setMyRecipes(prev => prev.filter(r => r.id !== id));
      if (expandedMyRecipe === id) setExpandedMyRecipe(null);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Share intent (TikTok → app) ────────────────────────────────────────────
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const lastHandledUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = shareIntent?.webUrl ?? shareIntent?.text ?? null;
    if (!url || url === lastHandledUrl.current || importing) return;
    lastHandledUrl.current = url;
    resetShareIntent();
    handleImportUrl(url);
  }, [shareIntent]);

  // ── TikTok imports (in-memory) ─────────────────────────────────────────────
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [importedRecipes, setImportedRecipes] = useState<TiktokRecipe[]>([]);
  const [expandedRecipe, setExpandedRecipe] = useState<number | null>(null);
  const [importStates, setImportStates] = useState<ImportState[]>([]);

  const planDays = plan?.days.map(d => d.day) ?? [];
  const todayPlan = plan?.days.find(d => d.day === TODAY) ?? plan?.days[0] ?? null;
  const mealAccentColors = [colors.orange, colors.lime, colors.blue, '#c47fff'];

  // ── Plan meal save state ───────────────────────────────────────────────────
  const [planMealSaving, setPlanMealSaving] = useState<Record<number, boolean>>({});

  // Derive which plan meals are already saved (by name, case-insensitive)
  const savedNames = new Set(myRecipes.map(r => r.name.toLowerCase()));
  const isPlanMealSaved = (name: string) => savedNames.has(name.toLowerCase());

  const handleSavePlanMeal = async (idx: number) => {
    const meal = todayPlan?.meals[idx];
    if (!meal) return;
    setPlanMealSaving(prev => ({ ...prev, [idx]: true }));
    try {
      await saveUserRecipe(meal);
      await loadMyRecipes();
    } finally {
      setPlanMealSaving(prev => ({ ...prev, [idx]: false }));
    }
  };

  // ── TikTok helpers ─────────────────────────────────────────────────────────
  const updateImportState = (idx: number, patch: Partial<ImportState>) => {
    setImportStates(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const handleImportUrl = async (url: string) => {
    setImporting(true);
    setImportError(null);
    try {
      const recipe = await analyzeTiktok(url);
      setImportedRecipes(prev => [recipe, ...prev]);
      setImportStates(prev => [defaultImportState(), ...prev]);
      setExpandedRecipe(0);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleAddToDay = (recipeIdx: number) => {
    const state = importStates[recipeIdx];
    if (!state?.addDay) return;
    addTiktokMeal(state.addDay, state.addSlot, importedRecipes[recipeIdx]);
    updateImportState(recipeIdx, { added: true });
  };

  const handleAdapt = async (recipeIdx: number) => {
    const recipe = importedRecipes[recipeIdx];
    updateImportState(recipeIdx, { adapting: true, adaptError: null, adaptedIngredients: null });
    try {
      const result = await adaptRecipeWithLidl(recipe.title, recipe.ingredients);
      updateImportState(recipeIdx, { adapting: false, adaptedIngredients: result.adaptedIngredients });
    } catch (err) {
      updateImportState(recipeIdx, { adapting: false, adaptError: (err as Error).message });
    }
  };

  const handleSaveImported = async (recipeIdx: number) => {
    const recipe = importedRecipes[recipeIdx];
    const state = importStates[recipeIdx];
    updateImportState(recipeIdx, { saving: true });
    try {
      const lidlProducts = state.adaptedIngredients
        ? state.adaptedIngredients.filter(a => a.lidlProduct).map(a => a.lidlProduct!)
        : [];
      await saveUserRecipe({
        name: recipe.title,
        calories: recipe.macros.calories,
        protein_g: recipe.macros.protein_g,
        carbs_g: recipe.macros.carbs_g,
        fat_g: recipe.macros.fat_g,
        ingredients: recipe.ingredients,
        lidl_products_used: lidlProducts,
      });
      updateImportState(recipeIdx, { saving: false, savedOk: true });
      loadMyRecipes();
    } catch {
      updateImportState(recipeIdx, { saving: false });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Recipes</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>Saved recipes + plan meals</Text>
        </View>

        {/* TikTok share card */}
        <View style={[styles.importCard, {
          backgroundColor: importing ? colors.surface2 : colors.surface,
          borderColor: importing ? colors.lime : colors.border,
        }]}>
          <View style={styles.importHeader}>
            <Text style={styles.importIcon}>{importing ? '⏳' : '📱'}</Text>
            <View style={styles.importHeaderText}>
              <Text style={[styles.importTitle, { color: colors.text }]}>
                {importing ? 'Importing recipe…' : 'Import from TikTok'}
              </Text>
              <Text style={[styles.importDesc, { color: colors.text3 }]}>
                {importing
                  ? 'Analysing the video, hang tight'
                  : 'Open TikTok → Share → Lydo'}
              </Text>
            </View>
            {importing && <ActivityIndicator color={colors.lime} />}
          </View>
          {!importing && (
            <View style={[styles.shareHint, { backgroundColor: colors.surface3, borderColor: colors.border2 }]}>
              <Text style={[styles.shareStep, { color: colors.text3 }]}>1. Find a recipe video on TikTok</Text>
              <Text style={[styles.shareStep, { color: colors.text3 }]}>2. Tap <Text style={{ color: colors.text }}>Share</Text> → <Text style={{ color: colors.lime }}>Lydo</Text></Text>
              <Text style={[styles.shareStep, { color: colors.text3 }]}>3. Recipe is imported automatically</Text>
            </View>
          )}
          {importError && <Text style={[styles.importError, { color: colors.orange }]}>{importError}</Text>}
        </View>

        {/* ── My Recipes (from Supabase) ──────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: colors.text3 }]}>My Recipes</Text>
            {loadingMyRecipes && <ActivityIndicator color={colors.lime} size="small" />}
          </View>

          {!loadingMyRecipes && myRecipes.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.text3 }]}>No saved recipes yet — save plan meals or TikTok imports below.</Text>
            </View>
          )}

          {myRecipes.map(recipe => {
            const open = expandedMyRecipe === recipe.id;
            const isDeleting = deletingId === recipe.id;
            const hasLidl = recipe.lidl_products_used.length > 0;

            return (
              <View
                key={recipe.id}
                style={[styles.recipeCard, { backgroundColor: colors.surface, borderColor: open ? colors.lime : colors.border }]}
              >
                <TouchableOpacity onPress={() => setExpandedMyRecipe(open ? null : recipe.id)} activeOpacity={0.85}>
                  <View style={styles.recipeCardHeader}>
                    <View style={styles.recipeCardLeft}>
                      <Text style={[styles.recipeName, { color: colors.text }]}>{recipe.name}</Text>
                      <View style={styles.recipeMeta}>
                        <Text style={[styles.recipeMetaText, { color: colors.lime }]}>{recipe.calories} kcal</Text>
                        <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>P {recipe.protein_g}g</Text>
                        <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>C {recipe.carbs_g}g</Text>
                        <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>F {recipe.fat_g}g</Text>
                        {hasLidl && (
                          <View style={[styles.lidlBadge, { backgroundColor: colors.limeDim }]}>
                            <Text style={[styles.lidlBadgeText, { color: colors.lime }]}>Lidl</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteBtn, { backgroundColor: colors.surface3 }]}
                      onPress={() => handleDeleteMyRecipe(recipe.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting
                        ? <ActivityIndicator color={colors.orange} size="small" />
                        : <Text style={[styles.deleteBtnText, { color: colors.orange }]}>✕</Text>
                      }
                    </TouchableOpacity>
                    <Text style={[styles.chevron, { color: colors.text3 }]}>{open ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {open && (
                  <>
                    <View style={styles.macroPills}>
                      {[
                        { label: 'P', val: `${recipe.protein_g}g`, color: colors.lime },
                        { label: 'C', val: `${recipe.carbs_g}g`, color: colors.blue },
                        { label: 'F', val: `${recipe.fat_g}g`, color: colors.orange },
                      ].map(m => (
                        <View key={m.label} style={[styles.macroPill, { backgroundColor: colors.surface2 }]}>
                          <Text style={[styles.macroPillVal, { color: m.color }]}>{m.val}</Text>
                          <Text style={[styles.macroPillLabel, { color: colors.text3 }]}>{m.label}</Text>
                        </View>
                      ))}
                    </View>

                    {recipe.ingredients.length > 0 && (
                      <>
                        <Text style={[styles.subheading, { color: colors.text3 }]}>INGREDIENTS</Text>
                        {recipe.ingredients.map((ing, i) => (
                          <View key={i} style={styles.ingredientRow}>
                            <View style={[styles.ingredientDot, { backgroundColor: colors.lime }]} />
                            <Text style={[styles.ingredientText, { color: colors.text2 }]}>{ing}</Text>
                          </View>
                        ))}
                      </>
                    )}

                    {hasLidl && (
                      <>
                        <Text style={[styles.subheading, { color: colors.text3, marginTop: 14 }]}>FROM LIDL</Text>
                        {recipe.lidl_products_used.map((p, i) => (
                          <View key={i} style={styles.ingredientRow}>
                            <View style={[styles.ingredientDot, { backgroundColor: colors.lime }]} />
                            <Text style={[styles.ingredientText, { color: colors.text2 }]}>{p}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* ── TikTok imports (in-memory) ────────────────────────────────────── */}
        {importedRecipes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text3 }]}>Imported (this session)</Text>
            {importedRecipes.map((recipe, idx) => {
              const open = expandedRecipe === idx;
              const state = importStates[idx] ?? defaultImportState();

              return (
                <View
                  key={idx}
                  style={[styles.recipeCard, { backgroundColor: colors.surface, borderColor: open ? colors.lime : colors.border }]}
                >
                  <TouchableOpacity onPress={() => setExpandedRecipe(open ? null : idx)} activeOpacity={0.85}>
                    <View style={styles.recipeCardHeader}>
                      <View style={styles.recipeCardLeft}>
                        <Text style={[styles.recipeName, { color: colors.text }]}>{recipe.title}</Text>
                        <View style={styles.recipeMeta}>
                          <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>⏱ {recipe.prep_time}</Text>
                          <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>  {recipe.difficulty}</Text>
                          <Text style={[styles.recipeMetaText, { color: colors.lime }]}>{recipe.macros.calories} kcal</Text>
                        </View>
                      </View>
                      <Text style={[styles.chevron, { color: colors.text3 }]}>{open ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>

                  {open && (
                    <>
                      <View style={styles.macroPills}>
                        {[
                          { label: 'P', val: `${recipe.macros.protein_g}g`, color: colors.lime },
                          { label: 'C', val: `${recipe.macros.carbs_g}g`, color: colors.blue },
                          { label: 'F', val: `${recipe.macros.fat_g}g`, color: colors.orange },
                        ].map(m => (
                          <View key={m.label} style={[styles.macroPill, { backgroundColor: colors.surface2 }]}>
                            <Text style={[styles.macroPillVal, { color: m.color }]}>{m.val}</Text>
                            <Text style={[styles.macroPillLabel, { color: colors.text3 }]}>{m.label}</Text>
                          </View>
                        ))}
                      </View>

                      <Text style={[styles.subheading, { color: colors.text3 }]}>INGREDIENTS</Text>
                      {recipe.ingredients.map((ing, i) => (
                        <View key={i} style={styles.ingredientRow}>
                          <View style={[styles.ingredientDot, { backgroundColor: colors.lime }]} />
                          <Text style={[styles.ingredientText, { color: colors.text2 }]}>{ing}</Text>
                        </View>
                      ))}

                      {recipe.steps.length > 0 && (
                        <>
                          <Text style={[styles.subheading, { color: colors.text3, marginTop: 14 }]}>STEPS</Text>
                          {recipe.steps.map((step, i) => (
                            <View key={i} style={styles.stepRow}>
                              <View style={[styles.stepNum, { backgroundColor: colors.limeDim }]}>
                                <Text style={[styles.stepNumText, { color: colors.lime }]}>{i + 1}</Text>
                              </View>
                              <Text style={[styles.stepText, { color: colors.text2 }]}>{step}</Text>
                            </View>
                          ))}
                        </>
                      )}

                      {/* Add to Plan */}
                      <View style={[styles.addToPlanBox, { backgroundColor: colors.surface2, borderColor: colors.border2 }]}>
                        <Text style={[styles.subheading, { color: colors.text3, marginTop: 0, marginBottom: 10 }]}>ADD TO PLAN</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayChipsScroll}>
                          <View style={styles.dayChips}>
                            {planDays.map(day => {
                              const sel = state.addDay === day;
                              return (
                                <TouchableOpacity
                                  key={day}
                                  style={[styles.dayChip, { backgroundColor: sel ? colors.lime : colors.surface3, borderColor: sel ? colors.lime : colors.border2 }]}
                                  onPress={() => updateImportState(idx, { addDay: day, added: false })}
                                >
                                  <Text style={[styles.dayChipText, { color: sel ? colors.background : colors.text3 }]}>
                                    {day.slice(0, 3)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                        <View style={styles.slotRow}>
                          {MEAL_SLOTS.map((slot, slotIdx) => {
                            const sel = state.addSlot === slotIdx;
                            return (
                              <TouchableOpacity
                                key={slot}
                                style={[styles.slotChip, { backgroundColor: sel ? colors.blue + '33' : colors.surface3, borderColor: sel ? colors.blue : colors.border2 }]}
                                onPress={() => updateImportState(idx, { addSlot: slotIdx, added: false })}
                              >
                                <Text style={[styles.slotChipText, { color: sel ? colors.blue : colors.text3 }]}>{slot}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity
                          style={[styles.addBtn, { backgroundColor: state.added ? colors.surface3 : state.addDay ? colors.lime : colors.surface3, opacity: state.addDay ? 1 : 0.4 }]}
                          onPress={() => handleAddToDay(idx)}
                          disabled={!state.addDay || state.added}
                        >
                          <Text style={[styles.addBtnText, { color: state.added ? colors.lime : colors.background }]}>
                            {state.added ? `✓ Added to ${state.addDay}` : state.addDay ? `Add to ${state.addDay}` : 'Select a day'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Adapt with Lidl */}
                      <View style={styles.adaptSection}>
                        <TouchableOpacity
                          style={[styles.adaptBtn, { backgroundColor: colors.surface2, borderColor: colors.border2 }]}
                          onPress={() => handleAdapt(idx)}
                          disabled={state.adapting}
                        >
                          {state.adapting
                            ? <ActivityIndicator color={colors.lime} size="small" style={{ marginRight: 8 }} />
                            : <Text style={styles.adaptBtnIcon}>🛒</Text>
                          }
                          <Text style={[styles.adaptBtnText, { color: state.adapting ? colors.text3 : colors.lime }]}>
                            {state.adapting ? 'Finding Lidl matches…' : 'Adapt with Lidl'}
                          </Text>
                        </TouchableOpacity>
                        {state.adaptError && (
                          <Text style={[styles.importError, { color: colors.orange, marginTop: 6 }]}>{state.adaptError}</Text>
                        )}
                        {state.adaptedIngredients && (
                          <View style={[styles.adaptResults, { backgroundColor: colors.surface3, borderColor: colors.border2 }]}>
                            <Text style={[styles.subheading, { color: colors.text3, marginTop: 0, marginBottom: 10 }]}>LIDL SUBSTITUTIONS</Text>
                            {state.adaptedIngredients.map((item, i) => (
                              <View key={i} style={styles.adaptRow}>
                                <View style={styles.adaptRowLeft}>
                                  <Text style={[styles.adaptOriginal, { color: colors.text3 }]}>{item.original}</Text>
                                  {item.lidlProduct
                                    ? <Text style={[styles.adaptProduct, { color: colors.lime }]}>→ {item.lidlProduct}</Text>
                                    : <Text style={[styles.adaptProduct, { color: colors.text3 }]}>→ Not available at Lidl</Text>
                                  }
                                  {item.note ? <Text style={[styles.adaptNote, { color: colors.text3 }]}>{item.note}</Text> : null}
                                </View>
                                <View style={[styles.adaptDot, { backgroundColor: item.lidlProduct ? colors.lime : colors.surface2 }]} />
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Save to My Recipes */}
                      <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: state.savedOk ? colors.surface3 : colors.lime, opacity: state.saving ? 0.7 : 1 }]}
                        onPress={() => handleSaveImported(idx)}
                        disabled={state.saving || state.savedOk}
                      >
                        {state.saving
                          ? <ActivityIndicator color={colors.background} size="small" />
                          : <Text style={[styles.saveBtnText, { color: state.savedOk ? colors.lime : colors.background }]}>
                              {state.savedOk
                                ? `✓ Saved${state.adaptedIngredients ? ' with Lidl products' : ''}`
                                : `Save to My Recipes${state.adaptedIngredients ? ' (with Lidl)' : ''}`}
                            </Text>
                        }
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Today's plan meals ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.text3 }]}>
            {TODAY}&apos;s Meals
          </Text>

          {planLoading && (
            <View style={styles.planLoadingRow}>
              <ActivityIndicator color={colors.lime} size="small" />
              <Text style={[styles.planLoadingText, { color: colors.text3 }]}>Loading plan…</Text>
            </View>
          )}

          {!planLoading && todayPlan?.meals.map((meal, idx) => {
            const open = expandedMeal === idx;
            const accent = mealAccentColors[idx % mealAccentColors.length];
            const mealType = MEAL_SLOTS[idx] ?? 'Meal';
            const hasLidl = meal.lidl_products_used.length > 0;
            const alreadySaved = isPlanMealSaved(meal.name);
            const isSaving = planMealSaving[idx] ?? false;

            return (
              <TouchableOpacity
                key={idx}
                style={[styles.mealRecipeCard, { backgroundColor: colors.surface, borderColor: open ? accent : colors.border }]}
                onPress={() => setExpandedMeal(open ? null : idx)}
                activeOpacity={0.85}
              >
                <View style={styles.mealRecipeHeader}>
                  <View style={[styles.mealTypePill, { backgroundColor: `${accent}22` }]}>
                    <Text style={[styles.mealTypePillText, { color: accent }]}>{mealType}</Text>
                  </View>
                  <Text style={[styles.mealRecipeName, { color: colors.text }]} numberOfLines={open ? undefined : 1}>
                    {meal.name}
                  </Text>
                  {/* Save button */}
                  <TouchableOpacity
                    style={[styles.mealSaveBtn, {
                      backgroundColor: alreadySaved ? colors.limeDim : colors.surface3,
                      borderColor: alreadySaved ? colors.lime : colors.border2,
                    }]}
                    onPress={e => { e.stopPropagation(); handleSavePlanMeal(idx); }}
                    disabled={isSaving || alreadySaved}
                  >
                    {isSaving
                      ? <ActivityIndicator color={colors.lime} size="small" />
                      : <Text style={[styles.mealSaveBtnText, { color: alreadySaved ? colors.lime : colors.text3 }]}>
                          {alreadySaved ? '✓' : '+'}
                        </Text>
                    }
                  </TouchableOpacity>
                  <Text style={[styles.chevron, { color: colors.text3 }]}>{open ? '▲' : '▼'}</Text>
                </View>

                <View style={styles.mealRecipeMeta}>
                  <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>{meal.calories} kcal</Text>
                  {hasLidl && (
                    <View style={[styles.lidlBadge, { backgroundColor: colors.limeDim, borderColor: 'rgba(181,242,61,0.2)' }]}>
                      <Text style={[styles.lidlBadgeText, { color: colors.lime }]}>Lidl</Text>
                    </View>
                  )}
                  {alreadySaved && (
                    <Text style={[styles.savedLabel, { color: colors.lime }]}>Saved</Text>
                  )}
                </View>

                {open && (
                  <>
                    <View style={styles.macroPills}>
                      {[
                        { label: 'P', val: `${meal.protein_g}g`, color: colors.lime },
                        { label: 'C', val: `${meal.carbs_g}g`, color: colors.blue },
                        { label: 'F', val: `${meal.fat_g}g`, color: colors.orange },
                      ].map(m => (
                        <View key={m.label} style={[styles.macroPill, { backgroundColor: colors.surface2 }]}>
                          <Text style={[styles.macroPillVal, { color: m.color }]}>{m.val}</Text>
                          <Text style={[styles.macroPillLabel, { color: colors.text3 }]}>{m.label}</Text>
                        </View>
                      ))}
                    </View>

                    {hasLidl && (
                      <>
                        <Text style={[styles.subheading, { color: colors.text3 }]}>FROM LIDL</Text>
                        {meal.lidl_products_used.map((p, i) => (
                          <View key={i} style={styles.ingredientRow}>
                            <View style={[styles.ingredientDot, { backgroundColor: colors.lime }]} />
                            <Text style={[styles.ingredientText, { color: colors.text2 }]}>{p}</Text>
                          </View>
                        ))}
                      </>
                    )}

                    {meal.ingredients.length > 0 ? (
                      <>
                        <Text style={[styles.subheading, { color: colors.text3, marginTop: hasLidl ? 14 : 0 }]}>INGREDIENTS</Text>
                        {meal.ingredients.map((ing, i) => (
                          <View key={i} style={styles.ingredientRow}>
                            <View style={[styles.ingredientDot, { backgroundColor: colors.surface3 }]} />
                            <Text style={[styles.ingredientText, { color: colors.text2 }]}>{ing}</Text>
                          </View>
                        ))}
                      </>
                    ) : (
                      <Text style={[styles.noIngredientsText, { color: colors.text3 }]}>No ingredient details available for this meal.</Text>
                    )}

                    {!alreadySaved && (
                      <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: colors.lime, opacity: isSaving ? 0.7 : 1, marginTop: 14 }]}
                        onPress={() => handleSavePlanMeal(idx)}
                        disabled={isSaving}
                      >
                        {isSaving
                          ? <ActivityIndicator color={colors.background} size="small" />
                          : <Text style={[styles.saveBtnText, { color: colors.background }]}>Save to My Recipes</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13 },
  importCard: { marginHorizontal: 24, marginBottom: 20, borderWidth: 1, borderRadius: 18, padding: 16 },
  importHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  importIcon: { fontSize: 22 },
  importHeaderText: { flex: 1 },
  importTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  importDesc: { fontSize: 12 },
  shareHint: { marginTop: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  shareStep: { fontSize: 13, lineHeight: 19 },
  importError: { fontSize: 12, marginTop: 8 },
  section: { paddingHorizontal: 24, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.12, textTransform: 'uppercase' },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  emptyText: { fontSize: 13, lineHeight: 18 },
  recipeCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 10 },
  recipeCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  recipeCardLeft: { flex: 1 },
  recipeName: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  recipeMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  recipeMetaText: { fontSize: 12 },
  chevron: { fontSize: 11, paddingTop: 2 },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 12, fontWeight: '700' },
  macroPills: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 },
  macroPill: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', minWidth: 56 },
  macroPillVal: { fontSize: 14, fontWeight: '700' },
  macroPillLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.1, marginTop: 1 },
  subheading: { fontSize: 9, letterSpacing: 0.14, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  ingredientDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  ingredientText: { flex: 1, fontSize: 13, lineHeight: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18 },
  // Add to plan
  addToPlanBox: { marginTop: 18, borderWidth: 1, borderRadius: 14, padding: 14 },
  dayChipsScroll: { marginBottom: 10 },
  dayChips: { flexDirection: 'row', gap: 8 },
  dayChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  dayChipText: { fontSize: 12, fontWeight: '600' },
  slotRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  slotChip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  slotChipText: { fontSize: 12, fontWeight: '600' },
  addBtn: { borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  addBtnText: { fontSize: 14, fontWeight: '700' },
  // Adapt with Lidl
  adaptSection: { marginTop: 14 },
  adaptBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  adaptBtnIcon: { fontSize: 16 },
  adaptBtnText: { fontSize: 14, fontWeight: '600' },
  adaptResults: { marginTop: 10, borderWidth: 1, borderRadius: 14, padding: 14 },
  adaptRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  adaptRowLeft: { flex: 1 },
  adaptOriginal: { fontSize: 12, marginBottom: 2 },
  adaptProduct: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  adaptNote: { fontSize: 11, fontStyle: 'italic' },
  adaptDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  // Save button
  saveBtn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  saveBtnText: { fontSize: 14, fontWeight: '700' },
  // Plan meals
  mealRecipeCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 10 },
  mealRecipeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  mealTypePill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8, flexShrink: 0 },
  mealTypePillText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  mealRecipeName: { flex: 1, fontSize: 15, fontWeight: '600' },
  mealSaveBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mealSaveBtnText: { fontSize: 14, fontWeight: '700' },
  mealRecipeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  lidlBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  lidlBadgeText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  savedLabel: { fontSize: 10, fontWeight: '600' },
  noIngredientsText: { fontSize: 13, fontStyle: 'italic', marginTop: 12, marginBottom: 4 },
  planLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  planLoadingText: { fontSize: 14 },
});
