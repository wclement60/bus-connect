import React, { useState, useEffect, useCallback } from 'react';
import { Link, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Upload from './admin/Upload';
import TripCancellation from './admin/TripCancellation';
import { supabase } from '../services/supabase';
import RealtimeApiConfig from '../components/admin/RealtimeApiConfig';
import VehicleAdmin from '../components/admin/VehicleAdmin';
import UserAdmin from '../components/admin/UserAdmin';
import TrafficInfo from './admin/TrafficInfo';
import ContactAdmin from '../components/admin/ContactAdmin';
import SpecialSchedule from './admin/SpecialSchedule';
import ForumAdmin from './admin/ForumAdmin';
import PriorityAlertAdmin from '../components/admin/PriorityAlertAdmin';
import AutoGTFSImport from './admin/AutoGTFSImport';

const Admin = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);

  const fetchPendingMessagesCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('contact_requests')
        .select('*', { count: 'exact', head: true })
        .is('response', null);

      if (error) {
        throw error;
      }
      setPendingMessagesCount(count || 0);
    } catch (error) {
      console.error("Erreur lors de la récupération du nombre de messages en attente:", error);
    }
  }, []);

  useEffect(() => {
    fetchPendingMessagesCount();

    const channel = supabase
      .channel('contact-requests-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests' },
        (payload) => {
          fetchPendingMessagesCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingMessagesCount]);

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('networks')
          .select('network_id, network_name')
          .order('network_name');
        
        if (error) throw error;
        setNetworks(data || []);
      } catch (err) {
        console.error('Erreur lors du chargement des réseaux:', err);
      } finally {
        setLoading(false);
      }
    };

    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data && data.user) {
        setUser(data.user);
      }
    };

    fetchNetworks();
    getUser();
  }, []);

  // Vérifier si nous sommes sur une route de configuration spécifique
  const isSubRoute = location.pathname !== '/admin';
  const currentPath = location.pathname;

  // Menu items with icons
  const menuItems = [
    {
      name: "Tableau de bord",
      path: "/admin",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      )
    },
    {
      name: "Messages",
      path: "/admin/contact",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      )
    },
    {
      name: "Suppression de voyages",
      path: "/admin/trip-cancellation",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      name: "Horaires spéciaux",
      path: "/admin/special-schedule",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      name: "Infos trafic",
      path: "/admin/traffic-info",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      name: "Véhicules",
      path: "/admin/vehicles",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H11a1 1 0 001-1v-5h2a1 1 0 001-1V8l-3-4H4a1 1 0 00-1 1zm10.5 2a.5.5 0 01.5.5v3h-2V6.5a.5.5 0 01.5-.5h1z" />
        </svg>
      )
    },
    {
      name: "Utilisateurs",
      path: "/admin/users",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      )
    },
    {
      name: "Alertes prioritaires",
      path: "/admin/priority-alerts",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2L3 7v3c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-7-5z"/>
          <path d="M10 8a2 2 0 11-4 0 2 2 0 014 0zM9 11a1 1 0 102 0v3a1 1 0 11-2 0v-3z"/>
        </svg>
      )
    },
    {
      name: "Import GTFS Auto",
      path: "/admin/auto-gtfs-import",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      name: "Forum",
      path: "/admin/forum",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"></path>
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"></path>
        </svg>
      )
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} relative transition-all duration-300 bg-gradient-to-b from-blue-700 to-blue-900 text-white flex flex-col flex-shrink-0`}>
        {/* Logo */}
        <div className={`p-4 flex ${sidebarOpen ? 'justify-start' : 'justify-center'} items-center`}>
          <Link to="/" className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H11a1 1 0 001-1v-5h2a1 1 0 001-1V8l-3-4H4a1 1 0 00-1 1zm10.5 2a.5.5 0 01.5.5v3h-2V6.5a.5.5 0 01.5-.5h1z" />
            </svg>
            {sidebarOpen && <span className="ml-2 text-xl font-bold">Bus Connect</span>}
          </Link>
        </div>
        
        {/* Toggle sidebar button */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-5 -right-3 bg-blue-700 rounded-full p-1 text-white shadow-lg z-10"
        >
          {sidebarOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          )}
        </button>
        
        {/* Admin label */}
        <div className={`px-4 py-2 mt-2 ${sidebarOpen ? 'text-left' : 'text-center'} text-xs uppercase font-semibold text-blue-300`}>
          {sidebarOpen ? 'Administration' : 'Admin'}
        </div>
        
        {/* Navigation */}
        <nav className="mt-2 flex-1 overflow-y-auto">
          <ul>
            {menuItems.map((item) => (
              <li key={item.path} className="mb-1 px-2">
                <Link 
                  to={item.path} 
                  className={`
                    flex items-center ${sidebarOpen ? 'px-4' : 'justify-center'} py-3 rounded-lg
                    ${currentPath === item.path ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}
                    transition-colors duration-200
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="ml-3">{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User profile */}
        <div className="p-4 border-t border-blue-800">
          <div className={`flex ${sidebarOpen ? 'justify-start' : 'justify-center'} items-center`}>
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
              {user ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            {sidebarOpen && (
              <div className="ml-3">
                <p className="text-sm font-medium text-white truncate">
                  {user ? user.email : 'Utilisateur'}
                </p>
                <Link to="/logout" className="text-xs text-blue-300 hover:text-white">
                  Déconnexion
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10 flex-shrink-0">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-800">
                {isSubRoute ? (
                  <>
                    <button 
                      onClick={() => navigate('/admin')}
                      className="mr-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {currentPath.includes('trip-cancellation') && 'Suppression de voyages'}
                    {currentPath.includes('special-schedule') && 'Horaires spéciaux'}
                    {currentPath.includes('traffic-info') && 'Infos trafic'}
                    {currentPath.includes('vehicles') && 'Gestion des véhicules'}
                    {currentPath.includes('users') && 'Gestion des utilisateurs'}
                    {currentPath.includes('realtime-config') && 'Configuration des API temps réel'}
                    {currentPath.includes('priority-alerts') && 'Alertes prioritaires'}
                    {currentPath.includes('auto-gtfs-import') && 'Import GTFS Automatique'}
                    {currentPath.includes('forum') && 'Administration du Forum'}
                  </>
                ) : (
                  'Tableau de bord'
                )}
              </h1>
            </div>
            
            <div className="flex items-center">
              <div className="relative">
                <button className="flex items-center text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {pendingMessagesCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                      {pendingMessagesCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-100">
          <div className="max-w-7xl mx-auto p-4">
            <Routes>
              <Route path="/" element={
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Import Data Card - Full width */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden md:col-span-2 lg:col-span-3">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Import de données</h2>
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                        </div>
                      </div>
                      <Upload />
                    </div>
                  </div>

                  {/* API Configuration Card */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">API temps réel</h2>
                        <div className="p-2 bg-green-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>
                      
                      {loading ? (
                        <div className="flex justify-center p-4">
                          <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {networks.length === 0 ? (
                            <p className="text-gray-500">Aucun réseau disponible</p>
                          ) : (
                            networks.map(network => (
                              <div key={network.network_id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <span className="font-medium text-gray-700">{network.network_name}</span>
                                <Link 
                                  to={`/admin/realtime-config/${network.network_id}`}
                                  className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                >
                                  Configurer
                                </Link>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vehicle Management Card */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Véhicules</h2>
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a2 2 0 01-2 2H9m4-2V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a2 2 0 002 2h4a2 2 0 002-2v-4a2 2 0 00-2-2h-4a2 2 0 00-2 2v4z" />
                          </svg>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">Gérez les marques et modèles des bus pour chaque réseau.</p>
                      
                      <Link 
                        to="/admin/vehicles"
                        className="flex items-center justify-center w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H11a1 1 0 001-1v-5h2a1 1 0 001-1V8l-3-4H4a1 1 0 00-1 1zm10.5 2a.5.5 0 01.5.5v3h-2V6.5a.5.5 0 01.5-.5h1z" />
                        </svg>
                        Gérer les véhicules
                      </Link>
                    </div>
                  </div>

                  {/* Trip Cancellation Card */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Suppression de voyages</h2>
                        <div className="p-2 bg-red-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">Gérez les voyages annulés et retardés pour chaque réseau de bus.</p>
                      
                      <Link 
                        to="/admin/trip-cancellation"
                        className="flex items-center justify-center w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        Gérer les voyages
                      </Link>
                    </div>
                  </div>

                  {/* User Management Card */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Gestion des membres</h2>
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">Gérez les utilisateurs de la plateforme et leurs droits d'accès.</p>
                      
                      <Link 
                        to="/admin/users"
                        className="flex items-center justify-center w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        Gérer les membres
                      </Link>
                    </div>
                  </div>

                  {/* Traffic Info Card */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Infos trafic</h2>
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">Gérez les informations trafic (travaux, arrêts non desservis) pour chaque réseau.</p>
                      
                      <Link 
                        to="/admin/traffic-info"
                        className="flex items-center justify-center w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Gérer les infos trafic
                      </Link>
                    </div>
                  </div>

                  {/* Priority Alerts Card */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Alertes prioritaires</h2>
                        <div className="p-2 bg-red-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">Gérez les alertes urgentes pour les utilisateurs et traitez les appels.</p>
                      
                      <Link 
                        to="/admin/priority-alerts"
                        className="flex items-center justify-center w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 2L3 7v3c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-7-5z"/>
                        </svg>
                        Gérer les alertes
                      </Link>
                    </div>
                  </div>

                  {/* Forum Card */}
                  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Forum</h2>
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">Administrez le forum communautaire : catégories, modération et gestion des contenus.</p>
                      
                      <Link 
                        to="/admin/forum"
                        className="flex items-center justify-center w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"></path>
                          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"></path>
                        </svg>
                        Administrer le forum
                      </Link>
                    </div>
                  </div>
                </div>
              } />
              <Route path="/realtime-config/:networkId" element={<RealtimeApiConfig />} />
              <Route path="/vehicles" element={<VehicleAdmin />} />
              <Route path="/users" element={<UserAdmin />} />
              <Route path="/trip-cancellation" element={<TripCancellation />} />
              <Route path="/traffic-info" element={<TrafficInfo />} />
              <Route path="/contact" element={<ContactAdmin />} />
              <Route path="/special-schedule" element={<SpecialSchedule />} />
              <Route path="/priority-alerts" element={<PriorityAlertAdmin />} />
              <Route path="/auto-gtfs-import" element={<AutoGTFSImport />} />
              <Route path="/forum" element={<ForumAdmin />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin; 