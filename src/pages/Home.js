import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';

const Home = () => {
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetworks();
  }, []);

  useEffect(() => {
    if (selectedNetwork) {
      fetchRoutes(selectedNetwork);
    }
  }, [selectedNetwork]);

  const fetchNetworks = async () => {
    try {
      const { data, error } = await supabase
        .from('networks')
        .select('*')
        .order('network_name');

      if (error) throw error;
      setNetworks(data || []);
    } catch (error) {
      console.error('Error fetching networks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async (networkId) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('routes')
        .select(`
          route_id,
          route_short_name,
          route_long_name,
          route_desc,
          route_type,
          route_color,
          route_text_color
        `)
        .eq('network_id', networkId)
        .order('route_short_name');

      if (error) throw error;
      setRoutes(data || []);
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRouteTypeIcon = (type) => {
    switch (type) {
      case 0: return '🚇'; // Métro
      case 1: return '🚊'; // Tramway
      case 2: return '🚂'; // Train
      case 3: return '🚌'; // Bus
      default: return '🚍';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex items-center">
                <span className="text-xl font-semibold text-gray-900">Bus Connect</span>
              </div>
            </div>
            <div className="flex items-center">
              <Link
                to="/admin"
                className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Administration
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Network Selection */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Sélectionnez votre réseau de transport
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {networks.map((network) => (
                  <button
                    key={network.network_id}
                    onClick={() => setSelectedNetwork(network.network_id)}
                    className={`relative rounded-lg p-4 border ${
                      selectedNetwork === network.network_id
                        ? 'border-blue-500 ring-2 ring-blue-500'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <h3 className="text-lg font-medium text-gray-900">
                      {network.network_name}
                    </h3>
                    {network.network_description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {network.network_description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Routes Display */}
        {selectedNetwork && (
          <div className="px-4 sm:px-0">
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Lignes disponibles
                </h2>
                {loading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {routes.map((route) => (
                      <div
                        key={route.route_id}
                        className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:shadow-md transition-shadow duration-200 ease-in-out"
                        style={{
                          borderLeftWidth: '4px',
                          borderLeftColor: `#${route.route_color || '000000'}`
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 text-2xl">
                            {getRouteTypeIcon(route.route_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              Ligne {route.route_short_name}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {route.route_long_name}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home; 