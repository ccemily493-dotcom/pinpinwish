# PinPinWish

Wishlist personal y local que importa un tablero de Pinterest, descarga sus imágenes, analiza los enlaces de producto y guarda el resultado en SQLite.

## Estado

- Aplicación Next.js local, sin Supabase ni cuentas de PinPinWish.
- Importación automática de tableros públicos mediante Playwright.
- Perfil de navegador persistente para tableros privados; Pinterest puede exigir iniciar sesión una vez.
- Recorrido completo del tablero hasta que dejan de aparecer Pins nuevos.
- Lectura automática de cada Pin para recuperar descripción, imagen y enlace de destino.
- Resolución conservadora mediante JSON-LD, Open Graph y microdatos.
- Google Lens mediante SerpApi como fuente principal de identificación visual, sin CAPTCHA del navegador.
- Un Pin puede producir varios productos distintos; los resultados de varias tiendas se agrupan como ofertas del mismo producto.
- SQLite, imágenes y sesión guardados únicamente en `.data/`.
- Importaciones idempotentes y recuperables al volver a abrir el panel.

## Requisitos

- Node.js 24 o superior.
- npm 9 o superior.

## Instalación

```bash
npm install
npm run browser:install
```

## Ejecutar

```bash
npm run dev
```

Abre `http://localhost:3000/wishlist`, pulsa **Import from Pinterest** y pega la URL completa del tablero. Si todavía no existe una sesión local, el mismo botón abrirá Pinterest para iniciar sesión una vez y continuará la importación automáticamente al terminar.

La identificación visual requiere `SERPAPI_API_KEY` en `apps/web/.env.local`. SerpApi ofrece una cuota gratuita de 250 búsquedas mensuales. Para guardar los datos en otra carpeta, configura `PINPINWISH_DATA_DIR` con una ruta local.

## Datos privados

La carpeta `.data/` contiene:

- `pinpinwish.db`: wishlist y trabajos de importación.
- `images/`: imágenes descargadas.
- `pinterest-profile/`: cookies y sesión del navegador.

La carpeta está excluida de Git. PinPinWish nunca solicita ni almacena la contraseña de Pinterest.

## Arquitectura

```text
apps/web                         Next.js, UI, API local, SQLite e importador
packages/pinterest-connector     Automatización Playwright y descarga de imágenes
packages/product-resolver        Metadata de tiendas y confidence scoring
packages/product-search          Proveedores reemplazables de búsqueda visual
packages/price-tracker           Ofertas e histórico de precios
packages/wishlist-core           Dominio, filtros, totales, estados y fuentes
packages/shared                  Tipos, validación y seguridad compartida
```

`wishlist-core` depende del contrato `WishlistSourceAdapter`, no de Pinterest, para permitir futuras fuentes.

## Calidad

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Limitaciones

- Si SerpApi o una tienda no devuelve evidencia suficiente, el producto queda como `unresolved` y no detiene el resto de la importación.
- PinPinWish no evade CAPTCHA.
- La automatización de páginas puede estar restringida por las condiciones de los servicios. Usa únicamente tableros e imágenes a los que tengas acceso legítimo.
- La búsqueda visual es automática, pero puede no devolver una coincidencia fiable; esos Pins pasan a **Needs Review** sin inventar un producto.
