import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  FaUsers, 
  FaBus, 
  FaNetworkWired, 
  FaExclamationTriangle,
  FaInfoCircle
} from 'react-icons/fa';

const AdminHome = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    networks: 0,
    vehicles: 0,
    incidents: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Récupérer les statistiques
      const [usersData, networksData, vehiclesData] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('networks').select('network_id', { count: 'exact' }),
        supabase.from('vehicles').select('id', { count: 'exact' })
      ]);
      
      setStats({
        users: usersData.count || 0,
        networks: networksData.count || 0,
        vehicles: vehiclesData.count || 0,
        incidents: 0 // À implémenter si une table d'incidents existe
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Membres',
      value: stats.users,
      icon: <FaUsers size={24} className="text-purple-500" />,
      link: '/admin/users',
      color: 'bg-purple-100'
    },
    {
      title: 'Réseaux',
      value: stats.networks,
      icon: <FaNetworkWired size={24} className="text-blue-500" />,
      link: '/admin/networks',
      color: 'bg-blue-100'
    },
    {
      title: 'Véhicules',
      value: stats.vehicles,
      icon: <FaBus size={24} className="text-green-500" />,
      link: '/admin/vehicles',
      color: 'bg-green-100'
    },
    {
      title: 'Incidents',
      value: stats.incidents,
      icon: <FaExclamationTriangle size={24} className="text-red-500" />,
      link: '/admin/incidents',
      color: 'bg-red-100'
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
        <p className="text-gray-600">
          Bonjour {profile?.first_name || 'Administrateur'}, bienvenue dans le panneau d'administration
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <Link 
              key={index}
              to={card.link}
              className={`${card.color} rounded-lg p-6 shadow hover:shadow-md transition-shadow`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="text-sm text-gray-600">{card.title}</div>
                </div>
                <div className="p-3 rounded-full bg-white shadow-sm">
                  {card.icon}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Cartes principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Carte Gestion des véhicules */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-indigo-100 p-6">
            <h2 className="text-xl font-bold">Gestion des véhicules</h2>
            <p className="text-gray-700 mt-2">
              Gérez les marques et modèles des bus pour chaque réseau.
            </p>
          </div>
          <div className="p-4 bg-white border-t border-gray-200">
            <Link
              to="/admin/vehicles"
              className="flex items-center justify-center w-full py-2 px-4 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
            >
              <FaBus className="mr-2" />
              Gérer les véhicules
            </Link>
          </div>
        </div>

        {/* Carte Suppression de voyages */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-red-100 p-6">
            <h2 className="text-xl font-bold">Suppression de voyages</h2>
            <p className="text-gray-700 mt-2">
              Gérez les voyages annulés pour chaque réseau de bus.
            </p>
          </div>
          <div className="p-4 bg-white border-t border-gray-200">
            <Link
              to="/admin/incidents"
              className="flex items-center justify-center w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              <FaExclamationTriangle className="mr-2" />
              Supprimer des voyages
            </Link>
          </div>
        </div>

        {/* Carte Gestion des membres */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-purple-100 p-6">
            <h2 className="text-xl font-bold">Gestion des membres</h2>
            <p className="text-gray-700 mt-2">
              Gérez les utilisateurs de la plateforme et leurs droits d'accès.
            </p>
          </div>
          <div className="p-4 bg-white border-t border-gray-200">
            <Link
              to="/admin/users"
              className="flex items-center justify-center w-full py-2 px-4 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
            >
              <FaUsers className="mr-2" />
              Gérer les membres
            </Link>
          </div>
        </div>

        {/* Carte Info Trafic */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-orange-100 p-6">
            <h2 className="text-xl font-bold">Gestion des infos trafic</h2>
            <p className="text-gray-700 mt-2">
              Gérez les informations trafic (travaux, arrêts non desservis) pour chaque réseau.
            </p>
          </div>
          <div className="p-4 bg-white border-t border-gray-200">
            <Link
              to="/admin/traffic-info"
              className="flex items-center justify-center w-full py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
            >
              <FaInfoCircle className="mr-2" />
              Gérer les infos trafic
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Liens rapides</h2>
          <div className="space-y-3">
            <Link 
              to="/admin/users"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <FaUsers className="mr-3 text-purple-500" />
              <span>Gestion des membres</span>
            </Link>
            <Link 
              to="/admin/vehicles"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <FaBus className="mr-3 text-green-500" />
              <span>Gestion des véhicules</span>
            </Link>
            <Link 
              to="/admin/networks"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <FaNetworkWired className="mr-3 text-blue-500" />
              <span>Configuration des réseaux</span>
            </Link>
            <Link 
              to="/admin/traffic-info"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <FaInfoCircle className="mr-3 text-orange-500" />
              <span>Gestion des infos trafic</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Dernières activités</h2>
          <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Aucune activité récente à afficher</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome; 