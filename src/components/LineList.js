import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { addFavoriteNetwork, addFavoriteLine, removeFavoriteLine, removeFavoriteNetwork } from '../services/favorites';
import { useAuth } from '../context/AuthContext';
import { getUserPreferences, updateUserPreferences } from '../services/auth';
import FavoriteButton from './FavoriteButton';
import NetworkLogo from './NetworkLogo';
import { getCachedData } from '../utils/supabaseCache';
import TextMarquee from './TextMarquee';
import AlertBanner from './AlertBanner';
import { getNetworkCode, getDisruptionsForNetwork, isDisruptionActive } from '../services/lineTrafficService';
import { PiWarningCircleFill } from "react-icons/pi";
import { FaMap } from "react-icons/fa";
import InteractiveMap from './InteractiveMap';

// Définir une couleur constante pour les favoris
const FAVORITE_COLOR = '#FFCA28'; // Jaune amber-400 cohérent

// Style pour l'animation des étoiles et le texte défilant
const additionalStyles = `
  @keyframes starPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  .star-pulse {
    animation: starPulse 0.5s ease-out;
  }
  
  .star-shadow {
    filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.7));
  }
  
  .marquee-container {
    width: 100%;
    overflow: hidden;
    position: relative;
  }
  
  .marquee-content {
    display: inline-flex;
    white-space: nowrap;
    animation: marqueeAnimation 20s linear infinite;
  }
  
  .marquee-content:hover {
    animation-play-state: paused;
  }
  
  @keyframes marqueeAnimation {
    from { transform: translateX(0%); }
    to { transform: translateX(-50%); }
  }
  
  .separator {
    margin: 0 8px;
    opacity: 0.6;
  }
  
  .fade-left, .fade-right {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 15px;
    z-index: 2;
    pointer-events: none;
  }
  
  .fade-left {
    left: 0;
    background: linear-gradient(to right, white, rgba(255, 255, 255, 0));
  }

  .dark .fade-left {
    background: linear-gradient(to right, #1e293b, rgba(30, 41, 59, 0));
  }
  
  .fade-right {
    right: 0;
    background: linear-gradient(to left, white, rgba(255, 255, 255, 0));
  }

  .dark .fade-right {
    background: linear-gradient(to left, #1e293b, rgba(30, 41, 59, 0));
  }
  
  .page-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #1e3a8a;
    margin-bottom: 0.3rem;
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
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
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
    left: 1.85rem;
    top: 50%;
    transform: translateY(-50%);
  }

  /* Bouton Plan Interactif stylé */
  .interactive-map-button {
    position: relative;
    width: 100%;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
    overflow: hidden;
    transform: translateY(0);
    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3);
  }

  .interactive-map-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 35px rgba(139, 92, 246, 0.4);
  }

  .interactive-map-button:active {
    transform: translateY(-1px);
    transition: all 0.1s ease;
  }

  .button-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%);
    border-radius: 16px;
    transition: all 0.3s ease;
  }

  .interactive-map-button:hover .button-background {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%);
    transform: scale(1.02);
  }

  .button-content {
    position: relative;
    display: flex;
    align-items: center;
    padding: 16px 20px;
    gap: 16px;
    z-index: 2;
  }

  .button-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .interactive-map-button:hover .button-icon {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .button-text-container {
    flex: 1;
    text-align: left;
    color: white;
  }

  .button-title {
    display: block;
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 4px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .button-subtitle {
    display: block;
    font-size: 0.875rem;
    opacity: 0.9;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  /* Dark mode */
  .dark .interactive-map-button {
    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.2);
  }

  .dark .interactive-map-button:hover {
    box-shadow: 0 12px 35px rgba(139, 92, 246, 0.3);
  }

  /* Badge Nouveau */
  .nouveau-badge {
    position: absolute;
    top: -8px;
    right: 12px;
    background: white;
    color: #374151;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  /* Dark mode */
  .dark .nouveau-badge {
    background: white;
    color: #1f2937;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .button-content {
      padding: 14px 16px;
      gap: 12px;
    }

    .button-icon {
      width: 40px;
      height: 40px;
    }

    .button-title {
      font-size: 1rem;
    }

    .button-subtitle {
      font-size: 0.8rem;
    }

    .nouveau-badge {
      top: -6px;
      right: 8px;
      padding: 3px 10px;
      font-size: 0.7rem;
    }
  }
`;

// Fonction pour assombrir une couleur hexadécimale
const darkenColor = (color) => {
  if (!color) return '6B7280';
  
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  
  const darkenAmount = 0.85;
  const darkenR = Math.floor(r * darkenAmount);
  const darkenG = Math.floor(g * darkenAmount);
  const darkenB = Math.floor(b * darkenAmount);
  
  return `${darkenR.toString(16).padStart(2, '0')}${darkenG.toString(16).padStart(2, '0')}${darkenB.toString(16).padStart(2, '0')}`;
};

// Fonction pour déterminer si le texte doit être blanc ou noir selon la luminosité du fond
const getContrastTextColor = (bgColor) => {
  if (!bgColor) return 'FFFFFF';
  
  const r = parseInt(bgColor.slice(0, 2), 16);
  const g = parseInt(bgColor.slice(2, 4), 16);
  const b = parseInt(bgColor.slice(4, 6), 16);
  
  // Calcul de la luminosité (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Si la luminosité est élevée (couleur claire), on retourne du texte noir, sinon blanc
  return luminance > 0.5 ? '000000' : 'FFFFFF';
};

const LineList = () => {
  const { networkId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [networkName, setNetworkName] = useState('');
  const [filteredLines, setFilteredLines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [networkLines, setNetworkLines] = useState([]);
  const [showNetworkConfirmModal, setShowNetworkConfirmModal] = useState(false);
  const [favoriteLinesCount, setFavoriteLinesCount] = useState(0);
  const [isNetworkFavorite, setIsNetworkFavorite] = useState(false);
  const [starAnimation, setStarAnimation] = useState(false);
  const [favoriteLines, setFavoriteLines] = useState([]);
  const [isDefaultNetwork, setIsDefaultNetwork] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [showCannotGoBackModal, setShowCannotGoBackModal] = useState(false);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [trafficDisruptions, setTrafficDisruptions] = useState([]);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);

  // Mettre à jour le titre de la page avec le nom du réseau
  useEffect(() => {
    if (networkName) {
      document.title = `Bus Connect - Réseau de bus ${networkName}`;
    } else {
      document.title = "Bus Connect - Réseau de bus";
    }
  }, [networkName]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch network name using cache
        const networkData = await getCachedData(
          `network-${networkId}`,
          async () => {
            const { data, error } = await supabase
              .from('networks')
              .select('network_name')
              .eq('network_id', networkId)
              .single();
            if (error) throw error;
            return data;
          }
        );
        setNetworkName(networkData.network_name);

        // Fetch traffic disruptions
        const networkCode = await getNetworkCode(networkId);
        if (networkCode) {
          const disruptions = await getDisruptionsForNetwork(networkCode);
          const activeDisruptions = disruptions.filter(isDisruptionActive);
          setTrafficDisruptions(activeDisruptions);
        }

        // Fetch all lines
        const { data: linesData, error: linesError } = await supabase
          .from('routes')
          .select('*')
          .eq('network_id', networkId);

        if (linesError) throw linesError;
        
        linesData.sort((a, b) => {
          // D'abord vérifier display_order
          if (a.display_order != null && b.display_order != null) {
            if (a.display_order < b.display_order) return -1;
            if (a.display_order > b.display_order) return 1;
          } else if (a.display_order != null) {
            return -1;
          } else if (b.display_order != null) {
            return 1;
          }

          // Ensuite vérifier route_sort_order si display_order est NULL
          if (a.route_sort_order != null && b.route_sort_order != null) {
            if (a.route_sort_order < b.route_sort_order) return -1;
            if (a.route_sort_order > b.route_sort_order) return 1;
          } else if (a.route_sort_order != null) {
            return -1;
          } else if (b.route_sort_order != null) {
            return 1;
          }

          // Enfin, utiliser route_short_name comme fallback
          return String(a.route_short_name).localeCompare(String(b.route_short_name), undefined, { numeric: true, sensitivity: 'base' });
        });

        setLines(linesData);
        setFilteredLines(linesData);
        setLoading(false);

        // Check if network is favorite and user preferences
        if (user) {
          setPreferencesLoading(true);
          // Fetch user preferences
          const prefs = await getUserPreferences();
          if (prefs && prefs.default_network_id === networkId) {
            setIsDefaultNetwork(true);
          } else {
            setIsDefaultNetwork(false);
          }
          setPreferencesLoading(false);

          const { data: favoriteNetwork, error: favoriteNetworkError } = await supabase
            .from('favorite_networks')
            .select('*')
            .eq('user_id', user.id)
            .eq('network_id', networkId);

          if (!favoriteNetworkError && favoriteNetwork && favoriteNetwork.length > 0) {
            setIsNetworkFavorite(true);
          }

          // Récupérer les lignes favorites pour ce réseau
          const { data: favoriteLines, error: favoriteLinesError } = await supabase
            .from('favorite_lines')
            .select('*')
            .eq('user_id', user.id)
            .eq('network_id', networkId);

          if (!favoriteLinesError && favoriteLines) {
            setFavoriteLinesCount(favoriteLines.length);
            
            // Identifier les lignes favorites dans la liste complète des lignes
            const favoriteLineIds = favoriteLines.map(fav => fav.line_id);
            const userFavoriteLines = linesData.filter(line => 
              favoriteLineIds.includes(line.route_id)
            );
            setFavoriteLines(userFavoriteLines);
            
            // Marquer les lignes favorites dans la liste complète
            const updatedLines = linesData.map(line => ({
              ...line,
              is_favorite: favoriteLineIds.includes(line.route_id)
            }));
            setLines(updatedLines);
            setFilteredLines(updatedLines);
          }
        } else {
          // Si l'utilisateur n'est pas connecté, terminer le chargement des préférences
          setPreferencesLoading(false);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setPreferencesLoading(false);
      }
    };

    fetchData();
  }, [networkId, user]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      // Trier les lignes : d'abord les lignes actives (etat = 1), puis les lignes désactivées (etat = 0)
      const sortedLines = [...lines].sort((a, b) => {
        // D'abord trier par état (1 avant 0)
        if (a.etat !== b.etat) {
          return b.etat - a.etat;
        }
        // Ensuite, appliquer le tri existant pour les lignes de même état
        if (a.display_order != null && b.display_order != null) {
          if (a.display_order < b.display_order) return -1;
          if (a.display_order > b.display_order) return 1;
        } else if (a.display_order != null) {
          return -1;
        } else if (b.display_order != null) {
          return 1;
        }

        // Vérifier route_sort_order si display_order est NULL
        if (a.route_sort_order != null && b.route_sort_order != null) {
          if (a.route_sort_order < b.route_sort_order) return -1;
          if (a.route_sort_order > b.route_sort_order) return 1;
        } else if (a.route_sort_order != null) {
          return -1;
        } else if (b.route_sort_order != null) {
          return 1;
        }

        return String(a.route_short_name).localeCompare(String(b.route_short_name), undefined, { numeric: true, sensitivity: 'base' });
      });
      setFilteredLines(sortedLines);
    } else {
      const filtered = lines.filter(line => 
        line.route_short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        line.route_long_name.toLowerCase().includes(searchTerm.toLowerCase())
      ).sort((a, b) => {
        // Maintenir le tri par état même dans les résultats de recherche
        if (a.etat !== b.etat) {
          return b.etat - a.etat;
        }
        return 0;
      });
      setFilteredLines(filtered);
    }
  }, [searchTerm, lines]);

  const handleSetDefaultNetwork = async () => {
    if (!user || preferencesLoading) return;

    try {
      await updateUserPreferences({ default_network_id: networkId });
      setIsDefaultNetwork(true);
      
      // Montrer le modal d'information la première fois
      const hasSeenModal = localStorage.getItem('defaultNetworkModalSeen');
      if (!hasSeenModal) {
        setShowFirstTimeModal(true);
        localStorage.setItem('defaultNetworkModalSeen', 'true');
      }
      
      // Émettre un événement pour notifier que le réseau par défaut a changé
      window.dispatchEvent(new Event('defaultNetworkChanged'));
    } catch (error) {
      console.error("Erreur lors de la définition du réseau par défaut:", error);
    }
  };

  const handleRemoveDefaultNetwork = async () => {
    if (!user || preferencesLoading) return;

    try {
      await updateUserPreferences({ default_network_id: null });
      setIsDefaultNetwork(false);
      
      // Émettre un événement pour notifier que le réseau par défaut a été supprimé
      window.dispatchEvent(new Event('defaultNetworkChanged'));
    } catch (error) {
      console.error("Erreur lors de la suppression du réseau par défaut:", error);
    }
  };

  const handleBackLinkClick = (e) => {
    if (isDefaultNetwork) {
      e.preventDefault();
      setShowCannotGoBackModal(true);
    }
  };

  const handleDefaultNetworkClickNotLoggedIn = () => {
    setShowLoginRequiredModal(true);
  };

  const handleLineClick = async (lineId, etat) => {
    // Si la ligne est désactivée, ne rien faire
    if (etat === 0) return;

    try {
      // Vérifier le nombre de directions pour cette ligne
      const { data: directionsData, error: directionsError } = await supabase.rpc(
        'get_route_directions',
        {
          route_id_param: lineId,
          network_id_param: networkId
        }
      );

      if (directionsError) throw directionsError;

      // Si la ligne a exactement une direction, rediriger directement vers les horaires
      if (directionsData && directionsData.length === 1) {
        const directionId = directionsData[0].direction_id;
        navigate(`/network/${networkId}/line/${lineId}/direction/${directionId}/timetable`);
      } else {
        // Sinon, aller vers la page des directions
        navigate(`/network/${networkId}/line/${lineId}/directions`);
      }
    } catch (err) {
      console.error("Erreur lors de la vérification des directions:", err);
      // En cas d'erreur, naviguer vers la page des directions par défaut
      navigate(`/network/${networkId}/line/${lineId}/directions`);
    }
  };

  const handleFavoriteClick = async (e, line) => {
    e.stopPropagation();
    
    // Si la ligne est désactivée, ne pas permettre l'ajout aux favoris
    if (line.etat === 0) {
      return;
    }
    
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      // Vérifier si la ligne est déjà en favoris
      const { data: lineData, error: lineError } = await supabase
        .from('favorite_lines')
        .select('*')
        .eq('user_id', user.id)
        .eq('network_id', networkId)
        .eq('line_id', line.route_id);

      if (lineError) throw lineError;
      
      if (lineData && lineData.length > 0) {
        // Si la ligne est en favoris, on la supprime
        await removeFavoriteLine(networkId, line.route_id);
        
        // Mettre à jour le compteur de lignes favorites
        setFavoriteLinesCount(prev => Math.max(0, prev - 1));
        
        // Mettre à jour la liste des lignes favorites
        setFavoriteLines(prevFavorites => 
          prevFavorites.filter(fav => fav.route_id !== line.route_id)
        );
        
        // Vérifier s'il reste des lignes favorites pour ce réseau
        const { count, error: countError } = await supabase
          .from('favorite_lines')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('network_id', networkId);
          
        if (!countError && count === 0) {
          // S'il n'y a plus de lignes favorites, mettre à jour le statut du réseau
          setIsNetworkFavorite(false);
        }
      } else {
        // Si la ligne n'est pas en favoris, on vérifie d'abord si le réseau est en favoris
        const { data: networkData, error: networkError } = await supabase
          .from('favorite_networks')
          .select('*')
          .eq('user_id', user.id)
          .eq('network_id', networkId);

        if (networkError) throw networkError;

        // Si le réseau n'est pas en favoris, on l'ajoute
        if (!networkData || networkData.length === 0) {
          await addFavoriteNetwork(networkId);
          setIsNetworkFavorite(true);
          
          // Animation de l'étoile
          setStarAnimation(true);
          setTimeout(() => setStarAnimation(false), 600);
        }

        // Puis on ajoute la ligne
        await addFavoriteLine({
          networkId,
          lineId: line.route_id,
          lineName: line.route_short_name,
          lineColor: line.route_color,
          lineLongName: line.route_long_name,
          lineTextColor: line.route_text_color
        });
        
        // Mettre à jour le compteur de lignes favorites
        setFavoriteLinesCount(prev => prev + 1);
        
        // Ajouter la ligne à la liste des favoris
        setFavoriteLines(prevFavorites => [...prevFavorites, line]);
        
        // Animation de l'étoile si elle n'est pas déjà animée
        if (!starAnimation) {
          setStarAnimation(true);
          setTimeout(() => setStarAnimation(false), 600);
        }
      }
      
      // Mettre à jour l'état local de la ligne
      setLines(prevLines => 
        prevLines.map(l => 
          l.route_id === line.route_id 
            ? { ...l, is_favorite: !l.is_favorite } 
            : l
        )
      );

      // Mettre à jour les lignes filtrées également
      setFilteredLines(prevFiltered => 
        prevFiltered.map(l => 
          l.route_id === line.route_id 
            ? { ...l, is_favorite: !l.is_favorite } 
            : l
        )
      );
    } catch (error) {
      console.error('Erreur lors de la modification des favoris:', error);
    }
  };

  const handleToggleNetworkFavorite = async (e) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      if (isNetworkFavorite) {
        // Si le réseau est en favoris et qu'il n'y a plus de lignes favorites,
        // on demande confirmation avant de supprimer le réseau des favoris
        if (favoriteLinesCount > 0) {
          setShowNetworkConfirmModal(true);
        } else {
          await handleRemoveNetworkFavorite();
        }
      } else {
        await addFavoriteNetwork(networkId);
        setIsNetworkFavorite(true);
        setStarAnimation(true);
        setTimeout(() => setStarAnimation(false), 600);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour des favoris du réseau', error);
    }
  };

  const handleRemoveNetworkFavorite = async () => {
    try {
      await removeFavoriteNetwork(networkId);
      setIsNetworkFavorite(false);
      setShowNetworkConfirmModal(false);
      
      // Réinitialiser les lignes favorites et le compteur
      setFavoriteLines([]);
      setFavoriteLinesCount(0);
      
      // Mettre à jour l'état des lignes pour refléter que plus aucune n'est favorite
      setLines(prevLines => 
        prevLines.map(line => ({ ...line, is_favorite: false }))
      );
      setFilteredLines(prevFiltered => 
        prevFiltered.map(line => ({ ...line, is_favorite: false }))
      );
    } catch (error) {
      console.error("Erreur lors de la suppression du réseau des favoris", error);
    }
  };

  // Filtrer les favoris en fonction de la recherche
  const filteredFavoriteLines = searchTerm.trim() === '' 
    ? favoriteLines 
    : favoriteLines.filter(line => 
        line.route_short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        line.route_long_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Composant de placeholder animé
  const LinePlaceholder = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const lightGradient = 'linear-gradient(90deg, #e0e0e0 25%, #d0d0d0 50%, #e0e0e0 75%)';
    const darkGradient = 'linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%)';
    const lightGradientSoft = 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)';
    const darkGradientSoft = 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)';
    
    return (
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm transition-all duration-200 overflow-hidden border border-gray-100 dark:border-dark-700">
        <div className="flex items-center p-2 sm:p-3">
          <div className="flex-shrink-0">
            <div 
              className="w-20 h-10 sm:w-24 sm:h-10 rounded-[8px] overflow-hidden"
              style={{
                background: isDark ? darkGradient : lightGradient,
                backgroundSize: '200% 100%',
                animation: 'wave 1.5s infinite linear'
              }}
            />
          </div>
          <div className="ml-3 sm:ml-4 flex-grow min-w-0 mr-2">
            <div className="flex flex-col">
              <div 
                className="h-3 w-12 rounded mb-2"
                style={{
                  background: isDark ? darkGradientSoft : lightGradientSoft,
                  backgroundSize: '200% 100%',
                  animation: 'wave 1.5s infinite linear'
                }}
              />
              <div 
                className="h-4 w-48 rounded"
                style={{
                  background: isDark ? darkGradientSoft : lightGradientSoft,
                  backgroundSize: '200% 100%',
                  animation: 'wave 1.5s infinite linear'
                }}
              />
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center space-x-1 sm:space-x-2">
            <div 
              className="w-8 h-8 rounded-full"
              style={{
                background: isDark ? darkGradientSoft : lightGradientSoft,
                backgroundSize: '200% 100%',
                animation: 'wave 1.5s infinite linear'
              }}
            />
            <div 
              className="w-6 h-6 rounded"
              style={{
                background: isDark ? darkGradientSoft : lightGradientSoft,
                backgroundSize: '200% 100%',
                animation: 'wave 1.5s infinite linear'
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const isLineDisrupted = (line) => {
    if (trafficDisruptions.length === 0) return false;
    return trafficDisruptions.some(disruption =>
      disruption.affectedLines?.some(affectedLine =>
        affectedLine.number === line.route_short_name || affectedLine.code === line.route_short_name
      )
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
      <style>
        {`
          @keyframes wave {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      {/* Header skeleton */}
      <div className="bg-white dark:bg-dark-800 shadow-sm relative transition-colors duration-200">
        <div className="absolute top-0 left-0 z-10">
          <div className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-dark-700 rounded-br-full"></div>
        </div>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <div className="w-full h-24 flex items-center justify-center">
              <div 
                className="w-[126px] h-[90px] rounded"
                style={{
                  background: document.documentElement.classList.contains('dark') 
                    ? 'linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%)'
                    : 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'wave 1.5s infinite linear'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="bg-white dark:bg-dark-800 border-b border-gray-100 dark:border-dark-700 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3">
          <div 
            className="h-12 rounded-full"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)'
                : 'linear-gradient(90deg, #f8fafc 25%, #f3f4f6 50%, #f8fafc 75%)',
              backgroundSize: '200% 100%',
              animation: 'wave 1.5s infinite linear'
            }}
          />
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="max-w-7xl mx-auto py-3 sm:py-6 px-3 sm:px-6 lg:px-8 mb-16 sm:mb-0">
        <div className="space-y-3">
          {/* Générer entre 8 et 12 placeholders aléatoirement */}
          {[...Array(Math.floor(Math.random() * 5) + 8)].map((_, index) => (
            <LinePlaceholder key={index} />
          ))}
        </div>
      </main>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-red-50 p-6 rounded-lg shadow-sm border border-red-200 max-w-lg">
        <div className="flex items-center">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="ml-2 text-lg font-semibold text-red-800">Erreur</h3>
        </div>
        <p className="mt-2 text-red-700">{error}</p>
        <Link to="/" className="mt-4 inline-flex items-center text-red-600 hover:text-red-800">
          <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
      <AlertBanner networkId={networkId} />
      <style>{additionalStyles}</style>

      {/* Header */}
      <header className="bg-white dark:bg-dark-800 shadow-sm sticky top-0 z-30">
        <div className="absolute top-0 left-0 z-10">
          <Link 
            to="/" 
            state={{ bypassRedirect: true }} 
            onClick={handleBackLinkClick}
            className={`flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-dark-700 rounded-br-full relative transition-colors ${
              isDefaultNetwork 
                ? 'cursor-not-allowed' 
                : 'hover:bg-gray-100 dark:hover:bg-dark-600'
            }`}
            aria-disabled={isDefaultNetwork}
          >
            <div className="absolute transform -translate-x-2 -translate-y-2">
              <svg 
                className={`h-7 w-7 ${
                  isDefaultNetwork 
                    ? 'text-gray-300 dark:text-gray-600' 
                    : 'text-gray-700 dark:text-gray-300'
                }`} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-center h-20">
            {/* Network Logo */}
            <div className="flex-grow flex justify-center">
                <NetworkLogo networkId={networkId} size="xl" />
            </div>

            {/* Favorite Button */}
            {user && (
              <div className="absolute right-0">
                <div
                  className={`cursor-pointer p-2 ${starAnimation ? 'star-pulse' : ''}`}
                  onClick={handleToggleNetworkFavorite}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={isNetworkFavorite ? '#FFCA28' : 'none'}
                    stroke={isNetworkFavorite ? 'none' : '#9ca3af'}
                    strokeWidth="2"
                    className={`w-8 h-8 transition-colors duration-200 ${isNetworkFavorite ? 'star-shadow' : ''}`}
                    title={isNetworkFavorite ? "Retirer le réseau des favoris" : "Ajouter le réseau aux favoris"}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.32 1.011l-4.204 3.604a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.604a.563.563 0 01.32-1.011l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

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
                  onClick={() => setShowNetworkConfirmModal(false)}
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

      {/* Modal "Cannot Go Back" */}
      {showCannotGoBackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl transform transition-all">
            <div className="p-6 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-300" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-4">Action impossible</h3>
                <div className="mt-2 px-7 py-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Vous devez enlever ce réseau par défaut avant de pouvoir en sélectionner un autre.
                    </p>
                </div>
                <div className="mt-4">
                    <button
                        onClick={() => setShowCannotGoBackModal(false)}
                        className="w-full px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
                    >
                        Compris
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'information "Première fois" */}
      {showFirstTimeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl transform transition-all">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-300" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-4">Réseau par défaut enregistré !</h3>
              <div className="mt-2 px-4 py-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                      Vous avez ajouté le réseau <span className="font-bold">{networkName}</span> par défaut.
                      <br/><br/>
                      Même si vous fermez l'application, vous serez automatiquement redirigé ici. Pour changer de réseau, cliquez simplement sur <span className="font-semibold text-red-600">"Retirer ce réseau par défaut"</span>.
                  </p>
              </div>
              <div className="mt-4">
                  <button
                      onClick={() => setShowFirstTimeModal(false)}
                      className="w-full px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
                  >
                      Compris
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de connexion requise */}
      {showLoginRequiredModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl transform transition-all">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 py-4 px-5">
              <div className="flex items-center">
                <svg className="h-7 w-7 text-white mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                </svg>
                <h3 className="text-xl font-semibold text-white">Connexion requise</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900 rounded-full p-2 mr-3">
                  <svg className="h-6 w-6 text-blue-500 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-800 dark:text-white font-medium text-lg mb-1">
                    Fonctionnalité réservée aux membres
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    Connectez-vous pour définir <span className="font-semibold">{networkName}</span> comme votre réseau par défaut.
                    <br/><br/>
                    Cette fonctionnalité vous permet d'accéder directement à ce réseau à chaque ouverture de l'application, même après l'avoir fermée.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  className="px-5 py-2.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                  onClick={() => setShowLoginRequiredModal(false)}
                >
                  Annuler
                </button>
                <button
                  className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  onClick={() => navigate('/login')}
                >
                  <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Se connecter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search bar avec un style amélioré */}
      <div className="bg-white dark:bg-dark-800 border-b border-gray-100 dark:border-dark-700 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3">
          <div className="search-container relative">
            <div className="search-icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="url(#search-gradient)">
                <defs>
                  <linearGradient id="search-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#07d6fb" />
                    <stop offset="100%" stopColor="#ff66c4" />
                  </linearGradient>
                </defs>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Rechercher une ligne sur le réseau ${networkName}`}
              className="search-input dark:bg-dark-700 dark:text-white dark:placeholder-gray-400"
            />
            {searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                >
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 00-1.414-1.414L10 10l-1.293-1.293a1 1 0 00-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-3 sm:py-6 px-3 sm:px-6 lg:px-8 mb-16 sm:mb-0">
        {!preferencesLoading && (
          <div className="mb-4">
            {user ? (
              // Utilisateur connecté
              isDefaultNetwork ? (
                <button 
                  onClick={handleRemoveDefaultNetwork}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold shadow"
                >
                  <span>Retirer ce réseau par défaut</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <button 
                  onClick={handleSetDefaultNetwork}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold shadow"
                >
                  <span>Ajouter ce réseau par défaut</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )
            ) : (
              // Utilisateur non connecté
              <button 
                onClick={handleDefaultNetworkClickNotLoggedIn}
                className="w-full flex items-center justify-between px-4 py-2 text-sm bg-gray-400 text-gray-200 rounded-lg cursor-pointer transition-colors font-bold shadow opacity-70"
              >
                <span>Ajouter ce réseau par défaut</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Bouton Plan Interactif */}
        <div className="mb-6 relative">
          <button 
            onClick={() => setShowInteractiveMap(true)}
            className="interactive-map-button"
          >
            <div className="button-background"></div>
            <div className="button-content">
              <div className="button-icon">
                <FaMap size={20} />
              </div>
              <div className="button-text-container">
                <span className="button-title">Plan Interactif</span>
                <span className="button-subtitle">Bus en temps réel + géolocalisation</span>
              </div>
            </div>
          </button>
          <div className="nouveau-badge">
            <span>Nouveau</span>
          </div>
        </div>

        {filteredLines.length === 0 ? (
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6 text-center transition-colors duration-200">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aucune ligne trouvée</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Essayez avec un autre terme de recherche.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section des lignes favorites */}
            {user && filteredFavoriteLines.length > 0 && (
              <div>
                <h2 className="page-title text-gradient">Vos lignes favorites</h2>
                <hr className="gradient-hr" />
                <div className="grid grid-cols-1 gap-3">
                  {filteredFavoriteLines.map((line) => {
                    const backgroundColor = darkenColor(line.route_color);
                    const textColor = getContrastTextColor(backgroundColor);
                    const isDisabled = line.etat === 0;
                    
                    return (
                      <div
                        key={`fav-${line.route_id}`}
                        onClick={() => handleLineClick(line.route_id, line.etat)}
                        className={`block ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className={`bg-white dark:bg-dark-800 rounded-lg shadow-sm transition-all duration-200 overflow-hidden border border-gray-100 dark:border-dark-700 ${isDisabled ? 'opacity-50' : 'hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500'}`}>
                          <div className="flex items-center p-2 sm:p-3">
                            <div className="flex-shrink-0">
                              <div 
                                className="w-20 h-10 sm:w-24 sm:h-10 rounded-[8px] flex items-center justify-center text-white font-bold text-sm sm:text-base px-1"
                                style={{
                                  backgroundColor: `#${backgroundColor}`,
                                  color: `#${textColor}`,
                                  position: 'relative'
                                }}
                              >
                                <span className="truncate max-w-full font-naotypo-bold">{line.route_short_name}</span>
                                {isLineDisrupted(line) && (
                                  <div 
                                    style={{
                                      position: 'absolute',
                                      top: '-6px',
                                      right: '-6px',
                                      width: '22px',
                                      height: '22px',
                                      backgroundColor: 'white',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 10
                                    }}
                                    title="Cette ligne est actuellement perturbée"
                                  >
                                    <PiWarningCircleFill 
                                      style={{
                                        color: '#ef4444',
                                        fontSize: '18px'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="ml-3 sm:ml-4 flex-grow min-w-0 mr-2">
                              <div className="flex flex-col">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Ligne</p>
                                <TextMarquee text={line.route_long_name || line.route_short_name} />
                                {isDisabled && (
                                  <p className="text-xs text-red-500 mt-1">Ligne temporairement désactivée</p>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center space-x-1 sm:space-x-2">
                              <FavoriteButton
                                type="line"
                                item={{
                                  networkId: networkId,
                                  lineId: line.route_id,
                                  lineName: line.route_short_name,
                                  lineColor: line.route_color,
                                  lineLongName: line.route_long_name,
                                  lineTextColor: textColor
                                }}
                                onClick={(e) => handleFavoriteClick(e, line)}
                                disabled={line.etat === 0}
                                className={line.etat === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                              />
                              <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Liste principale des lignes - excluant celles des favoris */}
            <div>
              {user && filteredFavoriteLines.length > 0 && (
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                  Toutes les lignes ({networkName})
                </h2>
              )}
              <div className="grid grid-cols-1 gap-3">
                {filteredLines
                  .filter(line => !favoriteLines.some(fav => fav.route_id === line.route_id) || searchTerm.trim() !== '')
                  .map((line) => {
                    const backgroundColor = darkenColor(line.route_color);
                    const textColor = getContrastTextColor(backgroundColor);
                    const isDisabled = line.etat === 0;
                    
                    return (
                      <div
                        key={line.route_id}
                        onClick={() => handleLineClick(line.route_id, line.etat)}
                        className={`block ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className={`bg-white dark:bg-dark-800 rounded-lg shadow-sm transition-all duration-200 overflow-hidden border border-gray-100 dark:border-dark-700 ${isDisabled ? 'opacity-50' : 'hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500'}`}>
                          <div className="flex items-center p-2 sm:p-3">
                            <div className="flex-shrink-0">
                              <div 
                                className="w-20 h-10 sm:w-24 sm:h-10 rounded-[8px] flex items-center justify-center text-white font-bold text-sm sm:text-base px-1"
                                style={{
                                  backgroundColor: `#${backgroundColor}`,
                                  color: `#${textColor}`,
                                  position: 'relative'
                                }}
                              >
                                <span className="truncate max-w-full font-naotypo-bold">{line.route_short_name}</span>
                                {isLineDisrupted(line) && (
                                  <div 
                                    style={{
                                      position: 'absolute',
                                      top: '-6px',
                                      right: '-6px',
                                      width: '22px',
                                      height: '22px',
                                      backgroundColor: 'white',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 10
                                    }}
                                    title="Cette ligne est actuellement perturbée"
                                  >
                                    <PiWarningCircleFill 
                                      style={{
                                        color: '#ef4444',
                                        fontSize: '18px'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="ml-3 sm:ml-4 flex-grow min-w-0 mr-2">
                              <div className="flex flex-col">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Ligne</p>
                                <TextMarquee text={line.route_long_name || line.route_short_name} />
                                {isDisabled && (
                                  <p className="text-xs text-red-500 mt-1">Ligne temporairement désactivée</p>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center space-x-1 sm:space-x-2">
                              <FavoriteButton
                                type="line"
                                item={{
                                  networkId: networkId,
                                  lineId: line.route_id,
                                  lineName: line.route_short_name,
                                  lineColor: line.route_color,
                                  lineLongName: line.route_long_name,
                                  lineTextColor: textColor
                                }}
                                onClick={(e) => handleFavoriteClick(e, line)}
                                disabled={line.etat === 0}
                                className={line.etat === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                              />
                              <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Composant Interactive Map */}
      <InteractiveMap 
        isOpen={showInteractiveMap}
        onClose={() => setShowInteractiveMap(false)}
        networkId={networkId}
        networkName={networkName}
        lines={lines}
      />
    </div>
  );
};

export default LineList; 