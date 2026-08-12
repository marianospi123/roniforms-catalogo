import React, { useEffect, useMemo, useState } from 'react';
import { formatBs, formatUsd } from '../utils';

const WHATSAPP_NUMBER = '584127016003';

function itemKey(item) {
  return `${item.productId}:${item.variantId}`;
}

export default function CartDrawer({
  open,
  onClose,
  items,
  totals,
  shoppingMode,
  onUpdateQuantity,
  onRemove,
  onClear
}) {
  const [copied, setCopied] = useState(false);

  const isRetail = shoppingMode === 'detal';
  const modeLabel = isRetail ? 'al detal' : 'al mayor';

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return undefined;

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [copied]);

  /*
   * Texto completo del pedido.
   * Se utiliza tanto para copiar el resumen
   * como para enviarlo directamente a WhatsApp.
   */
  const orderText = useMemo(() => {
    const lines = items.map((item, index) => {
      const detail = [
        item.variant.talla ? `Talla: ${item.variant.talla}` : null,
        item.variant.color ? `Color: ${item.variant.color}` : null
      ]
        .filter(Boolean)
        .join(' · ');

      return [
        `${index + 1}. *${item.product.nombre}*`,
        `   ${detail || 'Presentación estándar'}`,
        `   Cantidad: ${item.quantity} ${item.quantity === 1 ? 'pieza' : 'piezas'}`,
        `   Precio unitario: ${formatUsd(item.base)}`,
        `   Total: ${formatUsd(item.cashTotal)}`
      ].join('\n');
    });

    return [
      '👋 Hola, quiero realizar un pedido en *Roniforms*.',
      '',
      `Modalidad: ${isRetail ? '🛍️ *AL DETAL*' : '📦 *AL MAYOR*'}`,
      '',
      '🛒 *MI PEDIDO*',
      '',
      ...lines,
      '',
      '────────────────',
      `🧾 Total de piezas: *${totals.pieces}*`,
      '',
      `💵 Efectivo USD: *${formatUsd(totals.cash)}*`,
      `🇻🇪 Bs. según dólar BCV: *${formatBs(totals.usdBolivares)}*`,
      `🇻🇪 Bs. según euro BCV: *${formatBs(totals.eurBolivares)}*`,
      '────────────────',
      '',
      'Quisiera confirmar la disponibilidad de estas prendas y continuar mi compra con un asesor.',
      '',
      '¡Gracias! 😊'
    ].join('\n');
  }, [items, totals, isRetail]);

  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(orderText);
      setCopied(true);
    } catch {
      const textarea = document.createElement('textarea');

      textarea.value = orderText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);

      textarea.select();
      document.execCommand('copy');

      textarea.remove();

      setCopied(true);
    }
  }

  /*
   * Abre WhatsApp con el pedido completo
   * dirigido directamente al número de Roniforms.
   */
  function sendOrderToWhatsApp() {
    if (!items.length) return;

    const encodedMessage = encodeURIComponent(orderText);

    const whatsappUrl =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

    window.open(
      whatsappUrl,
      '_blank',
      'noopener,noreferrer'
    );
  }

  if (!open) return null;

  return (
    <div className="cart-layer" role="presentation">
      <button
        type="button"
        className="cart-backdrop"
        onClick={onClose}
        aria-label="Cerrar carrito"
      />

      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <header className="cart-drawer__header">
          <div>
            <span className="cart-drawer__eyebrow">
              Tu compra {modeLabel}
            </span>

            <h2 id="cart-title">
              Carrito
            </h2>

            <p>
              {totals.pieces}{' '}
              {totals.pieces === 1 ? 'pieza' : 'piezas'} en{' '}
              {totals.lines}{' '}
              {totals.lines === 1 ? 'producto' : 'productos'}
            </p>
          </div>

          <button
            type="button"
            className="cart-close"
            onClick={onClose}
            aria-label="Cerrar carrito"
          >
            ×
          </button>
        </header>

        {items.length === 0 ? (
          <div className="cart-empty">
            <div
              className="cart-empty__icon"
              aria-hidden="true"
            >
              🛒
            </div>

            <h3>
              Tu carrito está vacío
            </h3>

            <p>
              Selecciona una talla y cantidad en cualquier
              prenda para comenzar tu pedido.
            </p>

            <button
              type="button"
              className="button cart-primary-action"
              onClick={onClose}
            >
              Ver prendas
            </button>
          </div>
        ) : (
          <>
            <div className="cart-drawer__tools">
              <span>
                {isRetail
                  ? '🛍️ Precios al detal'
                  : '📦 Precios al mayor'}
              </span>

              <button
                type="button"
                onClick={onClear}
              >
                Vaciar carrito
              </button>
            </div>

            <div className="cart-items">
              {items.map((item) => {
                const stock = item.variant.stock;

                const numericStock =
                  stock === null || stock === undefined
                    ? null
                    : Number(stock);

                const canIncrease =
                  numericStock === null ||
                  item.quantity < numericStock;

                const detail = [
                  item.variant.talla,
                  item.variant.color
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <article
                    className="cart-item"
                    key={itemKey(item)}
                  >
                    <div className="cart-item__image-wrap">
                      {item.product.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.nombre}
                          className="cart-item__image"
                        />
                      ) : (
                        <div
                          className="cart-item__placeholder"
                          aria-hidden="true"
                        >
                          R
                        </div>
                      )}
                    </div>

                    <div className="cart-item__content">
                      <div className="cart-item__top">
                        <div>
                          <h3>
                            {item.product.nombre}
                          </h3>

                          <p>
                            {detail ||
                              'Presentación estándar'}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="cart-item__remove"
                          onClick={() =>
                            onRemove(
                              item.productId,
                              item.variantId
                            )
                          }
                          aria-label={`Eliminar ${item.product.nombre}`}
                        >
                          Eliminar
                        </button>
                      </div>

                      <div className="cart-item__price-row">
                        <div>
                          <span>
                            Precio unitario
                          </span>

                          <strong>
                            {formatUsd(item.base)}
                          </strong>
                        </div>

                        <div className="cart-item__line-total">
                          <span>
                            Total
                          </span>

                          <strong>
                            {formatUsd(item.cashTotal)}
                          </strong>
                        </div>
                      </div>

                      <div className="cart-item__quantity-row">
                        <div
                          className="cart-quantity"
                          aria-label={`Cantidad de ${item.product.nombre}`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity - 1
                              )
                            }
                            aria-label={
                              item.quantity === 1
                                ? 'Eliminar producto'
                                : 'Restar una pieza'
                            }
                          >
                            {item.quantity === 1
                              ? '×'
                              : '−'}
                          </button>

                          <input
                            type="number"
                            min="0"
                            max={
                              numericStock ?? 999
                            }
                            value={item.quantity}
                            onChange={(event) =>
                              onUpdateQuantity(
                                item.productId,
                                item.variantId,
                                event.target.value
                              )
                            }
                            aria-label="Cantidad"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity + 1
                              )
                            }
                            disabled={!canIncrease}
                            aria-label="Agregar una pieza"
                          >
                            +
                          </button>
                        </div>

                        <small>
                          {numericStock === null
                            ? 'Disponibilidad por confirmar'
                            : `${numericStock} disponibles`}
                        </small>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <footer className="cart-summary">
              <div className="cart-summary__heading">
                <span>
                  Resumen
                </span>

                <strong>
                  {totals.pieces}{' '}
                  {totals.pieces === 1
                    ? 'pieza'
                    : 'piezas'}
                </strong>
              </div>

              <div className="cart-summary__rows">
                <div className="cart-summary__row cart-summary__row--main">
                  <span>
                    Efectivo USD
                  </span>

                  <strong>
                    {formatUsd(totals.cash)}
                  </strong>
                </div>

                <div className="cart-summary__row">
                  <span>
                    Bs. · dólar BCV
                  </span>

                  <strong>
                    {formatBs(
                      totals.usdBolivares
                    )}
                  </strong>
                </div>

                <div className="cart-summary__row">
                  <span>
                    Bs. · euro BCV
                  </span>

                  <strong>
                    {formatBs(
                      totals.eurBolivares
                    )}
                  </strong>
                </div>
              </div>

              <p className="cart-summary__note">
                Los totales se recalculan
                automáticamente con la modalidad y
                tasas vigentes del catálogo.
              </p>

              {/* BOTÓN PRINCIPAL DE WHATSAPP */}
              <button
                type="button"
                className="button cart-primary-action cart-whatsapp-action"
                onClick={sendOrderToWhatsApp}
              >
                💬 Finalizar pedido por WhatsApp
              </button>

              {/* OPCIÓN SECUNDARIA */}
              <button
                type="button"
                className="cart-copy-order"
                onClick={copyOrder}
              >
                {copied
                  ? '✓ Resumen copiado'
                  : 'Copiar resumen del pedido'}
              </button>

              <button
                type="button"
                className="cart-continue"
                onClick={onClose}
              >
                Seguir comprando
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}