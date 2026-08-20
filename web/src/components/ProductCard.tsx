import type { Product } from '../lib/api';
import { discountPercent, euros } from '../lib/api';
import Stars from './Stars';

export default function ProductCard({ product, base = '/app' }: { product: Product; base?: string }) {
  const off = discountPercent(product.priceCents, product.compareAtCents);
  return (
    <a
      href={`${base}/producto/${product.slug}/`}
      className="card-hover group flex flex-col overflow-hidden rounded-[14px] border border-line bg-white hover:-translate-y-1 hover:border-line-strong hover:shadow-[0_4px_12px_rgba(15,23,41,.07),0_18px_40px_-22px_rgba(15,23,41,.28)]"
    >
      <div className="relative aspect-square overflow-hidden bg-[#eee]">
        {product.stock <= 0 ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-[#8b8f96] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Agotado
          </span>
        ) : product.badge ? (
          <span
            className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white ${
              product.badge === 'Oferta' ? 'bg-accent' : product.badge === 'Novedad' ? 'bg-deep' : 'bg-ink'
            }`}
          >
            {product.badge}
          </span>
        ) : null}
        {off > 0 && (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-accent-dark shadow">
            -{off}%
          </span>
        )}
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-[7px] px-4 pb-[18px] pt-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-ink-muted">
          {product.brandName}
        </span>
        <span className="text-base leading-tight font-semibold">{product.name}</span>
        <span className="text-[13px] leading-snug text-ink-muted">{product.tagline}</span>
        <Stars rating={product.rating} reviews={product.reviews} />
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="text-[17px] font-bold tracking-tight">
            {euros(product.priceCents)}
            {product.compareAtCents > product.priceCents && (
              <span className="ml-1.5 text-[13px] font-normal text-ink-muted line-through">
                {euros(product.compareAtCents)}
              </span>
            )}
          </span>
          <span className="flex gap-1.5">
            {product.colors.slice(0, 4).map((color) => {
              const variant = product.variants.find((v) => v.color === color);
              return (
                <span
                  key={color}
                  title={color}
                  className="h-[15px] w-[15px] rounded-full border border-black/15 shadow-[inset_0_0_0_2px_#fff]"
                  style={{ background: variant?.colorHex ?? '#ccc' }}
                />
              );
            })}
          </span>
        </div>
      </div>
    </a>
  );
}
