import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Meal } from '@/services/api';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const MACRO_MAX = { protein: 160, carbs: 250, fat: 80 };
const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });

export default function TodayScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading, error, loggedMeals, logMeal, getEatenCalories, getEatenMacros } = useMenu();

  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  const todayPlan = plan?.days.find(d => d.day === TODAY) ?? plan?.days[0] ?? null;
  const todayLogged = loggedMeals[TODAY] ?? new Set<number>();

  const totalCalories = todayPlan?.total_calories ?? 2000;
  const eatenCalories = getEatenCalories(TODAY);
  const eatenMacros = getEatenMacros(TODAY);
  const remainingCalories = totalCalories - eatenCalories;
  const progress = totalCalories > 0 ? eatenCalories / totalCalories : 0;

  const mealColorMap = [colors.orange, colors.lime, colors.blue, colors.orange];

  const macros = [
    { label: 'PROTEIN', goalG: todayPlan?.protein_g ?? 0, eatenG: eatenMacros.protein_g, max: MACRO_MAX.protein, color: colors.lime },
    { label: 'CARBS',   goalG: todayPlan?.carbs_g ?? 0,   eatenG: eatenMacros.carbs_g,   max: MACRO_MAX.carbs,   color: colors.blue },
    { label: 'FAT',     goalG: todayPlan?.fat_g ?? 0,      eatenG: eatenMacros.fat_g,      max: MACRO_MAX.fat,     color: colors.orange },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.text3 }]}>Good morning 👊</Text>
          <Text style={[styles.dayTitle, { color: colors.text }]}>{TODAY}</Text>
        </View>

        {/* Calorie ring */}
        <View style={styles.ringSection}>
          <View style={styles.ringWrapper}>
            <Svg width={220} height={220} style={styles.ring}>
              <Circle cx={110} cy={110} r={96} stroke={colors.surface3} strokeWidth={14} fill="none" />
              <Circle
                cx={110} cy={110} r={96}
                stroke={colors.lime} strokeWidth={14} fill="none"
                strokeDasharray={`${2 * Math.PI * 96}`}
                strokeDashoffset={`${2 * Math.PI * 96 * (1 - progress)}`}
                strokeLinecap="round"
                transform="rotate(-90 110 110)"
              />
            </Svg>
            <View style={styles.ringCenter}>
              {isLoading ? (
                <ActivityIndicator color={colors.lime} size="large" />
              ) : (
                <>
                  <Text style={[styles.ringValue, { color: colors.text }]}>{eatenCalories.toLocaleString()}</Text>
                  <Text style={[styles.ringSubText, { color: colors.text3 }]}>KCAL EATEN</Text>
                  <Text style={[styles.ringRemaining, { color: colors.lime }]}>
                    {remainingCalories.toLocaleString()} remaining
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Macro bars */}
        <View style={styles.macrosSection}>
          {macros.map((macro) => {
            const goalPct = Math.min(100, Math.round((macro.goalG / macro.max) * 100));
            const progressPct = Math.min(100, Math.round((macro.eatenG / macro.max) * 100));
            return (
              <View key={macro.label} style={styles.macroRow}>
                <View style={styles.macroRowTop}>
                  <Text style={[styles.macroLabel, { color: colors.text3 }]}>{macro.label}</Text>
                  <Text style={[styles.macroValue, { color: colors.text }]}>
                    {macro.eatenG > 0
                      ? `${macro.eatenG}g / ${macro.goalG}g`
                      : macro.goalG > 0 ? `${macro.goalG}g goal` : '—'}
                  </Text>
                </View>
                <View style={[styles.macroTrack, { backgroundColor: colors.surface3 }]}>
                  <View style={[styles.macroBar, { width: `${goalPct}%`, backgroundColor: macro.color, opacity: 0.2 }]} />
                  {progressPct > 0 && (
                    <View style={[styles.macroBar, styles.macroBarAbsolute, { width: `${progressPct}%`, backgroundColor: macro.color }]} />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Today's meals */}
        <View style={styles.planSection}>
          <Text style={[styles.planTitle, { color: colors.text3 }]}>Today&apos;s Plan</Text>

          {error && <Text style={[styles.errorText, { color: colors.orange }]}>{error}</Text>}

          {isLoading && (
            <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.lime} />
              <Text style={[styles.loadingText, { color: colors.text3 }]}>Generating your meal plan…</Text>
            </View>
          )}

          {!isLoading && todayPlan?.meals.map((meal, index) => {
            const isLogged = todayLogged.has(index);
            const dotColor = mealColorMap[index % mealColorMap.length];
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.82}
                style={[
                  styles.mealCard,
                  {
                    backgroundColor: isLogged ? colors.surface2 : colors.surface,
                    borderColor: isLogged ? colors.border : colors.lime,
                    borderWidth: isLogged ? 1 : 1.5,
                  },
                ]}
                onPress={() => setSelectedMeal(meal)}
              >
                <View style={styles.mealRowTop}>
                  <View style={[styles.mealDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.mealText, { color: isLogged ? colors.text2 : colors.text }]}>
                    {meal.name}
                  </Text>
                  <Text style={[styles.mealKcal, { color: colors.text3 }]}>{meal.calories} kcal</Text>
                  <TouchableOpacity
                    style={[styles.mealButton, { backgroundColor: isLogged ? colors.surface3 : colors.lime }]}
                    onPress={() => logMeal(TODAY, index)}
                  >
                    <Text style={[styles.mealButtonText, { color: isLogged ? colors.text2 : colors.background }]}>
                      {isLogged ? '✓ Logged' : 'Log'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Recipe detail modal */}
      <Modal
        visible={!!selectedMeal}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedMeal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {selectedMeal && <RecipeSheet meal={selectedMeal} colors={colors} onClose={() => setSelectedMeal(null)} />}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RecipeSheet({ meal, colors, onClose }: { meal: Meal; colors: any; onClose: () => void }) {
  const macroItems = [
    { label: 'Protein', value: `${meal.protein_g}g`, color: colors.lime },
    { label: 'Carbs',   value: `${meal.carbs_g}g`,   color: colors.blue },
    { label: 'Fat',     value: `${meal.fat_g}g`,      color: colors.orange },
    { label: 'Calories', value: `${meal.calories}`,   color: colors.text },
  ];

  return (
    <>
      {/* Handle */}
      <View style={styles.sheetHandle} />

      {/* Header */}
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{meal.name}</Text>
          <Text style={[styles.sheetKcal, { color: colors.lime }]}>{meal.calories} kcal</Text>
        </View>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.surface3 }]} onPress={onClose}>
          <Text style={[styles.closeBtnText, { color: colors.text2 }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
        {/* Macros */}
        <View style={[styles.macroStrip, { borderColor: colors.border }]}>
          {macroItems.map(m => (
            <View key={m.label} style={styles.macroStripItem}>
              <Text style={[styles.macroStripVal, { color: m.color }]}>{m.value}</Text>
              <Text style={[styles.macroStripLabel, { color: colors.text3 }]}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Ingredients */}
        {meal.ingredients.length > 0 && (
          <View style={styles.sheetSection}>
            <Text style={[styles.sheetSectionTitle, { color: colors.text3 }]}>INGREDIENTS</Text>
            {meal.ingredients.map((ing, i) => (
              <View key={i} style={[styles.ingredientRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.ingredientDot, { backgroundColor: colors.lime }]} />
                <Text style={[styles.ingredientText, { color: colors.text }]}>{ing}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Lidl products */}
        {meal.lidl_products_used.length > 0 && (
          <View style={styles.sheetSection}>
            <Text style={[styles.sheetSectionTitle, { color: colors.text3 }]}>LIDL PRODUCTS</Text>
            {meal.lidl_products_used.map((p, i) => (
              <View key={i} style={[styles.ingredientRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.ingredientDot, { backgroundColor: colors.lime }]} />
                <Text style={[styles.ingredientText, { color: colors.text }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 12 },
  greeting: { fontSize: 13, marginBottom: 4 },
  dayTitle: { fontSize: 34, fontWeight: '800' },
  ringSection: { alignItems: 'center', marginBottom: 18 },
  ringWrapper: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 40, fontWeight: '800' },
  ringSubText: { marginTop: 6, fontSize: 12, letterSpacing: 1.2 },
  ringRemaining: { marginTop: 10, fontSize: 14, fontWeight: '700' },
  macrosSection: { paddingHorizontal: 24, gap: 16 },
  macroRow: { gap: 8 },
  macroRowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel: { fontSize: 10, letterSpacing: 0.18, textTransform: 'uppercase' },
  macroValue: { fontSize: 12, fontWeight: '700' },
  macroTrack: { height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  macroBar: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 3 },
  macroBarAbsolute: { opacity: 1 },
  planSection: { paddingHorizontal: 24, paddingBottom: 100, marginTop: 18, gap: 12 },
  planTitle: { fontSize: 10, letterSpacing: 0.12, textTransform: 'uppercase', marginBottom: 8 },
  errorText: { fontSize: 13, textAlign: 'center', marginVertical: 8 },
  loadingCard: { borderRadius: 18, borderWidth: 1, paddingVertical: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  mealCard: { borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 },
  mealRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealDot: { width: 10, height: 10, borderRadius: 5 },
  mealText: { flex: 1, fontSize: 15, fontWeight: '600' },
  mealKcal: { fontSize: 12 },
  mealButton: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  mealButtonText: { fontSize: 12, fontWeight: '700' },
  // modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', paddingHorizontal: 24, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 12 },
  sheetTitle: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  sheetKcal: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  sheetScroll: { flex: 1 },
  macroStrip: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, marginBottom: 24, overflow: 'hidden' },
  macroStripItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  macroStripVal: { fontSize: 16, fontWeight: '700' },
  macroStripLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.1, marginTop: 2 },
  sheetSection: { marginBottom: 24 },
  sheetSectionTitle: { fontSize: 10, letterSpacing: 0.14, textTransform: 'uppercase', marginBottom: 12 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  ingredientDot: { width: 6, height: 6, borderRadius: 3 },
  ingredientText: { fontSize: 15 },
});
