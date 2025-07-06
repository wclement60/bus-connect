import React, { useState, useEffect } from 'react';
import { 
  MdError as AlertCircle, 
  MdAccessTime as Clock, 
  MdLocationOn as MapPin, 
  MdCalendarToday as Calendar, 
  MdKeyboardArrowDown as ChevronDown, 
  MdKeyboardArrowUp as ChevronUp, 
  MdDownload as Download, 
  MdSearch as Search, 
  MdClose as X,
  MdPublic as GlobalIcon,
  MdDirectionsBus as BusIcon,
  MdAttachFile as AttachIcon,
  MdCheckCircle as CheckIcon,
  MdDirectionsTransit as TransitIcon,
  MdLocalTaxi as TaxiIcon,
  MdTrain as TrainIcon,
  MdTram as TramIcon,
  MdInfo as InfoIcon,
  MdWarning as WarningIcon
} from 'react-icons/md';
import { FaBus } from "react-icons/fa";
import { IoMdInformationCircle } from "react-icons/io";
import { 
  getDisruptions, 
  formatDate, 
  getSeverityColor, 
  groupDisruptionsByNetwork,
  filterDisruptions
} from '../services/trafficService';
import LoadingSpinner from '../components/LoadingSpinner';
import { getSafeLineColors, darkenColor } from '../utils/colorUtils';

const TrafficInfo = () => {
  const [disruptions, setDisruptions] = useState([]);
  const [groupedDisruptions, setGroupedDisruptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [canShowEmptyState, setCanShowEmptyState] = useState(false);
  const [error, setError] = useState(null);
  const [expandedDisruptions, setExpandedDisruptions] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [expandedNetworks, setExpandedNetworks] = useState(new Set());

  useEffect(() => {
    fetchDisruptions();
    const interval = setInterval(fetchDisruptions, 5 * 60 * 1000);
    
    // Attendre au moins 2.5 secondes avant d'autoriser l'affichage du message vide
    const emptyStateTimer = setTimeout(() => {
      setCanShowEmptyState(true);
    }, 2500);
    
    return () => {
      clearInterval(interval);
      clearTimeout(emptyStateTimer);
    };
  }, []);

  useEffect(() => {
    let filtered = filterDisruptions(disruptions, searchTerm);
    if (selectedNetwork !== 'all') {
      filtered = filtered.filter(d => 
        d.affectedLines?.some(line => line.networkName === selectedNetwork)
      );
    }
    
    // Trier par date de publication récente (plus récent en premier)
    filtered.sort((a, b) => {
      const dateA = new Date(a.publicationStartDate || a.effectiveStartDate);
      const dateB = new Date(b.publicationStartDate || b.effectiveStartDate);
      return dateB - dateA; // Ordre décroissant
    });
    
    const grouped = groupDisruptionsByNetwork(filtered);
    
    // Trier les perturbations dans chaque groupe par date récente
    Object.keys(grouped).forEach(networkName => {
      grouped[networkName].sort((a, b) => {
        const dateA = new Date(a.publicationStartDate || a.effectiveStartDate);
        const dateB = new Date(b.publicationStartDate || b.effectiveStartDate);
        return dateB - dateA; // Ordre décroissant
      });
    });
    
    setGroupedDisruptions(grouped);
    // Cartes fermées par défaut
    setExpandedNetworks(new Set());
  }, [disruptions, searchTerm, selectedNetwork]);

  const fetchDisruptions = async () => {
    try {
      if (initialLoading) {
        setLoading(true);
      }
      const data = await getDisruptions();
      setDisruptions(data);
      setError(null);
    } catch (err) {
      setError('Impossible de charger les informations trafic');
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const toggleDisruption = (disruptionId) => {
    const newExpanded = new Set(expandedDisruptions);
    if (newExpanded.has(disruptionId)) {
      newExpanded.delete(disruptionId);
    } else {
      newExpanded.add(disruptionId);
    }
    setExpandedDisruptions(newExpanded);
  };

  const toggleNetwork = (networkName) => {
    const newExpanded = new Set(expandedNetworks);
    if (newExpanded.has(networkName)) {
      newExpanded.delete(networkName);
    } else {
      newExpanded.add(networkName);
    }
    setExpandedNetworks(newExpanded);
  };

  const getAllNetworks = () => {
    const networks = new Set();
    disruptions.forEach(d => {
      d.affectedLines?.forEach(line => {
        if (line.networkName) networks.add(line.networkName);
      });
    });
    return Array.from(networks).sort();
  };

  const getTransportIcon = (mode) => {
    switch (mode) {
      case 'BUS':
        return <BusIcon className="text-base" />;
      case 'TAD':
        return <TaxiIcon className="text-base" />;
      case 'TRAM':
        return <TramIcon className="text-base" />;
      case 'METRO':
        return <TransitIcon className="text-base" />;
      case 'TRAIN':
        return <TrainIcon className="text-base" />;
      default:
        return <BusIcon className="text-base" />;
    }
  };

  // Fonction pour calculer la couleur de texte optimale (noir ou blanc) selon la couleur de fond
  const getTextColor = (backgroundColor) => {
    if (!backgroundColor) return '#FFFFFF';
    
    // Enlever le # si présent
    const hex = backgroundColor.replace('#', '');
    
    // Convertir en RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculer la luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Retourner noir si lumineux, blanc si sombre
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  // Fonction pour formater le nom du réseau en deux parties
  const formatNetworkName = (networkName) => {
    const parts = networkName.split(' - ');
    if (parts.length >= 2) {
      return {
        main: parts[0],
        sub: parts.slice(1).join(' - ')
      };
    }
    return {
      main: networkName,
      sub: null
    };
  };

  // Fonction pour nettoyer et formater la description
  const cleanDescription = (description) => {
    if (!description) return '';
    
    return description
      // D'abord, convertir les balises HTML en sauts de ligne appropriés
      .replace(/<\/p>/gi, '<br><br>')                // Fin de paragraphe = double saut de ligne
      .replace(/<p[^>]*>/gi, '')                     // Début de paragraphe = rien
      .replace(/<\/li>/gi, '<br>')                   // Fin d'élément de liste = saut de ligne
      .replace(/<li[^>]*>/gi, '• ')                  // Début d'élément de liste = puce
      .replace(/<\/ul>/gi, '<br>')                   // Fin de liste = saut de ligne
      .replace(/<ul[^>]*>/gi, '<br>')                // Début de liste = saut de ligne
      .replace(/<\/strong>/gi, '</strong>')          // Garder le gras
      .replace(/<strong[^>]*>/gi, '<strong>')        // Nettoyer les attributs du strong
      .replace(/<br\s*\/?>/gi, '<br>')               // Nettoyer les br
      // Décoder les entités HTML
      .replace(/&gt;/gi, '>')
      .replace(/&lt;/gi, '<')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      // Supprimer les attributs de style qui peuvent causer des problèmes de sécurité
      .replace(/style\s*=\s*["'][^"']*["']/gi, '')
      // Supprimer toutes les autres balises HTML restantes (comme les span avec styles)
      .replace(/<(?!\/?(strong|br)\b)[^>]*>/gi, '')
      // Nettoyer les sauts de ligne multiples
      .replace(/(<br>\s*){3,}/gi, '<br><br>')        // Max 2 sauts de ligne consécutifs
      .replace(/^<br>+/gi, '')                       // Supprimer les br en début
      // Remplacer "www.oise-mobilite.fr" par "Bus Connect"
      .replace(/www\.oise-mobilite\.fr/gi, 'Bus Connect')
      // Remplacer "www.aglo-compiegne.fr" par "Bus Connect"
      .replace(/www\.aglo-compiegne\.fr/gi, 'Bus Connect')
      // Remplacer "consulter sur le site Internet www.oise-mobilite.fr" 
      .replace(/consulter sur le site Internet www\.oise-mobilite\.fr/gi, 'consulter sur l\'application Bus Connect')
      // Remplacer "consulter sur le site Internet www.aglo-compiegne.fr" 
      .replace(/consulter sur le site Internet www\.aglo-compiegne\.fr/gi, 'consulter sur l\'application Bus Connect')
      // Supprimer les balises script et autres balises dangereuses
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .trim();
  };

  // Composant skeleton pour le chargement
  const TrafficSkeleton = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-purple-900">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-dark-800/90 border-b border-orange-100 dark:border-orange-900/20">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-yellow-500/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                  <InfoIcon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full animate-ping"></div>
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Info Trafic
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">
                  Chargement des perturbations...
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-dark-700/60 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full backdrop-blur-sm">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full mr-1.5 sm:mr-2 animate-pulse"></div>
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">{new Date().toLocaleTimeString('fr-FR')}</span>
                <span className="sm:hidden">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* Filtres skeleton */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="bg-white/80 dark:bg-dark-700/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-600/50 shadow-lg h-12 animate-pulse"></div>
            </div>
            <div className="relative">
              <div className="bg-white/80 dark:bg-dark-700/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-600/50 shadow-lg h-12 w-48 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-dark-600/50 overflow-hidden">
              <div className="px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between">
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl sm:rounded-2xl animate-pulse"></div>
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                    <div className="mt-1">
                      <div className="h-6 w-24 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
              
              {/* Animation de vague sur chaque carte */}
              <div className="relative overflow-hidden h-1">
                <div 
                  className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"
                  style={{
                    animation: `shimmer ${2 + index * 0.5}s ease-in-out infinite`,
                    animationDelay: `${index * 0.2}s`
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes shimmer {
            0% { transform: translateX(-100%); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateX(100%); opacity: 0; }
          }
          
          @keyframes fade-in {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes bounce-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
          
          @keyframes slide-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          
          .animate-fade-in {
            animation: fade-in 0.6s ease-out forwards;
          }
          
          .animate-bounce-gentle {
            animation: bounce-gentle 2s ease-in-out infinite;
          }
          
          .animate-slide-up {
            animation: slide-up 0.8s ease-out 0.2s forwards;
            opacity: 0;
          }
          
          .animate-slide-up-delayed {
            animation: slide-up 0.8s ease-out 0.4s forwards;
            opacity: 0;
          }
          
          .animate-slide-up-delayed-2 {
            animation: slide-up 0.8s ease-out 0.6s forwards;
            opacity: 0;
          }
          
          /* Styles pour le contenu HTML de la description */
          .prose p {
            margin-bottom: 0.75rem;
            line-height: 1.6;
          }
          .prose ul {
            margin: 0.5rem 0;
            padding-left: 1.25rem;
          }
          .prose li {
            margin-bottom: 0.25rem;
            list-style-type: disc;
          }
          .prose strong {
            font-weight: 600;
            color: inherit;
          }
          .prose span {
            color: inherit !important;
          }
        `
      }} />
    </div>
  );

  if (loading && initialLoading) {
    return <TrafficSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50 dark:from-dark-900 dark:via-dark-800 dark:to-red-900">
        <div className="text-center bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-red-200/50 dark:border-red-800/50">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Erreur</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={fetchDisruptions}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-purple-900">
      {/* Header avec gradient */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-dark-800/90 border-b border-orange-100 dark:border-orange-900/20">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-yellow-500/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Titre avec icône animée */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                  <InfoIcon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Info Trafic
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">
                  {loading && !initialLoading ? 'Mise à jour en cours...' : 'Perturbations en temps réel'}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-dark-700/60 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full backdrop-blur-sm">
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1.5 sm:mr-2 ${loading && !initialLoading ? 'bg-orange-500 animate-ping' : 'bg-green-500 animate-pulse'}`}></div>
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">{new Date().toLocaleTimeString('fr-FR')}</span>
                <span className="sm:hidden">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                {loading && !initialLoading ? 'Mise à jour...' : 'Mise à jour auto'}
              </p>
            </div>
          </div>

          {/* Filtres stylés */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Barre de recherche stylée */}
            <div className="flex-1 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="relative bg-white/80 dark:bg-dark-700/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-600/50 shadow-lg">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher une ligne, un réseau..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filtre par réseau stylé */}
            <div className="relative">
              <div className="bg-white/80 dark:bg-dark-700/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-600/50 shadow-lg overflow-hidden">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <GlobalIcon className="w-5 h-5 text-gray-400" />
                </div>
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="appearance-none bg-transparent pl-12 pr-12 py-3 focus:outline-none text-gray-900 dark:text-white cursor-pointer min-w-[200px]"
                >
                  <option value="all">Tous les réseaux</option>
                  {getAllNetworks().map(network => (
                    <option key={network} value={network}>{network}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-h-[60vh]">
        {Object.keys(groupedDisruptions).length === 0 && !initialLoading && canShowEmptyState ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="relative mx-auto w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-500 rounded-full opacity-20 animate-pulse"></div>
              <div className="relative w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce-gentle">
                <CheckIcon className="w-16 h-16 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-3 animate-slide-up">
              Aucune perturbation
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-lg animate-slide-up-delayed">
              Le trafic est fluide sur tous les réseaux
            </p>
            <div className="mt-6 text-sm text-gray-500 dark:text-gray-500 animate-slide-up-delayed-2">
              Prochaine vérification dans 5 minutes
            </div>
          </div>
        ) : (
          <div className={`space-y-6 sm:space-y-8 transition-all duration-500 animate-fade-in ${loading && !initialLoading ? 'opacity-80' : 'opacity-100'}`}>
            {Object.entries(groupedDisruptions).map(([networkName, networkDisruptions]) => (
              <div key={networkName} className="group">
                <div className={`bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-dark-600/50 overflow-hidden hover:shadow-2xl transition-all duration-300 ${loading && !initialLoading ? 'ring-2 ring-orange-500/20 animate-pulse' : ''}`}>
                  {/* En-tête du réseau stylé */}
                  <button
                    onClick={() => toggleNetwork(networkName)}
                    className="w-full px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 dark:hover:from-orange-900/20 dark:hover:to-red-900/20 transition-all duration-300 group"
                  >
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                          <FaBus className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                        <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {networkDisruptions.length}
                        </div>
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-300">
                          {formatNetworkName(networkName).main}
                        </h2>
                        {formatNetworkName(networkName).sub && (
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {formatNetworkName(networkName).sub}
                          </p>
                        )}
                        <div className="flex items-center mt-1 space-x-2">
                          <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg">
                            {networkDisruptions.length} perturbation{networkDisruptions.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                        {expandedNetworks.has(networkName) ? 'Masquer' : 'Afficher'}
                      </div>
                      {expandedNetworks.has(networkName) ? (
                        <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-orange-500 transition-colors duration-300" />
                      ) : (
                        <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-orange-500 transition-colors duration-300" />
                      )}
                    </div>
                  </button>

                  {/* Liste des perturbations stylées */}
                  {expandedNetworks.has(networkName) && (
                    <div className="bg-gradient-to-br from-gray-50 to-white dark:from-dark-700 dark:to-dark-800 p-4 sm:p-6">
                      <div className="space-y-3 sm:space-y-4">
                        {networkDisruptions.map((disruption) => (
                          <div
                            key={disruption.id}
                            className="group/disruption bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-600/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                          >
                            <div
                              className="p-4 sm:p-6 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 dark:hover:from-blue-900/10 dark:hover:to-purple-900/10 transition-all duration-300"
                              onClick={() => toggleDisruption(disruption.id)}
                            >
                              {/* Mobile Layout */}
                              <div className="block sm:hidden">
                                <div className="flex items-start space-x-3 mb-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg group-hover/disruption:scale-105 transition-transform duration-300 flex-shrink-0">
                                    <IoMdInformationCircle className="text-lg text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover/disruption:text-orange-600 dark:group-hover/disruption:text-orange-400 transition-colors duration-300 mb-2 leading-tight">
                                      {disruption.title}
                                    </h3>

                                  </div>
                                  <div className="flex-shrink-0">
                                    {expandedDisruptions.has(disruption.id) ? (
                                      <ChevronUp className="w-5 h-5 text-blue-500 group-hover/disruption:text-orange-500 transition-colors duration-300" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5 text-blue-500 group-hover/disruption:text-orange-500 transition-colors duration-300" />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Lignes affectées - Mobile */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {disruption.affectedLines?.map((line) => {
                                    const { background, text } = getSafeLineColors(line.color);
                                    return (
                                      <div
                                        key={line.id}
                                        className="group/line relative overflow-hidden rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                                      >
                                        <div
                                          className="px-2 py-1 text-xs font-bold"
                                          style={{
                                            backgroundColor: `#${background}`,
                                            color: text,
                                          }}
                                        >
                                          <div className="flex items-center space-x-1">
                                            <span className="text-sm">
                                              {getTransportIcon(line.transportMode)}
                                            </span>
                                            <span>{line.number}</span>
                                          </div>
                                        </div>
                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/line:opacity-100 transition-opacity duration-200"></div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Informations temporelles - Mobile */}
                                <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100/60 dark:bg-dark-700/60 px-2 py-1.5 rounded-lg">
                                  <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1 text-blue-500" />
                                    <span>Du {formatDate(disruption.effectiveStartDate)}</span>
                                  </div>
                                  <div className="mt-0.5">au {formatDate(disruption.effectiveEndDate)}</div>
                                </div>
                              </div>

                              {/* Desktop Layout */}
                              <div className="hidden sm:block">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-start space-x-4 mb-4">
                                                                          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg group-hover/disruption:scale-105 transition-transform duration-300">
                                      <IoMdInformationCircle className="text-2xl text-white" />
                                    </div>
                                      <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover/disruption:text-orange-600 dark:group-hover/disruption:text-orange-400 transition-colors duration-300 mb-2">
                                          {disruption.title}
                                        </h3>
                                        
                                        {/* Lignes affectées avec style amélioré */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                          {disruption.affectedLines?.map((line) => {
                                            const { background, text } = getSafeLineColors(line.color);
                                            return (
                                              <div
                                                key={line.id}
                                                className="group/line relative overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                                              >
                                                <div
                                                  className="px-3 py-2 text-sm font-bold"
                                                  style={{
                                                    backgroundColor: `#${background}`,
                                                    color: text,
                                                  }}
                                                >
                                                  <div className="flex items-center space-x-1">
                                                    <span className="text-base">
                                                      {getTransportIcon(line.transportMode)}
                                                    </span>
                                                    <span>{line.number}</span>
                                                  </div>
                                                </div>
                                                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/line:opacity-100 transition-opacity duration-200"></div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Informations temporelles */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 bg-gray-100/60 dark:bg-dark-700/60 px-3 py-2 rounded-lg">
                                        <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                                        <span className="font-medium">
                                          Du {formatDate(disruption.effectiveStartDate)}
                                        </span>
                                      </div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        au {formatDate(disruption.effectiveEndDate)}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="ml-6 flex flex-col items-end space-y-2">
                                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                                      <span>{expandedDisruptions.has(disruption.id) ? 'Masquer' : 'Détails'}</span>
                                      {expandedDisruptions.has(disruption.id) ? (
                                        <ChevronUp className="w-5 h-5 text-blue-500 group-hover/disruption:text-orange-500 transition-colors duration-300" />
                                      ) : (
                                        <ChevronDown className="w-5 h-5 text-blue-500 group-hover/disruption:text-orange-500 transition-colors duration-300" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Détails de la perturbation */}
                            {expandedDisruptions.has(disruption.id) && (
                              <div className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 p-4 sm:p-6 border-t border-gray-200/50 dark:border-dark-600/50">
                                <div className="prose prose-sm max-w-none dark:prose-invert mb-4">
                                  <div 
                                    className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed"
                                    dangerouslySetInnerHTML={{ 
                                      __html: cleanDescription(disruption.description) 
                                    }}
                                  />
                                </div>

                                {/* Pièces jointes */}
                                {disruption.attachments && disruption.attachments.length > 0 && (
                                  <div className="mb-4">
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 flex items-center">
                                      <AttachIcon className="w-4 h-4 mr-2" />
                                      Documents joints
                                    </h4>
                                    <div className="space-y-2">
                                      {disruption.attachments.map((attachment) => (
                                        <a
                                          key={attachment.id}
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center text-xs sm:text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors duration-200"
                                        >
                                          <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                                          <span className="truncate">{attachment.label || 'Document'}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Type uniquement */}
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm">
                                  <div className="bg-white/60 dark:bg-dark-700/60 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg">
                                    <span className="font-bold text-gray-700 dark:text-gray-300">Type:</span>
                                    <span className="ml-2 text-gray-600 dark:text-gray-400">{disruption.type}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrafficInfo; 