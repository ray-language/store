// The static frontend is built into `dist/` and served by the raylang server under
// /app/, so in production the browser talks to ONE origin and the islands share the
// `nova_cart` cookie with the server-rendered store.
import http from 'node:http';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const RAY_SERVER = process.env.API_BASE ?? 'http://127.0.0.1:8080';

// Everything `astro dev` should hand over to raylang instead of trying to route itself.
// The Astro pages all live under the /app base, so these prefixes cannot collide.
const PROXIED = ['/api/', '/img/', '/assets/', '/salud', '/carrito', '/checkout', '/pedido/'];

/**
 * `astro dev` serves the pages from Vite on :4321, so without this the islands would
 * fetch :4321/api/... and get Astro's 404 — and the HttpOnly cart cookie would never
 * travel. Vite's own `server.proxy` is not enough: Astro's router answers extensionless
 * paths before the proxy middleware runs, so this one is pushed to the FRONT of the
 * stack. The result is the same single origin the built site gets in production.
 */
function rayProxy() {
  const upstream = new URL(RAY_SERVER);

  const forward = (req, res) => {
    const proxied = http.request(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: upstream.host },
      },
      (upstreamResponse) => {
        res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(res);
      }
    );
    proxied.on('error', (error) => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: `no se pudo hablar con raylang en ${RAY_SERVER}: ${error.message}. Arranca 'ray run'.`,
      }));
    });
    req.pipe(proxied);
  };

  const mine = (url = '/') => PROXIED.some((prefix) => url === prefix || url.startsWith(prefix));

  return {
    name: 'ray-proxy',
    hooks: {
      'astro:server:setup': ({ server, logger }) => {
        const httpServer = server.httpServer;
        if (!httpServer) {
          logger.warn('sin httpServer: las llamadas a la API no se podran redirigir a raylang');
          return;
        }
        // Astro 7 answers requests from its OWN listener, ahead of Vite's middleware
        // stack — an unshifted middleware never sees /api/... So the listeners are
        // taken off, and put back behind a check that hands the raylang paths over.
        // Result: one origin in dev too, which is what the HttpOnly cart cookie needs.
        const astroListeners = httpServer.listeners('request');
        httpServer.removeAllListeners('request');
        httpServer.on('request', (req, res) => {
          if (mine(req.url)) return forward(req, res);
          for (const listener of astroListeners) listener.call(httpServer, req, res);
        });
        logger.info(`API, imagenes y carrito redirigidos a ${RAY_SERVER}`);
      },
    },
  };
}

export default defineConfig({
  base: '/app',
  trailingSlash: 'always',
  integrations: [react(), rayProxy()],
  // La barra de Astro audita la pagina en cada carga y, para hacerlo, vuelve a pedir por
  // `fetch` todas las imagenes: en el panel Network aparecen duplicadas (initiator
  // `entrypoint.js` / `audit-*.js`). Es ruido SOLO de desarrollo — el build no la incluye.
  // Para un Network limpio: devToolbar: { enabled: false }.
  vite: { plugins: [tailwindcss()] },
});
