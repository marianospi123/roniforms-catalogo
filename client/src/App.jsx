import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CatalogPage from './pages/CatalogPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/gestion/:token" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
