import { BR } from '../br/theme'

/**
 * The eight allergens tracked during solid-food introduction, and the coarse food
 * groups a meal can cover. Both vocabularies mirror `backend/app/food_tags.py` —
 * the LLM writes these exact keys onto every `food` entry.
 */
export const ALLERGENS = [
  'peanut',
  'egg',
  'gluten',
  'fish',
  'soy',
  'milk',
  'sesame',
  'shellfish',
] as const

export type Allergen = (typeof ALLERGENS)[number]

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  peanut: 'PEANUT',
  egg: 'EGG',
  gluten: 'GLUTEN',
  fish: 'FISH',
  soy: 'SOY',
  milk: 'MILK',
  sesame: 'SESAME',
  shellfish: 'SHELLFISH',
}

/** Russian names, shown under the key so the log and the panel read the same. */
export const ALLERGEN_LABELS_RU: Record<Allergen, string> = {
  peanut: 'арахис',
  egg: 'яйцо',
  gluten: 'глютен',
  fish: 'рыба',
  soy: 'соя',
  milk: 'коровье молоко',
  sesame: 'кунжут',
  shellfish: 'ракообразные и моллюски',
}

export const FOOD_GROUPS = ['protein', 'fat', 'carbs', 'fiber', 'produce'] as const

export type FoodGroup = (typeof FOOD_GROUPS)[number]

export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  protein: 'PROT',
  fat: 'FAT',
  carbs: 'CARB',
  fiber: 'FIBER',
  produce: 'VEG/FR',
}

export const FOOD_GROUP_LABELS_RU: Record<FoodGroup, string> = {
  protein: 'белки',
  fat: 'жиры',
  carbs: 'углеводы',
  fiber: 'клетчатка',
  produce: 'овощи/фрукты',
}

export const FOOD_GROUP_COLORS: Record<FoodGroup, string> = {
  protein: BR.rose,
  fat: BR.amber,
  carbs: BR.stool,
  fiber: BR.leaf,
  produce: BR.cyan,
}

export function isAllergen(value: string): value is Allergen {
  return (ALLERGENS as readonly string[]).includes(value)
}

export function isFoodGroup(value: string): value is FoodGroup {
  return (FOOD_GROUPS as readonly string[]).includes(value)
}
