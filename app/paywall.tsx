import { useLang } from '@/context/LangContext';
import { usePurchases } from '@/context/PurchasesContext';
import { PACKAGE_IDS } from '@/lib/purchases';
import { DayPlan, generateMenuTeaser } from '@/services/api';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

// TODO: add real URLs before App Store submission (Guideline 3.1.2)
const TERMS_URL = '';
const PRIVACY_URL = '';

// Exact palette from the HTML mockup
const M = {
  bg:           '#080808',
  card:         '#121211',
  footerBg:     '#0a0a09',
  line:         '#1d1d1b',
  ink:          '#f4f4f2',
  mut:          '#8a8a85',
  chipText:     '#c9c9c4',
  chipBg:       '#161614',
  lime:         '#b5f23d',
  limeBg:       'rgba(181,242,61,0.1)',
  limeBorder:   'rgba(181,242,61,0.3)',
  limeSelected: 'rgba(181,242,61,0.06)',
  unlockBg:     '#161614',
  unlockBorder: '#2a2a26',
  finePrint:    '#56564f',
  closeBtn:     '#141412',
  closeTxt:     '#6a6a66',
  kindLabel:    '#5e5e5a',
};

const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });
const TEASER_CACHE_KEY = `dano_teaser_${TODAY}`;

// Static locked-day previews — marketing copy showing the type of meals users unlock
const LOCKED_MEALS = [
  { day: 'Tuesday',   name: 'Turkey meatball & orzo traybake',  protein: 46 },
  { day: 'Wednesday', name: 'Halloumi & chickpea power bowl',    protein: 33 },
  { day: 'Thursday',  name: 'Salmon, greens & new potatoes',     protein: 40 },
  { day: 'Friday',    name: 'Beef chilli & rice',                protein: 44 },
];

function isAnnual(pkg: PurchasesPackage) {
  return pkg.packageType === 'ANNUAL' || pkg.identifier === PACKAGE_IDS.yearly;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const { isReady, isPremium, offering, purchase, restore } = usePurchases();

  const packages = offering?.availablePackages ?? [];
  const sorted = [...packages].sort((a, b) => (isAnnual(a) ? -1 : 1) - (isAnnual(b) ? -1 : 1));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => { if (isPremium) router.replace('/(tabs)'); }, [isPremium, router]);

  // Fetch teaser independently (this screen is reachable before (tabs) mounts)
  useEffect(() => {
    if (isPremium) return;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(TEASER_CACHE_KEY);
        if (cached) { setDayPlan(JSON.parse(cached)); return; }
        const { data: { user } } = await supabase.auth.getUser();
        let cal = 2000, prefs = '', diet = '';
        if (user) {
          const { data: p } = await supabase.from('user_profiles')
            .select('daily_calories,preferences,dietary_restrictions')
            .eq('user_id', user.id).maybeSingle();
          if (p) { cal = p.daily_calories ?? 2000; prefs = p.preferences ?? ''; diet = p.dietary_restrictions ?? ''; }
        }
        const teaser = await generateMenuTeaser({ targetCalories: cal, preferences: prefs, dietaryRestrictions: diet, teaserDay: TODAY });
        const day = teaser.days[0] ?? null;
        setDayPlan(day);
        if (day) AsyncStorage.setItem(TEASER_CACHE_KEY, JSON.stringify(day)).catch(() => {});
      } catch { setDayPlan(null); }
      finally { setPlanLoading(false); }
    })();
  }, [isPremium]);

  useEffect(() => {
    if (sorted.length && !selectedId) setSelectedId((sorted.find(isAnnual) ?? sorted[0]).identifier);
  }, [sorted, selectedId]);

  const selected = sorted.find(p => p.identifier === selectedId) ?? null;
  const selAnnual = selected ? isAnnual(selected) : true;

  // Per-month equivalent price for annual plan
  const annualPkg = sorted.find(isAnnual);
  const monthlyPkg = sorted.find(p => !isAnnual(p));
  const currSym = annualPkg ? annualPkg.product.priceString.replace(/[\d.,\s]/g, '')[0] ?? '' : '';
  const perMonth = annualPkg ? `${currSym}${(annualPkg.product.price / 12).toFixed(2)}/mo` : null;
  const savePct = annualPkg && monthlyPkg && monthlyPkg.product.price > 0
    ? Math.round((1 - annualPkg.product.price / (monthlyPkg.product.price * 12)) * 100) : null;

  const MEAL_LABELS = ['Breakfast', 'Lunch', 'Dinner'];

  async function handlePurchase() {
    if (!selected) return;
    setError(null); setPurchasing(true);
    try {
      await purchase(selected);
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e?.userCancelled) return;
      setError(e?.message ?? 'Purchase failed. Please try again.');
    } finally { setPurchasing(false); }
  }

  async function handleRestore() {
    setError(null); setRestoring(true);
    try { await restore(); }
    catch (e: any) { setError(e?.message ?? 'Could not restore purchases.'); }
    finally { setRestoring(false); }
  }

  function openLegal(url: string) {
    if (!url) { Alert.alert('Coming soon', "This page isn't available yet."); return; }
    Linking.openURL(url).catch(() => {});
  }

  const lockedLocale: Record<string, Record<string, string>> = {
    en: { Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday',
          Friday: 'Friday', Saturday: 'Saturday', Sunday: 'Sunday' },
    fr: { Monday: 'Lundi', Tuesday: 'Mardi', Wednesday: 'Mercredi', Thursday: 'Jeudi',
          Friday: 'Vendredi', Saturday: 'Samedi', Sunday: 'Dimanche' },
  };
  const dayName = (d: string) => (lockedLocale[lang] ?? lockedLocale['en'])[d] ?? d;

  return (
    <SafeAreaView style={s.root}>

      {/* ─── Scroll area ─────────────────────────────────────────────────── */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}>

        {/* Top bar */}
        <View style={s.topbar}>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={s.wordmark}>dan<Text style={{ color: M.lime }}>o</Text></Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Heading */}
        <Text style={s.h1}>Your high-protein{'\n'}week, sorted.</Text>

        {/* Chips */}
        <View style={s.chips}>
          <View style={[s.chip, { backgroundColor: M.limeBg, borderColor: M.limeBorder }]}>
            <Text style={[s.chipTxt, { color: M.lime }]}>High protein</Text>
          </View>
          <View style={[s.chip, { backgroundColor: M.chipBg, borderColor: M.line }]}>
            <Text style={[s.chipTxt, { color: M.chipText }]}>Under £35</Text>
          </View>
          <View style={[s.chip, { backgroundColor: M.chipBg, borderColor: M.line }]}>
            <Text style={[s.chipTxt, { color: M.chipText }]}>Lidl</Text>
          </View>
          <View style={[s.chip, { backgroundColor: M.chipBg, borderColor: M.line }]}>
            <Text style={[s.chipTxt, { color: M.chipText }]}>7 dinners</Text>
          </View>
        </View>

        {/* Savings */}
        <View style={s.savingsRow}>
          <Text style={{ color: M.lime, fontSize: 13 }}>●</Text>
          <Text style={s.savingsTxt}>
            <Text style={{ color: M.ink, fontWeight: '700' }}>↓ £32 at Lidl</Text>
            {' this week — pays for itself in two shops'}
          </Text>
        </View>

        {/* Day-1 tag */}
        <View style={s.day1Tag}>
          <Text style={s.day1Lbl}>{dayName(TODAY)}</Text>
          <View style={s.day1Pill}>
            <Text style={s.day1PillTxt}>Day 1 · unlocked</Text>
          </View>
        </View>

        {/* Day-1 card */}
        <View style={s.card}>
          {planLoading ? (
            <ActivityIndicator color={M.lime} style={{ paddingVertical: 24 }} />
          ) : dayPlan && (
            dayPlan.meals.map((meal, i) => (
              <View key={i} style={[s.mealRow, i < dayPlan.meals.length - 1 && s.mealBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mealKind}>{MEAL_LABELS[i] ?? ''}</Text>
                  <Text style={s.mealName} numberOfLines={2}>{meal.name}</Text>
                </View>
                <Text style={s.mealMacro}>
                  <Text style={{ color: M.lime, fontWeight: '700' }}>{meal.protein_g}g</Text>
                  {' protein\n'}{meal.calories} kcal
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Locked section */}
        <View style={s.lockedWrap}>
          {/* Dimmed meals — no blur available in RN without expo-blur */}
          <View style={[s.card, { opacity: 0.55, marginTop: 10 }]}>
            {LOCKED_MEALS.map((m, i) => (
              <View key={m.day} style={[s.mealRow, { paddingVertical: 12 }, i < LOCKED_MEALS.length - 1 && s.mealBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mealKind}>{dayName(m.day)}</Text>
                  <Text style={s.mealName}>{m.name}</Text>
                </View>
                <Text style={s.mealMacro}>
                  <Text style={{ color: M.lime, fontWeight: '700' }}>{m.protein}g</Text>
                  {' protein'}
                </Text>
              </View>
            ))}
          </View>

          {/* Gradient overlay simulation (3 layers: transparent → semi → dark) */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={{ flex: 0.28 }} />
            <View style={{ flex: 0.22, backgroundColor: 'rgba(8,8,8,0.45)' }} />
            <View style={{ flex: 0.50, backgroundColor: 'rgba(8,8,8,0.88)' }} />
          </View>

          {/* Unlock pill */}
          <View style={s.lockMaskRow} pointerEvents="none">
            <View style={s.unlockPill}>
              <Text style={{ color: M.lime, fontSize: 14 }}>🔒</Text>
              <Text style={s.unlockTxt}>6 more days ready to unlock</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <View style={s.footer}>

        {/* Plans */}
        {!isReady ? (
          <ActivityIndicator color={M.lime} style={{ marginVertical: 14 }} />
        ) : sorted.length ? (
          <View style={s.plans}>
            {sorted.map(pkg => {
              const annual = isAnnual(pkg);
              const sel = selectedId === pkg.identifier;
              return (
                <TouchableOpacity key={pkg.identifier} activeOpacity={0.85}
                  style={[s.plan, sel && s.planSelected]}
                  onPress={() => setSelectedId(pkg.identifier)}>
                  {annual && (
                    <View style={s.badgeWrap}>
                      <View style={s.badge}>
                        <Text style={s.badgeTxt}>7-day free trial</Text>
                      </View>
                    </View>
                  )}
                  <Text style={s.planName}>{annual ? 'Annual' : 'Monthly'}</Text>
                  <Text style={s.planPrice}>{pkg.product.priceString}</Text>
                  <Text style={s.planPer}>
                    {annual && perMonth ? `${perMonth}${savePct != null ? ` · best value` : ''}` : 'per month'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={[s.planPer, { textAlign: 'center', marginVertical: 14 }]}>
            Billing unavailable right now. Try again later.
          </Text>
        )}

        {/* Timeline */}
        <View style={[s.timeline, !selAnnual && { opacity: 0.35 }]}>
          <View style={s.tlStep}>
            <Text style={{ fontSize: 12, color: M.lime, marginRight: 5 }}>✓</Text>
            <Text style={s.tlTxt}><Text style={s.tlBold}>Today</Text>{' unlocked'}</Text>
          </View>
          <View style={s.tlSep} />
          <View style={s.tlStep}>
            <Text style={{ fontSize: 11, marginRight: 5 }}>🔔</Text>
            <Text style={s.tlTxt}><Text style={s.tlBold}>Day 5</Text>{' reminder'}</Text>
          </View>
          <View style={s.tlSep} />
          <View style={s.tlStep}>
            <Text style={s.tlTxt}>
              <Text style={s.tlBold}>Day 7</Text>
              {'  '}{selected?.product.priceString ?? ''}
            </Text>
          </View>
        </View>

        {error != null && <Text style={s.errorTxt}>{error}</Text>}

        {/* CTA */}
        <TouchableOpacity style={[s.cta, (!selected || purchasing) && { opacity: 0.55 }]}
          onPress={handlePurchase} disabled={!selected || purchasing} activeOpacity={0.88}>
          {purchasing
            ? <ActivityIndicator color="#0a0a0a" />
            : <Text style={s.ctaTxt}>
                {selAnnual ? 'Start 7-day free trial' : `Subscribe → ${selected?.product.priceString ?? ''}/mo`}
              </Text>}
        </TouchableOpacity>

        {/* Fine print */}
        <Text style={s.fine}>
          {selAnnual
            ? `Then ${selected?.product.priceString ?? ''}/year. Cancel anytime in Settings.`
            : `Billed ${selected?.product.priceString ?? ''}/month. Cancel anytime in Settings.`}
          {'\n'}
          <Text style={s.fineLink} onPress={handleRestore}>{restoring ? 'Restoring…' : 'Restore'}</Text>
          {'  ·  '}
          <Text style={s.fineLink} onPress={() => openLegal(TERMS_URL)}>Terms</Text>
          {'  ·  '}
          <Text style={s.fineLink} onPress={() => openLegal(PRIVACY_URL)}>Privacy</Text>
        </Text>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: M.bg },
  scroll:       { flex: 1, paddingHorizontal: 20 },

  // Topbar
  topbar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 32, marginBottom: 6, paddingTop: 4 },
  closeBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: M.closeBtn, alignItems: 'center', justifyContent: 'center' },
  closeTxt:     { fontSize: 14, color: M.closeTxt },
  wordmark:     { fontSize: 19, fontWeight: '700', color: M.ink, letterSpacing: -0.2 },

  // Heading
  h1:           { fontSize:40, fontWeight: '900', lineHeight: 30, letterSpacing: -0.6, color: M.ink, marginTop: 14, marginBottom: 12, paddingTop: 25, paddingBottom: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 },

  // Chips
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 13 },
  chip:         { borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  chipTxt:      { fontSize: 11.5, fontWeight: '600' },

  // Savings
  savingsRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  savingsTxt:   { fontSize: 13, color: M.mut, flex: 1, lineHeight: 18 },

  // Day-1 tag
  day1Tag:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 2, marginBottom: 8 },
  day1Lbl:      { fontSize: 20, fontWeight: '600', color: M.ink },
  day1Pill:     { backgroundColor: M.lime, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 5 },
  day1PillTxt:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: '#0a0a0a' },

  // Cards
  card:         { backgroundColor: M.card, borderRadius: 16, overflow: 'hidden' },
  mealRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 17, paddingHorizontal: 15 },
  mealBorder:   { borderBottomWidth: 1, borderBottomColor: M.line },
  mealKind:     { fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: M.kindLabel, marginBottom: 3 },
  mealName:     { fontSize: 14.5, fontWeight: '600', color: M.ink },
  mealMacro:    { fontSize: 12, color: M.mut, textAlign: 'right' },

  // Locked
  lockedWrap:   { position: 'relative', marginBottom: 6 },
  lockMaskRow:  { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  unlockPill:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: M.unlockBg, borderWidth: 1, borderColor: M.unlockBorder, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  unlockTxt:    { fontSize: 13, fontWeight: '600', color: M.ink },

  // Footer
  footer:       { backgroundColor: M.footerBg, borderTopWidth: 1, borderTopColor: M.line, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 },

  // Plans
  plans:        { flexDirection: 'row', gap: 9, marginBottom: 11, paddingTop: 10 },
  plan:         { flex: 1, backgroundColor: M.card, borderWidth: 1.5, borderColor: M.line, borderRadius: 15, padding: 12, paddingHorizontal: 13, position: 'relative' },
  planSelected: { borderColor: M.lime, backgroundColor: M.limeSelected },
  badgeWrap:    { position: 'absolute', top: -10, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  badge:        { backgroundColor: M.lime, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5 },
  badgeTxt:     { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#0a0a0a' },
  planName:     { fontSize: 14, fontWeight: '700', color: M.ink },
  planPrice:    { fontSize: 16, fontWeight: '700', color: M.ink, marginTop: 3 },
  planPer:      { fontSize: 11.5, fontWeight: '500', color: M.mut, marginTop: 1 },

  // Timeline
  timeline:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginVertical: 4, marginHorizontal: 2, marginBottom: 12 },
  tlStep:       { flexDirection: 'row', alignItems: 'center' },
  tlSep:        { flex: 1, height: 1, backgroundColor: M.line, marginHorizontal: 2 },
  tlTxt:        { fontSize: 11, color: M.mut },
  tlBold:       { color: M.ink, fontWeight: '600' },

  // CTA
  errorTxt:     { fontSize: 13, color: '#ff6b35', textAlign: 'center', marginBottom: 8 },
  cta:          { width: '100%', backgroundColor: M.lime, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ctaTxt:       { fontSize: 16.5, fontWeight: '600', letterSpacing: -0.2, color: '#0a0a0a' },

  // Fine print
  fine:         { textAlign: 'center', color: M.finePrint, fontSize: 11, marginTop: 9, lineHeight: 16 },
  fineLink:     { color: M.mut },
});
