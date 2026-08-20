// The types and the browser-side client. Everything here runs in the BROWSER, so it must
// never touch `process` — the pages are served by the raylang server under /app/ (and
// proxied to it by `astro dev`), which makes every call same-origin and lets the islands
// share the HttpOnly `nova_cart` cookie with the server-rendered store.
//
// The build-time counterpart, which does talk to the network from Node, lives in
// `build.ts` and must only ever be imported from `.astro` frontmatter.

export const CLIENT_API_BASE = '';

export type Variant = {
  id: number;
  productId: number;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  priceCents: number;
  stock: number;
};

export type Feature = { name: string; value: string };

export type Product = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  brandSlug: string;
  brandName: string;
  priceCents: number;
  compareAtCents: number;
  rating: number;
  reviews: number;
  badge: string;
  featured: boolean;
  stock: number;
  image: string;
  colors: string[];
  sizes: string[];
  variants: Variant[];
  features: Feature[];
};

export type FacetValue = { value: string; label: string; hex: string; count: number };

export type Facets = {
  categories: FacetValue[];
  brands: FacetValue[];
  colors: FacetValue[];
  sizes: FacetValue[];
  minCents: number;
  maxCents: number;
};

export type ProductPage = {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

export type CartLine = {
  variantId: number;
  productSlug: string;
  productName: string;
  color: string;
  colorHex: string;
  size: string;
  unitCents: number;
  quantity: number;
  stock: number;
  image: string;
  lineCents: number;
};

export type Cart = {
  lines: CartLine[];
  units: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
};

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

/** Used from the React islands, at runtime, against the same origin. */
export async function fetchLive<T>(path: string, init?: RequestInit): Promise<T> {
  return readJson<T>(
    await fetch(`${CLIENT_API_BASE}${path}`, { credentials: 'same-origin', ...init })
  );
}

export function euros(cents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function discountPercent(priceCents: number, compareAtCents: number): number {
  if (compareAtCents <= priceCents || compareAtCents <= 0) return 0;
  return Math.round(((compareAtCents - priceCents) * 100) / compareAtCents);
}

/** The store keeps ratings in tenths (47 = 4.7 stars). */
export function ratingText(rating: number): string {
  return (rating / 10).toFixed(1).replace('.', ',');
}
