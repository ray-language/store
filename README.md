# Nova — tienda online en raylang

Una tienda completa servida por un único proceso de **raylang**: el framework web
(`web/framework`), **SQLite** para persistir y **templates compilados** (`.ray.html`) para el
storefront embebido. El mismo proceso publica una **API JSON** que consume un frontend
**estático de Astro** con **islas de React** y **Tailwind**.

```
┌─────────────────────────── proceso raylang (main.ray) ───────────────────────────┐
│                                                                                  │
│  /            /catalogo   /producto/:slug   /carrito   /checkout   → SSR con     │
│                                                          templates .ray.html     │
│  /api/products  /api/facets  /api/cart  /api/taxonomy  → API JSON (ToJson)       │
│  /img/product/:slug.svg                                → imágenes generadas      │
│  /assets/*      → static/          /app/*  → web/dist (build de Astro)           │
│                                                                                  │
│                          db/sqlite  →  data/store.db                             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Arrancar

```sh
ray run                     # 1ª vez: crea y siembra data/store.db, y sale
ray run                     # a partir de ahí: sirve la tienda en :8080
```

> **Por qué dos pasos.** Sembrar y servir en el **mismo** proceso dispara un fallo del
> recolector de basura de la VM de raylang (`index out of bounds` en `src/gc.rs`), que tumba
> el servidor unas peticiones después. Separarlos lo evita del todo; el comentario en
> `bootstrap()` (`main.ray`) explica cómo revertirlo cuando el bug esté corregido.

- Storefront SSR: <http://127.0.0.1:8080/>
- Frontend estático (Astro + React): <http://127.0.0.1:8080/app/>
- API: <http://127.0.0.1:8080/api/products>

Otros comandos:

```sh
ray dev                     # lo mismo con hot reload y live-reload del navegador
ray test                    # 38 tests (unidad + integración contra SQLite en memoria)
ray build --native          # binario nativo
ray run main.ray reseed     # borra el catálogo y lo vuelve a sembrar
PORT=9000 ray run           # otro puerto
STORE_DB=/tmp/x.db ray run  # otra base de datos
```

## El frontend estático

El sitio de Astro se genera **contra la API en marcha** y se sirve desde el mismo proceso,
así que comparte origen (y por tanto la cookie del carrito) con la tienda SSR:

```sh
ray run &                   # el build necesita la API viva
cd web && npm install && npm run build     # deja el sitio en web/dist/
```

`API_BASE` cambia a qué servidor apunta el build (por defecto `http://127.0.0.1:8080`).

## Cómo está montado

### Backend (raylang)

| Archivo | Qué contiene |
|---|---|
| `main.ray` | Rutas, parseo de la petición, carrito en cookie y arranque del servidor |
| `src/models.ray` | Los tipos del dominio y su `ToJson` (derivado o con el builder de `std/json`) |
| `src/database.ray` | Apertura de SQLite en modo WAL y helpers de celdas |
| `src/schema.ray` | DDL idempotente + `ensure()` (migra y siembra si está vacío) |
| `src/seed.ray` | El catálogo de demostración: 6 categorías, 8 marcas, 24 productos, 104 variantes, 105 características |
| `src/catalog.ray` | Búsqueda con filtros, orden, paginación y **facetas contadas** |
| `src/cart.ray` | Carrito como string, repreciado siempre contra el catálogo |
| `src/orders.ray` | Checkout: pedido + líneas + descuento de stock en una transacción |
| `src/urls.ray` | Construcción de los enlaces de filtro (la tienda SSR funciona sin JavaScript) |
| `src/imagery.ray` | Las imágenes de producto y categoría, generadas como SVG |
| `src/money.ray`, `src/view.ray`, `src/palette.ray`, `src/markup.ray` | Presentación |
| `views/*.ray.html` | Los templates compilados (layout + vistas + parciales) |

### Frontend estático (`web/`)

| Archivo | Qué contiene |
|---|---|
| `src/pages/index.astro` | Portada generada en build (cero JS salvo el badge del carrito) |
| `src/pages/catalogo.astro` | Cáscara estática + la isla de filtros |
| `src/pages/producto/[slug].astro` | Una página estática por producto |
| `src/components/CatalogExplorer.tsx` | Isla: filtros y facetas en vivo contra la API |
| `src/components/BuyBox.tsx` | Isla: selector de variante y añadir al carrito |
| `src/components/CartBadge.tsx` | Isla: contador del carrito, sincronizado por eventos |

## Decisiones que merece la pena conocer

**El carrito no vive en el servidor.** Viaja en la cookie `nova_cart` como `"12:2,45:1"` y se
**reprecia contra el catálogo en cada petición**: el navegador puede mandar lo que quiera, el
precio y el stock siempre salen de SQLite. Encaja con el modelo de actores de heap aislado de
raylang (cada conexión corre en su fibra, sin estado mutable compartido) y hace que la misma
fuente compile a binario nativo sin tocar nada.

**Las facetas se cuentan quitando su propia dimensión.** Si filtras por marca *Nordis*, el
contador del resto de marcas se calcula con el resto de filtros aplicados pero **sin** el de
marca — que es lo que hace que sigan siendo pulsables en vez de mostrar todo a cero.

**Los filtros son enlaces, no JavaScript.** La tienda SSR entera —filtros, orden, paginación,
carrito y checkout— funciona con el JS desactivado. `src/urls.ray` es la única pieza que
construye ese estado, y está cubierta por tests.

**SQL siempre parametrizado.** Los valores del usuario van como `?n`; lo único que se
concatena en el SQL son identificadores de una lista cerrada (el `ORDER BY`).

**Las imágenes se generan.** No hay binarios en el repo: cada producto tiene un SVG derivado
determinísticamente de su slug (`/img/product/<slug>.svg`), con el trazo de su categoría.

## Tests

```sh
ray test
```

- `tests/money_test.ray` — formato de importes en notación española, descuentos, valoraciones.
- `tests/cart_test.ray` — altas, acumulación, tope por línea, cookie corrupta, envío gratis.
- `tests/urls_test.ray` — que ningún filtro se pierda al pulsar otro.
- `tests/catalog_test.ray` — integración sobre SQLite **en memoria**: esquema real, seed real,
  filtros combinados, paginación, facetas, y un checkout que comprueba que el stock baja.

## Bug conocido de raylang

Reproducible al 100% (medido 6/6 arranques): si el proceso **siembra el catálogo y después
atiende peticiones**, la VM revienta con

```
thread '<unnamed>' panicked at src/gc.rs:404:39:
index out of bounds: the len is 64 but the index is 828
internal compiler error (ICE): a scoped thread panicked
```

Repro mínimo: borrar `data/store.db`, arrancar un `main.ray` que llame a `schema.ensure()` y
luego a `listen_graceful`, y pedir ~16 rutas (basta con repetir una montada con
`static_files_cached`). No depende de `--heap`, y no ocurre si la base ya estaba sembrada.
Por eso esta tienda separa las dos fases; con la separación, 360 peticiones concurrentes no
producen ningún fallo.
