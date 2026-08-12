export function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;

  // Roniforms redondea primero el precio con recargo a 2 decimales
  // y luego multiplica ese resultado por la tasa BCV.
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function calculateWholesalePrices({
  base,
  usdMarkup,
  eurMarkup,
  usdRate,
  eurRate
}) {
  const basePrice = Number(base || 0);
  const usdMarkupPercent = Number(usdMarkup || 0);
  const eurMarkupPercent = Number(eurMarkup || 0);
  const currentUsdRate = Number(usdRate || 0);
  const currentEurRate = Number(eurRate || 0);

  // Paso 1: aplicar el porcentaje.
  // Paso 2: redondear el precio resultante a 2 decimales.
  const usdReference = roundMoney(basePrice * (1 + usdMarkupPercent / 100));
  const eurReference = roundMoney(basePrice * (1 + eurMarkupPercent / 100));

  // Paso 3: multiplicar el precio ya redondeado por su tasa BCV.
  const usdBolivares = usdReference * currentUsdRate;
  const eurBolivares = eurReference * currentEurRate;

  return {
    basePrice,
    usdReference,
    eurReference,
    usdBolivares,
    eurBolivares
  };
}

export function formatBs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 'Tasa pendiente';

  return `Bs. ${number.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatEur(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatRate(value) {
  const number = Number(value || 0);
  if (!number) return 'Pendiente';
  return `Bs. ${number.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function formatDateTime(value) {
  if (!value) return 'Sin información';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Caracas'
  }).format(date);
}
