import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LidlPromoDetail, fetchLidlCatalog } from '@/services/api';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Aisle definitions ────────────────────────────────────────────────────────

const AISLES = [
  { label: 'Viandes & Poissons', icon: '🥩', keywords: ['poulet', 'chicken', 'boeuf', 'beef', 'porc', 'pork', 'saumon', 'salmon', 'thon', 'tuna', 'filet', 'steak', 'jambon', 'ham', 'lardons', 'dinde', 'cabillaud', 'crevette', 'shrimp', 'viande', 'meat', 'veau', 'agneau', 'lamb', 'merguez', 'chorizo'] },
  { label: 'Produits laitiers', icon: '🥛', keywords: ['fromage', 'cheese', 'yaourt', 'yogurt', 'lait', 'milk', 'beurre', 'butter', 'creme', 'cream', 'oeuf', 'egg', 'mozzarella', 'parmesan', 'emmental', 'ricotta', 'gruyere'] },
  { label: 'Fruits & Légumes', icon: '🥦', keywords: ['tomate', 'tomato', 'carotte', 'carrot', 'courgette', 'zucchini', 'salade', 'lettuce', 'epinard', 'spinach', 'pomme', 'apple', 'orange', 'banane', 'banana', 'oignon', 'onion', 'ail', 'garlic', 'poivron', 'avocat', 'avocado', 'concombre', 'cucumber', 'brocoli', 'broccoli', 'champignon', 'mushroom', 'celeri', 'poireau', 'leek', 'radis', 'navet', 'fruit', 'legume', 'vegetable'] },
  { label: 'Céréales & Féculents', icon: '🌾', keywords: ['riz', 'rice', 'pate', 'pasta', 'pain', 'bread', 'farine', 'flour', 'quinoa', 'avoine', 'oat', 'semoule', 'couscous', 'lentille', 'lentil', 'haricot', 'bean', 'potato', 'patate', 'cereale', 'cereal', 'ble', 'wheat', 'pois chiche', 'chickpea', 'boulgour', 'bulgur'] },
  { label: 'Huiles & Condiments', icon: '🫒', keywords: ['huile', 'oil', 'vinaigre', 'vinegar', 'moutarde', 'mustard', 'ketchup', 'sauce', 'sel', 'salt', 'poivre', 'pepper', 'epice', 'spice', 'herbe', 'herb', 'mayonnaise', 'pesto', 'coulis', 'concentre', 'cornichon', 'bouillon', 'curry', 'cumin', 'paprika', 'cannelle', 'cinnamon'] },
  { label: 'Boissons', icon: '🥤', keywords: ['eau', 'water', 'jus', 'juice', 'cafe', 'coffee', 'the ', 'tea', 'boisson', 'drink', 'soda', 'limonade'] },
  { label: 'Surgelés', icon: '❄️', keywords: ['surgele', 'frozen', 'glace', 'ice cream'] },
];
const AISLE_OTHER = { label: 'Épicerie', icon: '🧺' };

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function getAisle(name: string): string {
  const n = norm(name);
  for (const a of AISLES) {
    if (a.keywords.some(k => n.includes(k))) return a.label;
  }
  return AISLE_OTHER.label;
}

function matchCatalog(name: string, catalog: LidlPromoDetail[]): LidlPromoDetail | undefined {
  const words = norm(name).replace(/lidl/g, '').trim().split(/\s+/).filter(w => w.length > 2);
  return catalog.find(p => {
    const t = norm(p.title);
    return words.some(w => t.includes(w));
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroceryItem {
  id: string;
  name: string;
  isLidl: boolean;
  aisle: string;
  price?: string;
  old_price?: string;
  discount_percent?: number;
  image_url?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading: planLoading } = useMenu();

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [catalog, setCatalog] = useState<LidlPromoDetail[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [collapsedAisles, setCollapsedAisles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!plan) return;
    setCatalogLoading(true);
    fetchLidlCatalog().then(setCatalog).finally(() => setCatalogLoading(false));
  }, [plan]);

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAisle = (label: string) => {
    setCollapsedAisles(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // ── Build enriched item list grouped by aisle ───────────────────────────────
  const aisleMap = useMemo((): Map<string, GroceryItem[]> => {
    if (!plan) return new Map();

    const lidlSeen = new Set<string>();
    const otherSeen = new Set<string>();
    const items: GroceryItem[] = [];

    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const product of meal.lidl_products_used) {
          const key = product.toLowerCase().trim();
          if (lidlSeen.has(key)) continue;
          lidlSeen.add(key);
          const match = matchCatalog(product, catalog);
          items.push({
            id: `lidl-${key}`,
            name: match?.title ?? product,
            isLidl: true,
            aisle: getAisle(product),
            price: match?.price,
            old_price: match?.old_price,
            discount_percent: match?.discount_percent,
            image_url: match?.image_url,
          });
        }
        for (const ingredient of meal.ingredients) {
          const stripped = ingredient.replace(/^\d+[gmlkgL\s]+/i, '').trim();
          const key = stripped.toLowerCase();
          const coveredByLidl = [...lidlSeen].some(l => l.includes(key) || key.includes(l));
          if (coveredByLidl || otherSeen.has(key)) continue;
          otherSeen.add(key);
          items.push({ id: `other-${key}`, name: ingredient, isLidl: false, aisle: getAisle(ingredient) });
        }
      }
    }

    const map = new Map<string, GroceryItem[]>();
    for (const a of [...AISLES, AISLE_OTHER]) map.set(a.label, []);
    for (const item of items) map.get(item.aisle)!.push(item);
    for (const [label, list] of map) { if (!list.length) map.delete(label); }
    return map;
  }, [plan, catalog]);

  const allItems = useMemo(() => [...aisleMap.values()].flat(), [aisleMap]);
  const lidlCount = allItems.filter(i => i.isLidl).length;
  const unchecked = allItems.filter(i => !checkedItems.has(i.id)).length;
  const isLoading = planLoading || catalogLoading;

  // ── Item renderer ───────────────────────────────────────────────────────────
  const renderItem = (item: GroceryItem) => {
    const checked = checkedItems.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemRow, { backgroundColor: colors.surface, opacity: checked ? 0.4 : 1 }]}
        onPress={() => toggleCheck(item.id)}
        activeOpacity={0.75}
      >
        {/* Checkbox */}
        <View style={[styles.checkBox, {
          borderColor: checked ? colors.lime : colors.border2,
          backgroundColor: checked ? colors.limeDim : 'transparent',
        }]}>
          {checked && <Text style={[styles.checkMark, { color: colors.lime }]}>✓</Text>}
        </View>

        {/* Thumbnail */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={[styles.thumbPlaceholder, { backgroundColor: item.isLidl ? colors.limeDim : colors.surface2 }]}>
            <Text style={styles.thumbIcon}>{item.isLidl ? '🛒' : '🌿'}</Text>
          </View>
        )}

        {/* Name + price */}
        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemName, { color: colors.text, textDecorationLine: checked ? 'line-through' : 'none' }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {item.price ? (
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.lime }]}>{item.price}€</Text>
              {item.old_price && (
                <Text style={[styles.oldPrice, { color: colors.text3 }]}>{item.old_price}€</Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Badge: discount % or Lidl tag */}
        {item.discount_percent ? (
          <View style={[styles.discountBadge, { backgroundColor: `${colors.orange}22`, borderColor: `${colors.orange}55` }]}>
            <Text style={[styles.discountText, { color: colors.orange }]}>-{item.discount_percent}%</Text>
          </View>
        ) : item.isLidl ? (
          <View style={[styles.lidlBadge, { backgroundColor: colors.limeDim, borderColor: 'rgba(181,242,61,0.2)' }]}>
            <Text style={[styles.lidlBadgeText, { color: colors.lime }]}>Lidl</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Shopping List</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>
            {plan ? `${unchecked} items left` : "This week's groceries"}
          </Text>
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.lime} />
            <Text style={[styles.loadingText, { color: colors.text3 }]}>
              {planLoading ? 'Building your list…' : 'Loading Lidl prices…'}
            </Text>
          </View>
        )}

        {!planLoading && plan && (
          <>
            {/* Promo banner */}
            {lidlCount > 0 && (
              <View style={[styles.promoBanner, { backgroundColor: colors.limeDim, borderColor: 'rgba(181,242,61,0.3)' }]}>
                <Text style={[styles.promoText, { color: colors.lime }]}>
                  💚{' '}
                  <Text style={{ color: colors.text2, fontWeight: '400' }}>
                    {lidlCount} items on promotion at Lidl this week
                  </Text>
                </Text>
              </View>
            )}

            {/* Aisle sections */}
            {[...aisleMap.entries()].map(([label, items]) => {
              const meta = [...AISLES, AISLE_OTHER].find(a => a.label === label);
              const collapsed = collapsedAisles.has(label);
              const doneCount = items.filter(i => checkedItems.has(i.id)).length;
              const allDone = doneCount === items.length;

              return (
                <View key={label} style={styles.aisleSection}>
                  <TouchableOpacity
                    style={[styles.aisleHeader, { backgroundColor: colors.surface2, opacity: allDone ? 0.5 : 1 }]}
                    onPress={() => toggleAisle(label)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.aisleIcon}>{meta?.icon ?? '🧺'}</Text>
                    <Text style={[styles.aisleLabel, { color: colors.text }]}>{label}</Text>
                    <View style={styles.aisleMeta}>
                      <Text style={[styles.aisleCount, { color: allDone ? colors.lime : colors.text3 }]}>
                        {doneCount}/{items.length}
                      </Text>
                      <Text style={[styles.aisleChevron, { color: colors.text3 }]}>{collapsed ? '▶' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>

                  {!collapsed && (
                    <View style={styles.itemsList}>
                      {items.map(renderItem)}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Summary + actions */}
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

        {!planLoading && !plan && (
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
  // Aisles
  aisleSection: { marginBottom: 4 },
  aisleHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 20, gap: 10 },
  aisleIcon: { fontSize: 16 },
  aisleLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  aisleMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aisleCount: { fontSize: 12 },
  aisleChevron: { fontSize: 10 },
  itemsList: { paddingHorizontal: 16, paddingBottom: 4, gap: 2 },
  // Items
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, gap: 10 },
  checkBox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { fontSize: 10, fontWeight: '700' },
  thumb: { width: 44, height: 44, borderRadius: 8, flexShrink: 0 },
  thumbPlaceholder: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumbIcon: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, lineHeight: 18, marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 13, fontWeight: '700' },
  oldPrice: { fontSize: 11, textDecorationLine: 'line-through' },
  discountBadge: { borderWidth: 1, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, flexShrink: 0 },
  discountText: { fontSize: 11, fontWeight: '700' },
  lidlBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7, flexShrink: 0 },
  lidlBadgeText: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.1 },
  // Footer
  summaryRow: { marginHorizontal: 24, marginTop: 12, marginBottom: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13 },
  clearText: { fontSize: 12 },
  actionButtons: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 100 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 14, paddingHorizontal: 24, paddingTop: 40 },
});
