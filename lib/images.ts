'use client';

// Image helpers: CDN rewrite + browser-side resize/upload.
//
// - cdnUrl(): rewrites Supabase Storage public URLs (menu-images, staff-photos)
//   to the Cloudflare Worker edge cache when NEXT_PUBLIC_IMAGE_CDN is set.
//   The database always stores the Supabase origin URL; display goes through
//   the edge. Without the env var, the original URL is used (zero-config fallback).

import { createClient } from './supabase/client';

const CDN = (process.env.NEXT_PUBLIC_IMAGE_CDN ?? '').replace(/\/$/, '');

export function cdnUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (!CDN) return url;
  const m = url.match(/\/storage\/v1\/object\/public\/(menu-images|staff-photos)(\/.*)$/);
  if (m) return `${CDN}${m[2]}`;
  return url;
}

// Decode any common image file (JPG, PNG, WEBP, GIF, BMP…) into a bitmap.
// Tries createImageBitmap first, then falls back to an <img> element, since
// different browsers decode slightly different format sets.
async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('decode-failed'));
        img.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

// Downscale photos in the browser so storage stays light (~100KB each).
// Any readable image format is accepted and converted to JPEG.
export async function resizeImage(file: File, maxDim = 1024): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await decodeImage(file);
  } catch {
    throw new Error('Could not read that image. Please try a JPG or PNG file.');
  }
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Could not process image');
  return blob;
}

// Upload a resized photo into <bucket>/<folder>/… — returns the public origin URL.
export async function uploadPhoto(bucket: 'menu-images' | 'staff-photos', folder: string, file: File): Promise<string> {
  const blob = await resizeImage(file);
  const supabase = createClient();
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
