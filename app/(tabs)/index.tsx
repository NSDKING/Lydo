import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import {
  ActivityIndicator,
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

  const todayPlan = plan?.days.find(d => d.day === TODAY) ?? plan?.days[0] ?? null;
  const todayLogged = loggedMeals[TODAY] ?? new Set<number>();

  const totalCalories = todayPlan?.total_calories ?? 2000;
  const eatenCalories = getEatenCalories(TODAY);
  const eatenMacros = getEatenMacros(TODAY);
  const remainingCalories = totalCalories - eatenCalories;
  const progress = totalCalories > 0 ? eatenCalories / totalCalories : 0;

  const mealColorMap = [colors.orange, colors.lime, colors.blue, colors.orange];

  const macros = [
    {
      label: 'PROTEIN',
      goalG: todayPlan?.protein_g ?? 0,
      eatenG: eatenMacros.protein_g,
      max: MACRO_MAX.protein,
      color: colors.lime,
    },
    {
      label: 'CARBS',
      goalG: todayPlan?.carbs_g ?? 0,
      eatenG: eatenMacros.carbs_g,
      max: MACRO_MAX.carbs,
      color: colors.blue,
    },
    {
      label: 'FAT',
      goalG: todayPlan?.fat_g ?? 0,
      eatenG: eatenMacros.fat_g,
      max: MACRO_MAX.fat,
      color: colors.orange,
    },
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

        {/* Macro bars — goal (dim) + progress (vibrant) */}
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
                  {/* goal bar — dim */}
                  <View style={[styles.macroBar, { width: `${goalPct}%`, backgroundColor: macro.color, opacity: 0.2 }]} />
                  {/* progress bar — vibrant */}
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

          {error && (
            <Text style={[styles.errorText, { color: colors.orange }]}>{error}</Text>
          )}

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
              <View
                key={index}
                style={[
                  styles.mealCard,
                  {
                    backgroundColor: isLogged ? colors.surface2 : colors.surface,
                    borderColor: isLogged ? colors.border : colors.lime,
                    borderWidth: isLogged ? 1 : 1.5,
                  },
                ]}
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
              </View>
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
  loadingCard: {
    borderRadius: 18, borderWidth: 1, paddingVertical: 20, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  loadingText: { fontSize: 14 },
  mealCard: { borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 },
  mealRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealDot: { width: 10, height: 10, borderRadius: 5 },
  mealText: { flex: 1, fontSize: 15, fontWeight: '600' },
  mealKcal: { fontSize: 12 },
  mealButton: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  mealButtonText: { fontSize: 12, fontWeight: '700' },
});
