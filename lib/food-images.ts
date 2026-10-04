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
