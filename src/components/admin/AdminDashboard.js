import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  FaHome, 
  FaNetworkWired, 
  FaBus, 
  FaUsers, 
  FaExclamationTriangle,
  FaInfoCircle,
  FaBell,
  FaDownload
} from 'react-icons/fa';

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Liste des liens de navigation
  const navLinks = [
    { to: '/admin', label: 'Tableau de bord', icon: <FaHome className="mr-2" />, exact: true },
    { to: '/admin/networks', label: 'Réseaux', icon: <FaNetworkWired className="mr-2" /> },
    { to: '/admin/vehicles', label: 'Véhicules', icon: <FaBus className="mr-2" /> },
    { to: '/admin/incidents', label: 'Incidents', icon: <FaExclamationTriangle className="mr-2" /> },
    { to: '/admin/traffic-info', label: 'Info trafic', icon: <FaInfoCircle className="mr-2" /> },
    { to: '/admin/priority-alerts', label: 'Alertes prioritaires', icon: <FaBell className="mr-2" /> },
    { to: '/admin/auto-gtfs-import', label: 'Import GTFS Auto', icon: <FaDownload className="mr-2" /> },
    { to: '/admin/users', label: 'Membres', icon: <FaUsers className="mr-2" /> },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
      {/* Sidebar navigation */}
      <div className="w-full md:w-64 bg-white shadow-md md:min-h-screen">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Bus Connect</h1>
          <p className="text-sm text-gray-600">Administration</p>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {navLinks.map((link, index) => (
              <li key={index}>
                <NavLink
                  to={link.to}
                  end={link.exact}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100'
                    }`
                  }
                >
                  {link.icon}
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200 mt-auto">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 w-full"
          >
            <span className="mr-2">←</span> Retour au site
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 md:p-8">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard; 