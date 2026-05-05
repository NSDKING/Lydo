import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProgressScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Progress</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>Track your fitness journey</Text>
        </View>

        {/* Coming Soon */}
        <View style={styles.comingSoon}>
          <Text style={[styles.comingSoonIcon, { color: colors.text3 }]}>📊</Text>
          <Text style={[styles.comingSoonTitle, { color: colors.text }]}>Coming Soon</Text>
          <Text style={[styles.comingSoonText, { color: colors.text3 }]}>
            Progress tracking, weight logs, and detailed analytics are coming in v2.
          </Text>
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  comingSoon: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  comingSoonIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});