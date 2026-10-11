// Category food photography, served from the Cloudinary CDN (uploaded once
// via the unsigned preset; no more 257KB base64 bundle in the client JS).
// Keyed by menu_categories.name.
import { cdnUrl } from './images';

export const CATEGORY_IMAGES: Record<string, string> = {
  "BBQ & Grill": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728506/orderkar/category/bbq-grill.jpg",
  "Karahi & Handi": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728507/orderkar/category/karahi-handi.jpg",
  "Biryani & Rice": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728507/orderkar/category/biryani-rice.jpg",
  "Chinese": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728508/orderkar/category/chinese.jpg",
  "Fast Food": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728508/orderkar/category/fast-food.jpg",
  "Breads & Naan": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728509/orderkar/category/breads-naan.jpg",
  "Drinks & Shakes": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728510/orderkar/category/drinks-shakes.jpg",
  "Desserts": "https://res.cloudinary.com/duo55lhwh/image/upload/v1791728510/orderkar/category/desserts.jpg",
};

export function categoryImage(name: string): string {
  const url = CATEGORY_IMAGES[name] ?? CATEGORY_IMAGES['BBQ & Grill'];
  return cdnUrl(url);
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
