import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface GroceryItem {
  id: string;
  name: string;
  isLidl: boolean;
}

export default function ShopScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading } = useMenu();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const { lidlItems, otherItems } = useMemo(() => {
    if (!plan) return { lidlItems: [] as GroceryItem[], otherItems: [] as GroceryItem[] };

    const lidlSeen = new Set<string>();
    const otherSeen = new Set<string>();
    const lidl: GroceryItem[] = [];
    const other: GroceryItem[] = [];

    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const product of meal.lidl_products_used) {
          const key = product.toLowerCase().trim();
          if (!lidlSeen.has(key)) {
            lidlSeen.add(key);
            lidl.push({ id: `lidl-${key}`, name: product, isLidl: true });
          }
        }
        for (const ingredient of meal.ingredients) {
          // strip quantity prefix (e.g. "200g ") to dedup better
          const stripped = ingredient.replace(/^\d+[gmlkgL\s]+/i, '').trim();
          const key = stripped.toLowerCase();
          // skip if already covered by a Lidl product
          const alreadyLidl = [...lidlSeen].some(l => l.includes(key) || key.includes(l));
          if (!alreadyLidl && !otherSeen.has(key)) {
            otherSeen.add(key);
            other.push({ id: `other-${key}`, name: ingredient, isLidl: false });
          }
        }
      }
    }
    return { lidlItems: lidl, otherItems: other };
  }, [plan]);

  const allItems = [...lidlItems, ...otherItems];
  const unchecked = allItems.filter(i => !checkedItems.has(i.id)).length;

  const renderItem = (item: GroceryItem) => {
    const checked = checkedItems.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemRow, { backgroundColor: colors.surface, opacity: checked ? 0.45 : 1 }]}
        onPress={() => toggleCheck(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkBox, { borderColor: checked ? colors.lime : colors.border2 }]}>
          {checked && <Text style={[styles.checkMark, { color: colors.lime }]}>✓</Text>}
        </View>
        <Text style={[styles.itemName, { color: colors.text, textDecorationLine: checked ? 'line-through' : 'none' }]} numberOfLines={2}>
          {item.name}
        </Text>
        {item.isLidl && (
          <View style={[styles.lidlBadge, { backgroundColor: colors.limeDim, borderColor: 'rgba(181,242,61,0.2)' }]}>
            <Text style={[styles.lidlBadgeText, { color: colors.lime }]}>Lidl</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Shopping List</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>
            {plan ? `${unchecked} items left` : 'This week\'s groceries'}
          </Text>
        </View>

        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.lime} />
            <Text style={[styles.loadingText, { color: colors.text3 }]}>Building your list…</Text>
          </View>
        )}

        {!isLoading && plan && (
          <>
            {/* Lidl promo banner */}
            {lidlItems.length > 0 && (
              <View style={[styles.promoBanner, { backgroundColor: colors.limeDim, borderColor: 'rgba(181,242,61,0.3)' }]}>
                <Text style={[styles.promoText, { color: colors.lime }]}>
                  💚 <Text style={{ color: colors.text2, fontWeight: '400' }}>
                    {lidlItems.length} items available at Lidl this week
                  </Text>
                </Text>
              </View>
            )}

            {/* Lidl products */}
            {lidlItems.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.text3 }]}>🛒 Lidl Promotions</Text>
                <View style={styles.itemsList}>{lidlItems.map(renderItem)}</View>
              </View>
            )}

            {/* Other ingredients */}
            {otherItems.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.text3 }]}>🧺 Other Ingredients</Text>
                <View style={styles.itemsList}>{otherItems.map(renderItem)}</View>
              </View>
            )}

            {/* Summary row */}
            <View style={[styles.summaryRow, { backgroundColor: colors.surface2, borderColor: colors.border2 }]}>
              <Text style={[styles.summaryLabel, { color: colors.text2 }]}>
                {checkedItems.size} / {allItems.length} checked
              </Text>
              {checkedItems.size > 0 && (
                <TouchableOpacity onPress={() => setCheckedItems(new Set())}>
                  <Text style={[styles.clearText, { color: colors.text3 }]}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.actionBtnText, { color: colors.text2 }]}>Share List</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.lime }]}>
                <Text style={[styles.actionBtnText, { color: colors.background }]}>Order Online</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {!isLoading && !plan && (
          <Text style={[styles.emptyText, { color: colors.text3 }]}>
            Generate a meal plan to see your shopping list.
          </Text>
        )}
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
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 20 },
  loadingText: { fontSize: 14 },
  promoBanner: { marginHorizontal: 24, marginBottom: 16, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  promoText: { fontSize: 12, fontWeight: '500' },
  section: { marginBottom: 16 },
  sectionLabel: { paddingHorizontal: 24, paddingBottom: 8, fontSize: 10, letterSpacing: 0.12, textTransform: 'uppercase' },
  itemsList: { paddingHorizontal: 24, gap: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, gap: 12 },
  checkBox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { fontSize: 10, fontWeight: '700' },
  itemName: { flex: 1, fontSize: 14 },
  lidlBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7, flexShrink: 0 },
  lidlBadgeText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  summaryRow: { marginHorizontal: 24, marginBottom: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13 },
  clearText: { fontSize: 12 },
  actionButtons: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 100 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 14, paddingHorizontal: 24, paddingTop: 40 },
});
