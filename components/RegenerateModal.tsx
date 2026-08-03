import { Colors } from '@/constants/theme';
import { useLang } from '@/context/LangContext';
import { RegenerateOptions } from '@/context/MenuContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchUserRecipes, UserRecipe } from '@/services/api';
import React, { useEffect, useState } from 'react';
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

export function RegenerateModal({
  visible, onClose, onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (opts: RegenerateOptions) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { t } = useLang();

  const [generalNotes, setGeneralNotes] = useState('');
  const [includedRecipes, setIncludedRecipes] = useState('');
  const [savedRecipes, setSavedRecipes] = useState<UserRecipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setRecipesLoading(true);
    fetchUserRecipes()
      .then(setSavedRecipes)
      .catch(() => setSavedRecipes([]))
      .finally(() => setRecipesLoading(false));
  }, [visible]);

  const toggleRecipe = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setGeneralNotes('');
    setIncludedRecipes('');
    setSelectedIds(new Set());
    onClose();
  };

  const handleSubmit = () => {
    onSubmit({
      generalNotes: generalNotes.trim() || undefined,
      includedRecipes: includedRecipes.trim() || undefined,
      selectedRecipeIds: selectedIds.size ? Array.from(selectedIds) : undefined,
    });
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.handle} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.padded} keyboardShouldPersistTaps="handled">
              <Text style={[styles.title, { color: colors.text }]}>{t('regenTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.text3 }]}>{t('regenSubtitle')}</Text>

              <Text style={[styles.fieldLabel, { color: colors.text2 }]}>{t('regenNotesLabel')}</Text>
              <TextInput
                style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface3 }]}
                value={generalNotes}
                onChangeText={setGeneralNotes}
                placeholder={t('regenNotesPlaceholder')}
                placeholderTextColor={colors.text3}
                multiline
              />

              <Text style={[styles.fieldLabel, { color: colors.text2, marginTop: 20 }]}>{t('regenRecipesLabel')}</Text>
              <TextInput
                style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface3 }]}
                value={includedRecipes}
                onChangeText={setIncludedRecipes}
                placeholder={t('regenRecipesPlaceholder')}
                placeholderTextColor={colors.text3}
                multiline
              />

              <Text style={[styles.fieldLabel, { color: colors.text2, marginTop: 20 }]}>
                {t('regenPickLabel')}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Text>

              {recipesLoading && <ActivityIndicator color={colors.lime} style={{ marginVertical: 12 }} />}

              {!recipesLoading && savedRecipes.length === 0 && (
                <Text style={[styles.subtitle, { color: colors.text3 }]}>{t('regenPickEmpty')}</Text>
              )}

              {!recipesLoading && savedRecipes.map(recipe => {
                const selected = selectedIds.has(recipe.id);
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[
                      styles.recipeRow,
                      { borderColor: selected ? colors.lime : colors.border, backgroundColor: colors.surface3 },
                    ]}
                    onPress={() => toggleRecipe(recipe.id)}
                  >
                    <View style={[styles.checkbox, { borderColor: selected ? colors.lime : colors.border, backgroundColor: selected ? colors.lime : 'transparent' }]}>
                      {selected && <Text style={[styles.checkboxMark, { color: colors.background }]}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recipeName, { color: colors.text }]}>{recipe.name}</Text>
                      <Text style={[styles.recipeMeta, { color: colors.text3 }]}>
                        {recipe.calories} kcal · P {recipe.protein_g}g · C {recipe.carbs_g}g · F {recipe.fat_g}g
                      </Text>
                    </View>
                    {recipe.source === 'tiktok' && (
                      <View style={[styles.tag, { backgroundColor: colors.surface2 }]}>
                        <Text style={[styles.tagText, { color: colors.text2 }]}>TikTok</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.lime }]} onPress={handleSubmit}>
                <Text style={[styles.submitBtnText, { color: colors.background }]}>{t('regenSubmit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={[styles.cancelBtnText, { color: colors.text3 }]}>{t('regenCancel')}</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  padded: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  textArea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, height: 80, textAlignVertical: 'top' },
  recipeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { fontSize: 13, fontWeight: '700' },
  recipeName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recipeMeta: { fontSize: 11 },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 10, fontWeight: '700' },
  submitBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  submitBtnText: { fontSize: 15, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14 },
});
