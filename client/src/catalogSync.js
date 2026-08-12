const STORAGE_KEY = 'roniforms-catalog-updated';
const CHANNEL_NAME = 'roniforms-catalog';

export function notifyCatalogUpdated() {
  const stamp = String(Date.now());

  try {
    localStorage.setItem(STORAGE_KEY, stamp);
  } catch {
    // El catálogo seguirá actualizándose por consulta periódica.
  }

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(stamp);
    channel.close();
  }
}

export function subscribeCatalogUpdates(callback) {
  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) callback();
  };

  window.addEventListener('storage', handleStorage);

  let channel;
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', callback);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    channel?.removeEventListener('message', callback);
    channel?.close();
  };
}
