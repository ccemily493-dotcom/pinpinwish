# PinPinWish

Wishlist personal que convierte un tablero de Pinterest en una lista visual y editable usando exclusivamente la API oficial de Pinterest.

## Estado actual: MVP utilizable

- Modo local inmediato con persistencia en `localStorage`.
- Añadir productos manualmente, editar prioridad y marcar como comprado/eliminado.
- Búsqueda, categorías, filtros de precio, prioridades, estados y duplicados posibles.
- Página de producto, ofertas por tienda e histórico de precio separado por oferta.
- Autenticación por magic link con Supabase cuando se configura.
- OAuth oficial de Pinterest con tokens cifrados mediante AES-256-GCM.
- Selección de tablero e importación paginada sin bloquear la interfaz.
- Sincronización idempotente: un Pin no crea dos artículos en la misma wishlist.
- Detección de Pins retirados mediante la generación de importación.
- Cola `Needs Review` y resolución manual con prioridad sobre futuras automatizaciones.

La identificación y búsqueda automática de productos permanece deliberadamente desactivada hasta conectar proveedores reales. PinPinWish nunca inventa una coincidencia.

## Ejecutar gratis en local

Requisitos: Node.js 20.9 o superior y npm 9 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000/wishlist`. No necesitas cuentas ni claves para usar el modo local.

## Activar cuenta y Pinterest

1. Crea un proyecto gratuito de Supabase.
2. Ejecuta, en orden, `supabase/migrations/001_foundation.sql` y `002_mvp_auth_import.sql` desde el SQL Editor de Supabase.
3. Crea una app en el portal oficial de desarrolladores de Pinterest y configura como callback `http://localhost:3000/api/pinterest/callback`.
4. Copia `.env.example` como `.env.local` y completa únicamente tus propias claves.
5. Genera `OAUTH_TOKEN_ENCRYPTION_KEY` con `openssl rand -hex 32` o cualquier generador criptográfico de 32 bytes.
6. Reinicia `npm run dev`, inicia sesión y abre `/onboarding`.

Ningún secreto debe llevar el prefijo `NEXT_PUBLIC_`. Los tokens de Pinterest se cifran en servidor antes de almacenarse.

## Arquitectura

```text
apps/web                         Next.js, UI, rutas de servidor y Supabase
packages/pinterest-connector     API oficial, normalización y cifrado
packages/product-resolver        Contratos de identificación conservadora
packages/product-search          Interfaz desacoplada para buscadores futuros
packages/price-tracker           Ofertas e histórico de precios
packages/wishlist-core           Dominio, filtros, totales, estados y fuentes
packages/shared                  Tipos y utilidades compartidas
supabase/migrations              Esquema PostgreSQL y RLS
```

`wishlist-core` depende de `WishlistSourceAdapter`, no de Pinterest. Esto permite añadir URL manual, imagen, Instagram, TikTok o extensión de navegador sin acoplar la wishlist.

## Calidad

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm audit --omit=dev
```

## Límites actuales

- Pinterest exige que la aplicación sea aceptada/configurada por Pinterest; el código no sustituye ese requisito.
- No hay scraping directo de Pinterest.
- La resolución automática de productos y el seguimiento programado de precios son la siguiente fase y necesitan proveedores reales o integraciones específicas por tienda.
