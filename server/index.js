import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3001);
const adminToken = process.env.ADMIN_ROUTE_TOKEN || (process.env.NODE_ENV === 'production' ? '' : 'dev-roniforms-admin');
const cronSecret = process.env.CRON_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-cron-secret');
const usdApiUrl = process.env.BCV_USD_API_URL || 'https://ve.dolarapi.com/v1/dolares/oficial';
const eurApiUrl = process.env.BCV_EUR_API_URL || 'https://ve.dolarapi.com/v1/euros/oficial';
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;

const dataFile = path.join(__dirname, 'data', 'db.json');
const uploadsDir = path.join(__dirname, 'uploads');

app.use(cors({ origin: clientOrigin === '*' ? true : clientOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: hasSupabase ? multer.memoryStorage() : multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      callback(null, `${Date.now()}-${randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => file.mimetype.startsWith('image/') ? callback(null, true) : callback(new Error('Solo se permiten imágenes.'))
});

const defaultSettings = () => ({
  rates: {
    usd: { automatic_rate: 0, manual_rate: 0, manual_override: false, source: 'BCV', source_updated_at: null },
    eur: { automatic_rate: 0, manual_rate: 0, manual_override: false, source: 'BCV', source_updated_at: null }
  },
  pricing: { usd_markup_percent: 18, eur_markup_percent: 5 },
  updated_at: new Date().toISOString()
});

function normalizeVariant(variant = {}) {
  const rawStock = variant.stock;
  const stock = rawStock === '' || rawStock === null || rawStock === undefined
    ? null
    : Math.max(0, Number.parseInt(rawStock, 10));

  const wholesalePrice = Number(variant.precio_mayor_usd ?? variant.precio_efectivo_usd ?? 0);
  const rawRetailPrice = variant.precio_detal_usd;
  const retailPrice = rawRetailPrice === '' || rawRetailPrice === null || rawRetailPrice === undefined
    ? null
    : Number(rawRetailPrice);

  return {
    id: variant.id || randomUUID(),
    talla: String(variant.talla || '').trim(),
    color: String(variant.color || '').trim(),
    precio_mayor_usd: wholesalePrice,
    precio_detal_usd: retailPrice,
    stock
  };
}

function normalizeProduct(product = {}, id = null) {
  const variants = Array.isArray(product.variants) ? product.variants.map(normalizeVariant) : [];
  if (!String(product.nombre || '').trim()) throw new Error('El nombre del producto es obligatorio.');
  if (!String(product.categoria || '').trim()) throw new Error('La categoría es obligatoria.');
  if (!variants.length || variants.some((item) => !item.talla)) throw new Error('Agrega al menos una talla válida.');
  if (variants.some((item) => !Number.isFinite(item.precio_mayor_usd) || item.precio_mayor_usd < 0)) throw new Error('Escribe un precio al mayor válido.');
  if (variants.some((item) => item.precio_detal_usd !== null && (!Number.isFinite(item.precio_detal_usd) || item.precio_detal_usd < 0))) throw new Error('Escribe un precio al detal válido o déjalo vacío.');

  return {
    ...(id ? { id } : {}),
    nombre: String(product.nombre).trim(),
    categoria: String(product.categoria).trim(),
    descripcion: String(product.descripcion || '').trim(),
    image_url: String(product.image_url || '').trim(),
    activo: product.activo !== false,
    variants,
    updated_at: new Date().toISOString()
  };
}

async function ensureLocalDb() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  try {
    const db = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    let changed = false;
    if (!db.settings) {
      const legacy = db.rate || {};
      db.settings = defaultSettings();
      db.settings.rates.usd = {
        automatic_rate: Number(legacy.automatic_rate || 0), manual_rate: Number(legacy.manual_rate || 0),
        manual_override: Boolean(legacy.manual_override), source: legacy.source || 'BCV', source_updated_at: legacy.source_updated_at || null
      };
      changed = true;
    }
    db.products = (db.products || []).map((product) => ({ ...product, variants: (product.variants || []).map(normalizeVariant) }));
    if (!Array.isArray(db.rate_history)) { db.rate_history = []; changed = true; }
    if (changed) await fs.writeFile(dataFile, JSON.stringify(db, null, 2));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.writeFile(dataFile, JSON.stringify({ products: [], settings: defaultSettings(), rate_history: [] }, null, 2));
  }
}

async function readLocalDb() {
  await ensureLocalDb();
  return JSON.parse(await fs.readFile(dataFile, 'utf8'));
}
async function writeLocalDb(db) { await fs.writeFile(dataFile, JSON.stringify(db, null, 2)); }

async function getProducts() {
  if (hasSupabase) {
    const { data, error } = await supabase.from('products').select('*').order('categoria').order('nombre');
    if (error) throw error;
    return (data || []).map((product) => ({ ...product, variants: (product.variants || []).map(normalizeVariant) }));
  }
  return (await readLocalDb()).products;
}
async function getProduct(id) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }
  return (await readLocalDb()).products.find((item) => item.id === id) || null;
}
async function createProduct(product) {
  const normalized = normalizeProduct(product);
  const row = { ...normalized, id: randomUUID(), created_at: new Date().toISOString() };
  if (hasSupabase) {
    const { data, error } = await supabase.from('products').insert(row).select().single();
    if (error) throw error;
    return data;
  }
  const db = await readLocalDb(); db.products.push(row); await writeLocalDb(db); return row;
}
async function updateProduct(id, product) {
  const existing = await getProduct(id);
  if (!existing) throw new Error('Producto no encontrado.');
  const normalized = normalizeProduct(product, id);
  const row = { ...existing, ...normalized };
  if (hasSupabase) {
    const { data, error } = await supabase.from('products').update(normalized).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  const db = await readLocalDb(); db.products = db.products.map((item) => item.id === id ? row : item); await writeLocalDb(db); return row;
}
async function deleteProduct(id) {
  if (hasSupabase) {
    const { error } = await supabase.from('products').delete().eq('id', id); if (error) throw error; return;
  }
  const db = await readLocalDb(); db.products = db.products.filter((item) => item.id !== id); await writeLocalDb(db);
}

async function getSettingsRaw() {
  if (hasSupabase) {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'roniforms').single();
    if (error) throw error;
    return { rates: data.rates, pricing: data.pricing, updated_at: data.updated_at };
  }
  return (await readLocalDb()).settings || defaultSettings();
}

async function saveSettings(settings, historyEntries = []) {
  const payload = { ...settings, updated_at: new Date().toISOString() };
  if (hasSupabase) {
    const { error } = await supabase.from('settings').upsert({ id: 'roniforms', rates: payload.rates, pricing: payload.pricing, updated_at: payload.updated_at });
    if (error) throw error;
    if (historyEntries.length) {
      const { error: historyError } = await supabase.from('rate_history').insert(historyEntries.map((entry) => ({ ...entry, observed_at: entry.observed_at || payload.updated_at })));
      if (historyError) throw historyError;
    }
    return payload;
  }
  const db = await readLocalDb(); db.settings = payload; db.rate_history = [...historyEntries.map((entry) => ({ id: randomUUID(), ...entry })), ...(db.rate_history || [])]; await writeLocalDb(db); return payload;
}

function publicSettings(settings) {
  const makeRate = (currency) => {
    const item = settings.rates?.[currency] || {};
    return {
      ...item,
      rate: Number(item.manual_override ? item.manual_rate : item.automatic_rate) || 0,
      updated_at: item.source_updated_at || settings.updated_at
    };
  };
  return { usd: makeRate('usd'), eur: makeRate('eur'), pricing: settings.pricing || { usd_markup_percent: 18, eur_markup_percent: 5 }, updated_at: settings.updated_at };
}

function parseRatePayload(payload) {
  const candidate = payload.promedio ?? payload.venta ?? payload.price ?? payload.rate;
  const rate = Number(candidate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('La API no devolvió una tasa válida.');
  return { rate, sourceUpdatedAt: payload.fechaActualizacion || payload.updatedAt || payload.date || new Date().toISOString(), source: payload.fuente || payload.nombre || 'BCV' };
}

async function fetchRate(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`La API respondió ${response.status}.`);
  return parseRatePayload(await response.json());
}

async function refreshBcvRates() {
  const [usdResult, eurResult] = await Promise.allSettled([fetchRate(usdApiUrl), fetchRate(eurApiUrl)]);
  const settings = await getSettingsRaw();
  settings.rates ||= defaultSettings().rates;
  const history = [];
  const output = { changed: false, errors: [] };

  for (const [currency, result] of [['usd', usdResult], ['eur', eurResult]]) {
    if (result.status === 'rejected') {
      output[currency] = { changed: false, error: result.reason.message };
      output.errors.push(`${currency === 'usd' ? 'Dólar' : 'Euro'}: ${result.reason.message}`);
      continue;
    }
    const current = settings.rates[currency] || defaultSettings().rates[currency];
    const changed = Number(current.automatic_rate || 0) !== Number(result.value.rate);
    if (changed) {
      settings.rates[currency] = {
        ...current,
        automatic_rate: result.value.rate,
        source: result.value.source,
        source_updated_at: result.value.sourceUpdatedAt
      };
      history.push({ currency, rate: result.value.rate, source: result.value.source, observed_at: new Date().toISOString() });
      output.changed = true;
    }
    output[currency] = { changed, rate: result.value.rate, source_updated_at: result.value.sourceUpdatedAt };
  }

  if (output.changed) await saveSettings(settings, history);
  return output;
}

function requireAdmin(req, res, next) {
  if (!adminToken || req.params.token !== adminToken) return res.status(403).json({ error: 'Enlace administrativo inválido.' });
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: hasSupabase ? 'supabase' : 'local' }));
app.get('/api/catalog', async (_req, res, next) => { try { const products = await getProducts(); res.json({ products: products.filter((item) => item.activo !== false) }); } catch (error) { next(error); } });
app.get('/api/rate', async (_req, res, next) => { try { res.json(publicSettings(await getSettingsRaw())); } catch (error) { next(error); } });
app.get('/api/admin/:token/validate', requireAdmin, (_req, res) => res.json({ ok: true }));
app.get('/api/admin/:token/products', requireAdmin, async (_req, res, next) => { try { res.json({ products: await getProducts() }); } catch (error) { next(error); } });
app.post('/api/admin/:token/products', requireAdmin, async (req, res, next) => { try { res.status(201).json({ product: await createProduct(req.body) }); } catch (error) { next(error); } });
app.put('/api/admin/:token/products/:id', requireAdmin, async (req, res, next) => { try { res.json({ product: await updateProduct(req.params.id, req.body) }); } catch (error) { next(error); } });
app.delete('/api/admin/:token/products/:id', requireAdmin, async (req, res, next) => { try { await deleteProduct(req.params.id); res.json({ ok: true }); } catch (error) { next(error); } });

app.post('/api/admin/:token/products/:id/image', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen.' });
    let imageUrl;
    if (hasSupabase) {
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const filePath = `products/${req.params.id}/${Date.now()}-${randomUUID()}${ext}`;
      const { error: uploadError } = await supabase.storage.from(storageBucket).upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (uploadError) throw uploadError;
      imageUrl = supabase.storage.from(storageBucket).getPublicUrl(filePath).data.publicUrl;
    } else imageUrl = `/uploads/${req.file.filename}`;
    const product = await getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ product: await updateProduct(req.params.id, { ...product, image_url: imageUrl }) });
  } catch (error) { next(error); }
});

app.post('/api/admin/:token/rate/manual', requireAdmin, async (req, res, next) => {
  try {
    const currency = String(req.body.currency || '').toLowerCase();
    if (!['usd', 'eur'].includes(currency)) return res.status(400).json({ error: 'Moneda inválida.' });
    const enabled = Boolean(req.body.enabled);
    const rate = Number(req.body.rate);
    if (enabled && (!Number.isFinite(rate) || rate <= 0)) return res.status(400).json({ error: 'Escribe una tasa manual válida.' });
    const settings = await getSettingsRaw();
    settings.rates[currency] = { ...settings.rates[currency], manual_override: enabled, manual_rate: Number.isFinite(rate) ? rate : 0 };
    await saveSettings(settings);
    res.json(publicSettings(settings));
  } catch (error) { next(error); }
});

app.post('/api/admin/:token/pricing', requireAdmin, async (req, res, next) => {
  try {
    const usd = Number(req.body.usd_markup_percent);
    const eur = Number(req.body.eur_markup_percent);
    if (![usd, eur].every((value) => Number.isFinite(value) && value >= 0 && value <= 500)) return res.status(400).json({ error: 'Escribe porcentajes válidos.' });
    const settings = await getSettingsRaw();
    settings.pricing = { usd_markup_percent: usd, eur_markup_percent: eur };
    await saveSettings(settings);
    res.json(publicSettings(settings));
  } catch (error) { next(error); }
});

app.post('/api/admin/:token/rate/refresh', requireAdmin, async (_req, res, next) => { try { res.json(await refreshBcvRates()); } catch (error) { next(error); } });
app.post('/api/internal/rate/refresh', async (req, res, next) => {
  try {
    if (!cronSecret || req.get('x-cron-secret') !== cronSecret) return res.status(403).json({ error: 'Cron no autorizado.' });
    res.json(await refreshBcvRates());
  } catch (error) { next(error); }
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
app.use((error, _req, res, _next) => { console.error(error); res.status(400).json({ error: error.message || 'Ocurrió un error inesperado.' }); });

await ensureLocalDb();
app.listen(port, () => {
  console.log(`Roniforms API en http://localhost:${port}`);
  console.log(`Modo de datos: ${hasSupabase ? 'Supabase' : 'JSON local'}`);
  if (!process.env.ADMIN_ROUTE_TOKEN && process.env.NODE_ENV !== 'production') console.log('Administración local: http://localhost:5173/gestion/dev-roniforms-admin');
  refreshBcvRates().then((result) => console.log('Consulta inicial BCV:', result.changed ? 'tasas actualizadas' : 'sin cambios')).catch((error) => console.warn('No se pudieron consultar las tasas al iniciar:', error.message));
});
