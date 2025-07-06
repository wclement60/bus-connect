import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useParams, useNavigate } from 'react-router-dom';

const RealtimeApiConfig = () => {
  const { networkId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [network, setNetwork] = useState(null);
  const [subnetworks, setSubnetworks] = useState([]);
  const [currentSubnetwork, setCurrentSubnetwork] = useState(null);
  const [newSubnetworkName, setNewSubnetworkName] = useState('');
  const [formData, setFormData] = useState({
    has_siri_api: false,
    siri_api_url: '',
    siri_api_params: {},
    has_gtfs_rt_api: false,
    gtfs_rt_url: '',
    gtfs_rt_params: {},
    requires_api_key: false
  });

  // Fonction pour convertir un objet JSON en chaîne pour l'affichage
  const jsonToString = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return '{}';
    }
  };

  // Fonction pour parser une chaîne JSON
  const parseJson = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.error('Erreur de parsing JSON:', e);
      return {};
    }
  };

  // Charger les données du réseau
  useEffect(() => {
    const fetchNetwork = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('networks')
          .select('*')
          .eq('network_id', networkId)
          .single();

        if (error) throw error;

        setNetwork(data);
        
        // Initialiser les sous-réseaux s'ils existent
        if (data.subnetworks && Array.isArray(data.subnetworks)) {
          setSubnetworks(data.subnetworks);
          
          // Si aucun sous-réseau n'est sélectionné, sélectionner le premier
          if (data.subnetworks.length > 0 && !currentSubnetwork) {
            setCurrentSubnetwork(data.subnetworks[0].name);
            // Initialiser le formulaire avec les données du sous-réseau
            const subnetworkData = data.subnetworks[0];
            setFormData({
              has_siri_api: subnetworkData.realtime?.type === 'siri' || false,
              siri_api_url: subnetworkData.realtime?.url || '',
              siri_api_params: subnetworkData.realtime?.params || {},
              has_gtfs_rt_api: subnetworkData.realtime?.type === 'gtfs-rt' || false,
              gtfs_rt_url: subnetworkData.realtime?.type === 'gtfs-rt' ? subnetworkData.realtime?.url || '' : '',
              gtfs_rt_params: subnetworkData.realtime?.type === 'gtfs-rt' ? subnetworkData.realtime?.params || {} : {},
              requires_api_key: subnetworkData.realtime?.requires_api_key || false
            });
            return;
          }
        }
        
        // Si pas de sous-réseau, initialiser avec les données globales du réseau
        setFormData({
          has_siri_api: data.has_siri_api || false,
          siri_api_url: data.siri_api_url || '',
          siri_api_params: data.siri_api_params || {},
          has_gtfs_rt_api: data.has_gtfs_rt_api || false,
          gtfs_rt_url: data.gtfs_rt_url || '',
          gtfs_rt_params: data.gtfs_rt_params || {},
          requires_api_key: data.requires_api_key || false
        });
      } catch (err) {
        console.error('Erreur lors du chargement des données:', err);
        setError('Impossible de charger les données du réseau.');
      } finally {
        setLoading(false);
      }
    };

    if (networkId) {
      fetchNetwork();
    }
  }, [networkId, currentSubnetwork]);

  // Changer de sous-réseau
  const handleSubnetworkChange = (subnetworkName) => {
    if (!subnetworkName) {
      // Si aucun sous-réseau sélectionné, utiliser les données globales du réseau
      setCurrentSubnetwork(null);
      setFormData({
        has_siri_api: network.has_siri_api || false,
        siri_api_url: network.siri_api_url || '',
        siri_api_params: network.siri_api_params || {},
        has_gtfs_rt_api: network.has_gtfs_rt_api || false,
        gtfs_rt_url: network.gtfs_rt_url || '',
        gtfs_rt_params: network.gtfs_rt_params || {},
        requires_api_key: network.requires_api_key || false
      });
      return;
    }
    
    // Trouver le sous-réseau correspondant
    const subnetwork = subnetworks.find(s => s.name === subnetworkName);
    if (subnetwork) {
      setCurrentSubnetwork(subnetworkName);
      // Initialiser le formulaire avec les données du sous-réseau
      setFormData({
        has_siri_api: subnetwork.realtime?.type === 'siri' || false,
        siri_api_url: subnetwork.realtime?.url || '',
        siri_api_params: subnetwork.realtime?.params || {},
        has_gtfs_rt_api: subnetwork.realtime?.type === 'gtfs-rt' || false,
        gtfs_rt_url: subnetwork.realtime?.type === 'gtfs-rt' ? subnetwork.realtime?.url || '' : '',
        gtfs_rt_params: subnetwork.realtime?.type === 'gtfs-rt' ? subnetwork.realtime?.params || {} : {},
        requires_api_key: subnetwork.realtime?.requires_api_key || false
      });
    }
  };

  // Ajouter un nouveau sous-réseau
  const handleAddSubnetwork = () => {
    if (!newSubnetworkName.trim()) {
      setError('Veuillez entrer un nom pour le sous-réseau.');
      return;
    }
    
    // Vérifier si le nom existe déjà
    if (subnetworks.some(s => s.name === newSubnetworkName)) {
      setError(`Le sous-réseau "${newSubnetworkName}" existe déjà.`);
      return;
    }
    
    // Ajouter le nouveau sous-réseau
    const newSubnetworks = [
      ...subnetworks,
      {
        name: newSubnetworkName,
        realtime: {
          type: null,
          url: null,
          params: {},
          requires_api_key: false
        }
      }
    ];
    
    setSubnetworks(newSubnetworks);
    setCurrentSubnetwork(newSubnetworkName);
    setNewSubnetworkName('');
    
    // Réinitialiser le formulaire
    setFormData({
      has_siri_api: false,
      siri_api_url: '',
      siri_api_params: {},
      has_gtfs_rt_api: false,
      gtfs_rt_url: '',
      gtfs_rt_params: {},
      requires_api_key: false
    });
  };
  
  // Gérer les changements de formulaire
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Gérer les changements dans les champs JSON
  const handleJsonChange = (e) => {
    const { name, value } = e.target;
    try {
      const jsonValue = parseJson(value);
      setFormData(prev => ({ ...prev, [name]: jsonValue }));
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de ${name}:`, error);
      // Ne pas mettre à jour formData si le JSON est invalide
    }
  };

  // Soumettre le formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (currentSubnetwork) {
        // Si on travaille sur un sous-réseau, mettre à jour les données du sous-réseau
        const updatedSubnetworks = subnetworks.map(subnet => {
          if (subnet.name === currentSubnetwork) {
            return {
              ...subnet,
              realtime: {
                type: formData.has_siri_api ? 'siri' : (formData.has_gtfs_rt_api ? 'gtfs-rt' : null),
                url: formData.has_siri_api ? formData.siri_api_url : (formData.has_gtfs_rt_api ? formData.gtfs_rt_url : null),
                params: formData.has_siri_api ? formData.siri_api_params : (formData.has_gtfs_rt_api ? formData.gtfs_rt_params : {}),
                requires_api_key: formData.requires_api_key
              }
            };
          }
          return subnet;
        });
        
        // Mettre à jour les sous-réseaux dans la base de données
        const { error: updateError } = await supabase
          .from('networks')
          .update({ subnetworks: updatedSubnetworks })
          .eq('network_id', networkId);
          
        if (updateError) throw updateError;
        
        // Mettre à jour l'état local
        setSubnetworks(updatedSubnetworks);
      } else {
        // Si on travaille sur le réseau global, mettre à jour comme avant
        const { data, error } = await supabase.rpc('update_realtime_config', {
          p_network_id: networkId,
          p_has_siri_api: formData.has_siri_api,
          p_siri_api_url: formData.siri_api_url,
          p_siri_api_params: formData.siri_api_params,
          p_has_gtfs_rt_api: formData.has_gtfs_rt_api,
          p_gtfs_rt_url: formData.gtfs_rt_url,
          p_gtfs_rt_params: formData.gtfs_rt_params,
          p_requires_api_key: formData.requires_api_key
        });

        if (error) throw error;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      setError('Erreur lors de la mise à jour de la configuration API.');
    } finally {
      setLoading(false);
    }
  };

  // Tester les API
  const testApi = async (apiType) => {
    setLoading(true);
    setError(null);
    
    try {
      let url, params;
      
      if (apiType === 'siri') {
        url = formData.siri_api_url;
        params = formData.siri_api_params;
      } else {
        url = formData.gtfs_rt_url;
        params = formData.gtfs_rt_params;
      }
      
      if (!url) {
        throw new Error(`L'URL de l'API ${apiType.toUpperCase()} n'est pas définie.`);
      }
      
      // Faire une requête GET à l'API
      const response = await fetch(url + (url.includes('?') ? '&' : '?') + 
        new URLSearchParams(params).toString());
      
      if (!response.ok) {
        throw new Error(`La requête a échoué avec le code ${response.status}`);
      }
      
      // Vérifier le contenu
      const contentType = response.headers.get('content-type');
      if (apiType === 'siri' && !contentType?.includes('xml')) {
        console.warn(`Type de contenu inattendu pour SIRI: ${contentType}`);
      } else if (apiType === 'gtfs-rt' && !contentType?.includes('application/octet-stream') && !contentType?.includes('application/protobuf')) {
        console.warn(`Type de contenu inattendu pour GTFS-RT: ${contentType}`);
      }
      
      setSuccess(`Test de l'API ${apiType.toUpperCase()} réussi!`);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(`Erreur lors du test de l'API ${apiType}:`, err);
      setError(`Erreur lors du test de l'API ${apiType.toUpperCase()}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !network) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Configuration des API temps réel</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
        >
          Retour
        </button>
      </div>

      {network && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Réseau: {network.network_name} ({network.network_id})
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {typeof success === 'string' ? success : 'Configuration enregistrée avec succès!'}
            </div>
          )}
          
          {/* Sélection du sous-réseau */}
          <div className="mb-6 border-b pb-4">
            <h3 className="text-lg font-medium mb-3">Sous-réseau</h3>
            
            <div className="flex items-center mb-3">
              <select
                value={currentSubnetwork || ''}
                onChange={(e) => handleSubnetworkChange(e.target.value)}
                className="mr-2 p-2 border rounded-md flex-grow"
              >
                <option value="">Configuration globale du réseau</option>
                {subnetworks.map(subnet => (
                  <option key={subnet.name} value={subnet.name}>
                    {subnet.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center mt-3">
              <input
                type="text"
                value={newSubnetworkName}
                onChange={(e) => setNewSubnetworkName(e.target.value)}
                placeholder="Nom du nouveau sous-réseau"
                className="mr-2 p-2 border rounded-md flex-grow"
              />
              <button
                type="button"
                onClick={handleAddSubnetwork}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Ajouter
              </button>
            </div>
            
            <p className="text-gray-500 text-sm mt-2">
              {currentSubnetwork ? 
                `Configuration pour le sous-réseau "${currentSubnetwork}"` : 
                "Configuration globale qui s'applique à tout le réseau si aucun sous-réseau n'est spécifié"
              }
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Clé API requise */}
            <div className="mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_api_key"
                  name="requires_api_key"
                  checked={formData.requires_api_key}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="requires_api_key" className="ml-2 text-gray-700">
                  Nécessite une clé API
                </label>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Activer si les API de ce réseau nécessitent une clé API.
              </p>
            </div>

            {/* Configuration SIRI */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-medium mb-4">Configuration SIRI</h3>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="has_siri_api"
                  name="has_siri_api"
                  checked={formData.has_siri_api}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="has_siri_api" className="ml-2 text-gray-700">
                  Activer l'API SIRI pour ce réseau
                </label>
              </div>
              
              {formData.has_siri_api && (
                <div className="space-y-4 pl-6">
                  <div>
                    <label htmlFor="siri_api_url" className="block text-sm font-medium text-gray-700">
                      URL de l'API SIRI
                    </label>
                    <input
                      type="url"
                      id="siri_api_url"
                      name="siri_api_url"
                      value={formData.siri_api_url || ''}
                      onChange={handleInputChange}
                      placeholder="https://example.com/siri-endpoint"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="siri_api_params" className="block text-sm font-medium text-gray-700">
                      Paramètres de l'API SIRI (format JSON)
                    </label>
                    <textarea
                      id="siri_api_params"
                      name="siri_api_params_text" // Nom différent pour gérer le texte
                      value={jsonToString(formData.siri_api_params)}
                      onChange={(e) => {
                        try {
                          const parsedJson = JSON.parse(e.target.value);
                          setFormData(prev => ({...prev, siri_api_params: parsedJson}));
                        } catch (error) {
                          // Si le JSON est invalide, mettre à jour uniquement le texte brut
                          e.target.setCustomValidity('JSON invalide');
                          setTimeout(() => e.target.setCustomValidity(''), 2000);
                        }
                      }}
                      placeholder='{
  "providerName": "SIRI-Provider",
  "dataFormat": "SIRI-SM",
  "useLineRef": true
}'
                      rows={5}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Paramètres spécifiques à passer à l'API SIRI, au format JSON.
                    </p>
                  </div>
                  
                  <div>
                    <button
                      type="button"
                      onClick={() => testApi('siri')}
                      className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                      disabled={loading || !formData.siri_api_url}
                    >
                      Tester l'API SIRI
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Configuration GTFS-RT */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-medium mb-4">Configuration GTFS-RT</h3>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="has_gtfs_rt_api"
                  name="has_gtfs_rt_api"
                  checked={formData.has_gtfs_rt_api}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="has_gtfs_rt_api" className="ml-2 text-gray-700">
                  Activer l'API GTFS-RT pour ce réseau
                </label>
              </div>
              
              {formData.has_gtfs_rt_api && (
                <div className="space-y-4 pl-6">
                  <div>
                    <label htmlFor="gtfs_rt_url" className="block text-sm font-medium text-gray-700">
                      URL de l'API GTFS-RT
                    </label>
                    <input
                      type="url"
                      id="gtfs_rt_url"
                      name="gtfs_rt_url"
                      value={formData.gtfs_rt_url || ''}
                      onChange={handleInputChange}
                      placeholder="https://example.com/gtfs-rt-endpoint"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="gtfs_rt_params" className="block text-sm font-medium text-gray-700">
                      Paramètres de l'API GTFS-RT (format JSON)
                    </label>
                    <textarea
                      id="gtfs_rt_params"
                      name="gtfs_rt_params_text" // Nom différent pour gérer le texte
                      value={jsonToString(formData.gtfs_rt_params)}
                      onChange={(e) => {
                        try {
                          const parsedJson = JSON.parse(e.target.value);
                          setFormData(prev => ({...prev, gtfs_rt_params: parsedJson}));
                        } catch (error) {
                          // Si le JSON est invalide, mettre à jour uniquement le texte brut
                          e.target.setCustomValidity('JSON invalide');
                          setTimeout(() => e.target.setCustomValidity(''), 2000);
                        }
                      }}
                      placeholder='{
  "providerName": "GTFS-RT-Provider",
  "feedType": "TripUpdates"
}'
                      rows={5}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Paramètres spécifiques à passer à l'API GTFS-RT, au format JSON.
                    </p>
                  </div>
                  
                  <div>
                    <button
                      type="button"
                      onClick={() => testApi('gtfs-rt')}
                      className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                      disabled={loading || !formData.gtfs_rt_url}
                    >
                      Tester l'API GTFS-RT
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={loading}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RealtimeApiConfig; 