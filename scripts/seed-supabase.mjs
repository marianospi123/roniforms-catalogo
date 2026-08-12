import 'dotenv/config';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env.');
  process.exit(1);
}

const db = JSON.parse(await fs.readFile(new URL('../server/data/db.json', import.meta.url), 'utf8'));
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const products = (db.products || []).map((product) => ({
  id: product.id,
  nombre: product.nombre,
  categoria: product.categoria,
  descripcion: product.descripcion || '',
  image_url: product.image_url || '',
  activo: product.activo !== false,
  variants: product.variants || [],
  created_at: product.created_at || new Date().toISOString(),
  updated_at: product.updated_at || new Date().toISOString()
}));

if (products.length) {
  const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' });
  if (error) throw error;
}

const settings = db.settings || {};
const { error: settingsError } = await supabase.from('settings').upsert({
  id: 'roniforms',
  rates: settings.rates || {},
  pricing: settings.pricing || { usd_markup_percent: 18, eur_markup_percent: 5 },
  updated_at: settings.updated_at || new Date().toISOString()
});
if (settingsError) throw settingsError;

console.log(`Supabase cargado: ${products.length} productos y configuración de Roniforms.`);
