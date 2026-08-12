import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import Logo from '../components/Logo';
import { notifyCatalogUpdated } from '../catalogSync';
import { calculateWholesalePrices, formatBs, formatDateTime, formatEur, formatRate, formatUsd } from '../utils';

const emptyVariant = () => ({
  id: crypto.randomUUID(), talla: '', color: '', precio_mayor_usd: '', precio_detal_usd: '', stock: ''
});

const emptyProduct = () => ({
  nombre: '', categoria: '', descripcion: '', image_url: '', activo: true, variants: [emptyVariant()]
});

export default function AdminPage() {
  const { token } = useParams();
  const [authorized, setAuthorized] = useState(null);
  const [products, setProducts] = useState([]);
  const [rates, setRates] = useState(null);
  const [form, setForm] = useState(emptyProduct());
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [manual, setManual] = useState({ usd: { enabled: false, rate: '' }, eur: { enabled: false, rate: '' } });
  const [pricing, setPricing] = useState({ usd_markup_percent: 18, eur_markup_percent: 5 });

  const categories = useMemo(
    () => [...new Set(products.map((item) => item.categoria).filter(Boolean))],
    [products]
  );

  async function loadData() {
    const [catalogData, rateData] = await Promise.all([api.getAdminProducts(token), api.getRates()]);
    setProducts(catalogData.products || []);
    setRates(rateData);
    setManual({
      usd: { enabled: Boolean(rateData.usd?.manual_override), rate: rateData.usd?.manual_rate || rateData.usd?.rate || '' },
      eur: { enabled: Boolean(rateData.eur?.manual_override), rate: rateData.eur?.manual_rate || rateData.eur?.rate || '' }
    });
    setPricing(rateData.pricing || { usd_markup_percent: 18, eur_markup_percent: 5 });
  }

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow,noarchive';
    document.head.appendChild(robots);

    api.validateAdmin(token)
      .then(() => { setAuthorized(true); return loadData(); })
      .catch(() => setAuthorized(false));

    return () => robots.remove();
  }, [token]);

  function updateVariant(index, key, value) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, [key]: value } : variant)
    }));
  }

  function addVariant() {
    setForm((current) => ({ ...current, variants: [...current.variants, emptyVariant()] }));
  }

  function removeVariant(index) {
    setForm((current) => ({
      ...current,
      variants: current.variants.length === 1 ? current.variants : current.variants.filter((_, variantIndex) => variantIndex !== index)
    }));
  }

  function editProduct(product) {
    setEditingId(product.id);
    setForm({
      ...product,
      variants: (product.variants || []).map((variant) => ({ ...variant, precio_detal_usd: variant.precio_detal_usd ?? '', stock: variant.stock ?? '' }))
    });
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyProduct());
    setImageFile(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = {
        ...form,
        variants: form.variants.map((variant) => ({
          ...variant,
          precio_mayor_usd: Number(variant.precio_mayor_usd),
          precio_detal_usd: variant.precio_detal_usd === '' || variant.precio_detal_usd === null
            ? null
            : Number(variant.precio_detal_usd),
          stock: variant.stock === '' || variant.stock === null ? null : Number(variant.stock)
        }))
      };
      const saved = editingId
        ? await api.updateProduct(token, editingId, payload)
        : await api.createProduct(token, payload);
      if (imageFile) await api.uploadImage(token, saved.product.id, imageFile);
      await loadData();
      const wasEditing = Boolean(editingId);
      resetForm();
      notifyCatalogUpdated();
      setMessage(wasEditing ? 'Producto actualizado correctamente. Los precios del catálogo se recalcularon automáticamente.' : 'Producto creado correctamente.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`¿Eliminar “${product.nombre}”?`)) return;
    setBusy(true); setError('');
    try {
      await api.deleteProduct(token, product.id);
      await loadData();
      if (editingId === product.id) resetForm();
      notifyCatalogUpdated();
      setMessage('Producto eliminado.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function saveManualRate(currency) {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.setManualRate(token, {
        currency,
        enabled: manual[currency].enabled,
        rate: Number(manual[currency].rate)
      });
      await loadData();
      notifyCatalogUpdated();
      setMessage(`Tasa manual de ${currency === 'usd' ? 'dólar' : 'euro'} guardada.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function savePricing(event) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await api.setPricing(token, {
        usd_markup_percent: Number(pricing.usd_markup_percent),
        eur_markup_percent: Number(pricing.eur_markup_percent)
      });
      await loadData();
      notifyCatalogUpdated();
      setMessage('Porcentajes de cálculo actualizados.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function refreshRates() {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api.refreshRates(token);
      await loadData();
      notifyCatalogUpdated();
      const changed = [result.usd?.changed && 'dólar', result.eur?.changed && 'euro'].filter(Boolean);
      setMessage(changed.length ? `Nueva tasa activa: ${changed.join(' y ')}.` : 'Las tasas no cambiaron.');
      if (result.errors?.length) setError(result.errors.join(' '));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (authorized === null) return <div className="center-screen">Verificando enlace privado…</div>;
  if (!authorized) return <div className="center-screen"><div className="alert alert--error">Este enlace de administración no es válido.</div></div>;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="container admin-header__inner">
          <Logo compact />
          <div><span className="private-pill">Vista privada</span><h1>Gestión de inventario</h1></div>
          <a className="button button--ghost" href="/" target="_blank" rel="noreferrer">Ver catálogo</a>
        </div>
      </header>

      <div className="container admin-layout">
        {message && <div className="alert alert--success">{message}</div>}
        {error && <div className="alert alert--error">{error}</div>}

        <section className="admin-card">
          <div className="admin-rate-heading">
            <div><p className="eyebrow">Tasas BCV</p><h2>Dólar y euro</h2></div>
            <button className="button" onClick={refreshRates} disabled={busy}>Consultar ambas ahora</button>
          </div>

          <div className="admin-rate-grid">
            {['usd', 'eur'].map((currency) => {
              const label = currency === 'usd' ? 'Dólar BCV' : 'Euro BCV';
              return (
                <article className="admin-rate-box" key={currency}>
                  <span>{label}</span>
                  <strong>{formatRate(rates?.[currency]?.rate)}</strong>
                  <small>Actualizada: {formatDateTime(rates?.[currency]?.updated_at)}</small>
                  <label className="check-control">
                    <input type="checkbox" checked={manual[currency].enabled} onChange={(e) => setManual({ ...manual, [currency]: { ...manual[currency], enabled: e.target.checked } })} />
                    Usar tasa manual
                  </label>
                  <div className="inline-form">
                    <input type="number" min="0.01" step="0.0001" value={manual[currency].rate} onChange={(e) => setManual({ ...manual, [currency]: { ...manual[currency], rate: e.target.value } })} />
                    <button type="button" className="button button--secondary" onClick={() => saveManualRate(currency)} disabled={busy}>Guardar</button>
                  </div>
                </article>
              );
            })}
          </div>

          <form className="pricing-form" onSubmit={savePricing}>
            <div><p className="eyebrow">Reglas de precio</p><h3>Porcentajes sobre el precio en efectivo</h3></div>
            <label>Dólar BCV (%)<input type="number" min="0" step="0.01" value={pricing.usd_markup_percent} onChange={(e) => setPricing({ ...pricing, usd_markup_percent: e.target.value })} /></label>
            <label>Euro BCV (%)<input type="number" min="0" step="0.01" value={pricing.eur_markup_percent} onChange={(e) => setPricing({ ...pricing, eur_markup_percent: e.target.value })} /></label>
            <button className="button button--secondary" disabled={busy}>Guardar porcentajes</button>
          </form>
        </section>

        <section className="admin-card">
          <div className="section-heading">
            <div><p className="eyebrow">Productos</p><h2>{editingId ? 'Editar producto' : 'Crear producto'}</h2></div>
            {editingId && <button className="link-button" onClick={resetForm}>Cancelar edición</button>}
          </div>

          <form onSubmit={handleSubmit} className="product-form">
            <div className="form-grid">
              <label>Nombre del producto<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
              <label>Categoría<input list="categories" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} required />
                <datalist id="categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
              </label>
              <label className="form-grid__full">Descripción<textarea value={form.descripcion || ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows="3" /></label>
              <label>Fotografía<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} /></label>
              <label className="check-control check-control--form"><input type="checkbox" checked={form.activo !== false} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Producto visible</label>
            </div>

            <div className="variants-heading"><h3>Tallas y precios</h3><button type="button" className="button button--ghost" onClick={addVariant}>+ Agregar talla</button></div>
            <p className="helper-text">Cada talla puede tener un precio al mayor y otro al detal. Los productos existentes pueden dejar el detal vacío mientras completas la carga; los cálculos BCV se generan automáticamente para ambos.</p>

            <div className="variant-list">
              {form.variants.map((variant, index) => {
                const wholesalePreview = calculateWholesalePrices({
                  base: variant.precio_mayor_usd,
                  usdMarkup: pricing.usd_markup_percent,
                  eurMarkup: pricing.eur_markup_percent,
                  usdRate: rates?.usd?.rate,
                  eurRate: rates?.eur?.rate
                });
                const hasRetailPrice = variant.precio_detal_usd !== '' && variant.precio_detal_usd !== null && variant.precio_detal_usd !== undefined;
                const retailPreview = calculateWholesalePrices({
                  base: hasRetailPrice ? variant.precio_detal_usd : 0,
                  usdMarkup: pricing.usd_markup_percent,
                  eurMarkup: pricing.eur_markup_percent,
                  usdRate: rates?.usd?.rate,
                  eurRate: rates?.eur?.rate
                });

                return (
                  <div className="variant-row variant-row--simple" key={variant.id}>
                    <label>Talla / rango<input value={variant.talla} onChange={(e) => updateVariant(index, 'talla', e.target.value)} required /></label>
                    <label>Color<input value={variant.color || ''} onChange={(e) => updateVariant(index, 'color', e.target.value)} /></label>
                    <label>Precio mayor USD<input type="number" min="0" step="0.01" value={variant.precio_mayor_usd} onChange={(e) => updateVariant(index, 'precio_mayor_usd', e.target.value)} required /></label>
                    <label>Precio detal USD<input type="number" min="0" step="0.01" value={variant.precio_detal_usd ?? ''} onChange={(e) => updateVariant(index, 'precio_detal_usd', e.target.value)} placeholder="Por cargar" /></label>
                    <label>Stock (opcional)<input type="number" min="0" step="1" value={variant.stock ?? ''} onChange={(e) => updateVariant(index, 'stock', e.target.value)} placeholder="Sin cargar" /></label>
                    <button type="button" className="icon-button" onClick={() => removeVariant(index)} aria-label="Eliminar talla">×</button>
                    <div className="variant-price-preview" aria-live="polite">
                      <div className="variant-preview-group">
                        <span>Mayor · por pieza</span>
                        <strong>{formatUsd(wholesalePreview.basePrice)} efectivo</strong>
                        <small>{formatBs(wholesalePreview.usdBolivares)} con dólar BCV ({formatUsd(wholesalePreview.usdReference)})</small>
                        <small>{formatBs(wholesalePreview.eurBolivares)} con euro BCV ({formatEur(wholesalePreview.eurReference)})</small>
                      </div>
                      <div className="variant-preview-group">
                        <span>Detal · por pieza</span>
                        {hasRetailPrice ? <>
                          <strong>{formatUsd(retailPreview.basePrice)} efectivo</strong>
                          <small>{formatBs(retailPreview.usdBolivares)} con dólar BCV ({formatUsd(retailPreview.usdReference)})</small>
                          <small>{formatBs(retailPreview.eurBolivares)} con euro BCV ({formatEur(retailPreview.eurReference)})</small>
                        </> : <strong className="price-pending">Precio por cargar</strong>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="button button--large" disabled={busy}>{busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear producto'}</button>
          </form>
        </section>

        <section className="admin-card">
          <div className="section-heading"><div><p className="eyebrow">Inventario actual</p><h2>{products.length} productos</h2></div></div>
          <div className="admin-product-list">
            {products.map((product) => (
              <article key={product.id} className="admin-product-item">
                <div className="admin-product-item__image">{product.image_url ? <img src={product.image_url} alt="" /> : <span>Sin foto</span>}</div>
                <div className="admin-product-item__content">
                  <span>{product.categoria}</span><strong>{product.nombre}</strong>
                  <small>
                    {(product.variants || []).length} presentaciones · Mayor desde ${Math.min(...(product.variants || []).map((item) => Number(item.precio_mayor_usd || 0))).toFixed(2)}
                    {(() => {
                      const retailPrices = (product.variants || []).map((item) => Number(item.precio_detal_usd)).filter((value) => Number.isFinite(value) && value > 0);
                      return retailPrices.length ? ` · Detal desde $${Math.min(...retailPrices).toFixed(2)}` : ' · Detal pendiente';
                    })()}
                  </small>
                </div>
                <span className={`status-dot ${product.activo !== false ? '' : 'status-dot--off'}`}>{product.activo !== false ? 'Visible' : 'Oculto'}</span>
                <button className="button button--ghost" onClick={() => editProduct(product)}>Editar</button>
                <button className="button button--danger" onClick={() => deleteProduct(product)}>Eliminar</button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
