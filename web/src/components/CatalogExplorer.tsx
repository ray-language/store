import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Facets, ProductPage } from '../lib/api';
import { euros, fetchLive } from '../lib/api';
import ProductCard from './ProductCard';
import AddToCartMini from './AddToCartMini';

type Filters = {
  q: string;
  categoria: string;
  marca: string[];
  color: string[];
  talla: string[];
  min: string;
  max: string;
  valoracion: number;
  stock: boolean;
  oferta: boolean;
  orden: string;
  pagina: number;
};

const EMPTY: Filters = {
  q: '', categoria: '', marca: [], color: [], talla: [],
  min: '', max: '', valoracion: 0, stock: false, oferta: false,
  orden: 'featured', pagina: 1,
};

const SORTS = [
  ['featured', 'Destacados'],
  ['price-asc', 'Precio: de menor a mayor'],
  ['price-desc', 'Precio: de mayor a menor'],
  ['rating', 'Mejor valorados'],
  ['newest', 'Novedades'],
  ['discount', 'Mayor descuento'],
];

function fromLocation(): Filters {
  if (typeof window === 'undefined') return EMPTY;
  const p = new URLSearchParams(window.location.search);
  const list = (key: string) => (p.get(key) ?? '').split(',').filter(Boolean);
  return {
    ...EMPTY,
    q: p.get('q') ?? '',
    categoria: p.get('categoria') ?? '',
    marca: list('marca'),
    color: list('color'),
    talla: list('talla'),
    min: p.get('min') ?? '',
    max: p.get('max') ?? '',
    valoracion: Number(p.get('valoracion') ?? 0),
    stock: p.get('stock') === '1',
    oferta: p.get('oferta') === '1',
    orden: p.get('orden') ?? 'featured',
    pagina: Number(p.get('pagina') ?? 1),
  };
}

function toQueryString(f: Filters, perPage: number): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.categoria) p.set('categoria', f.categoria);
  if (f.marca.length) p.set('marca', f.marca.join(','));
  if (f.color.length) p.set('color', f.color.join(','));
  if (f.talla.length) p.set('talla', f.talla.join(','));
  if (f.min) p.set('min', f.min);
  if (f.max) p.set('max', f.max);
  if (f.valoracion) p.set('valoracion', String(f.valoracion));
  if (f.stock) p.set('stock', '1');
  if (f.oferta) p.set('oferta', '1');
  if (f.orden !== 'featured') p.set('orden', f.orden);
  if (f.pagina > 1) p.set('pagina', String(f.pagina));
  p.set('porPagina', String(perPage));
  return p.toString();
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function CatalogExplorer({ perPage = 9, base = '/app' }: { perPage?: number; base?: string }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState<ProductPage | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read the filters back out of the URL so a shared link reopens the same view.
  useEffect(() => setFilters(fromLocation()), []);

  const queryString = useMemo(() => toQueryString(filters, perPage), [filters, perPage]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchLive<ProductPage>(`/api/products?${queryString}`),
      fetchLive<Facets>(`/api/facets?${queryString}`),
    ])
      .then(([nextPage, nextFacets]) => {
        if (cancelled) return;
        setPage(nextPage);
        setFacets(nextFacets);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));

    const url = `${window.location.pathname}${queryString ? `?${queryString.replace(/&?porPagina=\d+/, '')}` : ''}`;
    window.history.replaceState(null, '', url.endsWith('?') ? url.slice(0, -1) : url);
    return () => { cancelled = true; };
  }, [queryString]);

  // Any change to a filter sends you back to page one.
  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, pagina: 1, ...patch }));
  }, []);

  const activeCount =
    (filters.q ? 1 : 0) + (filters.categoria ? 1 : 0) + filters.marca.length +
    filters.color.length + filters.talla.length + (filters.min || filters.max ? 1 : 0) +
    (filters.valoracion ? 1 : 0) + (filters.stock ? 1 : 0) + (filters.oferta ? 1 : 0);

  const box = (on: boolean) => (
    <span className={`grid h-4 w-4 flex-none place-items-center rounded-[5px] border-[1.5px] text-[10px] text-white ${
      on ? 'border-ink bg-ink' : 'border-line-strong bg-white'}`}>
      {on ? '✓' : ''}
    </span>
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[268px_minmax(0,1fr)]">
      <aside className="rounded-[14px] border border-line bg-white px-[18px] pb-[18px] lg:sticky lg:top-6">
        <FilterGroup title="Buscar">
          <input
            defaultValue={filters.q}
            onChange={(event) => {
              const value = event.target.value;
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => update({ q: value }), 250);
            }}
            placeholder="Auriculares, camara…"
            className="w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </FilterGroup>

        <FilterGroup title="Categoria">
          {facets?.categories.map((facet) => (
            <button key={facet.value} onClick={() => update({ categoria: filters.categoria === facet.value ? '' : facet.value })}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper ${
                filters.categoria === facet.value ? 'font-medium text-ink' : 'text-ink-soft'}`}>
              {box(filters.categoria === facet.value)}
              <span>{facet.label}</span>
              <span className="ml-auto text-xs text-ink-muted">{facet.count}</span>
            </button>
          ))}
        </FilterGroup>

        <FilterGroup title="Marca">
          {facets?.brands.map((facet) => (
            <button key={facet.value} onClick={() => update({ marca: toggle(filters.marca, facet.value) })}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper ${
                filters.marca.includes(facet.value) ? 'font-medium text-ink' : 'text-ink-soft'}`}>
              {box(filters.marca.includes(facet.value))}
              <span>{facet.label}</span>
              <span className="ml-auto text-xs text-ink-muted">{facet.count}</span>
            </button>
          ))}
        </FilterGroup>

        <FilterGroup title="Precio">
          <div className="flex items-center gap-2">
            <input type="number" min={0} value={filters.min} placeholder={facets ? String(Math.floor(facets.minCents / 100)) : ''}
              onChange={(event) => update({ min: event.target.value })}
              className="w-full min-w-0 rounded-lg border border-line-strong px-2.5 py-2 text-sm outline-none focus:border-ink" />
            <span className="text-ink-muted">–</span>
            <input type="number" min={0} value={filters.max} placeholder={facets ? String(Math.ceil(facets.maxCents / 100)) : ''}
              onChange={(event) => update({ max: event.target.value })}
              className="w-full min-w-0 rounded-lg border border-line-strong px-2.5 py-2 text-sm outline-none focus:border-ink" />
          </div>
          {facets && (
            <p className="mt-2 text-[12px] text-ink-muted">
              Entre {euros(facets.minCents)} y {euros(facets.maxCents)}
            </p>
          )}
        </FilterGroup>

        <FilterGroup title="Color">
          {facets?.colors.map((facet) => (
            <button key={facet.value} onClick={() => update({ color: toggle(filters.color, facet.value) })}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper ${
                filters.color.includes(facet.value) ? 'font-medium text-ink' : 'text-ink-soft'}`}>
              <span className="h-[15px] w-[15px] flex-none rounded-full border border-black/20"
                style={{ background: facet.hex, boxShadow: filters.color.includes(facet.value) ? '0 0 0 2px #0f1729' : undefined }} />
              <span>{facet.label}</span>
              <span className="ml-auto text-xs text-ink-muted">{facet.count}</span>
            </button>
          ))}
        </FilterGroup>

        <FilterGroup title="Talla / formato">
          {facets?.sizes.map((facet) => (
            <button key={facet.value} onClick={() => update({ talla: toggle(filters.talla, facet.value) })}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper ${
                filters.talla.includes(facet.value) ? 'font-medium text-ink' : 'text-ink-soft'}`}>
              {box(filters.talla.includes(facet.value))}
              <span>{facet.label}</span>
              <span className="ml-auto text-xs text-ink-muted">{facet.count}</span>
            </button>
          ))}
        </FilterGroup>

        <FilterGroup title="Valoracion y disponibilidad">
          {[45, 40].map((threshold) => (
            <button key={threshold} onClick={() => update({ valoracion: filters.valoracion === threshold ? 0 : threshold })}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper ${
                filters.valoracion === threshold ? 'font-medium text-ink' : 'text-ink-soft'}`}>
              {box(filters.valoracion === threshold)}
              <span>{(threshold / 10).toFixed(1).replace('.', ',')} y mas</span>
            </button>
          ))}
          <button onClick={() => update({ stock: !filters.stock })}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper ${
              filters.stock ? 'font-medium text-ink' : 'text-ink-soft'}`}>
            {box(filters.stock)}<span>Solo con stock</span>
          </button>
          <button onClick={() => update({ oferta: !filters.oferta })}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper ${
              filters.oferta ? 'font-medium text-ink' : 'text-ink-soft'}`}>
            {box(filters.oferta)}<span>Solo rebajados</span>
          </button>
        </FilterGroup>
      </aside>

      <div>
        {activeCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-muted">{activeCount} filtro{activeCount === 1 ? '' : 's'} activo{activeCount === 1 ? '' : 's'}</span>
            <button onClick={() => setFilters(EMPTY)}
              className="rounded-full border border-dashed border-line-strong px-3 py-1.5 text-[13px] text-ink-soft hover:border-ink hover:text-ink">
              Limpiar todo
            </button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-ink-muted">
            {loading ? 'Buscando…' : `${page?.total ?? 0} productos · pagina ${page?.page ?? 1} de ${page?.pages ?? 1}`}
          </span>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            Ordenar por
            <select value={filters.orden} onChange={(event) => update({ orden: event.target.value })}
              className="cursor-pointer rounded-full border border-line-strong bg-white px-3.5 py-2 text-ink outline-none focus:border-ink">
              {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {failed && (
          <div className="rounded-[14px] border border-[#f5c9c5] bg-[#fdeceb] px-4 py-3 text-sm text-[#97281f]">
            No hemos podido hablar con la API. ¿Esta el servidor de raylang levantado?
          </div>
        )}

        {!failed && !loading && page?.items.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-line-strong bg-white px-6 py-14 text-center">
            <h3 className="text-lg font-semibold">No hay nada que encaje con esos filtros</h3>
            <p className="mt-2 text-ink-muted">Prueba a quitar alguno.</p>
            <button onClick={() => setFilters(EMPTY)}
              className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-black">
              Ver todo el catalogo
            </button>
          </div>
        )}

        <div className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-50' : ''}`}>
          {page?.items.map((product) => (
            <div key={product.id} className="flex flex-col gap-2">
              <ProductCard product={product} base={base} />
              <AddToCartMini product={product} />
            </div>
          ))}
        </div>

        {(page?.pages ?? 1) > 1 && (
          <nav className="mt-10 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: page!.pages }, (_, index) => index + 1).map((number) => (
              <button key={number} onClick={() => setFilters((current) => ({ ...current, pagina: number }))}
                className={`grid h-10 min-w-10 place-items-center rounded-lg border px-3 text-sm font-medium ${
                  number === page!.page ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}>
                {number}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-4 last:border-b-0">
      <h4 className="mb-3 text-[12px] font-bold uppercase tracking-[.1em] text-ink-muted">{title}</h4>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
