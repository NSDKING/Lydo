import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Calorie Counter',
      subtitle: 'Track your nutrition and reach your goals',
      description: 'Get personalized meal plans, track calories, and achieve your fitness goals with smart nutrition guidance.',
    },
    {
      title: 'Set Your Goals',
      subtitle: 'What do you want to achieve?',
      goals: [
        { id: 'lose', label: 'Lose Weight', icon: '📉' },
        { id: 'maintain', label: 'Maintain Weight', icon: '⚖️' },
        { id: 'gain', label: 'Gain Muscle', icon: '💪' },
      ],
    },
    {
      title: 'Choose Your Plan',
      subtitle: 'Start your 7-day free trial',
      plans: [
        { id: 'monthly', name: 'Monthly', price: '€9.99', period: '/month', popular: false },
        { id: 'annual', name: 'Annual', price: '€49.99', period: '/year', popular: true, savings: 'Save 58%' },
      ],
    },
  ];

  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
            <Text style={[styles.stepSubtitle, { color: colors.lime }]}>{step.subtitle}</Text>
            <Text style={[styles.stepDescription, { color: colors.text2 }]}>{step.description}</Text>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
            <Text style={[styles.stepSubtitle, { color: colors.lime }]}>{step.subtitle}</Text>
            <View style={styles.goalsGrid}>
              {step.goals?.map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={[
                    styles.goalPill,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selectedGoal === goal.id ? colors.lime : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedGoal(goal.id)}
                >
                  <Text style={styles.goalIcon}>{goal.icon}</Text>
                  <Text style={[
                    styles.goalLabel,
                    { color: selectedGoal === goal.id ? colors.lime : colors.text2 }
                  ]}>
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
            <Text style={[styles.stepSubtitle, { color: colors.lime }]}>{step.subtitle}</Text>
            <View style={styles.plansContainer}>
              {step.plans?.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selectedPlan === plan.id ? colors.lime : colors.border,
                      borderWidth: selectedPlan === plan.id ? 2 : 1,
                    }
                  ]}
                  onPress={() => setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <View style={[styles.popularBadge, { backgroundColor: colors.lime }]}>
                      <Text style={[styles.popularText, { color: colors.background }]}>Most Popular</Text>
                    </View>
                  )}
                  <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                  <Text style={[styles.planPrice, { color: colors.lime }]}>
                    {plan.price}
                    <Text style={[styles.planPeriod, { color: colors.text3 }]}>{plan.period}</Text>
                  </Text>
                  {plan.savings && (
                    <Text style={[styles.planSavings, { color: colors.lime }]}>{plan.savings}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index <= currentStep ? colors.lime : colors.surface3,
                }
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep > 0 && (
          <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border }]} onPress={prevStep}>
            <Text style={[styles.navBtnText, { color: colors.text2 }]}>Back</Text>
          </TouchableOpacity>
        )}

        {currentStep < steps.length - 1 ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.primaryBtn, { backgroundColor: colors.lime }]}
            onPress={nextStep}
            disabled={currentStep === 1 && !selectedGoal}
          >
            <Text style={[styles.navBtnText, { color: colors.background }]}>
              {currentStep === 1 && !selectedGoal ? 'Select Goal' : 'Continue'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Link href="/(tabs)" asChild>
            <TouchableOpacity style={[styles.navBtn, styles.primaryBtn, { backgroundColor: colors.lime }]}>
              <Text style={[styles.navBtnText, { color: colors.background }]}>Get Started</Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContent: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 140,
  },
  goalIcon: {
    fontSize: 20,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  plansContainer: {
    width: '100%',
    gap: 16,
    marginTop: 20,
  },
  planCard: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '600',
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: '400',
  },
  planSavings: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  navBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtn: {
    borderWidth: 0,
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});