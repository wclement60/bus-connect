import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { IoFilter, IoChatbubblesOutline } from "react-icons/io5";
import { FaBirthdayCake } from "react-icons/fa";
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import FavoriteButton from './FavoriteButton';
import NetworkLogo from './NetworkLogo';
import {
  addFavoriteNetwork,
  removeFavoriteNetwork,
  removeFavoriteLine,
  getFavoriteNetworks
} from '../services/favorites';
import { getAllNetworksWithDetails, invalidateAllNetworksCache } from '../services/networkService';
import WelcomeAnimation from './WelcomeAnimation';
import { getUserPreferences, getTodayBirthdays } from '../services/auth';

const marqueeStyle = `
  @keyframes marqueeAnimation {
    from { transform: translateX(0); }
    to { transform: translateX(-100%); }
  }
  .animate-marquee {
    display: inline-block;
    padding-left: 100%;
    animation: marqueeAnimation 20s linear infinite;
    white-space: nowrap;
  }
  .group:hover .animate-marquee {
    animation-play-state: paused;
  }
  
  @keyframes shimmerBorder {
    0% { transform: translateX(-100%); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateX(100%); opacity: 0; }
  }
  
  .birthday-shimmer {
    position: relative;
    overflow: hidden;
  }
  
  .birthday-shimmer::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(236, 72, 153, 0.6) 20%, 
      rgba(236, 72, 153, 0.9) 50%, 
      rgba(236, 72, 153, 0.6) 80%, 
      transparent 100%);
    transform: translateX(-100%);
    animation: shimmerBorder 3s ease-in-out infinite;
    animation-delay: 1s;
  }
  
  .dark .birthday-shimmer::after {
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(219, 39, 119, 0.6) 20%, 
      rgba(219, 39, 119, 0.9) 50%, 
      rgba(219, 39, 119, 0.6) 80%, 
      transparent 100%);
  }
`;

// Style des cartes avec simple bordure en dégradé et skeleton loading
const simpleBorderStyle = `
  .simple-gradient-border {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.3s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: double 1px transparent;
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    background-origin: border-box;
    background-clip: content-box, border-box;
  }
  
  .dark .simple-gradient-border {
    background: #1e293b;
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .simple-gradient-border:hover {
    transform: translateY(-4px);
  }
  
  .card-content {
    padding: 1rem;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .network-logo-container {
    width: 3.5rem;
    height: 3.5rem;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .network-logo-border {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: double 2px transparent;
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    background-origin: border-box;
    background-clip: content-box, border-box;
  }
  
  .dark .network-logo-border {
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
  }
  
  .network-logo {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }
  
  .network-name {
    color: #1e3a8a;
    font-family: 'Naotypo-Bold';
    font-weight: 900;
    letter-spacing: -0.5px;
  }
  
  .dark .network-name {
    color: #e2e8f0;
  }
  
  .agency-name {
    color: #64748b;
    font-size: 0.75rem;
  }
  
  .dark .agency-name {
    color: #94a3b8;
  }
  
  .network-type-badge {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    margin-left: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-image: linear-gradient(135deg, #07d6fb, #ff66c4);
    color: white;
  }
  
  .page-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #1e3a8a;
    margin-bottom: 0.3rem;
  }
  
  .dark .page-title {
    color: #e2e8f0;
  }
  
  .text-gradient {
    background-image: linear-gradient(135deg, #07d6fb, #ff66c4);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 700;
    font-size: 1.6rem;
    text-shadow: 0px 0px 1px rgba(0,0,0,0.05);
  }
  
  .gradient-hr {
    height: 2px;
    border: none;
    background-image: linear-gradient(135deg, #07d6fb, #ff66c4);
    border-radius: 1px;
    margin-top: 0;
    margin-bottom: 1rem;
    width: 120px;
  }
  
  .search-container {
    max-width: 100%;
  }
  
  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    border-radius: 2rem;
    background-color: #f8fafc;
    transition: all 0.2s;
    border: double 1px transparent;
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    background-origin: border-box;
    background-clip: padding-box, border-box;
  }
  
  .dark .search-input {
    background-color: #1e293b;
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    color: white;
  }
  
  .search-input:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
  }
  
  .dark .search-input:focus {
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.3);
  }
  
  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
  }
  
  /* Skeleton loader styles */
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
  
  .skeleton {
    background: linear-gradient(90deg, 
                #f0f0f0 25%, 
                #e0e0e0 50%, 
                #f0f0f0 75%);
    background-size: 1000px 100%;
    animation: shimmer 2s infinite linear;
    border-radius: 4px;
  }
  
  .dark .skeleton {
    background: linear-gradient(90deg, 
                #334155 25%, 
                #475569 50%, 
                #334155 75%);
    background-size: 1000px 100%;
  }
  
  .skeleton-card {
    border-radius: 12px;
    overflow: hidden;
    background-color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .dark .skeleton-card {
    background-color: #1e293b;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .skeleton-content {
    padding: 1rem;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .skeleton-circle {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
  }
  
  .skeleton-title {
    height: 1.25rem;
    margin-top: 1rem;
    width: 80%;
  }
  
  .skeleton-subtitle {
    height: 0.75rem;
    margin-top: 0.5rem;
    width: 60%;
  }
`;

// Composant pour le défilement de texte
const TextMarquee = ({ text, className = "" }) => {
    if (!text || text.length < 25) {
        return <p className={`truncate ${className}`}>{text}</p>;
    }
    return (
        <div className="relative overflow-hidden w-full h-5 group">
            <style>{marqueeStyle}</style>
            <div className="absolute top-0 left-0 animate-marquee">
                <p className={`inline-block ${className}`}>{text}</p>
                <p className={`inline-block ml-16 ${className}`}>{text}</p>
            </div>
            <div className="absolute top-0 left-0 w-4 h-full bg-gradient-to-r from-white dark:from-dark-700 to-transparent z-10"></div>
            <div className="absolute top-0 right-0 w-4 h-full bg-gradient-to-l from-white dark:from-dark-700 to-transparent z-10"></div>
        </div>
    );
};

// Composant pour les cartes de chargement
const SkeletonNetworkCard = () => (
    <div className="bg-white dark:bg-dark-700 rounded-lg p-4 animate-pulse">
        <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-dark-600"></div>
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-dark-600"></div>
        </div>
        <div className="mt-4 h-4 w-3/4 rounded bg-gray-200 dark:bg-dark-600"></div>
        <div className="mt-2 h-3 w-1/2 rounded bg-gray-200 dark:bg-dark-600"></div>
    </div>
);

// Fonction pour obtenir l'image de la région
const RegionLogo = ({ region }) => {
  const [imageError, setImageError] = useState(false);
  
  const getRegionImagePath = (regionName) => {
    const normalizedName = regionName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    return `/images/regions/${normalizedName}.svg`;
  };
  
  const getFallbackEmoji = (regionName) => {
    const regionIcons = {
      "Île-de-France": "🗼", "Auvergne-Rhône-Alpes": "⛰️", "Provence-Alpes-Côte d'Azur": "🌊",
      "Occitanie": "🏞️", "Nouvelle-Aquitaine": "🍇", "Hauts-de-France": "🏭", "Grand Est": "🏰",
      "Bretagne": "⚓", "Normandie": "🧀", "Pays de la Loire": "🏰", "Bourgogne-Franche-Comté": "🍷",
      "Centre-Val de Loire": "🏯", "Corse": "🏝️", "Guadeloupe": "🌴", "Martinique": "🌋",
      "Guyane": "🌳", "La Réunion": "🌋", "Mayotte": "🐢", "Non classée": "🚌"
    };
    return regionIcons[regionName] || "🏙️";
  };
  
  if (imageError) {
    return <span style={{ fontSize: '1.2rem' }}>{getFallbackEmoji(region)}</span>;
  }
  
  return <img 
    src={getRegionImagePath(region)} 
    alt={`Région ${region}`} 
    onError={() => setImageError(true)} 
    className="w-full h-full object-contain"
  />;
};

const NetworkList = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [networks, setNetworks] = useState([]);
  const [favoriteNetworks, setFavoriteNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [networkLines, setNetworkLines] = useState([]);
  const [networksByRegion, setNetworksByRegion] = useState({});
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('Tous');
  const [checkingPrefs, setCheckingPrefs] = useState(true);
  const [showNetworkConfirmModal, setShowNetworkConfirmModal] = useState(false);
  const [favoriteLinesCount, setFavoriteLinesCount] = useState(0);
  const [networkToRemove, setNetworkToRemove] = useState(null);
  const [todayBirthdays, setTodayBirthdays] = useState([]);

  useEffect(() => {
    document.title = "Bus Connect - Choisissez votre réseau";
  }, []);

  useEffect(() => {
    const checkDefaultNetwork = async () => {
      if (location.state?.bypassRedirect) {
        setCheckingPrefs(false);
        // Clean the state to avoid issues with browser history (back/forward)
        navigate(location.pathname, { replace: true, state: {} });
        return;
      }

      if (user) {
        try {
          const prefs = await getUserPreferences();
          if (prefs && prefs.default_network_id) {
            navigate(`/network/${prefs.default_network_id}/lines`, { replace: true });
          } else {
            setCheckingPrefs(false);
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des préférences", error);
          setCheckingPrefs(false);
        }
      } else {
        setCheckingPrefs(false);
      }
    };

    if (!authLoading) {
      checkDefaultNetwork();
    }
  }, [user, authLoading, navigate, location]);

  const getGreeting = () => (new Date().getHours() < 18 ? "Bonjour" : "Bonsoir");

  // Formater le nom pour afficher Prénom + initiale du nom
  const formatBirthdayName = (firstName, lastName) => {
    if (!firstName) return '';
    if (!lastName) return firstName;
    return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchNetworks(),
          user ? fetchFavoriteNetworks() : Promise.resolve()
        ]);
      } catch (err) {
        console.error("Erreur lors du chargement des données:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (!checkingPrefs) {
        loadData();
    }
  }, [user, checkingPrefs]);

  const fetchFavoriteNetworks = useCallback(async () => {
    if (!user) return;
    try {
      const favoriteNetworksData = await getFavoriteNetworks();
      setFavoriteNetworks(favoriteNetworksData || []);
    } catch (err) {
      console.error("Erreur lors de la récupération des réseaux favoris:", err);
    }
  }, [user]);

  const fetchNetworks = useCallback(async () => {
    try {
      const networksWithDetails = await getAllNetworksWithDetails([]);
      const networkGroups = networksWithDetails.reduce((acc, network) => {
        const region = network.region || 'Autres';
        if (!acc[region]) acc[region] = [];
        acc[region].push(network);
        return acc;
      }, {});

      const regionList = Object.keys(networkGroups).sort((a, b) => {
        if (a === 'Autres') return 1; if (b === 'Autres') return -1;
        return a.localeCompare(b);
      });

      setRegions(regionList);
      setNetworksByRegion(networkGroups);
      setNetworks(networksWithDetails || []);
    } catch (err) {
      console.error("Erreur lors de la récupération des réseaux:", err);
      setError(err.message);
    }
  }, []);

  const handleNetworkClick = (networkId) => navigate(`/network/${networkId}/lines`);

  const handleFavoriteClick = async (e, network) => {
    e.stopPropagation();
    if (!user) return navigate('/login');
    
    const isCurrentlyFavorite = favoriteNetworks.some(fav => fav.network_id === network.network_id);
    
    try {
        if (isCurrentlyFavorite) {
            // Vérifier s'il y a des lignes favorites pour ce réseau
            const { count } = await supabase
                .from('favorite_lines')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('network_id', network.network_id);
            
            if (count > 0) {
                // Il y a des lignes favorites, afficher la modal de confirmation
                setFavoriteLinesCount(count);
                setNetworkToRemove(network);
                setShowNetworkConfirmModal(true);
            } else {
                // Pas de lignes favorites, supprimer directement
                await removeFavoriteNetwork(network.network_id);
                setFavoriteNetworks(prev => prev.filter(fav => fav.network_id !== network.network_id));
            }
        } else {
            await addFavoriteNetwork(network.network_id);
            setFavoriteNetworks(prev => [...prev, { ...network, is_favorite: true }]);
        }
    } catch (error) {
        console.error('Erreur lors de la modification des favoris:', error);
    }
  };

  const handleRemoveNetworkFavorite = async () => {
    try {
      if (networkToRemove) {
        await removeFavoriteNetwork(networkToRemove.network_id);
        setFavoriteNetworks(prev => prev.filter(fav => fav.network_id !== networkToRemove.network_id));
      }
      setShowNetworkConfirmModal(false);
      setNetworkToRemove(null);
      setFavoriteLinesCount(0);
    } catch (error) {
      console.error("Erreur lors de la suppression du réseau des favoris", error);
    }
  };

  const filteredFavorites = favoriteNetworks.filter(network => network.network_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const availableNetworks = networks.filter(n => !favoriteNetworks.some(fav => fav.network_id === n.network_id) && n.network_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const regionsToShow = selectedRegion === 'Tous' ? regions : regions.filter(r => r === selectedRegion);

  // Récupérer les anniversaires du jour
  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        const birthdays = await getTodayBirthdays();
        setTodayBirthdays(birthdays);
      } catch (error) {
        console.error('Erreur lors de la récupération des anniversaires:', error);
      }
    };
    
    fetchBirthdays();
  }, []);

  if (checkingPrefs || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-800">
      <header className="bg-white dark:bg-dark-800 shadow-md transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <img 
                  src="/logo.svg" 
                  alt="Bus Connect Logo" 
                  className="h-8 w-auto"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/120x40?text=Bus+Connect';
                  }}
                />
                <span className="ml-2 px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] text-white uppercase">
                 v4 - Bêta
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4">
        <div className="mb-8">
            {user ? (
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{getGreeting()}, {user.user_metadata?.first_name || user.email.split('@')[0]} !</h1>
                    <p className="text-gray-500 dark:text-gray-400">Sélectionnez votre réseau pour continuer</p>
                </div>
            ) : (
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-700">
                <div className="text-center mb-4 text-sm text-gray-600 dark:text-gray-300">
                  Ajoutez vos réseaux, lignes de bus, vos arrêts en favoris en créant votre compte
                </div>
                <div className="flex space-x-3">
                  <Link 
                    to="/login" 
                    className="flex-1 w-full flex justify-center py-2 px-4 rounded-full text-sm font-medium text-white bg-green-500 hover:bg-green-600 focus:outline-none transform transition-all duration-150"
                  >
                    Se connecter
                  </Link>
                  <Link 
                    to="/register"
                    className="flex-1 w-full flex justify-center py-2 px-4 rounded-full text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none transform transition-all duration-150"
                  >
                    S'inscrire
                  </Link>
                </div>
              </div>
            )}
            
            {/* Affichage des anniversaires pour tous les utilisateurs */}
            {todayBirthdays.length > 0 && (
                <div className="mt-4" style={{ padding: '0 2px' }}>
                    <style>{marqueeStyle}</style>
                    <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-lg px-3 py-2 flex items-center w-full birthday-shimmer">
                        <FaBirthdayCake className="text-pink-500 text-lg mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300 break-words flex-1 text-center">
                            Bon anniversaire à {todayBirthdays.map((birthday, index) => (
                                <span key={birthday.id}>
                                    {formatBirthdayName(birthday.first_name, birthday.last_name)}
                                    {index < todayBirthdays.length - 1 && (index === todayBirthdays.length - 2 ? ' et ' : ', ')}
                                </span>
                            ))} !
                        </span>
                    </div>
                </div>
            )}
        </div>

        <div className="mb-8">
            <input
              type="text"
              placeholder="Rechercher un réseau..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 text-gray-800 dark:text-white"
            />
        </div>
        
        {user && filteredFavorites.length > 0 && (
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Mes favoris</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredFavorites.map(network => <NetworkCard key={network.network_id} network={network} onFavoriteClick={handleFavoriteClick} isFavorite={true} onCardClick={handleNetworkClick} />)}
                </div>
            </div>
        )}

        <div className="mb-4">
            <label htmlFor="region-filter" className="sr-only">Filtrer par région</label>
            <select id="region-filter" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 text-gray-800 dark:text-white">
                <option value="Tous">Toutes les régions</option>
                {regions.map(region => <option key={region} value={region}>{region}</option>)}
            </select>
        </div>

        {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => <SkeletonNetworkCard key={i} />)}
            </div>
        ) : (
            regionsToShow.map(region => (
                <div key={region} className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white flex items-center">
                        <span className="w-6 h-6 mr-2 flex-shrink-0">
                            <RegionLogo region={region} />
                        </span>
                        {region}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {networksByRegion[region]?.filter(n => availableNetworks.includes(n)).map(network => (
                            <NetworkCard key={network.network_id} network={network} onFavoriteClick={handleFavoriteClick} isFavorite={false} onCardClick={handleNetworkClick} />
                        ))}
                    </div>
                </div>
            ))
        )}
      </main>

      {/* Modal de confirmation pour retirer un réseau des favoris */}
      {showNetworkConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl transform transition-all">
            <div className="bg-gradient-to-r from-red-500 to-red-600 py-4 px-5">
              <div className="flex items-center">
                <svg className="h-7 w-7 text-white mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h3 className="text-xl font-semibold text-white">Supprimer des favoris</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 bg-red-50 dark:bg-red-900 rounded-full p-2 mr-3">
                  <svg className="h-6 w-6 text-red-500 dark:text-red-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-800 dark:text-white font-medium text-lg mb-1">
                    Attention
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    Ce réseau a <span className="font-semibold text-red-600 dark:text-red-400">{favoriteLinesCount}</span> ligne{favoriteLinesCount > 1 ? 's' : ''} en favoris.
                    <br />
                    Souhaitez-vous quand même le retirer de vos favoris ?
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  className="px-5 py-2.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                  onClick={() => {
                    setShowNetworkConfirmModal(false);
                    setNetworkToRemove(null);
                    setFavoriteLinesCount(0);
                  }}
                >
                  Annuler
                </button>
                <button
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center"
                  onClick={handleRemoveNetworkFavorite}
                >
                  <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Retirer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NetworkCard = ({ network, onFavoriteClick, isFavorite, onCardClick }) => (
    <div 
      onClick={() => onCardClick(network.network_id)} 
      className="p-px bg-gradient-to-r from-cyan-400 to-pink-500 rounded-lg cursor-pointer transition-all hover:shadow-lg relative"
    >
      {network.network_type && (
        <div className="absolute top-0 right-3 z-10" style={{ top: '-10px' }}>
          <div className="p-px bg-gradient-to-r from-cyan-400 to-pink-500 rounded-[5px] shadow">
            <div className="bg-white dark:bg-dark-800 rounded-[4px] px-2 py-px">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">{network.network_type}</span>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-dark-700 rounded-[7px] p-4 flex items-center gap-4 h-full">
          <NetworkLogo networkId={network.network_id} />
          <div className="flex-grow min-w-0">
              <h3 className="font-extrabold text-gray-800 dark:text-white truncate">{network.network_name}</h3>
              <TextMarquee text={network.agency_name || 'Agence non spécifiée'} className="text-sm text-gray-500 dark:text-gray-400" />
          </div>
          <button onClick={(e) => onFavoriteClick(e, network)} className="text-gray-400 hover:text-yellow-400">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isFavorite ? 'text-yellow-400' : ''}`} fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 9.42c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.95-.69L11.049 2.927z" />
              </svg>
          </button>
      </div>
    </div>
);

export default NetworkList; 