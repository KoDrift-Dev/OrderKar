// Shared OrderKar brand logo — the chosen Perplexity icon, bundled as a
// data URL in lib/logo.ts (binary assets can't be pushed via the GitHub
// file API, so the logo ships inside the code).

import { LOGO_DATA_URL } from '@/lib/logo';

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src={LOGO_DATA_URL}
      alt="OrderKar"
      width={size}
      height={size}
      className="shrink-0 rounded-[12px]"
      loading="eager"
    />
  );
}
