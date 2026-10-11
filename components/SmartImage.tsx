// Thin next/image wrapper.
//
// Why: several image sources in this app are bundled base64 data: URLs
// (lib/logo.ts, lib/food-images category art) and next/image cannot run
// those through its optimizer — so data: sources skip optimization while
// remote CDN images still get optimized via `remotePatterns` in
// next.config.mjs. Callers just use this like next/image.

import Image, { type ImageProps } from 'next/image';

type Props = Omit<ImageProps, 'src' | 'alt'> & { src: string; alt: string };

export default function SmartImage({ src, alt, ...rest }: Props) {
  return <Image src={src} alt={alt} unoptimized={src.startsWith('data:')} {...rest} />;
}
