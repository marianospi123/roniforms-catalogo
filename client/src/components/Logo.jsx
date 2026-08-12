import React from 'react';

export default function Logo({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <img src="/roniforms-logo.png" alt="Roniforms" className="brand__image" />
    </div>
  );
}
