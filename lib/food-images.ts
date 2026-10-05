// Category food photography, bundled as data URLs (binary assets can't be
// pushed via the GitHub file API). Split across part files (CLI arg limit).
// Keyed by menu_categories.name.
import { PART as P1 } from './food-images/part1';
import { PART as P2 } from './food-images/part2';
import { PART as P3 } from './food-images/part3';
import { PART as P4 } from './food-images/part4';

export const CATEGORY_IMAGES: Record<string, string> = Object.assign({}, P1, P2, P3, P4);

export function categoryImage(name: string): string {
  return CATEGORY_IMAGES[name] ?? CATEGORY_IMAGES['BBQ & Grill'];
}

// Emoji per category — keyword-matched on the category name so pills and
// section headers get an icon with zero DB changes.
const EMOJI_RULES: [RegExp, string][] = [
  [/biryani|pulao|fried rice/i, '🍚'],
  [/bbq|barbecue|grill/i, '🍖'],
  [/tikka|kabab|kebab|seekh|malai boti/i, '🍢'],
  [/karahi|curry|handi|daal|dal/i, '🍛'],
  [/burger/i, '🍔'],
  [/pizza/i, '🍕'],
  [/shawarma|wrap|roll/i, '🌯'],
  [/chinese|noodle|chow mein|manchurian/i, '🍜'],
  [/fish|seafood|prawn|finger fish/i, '🐟'],
  [/chicken/i, '🍗'],
  [/mutton|beef|steak/i, '🥩'],
  [/breakfast|nashta|halwa|puri|omelet/i, '🍳'],
  [/soup/i, '🍲'],
  [/salad|raita/i, '🥗'],
  [/naan|roti|paratha|bread|kulcha/i, '🫓'],
  [/fries|snack|samosa|pakora|nuggets|wings/i, '🍟'],
  [/dessert|sweet|ice ?cream|kulfi|cake|brownie|shahi tukra/i, '🍰'],
  [/tea|chai|coffee|doodh patti/i, '☕'],
  [/lassi|shake|juice|smoothie|mojito/i, '🥤'],
  [/drink|beverage|soda|soft drink|water/i, '🥤'],
];

export function categoryEmoji(name: string): string {
  const n = (name || '').trim();
  for (const [re, emoji] of EMOJI_RULES) if (re.test(n)) return emoji;
  return '🍽️';
}
