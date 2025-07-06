import React, { useState, useEffect } from 'react';
import { supabaseAdmin } from '../../services/supabase';
import { getAllUsers, updateUser, deleteUser } from '../../services/admin';

// Liste des départements français triés par code
const departements = [
  { code: "01", nom: "Ain" },
  { code: "02", nom: "Aisne" },
  { code: "03", nom: "Allier" },
  { code: "04", nom: "Alpes-de-Haute-Provence" },
  { code: "05", nom: "Hautes-Alpes" },
  { code: "06", nom: "Alpes-Maritimes" },
  { code: "07", nom: "Ardèche" },
  { code: "08", nom: "Ardennes" },
  { code: "09", nom: "Ariège" },
  { code: "10", nom: "Aube" },
  { code: "11", nom: "Aude" },
  { code: "12", nom: "Aveyron" },
  { code: "13", nom: "Bouches-du-Rhône" },
  { code: "14", nom: "Calvados" },
  { code: "15", nom: "Cantal" },
  { code: "16", nom: "Charente" },
  { code: "17", nom: "Charente-Maritime" },
  { code: "18", nom: "Cher" },
  { code: "19", nom: "Corrèze" },
  { code: "21", nom: "Côte-d'Or" },
  { code: "22", nom: "Côtes-d'Armor" },
  { code: "23", nom: "Creuse" },
  { code: "24", nom: "Dordogne" },
  { code: "25", nom: "Doubs" },
  { code: "26", nom: "Drôme" },
  { code: "27", nom: "Eure" },
  { code: "28", nom: "Eure-et-Loir" },
  { code: "29", nom: "Finistère" },
  { code: "2A", nom: "Corse-du-Sud" },
  { code: "2B", nom: "Haute-Corse" },
  { code: "30", nom: "Gard" },
  { code: "31", nom: "Haute-Garonne" },
  { code: "32", nom: "Gers" },
  { code: "33", nom: "Gironde" },
  { code: "34", nom: "Hérault" },
  { code: "35", nom: "Ille-et-Vilaine" },
  { code: "36", nom: "Indre" },
  { code: "37", nom: "Indre-et-Loire" },
  { code: "38", nom: "Isère" },
  { code: "39", nom: "Jura" },
  { code: "40", nom: "Landes" },
  { code: "41", nom: "Loir-et-Cher" },
  { code: "42", nom: "Loire" },
  { code: "43", nom: "Haute-Loire" },
  { code: "44", nom: "Loire-Atlantique" },
  { code: "45", nom: "Loiret" },
  { code: "46", nom: "Lot" },
  { code: "47", nom: "Lot-et-Garonne" },
  { code: "48", nom: "Lozère" },
  { code: "49", nom: "Maine-et-Loire" },
  { code: "50", nom: "Manche" },
  { code: "51", nom: "Marne" },
  { code: "52", nom: "Haute-Marne" },
  { code: "53", nom: "Mayenne" },
  { code: "54", nom: "Meurthe-et-Moselle" },
  { code: "55", nom: "Meuse" },
  { code: "56", nom: "Morbihan" },
  { code: "57", nom: "Moselle" },
  { code: "58", nom: "Nièvre" },
  { code: "59", nom: "Nord" },
  { code: "60", nom: "Oise" },
  { code: "61", nom: "Orne" },
  { code: "62", nom: "Pas-de-Calais" },
  { code: "63", nom: "Puy-de-Dôme" },
  { code: "64", nom: "Pyrénées-Atlantiques" },
  { code: "65", nom: "Hautes-Pyrénées" },
  { code: "66", nom: "Pyrénées-Orientales" },
  { code: "67", nom: "Bas-Rhin" },
  { code: "68", nom: "Haut-Rhin" },
  { code: "69", nom: "Rhône" },
  { code: "70", nom: "Haute-Saône" },
  { code: "71", nom: "Saône-et-Loire" },
  { code: "72", nom: "Sarthe" },
  { code: "73", nom: "Savoie" },
  { code: "74", nom: "Haute-Savoie" },
  { code: "75", nom: "Paris" },
  { code: "76", nom: "Seine-Maritime" },
  { code: "77", nom: "Seine-et-Marne" },
  { code: "78", nom: "Yvelines" },
  { code: "79", nom: "Deux-Sèvres" },
  { code: "80", nom: "Somme" },
  { code: "81", nom: "Tarn" },
  { code: "82", nom: "Tarn-et-Garonne" },
  { code: "83", nom: "Var" },
  { code: "84", nom: "Vaucluse" },
  { code: "85", nom: "Vendée" },
  { code: "86", nom: "Vienne" },
  { code: "87", nom: "Haute-Vienne" },
  { code: "88", nom: "Vosges" },
  { code: "89", nom: "Yonne" },
  { code: "90", nom: "Territoire de Belfort" },
  { code: "91", nom: "Essonne" },
  { code: "92", nom: "Hauts-de-Seine" },
  { code: "93", nom: "Seine-Saint-Denis" },
  { code: "94", nom: "Val-de-Marne" },
  { code: "95", nom: "Val-d'Oise" },
  { code: "971", nom: "Guadeloupe" },
  { code: "972", nom: "Martinique" },
  { code: "973", nom: "Guyane" },
  { code: "974", nom: "La Réunion" },
  { code: "976", nom: "Mayotte" }
].sort((a, b) => {
  // Convertir les codes en nombres pour le tri
  const numA = parseInt(a.code, 10);
  const numB = parseInt(b.code, 10);
  
  // Gérer les cas spéciaux (2A, 2B et DOM-TOM)
  if (a.code === "2A") return 20.1 - numB;
  if (a.code === "2B") return 20.2 - numB;
  if (b.code === "2A") return numA - 20.1;
  if (b.code === "2B") return numA - 20.2;
  if (a.code.startsWith("97")) return 1000;
  if (b.code.startsWith("97")) return -1000;
  
  return numA - numB;
});

const UserAdmin = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  
  // États pour la pagination et la recherche
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [perPage] = useState(10);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // États pour le tri et le filtre
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [genderFilter, setGenderFilter] = useState('');

  // État pour les statistiques
  const [stats, setStats] = useState({
    male: 0,
    female: 0,
    other: 0,
    total: 0
  });

  // Effet pour le debounce de la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Effet pour charger les utilisateurs
  useEffect(() => {
    fetchUsers();
  }, [currentPage, debouncedSearchQuery, perPage, sortField, sortAsc, genderFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { users: data, total, totalByGender } = await getAllUsers(
        currentPage, 
        perPage, 
        debouncedSearchQuery, 
        sortField, 
        sortAsc,
        genderFilter
      );
      
      setUsers(data || []);
      setTotalUsers(total);
      setStats(totalByGender);
    } catch (err) {
      console.error('Erreur lors de la récupération des utilisateurs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour gérer le tri
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // Composant pour l'en-tête de colonne triable
  const SortableHeader = ({ field, children }) => {
    const isSorted = sortField === field;
    
    return (
      <th 
        className="py-2 px-4 font-medium cursor-pointer hover:bg-gray-200 transition-colors"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center space-x-1">
          <span>{children}</span>
          <span className="text-gray-400">
            {isSorted ? (
              sortAsc ? '↑' : '↓'
            ) : '↕'}
          </span>
        </div>
      </th>
    );
  };

  // Fonction pour filtrer par genre
  const filterByGender = (gender) => {
    setGenderFilter(gender);
    setCurrentPage(1);
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      await updateUser(userId, updates);
      
      // Mettre à jour l'état local
      setUsers(users.map(user => 
        user.id === userId ? { ...user, ...updates } : user
      ));
      
      // Fermer le modal
      handleModalClose();
    } catch (err) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', err);
      setError(err.message);
    }
  };

  const toggleModTools = async (userId, currentValue) => {
    try {
      const newValue = currentValue === 1 ? 0 : 1;
      
      await updateUser(userId, { modtools: newValue });
      
      // Mettre à jour l'état local
      setUsers(users.map(user => 
        user.id === userId ? { ...user, modtools: newValue } : user
      ));
    } catch (err) {
      console.error('Erreur lors de la mise à jour des droits d\'administration:', err);
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) {
      return;
    }
    
    try {
      await deleteUser(userId);
      
      // Mettre à jour l'état local en retirant l'utilisateur
      setUsers(users.filter(user => user.id !== userId));
      
      // Si l'utilisateur supprimé est celui affiché dans le modal, fermer le modal
      if (selectedUser && selectedUser.id === userId) {
        handleModalClose();
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', err);
      setError(err.message);
    }
  };

  const handleFileUpload = async (userId, file) => {
    try {
      setUploadLoading(true);
      
      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;
      
      // Télécharger le fichier vers Supabase Storage
      const { error: uploadError } = await supabaseAdmin
        .storage
        .from('user-avatars')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Obtenir l'URL publique du fichier
      const { data } = supabaseAdmin
        .storage
        .from('user-avatars')
        .getPublicUrl(filePath);
      
      // Mettre à jour le profil utilisateur avec l'URL de l'avatar
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ avatar_url: data.publicUrl })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      
      // Mettre à jour l'état local
      setUsers(users.map(user => 
        user.id === userId ? { ...user, avatar_url: data.publicUrl } : user
      ));
      
      // Mettre à jour l'utilisateur sélectionné
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({
          ...selectedUser,
          avatar_url: data.publicUrl
        });
      }
    } catch (err) {
      console.error('Erreur lors du téléchargement de l\'image:', err);
      setError(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  // Composant de pagination
  const Pagination = () => {
    const totalPages = Math.ceil(totalUsers / perPage);
    
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex justify-center items-center space-x-2 mt-4">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className={`px-3 py-1 rounded ${
            currentPage === 1
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          «
        </button>
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`px-3 py-1 rounded ${
            currentPage === 1
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          ‹
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => setCurrentPage(1)}
              className="px-3 py-1 rounded hover:bg-gray-100"
            >
              1
            </button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}
        
        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => setCurrentPage(number)}
            className={`px-3 py-1 rounded ${
              currentPage === number
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-100'
            }`}
          >
            {number}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <button
              onClick={() => setCurrentPage(totalPages)}
              className="px-3 py-1 rounded hover:bg-gray-100"
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className={`px-3 py-1 rounded ${
            currentPage === totalPages
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          ›
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className={`px-3 py-1 rounded ${
            currentPage === totalPages
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          »
        </button>
      </div>
    );
  };

  // Composant pour les statistiques
  const StatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-700">Total des inscrits</h3>
        <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-700">Hommes</h3>
        <p className="text-2xl font-bold text-blue-800">
          {stats.male}
          <span className="text-sm font-normal text-blue-600 ml-2">
            ({((stats.male / stats.total) * 100).toFixed(1)}%)
          </span>
        </p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-700">Femmes</h3>
        <p className="text-2xl font-bold text-blue-800">
          {stats.female}
          <span className="text-sm font-normal text-blue-600 ml-2">
            ({((stats.female / stats.total) * 100).toFixed(1)}%)
          </span>
        </p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-700">Autre</h3>
        <p className="text-2xl font-bold text-blue-800">
          {stats.other}
          <span className="text-sm font-normal text-blue-600 ml-2">
            ({((stats.other / stats.total) * 100).toFixed(1)}%)
          </span>
        </p>
      </div>
    </div>
  );

  // Modal pour afficher et modifier les détails d'un utilisateur
  const UserDetailModal = () => {
    const [formData, setFormData] = useState({
      first_name: selectedUser?.first_name || '',
      last_name: selectedUser?.last_name || '',
      email: selectedUser?.email || '',
      birth_date: selectedUser?.birth_date || '',
      gender: selectedUser?.gender || '',
      departement: selectedUser?.departement || ''
    });

    if (!selectedUser) return null;

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData({
        ...formData,
        [name]: value
      });
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      handleUpdateUser(selectedUser.id, formData);
    };

    const handleImageChange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.size > 2 * 1024 * 1024) {
          alert("L'image est trop grande. Veuillez choisir une image de moins de 2MB.");
          return;
        }
        
        if (!file.type.match('image.*')) {
          alert("Veuillez sélectionner une image valide.");
          return;
        }
        
        handleFileUpload(selectedUser.id, file);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Détails de l'utilisateur</h2>
            <button
              onClick={handleModalClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-24 h-24 mb-4">
                {selectedUser.avatar_url ? (
                  <img 
                    src={selectedUser.avatar_url} 
                    alt={`${selectedUser.first_name} ${selectedUser.last_name}`}
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-2xl text-gray-600">
                      {selectedUser.first_name?.charAt(0) || selectedUser.email?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-2 cursor-pointer hover:bg-blue-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </label>
                <input 
                  type="file" 
                  id="avatar-upload" 
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={uploadLoading}
                />
              </div>
              {uploadLoading && (
                <div className="text-sm text-gray-500">Chargement de l'image...</div>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de naissance
                  </label>
                  <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Genre
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner</option>
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Département
                </label>
                <select
                  name="departement"
                  value={formData.departement}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un département</option>
                  {departements.map((dep) => (
                    <option key={dep.code} value={dep.code}>
                      {dep.nom} ({dep.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut administrateur
                </label>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded text-sm ${selectedUser.modtools === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {selectedUser.modtools === 1 ? 'Administrateur' : 'Utilisateur standard'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleModTools(selectedUser.id, selectedUser.modtools)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    {selectedUser.modtools === 1 ? 'Révoquer' : 'Promouvoir'}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date d'inscription
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                  {new Date(selectedUser.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-center pt-4 space-y-3 sm:space-y-0">
                <button
                  type="button"
                  onClick={() => handleDeleteUser(selectedUser.id)}
                  className="w-full sm:w-auto px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Supprimer
                </button>
                
                <div className="flex space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <StatsCards />
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="text-xl font-medium">Gestion des membres</h1>
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:min-w-[300px]">
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => filterByGender('male')}
              className={`px-3 py-1 rounded ${
                genderFilter === 'male' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Hommes
            </button>
            <button
              onClick={() => filterByGender('female')}
              className={`px-3 py-1 rounded ${
                genderFilter === 'female' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Femmes
            </button>
            <button
              onClick={() => filterByGender('')}
              className={`px-3 py-1 rounded ${
                !genderFilter ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Tous
            </button>
          </div>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-left">
                  <th className="py-2 px-4 font-medium">Photo</th>
                  <SortableHeader field="first_name">Prénom</SortableHeader>
                  <SortableHeader field="last_name">Nom</SortableHeader>
                  <SortableHeader field="email">Email</SortableHeader>
                  <SortableHeader field="birth_date">Date de naissance</SortableHeader>
                  <SortableHeader field="gender">Genre</SortableHeader>
                  <SortableHeader field="departement">Département</SortableHeader>
                  <SortableHeader field="modtools">Statut</SortableHeader>
                  <th className="py-2 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-4 px-4 text-center text-gray-500">
                      {searchQuery ? 'Aucun utilisateur trouvé pour cette recherche' : 'Aucun utilisateur trouvé'}
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-2 px-4">
                        {user.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt={`${user.first_name} ${user.last_name}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-lg text-gray-600">
                              {user.first_name?.charAt(0) || user.email?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4">{user.first_name || '-'}</td>
                      <td className="py-2 px-4">{user.last_name || '-'}</td>
                      <td className="py-2 px-4 whitespace-nowrap font-mono">{user.email}</td>
                      <td className="py-2 px-4">
                        {user.birth_date ? (
                          <>
                            {new Date(user.birth_date).toLocaleDateString('fr-FR')}
                            {' '}
                            ({(() => {
                              const today = new Date();
                              const birthDate = new Date(user.birth_date);
                              let age = today.getFullYear() - birthDate.getFullYear();
                              const m = today.getMonth() - birthDate.getMonth();
                              if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                age--;
                              }
                              return `${age} ans`;
                            })()})
                          </>
                        ) : '-'}
                      </td>
                      <td className="py-2 px-4">
                        {user.gender === 'male' ? 'Homme' : 
                         user.gender === 'female' ? 'Femme' : 
                         user.gender === 'other' ? 'Autre' : '-'}
                      </td>
                      <td className="py-2 px-4">
                        {user.departement ? departements.find(d => d.code === user.departement)?.nom || user.departement : '-'}
                      </td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${user.modtools === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {user.modtools === 1 ? 'Admin' : 'Utilisateur'}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUserClick(user)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                          >
                            Détails
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            title="Supprimer l'utilisateur"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination />
          
          {totalUsers > 0 && (
            <div className="text-sm text-gray-500 mt-4 text-center">
              Affichage de {Math.min((currentPage - 1) * perPage + 1, totalUsers)} à {Math.min(currentPage * perPage, totalUsers)} sur {totalUsers} utilisateurs
              {genderFilter && (
                <span className="ml-2">
                  (Filtré : {genderFilter === 'male' ? 'Hommes' : genderFilter === 'female' ? 'Femmes' : 'Autre'})
                </span>
              )}
            </div>
          )}
        </>
      )}
      
      {isModalOpen && <UserDetailModal />}
    </div>
  );
};

export default UserAdmin; 