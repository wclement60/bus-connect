import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  getFavoriteLines, 
  getFavoriteStops, 
  getFavoriteNetworks,
  removeFavoriteLine, 
  removeFavoriteStop,
  removeFavoriteNetwork
} from '../services/favorites';
import NetworkLogo from '../components/NetworkLogo';
import { supabase } from '../services/supabase';
import { getTodayForSupabase } from '../services/supabase';
import { fetchRealtimeData } from '../services/realtime';
import { FaArrowRight, FaBus, FaClock } from 'react-icons/fa';

// Composant pour les placeholders de chargement
const LoadingPlaceholder = () => {
  return (
    <div className="space-y-4">
      {/* Placeholder pour le nom de l'arrêt */}
      <div className="flex items-center">
        <div className="w-48 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
      
      {/* Placeholder pour les lignes */}
      {[1, 2].map((_, index) => (
        <div key={index} className="bg-white dark:bg-dark-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* En-tête de ligne */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              {/* Placeholder numéro de ligne */}
              <div className="w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              {/* Placeholder direction */}
              <div className="ml-4 flex-1">
                <div className="w-32 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
          
          {/* Placeholder horaires */}
          <div className="p-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[1, 2].map((_, i) => (
                <div key={i} className="min-h-[3rem] bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <div className="w-16 h-6 mx-auto bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

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

// Fonction pour déterminer si une couleur est sombre
const isColorDark = (hexColor) => {
  if (!hexColor) return true;
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);
  // Calcul de la luminosité (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

// Fonction pour parser une date GTFS
const parseGtfsDate = (dateStr) => {
  if (!dateStr) return null;
  let year, month, day;
  if (dateStr.includes('-')) {
    [year, month, day] = dateStr.split('-').map(Number);
  } else if (dateStr.length === 8) {
    year = parseInt(dateStr.substring(0, 4), 10);
    month = parseInt(dateStr.substring(4, 6), 10);
    day = parseInt(dateStr.substring(6, 8), 10);
  } else {
    return null;
  }
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
};

// Fonction pour convertir une heure au format HH:MM en minutes depuis minuit
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Fonction pour obtenir l'heure actuelle en minutes depuis minuit
const getCurrentTimeInMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

// New TimeDisplay component for animated time updates
const TimeDisplay = ({
  theoreticalTime,
  finalDisplayTime,
  calculatedDelayMinutes,
  showTheoreticalStripped,
  timeColorClass,
  hasRealtimeInfo,
  isLate,
  isLastDeparture
}) => {
  const [currentValues, setCurrentValues] = useState({
    finalDisplayTime,
    calculatedDelayMinutes,
    showTheoreticalStripped,
    timeColorClass,
    theoreticalTime,
    hasRealtimeInfo,
    isLate,
  });
  const [isVisible, setIsVisible] = useState(true);

  const prevFinalDisplayTimeRef = useRef(finalDisplayTime);
  const prevCalculatedDelayMinutesRef = useRef(calculatedDelayMinutes);
  const prevHasRealtimeInfoRef = useRef(hasRealtimeInfo);

  useEffect(() => {
    const finalTimeChanged = finalDisplayTime !== prevFinalDisplayTimeRef.current;
    const delayChanged = calculatedDelayMinutes !== prevCalculatedDelayMinutesRef.current;
    const realtimeStatusChanged = hasRealtimeInfo !== prevHasRealtimeInfoRef.current;

    const significantUpdate = finalTimeChanged || delayChanged || realtimeStatusChanged;

    if (significantUpdate) {
      setIsVisible(false); 

      const timer = setTimeout(() => {
        setCurrentValues({
          finalDisplayTime,
          calculatedDelayMinutes,
          showTheoreticalStripped,
          timeColorClass,
          theoreticalTime,
          hasRealtimeInfo,
          isLate,
        });
        prevFinalDisplayTimeRef.current = finalDisplayTime;
        prevCalculatedDelayMinutesRef.current = calculatedDelayMinutes;
        prevHasRealtimeInfoRef.current = hasRealtimeInfo;
        setIsVisible(true);
      }, 200); 

      return () => clearTimeout(timer);
    } else {
      setCurrentValues({
        finalDisplayTime,
        calculatedDelayMinutes,
        showTheoreticalStripped,
        timeColorClass,
        theoreticalTime,
        hasRealtimeInfo,
        isLate,
      });
      prevFinalDisplayTimeRef.current = finalDisplayTime;
      prevCalculatedDelayMinutesRef.current = calculatedDelayMinutes;
      prevHasRealtimeInfoRef.current = hasRealtimeInfo;
    }
  }, [
    finalDisplayTime, calculatedDelayMinutes, showTheoreticalStripped,
    timeColorClass, theoreticalTime, hasRealtimeInfo, isLate
  ]);

  let borderColorClass = 'border-gray-200 dark:border-gray-700';
  if (currentValues.hasRealtimeInfo) {
    if (currentValues.calculatedDelayMinutes > 0) {
      borderColorClass = 'border-red-500 dark:border-red-600';
    } else if (currentValues.calculatedDelayMinutes < 0) {
      borderColorClass = 'border-orange-500 dark:border-orange-600';
    } else { 
      borderColorClass = 'border-green-500 dark:border-green-600';
    }
  }

  const showDelayBadge = currentValues.hasRealtimeInfo && currentValues.calculatedDelayMinutes !== 0;

  return (
    <div
      className={`relative min-h-[4rem] bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border ${borderColorClass}`}
      style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }}
    >
      {currentValues.showTheoreticalStripped && (
        <div className="absolute top-1 left-0">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2.5 py-0.5 block leading-tight line-through">
            {currentValues.theoreticalTime}
          </span>
        </div>
      )}
      {showDelayBadge && (
        <div style={{ borderTopRightRadius: '0.4rem' }} className={`absolute top-0 right-0 rounded-bl-lg ${currentValues.isLate ? 'bg-red-500' : 'bg-orange-500'}`}>
          <span className="text-xs font-medium text-white px-2.5 py-0.5 block leading-tight">
            {currentValues.calculatedDelayMinutes > 0 ? '+' : ''}{currentValues.calculatedDelayMinutes} min
          </span>
        </div>
      )}
      <div className="flex items-center justify-center h-full">
        <span className={`text-lg font-bold ${currentValues.timeColorClass}`}>
          {currentValues.finalDisplayTime}
        </span>
      </div>
      {isLastDeparture && (
        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
          <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full shadow-sm animate-pulse whitespace-nowrap">
            Dernier passage
          </span>
        </div>
      )}
    </div>
  );
};

const Favorites = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [favoriteLines, setFavoriteLines] = useState([]);
  const [favoriteStops, setFavoriteStops] = useState([]);
  const [favoriteNetworks, setFavoriteNetworks] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [activeView, setActiveView] = useState('networks'); // 'networks' ou 'stops'
  const [stopSchedules, setStopSchedules] = useState({});
  const [loadingSchedules, setLoadingSchedules] = useState({});
  const [realtimeData, setRealtimeData] = useState({});
  const [expandedDirections, setExpandedDirections] = useState({});
  const [expandedNetworks, setExpandedNetworks] = useState({});

  const userId = user?.id; // Utiliser un identifiant stable de l'utilisateur

  // Nouvelle fonction pour rafraîchir les données en temps réel
  const refreshRealtimeData = useCallback(async () => {
    if (stopSchedules && Object.keys(stopSchedules).length > 0) {
      for (const [stopId, scheduleInfo] of Object.entries(stopSchedules)) {
        if (scheduleInfo && scheduleInfo.data) {
          for (const routeSchedule of scheduleInfo.data) {
            try {
              // Assurer que favoriteStops est accessible ou que network_id est sur routeSchedule.route
              const networkIdForRealtime = routeSchedule.route.network_id || favoriteStops.find(s => s.stop_id === stopId)?.network_id;
              if (networkIdForRealtime) {
                const realtimeResult = await fetchRealtimeData(
                  networkIdForRealtime,
                  routeSchedule.route.route_id
                );
                if (realtimeResult) {
                  setRealtimeData(prev => ({
                    ...prev,
                    [routeSchedule.route.route_id]: realtimeResult
                  }));
                }
              }
            } catch (error) {
              console.error('Error refreshing realtime data:', error);
            }
          }
        }
      }
    }
  }, [stopSchedules, favoriteStops]); // fetchRealtimeData est une importation, donc stable. favoriteStops est nécessaire ici.

  // Effet pour le rafraîchissement périodique
  useEffect(() => {
    if (activeView === 'stops' && userId) { // Depend on stable userId
      refreshRealtimeData(); // Premier rafraîchissement immédiat
      const intervalId = setInterval(refreshRealtimeData, 30000); // 30 secondes
      return () => clearInterval(intervalId);
    }
  }, [activeView, userId, refreshRealtimeData]);

  const loadFavorites = useCallback(async () => {
    if (!userId) return; // Ne rien faire si pas d'utilisateur
    try {
      setLoadingFavorites(true);
      const networks = await getFavoriteNetworks();
      const lines = await getFavoriteLines();
      const stops = await getFavoriteStops();
      setFavoriteNetworks(networks);
      setFavoriteLines(lines);
      setFavoriteStops(stops);
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
      toast.error('Impossible de charger vos favoris');
    } finally {
      setLoadingFavorites(false);
    }
  }, [userId, toast]); // getFavoriteNetworks, etc., sont des imports stables

  // Charger les favoris si l'utilisateur est connecté
  useEffect(() => {
    if (userId) {
      loadFavorites();
    } else {
      // Vider les états liés aux favoris si l'utilisateur se déconnecte
      setFavoriteNetworks([]);
      setFavoriteLines([]);
      setFavoriteStops([]);
      setStopSchedules({});
      setRealtimeData({});
      setExpandedDirections({});
      setExpandedNetworks({}); // Vider aussi les réseaux étendus
    }
  }, [userId, loadFavorites]);

  const handleRemoveNetwork = async (networkId) => {
    try {
      await removeFavoriteNetwork(networkId);
      toast.success('Réseau supprimé des favoris');
      loadFavorites();
    } catch (error) {
      console.error('Erreur lors de la suppression du réseau:', error);
      toast.error('Impossible de supprimer le réseau des favoris');
    }
  };

  const handleRemoveLine = async (networkId, lineId) => {
    try {
      await removeFavoriteLine(networkId, lineId);
      toast.success('Ligne supprimée des favoris');
      loadFavorites();
    } catch (error) {
      console.error('Erreur lors de la suppression de la ligne:', error);
      toast.error('Impossible de supprimer la ligne des favoris');
    }
  };

  const handleRemoveStop = async (networkId, stopId) => {
    try {
      // Trouver l'arrêt pour afficher son nom dans le toast
      const stopToRemove = favoriteStops.find(s => s.network_id === networkId && s.stop_id === stopId);
      const stopName = stopToRemove ? stopToRemove.stop_name : 'L\'arrêt';

      await removeFavoriteStop(networkId, stopId);
      toast.success(<>Arrêt : <strong>{stopName.toUpperCase()}</strong> supprimé des favoris</>);
      loadFavorites(); // Recharger les favoris pour mettre à jour l'UI
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'arrêt:', error);
      toast.error('Impossible de supprimer l\'arrêt des favoris');
    }
  };

  // Nouvelle fonction pour formater l'heure
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
  };

  // Nouvelle fonction pour obtenir les infos temps réel
  const getRealtimeInfo = (routeId, tripId, departureStopId, allStopIdsInGroup) => {
    const info = {
      delay: 0,
      actualTime: null,
      hasRealtimeUpdate: false,
      sourceStopId: departureStopId
    };

    if (!realtimeData[routeId]) {
      return info;
    }

    // Fonction helper pour vérifier une clé pour un stopId donné
    const checkKeyForStopId = (currentStopId) => {
      const key = `${tripId}-${currentStopId}`;
      if (realtimeData[routeId].delays && realtimeData[routeId].delays[key] !== undefined) {
        info.delay = realtimeData[routeId].delays[key];
        info.hasRealtimeUpdate = true;
        info.sourceStopId = currentStopId;
        return true;
      }
      if (realtimeData[routeId].updatedTimes && realtimeData[routeId].updatedTimes[key]) {
        const rtTimes = realtimeData[routeId].updatedTimes[key];
        info.actualTime = rtTimes.departure || rtTimes.arrival;
        info.hasRealtimeUpdate = true;
        info.sourceStopId = currentStopId;
        return true;
      }
      return false;
    };

    // 1. Essayer avec le departureStopId direct
    if (checkKeyForStopId(departureStopId)) {
      return info;
    }

    // 2. Si échec, essayer les autres stop_ids du groupe
    if (allStopIdsInGroup && allStopIdsInGroup.length > 0) {
      for (const altStopId of allStopIdsInGroup) {
        if (altStopId === departureStopId) continue;
        if (checkKeyForStopId(altStopId)) {
          return info;
        }
      }
    }

    return info;
  };

  // Fonction pour vérifier si un passage est encore à venir en tenant compte du temps réel
  const isUpcomingDeparture = (departure, routeId, tripId, stopId, allStopIds) => {
    const currentTimeMinutes = getCurrentTimeInMinutes();
    const theoreticalTimeMinutes = timeToMinutes(departure.departure_time);
    
    // Obtenir les infos temps réel
    const rtInfo = getRealtimeInfo(routeId, tripId, stopId, allStopIds);
    
    // Si on a un temps réel exact
    if (rtInfo.actualTime) {
      const actualDate = new Date(rtInfo.actualTime);
      const actualTimeMinutes = actualDate.getHours() * 60 + actualDate.getMinutes();
      return actualTimeMinutes >= currentTimeMinutes;
    }
    
    // Si on a un délai
    if (rtInfo.hasRealtimeUpdate) {
      const adjustedTimeMinutes = theoreticalTimeMinutes + rtInfo.delay;
      return adjustedTimeMinutes >= currentTimeMinutes;
    }
    
    // Si pas de temps réel, utiliser l'heure théorique
    return theoreticalTimeMinutes >= currentTimeMinutes;
  };

  // Nouvelle fonction pour récupérer les horaires d'un arrêt
  const fetchStopSchedules = async (stop) => {
    try {
      setLoadingSchedules(prev => ({ ...prev, [stop.stop_id]: true }));

      // Get current time in HH:MM:SS format for filtering
      const currentDateQuery = new Date();
      const hours = currentDateQuery.getHours().toString().padStart(2, '0');
      const minutes = currentDateQuery.getMinutes().toString().padStart(2, '0');
      const seconds = currentDateQuery.getSeconds().toString().padStart(2, '0');
      const fetchStartTimeForRPC = "00:00:00"; // On récupère tous les passages du jour

      // Récupérer d'abord tous les arrêts liés
      const { data: relatedStops, error: relatedStopsError } = await supabase
        .from('stops')
        .select('stop_id, stop_name, city')
        .eq('network_id', stop.network_id)
        .eq('stop_name', stop.stop_name);

      if (relatedStopsError) throw relatedStopsError;

      const enrichedStop = {
        ...stop,
        stop_ids: relatedStops.map(s => s.stop_id),
        original_stops: relatedStops
      };

      // Récupérer les services valides pour aujourd'hui
      const { date: today, dateStr: todayDateStr, dayOfWeek } = getTodayForSupabase();

      // Récupérer les calendriers valides
      const { data: calendarData, error: calendarError } = await supabase
        .from('calendar')
        .select('service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date')
        .eq('network_id', stop.network_id);

      if (calendarError) throw calendarError;

      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from('calendar_dates')
        .select('service_id, exception_type, date')
        .eq('network_id', stop.network_id)
        .eq('date', todayDateStr);

      if (exceptionsError) throw exceptionsError;

      // Filtrer les services valides
      let validServiceIds = calendarData
        .filter(service => {
          const startDate = parseGtfsDate(service.start_date);
          const endDate = parseGtfsDate(service.end_date);
          if (!startDate || !endDate) return false;
          const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
          const isDateValid = todayUtc >= startDate && todayUtc <= endDate;
          const dayFieldName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
          const runsOnDay = service[dayFieldName] === true || service[dayFieldName] === 1;
          return isDateValid && runsOnDay;
        })
        .map(service => service.service_id);

      // Gérer les exceptions
      if (exceptionsData && exceptionsData.length > 0) {
        const exceptionsMap = new Map();
        exceptionsData.forEach(ex => exceptionsMap.set(ex.service_id, ex.exception_type));
        validServiceIds = validServiceIds.filter(serviceId => {
          const exceptionType = exceptionsMap.get(serviceId);
          if (exceptionType === 2) return false;
          return true;
        });
        exceptionsData.forEach(ex => {
          if (ex.exception_type === 1 && !validServiceIds.includes(ex.service_id)) {
            validServiceIds.push(ex.service_id);
          }
        });
      }

      // Récupérer les routes pour TOUS les stop_ids du groupe
      const allRoutesForStops = await Promise.all(
        enrichedStop.stop_ids.map(stopId =>
          supabase
            .rpc('get_routes_for_stop', {
              p_stop_id: stopId,
              p_network_id: stop.network_id
            })
            .then(({ data, error }) => {
              if (error) throw error;
              return data || [];
            })
        )
      );

      // Fusionner et dédupliquer les routes
      const uniqueRouteIds = [...new Set(
        allRoutesForStops.flat().map(r => r.route_id)
      )];

      // Récupérer les routes complètes
      const { data: routesData, error: routesDataError } = await supabase
        .from('routes')
          .select('*')
          .eq('network_id', stop.network_id)
        .in('route_id', uniqueRouteIds);

      if (routesDataError) throw routesDataError;

      // Pour chaque route, récupérer les trips et directions possibles
      const schedulesByRoute = {};

      for (const route of routesData) {
        try {
          // Récupérer les trips pour TOUS les stop_ids
          const allTripsWithStops = await Promise.all(
            enrichedStop.stop_ids.map(stopId =>
              supabase
                .rpc('get_route_trips_with_stops', {
                  p_route_id: route.route_id,
                  p_network_id: stop.network_id,
                  p_stop_ids: [stopId], // On appelle pour chaque stop_id individuellement
                  p_current_time: fetchStartTimeForRPC, // Utiliser 00:00:00 pour récupérer tous les passages
                  p_current_date: todayDateStr,
                  p_day_of_week: dayOfWeek
                })
                .then(({ data, error }) => {
                  if (error) throw error;
                  return data || [];
                })
            )
          );

          // Fusionner les résultats
          const routeTripsWithStops = allTripsWithStops.flat();

          if (!routeTripsWithStops || routeTripsWithStops.length === 0) continue;

          // Regrouper par direction
          const directionMap = new Map();
        
          routeTripsWithStops.forEach(tripData => {
            const { trip_headsign, service_id, stop_sequence, next_stops, is_active_service, future_departures } = tripData;
            
            if (!trip_headsign || trip_headsign.toLowerCase() === stop.stop_name.toLowerCase()) return;
          
            // Vérifier si c'est une direction valide (il y a des arrêts après)
            if (next_stops > 0) {
              if (!directionMap.has(trip_headsign)) {
                directionMap.set(trip_headsign, {
                  trips: [],
                  serviceIds: new Set(),
                  departures: [],
                  hasActiveService: false
                });
              }
              
              const directionData = directionMap.get(trip_headsign);
              directionData.trips.push(tripData);
              directionData.serviceIds.add(service_id);
              directionData.hasActiveService = directionData.hasActiveService || is_active_service;
              
              // Si c'est un service actif avec des départs futurs, les ajouter
              if (is_active_service && future_departures && future_departures.length > 0) {
                directionData.departures.push(...future_departures);
              }
          }
        });

          // Traiter chaque direction valide
          const directions = [];
          
          for (const [direction, data] of directionMap) {
            // Récupérer tous les départs théoriques pour cette direction et les trier par heure théorique
            const allTheoreticalDeparturesForDirection = data.departures
              .map(departure => ({
                ...departure,
                trip: data.trips.find(t => t.trip_id === departure.trip_id)
              }))
              .sort((a, b) => a.departure_time.localeCompare(b.departure_time));

            directions.push({
              direction,
              departures: allTheoreticalDeparturesForDirection, // Stocker TOUS les départs théoriques triés
              hasActiveService: data.hasActiveService,
              hasSchedules: allTheoreticalDeparturesForDirection.length > 0, // Vrai s'il y avait des horaires théoriques
              // La notion de hasUpcomingDepartures sera déterminée dans le JSX
            });
          }

          if (directions.length > 0) {
            schedulesByRoute[route.route_id] = {
              route: {
                route_id: route.route_id,
                route_short_name: route.route_short_name,
                route_long_name: route.route_long_name,
                route_color: route.route_color,
                route_text_color: route.route_text_color
              },
              directions
            };
          }
        } catch (error) {
          console.error('Error processing route:', route.route_id, error);
          // Continue avec la prochaine route en cas d'erreur
          continue;
        }
      }

      // Convertir en tableau final et garder toutes les lignes
      const schedules = Object.values(schedulesByRoute);
      setStopSchedules(prev => ({ 
        ...prev, 
        [stop.stop_id]: { 
          data: schedules, 
          related_stop_ids: enrichedStop.stop_ids,
          original_stops: enrichedStop.original_stops
        }
      }));

      // Récupérer les données temps réel pour chaque ligne
      schedules.forEach(async (routeSchedule) => {
        try {
          const realtimeResult = await fetchRealtimeData(stop.network_id, routeSchedule.route.route_id);
        if (realtimeResult) {
          setRealtimeData(prev => ({
            ...prev,
              [routeSchedule.route.route_id]: realtimeResult
          }));
        }
        } catch (error) {
          console.error('Error fetching realtime data:', error);
        }
      });

    } catch (err) {
      console.error('Error fetching stop schedules:', err);
      setStopSchedules(prev => ({ 
        ...prev, 
        [stop.stop_id]: { data: [], related_stop_ids: stop.stop_ids || [stop.stop_id] } // Fallback pour related_stop_ids en cas d'erreur précoce
      }));
    } finally {
      setLoadingSchedules(prev => ({ ...prev, [stop.stop_id]: false }));
    }
  };

  // Charger les horaires quand les arrêts favoris sont chargés
  useEffect(() => {
    if (favoriteStops.length > 0) {
      favoriteStops.forEach(stop => {
        fetchStopSchedules(stop);
      });
    }
  }, [favoriteStops]);

  const toggleDirection = (routeId, direction, stopId) => {
    setExpandedDirections(prev => ({
      ...prev,
      [`${stopId}-${routeId}-${direction}`]: !prev[`${stopId}-${routeId}-${direction}`]
    }));
  };

  const toggleNetworkExpansion = (networkId) => {
    setExpandedNetworks(prev => ({
      ...prev,
      [networkId]: !prev[networkId]
    }));
  };

  // Déplacer le useMemo ici, au niveau supérieur du composant
  const groupedStops = useMemo(() => {
    return favoriteStops.reduce((acc, stop) => {
      if (!acc[stop.network_id]) {
        const networkInfo = favoriteNetworks.find(n => n.network_id === stop.network_id);
        acc[stop.network_id] = {
          network: networkInfo || { 
            network_id: stop.network_id, 
            network_name: stop.network_id, 
            agency_name: stop.network_id 
          },
          stops: []
        };
      }
      acc[stop.network_id].stops.push(stop);
      return acc;
    }, {});
  }, [favoriteStops, favoriteNetworks]);

  // Dans la partie rendu des directions, ajoutons une fonction de tri
  const sortDirections = (schedules) => {
    return schedules.sort((a, b) => {
      // D'abord trier par statut de service
      if (a.hasActiveService && !b.hasActiveService) return -1;
      if (!a.hasActiveService && b.hasActiveService) return 1;

      // Ensuite par présence d'horaires
      if (a.hasSchedules && !b.hasSchedules) return -1;
      if (!a.hasSchedules && b.hasSchedules) return 1;

      // Enfin par nom de direction
      return a.direction.localeCompare(b.direction);
    });
  };

  // Fonction de tri des lignes
  const sortRouteSchedules = (schedules) => {
    return [...schedules].sort((a, b) => {
      // Vérifier si les lignes ont des directions actives
      const aHasActiveDirection = a.directions.some(d => d.hasActiveService && d.hasSchedules);
      const bHasActiveDirection = b.directions.some(d => d.hasActiveService && d.hasSchedules);

      // Si une ligne a une direction active et l'autre non, la ligne active vient en premier
      if (aHasActiveDirection && !bHasActiveDirection) return -1;
      if (!aHasActiveDirection && bHasActiveDirection) return 1;

      // Si les deux lignes sont inactives ou actives, trier par nom de ligne
      return a.route.route_short_name.localeCompare(b.route.route_short_name);
    });
  };

  // Si l'utilisateur n'est pas connecté, afficher le message de connexion requis
  if (!user && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 px-4">
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-dark-800 p-6 rounded-xl shadow-lg text-center">
          <div>
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              Accès restreint
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Vous devez être connecté pour accéder à vos favoris
            </p>
          </div>
          <div>
            <Link
              to="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Se connecter
            </Link>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Pas encore de compte ?{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                S'inscrire
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Chargement en cours...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-6 sm:py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden transition-colors duration-200">
          <div className="bg-gradient-to-r from-cyan-400 to-pink-500 px-6 py-8">
            <div className="flex items-center">
              <div className="mr-4 bg-white/20 rounded-full p-2">
                <svg className="h-10 w-10 text-yellow-400" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white">Mes Favoris</h1>
            </div>
          </div>

          {!user ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Vous devez être connecté à votre compte pour la gestion des favoris</h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Connectez-vous pour accéder à vos réseaux, lignes et arrêts favoris.</p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Se connecter
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Menu de navigation */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="px-6 py-2">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                      onClick={() => setActiveView('networks')}
                      className={`${
                        activeView === 'networks'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition duration-150 ease-in-out`}
                    >
                      Vos réseaux favoris
                    </button>
                    <button
                      onClick={() => setActiveView('stops')}
                      className={`${
                        activeView === 'stops'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition duration-150 ease-in-out`}
                    >
                      Vos arrêts favoris
                    </button>
                  </nav>
                </div>
              </div>

              <div className="px-6 py-6 sm:p-8">
                {activeView === 'networks' ? (
                  <>
                    {loadingFavorites ? (
                      <div className="py-4 flex justify-center">
                        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : favoriteNetworks.length > 0 ? (
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {favoriteNetworks.map((network) => {
                          // Filtrer les lignes pour ce réseau
                          const networkLines = favoriteLines.filter(line => line.network_id === network.network_id);
                          
                          return (
                            <li key={network.network_id} className="py-4">
                              <div className="flex justify-between items-center mb-2">
                                <div 
                                  className="flex items-center flex-grow cursor-pointer"
                                  onClick={() => navigate(`/network/${network.network_id}/lines`)}
                                >
                                  <NetworkLogo 
                                    networkId={network.network_id}
                                    networkName={network.network_name || network.network_id}
                                  />
                                  <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {network.agency_name}
                                      {network.region && (
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                                          ({network.region})
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveNetwork(network.network_id);
                                  }}
                                  className="ml-2 bg-white dark:bg-gray-700 rounded-full p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                                >
                                  <span className="sr-only">Supprimer</span>
                                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                              
                              {/* Lignes du réseau */}
                              <div className="ml-14 mt-2">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Lignes du réseau {network.agency_name.split(' - ')[0]}
                                </h4>
                                {networkLines.length > 0 ? (
                                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {networkLines.map((line) => (
                                      <li key={`${line.network_id}-${line.line_id}`} className="py-2 flex justify-between items-center">
                                        <div 
                                          className="flex items-center flex-grow cursor-pointer"
                                          onClick={() => navigate(`/network/${line.network_id}/line/${line.line_id}/directions`)}
                                        >
                                          <div 
                                            className="min-w-fit h-6 rounded-[10px] flex items-center justify-center px-3" 
                                            style={{ 
                                              backgroundColor: `#${darkenColor(line.line_color)}`,
                                              color: isColorDark(darkenColor(line.line_color)) ? '#FFFFFF' : '#000000'
                                            }}
                                          >
                                            <span className="font-bold text-sm whitespace-nowrap">{line.line_name}</span>
                                          </div>
                                          <div className="ml-3">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{line.line_long_name || line.line_name}</p>
                                          </div>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveLine(line.network_id, line.line_id);
                                          }}
                                          className="ml-2 bg-white dark:bg-gray-700 rounded-full p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                                        >
                                          <span className="sr-only">Supprimer</span>
                                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                          </svg>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Aucune ligne du réseau {network.agency_name} n'est en favoris.</p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">Vous n'avez pas encore de réseaux favoris.</p>
                    )}
                  </>
                ) : (
                  <>
                    {loadingFavorites ? (
                      <div className="py-4 flex justify-center">
                        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : favoriteStops.length > 0 ? (
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {/* Utiliser groupedStops au lieu du useMemo inline */}
                        {Object.entries(groupedStops).map(([networkId, networkGroup]) => {
                          const displayNetwork = networkGroup.network;
                          const isNetworkExpanded = !!expandedNetworks[networkId];

                          return (
                            <li key={networkId} className="py-4">
                              {/* En-tête du réseau - Cliquable pour expand/collapse */}
                              <div 
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                onClick={() => toggleNetworkExpansion(networkId)}
                              >
                                <div className="flex items-center">
                                  <NetworkLogo 
                                    networkId={displayNetwork.network_id}
                                    networkName={displayNetwork.network_name || displayNetwork.agency_name}
                                  />
                                  <div className="ml-3">
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                      {displayNetwork.agency_name || displayNetwork.network_name}
                                      {displayNetwork.region && (
                                        <span className="text-gray-500 dark:text-gray-400 ml-1 text-sm font-normal">
                                          ({displayNetwork.region})
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className={`transform transition-transform duration-200 ${isNetworkExpanded ? 'rotate-180' : ''}`}>
                                  <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Liste des arrêts pour ce réseau - Conditionnellement rendue */}
                              {isNetworkExpanded && (
                                <ul className="mt-3 space-y-4 pl-2 pr-2">
                                  {networkGroup.stops.map((stop) => { // stop est l'objet favori
                                    const scheduleInfo = stopSchedules[stop.stop_id]; // Peut être undefined ou { data: [], related_stop_ids: [] }
                                    return (
                                      <li key={`${stop.network_id}-${stop.stop_id}`} className="py-3 last:border-0">
                                        <div className="flex flex-col space-y-3">
                                          {/* En-tête de l'arrêt */}
                                          <div className="flex justify-between items-start py-4">
                                            <div 
                                              className="flex-grow cursor-pointer group"
                                              onClick={() => navigate(`/horaires?stop=${stop.stop_id}&network=${stop.network_id}`)}
                                            >
                                              <div className="flex-grow">
                                                <p className="text-2xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                  {stop.stop_name}
                                                </p>
                                                {scheduleInfo && scheduleInfo.original_stops && scheduleInfo.original_stops[0]?.city && (
                                                  <p className="text-sm italic text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {scheduleInfo.original_stops[0].city}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveStop(stop.network_id, stop.stop_id);
                                              }}
                                              className="ml-4 text-yellow-400 hover:text-yellow-500 transition-colors p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full"
                                              aria-label="Retirer des favoris"
                                            >
                                              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                              </svg>
                                            </button>
                                          </div>

                                          {/* Séparateur décoratif */}
                                          <div className="relative py-3">
                                            <div className="absolute inset-0 flex items-center">
                                              <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
                                            </div>
                                          </div>

                                          {/* Section des prochains passages */}
                                          <div className="w-full pt-4">
                                            {loadingSchedules[stop.stop_id] ? (
                                              <LoadingPlaceholder />
                                            ) : scheduleInfo && scheduleInfo.data && scheduleInfo.data.length > 0 ? (
                                              <div className="space-y-2">
                                                {sortRouteSchedules(scheduleInfo.data).map((routeSchedule, routeIndex) => (
                                                  <div key={routeIndex} className="bg-white dark:bg-dark-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                                    {sortDirections(routeSchedule.directions).map((directionInfo, dirIndex) => {
                                                      // Filtrer les départs ici dans le JSX pour utiliser le state realtimeData le plus à jour
                                                      const upcomingDepartures = directionInfo.departures // Contient tous les départs théoriques
                                                        .filter(departure => isUpcomingDeparture(
                                                          departure,
                                                          routeSchedule.route.route_id,
                                                          departure.trip_id,
                                                          departure.stop_id,
                                                          scheduleInfo ? scheduleInfo.related_stop_ids : []
                                                        ))
                                                        .slice(0, 2); // Prendre les 2 prochains passages pertinents

                                                      const hasDisplayableUpcomingDepartures = upcomingDepartures.length > 0;
                                                      const isActiveService = directionInfo.hasActiveService;

                                                      // Déterminer si la ligne/direction doit être estompée
                                                      const shouldDimRow = !isActiveService || (isActiveService && !hasDisplayableUpcomingDepartures);

                                                      return (
                                                        <div key={dirIndex}>
                                                          <div 
                                                            className={`${shouldDimRow ? 'opacity-60' : ''}`}
                                                          >
                                                            <div 
                                                              className="flex items-center p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                              onClick={() => toggleDirection(routeSchedule.route.route_id, directionInfo.direction, stop.stop_id)}
                                                            >
                                                              <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center">
                                                                  <div 
                                                                    className="w-12 h-8 rounded-[8px] flex items-center justify-center font-bold text-sm px-1"
                                                                    style={{ 
                                                                      backgroundColor: `#${routeSchedule.route.route_color || '3B82F6'}`,
                                                                      color: `#${routeSchedule.route.route_text_color || 'FFFFFF'}` 
                                                                    }}
                                                                  >
                                                                    <span className="truncate max-w-full">{routeSchedule.route.route_short_name}</span>
                                                                  </div>
                                                                  <div className="flex items-center ml-2">
                                                                    <FaArrowRight className="text-gray-400 mx-2" size={12} />
                                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                                      {directionInfo.direction}
                                                                    </span>
                                                                  </div>
                                                                </div>
                                                                <div className={`transform transition-transform duration-200 ${expandedDirections[`${stop.stop_id}-${routeSchedule.route.route_id}-${directionInfo.direction}`] ? 'rotate-180' : ''}`}>
                                                                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                  </svg>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                          
                                                          {expandedDirections[`${stop.stop_id}-${routeSchedule.route.route_id}-${directionInfo.direction}`] && (
                                                            <div className={`p-2 ${shouldDimRow ? 'opacity-60' : ''}`}>
                                                              {!isActiveService ? (
                                                                <div className="p-3 text-center text-gray-700 dark:text-gray-400 font-medium">Cette ligne ne circule pas ce jour</div>
                                                              ) : !hasDisplayableUpcomingDepartures ? (
                                                                <div className="p-3 text-center text-gray-800 dark:text-gray-300 font-medium">Fin de service</div>
                                                              ) : (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                  {upcomingDepartures.map((departure, depIndex) => {
                                                                    const rtInfo = getRealtimeInfo(
                                                                      routeSchedule.route.route_id, 
                                                                      departure.trip_id, 
                                                                      departure.stop_id, // stop_id du passage effectif
                                                                      scheduleInfo ? scheduleInfo.related_stop_ids : [] // Liste des stop_ids du groupe
                                                                    );
                                                                    const theoreticalTime = formatTime(departure.departure_time);
                                                                    let finalDisplayTime;
                                                                    let calculatedDelayMinutes;

                                                                    if (rtInfo.actualTime) {
                                                                      const actualTimeDateObj = new Date(rtInfo.actualTime);
                                                                      finalDisplayTime = `${actualTimeDateObj.getHours().toString().padStart(2, '0')}:${actualTimeDateObj.getMinutes().toString().padStart(2, '0')}`;
                                                                      const [tH, tM] = theoreticalTime.split(':').map(Number);
                                                                      const theoreticalTotalMinutes = tH * 60 + tM;
                                                                      const actualTotalMinutes = actualTimeDateObj.getHours() * 60 + actualTimeDateObj.getMinutes();
                                                                      calculatedDelayMinutes = actualTotalMinutes - theoreticalTotalMinutes;
                                                                    } else {
                                                                      calculatedDelayMinutes = rtInfo.hasRealtimeUpdate ? rtInfo.delay : 0;
                                                                      if (rtInfo.hasRealtimeUpdate && calculatedDelayMinutes !== 0) {
                                                                        const [schedH, schedM] = theoreticalTime.split(':').map(Number);
                                                                        const newTimeObj = new Date();
                                                                        newTimeObj.setHours(schedH, schedM + calculatedDelayMinutes, 0, 0);
                                                                        finalDisplayTime = `${newTimeObj.getHours().toString().padStart(2, '0')}:${newTimeObj.getMinutes().toString().padStart(2, '0')}`;
                                                                      } else {
                                                                        finalDisplayTime = theoreticalTime;
                                                                        calculatedDelayMinutes = 0;
                                                                      }
                                                                    }

                                                                    const showTheoreticalStripped = rtInfo.hasRealtimeUpdate && finalDisplayTime !== theoreticalTime;
                                                                    let timeColorClass = '';
                                                                    if (calculatedDelayMinutes === 0 && rtInfo.hasRealtimeUpdate) {
                                                                      timeColorClass = 'text-green-500 dark:text-green-400';
                                                                    } else if (calculatedDelayMinutes > 0) {
                                                                      timeColorClass = 'text-red-500 dark:text-red-400';
                                                                    } else if (calculatedDelayMinutes < 0) {
                                                                      timeColorClass = 'text-orange-500 dark:text-orange-400';
                                                                    } else {
                                                                      timeColorClass = 'text-gray-900 dark:text-white';
                                                                    }

                                                                    const hasDelay = rtInfo.hasRealtimeUpdate && calculatedDelayMinutes !== 0;
                                                                    const isLate = calculatedDelayMinutes > 0;

                                                                    // Vérifier si c'est le dernier passage
                                                                    const isLastDeparture = depIndex === upcomingDepartures.length - 1 && 
                                                                      directionInfo.departures.filter(d => 
                                                                        isUpcomingDeparture(
                                                                          d,
                                                                          routeSchedule.route.route_id,
                                                                          d.trip_id,
                                                                          d.stop_id,
                                                                          scheduleInfo ? scheduleInfo.related_stop_ids : []
                                                                        )
                                                                      ).length === upcomingDepartures.length;

                                                                    return (
                                                                      <div key={depIndex} className="grid grid-cols-1 w-full">
                                                                        <TimeDisplay
                                                                          theoreticalTime={theoreticalTime}
                                                                          finalDisplayTime={finalDisplayTime}
                                                                          calculatedDelayMinutes={calculatedDelayMinutes}
                                                                          showTheoreticalStripped={showTheoreticalStripped}
                                                                          timeColorClass={timeColorClass}
                                                                          hasRealtimeInfo={rtInfo.hasRealtimeUpdate}
                                                                          isLate={isLate}
                                                                          isLastDeparture={isLastDeparture}
                                                                        />
                                                                      </div>
                                                                    );
                                                                  })}
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                                                Aucun passage programmé pour cet arrêt actuellement.
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">Vous n'avez pas encore d'arrêts favoris.</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Favorites; 