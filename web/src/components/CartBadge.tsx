import { useEffect, useState } from 'react';
import type { Cart } from '../lib/api';
import { euros } from '../lib/api';
import { CART_EVENT, loadCart } from '../lib/cart';

/** Header badge: reads the cart once, then follows the events the other islands emit. */
export default function CartBadge({ href = '/carrito' }: { href?: string }) {
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    loadCart().then(setCart).catch(() => setCart(null));
    const onChange = (event: Event) => setCart((event as CustomEvent<Cart>).detail);
    window.addEventListener(CART_EVENT, onChange);
    return () => window.removeEventListener(CART_EVENT, onChange);
  }, []);

  const units = cart?.units ?? 0;
  return (
    <a href={href}
      className="flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-medium hover:border-ink">
      Carrito
      {units > 0 && (
        <>
          <span className="grid h-[21px] min-w-[21px] place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
            {units}
          </span>
          <span className="hidden text-ink-muted sm:inline">{euros(cart!.totalCents)}</span>
        </>
      )}
    </a>
  );
}
