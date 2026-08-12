# Roniforms V2.6 — precios al mayor y al detal

Esta versión mantiene un solo catálogo e inventario, pero cada talla/presentación puede tener **dos precios base en USD**: uno al mayor y otro al detal. El cliente puede cambiar el catálogo completo entre ambos modos desde la página principal.

## Cambios de V2.6

- Se agregó `precio_detal_usd` dentro de cada variante/talla existente.
- Los productos actuales **no se duplican** y no hay que volver a cargar fotos, categorías, tallas ni inventario.
- En administración, cada talla muestra `Precio mayor USD` y `Precio detal USD`.
- El precio al detal puede quedar vacío mientras se completa la carga de los productos existentes.
- Los productos nuevos ya muestran ambos campos de precio desde el principio.
- La vista previa del administrador calcula automáticamente efectivo, dólar BCV y euro BCV tanto para mayor como para detal.
- El catálogo público incluye un selector visible `Al mayor / Al detal`.
- El modo seleccionado se recuerda en el navegador mediante `localStorage`.
- Títulos, avisos, badges, totales y pie de página cambian automáticamente según el modo elegido.
- Si una talla todavía no tiene precio al detal, se muestra `Precio al detal por cargar` en vez de un precio de $0.
- El carrito se dejó fuera de esta versión para implementarlo como siguiente fase sobre esta misma modalidad global de compra.

## Base de datos / Supabase

**No hace falta ejecutar una migración SQL para V2.6.** La tabla `products` ya guarda las variantes en una columna JSONB (`variants`). El nuevo valor `precio_detal_usd` se guarda dentro de ese mismo JSON.

Los registros anteriores que no tengan `precio_detal_usd` se interpretan como precio al detal pendiente hasta que se editen desde el panel administrativo.

## Probar en la computadora

```bash
npm run install:all
npm run dev
```

- Catálogo: `http://localhost:5173`
- Administración: `http://localhost:5173/gestion/dev-roniforms-admin`

## Publicación en Render

El proyecto continúa preparado para un único servicio web: Express sirve la API y también el build de React.

- Build: `npm install && npm --prefix client install && npm run build`
- Start: `npm start`
- Health check: `/api/health`

Si ya tienes este proyecto publicado con Supabase, solo debes desplegar esta nueva versión. **No vuelvas a ejecutar el seed**, porque tus productos actuales ya están en la base de datos.

El enlace administrativo sigue siendo:

```text
https://TU-SITIO.onrender.com/gestion/VALOR-DE-ADMIN_ROUTE_TOKEN
```

## Cálculos de precios

Para el modo seleccionado (Mayor o Detal):

1. Efectivo USD: usa el precio base correspondiente de la talla.
2. Dólar BCV: aplica el porcentaje configurado, redondea a dos decimales y luego multiplica por la tasa dólar BCV.
3. Euro BCV: aplica el porcentaje configurado, redondea a dos decimales y luego multiplica por la tasa euro BCV.

Las tasas y porcentajes continúan administrándose desde el mismo panel.

## Nota de seguridad

El enlace administrativo es la llave. No lo publiques ni lo compartas con clientes. La ruta `/gestion/` está excluida de `robots.txt`, pero eso no sustituye mantener el token privado.

## Desarrollo local estable (v2.6.1)

`nodemon` ignora `server/data/**` y `server/uploads/**`. Esto evita que el API se reinicie cuando se guarda un producto, un precio al detal o una actualización de tasa BCV en el JSON local.


## V2.6.2 — selector Mayor / Detal responsive

- El selector Mayor/Detal ahora vive en una sección propia y no puede quedar cubierto por las tarjetas BCV.
- Botones de selección más grandes y táctiles.
- Diseño adaptado a teléfonos, tablets/iPad y escritorio.
- Las tarjetas BCV se muestran debajo del selector sin superposición.

## V2.7.0 — Carrito

- Carrito persistente en `localStorage`.
- Una misma compra mantiene la modalidad global Mayor o Detal.
- Si el carrito contiene una variante sin precio en la modalidad destino, se bloquea el cambio para evitar totales inválidos.
- Agregar desde cada tarjeta respetando talla, cantidad y stock.
- Modificar cantidades o eliminar directamente desde el carrito.
- Totales automáticos en efectivo USD, Bs. con dólar BCV y Bs. con euro BCV.
- Drawer lateral en escritorio y experiencia de pantalla completa optimizada para teléfono.
- Barra de carrito fija en móvil.
- Copia del resumen del pedido lista para conectar luego con WhatsApp/checkout.
