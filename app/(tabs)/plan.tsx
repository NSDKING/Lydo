import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PlanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const [selectedDay, setSelectedDay] = useState('Mon');
  const [selectedMealIndex, setSelectedMealIndex] = useState<number | null>(null);

  const days = [
    { key: 'Mon', name: 'Mon', full: 'Monday' },
    { key: 'Tue', name: 'Tue', full: 'Tuesday' },
    { key: 'Wed', name: 'Wed', full: 'Wednesday' },
    { key: 'Thu', name: 'Thu', full: 'Thursday' },
    { key: 'Fri', name: 'Fri', full: 'Friday' },
    { key: 'Sat', name: 'Sat', full: 'Saturday' },
    { key: 'Sun', name: 'Sun', full: 'Sunday' },
  ];

  const dayData = {
    'Mon': { kcal: '1,990', cost: '€4.20', bar: '74%' },
    'Tue': { kcal: '2,010', cost: '€4.50', bar: '76%' },
    'Wed': { kcal: '1,950', cost: '€3.90', bar: '72%' },
    'Thu': { kcal: '1,980', cost: '€4.10', bar: '75%' },
    'Fri': { kcal: '2,020', cost: '€4.60', bar: '77%' },
    'Sat': { kcal: '2,100', cost: '€4.80', bar: '80%' },
    'Sun': { kcal: '1,950', cost: '€4.00', bar: '73%' },
  };

  const meals = [
    {
      type: 'Breakfast',
      name: 'Greek Yogurt Parfait',
      calories: 320,
      source: 'Lidl',
      price: '€2.40',
      macros: { protein: '25g', carbs: '35g', fat: '8g' },
      ingredients: [
        { name: 'Greek Yogurt', price: '€1.20' },
        { name: 'Mixed Berries', price: '€0.80' },
        { name: 'Granola', price: '€0.40' },
      ]
    },
    {
      type: 'Lunch',
      name: 'Chicken Caesar Salad',
      calories: 485,
      source: 'Home',
      price: '€3.20',
      macros: { protein: '42g', carbs: '25g', fat: '22g' },
      ingredients: [
        { name: 'Grilled Chicken Breast', price: '€2.50' },
        { name: 'Romaine Lettuce', price: '€0.30' },
        { name: 'Caesar Dressing', price: '€0.40' },
      ]
    },
    {
      type: 'Dinner',
      name: 'Salmon with Quinoa',
      calories: 620,
      source: 'Lidl',
      price: '€4.80',
      macros: { protein: '45g', carbs: '45g', fat: '28g' },
      ingredients: [
        { name: 'Atlantic Salmon', price: '€3.50' },
        { name: 'Quinoa', price: '€0.80' },
        { name: 'Broccoli', price: '€0.50' },
      ]
    },
    {
      type: 'Snack',
      name: 'Protein Shake',
      calories: 180,
      source: 'Home',
      price: '€1.50',
      macros: { protein: '25g', carbs: '8g', fat: '3g' },
      ingredients: [
        { name: 'Whey Protein', price: '€1.20' },
        { name: 'Almond Milk', price: '€0.30' },
      ]
    },
  ];

  const getMealTypeColor = (type: string) => {
    switch (type) {
      case 'Breakfast': return colors.orange;
      case 'Lunch': return colors.lime;
      case 'Dinner': return colors.blue;
      case 'Snack': return '#c47fff';
      default: return colors.text3;
    }
  };

  const getMealTypeBg = (type: string) => {
    switch (type) {
      case 'Breakfast': return colors.orangeDim;
      case 'Lunch': return colors.limeDim;
      case 'Dinner': return colors.blueDim;
      case 'Snack': return 'rgba(180,100,255,0.12)';
      default: return colors.surface;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.weekLabel, { color: colors.lime }]}>WEEK 12</Text>
              <Text style={[styles.title, { color: colors.text }]}>Meal Plan</Text>
            </View>
            <TouchableOpacity style={[styles.regenBtn, { borderColor: colors.border2, backgroundColor: colors.surface2 }]}>
              <Text style={[styles.regenIcon, { color: colors.text2 }]}>⟳</Text>
              <Text style={[styles.regenText, { color: colors.text2 }]}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Budget Strip */}
        <View style={[styles.budgetStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.budgetLeft}>
            <Text style={[styles.budgetSublabel, { color: colors.text3 }]}>Daily Budget</Text>
            <Text style={[styles.budgetAmount, { color: colors.lime }]}>2,000 kcal</Text>
            <Text style={[styles.budgetTotal, { color: colors.text3 }]}>€4.50 total</Text>
          </View>
          <View style={styles.budgetMacros}>
            <View style={styles.macroPill}>
              <Text style={[styles.macroVal, { color: colors.lime }]}>125g</Text>
              <Text style={[styles.macroKey, { color: colors.text3 }]}>PRO</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={[styles.macroVal, { color: colors.blue }]}>200g</Text>
              <Text style={[styles.macroKey, { color: colors.text3 }]}>CARB</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={[styles.macroVal, { color: colors.orange }]}>67g</Text>
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
          {days.map((day) => (
            <TouchableOpacity
              key={day.key}
              style={[
                styles.dayChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  ...(selectedDay === day.key ? {
                    borderColor: colors.lime,
                    backgroundColor: colors.limeDim
                  } : {})
                }
              ]}
              onPress={() => setSelectedDay(day.key)}
            >
              <Text style={[styles.dayChipLabel, { color: colors.text3 }]}>{day.name}</Text>
              <Text style={[
                styles.dayChipName,
                { color: colors.text2 },
                selectedDay === day.key && { color: colors.lime }
              ]}>
                {day.full}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Day Summary */}
        <View style={[styles.daySummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.daySummaryLeft}>
            <Text style={[styles.dsLabel, { color: colors.text3 }]}>Day Total</Text>
            <Text style={[styles.dsVal, { color: colors.text }]}>
              <Text style={{ color: colors.lime }}>{dayData[selectedDay as keyof typeof dayData]?.kcal}</Text> kcal
            </Text>
          </View>
          <View style={styles.dsBarWrap}>
            <View style={styles.dsBarLabel}>
              <Text style={[styles.dsBarText, { color: colors.text3 }]}>Progress</Text>
              <Text style={[styles.dsBarText, { color: colors.text3 }]}>
                {dayData[selectedDay as keyof typeof dayData]?.bar}
              </Text>
            </View>
            <View style={[styles.dsBarTrack, { backgroundColor: colors.surface3 }]}>
              <View
                style={[
                  styles.dsBarFill,
                  {
                    backgroundColor: colors.lime,
                    width: (dayData[selectedDay as keyof typeof dayData]?.bar ?? '0%') as number | string
                  } as ViewStyle
                ]}
              />
            </View>
          </View>
          <Text style={[styles.dsCost, { color: colors.text }]}>
            {dayData[selectedDay as keyof typeof dayData]?.cost}
          </Text>
        </View>

        {/* Meals */}
        <View style={styles.mealsSection}>
          {meals.map((meal, index) => {
            const isSelected = selectedMealIndex === index;
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
                  }
                ]}
                onPress={() => setSelectedMealIndex(isSelected ? null : index)}
              >
              <View style={styles.mealCardHeader}>
                <Text style={[styles.mealTypeBadge, { backgroundColor: getMealTypeBg(meal.type), color: getMealTypeColor(meal.type) }]}>
                  {meal.type}
                </Text>
                <Text style={[styles.mealKcal, { color: colors.text3 }]}>
                  <Text style={{ color: colors.text2 }}>{meal.calories}</Text> kcal
                </Text>
              </View>

              <Text style={[styles.mealName, { color: colors.text }]}>{meal.name}</Text>

              <View style={styles.mealSource}>
                {meal.source === 'Lidl' && (
                  <View style={[styles.lidlTag, { backgroundColor: colors.limeDim2, borderColor: 'rgba(181,242,61,0.2)' }]}>
                    <Text style={[styles.lidlTagText, { color: colors.lime }]}>Lidl</Text>
                  </View>
                )}
                <Text style={[styles.priceTag, { color: colors.text3 }]}>
                  <Text style={{ color: colors.text2 }}>{meal.price}</Text>
                </Text>
              </View>

              <View style={styles.mealMacrosRow}>
                <View style={[styles.macroBlock, { borderColor: colors.border }]}>
                  <Text style={[styles.macroBlockVal, { color: colors.lime }]}>{meal.macros.protein}</Text>
                  <Text style={[styles.macroBlockLabel, { color: colors.text3 }]}>Protein</Text>
                </View>
                <View style={[styles.macroBlock, { borderColor: colors.border }]}> 
                  <Text style={[styles.macroBlockVal, { color: colors.blue }]}>{meal.macros.carbs}</Text>
                  <Text style={[styles.macroBlockLabel, { color: colors.text3 }]}>Carbs</Text>
                </View>
                <View style={[styles.macroBlock, { borderColor: colors.border }]}> 
                  <Text style={[styles.macroBlockVal, { color: colors.orange }]}>{meal.macros.fat}</Text>
                  <Text style={[styles.macroBlockLabel, { color: colors.text3 }]}>Fat</Text>
                </View>
                <View style={[styles.macroBlock, styles.macroBlockLast]}> 
                  <Text style={[styles.macroBlockVal, { color: colors.text }]}>{meal.calories}</Text>
                  <Text style={[styles.macroBlockLabel, { color: colors.text3 }]}>kcal</Text>
                </View>
              </View>

              {isSelected && (
                <View style={styles.selectedActions}>
                  <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]}> 
                    <Text style={[styles.actionIcon, { color: colors.lime }]}>🔒</Text>
                    <Text style={[styles.actionText, { color: colors.text3 }]}>Lock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]}> 
                    <Text style={[styles.actionIcon, { color: colors.orange }]}>✏️</Text>
                    <Text style={[styles.actionText, { color: colors.text3 }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]}> 
                    <Text style={[styles.actionIcon, { color: colors.blue }]}>🔁</Text>
                    <Text style={[styles.actionText, { color: colors.text3 }]}>Swap</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]}> 
                    <Text style={[styles.actionIcon, { color: colors.lime }]}>✅</Text>
                    <Text style={[styles.actionText, { color: colors.text3 }]}>Log</Text>
                  </TouchableOpacity>
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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  weekLabel: {
    fontSize: 10,
    letterSpacing: 0.14,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  regenIcon: {
    fontSize: 14,
  },
  regenText: {
    fontSize: 12,
    fontWeight: '500',
  },
  budgetStrip: {
    marginHorizontal: 24,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetLeft: {
    flexDirection: 'column',
  },
  budgetSublabel: {
    fontSize: 10,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  budgetAmount: {
    fontSize: 22,
    fontWeight: '600',
  },
  budgetTotal: {
    fontSize: 12,
  },
  budgetMacros: {
    flexDirection: 'row',
    gap: 12,
  },
  macroPill: {
    alignItems: 'center',
    gap: 1,
  },
  macroVal: {
    fontSize: 13,
    fontWeight: '500',
  },
  macroKey: {
    fontSize: 9,
    letterSpacing: 0.08,
    textTransform: 'uppercase',
  },
  dayScroll: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  dayScrollContent: {
    gap: 8,
    paddingRight: 24,
  },
  dayChip: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  dayChipLabel: {
    fontSize: 10,
    letterSpacing: 0.08,
    textTransform: 'uppercase',
  },
  dayChipName: {
    fontSize: 14,
    fontWeight: '600',
  },
  daySummary: {
    marginHorizontal: 24,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daySummaryLeft: {
    alignItems: 'center',
  },
  dsLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
  },
  dsVal: {
    fontSize: 20,
  },
  dsBarWrap: {
    flex: 1,
    marginHorizontal: 16,
  },
  dsBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dsBarText: {
    fontSize: 10,
  },
  dsBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  dsBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  dsCost: {
    fontSize: 18,
    textAlign: 'right',
  },
  mealsSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 12,
  },
  mealCard: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  mealTypeBadge: {
    fontSize: 9,
    letterSpacing: 0.12,
    textTransform: 'uppercase',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    fontWeight: '500',
  },
  mealKcal: {
    fontSize: 12,
  },
  mealName: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  mealSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  lidlTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  lidlTagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  priceTag: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  mealMacrosRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 4,
  },
  macroBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
  },
  macroBlockLast: {
    borderRightWidth: 0,
  },
  macroBlockVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  macroBlockLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.08,
  },
  mealIngredients: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    gap: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ingredientName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ingredientLidlDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ingredientPrice: {
    fontSize: 11,
  },
  selectedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    justifyContent: 'space-between',
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 70,
  },
  actionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  logBtn: {
    marginVertical: 10,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
