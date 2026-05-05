import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ShopScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleCheck = (itemId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
    }
    setCheckedItems(newChecked);
  };

  const shoppingSections = [
    {
      title: '🥩 Proteins',
      items: [
        { id: 'chicken', name: 'Chicken Breast', qty: '500g', price: '€4.50', source: 'lidl' },
        { id: 'salmon', name: 'Atlantic Salmon', qty: '300g', price: '€6.20', source: 'lidl' },
        { id: 'eggs', name: 'Free Range Eggs', qty: '12', price: '€2.80', source: 'other' },
        { id: 'tuna', name: 'Canned Tuna', qty: '2x', price: '€1.80', source: 'other' },
      ]
    },
    {
      title: '🌾 Carbs & Grains',
      items: [
        { id: 'quinoa', name: 'Quinoa', qty: '500g', price: '€2.40', source: 'lidl' },
        { id: 'oats', name: 'Rolled Oats', qty: '1kg', price: '€1.60', source: 'lidl' },
        { id: 'rice', name: 'Brown Rice', qty: '1kg', price: '€1.90', source: 'other' },
        { id: 'bread', name: 'Whole Grain Bread', qty: '1 loaf', price: '€2.10', source: 'other' },
      ]
    },
    {
      title: '🥦 Vegetables',
      items: [
        { id: 'broccoli', name: 'Broccoli', qty: '400g', price: '€1.80', source: 'lidl' },
        { id: 'spinach', name: 'Baby Spinach', qty: '200g', price: '€2.20', source: 'lidl' },
        { id: 'tomatoes', name: 'Cherry Tomatoes', qty: '250g', price: '€1.50', source: 'other' },
        { id: 'onions', name: 'Red Onions', qty: '3', price: '€0.90', source: 'other' },
      ]
    },
    {
      title: '🥛 Dairy & Alternatives',
      items: [
        { id: 'yogurt', name: 'Greek Yogurt', qty: '500g', price: '€2.40', source: 'lidl' },
        { id: 'milk', name: 'Almond Milk', qty: '1L', price: '€1.80', source: 'other' },
        { id: 'cheese', name: 'Feta Cheese', qty: '200g', price: '€3.20', source: 'other' },
      ]
    },
  ];

  const totalCost = shoppingSections
    .flatMap(section => section.items)
    .reduce((sum, item) => sum + parseFloat(item.price.replace('€', '')), 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Shopping List</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>This week&apos;s groceries</Text>
        </View>

        {/* Promo Banner */}
        <View style={[styles.promoBanner, { backgroundColor: colors.limeDim, borderColor: 'rgba(181,242,61,0.3)' }]}>
          <Text style={[styles.promoText, { color: colors.lime }]}>
            💰 <Text style={{ fontWeight: '400', color: colors.text2 }}>Save €2.40 with Lidl items</Text>
          </Text>
        </View>

        {/* Shopping Sections */}
        {shoppingSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text3 }]}>{section.title}</Text>
            <View style={styles.itemsList}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.itemRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: checkedItems.has(item.id) ? colors.border : 'transparent',
                      opacity: checkedItems.has(item.id) ? 0.45 : 1,
                    }
                  ]}
                  onPress={() => toggleCheck(item.id)}
                >
                  <View style={[styles.checkBox, { borderColor: colors.border2 }]}>
                    {checkedItems.has(item.id) && (
                      <Text style={[styles.checkMark, { color: colors.lime }]}>✓</Text>
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={[
                      styles.itemName,
                      { color: colors.text },
                      checkedItems.has(item.id) && { textDecorationLine: 'line-through' }
                    ]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemQty, { color: colors.text3 }]}>{item.qty}</Text>
                  </View>

                  {item.source === 'lidl' && (
                    <View style={[styles.lidlDot, { backgroundColor: colors.lime }]} />
                  )}
                  {item.source === 'other' && (
                    <View style={[styles.otherDot, { backgroundColor: colors.text3 }]} />
                  )}

                  <Text style={[styles.itemPrice, { color: colors.text2 }]}>
                    {item.price}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Total */}
        <View style={[styles.totalRow, { backgroundColor: colors.surface2, borderColor: colors.border2 }]}>
          <Text style={[styles.totalLabel, { color: colors.text2 }]}>Total Cost</Text>
          <Text style={[styles.totalAmount, { color: colors.lime }]}>€{totalCost.toFixed(2)}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.actionBtnText, { color: colors.text2 }]}>Share List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.lime }]}>
            <Text style={[styles.actionBtnText, { color: colors.background }]}>Order Online</Text>
          </TouchableOpacity>
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
  promoBanner: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  promoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    fontSize: 10,
    letterSpacing: 0.12,
    textTransform: 'uppercase',
  },
  itemsList: {
    paddingHorizontal: 24,
    gap: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkMark: {
    fontSize: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
  },
  itemQty: {
    fontSize: 11,
    marginTop: 2,
  },
  lidlDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  otherDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'right',
  },
  totalRow: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});