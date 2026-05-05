import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

export default function TodayScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  const eatenCalories = 1284;
  const totalCalories = 2000;
  const remainingCalories = totalCalories - eatenCalories;
  const progress = eatenCalories / totalCalories;

  const macros = [
    { label: 'PROTEIN', value: '93g', width: '72%', color: colors.lime },
    { label: 'CARBS', value: '148g', width: '74%', color: colors.blue },
    { label: 'FAT', value: '38g', width: '42%', color: colors.orange },
  ];

  const meals = [
    { name: 'Greek Yogurt + Oats', calories: 342, status: 'logged', color: colors.orange },
    { name: 'Chicken Rice Bowl', calories: 612, status: 'logged', color: colors.lime },
    { name: 'Salmon + Sweet Potato', calories: 680, status: 'log', color: colors.blue },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.text3 }]}>Good morning, Alex 👊</Text>
          <Text style={[styles.dayTitle, { color: colors.text }]}>Monday</Text>
        </View>

        <View style={styles.ringSection}>
          <View style={styles.ringWrapper}>
            <Svg width={220} height={220} style={styles.ring}>
              <Circle
                cx={110}
                cy={110}
                r={96}
                stroke={colors.surface3}
                strokeWidth={14}
                fill="none"
              />
              <Circle
                cx={110}
                cy={110}
                r={96}
                stroke={colors.lime}
                strokeWidth={14}
                fill="none"
                strokeDasharray={`${2 * Math.PI * 96}`}
                strokeDashoffset={`${2 * Math.PI * 96 * (1 - progress)}`}
                strokeLinecap="round"
                transform="rotate(-90 110 110)"
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[styles.ringValue, { color: colors.text }]}>{eatenCalories.toLocaleString()}</Text>
              <Text style={[styles.ringSubText, { color: colors.text3 }]}>KCAL EATEN</Text>
              <Text style={[styles.ringRemaining, { color: colors.lime }]}>{remainingCalories} remaining</Text>
            </View>
          </View>
        </View>

        <View style={styles.macrosSection}>
          {macros.map((macro, index) => {
            const fillStyle = { width: macro.width, backgroundColor: macro.color } as ViewStyle;
            return (
              <View key={index} style={styles.macroRow}>
                <View style={styles.macroRowTop}>
                  <Text style={[styles.macroLabel, { color: colors.text3 }]}>{macro.label}</Text>
                  <Text style={[styles.macroValue, { color: colors.text }]}>{macro.value}</Text>
                </View>
                <View style={[styles.macroTrack, { backgroundColor: colors.surface3 }]}> 
                  <View style={[styles.macroFill, fillStyle]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.planSection}>
          <Text style={[styles.planTitle, { color: colors.text3 }]}>Today&apos;s Plan</Text>

          {meals.map((meal, index) => {
            const isLogged = meal.status === 'logged';
            return (
              <View
                key={index}
                style={[
                  styles.mealCard,
                  {
                    backgroundColor: isLogged ? colors.surface2 : colors.surface,
                    borderColor: isLogged ? colors.border : colors.lime,
                    borderWidth: isLogged ? 1 : 1.5,
                  }
                ]}
              >
                <View style={styles.mealRowTop}>
                  <View style={[styles.mealDot, { backgroundColor: meal.color }]} />
                  <Text style={[styles.mealText, { color: colors.text }]}>{meal.name}</Text>
                  <Text style={[styles.mealKcal, { color: colors.text3 }]}>{meal.calories} kcal</Text>
                  <TouchableOpacity
                    style={[
                      styles.mealButton,
                      {
                        backgroundColor: isLogged ? colors.surface3 : colors.lime,
                      }
                    ]}
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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 13,
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 34,
    fontWeight: '800',
  },
  ringSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  ringWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  ringSubText: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  ringRemaining: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  macrosSection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  macroRow: {
    gap: 8,
  },
  macroRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontSize: 10,
    letterSpacing: 0.18,
    textTransform: 'uppercase',
  },
  macroValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  macroTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 3,
  },
  planSection: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    marginTop: 18,
    gap: 12,
  },
  planTitle: {
    fontSize: 10,
    letterSpacing: 0.12,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  mealCard: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  mealRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mealText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  mealKcal: {
    fontSize: 12,
  },
  mealButton: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  mealButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
