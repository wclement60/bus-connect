import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminHome from './components/admin/AdminHome';
import Login from './components/admin/Login';
import NetworkAdmin from './components/admin/NetworkAdmin';
import IncidentAdmin from './components/admin/IncidentAdmin';
import VehicleAdmin from './components/admin/VehicleAdmin';
import UserAdmin from './components/admin/UserAdmin';
import TrafficInfo from './pages/admin/TrafficInfo';
import AutoGTFSImport from './pages/admin/AutoGTFSImport';
import { useAuth } from './context/AuthContext';

const AdminRoutes = () => {
  const { user } = useAuth();

  // Rediriger les utilisateurs non authentifiés vers la page de login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />}>
        <Route index element={<AdminHome />} />
        <Route path="networks" element={<NetworkAdmin />} />
        <Route path="incidents" element={<IncidentAdmin />} />
        <Route path="vehicles" element={<VehicleAdmin />} />
        <Route path="users" element={<UserAdmin />} />
        <Route path="traffic-info" element={<TrafficInfo />} />
        <Route path="auto-gtfs-import" element={<AutoGTFSImport />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes; 