import React, { useEffect, useMemo, useState } from 'react';
import { calculateWholesalePrices, formatBs, formatEur, formatUsd, roundMoney } from '../utils';

function clampQuantity(value, maxQuantity) {
  const parsed = Number.parseInt(value, 10);
  const safe = Number.isFinite(parsed) ? parsed : 1;
  return Math.min(maxQuantity, Math.max(1, safe));
}

function hasPrice(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export default function ProductCard({ product, rates, preferredSize = '', shoppingMode = 'mayor', onAddToCart, getCartQuantity }) {
  const variants = product.variants || [];
  const [selectedId, setSelectedId] = useState(variants[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const isRetail = shoppingMode === 'detal';
  const displayDescription = String(product.descripcion || '').replace(/precio al mayor/gi, isRetail ? 'Precio al detal' : 'Precio al mayor');

  useEffect(() => {
    const preferredVariant = preferredSize
      ? variants.find((item) => item.talla === preferredSize)
      : null;

    if (preferredVariant && preferredVariant.id !== selectedId) {
      setSelectedId(preferredVariant.id);
      return;
    }

    if (!variants.some((item) => item.id === selectedId)) {
      setSelectedId(variants[0]?.id || '');
    }
  }, [variants, selectedId, preferredSize]);

  const selected = useMemo(
    () => variants.find((item) => item.id === selectedId) || variants[0],
    [variants, selectedId]
  );

  const stock = selected?.stock;
  const numericStock = stock === null || stock === undefined ? null : Number(stock);
  const soldOut = numericStock === 0;
  const maxQuantity = numericStock === null ? 999 : Math.max(1, numericStock);

  useEffect(() => {
    setQuantity(1);
  }, [selectedId, shoppingMode]);

  if (!selected) return null;

  const rawBase = isRetail ? selected.precio_detal_usd : selected.precio_mayor_usd;
  const priceAvailable = hasPrice(rawBase);
  const base = priceAvailable ? Number(rawBase) : 0;
  const usdMarkup = Number(rates?.pricing?.usd_markup_percent || 0);
  const eurMarkup = Number(rates?.pricing?.eur_markup_percent || 0);

  const {
    usdReference,
    eurReference,
    usdBolivares,
    eurBolivares
  } = calculateWholesalePrices({
    base,
    usdMarkup,
    eurMarkup,
    usdRate: rates?.usd?.rate,
    eurRate: rates?.eur?.rate
  });

  const pieces = quantity;
  const cashTotal = roundMoney(base * pieces);
  const usdReferenceTotal = roundMoney(usdReference * pieces);
  const eurReferenceTotal = roundMoney(eurReference * pieces);
  const usdBolivaresTotal = usdBolivares * pieces;
  const eurBolivaresTotal = eurBolivares * pieces;
  const pieceLabel = pieces === 1 ? 'pieza' : 'piezas';
  const quantityInCart = selected ? (getCartQuantity?.(product.id, selected.id) || 0) : 0;

  const stockLabel = stock === null || stock === undefined
    ? 'Disponibilidad por confirmar'
    : Number(stock) > 0
      ? `${stock} disponibles`
      : 'Agotado';

  function changeQuantity(nextValue) {
    if (soldOut || !priceAvailable) return;
    setQuantity(clampQuantity(nextValue, maxQuantity));
  }

  return (
    <article className="product-card">
      <div className="product-card__image-wrap">
        {product.image_url ? (
          <img src={product.image_url} alt={product.nombre} className="product-card__image" />
        ) : (
          <div className="product-card__placeholder">
            <span>{product.categoria}</span>
            <strong>{product.nombre}</strong>
          </div>
        )}
        <span className={`stock-pill ${stock === 0 ? 'stock-pill--out' : stock == null ? 'stock-pill--neutral' : ''}`}>
          {stockLabel}
        </span>
      </div>

      <div className="product-card__body">
        <div className="card-title-row">
          <div>
            <p className="eyebrow">{product.categoria}</p>
            <h3>{product.nombre}</h3>
          </div>
          <span className={`price-mode-badge ${isRetail ? 'price-mode-badge--retail' : ''}`}>{isRetail ? 'Detal' : 'Mayor'}</span>
        </div>
        {displayDescription && <p className="product-card__description">{displayDescription}</p>}

        <label className="field-label" htmlFor={`variant-${product.id}`}>Talla / presentación</label>
        <select
          id={`variant-${product.id}`}
          value={selected.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.talla}{variant.color ? ` · ${variant.color}` : ''}
              {isRetail && !hasPrice(variant.precio_detal_usd) ? ' · detal pendiente' : ''}
            </option>
          ))}
        </select>

        {!priceAvailable ? (
          <div className="price-unavailable">
            <strong>Precio al detal por cargar</strong>
            <span>Esta talla todavía no tiene precio al detal asignado.</span>
          </div>
        ) : (
          <>
            <div className="quantity-block">
              <div>
                <span className="field-label quantity-block__label">Cantidad de piezas</span>
                <small>{numericStock === null ? 'Puedes calcular cualquier cantidad.' : soldOut ? 'Esta presentación está agotada.' : `Máximo disponible: ${numericStock}`}</small>
              </div>
              <div className="quantity-control" aria-label="Seleccionar cantidad">
                <button
                  type="button"
                  onClick={() => changeQuantity(quantity - 1)}
                  disabled={soldOut || quantity <= 1}
                  aria-label="Restar una pieza"
                >−</button>
                <input
                  type="number"
                  min={1}
                  max={maxQuantity}
                  step="1"
                  value={quantity}
                  onChange={(event) => changeQuantity(event.target.value)}
                  disabled={soldOut}
                  aria-label="Cantidad de piezas"
                />
                <button
                  type="button"
                  onClick={() => changeQuantity(quantity + 1)}
                  disabled={soldOut || quantity >= maxQuantity}
                  aria-label="Agregar una pieza"
                >+</button>
              </div>
            </div>

            <div className="total-heading">
              <span>Total calculado</span>
              <strong>{pieces} {pieceLabel}</strong>
            </div>

            <div className="price-box price-box--three">
              <div className="price-box__cash">
                <span>Efectivo USD · total</span>
                <strong>{formatUsd(cashTotal)}</strong>
                <small>{formatUsd(base)} c/u · precio base {isRetail ? 'al detal' : 'al mayor'}</small>
              </div>
              <div>
                <span>Bs. · dólar BCV · total</span>
                <strong>{formatBs(usdBolivaresTotal)}</strong>
                <small>{formatUsd(usdReferenceTotal)} total · {formatUsd(usdReference)} c/u · incluye {usdMarkup}%</small>
              </div>
              <div className="price-box__euro">
                <span>Bs. · euro BCV · total</span>
                <strong>{formatBs(eurBolivaresTotal)}</strong>
                <small>{formatEur(eurReferenceTotal)} total · {formatEur(eurReference)} c/u · incluye {eurMarkup}%</small>
              </div>
            </div>

            <div className={`add-cart-block ${quantityInCart > 0 ? 'add-cart-block--in-cart' : ''}`}>
              {quantityInCart > 0 && (
                <div className="in-cart-note">
                  <span aria-hidden="true">✓</span>
                  <strong>{quantityInCart} {quantityInCart === 1 ? 'pieza' : 'piezas'} de esta talla en tu carrito</strong>
                </div>
              )}
              <button
                type="button"
                className="add-cart-button"
                onClick={() => onAddToCart?.({ productId: product.id, variantId: selected.id, quantity })}
                disabled={soldOut || !priceAvailable}
              >
                <span aria-hidden="true">🛒</span>
                <span>Agregar {pieces > 1 ? `${pieces} piezas` : 'al carrito'}</span>
                <strong>{formatUsd(cashTotal)}</strong>
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
