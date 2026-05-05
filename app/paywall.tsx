import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaywallScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const [selectedPlan, setSelectedPlan] = useState('annual');

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly',
      price: '€9.99',
      period: '/month',
      description: 'Cancel anytime',
      popular: false,
    },
    {
      id: 'annual',
      name: 'Annual',
      price: '€49.99',
      period: '/year',
      description: 'Save 58% • Best value',
      popular: true,
    },
  ];

  const features = [
    '✅ Unlimited meal plans',
    '✅ Advanced nutrition tracking',
    '✅ Grocery price comparison',
    '✅ Recipe import from TikTok',
    '✅ Progress analytics (coming soon)',
    '✅ Priority support',
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Unlock Full Access</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>
            Get personalized meal plans and advanced tracking
          </Text>
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
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
              <Text style={[styles.planDesc, { color: colors.text2 }]}>{plan.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <Text style={[styles.featuresTitle, { color: colors.text }]}>Everything included:</Text>
          {features.map((feature, index) => (
            <Text key={index} style={[styles.featureItem, { color: colors.text2 }]}>
              {feature}
            </Text>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: colors.lime }]}>
            <Text style={[styles.ctaBtnText, { color: colors.background }]}>
              Start {selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Trial
            </Text>
          </TouchableOpacity>

          <Text style={[styles.ctaNote, { color: colors.text3 }]}>
            7-day free trial • Cancel anytime • No commitment
          </Text>
        </View>

        {/* Alternative */}
        <View style={styles.alternativeContainer}>
          <Link href="/(tabs)" asChild>
            <TouchableOpacity style={[styles.altBtn, { borderColor: colors.border }]}>
              <Text style={[styles.altBtnText, { color: colors.text2 }]}>Continue with limited features</Text>
            </TouchableOpacity>
          </Link>
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
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 32,
  },
  planCard: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
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
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 16,
    fontWeight: '400',
  },
  planDesc: {
    fontSize: 14,
    marginTop: 4,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureItem: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 24,
  },
  ctaContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ctaBtn: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  ctaNote: {
    fontSize: 14,
    textAlign: 'center',
  },
  alternativeContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  altBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  altBtnText: {
    fontSize: 14,
  },
});