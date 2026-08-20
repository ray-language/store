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
ray run                     # crea y siembra data/store.db la primera vez, y escucha en :8080
```

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

Todo el frontend de Astro vive con **un solo origen**: el build se genera contra la API en
marcha, y en producción lo sirve el propio proceso de raylang bajo `/app/`. Eso es lo que
permite que las islas compartan la cookie `nova_cart` con la tienda SSR (es `HttpOnly` y
`SameSite=Lax`: desde otro origen no viajaría).

### Probarlo como en producción

```sh
ray run                     # terminal 1 — la API (el build la necesita viva)
cd web && npm install && npm run build      # terminal 2
```

Y abre <http://127.0.0.1:8080/app/>. Es la forma que hay que usar para probar el carrito y
el checkout de verdad.

### Iterar con recarga en caliente

```sh
ray run                     # terminal 1
cd web && npm run dev       # terminal 2
```

Y abre <http://localhost:4321/app/>. El dev server de Astro **redirige a raylang** todo lo
que no es suyo (`/api/`, `/img/`, `/carrito`, `/checkout`, `/salud`…) mediante la
integración `rayProxy` de `astro.config.mjs`, así que el navegador sigue viendo un único
origen y el carrito funciona igual que en producción. Sin ese proxy las islas pedirían
`localhost:4321/api/...` y recibirían el 404 de Astro.

> `astro dev` corre en segundo plano: `npx astro dev status`, `npx astro dev logs`,
> `npx astro dev stop`.

> **El panel Network en dev enseña imagenes repetidas.** No es la app: es la barra de
> herramientas de Astro, que audita la pagina y para ello vuelve a pedir por `fetch` cada
> imagen (initiator `entrypoint.js` / `audit-*.js`, tipo `fetch`). Medido en la ficha de
> producto: **98 peticiones con la barra y 60 sin ella**; el build servido por raylang hace
> **13, ninguna repetida**. Si quieres el panel limpio, `devToolbar: { enabled: false }` en
> `astro.config.mjs`.

`API_BASE` cambia a qué servidor apuntan el build y el proxy (por defecto
`http://127.0.0.1:8080`).

### Una regla al tocar `web/src/lib/`

`api.ts` se ejecuta **en el navegador** y no puede tocar `process`; el cliente que sí lo
hace (`fetchAtBuild`) vive aparte en `build.ts` y solo se importa desde el frontmatter de
los `.astro`. Mezclarlos rompe la hidratación con `ReferenceError: process is not defined`
—y solo en `astro dev`, porque el build sustituye la variable y lo disimula.

## Cómo está montado

### Backend (raylang)

`main.ray` es solo el punto de entrada (~110 líneas: CLI, arranque y `listen`). Lo demás
vive en `src/`, en cuatro capas que dependen hacia abajo:

```
src/domain/   tipos y reglas puras, sin IO
src/store/    SQLite: consultas y escritura
src/ui/       presentación compartida por SSR y API
src/http/     lo único que toca Ctx/Res
```

| Archivo | Qué contiene |
|---|---|
| `main.ray` | CLI (`reseed`), migración/siembra y arranque del servidor |
| `domain/models.ray` | Los tipos del dominio y su `ToJson` |
| `domain/money.ray` · `palette.ray` · `markup.ray` | Importes, colores y escapado de HTML |
| `store/database.ray` | Apertura de SQLite en modo WAL y helpers de celdas |
| `store/schema.ray` · `seed.ray` | DDL idempotente y el catálogo de demostración |
| `store/catalog.ray` | Búsqueda con filtros, orden, paginación y **facetas contadas** |
| `store/cart.ray` · `orders.ray` | Carrito repreciado y checkout transaccional |
| `ui/view.ray` · `urls.ray` | Modelo del layout y construcción de los enlaces de filtro |
| `ui/imagery.ray` · `styles.ray` | Las imágenes SVG y la hoja de estilos, en el binario |
| `http/request.ray` | Leer la petición: filtros, cookie del carrito, `back` |
| `http/respond.ray` | El tipo `Reply` y el envoltorio que abre/cierra la BD y lo pinta |
| `http/shell.ray` | El modelo de la cabecera por petición |
| `http/pages.ray` · `purchase.ray` | Las páginas SSR y el flujo de compra |
| `http/assets.ray` · `api.ray` | Los assets generados y la API JSON |
| `http/routes.ray` | La tabla de rutas |
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
| `src/lib/api.ts` / `src/lib/build.ts` | Cliente de navegador / cliente de build (ver la regla de arriba) |
| `astro.config.mjs` | Base `/app`, Tailwind y el proxy a raylang para `astro dev` |

## Qué va dentro del binario

`ray build --native` produce **un binario que sirve la tienda SSR entera sin un solo archivo
al lado** — comprobado ejecutándolo en un directorio que solo contiene el binario y la base
de datos:

| | ¿Dentro del binario? |
|---|---|
| El HTML (`views/*.ray.html`) | **Sí** — los templates se compilan a funciones raylang |
| El CSS (`src/styles.ray`) | **Sí** — es un módulo, por eso `static/` ya no existe |
| Las imágenes (`src/imagery.ray`) | **Sí** — son SVG generados, no archivos |
| SQLite | **Sí** — la librería C va compilada dentro |
| El catálogo (`data/store.db`) | No: son datos, viven en disco |
| **El frontend de Astro (`web/dist/`)** | **No** — se monta desde disco con `static_files_cached` |

Es decir: el frontend **embebido** sí lo está por completo; el de Astro es un artefacto
estático aparte que hay que desplegar junto al binario (o detrás de un CDN), que es como se
despliega normalmente un sitio de Astro. Si lo quieres también dentro, harían falta ~960 KB
de HTML/JS/CSS convertidos a literales de raylang y un paso de generación que acople la
compilación de raylang a la de Astro.

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

**La API habla camelCase, siempre a mano.** `@derive(ToJson)` nombra las claves como los
campos de raylang, que son snake_case; los tipos con campos de más de una palabra escriben
su propio `to_json`. Derivarlos publicaría `price_cents` y el cliente TypeScript lo
enseñaría como `NaN €` en vez de fallar.

**Los handlers no tocan `Res`.** Devuelven un `Reply` (`Html`, `HtmlCoded`, `Json`, `Svg`,
`Redirect`, `Missing`…) y `respond.with_db` lo pinta. Ese envoltorio abre la conexión, la
cierra pase lo que pase —incluido cuando un `?` corta a mitad— y convierte un `Err` en un
500. Por eso una página es una función en línea recta con `?` en vez de una torre de
`match`, y por eso el `open`/`disconnect` está escrito una sola vez en todo el proyecto.

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
