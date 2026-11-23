"""Allergen and food-group vocabularies for `food` (прикорм) entries.

Both lists are closed: the LLM tags each solid-food entry with zero or more
allergens from the eight-allergen list parents are asked to track, and with the
food groups the products cover. Everything that reads these tags — the dashboard
panels, the backfill script — works off these tuples, so adding a tag means
adding it here and in the LLM reference block below.
"""

# The eight allergens tracked during solid-food introduction.
ALLERGENS: tuple[str, ...] = (
    "peanut",
    "egg",
    "gluten",
    "fish",
    "soy",
    "milk",
    "sesame",
    "shellfish",
)

# Coarse nutrition coverage — "в принципе", without grams.
FOOD_GROUPS: tuple[str, ...] = (
    "protein",
    "fat",
    "carbs",
    "fiber",
    "produce",
)

# Shared by the vision prompt and the text-only backfill prompt so the two can
# never drift apart.
FOOD_TAG_REFERENCE = """\
#### Allergens (`allergens`) — closed list, use these exact keys
| key        | Russian products that count |
|------------|------------------------------------------------------------------------------------|
| peanut     | арахис, арахисовая паста/масло, "паста (арахис)" |
| egg        | яйцо, яичница, омлет, желток, белок, меренга |
| gluten     | хлеб, батон, булка, круассан, макароны, паста, лапша, тесто, пельмени, печенье, |
|            | сухарик, овсянка, манка, пшеница, ячмень, рожь, булгур, кускус, суп с лапшой |
| fish       | рыба, лосось, дорада/дорадо, тунец, треска, судак, балык, икра, рыбные котлеты |
| soy        | соя, соевый соус, тофу, эдамаме, "бобы эдамаме" |
| milk       | коровье молоко, творог, йогурт, кефир, сыр, моцарелла, пармезан, сливочное масло, |
|            | сметана, сливки, мороженое |
| sesame     | кунжут, тахини, халва, кунжутное масло |
| shellfish  | креветки, мидии, кальмар, краб, рак, устрицы, гребешок, лобстер |

Allergen rules:
- "мамино" / "мамина" / "мамино молоко" is BREAST milk — it is NOT the `milk` allergen.
  It also adds no food groups of its own.
- Tag `gluten` only when the grain actually contains it. гречка, рис, кукуруза, пшено,
  киноа and картошка are gluten-free. A bare "каша" / "пюре" with no grain named is NOT
  gluten — leave it untagged.
- Nuts other than peanut (орех, орешки, миндаль, кешью) are not on the list: no allergen tag.
- Tag only what is actually written. Never infer an allergen from a dish name alone unless
  the dish always contains it (пельмени → gluten from тесто).

#### Food groups (`food_groups`) — closed list, use these exact keys
| key      | Covers |
|----------|-------------------------------------------------------------------------------------|
| protein  | meat, poultry, fish, seafood, eggs, dairy/cheese/yogurt/curd, legumes, lentils, nuts |
| fat      | oils, butter, avocado, nuts, seeds, cheese, fatty fish, cream, egg yolk |
| carbs    | grains, porridge, bread, pasta, potato, sweet potato, juice, sugar, honey, pastry |
| fiber    | vegetables, fruit, berries, whole grains, legumes, lentils, nuts, dried fruit |
| produce  | any vegetable or fruit, berries and citrus included |

Food-group rules:
- A product may fall into several groups: авокадо → fat, fiber, produce;
  чечевица → protein, carbs, fiber; говядина → protein, fat.
- `produce` means a fruit or vegetable was given at all; it always comes with `fiber`.
- Water, tea and plain breast milk add no food groups.
"""


def normalize_tags(values: object, allowed: tuple[str, ...]) -> list[str] | None:
    """Keep only known tags, de-duplicated and in canonical order.

    The model occasionally returns a string instead of an array, invents a tag, or
    repeats one; none of that should reach the database.
    """
    if values is None:
        return None
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, list):
        return None

    seen = {v.strip().lower() for v in values if isinstance(v, str)}
    return [tag for tag in allowed if tag in seen]
