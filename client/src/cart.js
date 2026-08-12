import { calculateWholesalePrices, roundMoney } from './utils';

export const CART_STORAGE_KEY = 'roniforms-cart-v1';

export function loadStoredCart() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && item.productId && item.variantId)
      .map((item) => ({
        productId: String(item.productId),
        variantId: String(item.variantId),
        quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1)
      }));
  } catch {
    return [];
  }
}

export function saveCart(cart) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Algunos navegadores pueden bloquear localStorage.
  }
}

export function hasPrice(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function getVariantPrice(variant, shoppingMode) {
  if (!variant) return null;
  const raw = shoppingMode === 'detal' ? variant.precio_detal_usd : variant.precio_mayor_usd;
  return hasPrice(raw) ? Number(raw) : null;
}

export function clampCartQuantity(quantity, stock) {
  const parsed = Number.parseInt(quantity, 10);
  const safe = Number.isFinite(parsed) ? parsed : 1;
  if (safe <= 0) return 0;

  if (stock === null || stock === undefined || stock === '') return Math.min(999, safe);
  const numericStock = Number(stock);
  if (!Number.isFinite(numericStock) || numericStock < 0) return Math.min(999, safe);
  return Math.min(numericStock, safe);
}

export function resolveCartItems(cart, products, shoppingMode, rates) {
  return cart.map((entry) => {
    const product = products.find((item) => item.id === entry.productId);
    const variant = product?.variants?.find((item) => item.id === entry.variantId);
    if (!product || !variant) return null;

    const quantity = clampCartQuantity(entry.quantity, variant.stock);
    const base = getVariantPrice(variant, shoppingMode);
    const priceAvailable = base !== null;
    const usdMarkup = Number(rates?.pricing?.usd_markup_percent || 0);
    const eurMarkup = Number(rates?.pricing?.eur_markup_percent || 0);
    const calculated = calculateWholesalePrices({
      base: base || 0,
      usdMarkup,
      eurMarkup,
      usdRate: rates?.usd?.rate,
      eurRate: rates?.eur?.rate
    });

    return {
      ...entry,
      quantity,
      product,
      variant,
      base,
      priceAvailable,
      unitUsdReference: calculated.usdReference,
      unitEurReference: calculated.eurReference,
      unitUsdBolivares: calculated.usdBolivares,
      unitEurBolivares: calculated.eurBolivares,
      cashTotal: roundMoney((base || 0) * quantity),
      usdReferenceTotal: roundMoney(calculated.usdReference * quantity),
      eurReferenceTotal: roundMoney(calculated.eurReference * quantity),
      usdBolivaresTotal: calculated.usdBolivares * quantity,
      eurBolivaresTotal: calculated.eurBolivares * quantity
    };
  }).filter(Boolean);
}

export function cartTotals(items) {
  return items.reduce((acc, item) => {
    acc.lines += 1;
    acc.pieces += item.quantity;
    acc.cash += item.cashTotal;
    acc.usdReference += item.usdReferenceTotal;
    acc.eurReference += item.eurReferenceTotal;
    acc.usdBolivares += item.usdBolivaresTotal;
    acc.eurBolivares += item.eurBolivaresTotal;
    return acc;
  }, {
    lines: 0,
    pieces: 0,
    cash: 0,
    usdReference: 0,
    eurReference: 0,
    usdBolivares: 0,
    eurBolivares: 0
  });
}
