import { useState } from 'react';
import type { Product } from '../lib/api';
import { mutateCart } from '../lib/cart';

/** One-click add straight from a catalog card, using the first sellable variant. */
export default function AddToCartMini({ product }: { product: Product }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const variant = product.variants.find((v) => v.stock > 0);

  if (!variant) {
    return (
      <button disabled className="w-full cursor-not-allowed rounded-full border border-line bg-white py-2.5 text-sm text-ink-muted">
        Agotado
      </button>
    );
  }

  return (
    <button
      onClick={async () => {
        setState('busy');
        try {
          await mutateCart('add', variant.id, 1);
          setState('done');
          setTimeout(() => setState('idle'), 1600);
        } catch {
          setState('idle');
        }
      }}
      disabled={state === 'busy'}
      className={`w-full rounded-full py-2.5 text-sm font-semibold transition-colors ${
        state === 'done' ? 'bg-[#17795e] text-white' : 'bg-ink text-white hover:bg-black'
      }`}
    >
      {state === 'done' ? '✓ Anadido' : state === 'busy' ? 'Anadiendo…' : 'Anadir al carrito'}
    </button>
  );
}
