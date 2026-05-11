import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAYS = [
  { key: 'Monday',    name: 'Mon' },
  { key: 'Tuesday',   name: 'Tue' },
  { key: 'Wednesday', name: 'Wed' },
  { key: 'Thursday',  name: 'Thu' },
  { key: 'Friday',    name: 'Fri' },
  { key: 'Saturday',  name: 'Sat' },
  { key: 'Sunday',    name: 'Sun' },
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });

export default function PlanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading, error, refresh } = useMenu();

  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [selectedMealIndex, setSelectedMealIndex] = useState<number | null>(null);

  const selectedDayPlan = plan?.days.find(d => d.day === selectedDay) ?? plan?.days[0] ?? null;

  const getMealTypeColor = (index: number) => {
    switch (index % 4) {
      case 0: return colors.orange;
      case 1: return colors.lime;
      case 2: return colors.blue;
      default: return '#c47fff';
    }
  };

  const getMealTypeBg = (index: number) => {
    switch (index % 4) {
      case 0: return colors.orangeDim;
      case 1: return colors.limeDim;
      case 2: return colors.blueDim;
      default: return 'rgba(180,100,255,0.12)';
    }
  };

  const barPercent = selectedDayPlan
    ? Math.min(100, Math.round((selectedDayPlan.total_calories / 2000) * 100))
    : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

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

        {/* Budget Strip */}
        <View style={[styles.budgetStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.budgetLeft}>
            <Text style={[styles.budgetSublabel, { color: colors.text3 }]}>Daily Budget</Text>
            <Text style={[styles.budgetAmount, { color: colors.lime }]}>
              {selectedDayPlan ? `${selectedDayPlan.total_calories.toLocaleString()} kcal` : '— kcal'}
            </Text>
          </View>
          <View style={styles.budgetMacros}>
            <View style={styles.macroPill}>
              <Text style={[styles.macroVal, { color: colors.lime }]}>
                {selectedDayPlan ? `${selectedDayPlan.protein_g}g` : '—'}
              </Text>
              <Text style={[styles.macroKey, { color: colors.text3 }]}>PRO</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={[styles.macroVal, { color: colors.blue }]}>
                {selectedDayPlan ? `${selectedDayPlan.carbs_g}g` : '—'}
              </Text>
              <Text style={[styles.macroKey, { color: colors.text3 }]}>CARB</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={[styles.macroVal, { color: colors.orange }]}>
                {selectedDayPlan ? `${selectedDayPlan.fat_g}g` : '—'}
              </Text>
              <Text style={[styles.macroKey, { color: colors.text3 }]}>FAT</Text>
            </View>
          </View>
        </View>

        {/* Day Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayScroll}
          contentContainerStyle={styles.dayScrollContent}
        >
          {DAYS.map((day) => {
            const isActive = selectedDay === day.key;
            return (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isActive && { borderColor: colors.lime, backgroundColor: colors.limeDim },
                ]}
                onPress={() => { setSelectedDay(day.key); setSelectedMealIndex(null); }}
              >
                <Text style={[styles.dayChipLabel, { color: colors.text3 }]}>{day.name}</Text>
                <Text style={[styles.dayChipName, { color: isActive ? colors.lime : colors.text2 }]}>
                  {day.key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Day Summary */}
        <View style={[styles.daySummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.daySummaryLeft}>
            <Text style={[styles.dsLabel, { color: colors.text3 }]}>Day Total</Text>
            <Text style={[styles.dsVal, { color: colors.text }]}>
              <Text style={{ color: colors.lime }}>
                {selectedDayPlan ? selectedDayPlan.total_calories.toLocaleString() : '—'}
              </Text>
              {' kcal'}
            </Text>
          </View>
          <View style={styles.dsBarWrap}>
            <View style={styles.dsBarLabel}>
              <Text style={[styles.dsBarText, { color: colors.text3 }]}>Progress</Text>
              <Text style={[styles.dsBarText, { color: colors.text3 }]}>{barPercent}%</Text>
            </View>
            <View style={[styles.dsBarTrack, { backgroundColor: colors.surface3 }]}>
              <View
                style={[
                  styles.dsBarFill,
                  { backgroundColor: colors.lime, width: `${barPercent}%` } as ViewStyle,
                ]}
              />
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

          {error && (
            <Text style={[styles.errorText, { color: colors.orange }]}>{error}</Text>
          )}

          {!isLoading && selectedDayPlan?.meals.map((meal, index) => {
            const isSelected = selectedMealIndex === index;
            const mealType = MEAL_TYPES[index] ?? 'Meal';
            const isLidl = meal.lidl_products_used.length > 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.mealCard,
                  {
                    backgroundColor: isSelected ? colors.surface2 : colors.surface,
                    borderColor: isSelected ? colors.lime : colors.border,
                    shadowColor: isSelected ? colors.lime : '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isSelected ? 0.18 : 0.05,
                    shadowRadius: isSelected ? 18 : 6,
                    elevation: isSelected ? 8 : 1,
                  },
                ]}
                onPress={() => setSelectedMealIndex(isSelected ? null : index)}
              >
                <View style={styles.mealCardHeader}>
                  <Text style={[
                    styles.mealTypeBadge,
                    { backgroundColor: getMealTypeBg(index), color: getMealTypeColor(index) },
                  ]}>
                    {mealType}
                  </Text>
                  <Text style={[styles.mealKcal, { color: colors.text3 }]}>
                    <Text style={{ color: colors.text2 }}>{meal.calories}</Text> kcal
                  </Text>
                </View>

                <Text style={[styles.mealName, { color: colors.text }]}>{meal.name}</Text>

                <View style={styles.mealSource}>
                  {isLidl && (
                    <View style={[styles.lidlTag, { backgroundColor: colors.limeDim2, borderColor: 'rgba(181,242,61,0.2)' }]}>
                      <Text style={[styles.lidlTagText, { color: colors.lime }]}>Lidl</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.mealMacrosRow, { borderTopColor: colors.border }]}>
                  {[
                    { val: `${meal.protein_g}g`, label: 'Protein', color: colors.lime },
                    { val: `${meal.carbs_g}g`, label: 'Carbs', color: colors.blue },
                    { val: `${meal.fat_g}g`, label: 'Fat', color: colors.orange },
                    { val: `${meal.calories}`, label: 'kcal', color: colors.text },
                  ].map((m, i, arr) => (
                    <View
                      key={i}
                      style={[
                        styles.macroBlock,
                        { borderColor: colors.border },
                        i === arr.length - 1 && styles.macroBlockLast,
                      ]}
                    >
                      <Text style={[styles.macroBlockVal, { color: m.color }]}>{m.val}</Text>
                      <Text style={[styles.macroBlockLabel, { color: colors.text3 }]}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                {isSelected && (
                  <View style={styles.selectedActions}>
                    {[
                      { icon: '🔒', label: 'Lock', color: colors.lime },
                      { icon: '✏️', label: 'Edit', color: colors.orange },
                      { icon: '🔁', label: 'Swap', color: colors.blue },
                      { icon: '✅', label: 'Log', color: colors.lime },
                    ].map((action) => (
                      <TouchableOpacity
                        key={action.label}
                        style={[styles.actionButton, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.actionIcon, { color: action.color }]}>{action.icon}</Text>
                        <Text style={[styles.actionText, { color: colors.text3 }]}>{action.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={[styles.logBtn, { backgroundColor: colors.lime }]}>
                  <Text style={[styles.logBtnText, { color: colors.background }]}>
                    {isSelected ? '✓ Log this meal' : 'Log Meal'}
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
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginTop: 4,
  },
  regenIcon: { fontSize: 14 },
  regenText: { fontSize: 12, fontWeight: '500' },
  budgetStrip: {
    marginHorizontal: 24, marginTop: 16, borderWidth: 1, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  budgetLeft: { flexDirection: 'column' },
  budgetSublabel: { fontSize: 10, letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 2 },
  budgetAmount: { fontSize: 22, fontWeight: '600' },
  budgetMacros: { flexDirection: 'row', gap: 12 },
  macroPill: { alignItems: 'center', gap: 1 },
  macroVal: { fontSize: 13, fontWeight: '500' },
  macroKey: { fontSize: 9, letterSpacing: 0.08, textTransform: 'uppercase' },
  dayScroll: { marginTop: 16, paddingHorizontal: 24 },
  dayScrollContent: { gap: 8, paddingRight: 24 },
  dayChip: {
    alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, minWidth: 80,
  },
  dayChipLabel: { fontSize: 10, letterSpacing: 0.08, textTransform: 'uppercase' },
  dayChipName: { fontSize: 14, fontWeight: '600' },
  daySummary: {
    marginHorizontal: 24, marginTop: 14, borderWidth: 1, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  daySummaryLeft: { alignItems: 'center' },
  dsLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.1 },
  dsVal: { fontSize: 20 },
  dsBarWrap: { flex: 1, marginHorizontal: 16 },
  dsBarLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dsBarText: { fontSize: 10 },
  dsBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  dsBarFill: { height: '100%', borderRadius: 3 },
  mealsSection: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 100, gap: 12 },
  loadingCard: {
    borderRadius: 16, borderWidth: 1, paddingVertical: 20, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 13, textAlign: 'center', marginVertical: 8 },
  mealCard: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  mealCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 14, paddingHorizontal: 16, paddingBottom: 10,
  },
  mealTypeBadge: {
    fontSize: 9, letterSpacing: 0.12, textTransform: 'uppercase',
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, fontWeight: '500',
  },
  mealKcal: { fontSize: 12 },
  mealName: { fontSize: 17, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 6 },
  mealSource: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  lidlTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  lidlTagText: { fontSize: 10, fontWeight: '500' },
  mealMacrosRow: { flexDirection: 'row', borderTopWidth: 1, marginTop: 4 },
  macroBlock: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRightWidth: 1 },
  macroBlockLast: { borderRightWidth: 0 },
  macroBlockVal: { fontSize: 13, fontWeight: '700' },
  macroBlockLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.08 },
  selectedActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, justifyContent: 'space-between',
  },
  actionButton: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', minWidth: 70 },
  actionIcon: { fontSize: 18, marginBottom: 4 },
  actionText: { fontSize: 11, fontWeight: '600' },
  logBtn: { marginVertical: 10, marginHorizontal: 16, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  logBtnText: { fontSize: 14, fontWeight: '600' },
});
