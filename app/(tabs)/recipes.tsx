import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AdaptedIngredient, adaptRecipeWithLidl, analyzeTiktok, TiktokRecipe } from '@/services/api';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner'];
const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });

interface RecipeState {
  addDay: string | null;
  addSlot: number;
  added: boolean;
  adapting: boolean;
  adaptedIngredients: AdaptedIngredient[] | null;
  adaptError: string | null;
}

function defaultRecipeState(): RecipeState {
  return { addDay: null, addSlot: 0, added: false, adapting: false, adaptedIngredients: null, adaptError: null };
}

export default function RecipesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading: planLoading, addTiktokMeal } = useMenu();

  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedRecipes, setImportedRecipes] = useState<TiktokRecipe[]>([]);
  const [expandedRecipe, setExpandedRecipe] = useState<number | null>(null);
  const [recipeStates, setRecipeStates] = useState<RecipeState[]>([]);

  const planDays = plan?.days.map(d => d.day) ?? [];
  const todayPlan = plan?.days.find(d => d.day === TODAY) ?? plan?.days[0] ?? null;
  const mealAccentColors = [colors.orange, colors.lime, colors.blue, '#c47fff'];

  const updateRecipeState = (idx: number, patch: Partial<RecipeState>) => {
    setRecipeStates(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const handleImport = async () => {
    const url = tiktokUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportError(null);
    try {
      const recipe = await analyzeTiktok(url);
      setImportedRecipes(prev => [recipe, ...prev]);
      setRecipeStates(prev => [defaultRecipeState(), ...prev]);
      setTiktokUrl('');
      setExpandedRecipe(0);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleAddToDay = (recipeIdx: number) => {
    const state = recipeStates[recipeIdx];
    if (!state?.addDay) return;
    addTiktokMeal(state.addDay, state.addSlot, importedRecipes[recipeIdx]);
    updateRecipeState(recipeIdx, { added: true });
  };

  const handleAdapt = async (recipeIdx: number) => {
    const recipe = importedRecipes[recipeIdx];
    updateRecipeState(recipeIdx, { adapting: true, adaptError: null, adaptedIngredients: null });
    try {
      const result = await adaptRecipeWithLidl(recipe.title, recipe.ingredients);
      updateRecipeState(recipeIdx, { adapting: false, adaptedIngredients: result.adaptedIngredients });
    } catch (err) {
      updateRecipeState(recipeIdx, { adapting: false, adaptError: (err as Error).message });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Recipes</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>Your plan + saved imports</Text>
        </View>

        {/* TikTok import */}
        <View style={[styles.importCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.importHeader}>
            <Text style={styles.importIcon}>📱</Text>
            <View style={styles.importHeaderText}>
              <Text style={[styles.importTitle, { color: colors.text }]}>Import from TikTok</Text>
              <Text style={[styles.importDesc, { color: colors.text3 }]}>Paste a recipe video URL</Text>
            </View>
          </View>
          <View style={styles.importRow}>
            <TextInput
              style={[styles.urlInput, { backgroundColor: colors.surface2, borderColor: colors.border2, color: colors.text }]}
              placeholder="https://www.tiktok.com/@..."
              placeholderTextColor={colors.text3}
              value={tiktokUrl}
              onChangeText={setTiktokUrl}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!importing}
            />
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: importing ? colors.surface3 : colors.lime }]}
              onPress={handleImport}
              disabled={importing || !tiktokUrl.trim()}
            >
              {importing
                ? <ActivityIndicator color={colors.text3} size="small" />
                : <Text style={[styles.importBtnText, { color: colors.background }]}>Go</Text>
              }
            </TouchableOpacity>
          </View>
          {importError && (
            <Text style={[styles.importError, { color: colors.orange }]}>{importError}</Text>
          )}
        </View>

        {/* Imported recipes */}
        {importedRecipes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text3 }]}>Imported</Text>
            {importedRecipes.map((recipe, idx) => {
              const open = expandedRecipe === idx;
              const state = recipeStates[idx] ?? defaultRecipeState();

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
                      {/* Macro pills */}
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

                      {/* Ingredients */}
                      <Text style={[styles.subheading, { color: colors.text3 }]}>INGREDIENTS</Text>
                      {recipe.ingredients.map((ing, i) => (
                        <View key={i} style={styles.ingredientRow}>
                          <View style={[styles.ingredientDot, { backgroundColor: colors.lime }]} />
                          <Text style={[styles.ingredientText, { color: colors.text2 }]}>{ing}</Text>
                        </View>
                      ))}

                      {/* Steps */}
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

                      {/* ── Add to Plan ─────────────────────────────────── */}
                      <View style={[styles.addToPlanBox, { backgroundColor: colors.surface2, borderColor: colors.border2 }]}>
                        <Text style={[styles.subheading, { color: colors.text3, marginTop: 0, marginBottom: 10 }]}>ADD TO PLAN</Text>

                        {/* Day chips */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayChipsScroll}>
                          <View style={styles.dayChips}>
                            {planDays.map(day => {
                              const sel = state.addDay === day;
                              return (
                                <TouchableOpacity
                                  key={day}
                                  style={[styles.dayChip, { backgroundColor: sel ? colors.lime : colors.surface3, borderColor: sel ? colors.lime : colors.border2 }]}
                                  onPress={() => updateRecipeState(idx, { addDay: day, added: false })}
                                >
                                  <Text style={[styles.dayChipText, { color: sel ? colors.background : colors.text3 }]}>
                                    {day.slice(0, 3)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>

                        {/* Slot selector */}
                        <View style={styles.slotRow}>
                          {MEAL_SLOTS.map((slot, slotIdx) => {
                            const sel = state.addSlot === slotIdx;
                            return (
                              <TouchableOpacity
                                key={slot}
                                style={[styles.slotChip, { backgroundColor: sel ? colors.blue + '33' : colors.surface3, borderColor: sel ? colors.blue : colors.border2 }]}
                                onPress={() => updateRecipeState(idx, { addSlot: slotIdx, added: false })}
                              >
                                <Text style={[styles.slotChipText, { color: sel ? colors.blue : colors.text3 }]}>{slot}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Add button */}
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

                      {/* ── Adapt with Lidl ─────────────────────────────── */}
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
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Today's plan meals as recipes */}
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
                  <Text style={[styles.chevron, { color: colors.text3 }]}>{open ? '▲' : '▼'}</Text>
                </View>

                <View style={styles.mealRecipeMeta}>
                  <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>{meal.calories} kcal</Text>
                  {hasLidl && (
                    <View style={[styles.lidlBadge, { backgroundColor: colors.limeDim, borderColor: 'rgba(181,242,61,0.2)' }]}>
                      <Text style={[styles.lidlBadgeText, { color: colors.lime }]}>Lidl</Text>
                    </View>
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

                    <Text style={[styles.subheading, { color: colors.text3, marginTop: hasLidl ? 14 : 0 }]}>
                      INGREDIENTS
                    </Text>
                    {meal.ingredients.map((ing, i) => (
                      <View key={i} style={styles.ingredientRow}>
                        <View style={[styles.ingredientDot, { backgroundColor: colors.surface3 }]} />
                        <Text style={[styles.ingredientText, { color: colors.text2 }]}>{ing}</Text>
                      </View>
                    ))}
                  </>
                )}
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
  header: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13 },
  importCard: { marginHorizontal: 24, marginBottom: 20, borderWidth: 1, borderRadius: 18, padding: 16 },
  importHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  importIcon: { fontSize: 22 },
  importHeaderText: { flex: 1 },
  importTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  importDesc: { fontSize: 12 },
  importRow: { flexDirection: 'row', gap: 8 },
  urlInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 13 },
  importBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  importBtnText: { fontSize: 14, fontWeight: '700' },
  importError: { fontSize: 12, marginTop: 8 },
  section: { paddingHorizontal: 24, marginBottom: 8 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.12, textTransform: 'uppercase', marginBottom: 10 },
  recipeCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 10 },
  recipeCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recipeCardLeft: { flex: 1 },
  recipeName: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  recipeMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  recipeMetaText: { fontSize: 12 },
  chevron: { fontSize: 11, paddingTop: 2 },
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
  // Plan meals
  mealRecipeCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 10 },
  mealRecipeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  mealTypePill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8, flexShrink: 0 },
  mealTypePillText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  mealRecipeName: { flex: 1, fontSize: 15, fontWeight: '600' },
  mealRecipeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  lidlBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  lidlBadgeText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  planLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  planLoadingText: { fontSize: 14 },
});
