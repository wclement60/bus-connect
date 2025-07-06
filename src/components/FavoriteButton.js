import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import {
  addFavoriteNetwork, removeFavoriteNetwork,
  addFavoriteLine, removeFavoriteLine,
  addFavoriteStop, removeFavoriteStop
} from '../services/favorites';

// Fonction pour assombrir une couleur hexadécimale
const darkenColor = (color) => {
  // Si pas de couleur, retourne la couleur par défaut
  if (!color) return '6B7280';
  
  // Convertir la couleur hex en RGB
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  
  // Assombrir de 15%
  const darkenAmount = 0.85;
  const darkenR = Math.floor(r * darkenAmount);
  const darkenG = Math.floor(g * darkenAmount);
  const darkenB = Math.floor(b * darkenAmount);
  
  // Convertir en hex et retourner
  return `${darkenR.toString(16).padStart(2, '0')}${darkenG.toString(16).padStart(2, '0')}${darkenB.toString(16).padStart(2, '0')}`;
};

/**
 * Bouton pour ajouter/supprimer un élément des favoris
 * @param {Object} props - Propriétés du composant
 * @param {string} props.type - Type d'élément ('network', 'line', 'stop')
 * @param {Object} props.item - Données de l'élément à marquer comme favori
 * @param {string} props.item.networkId - ID du réseau
 * @param {string} props.item.lineId - ID de la ligne (pour type='line')
 * @param {string} props.item.lineName - Nom de la ligne (pour type='line')
 * @param {string} props.item.lineColor - Couleur de la ligne (pour type='line')
 * @param {string} props.item.lineLongName - Nom long de la ligne (pour type='line')
 * @param {string} props.item.stopId - ID de l'arrêt (pour type='stop')
 * @param {string} props.item.stopName - Nom de l'arrêt (pour type='stop')
 * @param {number} props.item.stopLat - Latitude de l'arrêt (pour type='stop')
 * @param {number} props.item.stopLon - Longitude de l'arrêt (pour type='stop')
 * @param {string} [props.size='normal'] - Taille du bouton ('small', 'normal', 'large')
 * @param {string} [props.className=''] - Classes CSS supplémentaires
 * @returns {JSX.Element} Bouton favori
 */
const FavoriteButton = ({ type, item, size = 'normal', className = '', onClick }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Déterminer les tailles en fonction du paramètre size
  const sizeClasses = {
    small: 'w-6 h-6',
    normal: 'w-8 h-8',
    large: 'w-10 h-10'
  };

  // Vérifier si l'élément est déjà en favori au chargement
  useEffect(() => {
    if (user && item) {
      checkFavoriteStatus();
    }
  }, [user, type, item]);

  const checkFavoriteStatus = async () => {
    if (!user || !item) return;

    try {
      let data = null;
      let error = null;

      if (type === 'network') {
        const result = await supabase
          .from('favorite_networks')
          .select('*')
          .eq('user_id', user.id)
          .eq('network_id', item.networkId);
        data = result.data;
        error = result.error;
      } else if (type === 'line') {
        const result = await supabase
          .from('favorite_lines')
          .select('*')
          .eq('user_id', user.id)
          .eq('network_id', item.networkId)
          .eq('line_id', item.lineId);
        data = result.data;
        error = result.error;
      } else if (type === 'stop') {
        const result = await supabase
          .from('favorite_stops')
          .select('*')
          .eq('user_id', user.id)
          .eq('network_id', item.networkId)
          .eq('stop_id', item.stopId);
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setIsFavorite(data && data.length > 0);
    } catch (error) {
      console.error('Erreur lors de la vérification du statut favori:', error);
    }
  };

  // Gérer le clic sur le bouton favori
  const handleToggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onClick) {
      onClick(e);
      return;
    }

    if (!user) {
      toast.info('Vous devez être connecté pour ajouter aux favoris');
      setShowLoginPrompt(true);
      setTimeout(() => setShowLoginPrompt(false), 3000);
      return;
    }

    if (!item) return;
    
    setIsLoading(true);

    try {
      if (type === 'network') {
        // Avant de retirer un réseau, vérifier s'il y a des lignes en favoris
        if (isFavorite) {
          const result = await supabase
            .from('favorite_lines')
            .select('*')
            .eq('user_id', user.id)
            .eq('network_id', item.networkId);
            
          if (result.error) throw result.error;
          
          const lines = result.data || [];
          
          if (lines.length > 0) {
            toast.warning(`Ce réseau a ${lines.length} ligne(s) en favoris. Veuillez d'abord retirer ces lignes des favoris.`);
            setIsLoading(false);
            return;
          }
          
          await removeFavoriteNetwork(item.networkId);
          toast.success('Réseau retiré des favoris');
        } else {
          await addFavoriteNetwork(item.networkId);
          toast.success('Réseau ajouté aux favoris');
        }
      } else if (type === 'line') {
        if (isFavorite) {
          await removeFavoriteLine(item.networkId, item.lineId);
          toast.success('Ligne retirée des favoris');
        } else {
          // Vérifier si le réseau est déjà en favoris
          const result = await supabase
            .from('favorite_networks')
            .select('*')
            .eq('user_id', user.id)
            .eq('network_id', item.networkId);

          if (result.error) throw result.error;
          
          const networkData = result.data || [];

          // Si le réseau n'est pas en favoris, l'ajouter d'abord
          if (networkData.length === 0) {
            await addFavoriteNetwork(item.networkId);
          }

          // Puis ajouter la ligne
          await addFavoriteLine({
            networkId: item.networkId,
            lineId: item.lineId,
            lineName: item.lineName,
            lineColor: item.lineColor,
            lineLongName: item.lineLongName,
            lineTextColor: item.lineTextColor
          });
          toast.success('Ligne ajoutée aux favoris');
        }
      } else if (type === 'stop') {
        if (isFavorite) {
          await removeFavoriteStop(item.networkId, item.stopId);
          toast.success('Arrêt retiré des favoris');
        } else {
          await addFavoriteStop({
            networkId: item.networkId,
            stopId: item.stopId,
            stopName: item.stopName,
            stopLat: item.stopLat,
            stopLon: item.stopLon
          });
          toast.success('Arrêt ajouté aux favoris');
        }
      }

      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Erreur lors de la modification des favoris:', error);
      toast.error('Erreur lors de la modification des favoris');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggleFavorite}
        disabled={isLoading}
        className={`${sizeClasses[size]} ${className} rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
          isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-500'
        }`}
        aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg 
            className={sizeClasses[size] || sizeClasses.normal}
            xmlns="http://www.w3.org/2000/svg" 
            fill={isFavorite ? "currentColor" : "none"} 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={isFavorite ? 0 : 2} 
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" 
            />
          </svg>
        )}
      </button>

      {showLoginPrompt && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-black bg-opacity-30" onClick={() => setShowLoginPrompt(false)}></div>
          <div className="bg-white p-6 rounded-lg shadow-xl z-10 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connexion requise</h3>
            <p className="text-gray-600 mb-4">Vous devez être connecté pour ajouter aux favoris</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowLoginPrompt(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Se connecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoriteButton; 