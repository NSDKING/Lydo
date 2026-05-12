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

// ─── Aisle config ─────────────────────────────────────────────────────────────

const AISLES = [
  { label: 'Viandes & Poissons',  icon: '🥩', color: '#ff6b35', keywords: ['poulet','chicken','boeuf','beef','porc','pork','saumon','salmon','thon','tuna','filet','steak','jambon','ham','lardons','dinde','cabillaud','crevette','shrimp','viande','meat','veau','agneau','lamb','merguez','chorizo'] },
  { label: 'Produits laitiers',   icon: '🥛', color: '#4d9fff', keywords: ['fromage','cheese','yaourt','yogurt','lait','milk','beurre','butter','creme','cream','oeuf','egg','mozzarella','parmesan','emmental','ricotta','gruyere'] },
  { label: 'Fruits & Légumes',    icon: '🥦', color: '#b5f23d', keywords: ['tomate','tomato','carotte','carrot','courgette','zucchini','salade','lettuce','epinard','spinach','pomme','apple','orange','banane','banana','oignon','onion','ail','garlic','poivron','avocat','avocado','concombre','cucumber','brocoli','broccoli','champignon','mushroom','celeri','poireau','leek','radis','navet','fruit','legume','vegetable'] },
  { label: 'Céréales & Féculents',icon: '🌾', color: '#ffc35c', keywords: ['riz','rice','pate','pasta','pain','bread','farine','flour','quinoa','avoine','oat','semoule','couscous','lentille','lentil','haricot','bean','potato','patate','cereale','cereal','ble','wheat','pois chiche','chickpea','boulgour','bulgur'] },
  { label: 'Huiles & Condiments', icon: '🫒', color: '#c47fff', keywords: ['huile','oil','vinaigre','vinegar','moutarde','mustard','ketchup','sauce','sel','salt','poivre','pepper','epice','spice','herbe','herb','mayonnaise','pesto','coulis','concentre','cornichon','bouillon','curry','cumin','paprika','cannelle','cinnamon'] },
  { label: 'Boissons',            icon: '🥤', color: '#3dd9f2', keywords: ['eau','water','jus','juice','cafe','coffee','the ','tea','boisson','drink','soda','limonade'] },
  { label: 'Surgelés',            icon: '❄️', color: '#80e5ff', keywords: ['surgele','frozen','glace','ice cream'] },
];
const AISLE_OTHER = { label: 'Épicerie', icon: '🧺', color: '#7a7a7a' };
const ALL_AISLES = [...AISLES, AISLE_OTHER];

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function getAisle(name: string) {
  const n = norm(name);
  for (const a of AISLES) if (a.keywords.some(k => n.includes(k))) return a.label;
  return AISLE_OTHER.label;
}
function matchCatalog(name: string, catalog: LidlPromoDetail[]): LidlPromoDetail | undefined {
  const words = norm(name).replace(/lidl/g, '').trim().split(/\s+/).filter(w => w.length > 2);
  return catalog.find(p => { const t = norm(p.title); return words.some(w => t.includes(w)); });
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
  const C = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading: planLoading } = useMenu();

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [catalog, setCatalog]           = useState<LidlPromoDetail[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [collapsedAisles, setCollapsedAisles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!plan) return;
    setCatalogLoading(true);
    fetchLidlCatalog().then(setCatalog).finally(() => setCatalogLoading(false));
  }, [plan]);

  const toggleCheck = (id: string) =>
    setCheckedItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAisle = (label: string) =>
    setCollapsedAisles(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });

  // ── Enrich + group ──────────────────────────────────────────────────────────
  const aisleMap = useMemo((): Map<string, GroceryItem[]> => {
    if (!plan) return new Map();
    const lidlSeen = new Set<string>(), otherSeen = new Set<string>();
    const items: GroceryItem[] = [];

    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const product of meal.lidl_products_used) {
          const key = product.toLowerCase().trim();
          if (lidlSeen.has(key)) continue;
          lidlSeen.add(key);
          const m = matchCatalog(product, catalog);
          items.push({ id: `l-${key}`, name: m?.title ?? product, isLidl: true, aisle: getAisle(product), price: m?.price, old_price: m?.old_price, discount_percent: m?.discount_percent, image_url: m?.image_url });
        }
        for (const ing of meal.ingredients) {
          const stripped = ing.replace(/^\d+[gmlkgL\s]+/i, '').trim();
          const key = stripped.toLowerCase();
          if ([...lidlSeen].some(l => l.includes(key) || key.includes(l)) || otherSeen.has(key)) continue;
          otherSeen.add(key);
          items.push({ id: `o-${key}`, name: ing, isLidl: false, aisle: getAisle(ing) });
        }
      }
    }

    const map = new Map<string, GroceryItem[]>();
    for (const a of ALL_AISLES) map.set(a.label, []);
    for (const item of items) map.get(item.aisle)!.push(item);
    for (const [l, list] of map) if (!list.length) map.delete(l);
    return map;
  }, [plan, catalog]);

  const allItems     = useMemo(() => [...aisleMap.values()].flat(), [aisleMap]);
  const doneCount    = allItems.filter(i => checkedItems.has(i.id)).length;
  const totalItems   = allItems.length;
  const pct          = totalItems ? Math.round((doneCount / totalItems) * 100) : 0;
  const lidlCount    = allItems.filter(i => i.isLidl).length;
  const totalSavings = useMemo(() => allItems.reduce((sum, item) => {
    if (!item.price || !item.old_price) return sum;
    const curr = parseFloat(item.price), old = parseFloat(item.old_price);
    return !isNaN(curr) && !isNaN(old) ? sum + (old - curr) : sum;
  }, 0), [allItems]);

  const isLoading = planLoading || catalogLoading;

  // ── Renderers ───────────────────────────────────────────────────────────────
  const renderItem = (item: GroceryItem) => {
    const checked = checkedItems.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemRow, { backgroundColor: C.surface }]}
        onPress={() => toggleCheck(item.id)}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <View style={[styles.check, {
          backgroundColor: checked ? C.lime : 'transparent',
          borderColor:     checked ? C.lime : C.border2,
        }]}>
          {checked && <Text style={styles.checkMark}>✓</Text>}
        </View>

        {/* Thumb */}
        <View style={styles.thumbWrap}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="contain" />
          ) : (
            <View style={[styles.thumbFallback, { backgroundColor: item.isLidl ? C.limeDim : C.surface2 }]}>
              <Text style={styles.thumbEmoji}>{item.isLidl ? '🛒' : '🌿'}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={[styles.itemBody, { opacity: checked ? 0.45 : 1 }]}>
          <Text
            style={[styles.itemName, {
              color: checked ? C.text3 : C.text,
              textDecorationLine: checked ? 'line-through' : 'none',
            }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {item.price ? (
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: C.lime }]}>{item.price}€</Text>
              {item.old_price && (
                <Text style={[styles.oldPrice, { color: C.text3 }]}>{item.old_price}€</Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Right badge */}
        {item.discount_percent ? (
          <View style={[styles.saleBadge, { backgroundColor: C.orangeDim, borderColor: `${C.orange}55` }]}>
            <Text style={[styles.saleText, { color: C.orange }]}>-{item.discount_percent}%</Text>
          </View>
        ) : item.isLidl ? (
          <View style={[styles.lidlDot, { backgroundColor: C.limeDim }]}>
            <Text style={[styles.lidlDotText, { color: C.lime }]}>L</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: C.text }]}>Shopping List</Text>
              <Text style={[styles.subtitle, { color: C.text3 }]}>
                {plan ? `${totalItems} items this week` : "This week's groceries"}
              </Text>
            </View>

            {/* Progress ring */}
            {totalItems > 0 && (
              <View style={[styles.progressRing, {
                borderColor: pct === 100 ? C.lime : C.surface2,
                backgroundColor: pct === 100 ? C.limeDim : C.surface,
              }]}>
                <Text style={[styles.progressPct, { color: pct === 100 ? C.lime : C.text }]}>{pct}<Text style={styles.progressPctSuffix}>%</Text></Text>
                <Text style={[styles.progressDone, { color: C.text3 }]}>{doneCount}/{totalItems}</Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          {totalItems > 0 && (
            <View style={[styles.progressTrack, { backgroundColor: C.surface2 }]}>
              <View style={[styles.progressFill, { backgroundColor: C.lime, width: `${pct}%` }]} />
            </View>
          )}

          {/* Savings chip */}
          {totalSavings > 0.01 && (
            <View style={[styles.savingsChip, { backgroundColor: C.limeDim, borderColor: 'rgba(181,242,61,0.25)' }]}>
              <Text style={[styles.savingsText, { color: C.lime }]}>
                💰  Save up to <Text style={{ fontWeight: '700' }}>€{totalSavings.toFixed(2)}</Text> with Lidl promos
              </Text>
            </View>
          )}
        </View>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.lime} size="small" />
            <Text style={[styles.loadingText, { color: C.text3 }]}>
              {planLoading ? 'Building your list…' : 'Fetching Lidl prices…'}
            </Text>
          </View>
        )}

        {/* ── Content ─────────────────────────────────────────────────── */}
        {!planLoading && plan && (
          <>
            {/* Promo banner */}
            {lidlCount > 0 && (
              <View style={[styles.promoBanner, { backgroundColor: C.limeDim, borderColor: 'rgba(181,242,61,0.2)' }]}>
                <View style={[styles.promoDot, { backgroundColor: C.lime }]} />
                <Text style={[styles.promoText, { color: C.text2 }]}>
                  <Text style={{ color: C.lime, fontWeight: '700' }}>{lidlCount}</Text> items available at Lidl this week
                </Text>
              </View>
            )}

            {/* Aisles */}
            {[...aisleMap.entries()].map(([label, items]) => {
              const meta      = ALL_AISLES.find(a => a.label === label) ?? AISLE_OTHER;
              const collapsed = collapsedAisles.has(label);
              const done      = items.filter(i => checkedItems.has(i.id)).length;
              const allDone   = done === items.length;
              const fillPct   = items.length ? (done / items.length) * 100 : 0;

              return (
                <View key={label} style={styles.aisleSection}>
                  {/* Aisle header */}
                  <TouchableOpacity
                    style={[styles.aisleHeader, {
                      backgroundColor: C.surface,
                      borderLeftColor: meta.color,
                    }]}
                    onPress={() => toggleAisle(label)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.aisleIconWrap, { backgroundColor: meta.color + '20' }]}>
                      <Text style={styles.aisleIcon}>{meta.icon}</Text>
                    </View>

                    <View style={styles.aisleTitleCol}>
                      <Text style={[styles.aisleLabel, { color: allDone ? C.text3 : C.text }]}>{label}</Text>
                      <View style={[styles.aisleProgTrack, { backgroundColor: C.surface2 }]}>
                        <View style={[styles.aisleProgFill, {
                          backgroundColor: allDone ? C.lime : meta.color,
                          width: `${fillPct}%`,
                        }]} />
                      </View>
                    </View>

                    <Text style={[styles.aisleCount, { color: allDone ? C.lime : C.text3 }]}>
                      {done}/{items.length}
                    </Text>
                    <Text style={[styles.aisleChevron, { color: C.text3 }]}>{collapsed ? '›' : '⌄'}</Text>
                  </TouchableOpacity>

                  {/* Items */}
                  {!collapsed && (
                    <View style={[styles.itemsWrap, { backgroundColor: C.background }]}>
                      {items.map(renderItem)}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Footer */}
            <View style={styles.footer}>
              <View style={[styles.footerBar, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.footerLabel, { color: C.text2 }]}>
                  {doneCount} of {totalItems} checked
                </Text>
                {doneCount > 0 && (
                  <TouchableOpacity
                    style={[styles.clearBtn, { backgroundColor: C.surface2, borderColor: C.border2 }]}
                    onPress={() => setCheckedItems(new Set())}
                  >
                    <Text style={[styles.clearBtnText, { color: C.text3 }]}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 }]}>
                  <Text style={styles.actionIcon}>↗</Text>
                  <Text style={[styles.actionLabel, { color: C.text2 }]}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.lime }]}>
                  <Text style={styles.actionIcon}>🛒</Text>
                  <Text style={[styles.actionLabel, { color: C.background }]}>Order Online</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Empty state */}
        {!planLoading && !plan && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>No list yet</Text>
            <Text style={[styles.emptyDesc, { color: C.text3 }]}>Generate a meal plan to build your shopping list automatically.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },

  // Header
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft: { flex: 1, paddingRight: 12 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13 },
  progressRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  progressPct: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  progressPctSuffix: { fontSize: 11, fontWeight: '600' },
  progressDone: { fontSize: 10, marginTop: 1 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', borderRadius: 3 },
  savingsChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  savingsText: { fontSize: 12 },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingBottom: 16 },
  loadingText: { fontSize: 13 },

  // Promo banner
  promoBanner: { marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoDot: { width: 7, height: 7, borderRadius: 4 },
  promoText: { fontSize: 13 },

  // Aisle
  aisleSection: { marginBottom: 2 },
  aisleHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 12, borderLeftWidth: 3, marginHorizontal: 16, borderRadius: 14, marginBottom: 2 },
  aisleIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aisleIcon: { fontSize: 17 },
  aisleTitleCol: { flex: 1 },
  aisleLabel: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
  aisleProgTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  aisleProgFill: { height: '100%', borderRadius: 2 },
  aisleCount: { fontSize: 12, fontWeight: '600', flexShrink: 0 },
  aisleChevron: { fontSize: 17, flexShrink: 0, marginLeft: -4 },

  // Items list
  itemsWrap: { paddingHorizontal: 16, paddingBottom: 6, gap: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 10 },

  // Checkbox
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { fontSize: 11, fontWeight: '800', color: '#080808' },

  // Thumbnail
  thumbWrap: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden', flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 48, height: 48 },
  thumbFallback: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 22 },

  // Item body
  itemBody: { flex: 1 },
  itemName: { fontSize: 13, lineHeight: 17, marginBottom: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 14, fontWeight: '800' },
  oldPrice: { fontSize: 11, textDecorationLine: 'line-through' },

  // Badges
  saleBadge: { borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, flexShrink: 0 },
  saleText: { fontSize: 11, fontWeight: '800' },
  lidlDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lidlDotText: { fontSize: 12, fontWeight: '800' },

  // Footer
  footer: { paddingHorizontal: 16, marginTop: 16, gap: 10 },
  footerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16 },
  footerLabel: { fontSize: 13 },
  clearBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 12 },
  clearBtnText: { fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 14 },
  actionIcon: { fontSize: 16 },
  actionLabel: { fontSize: 14, fontWeight: '700' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
