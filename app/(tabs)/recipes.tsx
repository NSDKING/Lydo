import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RecipesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  const recipes = [
    {
      name: 'Spicy Tuna Poke Bowl',
      description: 'Fresh tuna with spicy mayo, rice, and vegetables',
      calories: 485,
      time: '15 min',
      difficulty: 'Easy',
      tags: ['High Protein', 'Quick'],
    },
    {
      name: 'Overnight Oats',
      description: 'Creamy oats with berries and nuts',
      calories: 320,
      time: '5 min prep',
      difficulty: 'Easy',
      tags: ['Breakfast', 'Make Ahead'],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Recipes</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>Discover new meals and save favorites</Text>
        </View>

        {/* TikTok Import Card */}
        <TouchableOpacity style={[styles.tiktokCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.tiktokContent}>
            <Text style={[styles.tiktokIcon, { color: colors.text2 }]}>📱</Text>
            <View style={styles.tiktokText}>
              <Text style={[styles.tiktokTitle, { color: colors.text }]}>Import from TikTok</Text>
              <Text style={[styles.tiktokDesc, { color: colors.text3 }]}>
                Paste a recipe link to add it to your collection
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Saved Recipes Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.text3 }]}>Saved Recipes</Text>

          {recipes.map((recipe, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.recipeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.recipeHeader}>
                <Text style={[styles.recipeName, { color: colors.text }]}>{recipe.name}</Text>
                <Text style={[styles.recipeCalories, { color: colors.text3 }]}>
                  {recipe.calories} kcal
                </Text>
              </View>

              <Text style={[styles.recipeDesc, { color: colors.text2 }]}>{recipe.description}</Text>

              <View style={styles.recipeMeta}>
                <View style={styles.recipeMetaItem}>
                  <Text style={[styles.recipeMetaIcon, { color: colors.text3 }]}>⏱️</Text>
                  <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>{recipe.time}</Text>
                </View>
                <View style={styles.recipeMetaItem}>
                  <Text style={[styles.recipeMetaIcon, { color: colors.text3 }]}>📊</Text>
                  <Text style={[styles.recipeMetaText, { color: colors.text3 }]}>{recipe.difficulty}</Text>
                </View>
              </View>

              <View style={styles.recipeTags}>
                {recipe.tags.map((tag, tagIndex) => (
                  <View key={tagIndex} style={[styles.recipeTag, { backgroundColor: colors.surface3 }]}>
                    <Text style={[styles.recipeTagText, { color: colors.text2 }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Coming Soon */}
        <View style={styles.comingSoon}>
          <Text style={[styles.comingSoonText, { color: colors.text3 }]}>
            More recipes coming soon...
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
  tiktokCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    cursor: 'pointer',
  },
  tiktokContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tiktokIcon: {
    fontSize: 20,
  },
  tiktokText: {
    flex: 1,
  },
  tiktokTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  tiktokDesc: {
    fontSize: 12,
  },
  section: {
    paddingHorizontal: 24,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.12,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  recipeCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  recipeCalories: {
    fontSize: 12,
  },
  recipeDesc: {
    fontSize: 13,
    marginBottom: 10,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  recipeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeMetaIcon: {
    fontSize: 12,
  },
  recipeMetaText: {
    fontSize: 11,
  },
  recipeTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recipeTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  recipeTagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  comingSoon: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  comingSoonText: {
    fontSize: 13,
    textAlign: 'center',
  },
});