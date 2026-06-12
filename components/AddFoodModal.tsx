import { Colors } from '@/constants/theme';
import { useMenu } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { scanFoodWithAI, fetchUserRecipes, UserRecipe } from '@/services/api';
import { CameraView, BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type SheetMode =
  | 'select'
  | 'barcode'
  | 'ai'
  | 'manual'
  | 'my-recipes'
  | 'recipe-portion'
  | 'confirm';

interface Per100g { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number }

interface FoodResult {
  name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number;
  source: 'barcode' | 'ai' | 'manual'; notes?: string;
}

async function fetchOpenFoodFacts(barcode: string): Promise<{ name: string; per100g: Per100g } | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const n = p.nutriments ?? {};
    return {
      name: p.product_name_fr || p.product_name_en || p.product_name || p.generic_name || 'Unknown product',
      per100g: {
        calories: Math.round(n['energy-kcal_100g'] ?? (n['energy_100g'] ?? 0) / 4.184),
        protein_g: n.proteins_100g ?? 0,
        carbs_g: n.carbohydrates_100g ?? 0,
        fat_g: n.fat_100g ?? 0,
        fiber_g: n.fiber_100g ?? n['fiber-g_100g'] ?? undefined,
      },
    };
  } catch { return null; }
}

export function AddFoodModal({ visible, onClose, day }: { visible: boolean; onClose: () => void; day: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { addExtraMeal } = useMenu();

  const [mode, setMode] = useState<SheetMode>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FoodResult | null>(null);

  // barcode
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [per100g, setPer100g] = useState<Per100g | null>(null);
  const [productName, setProductName] = useState('');
  const [portionG, setPortionG] = useState('100');

  // ai
  const cameraRef = useRef<CameraView>(null);

  // manual
  const [mName, setMName] = useState('');
  const [mCal, setMCal] = useState('');
  const [mProtein, setMProtein] = useState('');
  const [mCarbs, setMCarbs] = useState('');
  const [mFat, setMFat] = useState('');

  // my recipes
  const [myRecipes, setMyRecipes] = useState<UserRecipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<UserRecipe | null>(null);
  const [recipePortionG, setRecipePortionG] = useState('100');
  
  const reset = useCallback(() => {
    setMode('select'); setLoading(false); setError(null); setResult(null);
    setScanned(false); setPer100g(null); setProductName(''); setPortionG('100');
    setMName(''); setMCal(''); setMProtein(''); setMCarbs(''); setMFat('');
    setRecipeSearch('');
    setSelectedRecipe(null);
    setRecipePortionG('100');
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const goBack = useCallback(() => {
    if (mode === 'recipe-portion') {
      setMode('my-recipes');
      return;
    }

    if (mode === 'confirm' && selectedRecipe) {
      setMode('recipe-portion');
      return;
    }

    setMode('select');
    setError(null);
    setScanned(false);
    setPer100g(null);
    setResult(null);
  }, [mode, selectedRecipe]);

  const ensureCameraPermission = useCallback(async (next: SheetMode) => {
    if (!permission?.granted) await requestPermission();
    setMode(next);
  }, [permission, requestPermission]);

  useEffect(() => {
    if (mode !== 'my-recipes') return;
    setRecipesLoading(true);
    fetchUserRecipes().then(setMyRecipes).finally(() => setRecipesLoading(false));
  }, [mode]);

  // ── Barcode ────────────────────────────────────────────────────────────────

  const handleBarcodeScanned = useCallback(async (scan: BarcodeScanningResult) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setError(null);
    const product = await fetchOpenFoodFacts(scan.data);
    setLoading(false);
    if (!product) {
      setError(`Barcode ${scan.data} not found. Try AI scan or enter manually.`);
      return;
    }
    setPer100g(product.per100g);
    setProductName(product.name);
    setPortionG('100');
  }, [scanned, loading]);

  const confirmBarcode = useCallback(() => {
    if (!per100g) return;
    const g = parseFloat(portionG) || 100;
    setResult({
      name: productName,
      source: 'barcode',
      calories: Math.round((per100g.calories * g) / 100),
      protein_g: Math.round((per100g.protein_g * g) / 100 * 10) / 10,
      carbs_g: Math.round((per100g.carbs_g * g) / 100 * 10) / 10,
      fat_g: Math.round((per100g.fat_g * g) / 100 * 10) / 10,
      fiber_g: per100g.fiber_g != null ? Math.round((per100g.fiber_g * g) / 100 * 10) / 10 : undefined,
    });
    setMode('confirm');
  }, [per100g, portionG, productName]);

  // ── AI ─────────────────────────────────────────────────────────────────────

  const handleAICapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5, exif: false });
      if (!photo?.base64) throw new Error('Failed to capture photo');
      const r = await scanFoodWithAI(photo.base64);
      setResult({ ...r, source: 'ai' });
      setMode('confirm');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Manual ─────────────────────────────────────────────────────────────────

  const handleManualSubmit = useCallback(() => {
    if (!mName.trim() || !parseInt(mCal)) { setError('Name and calories are required.'); return; }
    setResult({
      name: mName.trim(), source: 'manual',
      calories: parseInt(mCal) || 0,
      protein_g: parseFloat(mProtein) || 0,
      carbs_g: parseFloat(mCarbs) || 0,
      fat_g: parseFloat(mFat) || 0,
    });
    setMode('confirm');
  }, [mName, mCal, mProtein, mCarbs, mFat]);

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    if (!result) return;
    addExtraMeal(day, result);
    handleClose();
  }, [result, day, addExtraMeal, handleClose]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const MacroStrip = ({ cal, p, c, f, fiber }: { cal: number; p: number; c: number; f: number; fiber?: number }) => {
    const items = [
      { label: 'Cal', value: `${cal}`, color: colors.text },
      { label: 'Protein', value: `${p}g`, color: colors.lime },
      { label: 'Carbs', value: `${c}g`, color: colors.blue },
      { label: 'Fat', value: `${f}g`, color: colors.orange },
      ...(fiber != null ? [{ label: 'Fiber', value: `${fiber}g`, color: '#b380ff' }] : []),
    ];
    return (
      <View style={[styles.macroStrip, { borderColor: colors.border }]}>
        {items.map(m => (
          <View key={m.label} style={styles.macroItem}>
            <Text style={[styles.macroVal, { color: m.color }]}>{m.value}</Text>
            <Text style={[styles.macroLabel, { color: colors.text3 }]}>{m.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const CameraPermissionPrompt = () => (
    <View style={styles.center}>
      <Text style={[styles.permText, { color: colors.text }]}>Camera access needed</Text>
      <TouchableOpacity style={[styles.permBtn, { backgroundColor: colors.lime }]} onPress={requestPermission}>
        <Text style={{ color: colors.background, fontWeight: '700' }}>Grant Access</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Mode screens ───────────────────────────────────────────────────────────

  const renderSelect = () => (
    <View style={styles.selectWrap}>
      <Text style={[styles.title, { color: colors.text }]}>Add Food</Text>
      <Text style={[styles.subtitle, { color: colors.text3 }]}>How would you like to log this?</Text>
      {[
        { icon: '📷', title: 'Scan Barcode', desc: 'Point camera at product barcode', next: 'barcode' as SheetMode, accent: true },
        { icon: '🤖', title: 'AI Food Scan', desc: 'Take a photo — AI estimates macros', next: 'ai' as SheetMode, accent: false },
        { icon: '📖', title: 'My Recipes', desc: 'Pick from your saved recipes', next: 'my-recipes' as SheetMode, accent: false },
        { icon: '✏️', title: 'Enter Manually', desc: 'Type in the nutritional values', next: 'manual' as SheetMode, accent: false },
      ].map(opt => (
        <TouchableOpacity
          key={opt.title}
          style={[styles.optionCard, { backgroundColor: colors.surface3, borderColor: opt.accent ? colors.lime : colors.border }]}
          onPress={() => (opt.next === 'barcode' || opt.next === 'ai') ? ensureCameraPermission(opt.next) : setMode(opt.next)}
        >
          <Text style={styles.optionIcon}>{opt.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>{opt.title}</Text>
            <Text style={[styles.optionDesc, { color: colors.text3 }]}>{opt.desc}</Text>
          </View>
          <Text style={[{ fontSize: 20, color: colors.text3 }]}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBarcode = () => {
    if (!permission?.granted) return <CameraPermissionPrompt />;

    if (per100g) {
      const g = parseFloat(portionG) || 100;
      const cal = Math.round((per100g.calories * g) / 100);
      const p = Math.round(per100g.protein_g * g / 100 * 10) / 10;
      const c = Math.round(per100g.carbs_g * g / 100 * 10) / 10;
      const f = Math.round(per100g.fat_g * g / 100 * 10) / 10;
      const fiber = per100g.fiber_g != null ? Math.round(per100g.fiber_g * g / 100 * 10) / 10 : undefined;
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.padded}>
          <Text style={[styles.title, { color: colors.text }]}>{productName}</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>Adjust portion size</Text>
          <View style={[styles.portionRow, { borderColor: colors.border, backgroundColor: colors.surface3 }]}>
            <Text style={[styles.portionLabel, { color: colors.text3 }]}>Portion (g)</Text>
            <TextInput
              style={[styles.portionInput, { color: colors.text }]}
              keyboardType="numeric"
              value={portionG}
              onChangeText={setPortionG}
            />
          </View>
          <MacroStrip cal={cal} p={p} c={c} f={f} fiber={fiber} />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.lime }]} onPress={confirmBarcode}>
            <Text style={[styles.addBtnText, { color: colors.background }]}>Add to Today</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        {!scanned && (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          />
        )}
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={[styles.scanBox, { borderColor: colors.lime }]} />
          <Text style={[styles.scanHint, { color: '#fff' }]}>Align barcode within the box</Text>
        </View>
        {loading && (
          <View style={[styles.scanOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <ActivityIndicator color={colors.lime} size="large" />
            <Text style={{ color: colors.text, marginTop: 12 }}>Looking up product…</Text>
          </View>
        )}
        {error && (
          <View style={[styles.scanOverlay, { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 32 }]}>
            <Text style={{ color: colors.orange, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
            <TouchableOpacity onPress={() => { setError(null); setScanned(false); }}>
              <Text style={{ color: colors.lime, fontWeight: '700', marginBottom: 10 }}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setError(null); ensureCameraPermission('ai'); }}>
              <Text style={{ color: colors.text3 }}>Try AI scan instead</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderAI = () => {
    if (!permission?.granted) return <CameraPermissionPrompt />;
    return (
      <View style={{ flex: 1 }}>
        {!loading && <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />}
        {loading && (
          <View style={[styles.scanOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <ActivityIndicator color={colors.lime} size="large" />
            <Text style={{ color: colors.text, marginTop: 12 }}>Analysing food…</Text>
          </View>
        )}
        {!loading && (
          <View style={styles.captureRow}>
            <TouchableOpacity style={[styles.captureBtn, { backgroundColor: colors.lime }]} onPress={handleAICapture}>
              <Text style={[styles.captureBtnText, { color: colors.background }]}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        )}
        {error && (
          <View style={[styles.scanOverlay, { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 32 }]}>
            <Text style={{ color: colors.orange, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={{ color: colors.lime, fontWeight: '700', marginBottom: 10 }}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setError(null); setMode('manual'); }}>
              <Text style={{ color: colors.text3 }}>Enter manually instead</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderManual = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.padded} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>Add manually</Text>
        {([
          { label: 'Food name *', value: mName, set: setMName, kb: 'default' as const },
          { label: 'Calories *', value: mCal, set: setMCal, kb: 'numeric' as const },
          { label: 'Protein (g)', value: mProtein, set: setMProtein, kb: 'decimal-pad' as const },
          { label: 'Carbs (g)', value: mCarbs, set: setMCarbs, kb: 'decimal-pad' as const },
          { label: 'Fat (g)', value: mFat, set: setMFat, kb: 'decimal-pad' as const },
        ] as const).map(f => (
          <View key={f.label} style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.text3 }]}>{f.label}</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface3 }]}
              value={f.value}
              onChangeText={f.set}
              keyboardType={f.kb}
              placeholderTextColor={colors.text3}
              placeholder="0"
            />
          </View>
        ))}
        {error && <Text style={[styles.errText, { color: colors.orange }]}>{error}</Text>}
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.lime }]} onPress={handleManualSubmit}>
          <Text style={[styles.addBtnText, { color: colors.background }]}>Continue</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderMyRecipes = () => {
    const filtered = myRecipes.filter(r =>
      !recipeSearch || r.name.toLowerCase().includes(recipeSearch.toLowerCase())
    );
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.padded} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]}>My Recipes</Text>
          <TextInput
            style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface3, marginBottom: 16 }]}
            placeholder="Search recipes…"
            placeholderTextColor={colors.text3}
            value={recipeSearch}
            onChangeText={setRecipeSearch}
            clearButtonMode="while-editing"
          />
          {recipesLoading && <ActivityIndicator color={colors.lime} style={{ marginTop: 24 }} />}
          {!recipesLoading && filtered.length === 0 && (
            <Text style={[styles.subtitle, { color: colors.text3, textAlign: 'center', marginTop: 24 }]}>
              {myRecipes.length === 0 ? 'No saved recipes yet.' : 'No match.'}
            </Text>
          )}
          {filtered.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.optionCard, { backgroundColor: colors.surface3, borderColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginBottom: 12 }]}
                onPress={() => {
                  setSelectedRecipe(r);
                  setRecipePortionG('100');
                  setMode('recipe-portion');
                }}
                >
              <Text style={[styles.optionTitle, { color: colors.text }]}>{r.name}</Text>
              <Text style={[styles.optionDesc, { color: colors.text3 }]}>
                {r.calories} kcal · P {r.protein_g}g · C {r.carbs_g}g · F {r.fat_g}g
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const renderRecipePortion = () => {
    if (!selectedRecipe) return null;

    const g = parseFloat(recipePortionG) || 100;

    const calories = Math.round((selectedRecipe.calories * g) / 100);
    const protein = Math.round((selectedRecipe.protein_g * g) / 100 * 10) / 10;
    const carbs = Math.round((selectedRecipe.carbs_g * g) / 100 * 10) / 10;
    const fat = Math.round((selectedRecipe.fat_g * g) / 100 * 10) / 10;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.padded}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          {selectedRecipe.name}
        </Text>

        <Text style={[styles.subtitle, { color: colors.text3 }]}>
          Adjust portion size
        </Text>

        <View
          style={[
            styles.portionRow,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface3,
            },
          ]}
        >
          <Text
            style={[
              styles.portionLabel,
              { color: colors.text3 },
            ]}
          >
            Portion (g)
          </Text>

          <TextInput
            style={[
              styles.portionInput,
              { color: colors.text },
            ]}
            keyboardType="numeric"
            value={recipePortionG}
            onChangeText={setRecipePortionG}
          />
        </View>

        <MacroStrip
          cal={calories}
          p={protein}
          c={carbs}
          f={fat}
        />

        <TouchableOpacity
          style={[
            styles.addBtn,
            { backgroundColor: colors.lime },
          ]}
          onPress={() => {
            setResult({
              name: selectedRecipe.name,
              calories,
              protein_g: protein,
              carbs_g: carbs,
              fat_g: fat,
              source: 'manual',
            });

            setMode('confirm');
          }}
        >
          <Text
            style={[
              styles.addBtnText,
              { color: colors.background },
            ]}
          >
            Continue
          </Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  };

  const renderConfirm = () => {
    if (!result) return null;
    const sourceLabel = result.source === 'barcode' ? '📷 From barcode' : result.source === 'ai' ? '🤖 AI estimated' : '✏️ Manually entered';
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.padded}>
        <Text style={[styles.title, { color: colors.text }]}>{result.name}</Text>
        {result.notes && <Text style={[styles.subtitle, { color: colors.text3 }]}>{result.notes}</Text>}
        <MacroStrip cal={result.calories} p={result.protein_g} c={result.carbs_g} f={result.fat_g} fiber={result.fiber_g} />
        <View style={[styles.sourceTag, { backgroundColor: colors.surface3 }]}>
          <Text style={[styles.sourceText, { color: colors.text3 }]}>{sourceLabel}</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.lime }]} onPress={handleAdd}>
          <Text style={[styles.addBtnText, { color: colors.background }]}>Add to Today</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  };

  const noPadding =
    mode === 'barcode' ||
    mode === 'ai' ||
    mode === 'my-recipes';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {mode !== 'select' ? (
              <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                <Text style={[styles.backText, { color: colors.text3 }]}>‹ Back</Text>
              </TouchableOpacity>
            ) : <View style={{ width: 56 }} />}
            <TouchableOpacity onPress={handleClose}>
              <Text style={[styles.closeText, { color: colors.text3 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={[{ flex: 1 }, !noPadding && styles.padded]}>
              {mode === 'select' && renderSelect()}
              {mode === 'barcode' && renderBarcode()}
              {mode === 'ai' && renderAI()}
              {mode === 'manual' && renderManual()}
              {mode === 'my-recipes' && renderMyRecipes()}
              {mode === 'recipe-portion' && renderRecipePortion()}
              {mode === 'confirm' && renderConfirm()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { height: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 16 },
  closeText: { fontSize: 18, padding: 4 },
  padded: { paddingHorizontal: 24, paddingTop: 8 },
  selectWrap: { paddingTop: 8, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 20 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 16 },
  optionIcon: { fontSize: 24 },
  optionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  optionDesc: { fontSize: 12 },
  // barcode / ai camera
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanBox: { width: 220, height: 120, borderWidth: 2, borderRadius: 12, marginBottom: 16 },
  scanHint: { fontSize: 13 },
  captureRow: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  captureBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 32 },
  captureBtnText: { fontSize: 16, fontWeight: '700' },
  // portion
  portionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  portionLabel: { fontSize: 14 },
  portionInput: { fontSize: 20, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  // macros
  macroStrip: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  macroItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  macroVal: { fontSize: 15, fontWeight: '700' },
  macroLabel: { fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  // manual form
  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  errText: { fontSize: 12, marginBottom: 10 },
  // confirm
  sourceTag: { borderRadius: 10, padding: 10, marginBottom: 20, alignItems: 'center' },
  sourceText: { fontSize: 12 },
  // shared
  addBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  addBtnText: { fontSize: 15, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permText: { fontSize: 16, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  permBtn: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
});
