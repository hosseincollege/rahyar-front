import { API_BASE_URL } from '@/lib/api-client';

const PUBLIC_BRANDING_CACHE_KEY = 'erp-public-branding-v1';

export type PublicBranding = {
  name: string;
  logoUrl: string | null;
  logoTone: string;
  logoBackground: string;
  settings: {
    accentPreset: string;
    accentLightColor: string;
    accentDarkColor: string;
    backgroundStyle: string;
  } | null;
};

export function getPublicAppearanceStyles(
  appearance: PublicBranding['settings'],
  isDark: boolean,
): Record<string, string> {
  if (!appearance) return {};

  const preset = appearance.backgroundStyle;
  const requestedAccent = isDark ? appearance.accentDarkColor : appearance.accentLightColor;
  const accent = /^#[0-9a-f]{6}$/i.test(requestedAccent) ? requestedAccent : (isDark ? '#3b82f6' : '#60a5fa');
  const gray = preset === 'GRAY';
  const theme = preset === 'THEME';
  const channels = [1, 3, 5].map((offset) => parseInt(accent.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  const primaryForeground = (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? '#172033' : '#ffffff';
  const colors: Record<string, string> = {
    '--primary': accent,
    '--primary-hover': `color-mix(in srgb, ${accent} ${isDark ? '82%' : '84%'}, ${isDark ? '#ffffff' : '#000000'})`,
    '--primary-soft': `color-mix(in srgb, ${accent} ${isDark ? '18%' : '10%'}, ${isDark ? 'transparent' : '#ffffff'})`,
    '--primary-foreground': primaryForeground,
    '--ring': `color-mix(in srgb, ${accent} ${isDark ? '38%' : '30%'}, transparent)`,
    '--background': theme
      ? `color-mix(in srgb, ${accent} ${isDark ? '3%' : '2%'}, ${isDark ? '#171819' : '#f1f3f5'})`
      : gray ? (isDark ? '#171819' : '#f1f1f1') : (isDark ? '#171c22' : '#f1f3f5'),
    '--foreground': isDark ? '#a8afb7' : '#3f4b5c',
    '--surface': theme || !gray ? (isDark ? '#20262d' : '#f8f9fb') : (isDark ? '#222426' : '#fafafa'),
    '--surface-elevated': theme || !gray ? (isDark ? '#282e36' : '#ffffff') : (isDark ? '#282a2c' : '#ffffff'),
    '--surface-muted': isDark ? '#2a3038' : '#eceff3',
    '--surface-hover': isDark ? '#333a43' : '#e6eaf0',
    '--card': theme || !gray ? (isDark ? '#20262d' : '#f8f9fb') : (isDark ? '#222426' : '#fafafa'),
    '--card-foreground': isDark ? '#a8afb7' : '#3f4b5c',
    '--muted-foreground': isDark ? '#929aa4' : '#687486',
    '--border': isDark ? '#353c45' : '#dce1e8',
    '--border-strong': isDark ? '#48515c' : '#cbd2dc',
    '--input': isDark ? '#3a424d' : '#d6dde7',
  };
  return colors;
}

export function applyPublicAppearance(
  appearance: PublicBranding['settings'],
  isDark: boolean,
): () => void {
  const colors = getPublicAppearanceStyles(appearance, isDark);
  if (Object.keys(colors).length === 0) return () => undefined;

  const root = document.documentElement;
  const previous = new Map<string, string>();
  for (const [property, value] of Object.entries(colors)) {
    previous.set(property, root.style.getPropertyValue(property));
    root.style.setProperty(property, value);
  }

  return () => {
    for (const [property, value] of previous) {
      if (value) root.style.setProperty(property, value);
      else root.style.removeProperty(property);
    }
  };
}

export async function fetchPublicBranding(): Promise<PublicBranding | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/public-branding`, { cache: 'no-store' });
    if (!response.ok) return null;
    const branding = await response.json() as PublicBranding | null;
    if (!branding) return null;
    const resolvedBranding = {
      ...branding,
      settings: branding.settings ?? {
        accentPreset: 'blue',
        accentLightColor: '#60a5fa',
        accentDarkColor: '#3b82f6',
        backgroundStyle: 'GRAY',
      },
    };
    try {
      window.localStorage.setItem(PUBLIC_BRANDING_CACHE_KEY, JSON.stringify({
        branding: resolvedBranding,
        savedAt: Date.now(),
        lightStyles: getPublicAppearanceStyles(resolvedBranding.settings, false),
        darkStyles: getPublicAppearanceStyles(resolvedBranding.settings, true),
      }));
    } catch {
      // Cached branding is only an optional first-paint aid; the API stays authoritative.
    }
    return resolvedBranding;
  } catch {
    return null;
  }
}

export function resolvePublicLogoUrl(value?: string | null) {
  if (!value) return null;
  return value.startsWith('/uploads/') ? `${API_BASE_URL}${value}` : value;
}
