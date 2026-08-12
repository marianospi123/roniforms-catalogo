import { calculateWholesalePrices } from './client/src/utils.js';

const result = calculateWholesalePrices({
  base: 6.5,
  usdMarkup: 18,
  eurMarkup: 5,
  usdRate: 744.2269,
  eurRate: 846.0738
});

console.log(JSON.stringify(result, null, 2));

const expectedEurReference = 6.83;
const expectedEurBolivares = 5778.684054;

if (result.eurReference !== expectedEurReference) {
  throw new Error(`Referencia EUR incorrecta: ${result.eurReference}`);
}

if (Math.abs(result.eurBolivares - expectedEurBolivares) > 0.000001) {
  throw new Error(`Total EUR incorrecto: ${result.eurBolivares}`);
}

console.log('Verificación correcta: €6,83 × Bs. 846,0738 = Bs. 5.778,68');
