'use client';

// Image helpers: CDN rewrite + browser-side resize/upload.
//
// Architecture: Supabase = data, Cloudinary = images, Cloudflare Worker = edge cache.
// - uploadPhoto(): resizes in-browser (~100KB) and uploads DIRECTLY to Cloudinary
//   via the unsigned preset (no secret in the browser). Falls back to Supabase
//   Storage when the Cloudinary env vars are absent.
// - cdnUrl(): rewrites Cloudinary URLs to the Worker /c/ path (30-day edge cache),
//   and legacy Supabase menu-images URLs to the Worker legacy path.

import { createClient } from './supabase/client';

const CDN = (process.env.NEXT_PUBLIC_IMAGE_CDN ?? '').replace(/\/$/, '');
const CLD_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const CLD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

export function cdnUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (!CDN) return url;
  // Cloudinary origin → Worker /c/ edge cache (strip the version segment: /v123/ → /)
  const cld = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.*)$/);
  if (cld) return `${CDN}/c/${cld[1]}`;
  const m = url.match(/\/storage\/v1\/object\/public\/(menu-images)(\/.*)$/);
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

// Upload a resized photo — returns the origin URL to store in the database.
// Prefers Cloudinary (unsigned preset, no secret in browser); falls back to
// Supabase Storage when Cloudinary env vars are absent.
export async function uploadPhoto(bucket: 'menu-images' | 'staff-photos', folder: string, file: File): Promise<string> {
  const blob = await resizeImage(file);
  if (CLD_CLOUD && CLD_PRESET) {
    const form = new FormData();
    form.append('file', blob, 'photo.jpg');
    form.append('upload_preset', CLD_PRESET);
    form.append('folder', `orderkar/${folder}`);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error('Image upload failed');
    const data = await res.json();
    if (!data.secure_url) throw new Error('Image upload failed');
    return data.secure_url as string;
  }
  const supabase = createClient();
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
