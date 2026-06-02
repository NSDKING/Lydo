import { Colors } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { LidlPromoDetail, fetchLidlCatalog, getWeekKey } from '@/services/api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  { label: 'Viandes & Poissons',   icon: '🥩', color: '#ff6b35', keywords: ['poulet','chicken','boeuf','beef','porc','pork','saumon','salmon','thon','tuna','filet','steak','jambon','ham','lardons','dinde','cabillaud','crevette','shrimp','viande','meat','veau','agneau','lamb','merguez','chorizo'] },
  { label: 'Produits laitiers',    icon: '🥛', color: '#4d9fff', keywords: ['fromage','cheese','yaourt','yogurt','lait','milk','beurre','butter','creme','cream','oeuf','egg','mozzarella','parmesan','emmental','ricotta','gruyere'] },
  { label: 'Fruits & Légumes',     icon: '🥦', color: '#b5f23d', keywords: ['tomate','tomato','carotte','carrot','courgette','zucchini','salade','lettuce','epinard','spinach','pomme','apple','orange','banane','banana','oignon','onion','ail','garlic','poivron','avocat','avocado','concombre','cucumber','brocoli','broccoli','champignon','mushroom','celeri','poireau','leek','radis','navet','fruit','legume','vegetable'] },
  { label: 'Céréales & Féculents', icon: '🌾', color: '#ffc35c', keywords: ['riz','rice','pate','pasta','pain','bread','farine','flour','quinoa','avoine','oat','semoule','couscous','lentille','lentil','haricot','bean','potato','patate','cereale','cereal','ble','wheat','pois chiche','chickpea','boulgour','bulgur'] },
  { label: 'Huiles & Condiments',  icon: '🫒', color: '#c47fff', keywords: ['huile','oil','vinaigre','vinegar','moutarde','mustard','ketchup','sauce','sel','salt','poivre','pepper','epice','spice','herbe','herb','mayonnaise','pesto','coulis','concentre','cornichon','bouillon','curry','cumin','paprika','cannelle','cinnamon'] },
  { label: 'Boissons',             icon: '🥤', color: '#3dd9f2', keywords: ['eau','water','jus','juice','cafe','coffee','the ','tea','boisson','drink','soda','limonade'] },
  { label: 'Surgelés',             icon: '❄️', color: '#80e5ff', keywords: ['surgele','frozen','glace','ice cream'] },
];
const AISLE_OTHER = { label: 'Épicerie', icon: '🧺', color: '#888888' };
const ALL_AISLES  = [...AISLES, AISLE_OTHER];

// French/English stopwords to strip before matching
const STOPWORDS = new Set(['les','des','du','de','la','le','un','une','au','aux','sur','par','et','ou','avec','sans','pour','dans','en','the','and','of','with','from','fresh','frais','fraiche','bio','extra','special']);

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function getAisle(name: string) {
  const n = norm(name);
  for (const a of AISLES) if (a.keywords.some(k => n.includes(k))) return a.label;
  return AISLE_OTHER.label;
}

// Strip leading quantity/unit (e.g. "200g", "2 tbsp", "1 kg") before matching.
function stripQty(s: string) {
  return s.replace(/^\d+[\.,]?\d*\s*(g|kg|ml|cl|l|x|pc|pcs|tbsp|tsp|cup|oz|lb|piece|tranches?|filets?)?\s*/i, '').trim();
}

// Returns the catalog entry with the most keyword overlap, preferring entries
// that have an image_url.
function matchCatalog(name: string, catalog: LidlPromoDetail[]): LidlPromoDetail | undefined {
  const cleaned = stripQty(name);
  const words = norm(cleaned)
    .replace(/\blidl\b/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));

  if (!words.length) return undefined;

  let best: LidlPromoDetail | undefined;
  let bestScore = 0;

  for (const p of catalog) {
    const t = norm(p.title);
    const matches = words.filter(w => t.includes(w)).length;
    if (matches === 0) continue;
    // Weight: word overlap × 10, bonus +5 if the entry has an image
    const score = matches * 10 + (p.image_url ? 5 : 0);
    if (score > bestScore) { bestScore = score; best = p; }
  }

  return best;
}

// Per-aisle fallback emoji for items without a product image
const AISLE_FALLBACK: Record<string, string> = {
  'Viandes & Poissons':   '🥩',
  'Produits laitiers':    '🧀',
  'Fruits & Légumes':     '🥬',
  'Céréales & Féculents': '🌾',
  'Huiles & Condiments':  '🫒',
  'Boissons':             '🥤',
  'Surgelés':             '❄️',
  'Épicerie':             '🧺',
};

interface GroceryItem {
  id: string; name: string; isLidl: boolean; aisle: string;
  price?: string; old_price?: string; discount_percent?: number; image_url?: string;
  lidlDeal?: boolean;
  mealCount: number; // how many meals use this ingredient
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const colorScheme = useColorScheme();
  const C = Colors[colorScheme ?? 'dark'];
  const { plan, isLoading: planLoading } = useMenu();
  const { profile } = useProfile();
  const budget = profile.weekly_budget_eur;

  const [checked, setChecked]       = useState<Set<string>>(new Set());
  const [pantry, setPantry]         = useState<Set<string>>(new Set()); // item names
  const [catalog, setCatalog]       = useState<LidlPromoDetail[]>([]);
  const [catalogLoading, setCL]     = useState(false);
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());

  const weekKey = getWeekKey();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load pantry (persists across weeks) + checked (this week only) from Supabase
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('user_grocery_state')
        .select('week_key, items')
        .eq('user_id', uid)
        .in('week_key', ['pantry', weekKey]);
      if (!data) return;
      for (const row of data) {
        if (row.week_key === 'pantry') setPantry(new Set(row.items ?? []));
        else setChecked(new Set(row.items ?? []));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced Supabase upsert so rapid taps don't flood the DB
  const saveState = useCallback((pantryArr: string[], checkedArr: string[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      await supabase.from('user_grocery_state').upsert([
        { user_id: uid, week_key: 'pantry',  items: pantryArr,  updated_at: new Date().toISOString() },
        { user_id: uid, week_key: weekKey,   items: checkedArr, updated_at: new Date().toISOString() },
      ], { onConflict: 'user_id,week_key' });
    }, 800);
  }, [weekKey]);

  useEffect(() => {
    if (!plan) return;
    setCL(true);
    fetchLidlCatalog().then(setCatalog).finally(() => setCL(false));
  }, [plan]);

  // Checking an item = buying it = add to pantry
  const toggle = useCallback((id: string, name: string) => {
    setChecked(prev => {
      const nextChecked = new Set(prev);
      if (nextChecked.has(id)) {
        nextChecked.delete(id);
        setPantry(p => {
          const nextPantry = new Set(p);
          saveState([...nextPantry], [...nextChecked]);
          return nextPantry;
        });
      } else {
        nextChecked.add(id);
        setPantry(p => {
          const nextPantry = new Set([...p, name]);
          saveState([...nextPantry], [...nextChecked]);
          return nextPantry;
        });
      }
      return nextChecked;
    });
  }, [saveState]);

  // Mark item as finished = remove from pantry so it appears on next week's buy list
  const markFinished = useCallback((name: string, id: string) => {
    setPantry(p => {
      const nextPantry = new Set(p);
      nextPantry.delete(name);
      setChecked(c => {
        const nextChecked = new Set(c);
        nextChecked.delete(id);
        saveState([...nextPantry], [...nextChecked]);
        return nextChecked;
      });
      return nextPantry;
    });
  }, [saveState]);

  const collapse = (label: string) => setCollapsed(p => { const n = new Set(p); n.has(label) ? n.delete(label) : n.add(label); return n; });

  const aisleMap = useMemo((): Map<string, GroceryItem[]> => {
    if (!plan) return new Map();

    // First pass: count how many meals use each key
    const mealCounts = new Map<string, number>();
    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const p of meal.lidl_products_used) {
          const k = `l-${p.toLowerCase().trim()}`;
          mealCounts.set(k, (mealCounts.get(k) ?? 0) + 1);
        }
        for (const ing of meal.ingredients) {
          const k = `o-${stripQty(ing).toLowerCase()}`;
          mealCounts.set(k, (mealCounts.get(k) ?? 0) + 1);
        }
      }
    }

    // Second pass: build deduplicated items with mealCount
    const lSeen = new Set<string>(), oSeen = new Set<string>();
    // Track catalog titles already added to prevent the same Lidl product
    // appearing twice (once from lidl_products_used, once from ingredients)
    const addedCatalogTitles = new Set<string>();
    const items: GroceryItem[] = [];
    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const p of meal.lidl_products_used) {
          const k = p.toLowerCase().trim();
          if (lSeen.has(k)) continue; lSeen.add(k);
          const m = matchCatalog(p, catalog);
          if (m?.title) addedCatalogTitles.add(m.title.toLowerCase());
          items.push({ id: `l-${k}`, name: m?.title ?? p, isLidl: true, aisle: getAisle(p), price: m?.price, old_price: m?.old_price, discount_percent: m?.discount_percent, image_url: m?.image_url, mealCount: mealCounts.get(`l-${k}`) ?? 1 });
        }
        for (const ing of meal.ingredients) {
          const stripped = stripQty(ing);
          const k = stripped.toLowerCase();
          if ([...lSeen].some(l => l.includes(k) || k.includes(l)) || oSeen.has(k)) continue;
          const m = matchCatalog(stripped, catalog);
          // Skip if this ingredient maps to a catalog item already added from lidl_products_used
          if (m?.title && addedCatalogTitles.has(m.title.toLowerCase())) continue;
          oSeen.add(k);
          items.push({
            id: `o-${k}`, name: ing, isLidl: false, aisle: getAisle(ing),
            price: m?.price, old_price: m?.old_price,
            discount_percent: m?.discount_percent, image_url: m?.image_url,
            lidlDeal: !!m, mealCount: mealCounts.get(`o-${k}`) ?? 1,
          });
        }
      }
    }
    const map = new Map<string, GroceryItem[]>();
    for (const a of ALL_AISLES) map.set(a.label, []);
    for (const item of items) map.get(item.aisle)!.push(item);
    for (const [l, list] of map) if (!list.length) map.delete(l);
    return map;
  }, [plan, catalog]);

  const allItems      = useMemo(() => [...aisleMap.values()].flat(), [aisleMap]);
  const doneCount     = allItems.filter(i => checked.has(i.id)).length;
  const total         = allItems.length;
  const pct           = total ? Math.round((doneCount / total) * 100) : 0;
  const lidlCount     = allItems.filter(i => i.isLidl || i.lidlDeal).length;
  const savings       = useMemo(() => allItems.reduce((s, i) => {
    if (!i.price || !i.old_price) return s;
    const c = parseFloat(i.price), o = parseFloat(i.old_price);
    return !isNaN(c) && !isNaN(o) ? s + (o - c) : s;
  }, 0), [allItems]);

  // Items the user still needs to buy (not in pantry)
  const toBuyItems    = useMemo(() => allItems.filter(i => !pantry.has(i.name)), [allItems, pantry]);
  const pantryCount   = allItems.length - toBuyItems.length;

  // Estimated Lidl basket: only explicitly planned Lidl products (isLidl: true),
  // not generic ingredients that happen to fuzzy-match the catalog.
  const estimatedCost = useMemo(() => toBuyItems.reduce((s, i) => {
    if (!i.isLidl || !i.price) return s;
    const v = parseFloat(i.price);
    return isNaN(v) ? s : s + v;
  }, 0), [toBuyItems]);

  // Running bill: only Lidl items being ticked (same scope as estimatedCost)
  const checkedTotal  = useMemo(() => allItems.reduce((s, i) => {
    if (!i.isLidl || !checked.has(i.id) || !i.price || pantry.has(i.name)) return s;
    const v = parseFloat(i.price);
    return isNaN(v) ? s : s + v;
  }, 0), [allItems, checked, pantry]);

  const budgetPct     = budget > 0 ? Math.min(100, (estimatedCost / budget) * 100) : 0;
  const overBudget    = budget > 0 && estimatedCost > budget;

  const isLoading = planLoading || catalogLoading;

  const renderItem = (item: GroceryItem) => {
    const isChecked = checked.has(item.id);
    const inPantry  = pantry.has(item.name);

    return (
      <View key={item.id}>
        <TouchableOpacity
          style={[
            styles.itemRow,
            {
              backgroundColor: inPantry  ? 'rgba(181,242,61,0.06)' :
                               isChecked ? 'rgba(181,242,61,0.03)' : C.surface,
              borderColor:     inPantry  ? 'rgba(181,242,61,0.35)' :
                               isChecked ? 'rgba(181,242,61,0.22)' : C.border,
              borderLeftColor: inPantry ? C.lime : isChecked ? C.lime : C.border,
              borderLeftWidth: (inPantry || isChecked) ? 3 : 1,
            },
          ]}
          onPress={() => toggle(item.id, item.name)}
          activeOpacity={0.75}
        >
          {/* Checkbox */}
          <View style={[
            styles.checkBox,
            {
              backgroundColor: (isChecked || inPantry) ? C.lime : 'transparent',
              borderColor:     (isChecked || inPantry) ? C.lime : C.border2,
            },
          ]}>
            {(isChecked || inPantry) && <Text style={styles.checkMark}>✓</Text>}
          </View>

          {/* Product image */}
          <View style={styles.thumbWrap}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="contain" />
            ) : (
              <View style={[styles.thumbFallback, {
                backgroundColor: item.isLidl ? C.limeDim : C.surface2,
              }]}>
                <Text style={styles.thumbEmoji}>
                  {AISLE_FALLBACK[item.aisle] ?? '🛒'}
                </Text>
              </View>
            )}
          </View>

          {/* Name + price */}
          <View style={[styles.itemBody, { opacity: (isChecked || inPantry) ? 0.55 : 1 }]}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={2}
                style={[styles.itemName, { flex: 1, color: C.text, textDecorationLine: isChecked ? 'line-through' : 'none' }]}
              >
                {item.name}
              </Text>
              {item.mealCount > 1 && (
                <View style={[styles.countPill, { backgroundColor: C.surface3, borderColor: C.border2 }]}>
                  <Text style={[styles.countPillText, { color: C.text3 }]}>× {item.mealCount}</Text>
                </View>
              )}
            </View>
            {inPantry && !isChecked && (
              <Text style={[styles.haveLabel, { color: C.lime }]}>Already in pantry</Text>
            )}
            {item.price && !inPantry ? (
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: C.lime }]}>{item.price}€</Text>
                {item.old_price && (
                  <Text style={[styles.oldPrice, { color: C.text3 }]}>{item.old_price}€</Text>
                )}
              </View>
            ) : null}
          </View>

          {/* Badge */}
          {inPantry ? (
            <View style={[styles.badge, { backgroundColor: C.limeDim, borderColor: 'rgba(181,242,61,0.35)' }]}>
              <Text style={[styles.badgeText, { color: C.lime }]}>Have ✓</Text>
            </View>
          ) : item.discount_percent ? (
            <View style={[styles.badge, { backgroundColor: C.orangeDim, borderColor: `${C.orange}50` }]}>
              <Text style={[styles.badgeText, { color: C.orange }]}>-{item.discount_percent}%</Text>
            </View>
          ) : item.isLidl ? (
            <View style={[styles.badge, { backgroundColor: C.limeDim, borderColor: 'rgba(181,242,61,0.25)' }]}>
              <Text style={[styles.badgeText, { color: C.lime }]}>LIDL</Text>
            </View>
          ) : item.lidlDeal ? (
            <View style={[styles.badge, { backgroundColor: C.limeDim, borderColor: 'rgba(181,242,61,0.25)' }]}>
              <Text style={[styles.badgeText, { color: C.lime }]}>🛒</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {/* Finished button — shown when item is in pantry */}
        {inPantry && (
          <TouchableOpacity
            style={[styles.finishedBtn, { backgroundColor: C.surface2, borderColor: C.border2 }]}
            onPress={() => markFinished(item.name, item.id)}
          >
            <Text style={[styles.finishedBtnText, { color: C.orange }]}>Used it up — remove from pantry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: C.text }]}>Shopping List</Text>
              <Text style={[styles.subtitle, { color: C.text3 }]}>
                {plan
                  ? `${total} items from ${plan.days.length} days · ${plan.days[0]?.day ?? ''} – ${plan.days[plan.days.length - 1]?.day ?? ''}`
                  : "Generate a meal plan first"}
              </Text>
            </View>

            {/* Progress ring */}
            {total > 0 && (
              <View style={[styles.ringOuter, { borderColor: C.border }]}>
                <View style={[styles.ringInner, {
                  borderColor: pct === 100 ? C.lime : C.surface2,
                  backgroundColor: pct === 100 ? C.limeDim : 'transparent',
                }]}>
                  <Text style={[styles.ringPct, { color: pct === 100 ? C.lime : C.text }]}>
                    {pct}<Text style={[styles.ringPctUnit, { color: C.text3 }]}>%</Text>
                  </Text>
                  <Text style={[styles.ringDone, { color: C.text3 }]}>{doneCount}/{total}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Progress bar */}
          {total > 0 && (
            <View style={[styles.progressTrack, { backgroundColor: C.surface2 }]}>
              <View style={[styles.progressFill, { backgroundColor: C.lime, width: `${pct}%` }]} />
            </View>
          )}

          {/* Budget bar */}
          {budget > 0 && (
            <View style={[styles.budgetCard, { backgroundColor: C.surface, borderColor: overBudget ? `${C.orange}60` : C.border }]}>
              <View style={styles.budgetRow}>
                <Text style={[styles.budgetLabel, { color: C.text3 }]}>
                  {'Lidl prices only'}
                  {pantryCount > 0 ? ` · ${pantryCount} in pantry` : ''}
                </Text>
                <Text style={[styles.budgetAmount, { color: overBudget ? C.orange : C.text }]}>
                  <Text style={{ color: overBudget ? C.orange : C.lime, fontWeight: '800' }}>€{estimatedCost.toFixed(2)}</Text>
                  {'  /  '}€{budget.toFixed(0)}
                </Text>
              </View>
              <View style={[styles.budgetTrack, { backgroundColor: C.surface2 }]}>
                <View style={[styles.budgetFill, {
                  width: `${budgetPct}%` as any,
                  backgroundColor: overBudget ? C.orange : C.lime,
                }]} />
              </View>
              {overBudget && (
                <Text style={[styles.overBudgetText, { color: C.orange }]}>
                  €{(estimatedCost - budget).toFixed(2)} over budget — the meal plan uses more than your weekly budget
                </Text>
              )}
            </View>
          )}

          {/* Savings callout */}
          {savings > 0.01 && (
            <View style={[styles.savingsCard, { backgroundColor: C.limeDim, borderColor: 'rgba(181,242,61,0.2)' }]}>
              <View style={[styles.savingsIconWrap, { backgroundColor: 'rgba(181,242,61,0.18)' }]}>
                <Text style={styles.savingsIconText}>💰</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.savingsAmount, { color: C.lime }]}>Save up to €{savings.toFixed(2)}</Text>
                <Text style={[styles.savingsLabel, { color: C.text3 }]}>with Lidl promotions this week</Text>
              </View>
            </View>
          )}
        </View>

        {/* ─── Loading ─────────────────────────────────────────────────── */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.lime} size="small" />
            <Text style={[styles.loadingText, { color: C.text3 }]}>
              {planLoading ? 'Building your list…' : 'Fetching Lidl prices…'}
            </Text>
          </View>
        )}

        {/* ─── Content ─────────────────────────────────────────────────── */}
        {!planLoading && plan && (
          <>
            {/* Lidl banner */}
            {lidlCount > 0 && (
              <View style={[styles.lidlBanner, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={[styles.lidlDot, { backgroundColor: C.lime }]} />
                <Text style={[styles.lidlBannerText, { color: C.text2 }]}>
                  <Text style={{ color: C.lime, fontWeight: '700' }}>{lidlCount} items</Text> available at Lidl this week
                </Text>
              </View>
            )}

            {/* ─── Aisle sections ────────────────────────────────────── */}
            {[...aisleMap.entries()].map(([label, items]) => {
              const meta     = ALL_AISLES.find(a => a.label === label) ?? AISLE_OTHER;
              const isCol    = collapsed.has(label);
              const done     = items.filter(i => checked.has(i.id)).length;
              const allDone  = done === items.length && items.length > 0;
              const fill     = items.length ? (done / items.length) * 100 : 0;

              return (
                <View key={label} style={styles.aisleSection}>
                  {/* Department header */}
                  <TouchableOpacity
                    style={[styles.aisleHeader, {
                      backgroundColor: meta.color + '14',
                      borderColor:     meta.color + '30',
                      borderLeftColor: meta.color,
                    }]}
                    onPress={() => collapse(label)}
                    activeOpacity={0.7}
                  >
                    {/* Icon */}
                    <View style={[styles.aisleIconWrap, { backgroundColor: meta.color + '22' }]}>
                      <Text style={styles.aisleIcon}>{meta.icon}</Text>
                    </View>

                    {/* Label + progress bar */}
                    <View style={styles.aisleTitleBlock}>
                      <Text style={[styles.aisleLabel, { color: allDone ? C.text3 : C.text }]} numberOfLines={1}>
                        {label}
                      </Text>
                      <View style={[styles.aisleProg, { backgroundColor: meta.color + '25' }]}>
                        <View style={[styles.aisleProgFill, {
                          backgroundColor: allDone ? C.lime : meta.color,
                          width: `${fill}%`,
                        }]} />
                      </View>
                    </View>

                    {/* Count + chevron */}
                    <View style={styles.aisleRight}>
                      <Text style={[styles.aisleCount, { color: allDone ? C.lime : C.text3 }]}>
                        {done}/{items.length}
                      </Text>
                      <View style={[styles.chevronWrap, { backgroundColor: meta.color + '20' }]}>
                        <Text style={[styles.chevron, { color: meta.color }]}>{isCol ? '+' : '−'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Items */}
                  {!isCol && (
                    <View style={styles.itemsWrap}>
                      {items.map(renderItem)}
                    </View>
                  )}
                </View>
              );
            })}

            {/* ─── Footer ────────────────────────────────────────────── */}
            <View style={styles.footer}>
              {/* Summary bar */}
              <View style={[styles.summaryBar, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={styles.summaryLeft}>
                  <Text style={[styles.summaryCount, { color: C.text }]}>{doneCount}</Text>
                  <Text style={[styles.summaryOf, { color: C.text3 }]}>  of {total} items</Text>
                  {checkedTotal > 0 && (
                    <Text style={[styles.summaryOf, { color: C.lime, fontWeight: '700' }]}>
                      {'  ·  '}€{checkedTotal.toFixed(2)}
                    </Text>
                  )}
                </View>
                {doneCount > 0 && (
                  <TouchableOpacity
                    style={[styles.clearBtn, { borderColor: C.border2 }]}
                    onPress={() => setChecked(new Set())}
                  >
                    <Text style={[styles.clearBtnText, { color: C.text3 }]}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 }]}>
                  <Text style={[styles.actionBtnText, { color: C.text2 }]}>↗  Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.lime, flex: 2 }]}>
                  <Text style={[styles.actionBtnText, { color: C.background, fontWeight: '800' }]}>🛒  Order Online</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Empty */}
        {!planLoading && !plan && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>No list yet</Text>
            <Text style={[styles.emptyDesc, { color: C.text3 }]}>
              Generate a meal plan to automatically build your weekly shopping list.
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scroll:        { paddingBottom: 110 },

  // Header
  header:        { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 18, gap: 16 },
  titleRow:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:         { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginBottom: 4 },
  subtitle:      { fontSize: 13, lineHeight: 18 },

  // Progress ring
  ringOuter:     { width: 74, height: 74, borderRadius: 37, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ringInner:     { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  ringPct:       { fontSize: 18, fontWeight: '800', lineHeight: 20 },
  ringPctUnit:   { fontSize: 11, fontWeight: '500' },
  ringDone:      { fontSize: 9, marginTop: 1 },

  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },

  nameRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  countPill:        { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0, marginTop: 1 },
  countPillText:    { fontSize: 11, fontWeight: '700' },
  haveLabel:        { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  finishedBtn:      { marginTop: 2, marginBottom: 4, borderWidth: 1, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14, alignItems: 'center' },
  finishedBtnText:  { fontSize: 12, fontWeight: '600' },

  // Budget bar
  budgetCard:       { borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  budgetRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  budgetLabel:      { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  budgetAmount:     { fontSize: 14 },
  budgetTrack:      { height: 6, borderRadius: 3, overflow: 'hidden' },
  budgetFill:       { height: '100%', borderRadius: 3 },
  overBudgetText:   { fontSize: 12, fontWeight: '600' },

  // Savings card
  savingsCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  savingsIconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  savingsIconText: { fontSize: 20 },
  savingsAmount:   { fontSize: 18, fontWeight: '800', marginBottom: 1 },
  savingsLabel:    { fontSize: 11 },

  // Loading
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 12 },
  loadingText: { fontSize: 13 },

  // Lidl banner
  lidlBanner:     { marginHorizontal: 20, marginBottom: 16, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  lidlDot:        { width: 8, height: 8, borderRadius: 4 },
  lidlBannerText: { fontSize: 13 },

  // Aisle section
  aisleSection:    { marginBottom: 14 },
  aisleHeader:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, paddingVertical: 14, paddingHorizontal: 14, paddingRight: 12, gap: 12 },
  aisleIconWrap:   { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aisleIcon:       { fontSize: 20 },
  aisleTitleBlock: { flex: 1, gap: 6 },
  aisleLabel:      { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  aisleProg:       { height: 3, borderRadius: 2, overflow: 'hidden' },
  aisleProgFill:   { height: '100%', borderRadius: 2 },
  aisleRight:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  aisleCount:      { fontSize: 12, fontWeight: '700' },
  chevronWrap:     { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chevron:         { fontSize: 14, fontWeight: '700' },

  // Items
  itemsWrap:   { paddingHorizontal: 20, gap: 6, marginTop: 6 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  checkBox:    { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark:   { fontSize: 13, fontWeight: '800', color: '#080808' },
  thumbWrap:   { width: 58, height: 58, borderRadius: 12, backgroundColor: '#ffffff', overflow: 'hidden', flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  thumb:       { width: 54, height: 54 },
  thumbFallback: { width: 58, height: 58, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji:  { fontSize: 26 },
  itemBody:    { flex: 1 },
  itemName:    { fontSize: 14, fontWeight: '500', lineHeight: 19, marginBottom: 4 },
  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  price:       { fontSize: 15, fontWeight: '800' },
  oldPrice:    { fontSize: 12, textDecorationLine: 'line-through' },
  badge:       { borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9, flexShrink: 0 },
  badgeText:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  // Footer
  footer:      { paddingHorizontal: 20, marginTop: 4, gap: 10 },
  summaryBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18 },
  summaryLeft: { flexDirection: 'row', alignItems: 'baseline' },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryOf:   { fontSize: 13 },
  clearBtn:    { borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14 },
  clearBtnText: { fontSize: 12 },
  actionRow:   { flexDirection: 'row', gap: 10 },
  actionBtn:   { flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700' },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingHorizontal: 40, paddingTop: 80, gap: 14 },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '800' },
  emptyDesc:  { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
