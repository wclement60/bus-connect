import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { 
  getNetworks, 
  getRoutesByNetwork,
  getStopsByRoute
} from '../../services/admin';

const TRAFFIC_INFO_TYPES = [
  'Travaux',
  'Arrêt non desservi',
  'Information'
];

const TrafficInfo = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedDirection, setSelectedDirection] = useState(null);
  const [directionLabels, setDirectionLabels] = useState({});
  const [stops, setStops] = useState([]);
  const [selectedStops, setSelectedStops] = useState([]);
  const [infoType, setInfoType] = useState(TRAFFIC_INFO_TYPES[0]);
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTrafficInfos, setActiveTrafficInfos] = useState([]);
  const [expiredTrafficInfos, setExpiredTrafficInfos] = useState([]);
  const [showExpired, setShowExpired] = useState(false);
  const [searchStopTerm, setSearchStopTerm] = useState('');

  // Vérifier l'authentification
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate('/login');
        return;
      }

      // Vérifier si l'utilisateur a le droit d'accéder à la page admin
      const { data: userData, error } = await supabase
        .from('users')
        .select('modtools')
        .eq('id', data.user.id)
        .single();

      if (error || !userData || !userData.modtools) {
        navigate('/');
      }
    };

    checkAuth();
  }, [navigate]);

  // Charger les réseaux au chargement de la page
  useEffect(() => {
    const loadNetworks = async () => {
      setLoading(true);
      try {
        const networks = await getNetworks();
        setNetworks(networks);
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors du chargement des réseaux:', err);
        setLoading(false);
      }
    };

    loadNetworks();
  }, []);

  // Charger les routes quand un réseau est sélectionné
  useEffect(() => {
    if (!selectedNetwork) return;

    const loadRoutes = async () => {
      setLoading(true);
      try {
        const routes = await getRoutesByNetwork(selectedNetwork.network_id);
        setRoutes(routes);
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors du chargement des routes:', err);
        setLoading(false);
      }
    };

    loadRoutes();
    loadTrafficInfos();
  }, [selectedNetwork]);

  // Réinitialiser les sélections lors du changement de réseau
  useEffect(() => {
    setSelectedRoute(null);
    setSelectedDirection(null);
    setSelectedStops([]);
    setStops([]);
    setDirectionLabels({});
  }, [selectedNetwork]);

  // Réinitialiser la direction et les arrêts lors du changement de route
  useEffect(() => {
    setSelectedDirection(null);
    setSelectedStops([]);
    setStops([]);
    
    // Charger les directions si une route est sélectionnée
    if (selectedNetwork && selectedRoute) {
      loadDirectionLabels();
    }
  }, [selectedRoute]);

  // Charger les libellés de directions (terminus) pour la route sélectionnée
  const loadDirectionLabels = async () => {
    if (!selectedNetwork || !selectedRoute) return;
    
    try {
      // Utiliser la fonction RPC pour récupérer les directions avec les noms de terminus
      const { data, error } = await supabase.rpc(
        'get_route_directions',
        {
          route_id_param: selectedRoute.route_id,
          network_id_param: selectedNetwork.network_id
        }
      );
      
      if (error) {
        console.error('Erreur lors du chargement des directions:', error);
        return;
      }
      
      // Créer un objet avec les libellés de directions
      const labels = {};
      (data || []).forEach(dir => {
        // S'assurer que terminus_names est toujours un tableau
        const terminusNames = Array.isArray(dir.terminus_names) ? dir.terminus_names : [];
        
        // Créer un libellé avec les terminus (ex: "Collège / Gare / Mairie")
        labels[dir.direction_id] = terminusNames.length > 0 
          ? terminusNames.join(' / ') 
          : `Direction ${dir.direction_id === 0 ? 'Aller' : 'Retour'}`;
      });
      
      setDirectionLabels(labels);
    } catch (err) {
      console.error('Erreur lors du chargement des directions:', err);
    }
  };

  // Charger tous les arrêts lorsqu'une route est sélectionnée, sans filtrer par direction
  useEffect(() => {
    if (!selectedNetwork || !selectedRoute) return;

    const loadStops = async () => {
      setLoading(true);
      try {
        // Fonction à créer dans admin.js pour récupérer tous les arrêts d'une ligne sans filtrer par direction
        const stopsData = await getStopsByRoute(
          selectedNetwork.network_id,
          selectedRoute.route_id
        );
        setStops(stopsData);
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors du chargement des arrêts:', err);
        setLoading(false);
      }
    };

    loadStops();
  }, [selectedNetwork, selectedRoute]);

  // Gestion de la sélection/désélection des arrêts
  const handleStopSelection = (stop) => {
    setSelectedStops(prev => {
      // Vérifier si l'arrêt est déjà sélectionné
      const isAlreadySelected = prev.some(s => s.stop_id === stop.stop_id);
      
      if (isAlreadySelected) {
        // Supprimer de la sélection
        return prev.filter(s => s.stop_id !== stop.stop_id);
      } else {
        // Ajouter à la sélection
        return [...prev, stop];
      }
    });
  };

  // Filtrer les arrêts en fonction du terme de recherche
  const filteredStops = stops.filter(stop => 
    stop.stop_name.toLowerCase().includes(searchStopTerm.toLowerCase())
  );

  // Charger les informations de trafic actives
  const loadTrafficInfos = async () => {
    if (!selectedNetwork) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('Date du jour pour requête:', today);

      // Diagnostic: récupérer TOUTES les infos trafic sans filtre
      const { data: allInfos, error: allInfosError } = await supabase
        .from('traffic_info')
        .select('*')
        .eq('network_id', selectedNetwork.network_id)
        .order('created_at', { ascending: false });
        
      if (allInfosError) {
        console.error('Erreur lors de la récupération de toutes les infos:', allInfosError);
      } else {
        console.log('DIAGNOSTIC - Toutes les infos trafic:', allInfos);
        
        // Vérification manuelle de ce qui devrait être actif
        const manualActive = allInfos?.filter(info => {
          const isStarted = info.start_date <= today;
          const isNotEnded = info.end_date >= today;
          const isActiveFlagged = info.active === true;
          
          return isStarted && isNotEnded && isActiveFlagged;
        });
        
        console.log('DIAGNOSTIC - Infos qui devraient être actives selon notre logique:', manualActive);
      }

      // Récupérer les infos trafic actives - on s'assure qu'elles sont actives et dans la période valide
      const { data: activeData, error: activeError } = await supabase
        .from('traffic_info')
        .select('*')
        .eq('network_id', selectedNetwork.network_id)
        .eq('active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .order('created_at', { ascending: false });

      if (activeError) {
        console.error('Erreur lors de la récupération des infos actives:', activeError);
        throw activeError;
      }
      
      console.log('Infos trafic actives récupérées:', activeData);
      setActiveTrafficInfos(activeData || []);

      // Récupérer toutes les infos de trafic pour ce réseau qui ne sont PAS actives
      // (soit désactivées manuellement, soit expirées)
      let expiredQuery = supabase
        .from('traffic_info')
        .select('*')
        .eq('network_id', selectedNetwork.network_id);

      // Construction de la condition: soit inactive, soit date de fin dépassée
      expiredQuery = expiredQuery.or(`active.eq.false,end_date.lt.${today}`);
      
      const { data: expiredData, error: expiredError } = await expiredQuery
        .order('created_at', { ascending: false });

      if (expiredError) {
        console.error('Erreur lors de la récupération des infos expirées:', expiredError);
        throw expiredError;
      }
      
      console.log('Infos trafic expirées récupérées:', expiredData);
      setExpiredTrafficInfos(expiredData || []);
    } catch (err) {
      console.error('Erreur lors du chargement des informations de trafic:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ajouter une nouvelle info trafic
  const handleAddTrafficInfo = async (e) => {
    e.preventDefault();
    if (!selectedNetwork || !infoType || !message || !startDate || !endDate) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert('La date de fin doit être postérieure à la date de début');
      return;
    }

    setLoading(true);
    try {
      // Pour chaque arrêt sélectionné, créer une info trafic
      if (selectedStops.length > 0) {
        // Cas de sélection multiple d'arrêts
        for (const stop of selectedStops) {
          const newTrafficInfo = {
            network_id: selectedNetwork.network_id,
            route_id: selectedRoute ? selectedRoute.route_id : null,
            direction_id: selectedDirection !== null ? selectedDirection : null,
            stop_id: stop.stop_id,
            type: infoType,
            message: message,
            start_date: startDate,
            end_date: endDate,
            active: true
          };
          
          const { error } = await supabase
            .from('traffic_info')
            .insert([newTrafficInfo]);
            
          if (error) throw error;
        }
      } else {
        // Cas sans sélection d'arrêts spécifiques (réseau ou ligne entière)
        const newTrafficInfo = {
          network_id: selectedNetwork.network_id,
          route_id: selectedRoute ? selectedRoute.route_id : null,
          direction_id: selectedDirection !== null ? selectedDirection : null,
          stop_id: null,
          type: infoType,
          message: message,
          start_date: startDate,
          end_date: endDate,
          active: true
        };
        
        const { error } = await supabase
          .from('traffic_info')
          .insert([newTrafficInfo]);
          
        if (error) throw error;
      }

      alert('Information de trafic ajoutée avec succès');
      // Réinitialiser le formulaire
      setMessage('');
      setStartDate('');
      setEndDate('');
      setSelectedStops([]);
      loadTrafficInfos();
    } catch (err) {
      console.error('Erreur lors de l\'ajout de l\'information de trafic:', err);
      alert(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Désactiver une info trafic
  const handleDeactivateTrafficInfo = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir désactiver cette information de trafic?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('traffic_info')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;
      loadTrafficInfos();
    } catch (err) {
      console.error('Erreur lors de la désactivation de l\'information de trafic:', err);
      alert(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Réactiver une info trafic
  const handleReactivateTrafficInfo = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir réactiver cette information de trafic?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('traffic_info')
        .update({ active: true })
        .eq('id', id);

      if (error) throw error;
      loadTrafficInfos();
    } catch (err) {
      console.error('Erreur lors de la réactivation de l\'information de trafic:', err);
      alert(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une info trafic
  const handleDeleteTrafficInfo = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cette information de trafic?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('traffic_info')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadTrafficInfos();
    } catch (err) {
      console.error('Erreur lors de la suppression de l\'information de trafic:', err);
      alert(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Formater les informations de trafic pour l'affichage
  const formatTrafficInfo = (info) => {
    const today = new Date().toISOString().split('T')[0];
    const isActive = info.active && new Date(info.end_date) >= new Date(today);
    
    return {
      ...info,
      formattedStartDate: new Date(info.start_date).toLocaleDateString(),
      formattedEndDate: new Date(info.end_date).toLocaleDateString(),
      isActive: isActive,
      isExpired: !isActive
    };
  };

  // Formater le libellé de direction pour l'affichage
  const getDirectionLabel = (directionId) => {
    if (directionId === null) return 'Toutes les directions';
    
    // Utiliser le libellé personnalisé s'il existe, sinon utiliser "Aller" ou "Retour"
    return directionLabels[directionId] || 
           `Direction ${directionId === 0 ? 'Aller' : 'Retour'}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Gestion des informations trafic</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Ajouter une information trafic</h2>
        
        <form onSubmit={handleAddTrafficInfo}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sélection du réseau */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Réseau *
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={selectedNetwork?.network_id || ''}
                onChange={(e) => {
                  const network = networks.find(n => n.network_id === e.target.value);
                  setSelectedNetwork(network || null);
                }}
                disabled={loading}
                required
              >
                <option value="">Sélectionner un réseau</option>
                {networks.map(network => (
                  <option key={network.network_id} value={network.network_id}>
                    {network.network_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sélection de la ligne */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ligne (optionnel)
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={selectedRoute?.route_id || ''}
                onChange={(e) => {
                  const route = routes.find(r => r.route_id === e.target.value);
                  setSelectedRoute(route || null);
                }}
                disabled={!selectedNetwork || loading}
              >
                <option value="">Toutes les lignes</option>
                {routes.map(route => (
                  <option key={route.route_id} value={route.route_id}>
                    {route.route_short_name} - {route.route_long_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sélection de la direction (optionnel) */}
            {selectedRoute && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Direction (optionnel)
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={selectedDirection === null ? '' : selectedDirection}
                  onChange={(e) => setSelectedDirection(e.target.value === '' ? null : parseInt(e.target.value))}
                  disabled={!selectedRoute || loading}
                >
                  <option value="">Toutes les directions</option>
                  <option value="0">{getDirectionLabel(0)}</option>
                  <option value="1">{getDirectionLabel(1)}</option>
                </select>
              </div>
            )}

            {/* Type d'information */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d'information *
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={infoType}
                onChange={(e) => setInfoType(e.target.value)}
                disabled={loading}
                required
              >
                {TRAFFIC_INFO_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Date de début */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de début *
              </label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* Date de fin */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de fin *
              </label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Message d'information */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <textarea
              className="w-full p-2 border border-gray-300 rounded-md"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={loading}
              required
            />
          </div>

          {/* Sélection des arrêts avec cases à cocher */}
          {selectedRoute && stops.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arrêts concernés (optionnel)
              </label>
              <div className="mb-2">
                <input 
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Rechercher un arrêt..."
                  value={searchStopTerm}
                  onChange={(e) => setSearchStopTerm(e.target.value)}
                />
              </div>
              <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
                {filteredStops.length === 0 ? (
                  <p className="text-gray-500 p-2">Aucun arrêt trouvé</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filteredStops.map(stop => (
                      <div key={stop.stop_id} className="flex items-center p-2 hover:bg-gray-100 rounded">
                        <input
                          type="checkbox"
                          id={`stop-${stop.stop_id}`}
                          checked={selectedStops.some(s => s.stop_id === stop.stop_id)}
                          onChange={() => handleStopSelection(stop)}
                          className="mr-2"
                        />
                        <label htmlFor={`stop-${stop.stop_id}`} className="text-sm cursor-pointer">
                          {stop.stop_name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {selectedStops.length} arrêt(s) sélectionné(s)
              </div>
            </div>
          )}

          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            disabled={loading || !selectedNetwork || !infoType || !message || !startDate || !endDate}
          >
            {loading ? 'Chargement...' : 'Ajouter l\'information'}
          </button>
        </form>
      </div>

      {/* Liste des informations trafic actives */}
      {selectedNetwork && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Informations trafic actives ({activeTrafficInfos.length})</h2>
            <button
              className="text-blue-600 hover:text-blue-800"
              onClick={loadTrafficInfos}
            >
              Rafraîchir
            </button>
          </div>

          {activeTrafficInfos.length === 0 ? (
            <p className="text-gray-500">Aucune information trafic active</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ligne/Arrêt</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Période</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeTrafficInfos.map(info => {
                    const formattedInfo = formatTrafficInfo(info);
                    return (
                      <tr key={info.id}>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            info.type === 'Travaux' ? 'bg-yellow-100 text-yellow-800' : 
                            info.type === 'Arrêt non desservi' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {info.type}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div>
                            {info.route_id ? (
                              <p className="text-sm font-medium text-gray-900">
                                Ligne: {routes.find(r => r.route_id === info.route_id)?.route_short_name || info.route_id}
                              </p>
                            ) : (
                              <p className="text-sm font-medium text-gray-900">Toutes les lignes</p>
                            )}
                            {info.stop_id && (
                              <p className="text-sm text-gray-500">
                                Arrêt: {stops.find(s => s.stop_id === info.stop_id)?.stop_name || info.stop_id}
                              </p>
                            )}
                            {info.direction_id !== null && (
                              <p className="text-sm text-gray-500">
                                {getDirectionLabel(info.direction_id)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <p className="text-sm text-gray-900">{info.message}</p>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-500">
                            Du {formattedInfo.formattedStartDate} au {formattedInfo.formattedEndDate}
                          </p>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="text-red-600 hover:text-red-900 mr-3"
                            onClick={() => handleDeactivateTrafficInfo(info.id)}
                            disabled={loading}
                          >
                            Désactiver
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDeleteTrafficInfo(info.id)}
                            disabled={loading}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Liste des informations trafic expirées ou désactivées */}
      {selectedNetwork && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Informations trafic expirées/désactivées ({expiredTrafficInfos.length})
            </h2>
            <button
              className="text-blue-600 hover:text-blue-800"
              onClick={() => setShowExpired(!showExpired)}
            >
              {showExpired ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          {showExpired && (
            expiredTrafficInfos.length === 0 ? (
              <p className="text-gray-500">Aucune information trafic expirée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ligne/Arrêt</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Période</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expiredTrafficInfos.map(info => {
                      const formattedInfo = formatTrafficInfo(info);
                      return (
                        <tr key={info.id} className="bg-gray-50">
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium opacity-60 ${
                              info.type === 'Travaux' ? 'bg-yellow-100 text-yellow-800' : 
                              info.type === 'Arrêt non desservi' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {info.type}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div>
                              {info.route_id ? (
                                <p className="text-sm font-medium text-gray-700">
                                  Ligne: {routes.find(r => r.route_id === info.route_id)?.route_short_name || info.route_id}
                                </p>
                              ) : (
                                <p className="text-sm font-medium text-gray-700">Toutes les lignes</p>
                              )}
                              {info.stop_id && (
                                <p className="text-sm text-gray-500">
                                  Arrêt: {stops.find(s => s.stop_id === info.stop_id)?.stop_name || info.stop_id}
                                </p>
                              )}
                              {info.direction_id !== null && (
                                <p className="text-sm text-gray-500">
                                  {getDirectionLabel(info.direction_id)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <p className="text-sm text-gray-700">{info.message}</p>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <p className="text-sm text-gray-500">
                              Du {formattedInfo.formattedStartDate} au {formattedInfo.formattedEndDate}
                            </p>
                            <p className="text-xs text-gray-400">
                              {!info.active ? 'Désactivée manuellement' : 'Expirée'}
                            </p>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              className="text-green-600 hover:text-green-900 mr-3"
                              onClick={() => handleReactivateTrafficInfo(info.id)}
                              disabled={loading}
                            >
                              Réactiver
                            </button>
                            <button
                              className="text-red-600 hover:text-red-900"
                              onClick={() => handleDeleteTrafficInfo(info.id)}
                              disabled={loading}
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default TrafficInfo;
