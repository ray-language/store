// The islands never keep their own copy of the cart: they post to the raylang API and
// take the re-priced cart it returns as the single source of truth, then announce it so
// every other island on the page (the badge, the drawer) updates at once.
import type { Cart } from './api';
import { fetchLive } from './api';

export const CART_EVENT = 'nova:cart';

export function announce(cart: Cart) {
  window.dispatchEvent(new CustomEvent<Cart>(CART_EVENT, { detail: cart }));
}

export async function loadCart(): Promise<Cart> {
  return fetchLive<Cart>('/api/cart');
}

export async function mutateCart(
  action: 'add' | 'set' | 'remove' | 'clear',
  variantId: number,
  quantity = 1
): Promise<Cart> {
  const body = new URLSearchParams({ variant: String(variantId), quantity: String(quantity) });
  const cart = await fetchLive<Cart>(`/api/cart/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  announce(cart);
  return cart;
}
