import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { subscribeCatalogUpdates } from '../catalogSync';
import Logo from '../components/Logo';
import ProductCard from '../components/ProductCard';
import CartDrawer from '../components/CartDrawer';
import { formatDateTime, formatRate, formatUsd } from '../utils';
import { cartTotals, clampCartQuantity, getVariantPrice, loadStoredCart, resolveCartItems, saveCart } from '../cart';

const SHOPPING_MODE_KEY = 'roniforms-shopping-mode';

function getInitialShoppingMode() {
  try {
    const saved = window.localStorage.getItem(SHOPPING_MODE_KEY);
    return saved === 'detal' ? 'detal' : 'mayor';
  } catch {
    return 'mayor';
  }
}

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [shoppingMode, setShoppingMode] = useState(getInitialShoppingMode);
  const [cart, setCart] = useState(loadStoredCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');

  const isRetail = shoppingMode === 'detal';
  const modeLabel = isRetail ? 'al detal' : 'al mayor';

  function showToast(message) {
    setToast(message);
  }

  function changeShoppingMode(mode) {
    if (mode === shoppingMode) return;

    if (cart.length > 0) {
      const unavailable = cart.filter((entry) => {
        const product = products.find((item) => item.id === entry.productId);
        const variant = product?.variants?.find((item) => item.id === entry.variantId);
        return !variant || getVariantPrice(variant, mode) === null;
      });

      if (unavailable.length > 0) {
        showToast(`No puedes cambiar ${mode === 'detal' ? 'al detal' : 'al mayor'}: ${unavailable.length} ${unavailable.length === 1 ? 'artículo no tiene' : 'artículos no tienen'} precio disponible en esa modalidad.`);
        return;
      }
    }

    setShoppingMode(mode);
    try { window.localStorage.setItem(SHOPPING_MODE_KEY, mode); } catch { /* localStorage puede estar bloqueado */ }
    if (cart.length > 0) showToast(`Carrito actualizado a precios ${mode === 'detal' ? 'al detal' : 'al mayor'}.`);
  }

  const loadCatalog = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);

    try {
      const [catalogData, rateData] = await Promise.all([api.getCatalog(), api.getRates()]);
      setProducts(catalogData.products || []);
      setRates(rateData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog({ initial: true });

    const interval = window.setInterval(() => loadCatalog(), 15000);
    const handleFocus = () => loadCatalog();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadCatalog();
    };
    const unsubscribe = subscribeCatalogUpdates(() => loadCatalog());

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe();
    };
  }, [loadCatalog]);

  const activeProducts = useMemo(
    () => products
      .filter((product) => product.activo !== false)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [products]
  );

  const selectedProduct = useMemo(
    () => activeProducts.find((product) => product.id === productId),
    [activeProducts, productId]
  );

  const sizes = useMemo(() => {
    const source = selectedProduct ? [selectedProduct] : activeProducts;
    return [...new Set(
      source.flatMap((product) => (product.variants || []).map((variant) => variant.talla)).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [activeProducts, selectedProduct]);

  useEffect(() => {
    if (size && !sizes.includes(size)) setSize('');
  }, [size, sizes]);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (products.length === 0 || cart.length === 0) return;

    setCart((current) => {
      const next = current.flatMap((entry) => {
        const product = products.find((item) => item.id === entry.productId && item.activo !== false);
        const variant = product?.variants?.find((item) => item.id === entry.variantId);
        if (!product || !variant) return [];
        const quantity = clampCartQuantity(entry.quantity, variant.stock);
        if (quantity <= 0) return [];
        return [{ ...entry, quantity }];
      });

      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [products]);

  const filtered = useMemo(() => activeProducts.filter((product) => {
    const productMatch = !productId || product.id === productId;
    const sizeMatch = !size || (product.variants || []).some((variant) => variant.talla === size);
    return productMatch && sizeMatch;
  }), [activeProducts, productId, size]);

  const cartItems = useMemo(
    () => resolveCartItems(cart, activeProducts, shoppingMode, rates),
    [cart, activeProducts, shoppingMode, rates]
  );

  const totals = useMemo(() => cartTotals(cartItems), [cartItems]);

  function addToCart({ productId: nextProductId, variantId, quantity: addQuantity }) {
    const product = activeProducts.find((item) => item.id === nextProductId);
    const variant = product?.variants?.find((item) => item.id === variantId);
    if (!product || !variant) return;

    if (getVariantPrice(variant, shoppingMode) === null) {
      showToast(`Esta talla todavía no tiene precio ${modeLabel}.`);
      return;
    }

    const stock = variant.stock;
    const requested = Math.max(1, Number.parseInt(addQuantity, 10) || 1);

    setCart((current) => {
      const index = current.findIndex((item) => item.productId === nextProductId && item.variantId === variantId);
      const alreadyInCart = index >= 0 ? current[index].quantity : 0;
      const nextQuantity = clampCartQuantity(alreadyInCart + requested, stock);
      if (nextQuantity <= 0) return current;

      if (index >= 0) {
        return current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: nextQuantity } : item);
      }

      return [...current, { productId: nextProductId, variantId, quantity: nextQuantity }];
    });

    showToast(`${product.nombre} · ${variant.talla || 'presentación'} agregado al carrito.`);
  }

  function updateCartQuantity(nextProductId, variantId, nextQuantity) {
    const product = activeProducts.find((item) => item.id === nextProductId);
    const variant = product?.variants?.find((item) => item.id === variantId);
    if (!variant) return;

    const parsed = Number.parseInt(nextQuantity, 10);
    if (Number.isFinite(parsed) && parsed <= 0) {
      removeFromCart(nextProductId, variantId);
      return;
    }

    const quantity = clampCartQuantity(nextQuantity, variant.stock);
    setCart((current) => current.map((item) => (
      item.productId === nextProductId && item.variantId === variantId
        ? { ...item, quantity: Math.max(1, quantity) }
        : item
    )));
  }

  function removeFromCart(nextProductId, variantId) {
    setCart((current) => current.filter((item) => !(item.productId === nextProductId && item.variantId === variantId)));
  }

  function clearCart() {
    setCart([]);
    showToast('Carrito vaciado.');
  }

  function getCartQuantity(nextProductId, variantId) {
    return cart.find((item) => item.productId === nextProductId && item.variantId === variantId)?.quantity || 0;
  }

  const lastUpdated = [rates?.usd?.updated_at, rates?.eur?.updated_at]
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <main>
      <header className="hero">
        <div className="hero__inner container">
          <Logo />
          <div className="hero__copy">
            <span className="hero__tag">Uniformes escolares</span>
            <h1>Lista de precios {modeLabel}</h1>
            <p>Catálogo de Roniforms con precios en efectivo y cálculos automáticos a tasa BCV.</p>

          </div>
        </div>
      </header>

      <section className="shopping-mode-section" aria-label="Tipo de compra">
        <div className="container">
          <div className="shopping-mode-panel">
            <div className="shopping-mode-panel__copy">
              <h2>¿Cómo quieres comprar?</h2>
              <p>El catálogo completo cambiará al tipo de precio que elijas.</p>
            </div>

            <div className="shopping-mode-toggle" role="group" aria-label="Seleccionar precio al mayor o al detal">
              <button
                type="button"
                className={shoppingMode === 'mayor' ? 'is-active' : ''}
                onClick={() => changeShoppingMode('mayor')}
                aria-pressed={shoppingMode === 'mayor'}
              >
                <span className="shopping-mode-toggle__icon" aria-hidden="true">📦</span>
                <span className="shopping-mode-toggle__text">
                  <strong>Al mayor</strong>
                  <small>Precio para compras al mayor</small>
                </span>
                <span className="shopping-mode-toggle__check" aria-hidden="true">✓</span>
              </button>

              <button
                type="button"
                className={shoppingMode === 'detal' ? 'is-active' : ''}
                onClick={() => changeShoppingMode('detal')}
                aria-pressed={shoppingMode === 'detal'}
              >
                <span className="shopping-mode-toggle__icon" aria-hidden="true">🛍️</span>
                <span className="shopping-mode-toggle__text">
                  <strong>Al detal</strong>
                  <small>Precio por unidad</small>
                </span>
                <span className="shopping-mode-toggle__check" aria-hidden="true">✓</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="container rates-grid" aria-live="polite">
        <article className="rate-card">
          <span>Dólar BCV</span>
          <strong>{rates ? formatRate(rates.usd?.rate) : 'Cargando…'}</strong>
          <small>Se aplica {rates?.pricing?.usd_markup_percent ?? 18}% al precio base</small>
          {rates?.usd?.manual_override && <b className="manual-badge">Manual</b>}
        </article>
        <article className="rate-card">
          <span>Euro BCV</span>
          <strong>{rates ? formatRate(rates.eur?.rate) : 'Cargando…'}</strong>
          <small>Se aplica {rates?.pricing?.eur_markup_percent ?? 5}% al precio base</small>
          {rates?.eur?.manual_override && <b className="manual-badge">Manual</b>}
        </article>
        <article className="rate-card rate-card--time">
          <span>Última actualización</span>
          <strong>{rates ? formatDateTime(lastUpdated) : 'Cargando…'}</strong>
          <small>La tasa nueva se activa apenas sea detectada.</small>
        </article>
      </section>

      <section className="container catalog-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catálogo {modeLabel}</p>
            <h2>Prendas disponibles</h2>
          </div>
          <span>{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}</span>
        </div>

        <div className={`notice-strip ${isRetail ? 'notice-strip--retail' : ''}`}>
          {isRetail
            ? 'Estás viendo precios al detal. Selecciona una prenda, talla y cantidad para consultar los totales.'
            : 'Estás viendo precios al mayor. Selecciona una prenda, talla y cantidad para consultar los totales.'}
        </div>

        <div className="filters filters--catalog" aria-label="Filtros del catálogo">
          <div className="filter-field">
            <label htmlFor="product-filter">Prenda</label>
            <select
              id="product-filter"
              className={!productId ? 'select-placeholder' : ''}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Selecciona una prenda</option>
              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.nombre}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="size-filter">Talla</label>
            <select
              id="size-filter"
              className={!size ? 'select-placeholder' : ''}
              value={size}
              onChange={(event) => setSize(event.target.value)}
              disabled={sizes.length === 0}
            >
              <option value="">Selecciona una talla</option>
              {sizes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}
        {loading && <div className="empty-state">Cargando catálogo…</div>}
        {!loading && !error && filtered.length === 0 && <div className="empty-state">No encontramos productos con esa prenda y talla.</div>}

        <div className="product-grid">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              rates={rates}
              preferredSize={size}
              shoppingMode={shoppingMode}
              onAddToCart={addToCart}
              getCartQuantity={getCartQuantity}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        className={`cart-launcher ${totals.pieces > 0 ? 'cart-launcher--active' : ''}`}
        onClick={() => setCartOpen(true)}
        aria-label={`Abrir carrito. ${totals.pieces} ${totals.pieces === 1 ? 'pieza' : 'piezas'}`}
      >
        <span className="cart-launcher__icon" aria-hidden="true">🛒</span>
        <span className="cart-launcher__copy">
          <strong>{totals.pieces > 0 ? 'Ver carrito' : 'Carrito'}</strong>
          <small>{totals.pieces > 0 ? `${totals.pieces} ${totals.pieces === 1 ? 'pieza' : 'piezas'}` : 'Aún está vacío'}</small>
        </span>
        {totals.pieces > 0 && <b>{formatUsd(totals.cash)}</b>}
        {totals.pieces > 0 && <span className="cart-launcher__badge">{totals.pieces}</span>}
      </button>

      {toast && <div className="cart-toast" role="status" aria-live="polite">✓ {toast}</div>}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        totals={totals}
        shoppingMode={shoppingMode}
        onUpdateQuantity={updateCartQuantity}
        onRemove={removeFromCart}
        onClear={clearCart}
      />

      <footer className="footer">
        <div className="container">
          <Logo compact />
          <p>Roniforms · Uniformes escolares · Precios {modeLabel}</p>
        </div>
      </footer>
    </main>
  );
}
