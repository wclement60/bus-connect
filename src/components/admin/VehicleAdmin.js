import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { FaEdit, FaTrash, FaPlus, FaBus, FaSearch } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const VehicleAdmin = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState('add'); // 'add' ou 'edit'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [vehicleForm, setVehicleForm] = useState({
    id: null,
    vehicle_id: '',
    network_id: '',
    brand: '',
    model: ''
  });

  // Récupérer tous les réseaux et véhicules au chargement
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Récupérer les réseaux
        const { data: networksData, error: networksError } = await supabase
          .from('networks')
          .select('network_id, network_name')
          .order('network_name');

        if (networksError) throw networksError;
        setNetworks(networksData);

        // Si aucun réseau n'est sélectionné et qu'il y a des réseaux, sélectionner le premier
        if (networksData.length > 0 && !selectedNetwork) {
          setSelectedNetwork(networksData[0].network_id);
          setVehicleForm(prev => ({ ...prev, network_id: networksData[0].network_id }));
        }

        // Récupérer les véhicules
        await fetchVehicles();
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Récupérer les véhicules lorsque le réseau sélectionné change
  useEffect(() => {
    if (selectedNetwork) {
      fetchVehicles();
      setVehicleForm(prev => ({ ...prev, network_id: selectedNetwork }));
    }
  }, [selectedNetwork]);

  const fetchVehicles = async () => {
    if (!selectedNetwork) return;

    try {
      setLoading(true);
      let query = supabase
        .from('vehicle_details')
        .select('*')
        .eq('network_id', selectedNetwork)
        .order('vehicle_id');

      // Appliquer le filtre de recherche si présent
      if (searchTerm) {
        query = query.or(`vehicle_id.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setVehicles(data);
    } catch (error) {
      console.error('Erreur lors de la récupération des véhicules:', error);
      toast.error('Erreur lors de la récupération des véhicules');
    } finally {
      setLoading(false);
    }
  };

  const handleNetworkChange = (e) => {
    setSelectedNetwork(e.target.value);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchVehicles();
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setVehicleForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (vehicle) => {
    setFormMode('edit');
    setVehicleForm({
      id: vehicle.id,
      vehicle_id: vehicle.vehicle_id,
      network_id: vehicle.network_id,
      brand: vehicle.brand || '',
      model: vehicle.model || ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('vehicle_details')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Véhicule supprimé avec succès');
      fetchVehicles();
    } catch (error) {
      console.error('Erreur lors de la suppression du véhicule:', error);
      toast.error('Erreur lors de la suppression du véhicule');
    }
  };

  const resetForm = () => {
    setFormMode('add');
    setVehicleForm({
      id: null,
      vehicle_id: '',
      network_id: selectedNetwork,
      brand: '',
      model: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation basique
    if (!vehicleForm.vehicle_id || !vehicleForm.network_id) {
      toast.error('L\'ID du véhicule et le réseau sont requis');
      return;
    }

    try {
      let result;
      
      if (formMode === 'add') {
        // Ajouter un nouveau véhicule
        result = await supabase
          .from('vehicle_details')
          .insert([{
            vehicle_id: vehicleForm.vehicle_id,
            network_id: vehicleForm.network_id,
            brand: vehicleForm.brand || null,
            model: vehicleForm.model || null
          }]);
        
        if (result.error) throw result.error;
        toast.success('Véhicule ajouté avec succès');
      } else {
        // Modifier un véhicule existant
        result = await supabase
          .from('vehicle_details')
          .update({
            vehicle_id: vehicleForm.vehicle_id,
            network_id: vehicleForm.network_id,
            brand: vehicleForm.brand || null,
            model: vehicleForm.model || null
          })
          .eq('id', vehicleForm.id);
        
        if (result.error) throw result.error;
        toast.success('Véhicule mis à jour avec succès');
      }
      
      // Réinitialiser le formulaire et recharger les données
      resetForm();
      fetchVehicles();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du véhicule:', error);
      // Gérer l'erreur de contrainte unique
      if (error.code === '23505') {
        toast.error('Ce véhicule existe déjà pour ce réseau');
      } else {
        toast.error('Erreur lors de l\'enregistrement du véhicule');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <FaBus className="mr-2" /> Gestion des véhicules
        </h1>
        <button 
          onClick={() => navigate('/admin')}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          Retour au tableau de bord
        </button>
      </div>

      {/* Sélection du réseau et filtre de recherche */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">Réseau</label>
          <select
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedNetwork}
            onChange={handleNetworkChange}
          >
            {networks.map(network => (
              <option key={network.network_id} value={network.network_id}>
                {network.network_name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-auto flex-grow">
          <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
          <form onSubmit={handleSearchSubmit} className="flex">
            <input
              type="text"
              placeholder="Rechercher par ID, marque ou modèle..."
              className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <button 
              type="submit"
              className="px-3 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
            >
              <FaSearch />
            </button>
          </form>
        </div>
      </div>

      {/* Formulaire d'ajout/modification */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-medium mb-4">
          {formMode === 'add' ? 'Ajouter un véhicule' : 'Modifier le véhicule'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID du véhicule*</label>
            <input
              type="text"
              name="vehicle_id"
              value={vehicleForm.vehicle_id}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="ex: 1234"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marque</label>
            <input
              type="text"
              name="brand"
              value={vehicleForm.brand}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex: Iveco"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modèle</label>
            <input
              type="text"
              name="model"
              value={vehicleForm.model}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex: Urbanway 12"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded mr-2 hover:bg-blue-600"
            >
              {formMode === 'add' ? 'Ajouter' : 'Mettre à jour'}
            </button>
            {formMode === 'edit' && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Liste des véhicules */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-medium p-4 border-b">Liste des véhicules ({vehicles.length})</h2>
        
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm 
              ? "Aucun véhicule ne correspond à votre recherche" 
              : "Aucun véhicule enregistré pour ce réseau"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marque
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modèle
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{vehicle.vehicle_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900">{vehicle.brand || <span className="text-gray-400 italic">Non spécifié</span>}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900">{vehicle.model || <span className="text-gray-400 italic">Non spécifié</span>}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(vehicle)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        <FaEdit className="inline" /> Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FaTrash className="inline" /> Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleAdmin; 