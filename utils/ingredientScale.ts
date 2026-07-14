// Ingredients from the AI are free-text strings like "200g chicken breast" or
// "2 tbsp olive oil" — no structured {qty, unit, item}. To scale a plan for a
// household of N people we parse a leading quantity out of each string,
// multiply it, and reassemble. Strings with no parseable leading quantity
// ("salt to taste", "olive oil") are left unchanged rather than erroring —
// scaling those is neither possible nor necessary.

// Mirrors the unit vocabulary of app/(tabs)/shop.tsx's stripQty() so parsing
// and catalog-matching stay consistent.
const QTY_UNIT_RE = /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|cl|l|x|pc|pcs|tbsp|tsp|cup|oz|lb|piece|tranches?|filets?)?\s*(.*)$/i;

// Units the AI writes with no space before them (e.g. "200g"), based on the
// generation prompt's own examples in backend/src/generateMenu.ts.
const NO_SPACE_UNITS = new Set(['g', 'kg', 'ml', 'cl', 'l']);

export interface ParsedIngredient {
  qty: number;
  unit: string;
  rest: string;
}

export function parseIngredientQuantity(ingredient: string): ParsedIngredient | null {
  const match = ingredient.trim().match(QTY_UNIT_RE);
  if (!match) return null;
  const [, qtyStr, unit, rest] = match;
  const qty = parseFloat(qtyStr.replace(',', '.'));
  if (isNaN(qty)) return null;
  return { qty, unit: unit ?? '', rest: rest.trim() };
}

// Whole numbers below 20 (most per-item/spoon quantities), nearest 5 above
// (typical gram/ml weights) — good enough for a shopping estimate, not meant
// to be exact.
function roundScaled(qty: number): number {
  if (qty < 20) return Math.round(qty);
  return Math.round(qty / 5) * 5;
}

export function scaleIngredient(ingredient: string, factor: number): string {
  if (factor === 1) return ingredient;
  const parsed = parseIngredientQuantity(ingredient);
  if (!parsed) return ingredient;
  const scaledQty = roundScaled(parsed.qty * factor);
  const unitPart = parsed.unit
    ? (NO_SPACE_UNITS.has(parsed.unit.toLowerCase()) ? parsed.unit : ` ${parsed.unit}`)
    : '';
  return `${scaledQty}${unitPart}${parsed.rest ? ' ' + parsed.rest : ''}`.trim();
}

export function scaleIngredients(ingredients: string[], people: number): string[] {
  return ingredients.map(ing => scaleIngredient(ing, people));
}
