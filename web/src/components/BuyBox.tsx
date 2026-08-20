import { useMemo, useState } from 'react';
import type { Product } from '../lib/api';
import { euros } from '../lib/api';
import { mutateCart } from '../lib/cart';

/** Full variant picker for the product page: color, size, quantity and stock state. */
export default function BuyBox({ product, cartHref = '/carrito' }: { product: Product; cartHref?: string }) {
  const [color, setColor] = useState(product.colors[0] ?? '');
  const [size, setSize] = useState(product.sizes[0] ?? '');
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  const chosen = useMemo(
    () => product.variants.find((v) => v.color === color && v.size === size) ?? product.variants[0],
    [product, color, size]
  );

  const inStock = (chosen?.stock ?? 0) > 0;
  const hexOf = (name: string) => product.variants.find((v) => v.color === name)?.colorHex ?? '#ccc';
  const comboInStock = (nextColor: string, nextSize: string) =>
    (product.variants.find((v) => v.color === nextColor && v.size === nextSize)?.stock ?? 0) > 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[2rem] font-bold tracking-tight">{euros(chosen?.priceCents ?? product.priceCents)}</span>
        {product.compareAtCents > product.priceCents && (
          <>
            <span className="text-ink-muted line-through">{euros(product.compareAtCents)}</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-bold text-accent-dark">
              Ahorras {euros(product.compareAtCents - product.priceCents)}
            </span>
          </>
        )}
      </div>
      <p className="mt-1 text-[12px] text-ink-muted">IVA incluido · Envio gratis a partir de 60 €</p>

      {product.colors.length > 1 && (
        <div className="mt-6">
          <h4 className="mb-2.5 text-[12px] font-bold uppercase tracking-[.1em] text-ink-muted">Color: {color}</h4>
          <div className="flex flex-wrap gap-2.5">
            {product.colors.map((option) => (
              <button key={option} onClick={() => setColor(option)}
                className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm ${
                  option === color ? 'border-ink bg-ink text-white' : 'border-line-strong bg-white hover:border-ink-soft'}`}>
                <span className="h-3.5 w-3.5 rounded-full border border-black/25" style={{ background: hexOf(option) }} />
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {product.sizes.length > 1 && (
        <div className="mt-5">
          <h4 className="mb-2.5 text-[12px] font-bold uppercase tracking-[.1em] text-ink-muted">Version: {size}</h4>
          <div className="flex flex-wrap gap-2.5">
            {product.sizes.map((option) => (
              <button key={option} onClick={() => setSize(option)}
                className={`rounded-full border-[1.5px] px-4 py-2 text-sm ${
                  option === size ? 'border-ink bg-ink text-white' : 'border-line-strong bg-white hover:border-ink-soft'
                } ${comboInStock(color, option) ? '' : 'line-through opacity-40'}`}>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${
          !inStock ? 'bg-[#b04141]' : chosen.stock <= 5 ? 'bg-[#d99a17]' : 'bg-[#17795e]'}`} />
        <span>{!inStock ? 'Agotado' : chosen.stock <= 5 ? `Ultimas ${chosen.stock} unidades` : 'En stock, envio en 24 h'}</span>
        <span className="text-[12px] text-ink-muted">· SKU {chosen?.sku}</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <span className="inline-flex items-center overflow-hidden rounded-full border-[1.5px] border-line-strong bg-white">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-[46px] w-10 text-lg text-ink-soft hover:bg-paper">−</button>
          <span className="w-10 text-center font-semibold">{quantity}</span>
          <button onClick={() => setQuantity((q) => Math.min(10, q + 1))} className="h-[46px] w-10 text-lg text-ink-soft hover:bg-paper">+</button>
        </span>
        <button
          disabled={!inStock || state === 'busy'}
          onClick={async () => {
            setState('busy');
            try {
              await mutateCart('add', chosen.id, quantity);
              setState('done');
            } catch {
              setState('failed');
            }
          }}
          className={`flex-1 rounded-full px-8 py-3.5 font-semibold text-white transition-colors ${
            !inStock ? 'cursor-not-allowed bg-ink-muted'
              : state === 'done' ? 'bg-[#17795e]' : 'bg-accent hover:bg-accent-dark'}`}>
          {!inStock ? 'Agotado'
            : state === 'busy' ? 'Anadiendo…'
            : state === 'done' ? '✓ Anadido al carrito'
            : `Anadir al carrito · ${euros(chosen.priceCents)}`}
        </button>
      </div>

      {state === 'done' && (
        <p className="mt-3 text-sm">
          <a href={cartHref} className="font-semibold text-accent-dark underline">Ir al carrito y finalizar la compra →</a>
        </p>
      )}
      {state === 'failed' && (
        <p className="mt-3 text-sm text-[#97281f]">No hemos podido anadirlo. Reintentalo en un momento.</p>
      )}
    </div>
  );
}
