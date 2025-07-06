import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase, getTodayForSupabase } from '../services/supabase';
import { fetchSiriRealtimeData, fetchRealtimeData, fetchVehiclePositionData } from '../services/realtime';
import MarqueeSelect from './MarqueeSelect';
import { getCachedData, invalidateCache } from '../utils/supabaseCache';
// Importer les composants extraits
import { 
  TimetableHeader, 
  TimetableControls, 
  StopsTimeline, 
  VehicleTimeline 
} from './Timetable/index';
import { FaBus } from "react-icons/fa";
import ReactDOMServer from 'react-dom/server';
import { getActiveTrafficInfo } from '../services/trafficInfo';
import { fetchAllStopTimesForStops } from '../services/timetableService'; // Importer le nouveau service

// Durée de l'animation de glissement en millisecondes
const VEHICLE_ANIMATION_DURATION = 1000;

// Fonction pour déterminer si une couleur est foncée
function isColorDark(hexColor) {
  if (!hexColor) return true;
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

// Fonction pour assombrir une couleur hexadécimale
const darkenColor = (color) => {
  // Si pas de couleur, retourne la couleur par défaut
  if (!color) return '000000';
  
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

const Timetable = () => {
  const { networkId, lineId, directionId } = useParams();
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const rtlPluginInitialized = useRef(false);
  const [showMap, setShowMap] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [stopTimes, setStopTimes] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [trips, setTrips] = useState([]);
  const [currentTripIndex, setCurrentTripIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lineInfo, setLineInfo] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [directions, setDirections] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isManualNavigation, setIsManualNavigation] = useState(false);
  const lastManualNavigationTime = useRef(0);
  const [lastSelectedTripIndex, setLastSelectedTripIndex] = useState(null);
  const [stopConnections, setStopConnections] = useState({});
  const [selectedDirection, setSelectedDirection] = useState(directionId);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const directionRef = useRef(null);
  const [realtimeDelays, setRealtimeDelays] = useState({});
  const [realtimeUpdatedTimes, setRealtimeUpdatedTimes] = useState({});
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(true);
  const [realtimeError, setRealtimeError] = useState(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const realtimeInterval = useRef(null);
  const [isChangingTrip, setIsChangingTrip] = useState(false);
  const [preloadedRealtimeData, setPreloadedRealtimeData] = useState({});
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState(null);
  const [realtimeAvailable, setRealtimeAvailable] = useState(false);
  const [siriDataAvailable, setSiriDataAvailable] = useState(false);
  const [delaysData, setDelaysData] = useState({});
  const [updatedTimesData, setUpdatedTimesData] = useState({});
  const [skippedStopsData, setSkippedStopsData] = useState({}); // Nouvelle variable d'état pour les arrêts supprimés
  const [selectedTripIndex, setSelectedTripIndex] = useState(0);
  const [isMapUpdating, setIsMapUpdating] = useState(false); // Add state for map update status
  const loadRealtimeDataRef = useRef(null);
  
  // Ajouter les états pour la position des véhicules
  const [vehiclePositions, setVehiclePositions] = useState({});
  const [vehiclePositionLoading, setVehiclePositionLoading] = useState(false);
  const [vehiclePositionError, setVehiclePositionError] = useState(null);
  const vehicleMarkers = useRef({}); // Pour stocker les marqueurs Mapbox des véhicules
  const vehicleAnimationState = useRef({}); // { vehicleId: { lastPos: {lon, lat}, targetPos: {lon, lat}, startTime: number, animationFrameId: number | null } }
  const isMapMoving = useRef(false); // Pour savoir si l'utilisateur interagit avec la carte

  // --- State pour le panneau latéral du véhicule ---
  const [selectedVehicleTripId, setSelectedVehicleTripId] = useState(null);
  const [selectedVehicleStopTimes, setSelectedVehicleStopTimes] = useState([]);
  const [vehicleTimelineLoading, setVehicleTimelineLoading] = useState(false);
  const [vehicleTimelineError, setVehicleTimelineError] = useState(null);
  const [showVehicleTimeline, setShowVehicleTimeline] = useState(false);
  const [selectedVehicleInfo, setSelectedVehicleInfo] = useState(null); // Pour stocker d'autres infos si besoin
  const [selectedVehicleBrand, setSelectedVehicleBrand] = useState(null);
  const [selectedVehicleModel, setSelectedVehicleModel] = useState(null);
  const [vehicleDetailsLoading, setVehicleDetailsLoading] = useState(false);
  const [selectedVehicleShape, setSelectedVehicleShape] = useState(null);
  const [selectedVehicleShapeLoading, setSelectedVehicleShapeLoading] = useState(false);
  const [selectedVehicleShapeError, setSelectedVehicleShapeError] = useState(null);
  // --- Fin state panneau ---

  // Ajouter un état pour le verrouillage des clics
  const [vehicleShapeLock, setVehicleShapeLock] = useState(false);

  // État pour les voyages annulés
  const [realtimeStatus, setRealtimeStatus] = useState('loading');
  const [cancelledTrips, setCancelledTrips] = useState([]);
  
  // État pour les retards manuels
  const [manualDelayedTrips, setManualDelayedTrips] = useState([]);
  const [trafficInfos, setTrafficInfos] = useState([]);
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const controlsRef = useRef(null);

  // Ajouter les états pour les informations du véhicule courant
  const [currentVehicleBrand, setCurrentVehicleBrand] = useState(null);
  const [currentVehicleModel, setCurrentVehicleModel] = useState(null);
  const [currentVehicleId, setCurrentVehicleId] = useState(null);
  const [currentVehicleLoading, setCurrentVehicleLoading] = useState(false);

  // Ajouter la fonction pour récupérer les informations du véhicule
  const fetchCurrentVehicleDetails = async (tripId) => {
    if (!tripId || !networkId) {
      setCurrentVehicleBrand(null);
      setCurrentVehicleModel(null);
      setCurrentVehicleId(null);
      return;
    }

    setCurrentVehicleLoading(true);
    try {
      // Chercher d'abord le véhicule dans les positions temps réel
      let vehicleId = null;
      
      // Parcourir toutes les positions de véhicules
      Object.entries(vehiclePositions).forEach(([vId, data]) => {
        // Vérifier si le tripId correspond
        if (data.tripId === tripId) {
          // Extraire l'ID du véhicule
          if (data.vehicleId) {
            // Si l'ID est dans le format KOI239107, le garder tel quel
            vehicleId = data.vehicleId;
          } else if (vId.includes(':')) {
            // Si l'ID est dans le format VM:8957, prendre la partie après le :
            vehicleId = vId.split(':')[1];
          } else {
            // Sinon utiliser l'ID tel quel
            vehicleId = vId;
          }
        }
      });

      if (!vehicleId) {
        setCurrentVehicleBrand(null);
        setCurrentVehicleModel(null);
        setCurrentVehicleId(null);
        return;
      }

      setCurrentVehicleId(vehicleId);

      // Récupérer les détails du véhicule
      const { data, error } = await supabase
        .from('vehicle_details')
        .select('brand, model')
        .eq('network_id', networkId)
        .eq('vehicle_id', vehicleId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          // // // // // console.error('[Vehicle Details] Error fetching details:', error);
        }
        setCurrentVehicleBrand(null);
        setCurrentVehicleModel(null);
      } else if (data) {
        setCurrentVehicleBrand(data.brand);
        setCurrentVehicleModel(data.model);
      }
    } catch (error) {
      // // // // // console.error('[Vehicle Details] Exception fetching details:', error);
      setCurrentVehicleBrand(null);
      setCurrentVehicleModel(null);
    } finally {
      setCurrentVehicleLoading(false);
    }
  };

  // Ajouter un effet pour mettre à jour les informations du véhicule quand le trip change
  useEffect(() => {
    if (trips[currentTripIndex]) {
      fetchCurrentVehicleDetails(trips[currentTripIndex].trip_id);
    }
  }, [currentTripIndex, trips, vehiclePositions]);

  const findCurrentTrip = () => {
    if (!trips || !selectedTime || trips.length === 0) return null;
    
    // Extraire les heures et minutes du temps sélectionné
    const [hours, minutes] = selectedTime.split(':').map(Number);
    
    // Créer une nouvelle date avec les heures et minutes sélectionnées
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    
    // Convertir en secondes depuis minuit pour la comparaison
    const targetSeconds = hours * 3600 + minutes * 60;
    
    // Convertir tous les temps de départ en secondes depuis minuit
    const tripTimes = trips.map(trip => {
      if (!trip.first_departure) return { trip, seconds: 0 };
      
      const time = trip.first_departure;
      const parts = time.split(':').map(Number);
      
      // Si le format n'est pas valide, retourner 0
      if (parts.length < 2) return { trip, seconds: 0 };
      
      const [depHours, depMinutes, depSeconds = 0] = parts;
      const depTimeSeconds = depHours * 3600 + depMinutes * 60 + depSeconds;
      
      return { trip, seconds: depTimeSeconds };
    });
    
    // Trouver le trajet le plus proche du temps cible
    let closest = null;
    let minDiff = Infinity;
    
    for (const { trip, seconds } of tripTimes) {
      const diff = Math.abs(seconds - targetSeconds);
      
      if (diff < minDiff) {
        minDiff = diff;
        closest = trip;
      }
    }
    
    // Mettre à jour le trajet sélectionné
    setSelectedTrip(closest);
    
    return closest;
  };

  useEffect(() => {
    if (!window.mapboxgl) {
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.async = true;
      
      script.onload = () => {
        const link = document.createElement('link');
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        window.mapboxgl.accessToken = 'pk.eyJ1Ijoid2VpYmVsY2xlbWVudDYwIiwiYSI6ImNtMm9yZ3JpaDA4OGQybHIxcTBibHk4NXQifQ.iUZ4I9uI1lIWgamjWnDIYg';
        
        // Désactiver le spinner de chargement de Mapbox (une seule fois)
        if (!rtlPluginInitialized.current) {
          try {
            window.mapboxgl.setRTLTextPlugin(
              'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
              null,
              true // Désactiver l'avertissement
            );
            rtlPluginInitialized.current = true;
          } catch (e) {
            // // // // console.warn('RTL Text Plugin already initialized:', e);
          }
        }
      };

      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    } else {
      // Si mapboxgl est déjà chargé, désactiver le spinner (une seule fois)
      if (!rtlPluginInitialized.current) {
        try {
          window.mapboxgl.setRTLTextPlugin(
            'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
            null,
            true
          );
          rtlPluginInitialized.current = true;
        } catch (e) {
          // // // // console.warn('RTL Text Plugin already initialized:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    const fetchCities = async () => {
      if (!window.mapboxgl) return;

      try {
        const { data: allStopsData, error: stopsError } = await supabase
          .from('stops')
          .select('*')
          .eq('network_id', networkId);

        if (stopsError) throw stopsError;

        const stopsWithoutCity = allStopsData
          .filter(stop => !stop.city && stop.stop_lat && stop.stop_lon);

        if (stopsWithoutCity.length === 0) return;

        const batchSize = 10;
        for (let i = 0; i < stopsWithoutCity.length; i += batchSize) {
          const batch = stopsWithoutCity.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (stop) => {
            try {
              const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${stop.stop_lon},${stop.stop_lat}.json?access_token=${window.mapboxgl.accessToken}&types=place&language=fr`
              );
              const data = await response.json();
              const city = data.features?.[0]?.text;

              if (city) {
                await supabase
                  .from('stops')
                  .update({ city })
                  .eq('stop_id', stop.stop_id)
                  .eq('network_id', networkId);
              }
            } catch (error) {
              // // // // console.error('Error fetching city:', error);
            }
          }));

          if (i + batchSize < stopsWithoutCity.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        // // // // console.error('Error in fetchCities:', error);
      }
    };

    fetchCities();
  }, [networkId]);

  // Ajouter une fonction utilitaire pour les requêtes Supabase avec nouvelle tentative
  const fetchWithRetry = async (supabaseQuery, maxRetries = 2, retryDelay = 1000) => {
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Exécuter la requête
        const result = await supabaseQuery;
        
        // Vérifier s'il y a une erreur dans la réponse Supabase
        if (result.error) {
          // Si c'est une erreur de timeout, on va réessayer
          if (result.error.message && (
              result.error.message.includes('timeout') || 
              result.error.message.includes('canceling statement')
          )) {
            lastError = result.error;
            // // // // console.warn(`Requête annulée pour timeout (tentative ${attempt + 1}/${maxRetries + 1}): ${result.error.message}`);
            
            // Attendre avant de réessayer
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
              continue;
            }
          }
          // Pour les autres erreurs, les renvoyer immédiatement
          throw result.error;
        }
        
        // Succès, retourner les données
        return result.data;
      } catch (error) {
        lastError = error;
        // // // // console.error(`Erreur lors de la tentative ${attempt + 1}/${maxRetries + 1}:`, error);
        
        // Si ce n'est pas la dernière tentative, attendre avant de réessayer
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }
    
    // Si on arrive ici, toutes les tentatives ont échoué
    throw lastError;
  };

  useEffect(() => {
    // Log des dépendances du useEffect avant d'appeler fetchData // À SUPPRIMER
    // // // // // // console.log(`[useEffect for fetchData] Triggered with: networkId=${networkId}, lineId=${lineId}, directionId=${directionId}, selectedDate=${selectedDate.toISOString()}, selectedTime=${selectedTime}`); // À SUPPRIMER

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Debugging variables
        const missedStopLogs = new Set();
        
        // Create a special utility for resolving stop IDs in a flexible way
        const resolveStopId = (stopId, stopsMap) => {
          // If the exact ID exists, use it
          if (stopsMap.has(stopId)) return stopId;
          
          // Try removing department prefix if present
          if (stopId.includes(':')) {
            const unprefixedId = stopId.split(':')[1];
            if (stopsMap.has(unprefixedId)) return unprefixedId;
          }
          
          // Try adding department prefixes if not present
          if (!stopId.includes(':')) {
            const departmentPrefixes = ['60:', '95:', '75:', '77:', '78:', '91:', '92:', '93:', '94:'];
            for (const prefix of departmentPrefixes) {
              const prefixedId = `${prefix}${stopId}`;
              if (stopsMap.has(prefixedId)) return prefixedId;
            }
          }
          
          // If all else fails, return the original ID
          return stopId;
        };
        
        // Récupérer les informations de la ligne avec cache
        const lineData = await getCachedData(
          `line-${lineId}-${networkId}`,
          async () => {
            return await fetchWithRetry(
              supabase
                .from('routes')
                .select('*')
                .eq('route_id', lineId)
                .eq('network_id', networkId)
                .single()
            );
          }
        );
        
        setLineInfo(lineData);
        
        // --- Récupération des directions via RPC avec cache --- 
        const directionsRpcData = await getCachedData(
          `directions-${lineId}-${networkId}`,
          async () => {
            try {
              const { data, error } = await supabase.rpc(
                'get_route_directions', 
                {
                  route_id_param: lineId, 
                  network_id_param: networkId
                }
              );

              if (error) {
                if (error.code === '42883') {
                  // // // // console.error('PostgreSQL function \'get_route_directions\' not found or signature mismatch.', error);
                  return []; // Retourner tableau vide en cas d'erreur de fonction
                } else {
                  throw error; // Lancer les autres erreurs RPC
                }
              }
              
              return data || [];
            } catch (error) {
              console.error('Erreur lors de la récupération des directions:', error);
              return [];
            }
          }
        );
        
        // Formater les données pour le MarqueeSelect
        const formattedDirections = directionsRpcData.map(dir => ({
          value: dir.direction_id, // La valeur reste l'ID de direction
          label: (Array.isArray(dir.terminus_names) && dir.terminus_names.length > 0) 
                 ? dir.terminus_names.join(' / ') // Joindre les noms de terminus
                 : `Direction ${dir.direction_id}` // Fallback si pas de nom
        }));
        setDirections(formattedDirections);
        // --- Fin récupération des directions --- 

        // Utiliser la fonction getTodayForSupabase pour obtenir les dates correctement formattées
        const { dayOfWeek, dateStr } = (() => {
          // Créer une copie locale de selectedDate
          const localDate = new Date(selectedDate);
          
          // Formater manuellement en YYYY-MM-DD en tenant compte du fuseau horaire local
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, '0');
          const dayNum = String(localDate.getDate()).padStart(2, '0');
          const formatted = `${year}-${month}-${dayNum}`;
          
          // Obtenir le jour de la semaine en tenant compte du fuseau horaire local
          const weekDay = localDate.getDay();
          
          return { dayOfWeek: weekDay, dateStr: formatted };
        })();
        
        // Récupérer les données du calendrier avec cache
        const calendarData = await getCachedData(
          `calendar-${networkId}`,
          async () => {
            return await fetchWithRetry(
              supabase
                .from('calendar')
                .select('service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, subnetwork_name')
                .eq('network_id', networkId)
            );
          }
        );

        // Récupérer les exceptions du calendrier avec cache par date
        // Note: La clé inclut la date pour que le cache soit spécifique à chaque jour
        const exceptionsData = await getCachedData(
          `calendar-exceptions-${networkId}-${dateStr}`,
          async () => {
            return await fetchWithRetry(
              supabase
                .from('calendar_dates')
                .select('service_id, exception_type, date, subnetwork_name')
                .eq('network_id', networkId)
                .eq('date', dateStr)
            );
          }
        );



        // Fonction utilitaire pour convertir les dates GTFS du format YYYYMMDD vers un objet Date
        const parseGtfsDate = (dateStr) => {
          if (!dateStr) {
            // // // console.debug(`Date GTFS manquante`);
            return null;
          }
          
          let year, month, day;
          
          // Traiter le format ISO (YYYY-MM-DD) si présent
          if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length !== 3) {
              // // // console.debug(`Format de date ISO invalide: ${dateStr} (devrait être YYYY-MM-DD)`);
              return null;
            }
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1; // Les mois dans Date sont 0-indexed
            day = parseInt(parts[2], 10);
          } 
          // Traiter le format GTFS standard (YYYYMMDD)
          else if (dateStr.length === 8) {
            year = parseInt(dateStr.substring(0, 4), 10);
            month = parseInt(dateStr.substring(4, 6), 10) - 1; // Les mois dans Date sont 0-indexed
            day = parseInt(dateStr.substring(6, 8), 10);
          } 
          else {
            // // // console.debug(`Format de date non reconnu: ${dateStr} (devrait être YYYYMMDD ou YYYY-MM-DD)`);
            return null;
          }
          
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            // // // console.debug(`Erreur de parsing pour la date: ${dateStr}`);
            return null;
          }
          
          // Vérifier si les valeurs sont dans des plages valides avant de créer l'objet Date
          if (year < 2000 || year > 2050 || month < 0 || month > 11 || day < 1 || day > 31) {
            // // // console.debug(`Valeurs de date hors limites: année=${year}, mois=${month+1}, jour=${day}`);
            return null;
          }
          
          const date = new Date(year, month, day);
          
          // Vérification de validité
          if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
            // // // console.debug(`Date invalide créée à partir de ${dateStr}: ${date.toISOString().split('T')[0]}`);
            return null;
          }
          
          return date;
        };

        // Fonction utilite pour comparer si deux dates sont le même jour (ignore l'heure)
        const isSameDay = (date1, date2) => {
          if (!date1 || !date2) return false;
          
          return date1.getFullYear() === date2.getFullYear() &&
                 date1.getMonth() === date2.getMonth() &&
                 date1.getDate() === date2.getDate();
        };

        let validServiceIds = calendarData
          .filter(service => {
            // LOG SPÉCIFIQUE POUR expl-6_MERCREDI // À SUPPRIMER
            // if (service.service_id === 'expl-6_MERCREDI') { // À SUPPRIMER
            //   // // // // // console.log('[DEBUG expl-6_MERCREDI] Inside filter. Service data:', JSON.stringify(service)); // À SUPPRIMER
            // } // À SUPPRIMER

            const startDate = parseGtfsDate(service.start_date);
            const endDate = parseGtfsDate(service.end_date);
            const selectedDateObj = new Date(dateStr); 
            
            // if (service.service_id === 'expl-6_MERCREDI') { // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] selectedDateObj (from dateStr "${dateStr}"):`, selectedDateObj.toISOString(), selectedDateObj.toString()); // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] parsed startDate (from "${service.start_date}"):`, startDate ? startDate.toISOString() : 'null', startDate ? startDate.toString() : 'null'); // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] parsed endDate (from "${service.end_date}"):`, endDate ? endDate.toISOString() : 'null', endDate ? endDate.toString() : 'null'); // À SUPPRIMER
            // } // À SUPPRIMER

            if (!startDate || !endDate) {
              return false;
            }
            
            const selectedDateUTCMidnight = new Date(Date.UTC(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate()));
            const startDateUTCMidnight = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
            const endDateUTCMidnight = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));

            const isStartValid = selectedDateUTCMidnight >= startDateUTCMidnight;
            const isEndValid = selectedDateUTCMidnight <= endDateUTCMidnight;
            const isDateValid = isStartValid && isEndValid;
            
            const dayField = dayOfWeek === 0 ? 'sunday' : 
                           dayOfWeek === 1 ? 'monday' : 
                           dayOfWeek === 2 ? 'tuesday' : 
                           dayOfWeek === 3 ? 'wednesday' : 
                           dayOfWeek === 4 ? 'thursday' : 
                           dayOfWeek === 5 ? 'friday' : 'saturday';
            const runsOnDay = service[dayField] === true;

            // if (service.service_id === 'expl-6_MERCREDI') { // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] For date ${dateStr} (day ${dayOfWeek}):`); // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] UTC Dates: selected=${selectedDateUTCMidnight.toISOString()}, start=${startDateUTCMidnight.toISOString()}, end=${endDateUTCMidnight.toISOString()}`); // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] isStartValid: ${isStartValid}, isEndValid: ${isEndValid}, isDateValid: ${isDateValid}`); // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] dayField: ${dayField}, runsOnDay: ${runsOnDay}`); // À SUPPRIMER
            //   // // // // // console.log(`[DEBUG expl-6_MERCREDI] Filter result: ${isDateValid && runsOnDay}`); // À SUPPRIMER
            // } // À SUPPRIMER
            
            if (!isDateValid) {
              // // // console.debug(`Service ${service.service_id} invalide car date ${dateStr} n'est pas entre ${service.start_date} (${startDate}) et ${service.end_date} (${endDate})`);
              // // // console.debug(`Comparaison: ${selectedDateObj} >= ${startDate} = ${isStartValid}, ${selectedDateObj} <= ${endDate} = ${isEndValid}`);
            }
            if (!runsOnDay) {
              // // // console.debug(`Service ${service.service_id} invalide car ne circule pas le ${dayField}`);
            }

            return isDateValid && runsOnDay;
          })
          .map(service => service.service_id);
          
        // // // // // console.log(`${validServiceIds.length} service_id valides trouvés pour le ${dateStr}`);
        if (validServiceIds.length > 0) {
          // // // // // console.log(`Exemple de service_id valides: ${validServiceIds.slice(0, 5).join(', ')}${validServiceIds.length > 5 ? '...' : ''}`);
        }

        if (exceptionsData && exceptionsData.length > 0) {
          validServiceIds = validServiceIds.filter(serviceId => {
            const exception = exceptionsData.find(e => e.service_id === serviceId);
            // Si pas d'exception, garder le service
            if (!exception) return true;
            // Si exception de type 2 (suppression), ne pas garder le service
            if (exception.exception_type === 2) return false;
            // Si exception de type 1 (ajout), garder le service
            return true;
          });

          const addedServices = exceptionsData
            .filter(e => e.exception_type === 1)
            .map(e => e.service_id);
          
          validServiceIds = [...new Set([...validServiceIds, ...addedServices])];
        }

        // Si aucun service valide, afficher un message
        if (validServiceIds.length === 0) {
          setLoading(false);
          setTrips([]);
          // Log ajouté pour clarifier pourquoi on s'arrête ici
          // // // // console.warn('[fetchData DEBUG] Aucun service_id valide trouvé APRÈS filtrage calendar et exceptions. Arrêt.');
          return;
        }

        // Log 2 & 3: Paramètres finaux avant la requête trips
        // // // // // console.log('[fetchData DEBUG] Final validServiceIds before trips query:', JSON.stringify(validServiceIds));
        // // // // // console.log(`[fetchData DEBUG] Querying trips with: lineId=${lineId}, networkId=${networkId}, directionId=${directionId}`);

        // Récupérer tous les trips en une seule requête
        const { data: allTripsData, error: tripsError } = await supabase
          .from('trips')
          .select('*, subnetwork_name')
          .eq('route_id', lineId)
          .eq('network_id', networkId)
          .eq('direction_id', directionId)
          .in('service_id', validServiceIds);

        if (tripsError) {
          // Log 4: Erreur de la requête Supabase
          console.error('[fetchData DEBUG] Supabase trips query error object:', JSON.stringify(tripsError));
          throw tripsError;
        }
        
        // Ajout des console.logs pour afficher les trip_id chargés
        console.log(`[fetchData] Nombre total de trajets chargés: ${allTripsData.length}`);
        console.log('[fetchData] Liste des trip_id chargés:', allTripsData.map(trip => trip.trip_id));
        
        // // // // // console.log(`[fetchData] Récupération de ${allTripsData.length} trajets pour la ligne ${lineId}, direction ${directionId}`);

        // Log 5: Requête de contrôle si aucun trajet n'est trouvé avec les service_id valides
        if (allTripsData.length === 0 && validServiceIds.length > 0) {
          // // // // console.warn(`[fetchData DEBUG] Main trips query returned 0 results for line ${lineId}, direction ${directionId}, network ${networkId} with ${validServiceIds.length} service IDs: ${JSON.stringify(validServiceIds.slice(0,10))}...`);
          // // // // // console.log(`[fetchData DEBUG] CONTROL QUERY: Checking trips for line ${lineId}, network ${networkId}, direction ${directionId} WITHOUT service_id filter.`);
          try {
            const { data: controlTripsData, error: controlTripsError } = await supabase
              .from('trips')
              .select('service_id, trip_id, route_id, direction_id, network_id') // Select relevant fields
              .eq('route_id', lineId)
              .eq('network_id', networkId)
              .eq('direction_id', directionId)
              .limit(100); // Limit to avoid fetching too much

            if (controlTripsError) {
              // // // // console.error('[fetchData DEBUG] CONTROL QUERY error:', JSON.stringify(controlTripsError));
            } else if (controlTripsData && controlTripsData.length > 0) {
              const foundServiceIds = [...new Set(controlTripsData.map(t => t.service_id))].sort();
              // // // // // console.log(`[fetchData DEBUG] CONTROL QUERY found ${controlTripsData.length} trips. Distinct service_ids found on this route/direction/network:`, JSON.stringify(foundServiceIds));
              // // // // // console.log('[fetchData DEBUG] Compare these with the validServiceIds calculated earlier:', JSON.stringify(validServiceIds.sort()));
            } else {
              // // // // // console.log('[fetchData DEBUG] CONTROL QUERY also found 0 trips for this route, network, and direction, even without service_id filter.');
            }
          } catch (e) {
            // // // // console.error('[fetchData DEBUG] CONTROL QUERY exception:', e);
          }
        }
        
        // Obtenir la liste des trip_ids valides
        const validTripIds = allTripsData.map(trip => trip.trip_id);

        // Récupérer les voyages annulés pour la date actuelle
        const { data: cancelledTripsData, error: cancelledTripsError } = await supabase
          .from('cancelled_trips')
          .select('*')
          .eq('network_id', networkId)
          .eq('cancellation_date', dateStr) // Utiliser la même date que pour les service_id
          .in('trip_id', validTripIds);
          
        if (cancelledTripsError) {
          // // // // console.error('[fetchData] Erreur lors de la récupération des voyages annulés:', cancelledTripsError);
        } else {
          // // // // // console.log(`[fetchData] ${cancelledTripsData.length} voyages annulés récupérés`);
          setCancelledTrips(cancelledTripsData || []);
        }

        // Récupérer les voyages retardés manuellement pour la date actuelle
        try {
          const { data: delayedTripsData, error: delayedTripsError } = await supabase
            .from('delayed_trips')
            .select('*')
            .eq('network_id', networkId)
            .eq('delay_date', dateStr) // Utiliser la même date que pour les service_id
            .in('trip_id', validTripIds);
            
          if (delayedTripsError) {
            // // // // console.error('[fetchData] Erreur lors de la récupération des voyages retardés:', delayedTripsError);
          } else {
            // // // // // console.log(`[fetchData] ${delayedTripsData?.length || 0} voyages retardés récupérés`);
            setManualDelayedTrips(delayedTripsData || []);
          }
        } catch (error) {
          // // // // console.error('[fetchData] Exception lors de la récupération des voyages retardés:', error);
          // Ne pas bloquer l'exécution si la table n'existe pas encore
          setManualDelayedTrips([]);
        }

        // Si aucun trajet valide, arrêter ici
        if (validTripIds.length === 0) {
          // // // // console.warn("[fetchData] Aucun trajet valide trouvé pour les service_id sélectionnés.");
          setLoading(false);
          setTrips([]);
          return;
        }
        
        // DEBUG: Vérifier quelles lignes sont disponibles pour ces service_id valides
        if (allTripsData.length === 0) {
          // // // // // console.log("[fetchData] DEBUG: Vérification des lignes disponibles pour les service_id valides...");
          const { data: availableRoutes, error: routesError } = await supabase
            .from('trips')
            .select('route_id, direction_id, service_id')
            .in('service_id', validServiceIds)
            .eq('network_id', networkId);
            
          if (!routesError && availableRoutes) {
            const routeDirections = {};
            availableRoutes.forEach(trip => {
              const key = `${trip.route_id}_${trip.direction_id}`;
              if (!routeDirections[key]) {
                routeDirections[key] = {
                  route_id: trip.route_id,
                  direction_id: trip.direction_id,
                  count: 0
                };
              }
              routeDirections[key].count++;
            });
            
            // // // // // console.log(`[fetchData] Lignes disponibles pour ces service_id: ${JSON.stringify(Object.values(routeDirections))}`);
          }
        }
        
        // DEBUG: Afficher les sous-réseaux trouvés pour aider au débogage
        const subnetworks = [...new Set(allTripsData.map(trip => trip.subnetwork_name).filter(Boolean))];
        // // // // // console.log(`[fetchData] Sous-réseaux trouvés pour cette ligne: ${subnetworks.join(', ') || 'aucun'}`);

        // Récupérer tous les arrêts
        const { data: allStopsData, error: stopsError } = await supabase
          .from('stops')
          .select('*')
          .eq('network_id', networkId);

        if (stopsError) throw stopsError;

        // Create a map that preserves the exact IDs from the database
        const stopsMap = new Map(allStopsData.map(stop => [stop.stop_id, stop]));

        // Récupérer TOUS les stop_times en UNE SEULE requête (suppression du chunking)
        /* COMMENTÉ - Réactivation du chunking ci-dessous
        // // // // // console.log(`[fetchData] Attempting to fetch stop_times for ${validTripIds.length} trip IDs in a single query...`);
        const { data: stopTimesData, error: stopTimesErrorSingleQuery } = await fetchWithRetry(
          supabase
            .from('stop_times')
            .select('*, subnetwork_name')
            .in('trip_id', validTripIds) // Utiliser tous les trip_ids valides
            .eq('network_id', networkId)
            .order('stop_sequence', { ascending: true })
        );

        if (stopTimesErrorSingleQuery) {
          // // // // console.error("[fetchData] Error fetching stop_times in single query:", stopTimesErrorSingleQuery);
          throw stopTimesErrorSingleQuery;
        }

        // // // // // console.log(`[fetchData] Successfully fetched ${stopTimesData ? stopTimesData.length : 0} stop_times records in single query.`);

        // Log spécifiquement pour 11106 après la requête unique
        if (stopTimesData) {
          const singleQueryStopsFor11106 = stopTimesData.filter(st => st.trip_id === '11106');
          // // // // // console.log(`[fetchData] Stops found for trip 11106 in single query result: ${singleQueryStopsFor11106.length}`, singleQueryStopsFor11106);
        }
        */
        
        // --- RÉACTIVATION DU CHUNKING --- 
        // // // // // console.log(`[fetchData] Fetching stop_times using SEQUENTIAL chunking for ${validTripIds.length} trips...`);
        const chunkSize = 10; // RÉDUIRE la taille du chunk drasticamente
        const chunks = [];
        
        for (let i = 0; i < validTripIds.length; i += chunkSize) {
          chunks.push(validTripIds.slice(i, i + chunkSize));
        }

        // Exécuter les requêtes séquentiellement
        const allStopTimesData = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          // // // // // console.log(`[fetchData] Fetching sequential chunk ${i + 1}/${chunks.length} with ${chunk.length} trip IDs...`);
          try {
            // --- Appel Supabase DIRECT --- 
            const { data: chunkData, error: chunkError } = await supabase
              .from('stop_times')
              .select('*, subnetwork_name')
              .in('trip_id', chunk)
              .eq('network_id', networkId)
              .order('stop_sequence', { ascending: true });
            
            // Lever une erreur si la requête directe échoue
            if (chunkError) throw chunkError; 
            // --- FIN Appel Supabase DIRECT --- 
            
            /* fetchWithRetry COMMENTÉ
            const chunkData = await fetchWithRetry(
              supabase
                .from('stop_times')
                .select('*, subnetwork_name')
                .in('trip_id', chunk)
                .eq('network_id', networkId)
                .order('stop_sequence', { ascending: true })
            );
            */
            
            if (chunkData && Array.isArray(chunkData)) {
              // // // // // console.log(`[fetchData] Chunk ${i + 1} fetched successfully with ${chunkData.length} records.`);
              allStopTimesData.push(...chunkData); // Ajouter les résultats au tableau principal
            } else {
              // // // // console.warn(`[fetchData] Chunk ${i + 1} returned no data or invalid data.`);
            }
          } catch (error) {
            // Capturer l'erreur spécifique à ce chunk
            // // // // console.error(`[fetchData] Error fetching sequential chunk ${i + 1}/${chunks.length}:`, error);
            // // // // console.error('[fetchData] Error Details:', error);
            // Optionnel : décider si on veut arrêter ou continuer malgré l'erreur
            // throw error; // Arrêter tout
            // Continuer pour voir si d'autres chunks fonctionnent
          }
          // Ajouter un petit délai entre les requêtes séquentielles pour être gentil avec le serveur
          await new Promise(resolve => setTimeout(resolve, 100)); 
        }

        // --- TEST SPÉCIFIQUE POUR 11106 --- 
        // // // // // console.log("[fetchData] Performing direct query ONLY for trip_id = 11106...");
        try {
          const { data: directData11106, error: directError11106 } = await supabase
            .from('stop_times')
            .select('*') // Sélectionner toutes les colonnes pour vérifier
            .eq('trip_id', '11106')
            .eq('network_id', networkId)
            .order('stop_sequence', { ascending: true });

          if (directError11106) {
            // // // // console.error("[fetchData] Error during direct query for 11106:", directError11106);
          } else {
            // // // // // console.log(`[fetchData] Direct query for 11106 returned ${directData11106 ? directData11106.length : 'null/undefined'} records.`, directData11106);
            // Optionnel : Si vous voulez utiliser ces données directes au lieu de celles des chunks pour 11106
            // if (directData11106 && directData11106.length > allStopTimesData.filter(st => st.trip_id === '11106').length) {
            //   // Supprimer les données potentiellement incomplètes de 11106 provenant des chunks
            //   allStopTimesData = allStopTimesData.filter(st => st.trip_id !== '11106');
            //   // Ajouter les données complètes de la requête directe
            //   allStopTimesData.push(...directData11106);
            //   // // // // // console.log("[fetchData] Replaced chunk data with direct query data for trip 11106.");
            // }
          }
        } catch(e) {
          // // // // console.error("[fetchData] Exception during direct query for 11106:", e);
        }
        // --- FIN TEST SPÉCIFIQUE --- 

        // Utiliser les données collectées séquentiellement
        const stopTimesData = allStopTimesData;
        
        /* CODE PARALLÈLE COMMENTÉ
        // Exécuter les requêtes en parallèle avec retry
        const stopTimesPromises = chunks.map((chunk, index) => 
          fetchWithRetry(
            supabase
              .from('stop_times')
              .select('*, subnetwork_name')
              .in('trip_id', chunk)
              .eq('network_id', networkId)
              .order('stop_sequence', { ascending: true })
          ).catch(error => {
            // Capturer l'erreur spécifique à ce chunk
            // // // // console.error(`[fetchData] Error fetching chunk ${index + 1}/${chunks.length}:`, error);
            return null; // Retourner null pour ce chunk en cas d'erreur
          })
        );

        // Utiliser Promise.allSettled pour récupérer tous les résultats, même en cas d'erreur
        const stopTimesResultsSettled = await Promise.allSettled(stopTimesPromises);
        
        // Filtrer les résultats réussis et vérifier les erreurs
        const successfulResults = [];
        stopTimesResultsSettled.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value !== null) {
            successfulResults.push(result.value);
          } else if (result.status === 'rejected') {
            // // // // console.error(`[fetchData] Chunk ${index + 1} failed permanently:`, result.reason);
          } else {
            // // // // console.warn(`[fetchData] Chunk ${index + 1} returned null (likely fetch error).`);
          }
        });
        
        // Aplatir seulement les résultats réussis
        const stopTimesData = successfulResults.flat();
        */
        
        // Vérifier si des données ont été récupérées
        if (!stopTimesData) {
          // // // // console.error("[fetchData] stopTimesData is null or undefined after processing chunks.");
          throw new Error("Erreur critique lors de la récupération des horaires d'arrêt.");
        }
        // // // // // console.log(`[fetchData] Successfully processed ${chunks.length} chunks sequentially. Total stop_times records collected: ${stopTimesData.length}`);

        // Log spécifiquement pour 11106 après le chunking séquentiel
        const sequentialStopsFor11106 = stopTimesData.filter(st => st.trip_id === '11106');
        // // // // // console.log(`[fetchData] Stops found for trip 11106 after SEQUENTIAL chunking: ${sequentialStopsFor11106.length}`, sequentialStopsFor11106);
        // --- FIN DU CHUNKING RÉACTIVÉ --- 
        
        // La suite du code utilise stopTimesData comme avant
        try { // Ajout d'un try/catch autour du traitement
          // Debugging: Log stop IDs that are not found in the stopsMap
          // // // // console.debug('[fetchData] Inspecting stop IDs for missing entries:');
          const missingStopIds = new Set();
          stopTimesData.forEach(st => {
            const resolvedId = resolveStopId(st.stop_id, stopsMap);
            if (!stopsMap.has(resolvedId)) {
              // // // // console.warn(`Stop ID not found: ${st.stop_id} (resolved as ${resolvedId})`);
              missingStopIds.add(st.stop_id);
            }
          });

          // Ajouter manuellement les arrêts problématiques
          if (missingStopIds.size > 0) {
            // // // // // console.log("Tentative de récupération des arrêts manquants...");
            
            // Récupérer spécifiquement les arrêts manquants
            const { data: missingStopsData, error: missingStopsError } = await supabase
              .from('stops')
              .select('*')
              .in('stop_id', Array.from(missingStopIds))
              .eq('network_id', networkId);
            
            if (!missingStopsError && missingStopsData && missingStopsData.length > 0) {
              // // // // // console.log(`Trouvé ${missingStopsData.length} arrêts manquants dans la base de données.`);
              
              // Ajouter les arrêts manquants à stopsMap
              missingStopsData.forEach(stop => {
                // // // // // console.log(`Ajout manuel de l'arrêt: ${stop.stop_name} (${stop.stop_id})`);
                stopsMap.set(stop.stop_id, stop);
              });
            } else {
              // // // // console.warn("Impossible de récupérer les arrêts manquants.");
            }
          }

          // Traiter les données des trips avec les horaires
          const processedTrips = allTripsData
            .map(trip => {
              const stopTimes = stopTimesData
                .filter(st => st.trip_id === trip.trip_id)
                .sort((a, b) => a.stop_sequence - b.stop_sequence)
                .map(st => {
                  const resolvedId = resolveStopId(st.stop_id, stopsMap);
                  const stop = stopsMap.get(resolvedId);
                  if (!stop) {
                    // // // // console.warn(`[fetchData] Stop details not found for stop_id: ${st.stop_id} (resolved: ${resolvedId}) in trip_id: ${trip.trip_id}`);
                  }
                  return {
                    ...st,
                    stop_name: stop?.stop_name || `Arrêt ${st.stop_id}`,
                    stop_lat: stop?.stop_lat,
                    stop_lon: stop?.stop_lon,
                    city: stop?.city
                  };
                });

              // // // // // console.log(`[fetchData] Processing trip ${trip.trip_id}, found ${stopTimes.length} associated stop_times after filtering/sorting.`);
              // Log detailed stop_times for a specific problematic trip_id if known, e.g.:
              // if (trip.trip_id === 'YOUR_PROBLEM_TRIP_ID') {
              //   // // // // // console.log('[fetchData] Detailed stop_times for problematic trip:', stopTimes);
              // }

              if (stopTimes.length === 0) {
                // // // // console.warn(`[fetchData] No stop_times found or associated for trip_id: ${trip.trip_id} after processing.`);
                return null;
              }

              const firstTime = stopTimes[0]?.departure_time || stopTimes[0]?.arrival_time;
              
              return {
                ...trip,
                stop_times: stopTimes,
                first_departure: firstTime
              };
            })
            .filter(Boolean)
            .sort((a, b) => {
              if (!a.first_departure) return 1;
              if (!b.first_departure) return -1;
              return a.first_departure.localeCompare(b.first_departure);
            });

          // // // // // console.log(`${processedTrips.length} trajets valides avec horaires sur ${allTripsData.length} trajets récupérés`);
          
          if (processedTrips.length === 0) {
            setLoading(false);
            setError(`Aucun horaire disponible pour cette ligne le ${formatDate(selectedDate)}. Les horaires peuvent ne pas être disponibles pour cette date, ou cette ligne peut ne pas fonctionner ce jour-là.`);
            return;
          }

          setTrips(processedTrips);
          
          if (processedTrips.length > 0) {
            const [selectedHours, selectedMinutes] = selectedTime.split(':').map(Number);
            const selectedTimeMinutes = selectedHours * 60 + selectedMinutes;
            
            let initialIndex = processedTrips.findIndex(trip => {
              if (!trip.first_departure) return false;
              const [hours, minutes] = trip.first_departure.split(':').map(Number);
              return (hours * 60 + minutes) >= selectedTimeMinutes;
            });

            if (initialIndex === -1) initialIndex = 0;
            setCurrentTripIndex(initialIndex);
            setStopTimes(processedTrips[initialIndex].stop_times);
          }

          // Optimiser la récupération des connexions
          const uniqueStopIds = [...new Set(stopTimesData.map(st => st.stop_id))];
          
          // Créer des ensembles d'IDs avec et sans préfixe pour une recherche plus robuste
          const allStopIds = new Set();
          const idMappings = new Map(); // Pour tracer quels IDs sont liés
          
          uniqueStopIds.forEach(stopId => {
            // Ajouter l'ID original
            allStopIds.add(stopId);
            
            // Ajouter la version sans préfixe si applicable
            if (stopId.includes(':')) {
              const unprefixedId = stopId.split(':')[1];
              allStopIds.add(unprefixedId);
              // Conserver la relation entre les IDs
              idMappings.set(unprefixedId, stopId);
              idMappings.set(stopId, stopId);
            } else {
              // Pour les IDs sans préfixe, essayer les préfixes des départements
              const departmentPrefixes = ['60:', '95:', '75:', '77:', '78:', '91:', '92:', '93:', '94:'];
              departmentPrefixes.forEach(prefix => {
                const prefixedId = `${prefix}${stopId}`;
                allStopIds.add(prefixedId);
                // Conserver la relation entre les IDs
                idMappings.set(prefixedId, stopId);
              });
              idMappings.set(stopId, stopId);
            }
          });
          
          const connections = {};
          
          // Récupérer toutes les connexions en utilisant le nouveau service
          let connectionsData = [];
          if (allStopIds.size > 0) { // allStopIds is the Set of stop_id variants
            connectionsData = await fetchAllStopTimesForStops(networkId, Array.from(allStopIds));
          }
          // // // // // console.log(`Récupération de ${connectionsData.length} connexions potentielles via service pour ${allStopIds.size} arrêts.`);
          
          if (connectionsData && connectionsData.length > 0) {
            // Optimiser la récupération des trajets en utilisant des lots (batches)
            const tripIds = [...new Set(connectionsData.map(st => st.trip_id))];
            const tripBatches = [];
            
            // Diviser les tripIds en lots de 1000 (limite Supabase)
            for (let i = 0; i < tripIds.length; i += 1000) {
              tripBatches.push(tripIds.slice(i, i + 1000));
            }
            
            let allRouteTrips = [];
            
            // Récupérer les trajets en lots
            for (const batch of tripBatches) {
              const { data: batchData } = await supabase
                .from('trips')
                .select('route_id, trip_id')
                .in('trip_id', batch)
                .eq('network_id', networkId);
                
              if (batchData) {
                allRouteTrips.push(...batchData);
              }
            }
            
            const routesData = allRouteTrips;

            if (routesData && routesData.length > 0) {
              const routeIds = [...new Set(routesData.map(t => t.route_id))];
              
              // Même approche par lots pour les routes
              const routeBatches = [];
              for (let i = 0; i < routeIds.length; i += 1000) {
                routeBatches.push(routeIds.slice(i, i + 1000));
              }
              
              let allRouteDetails = [];
              
              // Récupérer les détails des routes en lots
              for (const batch of routeBatches) {
                const { data: batchData } = await supabase
                  .from('routes')
                  .select('route_id, route_short_name, route_color, route_text_color')
                  .in('route_id', batch)
                  .eq('network_id', networkId);
                  
                if (batchData) {
                  allRouteDetails.push(...batchData);
                }
              }
              
              const routeDetails = allRouteDetails;

              if (routeDetails) {
                // Initialiser les connexions pour tous les arrêts originaux
                uniqueStopIds.forEach(stopId => {
                  connections[stopId] = [];
                });
                
                // Traiter toutes les connexions trouvées et les associer aux bons arrêts
                connectionsData.forEach(connection => {
                  const stopId = connection.stop_id;
                  const originalStopId = idMappings.get(stopId);
                  
                  if (!originalStopId) return; // Ignorer si pas de mapping connu
                  
                  const trip = routesData.find(t => t.trip_id === connection.trip_id);
                  if (!trip) return;
                  
                  const route = routeDetails.find(r => r.route_id === trip.route_id);
                  if (!route) return;
                  
                  // S'assurer que l'ID de l'arrêt original existe dans les connexions
                  if (!connections[originalStopId]) {
                    connections[originalStopId] = [];
                  }
                  
                  // Ajouter la correspondance si elle n'existe pas déjà
                  const existingRoute = connections[originalStopId].find(r => r.route_id === route.route_id);
                  if (!existingRoute) {
                    connections[originalStopId].push(route);
                  }
                });
                
                // Déduplication et nettoyage final
                Object.keys(connections).forEach(stopId => {
                  connections[stopId] = [...new Set(connections[stopId])];
                });
              }
            }
          }
          
          // Log des statistiques de correspondances
          let totalConnections = 0;
          let stopsWithConnections = 0;
          
          Object.keys(connections).forEach(stopId => {
            const count = connections[stopId]?.length || 0;
            totalConnections += count;
            if (count > 0) {
              stopsWithConnections++;
            }
          });
          
          // // // // // console.log(`Statistiques de correspondances: ${totalConnections} correspondances trouvées pour ${stopsWithConnections}/${Object.keys(connections).length} arrêts`);
          
          setStopConnections(connections);
          setLoading(false);
        } catch (error) {
          // // // // console.error('Error processing data:', error);
          setError('Une erreur est survenue lors du traitement des données.');
          setLoading(false);
        }
      } catch (err) {
        // // // // console.error('Error fetching data:', err);
        setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
        setLoading(false);
      }
    };

    fetchData();
  }, [networkId, lineId, directionId, selectedDate, selectedTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (isManualNavigation || !trips.length) return;

      if (selectedDate.toDateString() === now.toDateString() && !showMap && lastSelectedTripIndex === null) {
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
        
        const currentTripIdx = trips.findIndex(trip => {
          const lastStop = trip.stop_times[trip.stop_times.length - 1];
          const lastTime = lastStop.arrival_time || lastStop.departure_time;
          if (!lastTime) return false;
          
          const [hours, minutes] = lastTime.split(':').map(Number);
          return (hours * 60 + minutes) >= currentTimeMinutes;
        });

        if (currentTripIdx !== -1 && currentTripIdx !== currentTripIndex) {
          setCurrentTripIndex(currentTripIdx);
          setStopTimes(trips[currentTripIdx].stop_times);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedDate, trips, currentTripIndex, isManualNavigation, showMap, lastSelectedTripIndex]);

  useEffect(() => {
    if (trips.length > 0 && currentTripIndex >= 0 && currentTripIndex < trips.length) {
      const selectedTripData = trips[currentTripIndex];
      // // // // // console.log(`[useEffect update stopTimes] Updating stopTimes state for trip index ${currentTripIndex}, trip_id: ${selectedTripData?.trip_id}. Number of stops in trip data: ${selectedTripData?.stop_times?.length}`);
      setStopTimes(selectedTripData.stop_times);
    }
  }, [currentTripIndex, trips]);

  // Effet pour charger les données temps réel
  useEffect(() => {
    loadRealtimeDataRef.current = async () => {
      if (!selectedTrip) return;
      
      const networkId = selectedTrip.network_id;
      const lineId = selectedTrip.route_id;
      const tripId = selectedTrip.trip_id;
      const subnetworkName = selectedTrip.subnetwork_name;
      
      // // // // // console.log(`🔄 Chargement des données temps réel - Réseau: ${networkId}, Ligne: ${lineId}, Trajet: ${tripId}, Sous-réseau: ${subnetworkName || 'aucun'}`);
      
      // Vérifier si la dernière mise à jour est récente (moins de 30 secondes)
      const now = new Date();
      const elapsedTime = lastRealtimeUpdate ? Math.floor((now - lastRealtimeUpdate) / 1000) : 9999;
      
      if (elapsedTime < 30) {
        // // // // // console.log(`⏱️ Dernière mise à jour il y a moins de 30 secondes (${elapsedTime}s), pas de rechargement`);
        return;
      }
      
      try {
        setRealtimeLoading(true);
        
        // Récupérer les données temps réel (GTFS-RT ou SIRI)
        try {
          // Vérifier si des données temps réel sont disponibles et activer l'option
          const { data: realtimeConfig, error: realtimeConfigError } = await supabase
            .from('networks_with_realtime')
            .select('*')
            .eq('network_id', networkId)
            .or(`subnetwork_name.eq.${subnetworkName},subnetwork_name.is.null`);
          
          if (realtimeConfigError) {
            // // // // console.error('❌ Erreur lors de la vérification de la disponibilité des données temps réel:', realtimeConfigError);
            return;
          }
          
          // // // // // console.log(`📊 Configurations temps réel disponibles: ${realtimeConfig?.length || 0}`, realtimeConfig);
          
          const hasRealtime = realtimeConfig && realtimeConfig.length > 0;
          
          if (hasRealtime) {
            setRealtimeAvailable(true);
            // // // // // console.log(`🚀 Appel de la fonction de récupération unifiée avec sous-réseau "${subnetworkName || 'global'}"`);
            
            // Utiliser la fonction unifiée qui sélectionne automatiquement la source
            const realtimeData = await fetchRealtimeData(networkId, lineId, subnetworkName);
            
            if (realtimeData) {
              setDelaysData(realtimeData.delays || {});
              setUpdatedTimesData(realtimeData.updatedTimes || {});
              setSkippedStopsData(realtimeData.skippedStops || {});
              setSiriDataAvailable(true);
              
              // // // // // console.log(`📡 Données temps réel reçues: ${Object.keys(realtimeData.delays).length} retards, ${Object.keys(realtimeData.updatedTimes).length} mises à jour d'horaires, ${Object.keys(realtimeData.skippedStops || {}).length} arrêts non desservis`);
            }
          } else {
            // // // // // console.log('⚠️ Aucune configuration temps réel disponible pour ce réseau');
            setRealtimeAvailable(false);
            setSiriDataAvailable(false);
          }
        } catch (rtError) {
          // // // // console.error('❌ Erreur lors du chargement des données temps réel:', rtError);
        }
        
        // Rafraîchir les données de suppression et de retard manuelles
        try {
          // Récupérer les voyages annulés pour la date actuelle
          const validTripIds = trips.map(trip => trip.trip_id);
          
          // Formater la date correctement pour les requêtes
          const localDate = new Date(selectedDate);
          // Utiliser le format local pour éviter le décalage de fuseau horaire
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, '0');
          const dayNum = String(localDate.getDate()).padStart(2, '0');
          const todayDateStr = `${year}-${month}-${dayNum}`;
          
          // // // // // console.log(`🔄 Rafraîchissement des données de suppression et retard manuels - Date: ${todayDateStr}`);
          
          const { data: cancelledTripsData, error: cancelledTripsError } = await supabase
            .from('cancelled_trips')
            .select('*')
            .eq('network_id', networkId)
            .eq('cancellation_date', todayDateStr)
            .in('trip_id', validTripIds);
            
          if (cancelledTripsError) {
            // // // // console.error('[fetchData] Erreur lors de la récupération des voyages annulés:', cancelledTripsError);
          } else {
            // // // // // console.log(`🚫 ${cancelledTripsData?.length || 0} voyages annulés récupérés`);
            setCancelledTrips(cancelledTripsData || []);
          }

          // Récupérer les voyages retardés manuellement pour la date actuelle
          const { data: delayedTripsData, error: delayedTripsError } = await supabase
            .from('delayed_trips')
            .select('*')
            .eq('network_id', networkId)
            .eq('delay_date', todayDateStr)
            .in('trip_id', validTripIds);
              
          if (delayedTripsError) {
            // // // // console.error('[fetchData] Erreur lors de la récupération des voyages retardés:', delayedTripsError);
          } else {
            // // // // // console.log(`⏱️ ${delayedTripsData?.length || 0} voyages retardés récupérés`);
            setManualDelayedTrips(delayedTripsData || []);
          }
          
        } catch (manualError) {
          // // // // console.error('❌ Erreur lors du rafraîchissement des données manuelles:', manualError);
        }
        
        // Mettre à jour l'horodatage de la dernière mise à jour
        setLastRealtimeUpdate(new Date());
        
      } catch (error) {
        // // // // console.error('❌ Erreur globale lors du chargement des données:', error);
        setRealtimeError(error.message || 'Erreur lors du chargement des données temps réel');
      } finally {
        setRealtimeLoading(false);
      }
    };

    loadRealtimeDataRef.current();
    
    realtimeInterval.current = setInterval(() => {
      if (loadRealtimeDataRef.current) {
        loadRealtimeDataRef.current();
      }
    }, 30000);
    
    return () => {
      if (realtimeInterval.current) {
        clearInterval(realtimeInterval.current);
      }
    };
  }, [selectedTrip, lastRealtimeUpdate, trips, selectedDate, setRealtimeLoading, setRealtimeAvailable, setDelaysData, setUpdatedTimesData, setSkippedStopsData, setSiriDataAvailable, setLastRealtimeUpdate, setRealtimeError, setCancelledTrips, setManualDelayedTrips]);

  // Charger les données en temps réel quand l'option temps réel est activée
  useEffect(() => {
    if (isRealtimeEnabled && selectedTrip && loadRealtimeDataRef.current) {
      // // // // // console.log('🔄 Option temps réel activée, chargement des données...');
      loadRealtimeDataRef.current();
    }
  }, [isRealtimeEnabled, selectedTrip]);

  const getStopDelay = (tripId, stopId, stopSequence = null) => {
    if (!isRealtimeEnabled || !tripId || !stopId) return null;
    
    // Si la séquence est fournie, utiliser une clé combinée
    if (stopSequence !== null) {
      const combinedKey = `${tripId}-${stopId}-${stopSequence}`;
      if (realtimeDelays[combinedKey] !== undefined) {
        return realtimeDelays[combinedKey];
      }
    }
    
    // Fallback à l'ancienne méthode
    return realtimeDelays[`${tripId}-${stopId}`] || 0;
  };

  const getUpdatedStopTime = (tripId, stopId, isArrival = false, stopSequence = null) => {
    if (!isRealtimeEnabled || !tripId || !stopId) return null;
    
    // Si la séquence est fournie, utiliser une clé combinée
    if (stopSequence !== null) {
      const combinedKey = `${tripId}-${stopId}-${stopSequence}`;
      const updatedTimeWithSequence = realtimeUpdatedTimes[combinedKey];
      
      if (updatedTimeWithSequence) {
        return isArrival ? updatedTimeWithSequence.arrival : updatedTimeWithSequence.departure;
      }
    }
    
    // Fallback à l'ancienne méthode
    const updatedTime = realtimeUpdatedTimes[`${tripId}-${stopId}`];
    if (!updatedTime) return null;
    
    return isArrival ? updatedTime.arrival : updatedTime.departure;
  };
  
  // Fonction interne pour le formatage des délais (utilisée pour le préchargement)
  const formatTimeWithDelayInternal = (time, tripId, stopId, delaysData, updatedTimesData, realtimeEnabled, isFirstStop = false, isLastStop = false, stopSequence = null, skippedStopsData = {}) => {
    if (!time) return { original: "-", adjusted: "-", delay: null, status: 'normal' };
    
    const basicTime = time.substring(0, 5);
    
    // Vérifier si le voyage est annulé
    const isCancelled = tripId && cancelledTrips.some(trip => trip.trip_id === tripId);
    
    // Si le voyage est annulé, retourner l'horaire avec un statut spécial
    if (isCancelled) {
      return { 
        original: basicTime, 
        adjusted: basicTime, 
        delay: null, 
        status: 'cancelled', 
        isRealtime: false,
        isCancelled: true,
        cancellationReason: cancelledTrips.find(trip => trip.trip_id === tripId)?.reason || 'Course supprimée'
      };
    }
    
    // Créer la clé pour les vérifications (avec ou sans séquence)
    const stopKey = stopSequence !== null ? `${tripId}-${stopId}-${stopSequence}` : `${tripId}-${stopId}`;
    
    // Vérifier si l'arrêt est marqué comme non desservi (SKIPPED) dans les données temps réel
    const isSkipped = tripId && stopId && (skippedStopsData[stopKey] || skippedStopsData[`${tripId}-${stopId}`]);
    
    // Si l'arrêt est marqué comme SKIPPED, retourner l'horaire avec un statut spécial
    if (isSkipped) {
      return { 
        original: basicTime, 
        adjusted: basicTime, 
        delay: null, 
        status: 'skipped', 
        isRealtime: true,
        isSkipped: true,
        skippedReason: 'Arrêt non desservi'
      };
    }
    
    // Vérifier si le voyage a un retard manuel défini
    const manualDelay = tripId && manualDelayedTrips.find(trip => trip.trip_id === tripId);
    
    // Vérifier si nous sommes sur le jour actuel en utilisant la fonction dédiée
    const { date: today, utcDate: todayUTC } = getTodayForSupabase();
    
    // Comparer les dates en convertissant selectedDate au fuseau horaire local
    const selectedDateLocal = new Date(selectedDate);
    const isToday = selectedDateLocal.toDateString() === today.toDateString();
    
    // Si ce n'est pas aujourd'hui et qu'il n'y a pas de retard manuel, retourner l'horaire théorique
    if (!isToday && !manualDelay) {
      return { 
        original: basicTime, 
        adjusted: basicTime, 
        delay: null, 
        status: 'normal', 
        isRealtime: false 
      };
    }
    
    // Si le temps réel n'est pas activé ou si on est en train de changer de trajet, vérifier quand même pour le retard manuel
    if ((!realtimeEnabled || isChangingTrip) && !manualDelay) {
      return { 
        original: basicTime, 
        adjusted: basicTime, 
        delay: null, 
        status: 'normal', 
        isRealtime: false 
      };
    }

      let delay = 0;
  let updatedTimeObj = null;
  let dataFoundForKey = false;
  let isManualDelay = false;
  let calculatedDelay = 0;
  let adjustedTime = basicTime;

  // --- Vérifier d'abord le retard manuel ---  
    if (manualDelay) {
      delay = manualDelay.delay_minutes;
      dataFoundForKey = true;
      isManualDelay = true;
      calculatedDelay = delay;
    }
    // --- Si pas de retard manuel ou si le temps réel est prioritaire, continuer avec la logique normale --- 
    else if (realtimeEnabled && !isChangingTrip) {
      // Toujours utiliser la clé avec séquence si elle est disponible
      const combinedKey = stopSequence !== null ? `${tripId}-${stopId}-${stopSequence}` : `${tripId}-${stopId}`;
      
      // Chercher d'abord avec la clé combinée
      let delayForKey = delaysData[combinedKey];
      let timeForKey = updatedTimesData[combinedKey];
      
      // Si on ne trouve pas avec la clé combinée et qu'on n'a pas de séquence, essayer la clé simple
      if (!delayForKey && !timeForKey && stopSequence === null) {
        delayForKey = delaysData[`${tripId}-${stopId}`];
        timeForKey = updatedTimesData[`${tripId}-${stopId}`];
      }
      
      if (delayForKey !== undefined || timeForKey) {
        dataFoundForKey = true;
        if (delayForKey !== undefined) {
          calculatedDelay = delayForKey;
        }
        if (timeForKey) {
          updatedTimeObj = timeForKey;
        }
      }
    }

    // ... existing code ...

    // Si AUCUNE donnée temps réel ou retard manuel n'a été trouvée (ou si elle n'a pas été trouvée pour la séquence spécifique),
    // retourner l'horaire théorique
    if (!dataFoundForKey) {
      // // // // // console.log(`[RT Debug] ---> No RT or manual delay data found. Returning theoretical time.`);
      return { 
        original: basicTime, 
        adjusted: basicTime, 
        delay: null, 
        status: 'normal', 
        isRealtime: false 
      };
    }
    
    // --- Calculs basés sur les données trouvées (delay et updatedTimeObj) --- 
    
    if (updatedTimeObj && !isManualDelay) {
      const updatedTime = isLastStop ? updatedTimeObj.arrival : updatedTimeObj.departure;
      if (updatedTime) {
        const formattedTime = updatedTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        adjustedTime = formattedTime;
        
        // Recalculer le retard basé sur l'horaire mis à jour
        if (basicTime && formattedTime) {
          const [origHours, origMinutes] = basicTime.split(':').map(Number);
          const [updatedHours, updatedMinutes] = formattedTime.split(':').map(Number);
          const originalTotalMinutes = origHours * 60 + origMinutes;
          const updatedTotalMinutes = updatedHours * 60 + updatedMinutes;
          calculatedDelay = updatedTotalMinutes - originalTotalMinutes;
          if (calculatedDelay < -12 * 60) calculatedDelay += 24 * 60;
          if (calculatedDelay > 12 * 60) calculatedDelay -= 24 * 60;
        }
      }
    } else {
      // Si seulement un retard a été trouvé (pas d'horaire mis à jour spécifique) ou c'est un retard manuel
      // Calculer l'heure ajustée basée sur l'heure théorique + retard
      if (basicTime && calculatedDelay !== 0) {
          const [origHours, origMinutes] = basicTime.split(':').map(Number);
          const originalTotalMinutes = origHours * 60 + origMinutes;
          const updatedTotalMinutes = originalTotalMinutes + calculatedDelay;
          const updatedHours = Math.floor(updatedTotalMinutes / 60) % 24;
          const updatedMinutes = updatedTotalMinutes % 60;
          adjustedTime = `${String(updatedHours).padStart(2, '0')}:${String(updatedMinutes).padStart(2, '0')}`;
      }
    }
    
    // Arrondir le délai calculé
    const roundedDelay = Math.round(calculatedDelay);
    
    // Déterminer le statut
    let status = 'normal';
    if (roundedDelay > 0) {
      status = 'late';
    } else if (roundedDelay < 0) {
      status = 'early';
    } else if (dataFoundForKey) { // Si on a trouvé des données RT, même si délai = 0
      status = 'on-time';
    }
    
    // Formater le texte du délai
    const displayDelay = roundedDelay === 0 ? null :
      roundedDelay > 0 ? `+${roundedDelay} min` : 
      `${roundedDelay} min`;
      
    const result = { 
      original: basicTime, 
      adjusted: adjustedTime, 
      delay: roundedDelay, 
      status,
      displayDelay,
      isRealtime: true, // Toujours vrai pour l'affichage uniforme
      isManualDelay: isManualDelay, // Garder cette info en interne
      reason: isManualDelay && manualDelay ? manualDelay.reason : null // Ajouter la raison du retard
    };
    
    // // // // // console.log(`[RT Debug] ---> Returning: ${JSON.stringify(result)} (isManualDelay: ${isManualDelay})`);

    return result;
  };

  const formatTimeWithDelay = (time, tripId, stopId, isFirstStop = false, isLastStop = false, stopSequence = null) => {
    // Vérifier si nous avons des données préchargées pour cet arrêt
    if (preloadedRealtimeData && tripId && preloadedRealtimeData[tripId] && preloadedRealtimeData[tripId][stopId]) {
      return preloadedRealtimeData[tripId][stopId];
    }
    
    return formatTimeWithDelayInternal(
      time, 
      tripId, 
      stopId, 
      delaysData, 
      updatedTimesData, 
      isRealtimeEnabled, 
      isFirstStop, 
      isLastStop,
      stopSequence,
      skippedStopsData // Ajouter le paramètre des arrêts supprimés
    );
  };

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      if (!isMounted || !showMap || !mapContainer.current || !window.mapboxgl) return;
      
      try {
        setMapLoading(true);
        setMapError(null);

        if (map.current) {
          map.current.remove();
          map.current = null;
        }

        // Récupérer les informations de shape pour le trip actuel
        const { data: tripWithShape, error: initialTripsError } = await supabase
          .from('trips')
          .select('shape_id')
          .eq('trip_id', trips[currentTripIndex]?.trip_id)
          .eq('network_id', networkId)
          .single();

        // Récupérer les coordonnées des arrêts pour centrer la carte même sans shapes
        const stopCoordinates = stopTimes
          .filter(stop => stop.stop_lat && stop.stop_lon)
          .map(stop => [stop.stop_lon, stop.stop_lat]);

        // Si aucun arrêt n'a de coordonnées, afficher un message d'erreur
        if (stopCoordinates.length === 0) {
          setMapError('Aucune coordonnée disponible pour cet itinéraire');
          setMapLoading(false);
          return;
        }

        // Calculer le centre de la carte à partir des arrêts
        const centerLon = stopCoordinates.reduce((sum, coord) => sum + coord[0], 0) / stopCoordinates.length;
        const centerLat = stopCoordinates.reduce((sum, coord) => sum + coord[1], 0) / stopCoordinates.length;

        // Initialiser la carte avec le centre calculé
        map.current = new window.mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [centerLon, centerLat],
          zoom: 12,
          attributionControl: false, // Disable attribution control
          renderWorldCopies: true,
          trackResize: true,
          fadeDuration: 0, // Désactiver les animations de fondu
          transformRequest: (url, resourceType) => {
            // Désactiver l'indicateur de chargement pour les ressources
            return { url };
          }
        });

        // Ajouter les contrôles de navigation en bas à droite mais un peu remontés
        const nav = new window.mapboxgl.NavigationControl({
          showCompass: false,
          showZoom: true,
          visualizePitch: true
        });
        map.current.addControl(nav, 'bottom-right');

        // Ajuster la position des contrôles
        const navContainer = map.current.getContainer().querySelector('.mapboxgl-ctrl-bottom-right');
        if (navContainer) {
          navContainer.style.bottom = '100px';
          navContainer.style.right = '10px';
        }

        // Désactiver le spinner de chargement
        const loadingContainer = map.current.getContainer().querySelector('.mapboxgl-canvas-container');
        if (loadingContainer) {
          loadingContainer.style.backgroundColor = 'transparent';
          // Supprimer spinner si présent
          const spinner = map.current.getContainer().querySelector('.mapboxgl-spinner');
          if (spinner) {
            spinner.style.display = 'none';
          }
        }

        // Quand la carte est chargée, ajouter les shapes, les arrêts et les véhicules
        map.current.on('load', () => {
          if (isMounted) {
            fetchShapes().then(() => {
              if (isMounted) {
                setMapLoading(false);
                // Afficher immédiatement les véhicules si disponibles
                if (vehiclePositions && Object.keys(vehiclePositions).length > 0) {
                  updateVehicleMarkers(vehiclePositions);
                }
              }
            });
          }
        });
      } catch (error) {
        // // // // console.error('Error initializing map:', error);
        setMapError('Erreur lors de l\'initialisation de la carte');
        setMapLoading(false);
      }
    };

    initializeMap();

    // --- Ajout des écouteurs d'interaction pour gérer la classe CSS ---
    const handleMapMoveStart = () => {
      // // // // // console.log('[Map Interaction] Move Start');
      isMapMoving.current = true;
      // Arrêter toutes les animations en cours et placer les marqueurs à leur cible
      Object.keys(vehicleAnimationState.current).forEach(vehicleId => {
        const state = vehicleAnimationState.current[vehicleId];
        if (state && state.animationFrameId) {
          // // // // // console.log(`[Map Interaction] Cancelling animation for ${vehicleId}`);
          cancelAnimationFrame(state.animationFrameId);
          state.animationFrameId = null;
          // Placer le marqueur à sa position cible immédiatement
          if (vehicleMarkers.current[vehicleId] && state.targetPos) {
            try {
              vehicleMarkers.current[vehicleId].setLngLat([state.targetPos.lon, state.targetPos.lat]);
              // Mettre à jour lastPos pour éviter un saut au prochain moveend/update
              state.lastPos = { ...state.targetPos };
            } catch (e) {
              // // // // console.error(`Error setting LngLat for ${vehicleId} on move start:`, e);
            }
          }
        }
      });
    };

    const handleMapMoveEnd = () => {
      // // // // // console.log('[Map Interaction] Move End');
      isMapMoving.current = false;
      // Aucune action nécessaire ici, l'animation reprendra à la prochaine mise à jour de données
    };

    if (map.current) {
      map.current.on('movestart', handleMapMoveStart);
      map.current.on('moveend', handleMapMoveEnd);
    }
    // --- Fin ajout ---

    return () => {
      isMounted = false;
      // Arrêter toutes les animations en cours au démontage
      Object.keys(vehicleAnimationState.current).forEach(vehicleId => {
        const state = vehicleAnimationState.current[vehicleId];
        if (state && state.animationFrameId) {
          cancelAnimationFrame(state.animationFrameId);
        }
      });
      vehicleAnimationState.current = {}; // Vider l'état
      // --- Nettoyage des écouteurs ---
      if (map.current) {
        map.current.off('movestart', handleMapMoveStart);
        map.current.off('moveend', handleMapMoveEnd);
      }
      // --- Fin nettoyage ---
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [showMap, networkId]); // Retrait de currentTripIndex pour éviter réinitialisation complète

  // Ajouter une fonction pour calculer un itinéraire routier entre les arrêts
  const calculateRouteUsingDirectionsAPI = async (stopTimesData, stopsData) => {
    try {
      // Créer un tableau ordonné d'arrêts en suivant l'ordre de stop_sequence
      const orderedStops = [];
      stopTimesData.forEach(stopTime => {
        const stop = stopsData.find(s => s.stop_id === stopTime.stop_id);
        if (stop && stop.stop_lon && stop.stop_lat) {
          orderedStops.push(stop);
        }
      });

      if (orderedStops.length < 2) return null;
      
      // Méthode rapide avec un seul appel d'API
      // Prendre au maximum 25 points (limitation Mapbox)
      const MAX_WAYPOINTS = 25;
      
      // Si trop d'arrêts, sélectionner les points clés
      let selectedStops = orderedStops;
      if (orderedStops.length > MAX_WAYPOINTS) {
        // Toujours inclure le premier et le dernier arrêt
        const first = orderedStops[0];
        const last = orderedStops[orderedStops.length - 1];
        
        // Sélectionner des points intermédiaires à intervalles réguliers
        const step = Math.floor(orderedStops.length / (MAX_WAYPOINTS - 2));
        selectedStops = [first];
        
        for (let i = step; i < orderedStops.length - 1; i += step) {
          selectedStops.push(orderedStops[i]);
          if (selectedStops.length >= MAX_WAYPOINTS - 1) break;
        }
        
        selectedStops.push(last);
      }
      
      // Construire les coordonnées pour l'API
      const coordinates = selectedStops.map(stop => `${stop.stop_lon},${stop.stop_lat}`).join(';');
      
      // Demander un tracé qui suit les routes
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
        `geometries=geojson&` +
        `overview=full&` +
        `steps=false&` +
        `access_token=${window.mapboxgl.accessToken}`
      );
      
      if (!response.ok) {
        throw new Error(`Erreur API directions: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        return data.routes[0].geometry.coordinates;
      }
      
      throw new Error('Aucun itinéraire trouvé');
    } catch (error) {
      // // // // console.error('Erreur lors du calcul de l\'itinéraire:', error);
      // En cas d'erreur, renvoyer les points des arrêts directement pour un tracé en ligne droite
      return stopTimesData
        .map(st => {
          const stop = stopsData.find(s => s.stop_id === st.stop_id);
          return stop && stop.stop_lon && stop.stop_lat ? [stop.stop_lon, stop.stop_lat] : null;
        })
        .filter(Boolean);
    }
  };

  const fetchShapes = async () => {
    if (!map.current || !trips[currentTripIndex]) return;
    
    try {
      // // // // // console.log('Fetching shapes for trip:', trips[currentTripIndex].trip_id);
      
      const { data: tripWithShape, error: tripsError } = await supabase
        .from('trips')
        .select('shape_id')
        .eq('trip_id', trips[currentTripIndex].trip_id)
        .eq('network_id', networkId)
        .single();

      if (tripsError) throw tripsError;
      // // // // // console.log('Trip with shape:', tripWithShape);

      let hasShapes = false;
      let routeCoordinates = null;
      
      // Si le trajet a un shape_id, essayer de récupérer les coordonnées du tracé
      if (tripWithShape && tripWithShape.shape_id) {
        const { data: shapesData, error: shapesError } = await supabase
          .from('shapes')
          .select('*')
          .eq('network_id', networkId)
          .eq('shape_id', tripWithShape.shape_id)
          .order('shape_pt_sequence', { ascending: true });

        if (shapesError) throw shapesError;
        // // // // // console.log('Shapes data:', shapesData);

        if (shapesData && Array.isArray(shapesData) && shapesData.length > 0) {
          const coordinates = shapesData
            .filter(shape => shape.shape_pt_lon && shape.shape_pt_lat)
            .map(shape => [shape.shape_pt_lon, shape.shape_pt_lat]);

          if (coordinates.length > 0) {
            hasShapes = true;
            routeCoordinates = coordinates;
            
            const bounds = coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new window.mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

            map.current.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
              maxZoom: 15
            });
          }
        }
      }

      // Récupérer et afficher les arrêts, même si aucun shape n'est disponible
      const { data: stopTimesData, error: stopTimesError } = await supabase
        .from('stop_times')
        .select('stop_id, stop_sequence')
        .eq('trip_id', trips[currentTripIndex].trip_id)
        .eq('network_id', networkId)
        .order('stop_sequence', { ascending: true });

      if (stopTimesError) throw stopTimesError;
      // // // // // console.log('Stop times found:', stopTimesData);

      if (!stopTimesData || stopTimesData.length === 0) {
        // // // // console.warn('No stop times found for this trip');
        return;
      }

      const firstStopId = stopTimesData[0].stop_id;
      const lastStopId = stopTimesData[stopTimesData.length - 1].stop_id;

      const { data: stopsData, error: stopsError } = await supabase
        .from('stops')
        .select('*')
        .in('stop_id', stopTimesData.map(st => st.stop_id))
        .eq('network_id', networkId);

      if (stopsError) throw stopsError;
      // // // // // console.log('Stops found:', stopsData);

      if (stopsData && stopsData.length > 0) {
        // // // // // console.log('Adding stops to map:', stopsData.length, 'stops');
        
        // Supprimer toutes les couches et sources existantes
        if (map.current.getLayer('stops')) map.current.removeLayer('stops');
        if (map.current.getLayer('stop-labels')) map.current.removeLayer('stop-labels');
        if (map.current.getSource('stops')) map.current.removeSource('stops');
        if (map.current.getLayer('route')) map.current.removeLayer('route');
        if (map.current.getSource('route')) map.current.removeSource('route');
        if (map.current.getLayer('simplified-route')) map.current.removeLayer('simplified-route');
        if (map.current.getSource('simplified-route')) map.current.removeSource('simplified-route');
        if (map.current.getLayer('directions-route')) map.current.removeLayer('directions-route');
        if (map.current.getSource('directions-route')) map.current.removeSource('directions-route');

        // 1. PREMIER AJOUT: SOURCES ET COUCHES DES TRACÉS
        
        // Ajouter les tracés d'abord (pour qu'ils soient en dessous)
        if (hasShapes && routeCoordinates) {
          // Ajouter la source et couche des shapes de la base de données
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates
              }
            }
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': `#${darkenColor(lineInfo?.route_color)}`,
              'line-width': 6,
              'line-opacity': 0.8
            }
          });
        } else if (stopsData.length >= 2) {
          // Si pas de shapes, calculer un tracé avec l'API Directions
          setMapLoading(true);
          
          const directionCoordinates = await calculateRouteUsingDirectionsAPI(stopTimesData, stopsData);
          
          if (directionCoordinates && directionCoordinates.length > 0) {
            // Ajouter la source et couche du tracé calculé par l'API Directions
            map.current.addSource('directions-route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: directionCoordinates
                }
              }
            });
            
            map.current.addLayer({
              id: 'directions-route',
              type: 'line',
              source: 'directions-route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': `#${darkenColor(lineInfo?.route_color)}`,
                'line-width': 5,
                'line-opacity': 0.75
              }
            });
            
            // Ajuster la vue pour englober l'itinéraire
            const bounds = directionCoordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new window.mapboxgl.LngLatBounds(directionCoordinates[0], directionCoordinates[0]));
            
            map.current.fitBounds(bounds, {
              padding: { top: 70, bottom: 70, left: 70, right: 70 },
              maxZoom: 14
            });
          } else {
            // Si l'API Directions échoue, utiliser une ligne simplifiée
            // // // // // console.log("L'API Directions a échoué, utilisation d'une ligne simplifiée");
            
            // Réorganiser les coordonnées selon l'ordre des séquences de stop_times
            const orderedCoordinates = [];
            stopTimesData.forEach(st => {
              const stop = stopsData.find(s => s.stop_id === st.stop_id);
              if (stop && stop.stop_lon && stop.stop_lat) {
                orderedCoordinates.push([stop.stop_lon, stop.stop_lat]);
              }
            });
            
            if (orderedCoordinates.length >= 2) {
              // Ajouter une ligne droite entre les arrêts
              map.current.addSource('simplified-route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: orderedCoordinates
                  }
                }
              });
              
              map.current.addLayer({
                id: 'simplified-route',
                type: 'line',
                source: 'simplified-route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': `#${darkenColor(lineInfo?.route_color)}`,
                  'line-width': 4,
                  'line-opacity': 0.6,
                  'line-dasharray': [2, 2]
                }
              });
              
              // Ajuster la vue pour englober tous les arrêts
              const bounds = orderedCoordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
              }, new window.mapboxgl.LngLatBounds(orderedCoordinates[0], orderedCoordinates[0]));
              
              map.current.fitBounds(bounds, {
                padding: { top: 70, bottom: 70, left: 70, right: 70 },
                maxZoom: 14
              });
            }
          }
          setMapLoading(false);
        }

        // 2. SECOND AJOUT: SOURCES ET COUCHES DES ARRÊTS

        // Ajouter les arrêts APRÈS les tracés pour qu'ils soient au-dessus
        map.current.addSource('stops', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: stopsData.map(stop => ({
              type: 'Feature',
              properties: {
                name: stop.stop_name,
                description: stop.stop_desc,
                isTerminus: stop.stop_id === firstStopId || stop.stop_id === lastStopId,
                isFirstStop: stop.stop_id === firstStopId,
                isLastStop: stop.stop_id === lastStopId
              },
              geometry: {
                type: 'Point',
                coordinates: [stop.stop_lon, stop.stop_lat]
              }
            }))
          }
        });

        // Couche des points d'arrêts (cercles) - au-dessus des tracés
        map.current.addLayer({
          id: 'stops',
          type: 'circle',
          source: 'stops',
          paint: {
            'circle-radius': [
              'case',
              ['get', 'isTerminus'],
              6, // Réduit de 10
              4  // Réduit de 8
            ],
            'circle-color': '#FFFFFF',
            'circle-stroke-width': [
              'case',
              ['get', 'isTerminus'],
              3, // Réduit de 5
              2  // Réduit de 4
            ],
            'circle-stroke-color': [
              'case',
              ['get', 'isTerminus'],
              `#${darkenColor(lineInfo?.route_color)}`,
              '#000000'
            ],
            'circle-stroke-opacity': [
              'case',
              ['get', 'isTerminus'],
              0.9,
              1
            ]
          }
        });

        // Étiquettes des arrêts normaux (garder seulement pour les arrêts intermédiaires)
        map.current.addLayer({
          id: 'stop-labels',
          type: 'symbol',
          source: 'stops',
          filter: ['!', ['any', ['get', 'isFirstStop'], ['get', 'isLastStop']]],
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 1.5],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'visibility': 'visible'
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2
          }
        });

        // Supprimer toute autre couche de labels qui pourrait exister
        if (map.current.getLayer('stop-labels-background')) {
          map.current.removeLayer('stop-labels-background');
        }
        if (map.current.getLayer('stop-labels-terminus')) {
          map.current.removeLayer('stop-labels-terminus');
        }

        // Ajouter des marqueurs HTML personnalisés pour les terminus
        stopsData.forEach(stop => {
          if (stop.stop_id === firstStopId || stop.stop_id === lastStopId) {
            const markerEl = document.createElement('div');
            markerEl.className = 'custom-marker';
            markerEl.style.width = 'fit-content';
            
            const card = document.createElement('div');
            card.style.backgroundColor = '#FFFFFF';
            card.style.borderRadius = '4px';
            card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            card.style.padding = '3px 8px';
            card.style.fontSize = '11px';
            card.style.fontWeight = '500';
            card.style.whiteSpace = 'nowrap';
            card.style.display = 'inline-flex';
            card.style.alignItems = 'center';
            card.style.gap = '3px';
            card.style.transform = 'translateY(-115%)';
            card.style.width = 'fit-content';
            card.style.position = 'relative';
            
            const container = document.createElement('div');
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            container.style.width = 'fit-content';
            container.style.gap = '4px'; // Ajouter un gap explicite au container
            
            const prefix = document.createElement('span');
            prefix.style.color = '#666666';
            prefix.style.fontWeight = '400';
            prefix.textContent = stop.stop_id === firstStopId ? 'De :' : 'Vers :';
            
            const spacer = document.createElement('span');
            spacer.textContent = ' ';
            spacer.style.display = 'inline-block';
            spacer.style.width = '4px';
            
            const name = document.createElement('span');
            name.style.color = '#000000';
            name.style.fontWeight = '500';
            name.textContent = stop.stop_name;
            
            container.appendChild(prefix);
            container.appendChild(name);
            card.appendChild(container);
            markerEl.appendChild(card);

            new window.mapboxgl.Marker({
              element: markerEl,
              anchor: 'bottom'
            })
            .setLngLat([stop.stop_lon, stop.stop_lat])
            .addTo(map.current);
          }
        });
      } else {
        // // // // console.warn('No stops found for this trip');
        setMapError('Aucun arrêt trouvé pour ce trajet');
      }
    } catch (error) {
      // // // // console.error('Error loading map data:', error);
      setMapError('Erreur lors du chargement des données de la carte');
      setMapLoading(false);
    }
  };

  const calculateProgress = (stop, nextStop) => {
    if (!stop || !nextStop) return 0;
    
    const stopTime = stop.departure_time || stop.arrival_time;
    const nextStopTime = nextStop.arrival_time || nextStop.departure_time;
    
    if (!stopTime || !nextStopTime) return 0;

    // Utiliser les horaires ajustés si le temps réel est activé
    let stopTimeToUse = stopTime;
    let nextStopTimeToUse = nextStopTime;
    
    if (isRealtimeEnabled) {
      const currentTrip = trips[currentTripIndex];
      if (currentTrip) {
        const stopFormattedTime = formatTimeWithDelay(stopTime, currentTrip.trip_id, stop.stop_id, false, false, stop.stop_sequence);
        const nextStopFormattedTime = formatTimeWithDelay(nextStopTime, currentTrip.trip_id, nextStop.stop_id, false, false, nextStop.stop_sequence);
        
        if (stopFormattedTime && stopFormattedTime.adjusted && stopFormattedTime.adjusted !== "-") {
          stopTimeToUse = stopFormattedTime.adjusted;
        }
        
        if (nextStopFormattedTime && nextStopFormattedTime.adjusted && nextStopFormattedTime.adjusted !== "-") {
          nextStopTimeToUse = nextStopFormattedTime.adjusted;
        }
      }
    }

    const [stopHours, stopMinutes] = stopTimeToUse.split(':').map(Number);
    const [nextHours, nextMinutes] = nextStopTimeToUse.split(':').map(Number);
    const [currentHours, currentMinutes, currentSeconds] = [
      currentTime.getHours(),
      currentTime.getMinutes(),
      currentTime.getSeconds()
    ];

    const stopTimeInSeconds = stopHours * 3600 + stopMinutes * 60;
    const nextStopTimeInSeconds = nextHours * 3600 + nextMinutes * 60;
    const currentTimeInSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;

    if (currentTimeInSeconds < stopTimeInSeconds) return 0;
    
    if (currentTimeInSeconds >= nextStopTimeInSeconds) return 1;

    const totalDuration = nextStopTimeInSeconds - stopTimeInSeconds;
    const elapsed = currentTimeInSeconds - stopTimeInSeconds;
    
    return Math.min(1, Math.max(0, elapsed / totalDuration));
  };

  const calculateJourneyProgress = () => {
    if (!stopTimes || stopTimes.length < 2) return 0;
    
    const currentTimeInSeconds = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();
    
    let lastPassedStopIndex = -1;
    let nextStopIndex = -1;
    
    // Check if we're before the first stop time
    const firstStop = stopTimes[0];
    // Safety check to ensure stop exists
    if (!firstStop) return 0;
    
    const firstStopTime = firstStop.departure_time || firstStop.arrival_time;
    
    if (firstStopTime) {
      let firstStopTimeToUse = firstStopTime;
      if (isRealtimeEnabled && trips[currentTripIndex]) {
        const formattedTime = formatTimeWithDelay(firstStopTime, trips[currentTripIndex].trip_id, firstStop.stop_id, true, false, firstStop.stop_sequence);
        if (formattedTime && formattedTime.adjusted && formattedTime.adjusted !== "-") {
          firstStopTimeToUse = formattedTime.adjusted;
        }
      }
      
      const [firstHours, firstMinutes] = firstStopTimeToUse.split(':').map(Number);
      const firstStopTimeInSeconds = firstHours * 3600 + firstMinutes * 60;
      
      // If current time is before the first stop, return 0
      if (currentTimeInSeconds < firstStopTimeInSeconds) {
        return 0;
      }
    }
    
    // Check if we're after the last stop time
    const lastStopInRoute = stopTimes[stopTimes.length - 1];
    // Safety check to ensure stop exists
    if (!lastStopInRoute) return 0;
    
    const lastStopTimeInRoute = lastStopInRoute.arrival_time || lastStopInRoute.departure_time;
    
    if (lastStopTimeInRoute) {
      let lastStopTimeToUseInRoute = lastStopTimeInRoute;
      if (isRealtimeEnabled && trips[currentTripIndex]) {
        const formattedTime = formatTimeWithDelay(lastStopTimeInRoute, trips[currentTripIndex].trip_id, lastStopInRoute.stop_id, false, true, lastStopInRoute.stop_sequence);
        if (formattedTime && formattedTime.adjusted && formattedTime.adjusted !== "-") {
          lastStopTimeToUseInRoute = formattedTime.adjusted;
        }
      }
      
      const [lastHours, lastMinutes] = lastStopTimeToUseInRoute.split(':').map(Number);
      const lastStopTimeInSeconds = lastHours * 3600 + lastMinutes * 60;
      
      // If current time is after the last stop, return 1 (100%)
      if (currentTimeInSeconds > lastStopTimeInSeconds) {
        return 1;
      }
    }
    
    for (let i = 0; i < stopTimes.length; i++) {
      const stop = stopTimes[i];
      const stopTime = stop.departure_time || stop.arrival_time;
      
      if (!stopTime) continue;
      
      let stopTimeToUse = stopTime;
      if (isRealtimeEnabled) {
        const currentTrip = trips[currentTripIndex];
        if (currentTrip) {
          const formattedTime = formatTimeWithDelay(stopTime, currentTrip.trip_id, stop.stop_id, false, false, stop.stop_sequence);
          if (formattedTime && formattedTime.adjusted && formattedTime.adjusted !== "-") {
            stopTimeToUse = formattedTime.adjusted;
          }
        }
      }
      
      const [stopHours, stopMinutes] = stopTimeToUse.split(':').map(Number);
      const stopTimeInSeconds = stopHours * 3600 + stopMinutes * 60;
      
      if (currentTimeInSeconds >= stopTimeInSeconds) {
        lastPassedStopIndex = i;
      } else if (nextStopIndex === -1) {
        nextStopIndex = i;
        break;
      }
    }
    
    if (lastPassedStopIndex === -1) return 0;
    
    if (nextStopIndex === -1 || lastPassedStopIndex === stopTimes.length - 1) return 1;
    
    const lastPassedStop = stopTimes[lastPassedStopIndex];
    const nextStop = stopTimes[nextStopIndex];
    
    const lastPassedStopTime = lastPassedStop.departure_time || lastPassedStop.arrival_time;
    const nextStopTime = nextStop.arrival_time || nextStop.departure_time;
    
    if (!lastPassedStopTime || !nextStopTime) return lastPassedStopIndex / (stopTimes.length - 1);
    
    let lastStopTimeToUse = lastPassedStopTime;
    let nextStopTimeToUse = nextStopTime;
    
    if (isRealtimeEnabled) {
      const currentTrip = trips[currentTripIndex];
      if (currentTrip) {
        const lastFormattedTime = formatTimeWithDelay(lastPassedStopTime, currentTrip.trip_id, lastPassedStop.stop_id, false, false, lastPassedStop.stop_sequence);
        const nextFormattedTime = formatTimeWithDelay(nextStopTime, currentTrip.trip_id, nextStop.stop_id, false, false, nextStop.stop_sequence);
        
        if (lastFormattedTime && lastFormattedTime.adjusted && lastFormattedTime.adjusted !== "-") {
          lastStopTimeToUse = lastFormattedTime.adjusted;
        }
        
        if (nextFormattedTime && nextFormattedTime.adjusted && nextFormattedTime.adjusted !== "-") {
          nextStopTimeToUse = nextFormattedTime.adjusted;
        }
      }
    }
    
    const [lastHours, lastMinutes] = lastStopTimeToUse.split(':').map(Number);
    const [nextHours, nextMinutes] = nextStopTimeToUse.split(':').map(Number);
    
    const lastStopTimeInSeconds = lastHours * 3600 + lastMinutes * 60;
    const nextStopTimeInSeconds = nextHours * 3600 + nextMinutes * 60;
    
    // If next stop time is earlier than last stop time (crossing midnight), adjust next stop time
    const adjustedNextStopTimeInSeconds = nextStopTimeInSeconds < lastStopTimeInSeconds 
      ? nextStopTimeInSeconds + 24 * 3600 
      : nextStopTimeInSeconds;
    
    // Calculate segment progress
    const totalSegmentDuration = adjustedNextStopTimeInSeconds - lastStopTimeInSeconds;
    const elapsedInSegment = currentTimeInSeconds - lastStopTimeInSeconds;
    
    // Calculate segment percentage
    const segmentProgress = Math.min(1, Math.max(0, elapsedInSegment / totalSegmentDuration));
    
    // Calculate the base progress (percentage of journey completed up to last passed stop)
    const baseProgress = lastPassedStopIndex / (stopTimes.length - 1);
    
    // Calculate the segment size (percentage of journey between last passed stop and next stop)
    const segmentSize = 1 / (stopTimes.length - 1);
    
    // Return the total progress
    return Math.min(1, baseProgress + segmentProgress * segmentSize);
  };

  const handlePreviousTrip = () => {
    if (currentTripIndex > 0) {
      setIsChangingTrip(true); // Indiquer qu'un changement est en cours
      setIsManualNavigation(true);
      lastManualNavigationTime.current = Date.now();
      const newIndex = currentTripIndex - 1;
      setCurrentTripIndex(newIndex);
      setLastSelectedTripIndex(newIndex);
      if (showMap && map.current) {
        try {
          updateMapData(newIndex);
        } catch (error) {
          // // // // console.error('Error updating map on previous trip:', error);
          // Don't set mapError here to avoid flashing message
        }
      } else if (showMap) {
        setMapLoading(true);
      }
      // Utiliser requestAnimationFrame pour un rendu plus fluide
      requestAnimationFrame(() => {
        // Reset après la mise à jour du DOM
      setTimeout(() => {
        setIsManualNavigation(false);
          setIsChangingTrip(false);
        }, 100); // Court délai pour permettre au DOM de se mettre à jour
      });
    }
  };

  const handleNextTrip = () => {
    if (currentTripIndex < trips.length - 1) {
      setIsChangingTrip(true); // Indiquer qu'un changement est en cours
      setIsManualNavigation(true);
      lastManualNavigationTime.current = Date.now();
      const newIndex = currentTripIndex + 1;
      setCurrentTripIndex(newIndex);
      setLastSelectedTripIndex(newIndex);
      if (showMap && map.current) {
        try {
          updateMapData(newIndex);
        } catch (error) {
          // // // // console.error('Error updating map on next trip:', error);
          // Don't set mapError here to avoid flashing message
        }
      } else if (showMap) {
        setMapLoading(true);
      }
      // Utiliser requestAnimationFrame pour un rendu plus fluide
      requestAnimationFrame(() => {
        // Reset après la mise à jour du DOM
      setTimeout(() => {
        setIsManualNavigation(false);
          setIsChangingTrip(false);
        }, 100); // Court délai pour permettre au DOM de se mettre à jour
      });
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setIsManualNavigation(true);
    lastManualNavigationTime.current = Date.now();
    setCurrentTripIndex(0);
    setLastSelectedTripIndex(null);
    
    // Invalider le cache des données spécifiques à la date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayNum = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayNum}`;
    
    // Invalider uniquement le cache des exceptions du calendrier pour cette date
    invalidateCache(`calendar-exceptions-${networkId}-${dateStr}`);
    
    setTimeout(() => {
      setIsManualNavigation(false);
    }, 5000);
  };

  const handleTimeChange = (time) => {
    setSelectedTime(time);
    setIsManualNavigation(true);
    lastManualNavigationTime.current = Date.now();
    
    const [hours, minutes] = time.split(':').map(Number);
    const selectedTimeInMinutes = hours * 60 + minutes;
    
    if (trips.length > 0) {
      let newTripIndex = -1;
      
      newTripIndex = trips.findIndex(trip => {
        const firstStop = trip.stop_times[0];
        const firstTime = firstStop.departure_time || firstStop.arrival_time;
        if (!firstTime) return false;
        
        const [tripHours, tripMinutes] = firstTime.split(':').map(Number);
        const tripTimeInMinutes = tripHours * 60 + tripMinutes;
        
        return tripTimeInMinutes >= selectedTimeInMinutes;
      });
      
      if (newTripIndex === -1) {
        let closestTrip = 0;
        let minTimeDiff = Number.MAX_SAFE_INTEGER;
        
        trips.forEach((trip, index) => {
          const firstStop = trip.stop_times[0];
          const firstTime = firstStop.departure_time || firstStop.arrival_time;
          if (!firstTime) return;
          
          const [tripHours, tripMinutes] = firstTime.split(':').map(Number);
          const tripTimeInMinutes = tripHours * 60 + tripMinutes;
          
          const timeDiff = Math.abs(tripTimeInMinutes - selectedTimeInMinutes);
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestTrip = index;
          }
        });
        
        newTripIndex = closestTrip;
      }
      
      // // // // // console.log("Nouveau trajet sélectionné:", newTripIndex, "sur", trips.length);
      setCurrentTripIndex(newTripIndex);
      setLastSelectedTripIndex(newTripIndex);
      if (trips[newTripIndex]) {
        setStopTimes(trips[newTripIndex].stop_times);
      }
    }

    setTimeout(() => {
      setIsManualNavigation(false);
    }, 5000);
  };

  useEffect(() => {
    if (trips.length > 0 && currentTripIndex >= 0 && lastSelectedTripIndex === null) {
      const now = new Date();
      const isToday = selectedDate.toDateString() === now.toDateString();
      
      if (isToday) {
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
        
        const initialIndex = trips.findIndex(trip => {
          const lastStop = trip.stop_times[trip.stop_times.length - 1];
          const lastTime = lastStop.arrival_time || lastStop.departure_time;
          if (!lastTime) return false;
          
          const [hours, minutes] = lastTime.split(':').map(Number);
          return (hours * 60 + minutes) >= currentTimeMinutes;
        });

        if (initialIndex !== -1) {
          setCurrentTripIndex(initialIndex);
          setStopTimes(trips[initialIndex].stop_times);
        }
      }
    }
  }, [trips, selectedDate, lastSelectedTripIndex]);

  const handleDirectionChange = (newDirectionId) => {
    setSelectedDirection(newDirectionId);
    setIsSelectOpen(false);
    navigate(`/network/${networkId}/line/${lineId}/direction/${newDirectionId}/timetable`);
  };

  const formatDate = (date) => {
    // Récupérer le jour de la semaine
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayName = dayNames[date.getDay()];
    
    // Récupérer le jour du mois
    const day = date.getDate();
    
    // Récupérer le nom du mois
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const monthName = monthNames[date.getMonth()];
    
    // Récupérer l'année
    const year = date.getFullYear();
    
    return `${dayName} ${day} ${monthName} ${year}`;
  };

  const toggleScheduleView = () => {
    setShowAllSchedules(prev => !prev);
  };

  const calculateTimeBetweenStops = (currentStop, nextStop) => {
    if (!nextStop) return null;
    
    const currentTime = currentStop.departure_time || currentStop.arrival_time;
    const nextTime = nextStop.arrival_time || nextStop.departure_time;
    
    if (!currentTime || !nextTime) return null;

    const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
    const [nextHours, nextMinutes] = nextTime.split(':').map(Number);

    let diffMinutes = (nextHours * 60 + nextMinutes) - (currentHours * 60 + currentMinutes);
    
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    if (diffMinutes === 1) return '1 minute';
    return `${diffMinutes} minutes`;
  };

  const toggleMapView = () => {
    setShowMap(prev => {
      const closingMap = prev;
      if (closingMap) {
        // Nettoyer tous les marqueurs de véhicules avant de fermer la carte
        Object.values(vehicleMarkers.current).forEach(marker => {
          try {
            marker.remove();
          } catch (e) {
            // // // // console.error('Error removing vehicle marker:', e);
          }
        });
        vehicleMarkers.current = {};
        vehicleAnimationState.current = {};

        if (map.current) {
          if (map.current.getLayer('selected-vehicle-route')) {
            map.current.removeLayer('selected-vehicle-route');
          }
          if (map.current.getSource('selected-vehicle-route')) {
            map.current.removeSource('selected-vehicle-route');
          }
          map.current.remove();
          map.current = null;
        }
        setShowVehicleTimeline(false);
        setSelectedVehicleTripId(null);
        setSelectedVehicleShape(null);
      } else {
        setMapLoading(true);
        // Les marqueurs seront recréés automatiquement par l'effet existant
      }
      return !prev;
    });
  };

  // Effet pour gérer l'affichage des marqueurs quand la carte est visible
  useEffect(() => {
    if (showMap && map.current && vehiclePositions && Object.keys(vehiclePositions).length > 0) {
      updateVehicleMarkers(vehiclePositions);
    }
     }, [showMap, vehiclePositions]);

  useEffect(() => {
    const directionElement = directionRef.current;
    if (directionElement && directions.length > 0) {
      const currentDirection = directions.find(dir => dir.direction_id.toString() === directionId.toString());
      if (currentDirection && directionElement.scrollWidth > directionElement.clientWidth) {
        const startScrolling = () => {
          const scrollDistance = directionElement.scrollWidth - directionElement.clientWidth;
          
          directionElement.scrollLeft = 0;
          
          const scrollDuration = scrollDistance * 30;
          
          let startTime = null;
          const animateScroll = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / scrollDuration, 1);
            
            directionElement.scrollLeft = progress * scrollDistance;
            
            if (progress < 1) {
              window.requestAnimationFrame(animateScroll);
            } else {
              setTimeout(() => {
                directionElement.scrollLeft = 0;
                setTimeout(startScrolling, 2000);
              }, 2000);
            }
          };
          
          window.requestAnimationFrame(animateScroll);
        };
        
        const timer = setTimeout(startScrolling, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [directions, directionId]);

  // S'assurer que selectedTrip est initialisé correctement quand les trajets changent
  useEffect(() => {
    if (trips && trips.length > 0 && !selectedTrip) {
      // // // // // console.log('🔄 Sélection automatique du premier trajet', trips[0]);
      setSelectedTrip(trips[0]);
      setSelectedTripIndex(0);
    }
  }, [trips, selectedTrip]);

  // Ajouter un effet pour synchroniser selectedTrip avec selectedTripIndex
  useEffect(() => {
    if (selectedTripIndex !== null && trips && trips.length > selectedTripIndex) {
      const trip = trips[selectedTripIndex];
      if (trip && (!selectedTrip || selectedTrip.trip_id !== trip.trip_id)) {
        // // // // // console.log('🔄 Mise à jour du trajet sélectionné depuis selectedTripIndex', trip);
        setSelectedTrip(trip);
      }
    }
  }, [selectedTripIndex, trips, selectedTrip]);

  // Fonction qui gère le clic sur un trajet dans la liste
  const handleTripClick = (index) => {
    // // // // // console.log(`👆 Trajet ${index + 1} sélectionné sur ${trips.length}`);
    setSelectedTripIndex(index);
    // Aussi sélectionner le trajet pour les données temps réel
    if (trips[index]) {
      setSelectedTrip(trips[index]);
    }
  };

  // Fonction pour mettre à jour les données de la carte SANS la recharger complètement
  const updateMapData = async (tripIndex) => {
    if (!map.current || !trips[tripIndex]) return;
    
    setIsMapUpdating(true);
    try {
      // // // // // console.log("[updateMapData] Updating map for trip index:", tripIndex);
      const targetTrip = trips[tripIndex];
      if (!targetTrip) throw new Error("Trip data is missing");
      
      // --- Récupérer les données nécessaires --- 
      // Shape ID
      const { data: tripWithShape, error: tripsError } = await supabase
        .from('trips')
        .select('shape_id')
        .eq('trip_id', targetTrip.trip_id)
        .eq('network_id', networkId)
        .single();
      if (tripsError) throw tripsError;
      
      // Stop Times pour le trajet
      const { data: stopTimesData, error: stopTimesError } = await supabase
        .from('stop_times')
        .select('stop_id, stop_sequence')
        .eq('trip_id', targetTrip.trip_id)
        .eq('network_id', networkId)
        .order('stop_sequence', { ascending: true });
      if (stopTimesError) throw stopTimesError;
      if (!stopTimesData || stopTimesData.length === 0) {
        throw new Error('Aucun arrêt (stop_times) trouvé pour ce trajet');
      }
      
      const stopIds = stopTimesData.map(st => st.stop_id);
      const firstStopId = stopTimesData[0].stop_id;
      const lastStopId = stopTimesData[stopTimesData.length - 1].stop_id;
      
      // Informations des arrêts
      const { data: stopsData, error: stopsError } = await supabase
        .from('stops')
        .select('*')
        .in('stop_id', stopIds)
        .eq('network_id', networkId);
      if (stopsError) throw stopsError;
      if (!stopsData || stopsData.length === 0) {
        throw new Error('Aucun détail (stops) trouvé pour les arrêts de ce trajet');
      }
      
      // --- Préparer les données GeoJSON --- 
      let routeGeoJSON = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
      let directionsGeoJSON = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
      let simplifiedGeoJSON = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
      let routeCoordinates = null;
      let hasShapes = false;
      
      // 1. Tracé basé sur les shapes
      if (tripWithShape && tripWithShape.shape_id) {
        const { data: shapesData, error: shapesError } = await supabase
          .from('shapes')
          .select('*')
          .eq('network_id', networkId)
          .eq('shape_id', tripWithShape.shape_id)
          .order('shape_pt_sequence', { ascending: true });
        
        if (!shapesError && shapesData && shapesData.length > 0) {
          const coordinates = shapesData
            .filter(shape => shape.shape_pt_lon && shape.shape_pt_lat)
            .map(shape => [shape.shape_pt_lon, shape.shape_pt_lat]);
            
          if (coordinates.length > 0) {
            hasShapes = true;
            routeCoordinates = coordinates;
            routeGeoJSON.geometry.coordinates = coordinates;
            // // // // // console.log("[updateMapData] Using shapes coordinates:", coordinates.length);
          }
        }
      }
      
      // 2. Tracé basé sur l'API Directions (si pas de shapes)
      if (!hasShapes && stopsData.length >= 2) {
        const directionCoordinates = await calculateRouteUsingDirectionsAPI(stopTimesData, stopsData);
        if (directionCoordinates && directionCoordinates.length > 0) {
          routeCoordinates = directionCoordinates; // Mettre à jour pour fitBounds
          directionsGeoJSON.geometry.coordinates = directionCoordinates;
          // // // // // console.log("[updateMapData] Using Directions API coordinates:", directionCoordinates.length);
        } else {
          // 3. Tracé simplifié (si API Directions échoue)
          const orderedCoordinates = [];
          stopTimesData.forEach(st => {
            const stop = stopsData.find(s => s.stop_id === st.stop_id);
            if (stop && stop.stop_lon && stop.stop_lat) {
              orderedCoordinates.push([stop.stop_lon, stop.stop_lat]);
            }
          });
          if (orderedCoordinates.length >= 2) {
            routeCoordinates = orderedCoordinates; // Mettre à jour pour fitBounds
            simplifiedGeoJSON.geometry.coordinates = orderedCoordinates;
            // // // // // console.log("[updateMapData] Using simplified straight line coordinates:", orderedCoordinates.length);
          }
        }
      }
      
      // 4. Données GeoJSON des arrêts
      const stopsGeoJSON = {
        type: 'FeatureCollection',
        features: stopsData
          .filter(stop => stop.stop_lon && stop.stop_lat) // Filtrer arrêts sans coordonnées
          .map(stop => ({
            type: 'Feature',
            properties: {
              name: stop.stop_name,
              description: stop.stop_desc,
              isTerminus: stop.stop_id === firstStopId || stop.stop_id === lastStopId,
              isFirstStop: stop.stop_id === firstStopId,
              isLastStop: stop.stop_id === lastStopId
            },
            geometry: {
              type: 'Point',
              coordinates: [stop.stop_lon, stop.stop_lat]
            }
          }))
      };
      // // // // // console.log("[updateMapData] Prepared stops GeoJSON with features:", stopsGeoJSON.features.length);
      
      // --- Mettre à jour les sources Mapbox --- 
      const sourceRoute = map.current.getSource('route');
      const sourceDirections = map.current.getSource('directions-route');
      const sourceSimplified = map.current.getSource('simplified-route');
      const sourceStops = map.current.getSource('stops');
      
      if (sourceRoute) {
        sourceRoute.setData(routeGeoJSON);
        // // // // // console.log("[updateMapData] Updated 'route' source data.");
      } else {
        // // // // console.warn("[updateMapData] Source 'route' not found, creating...");
        map.current.addSource('route', { type: 'geojson', data: routeGeoJSON });
        map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': `#${darkenColor(lineInfo?.route_color)}`, 'line-width': 6, 'line-opacity': 0.8 }
        });
      }
      
      if (sourceDirections) {
        sourceDirections.setData(directionsGeoJSON);
        // // // // // console.log("[updateMapData] Updated 'directions-route' source data.");
      } else if (directionsGeoJSON.geometry.coordinates.length > 0) {
         // // // // console.warn("[updateMapData] Source 'directions-route' not found, creating...");
         map.current.addSource('directions-route', { type: 'geojson', data: directionsGeoJSON });
         map.current.addLayer({
            id: 'directions-route',
            type: 'line',
            source: 'directions-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': `#${darkenColor(lineInfo?.route_color)}`, 'line-width': 5, 'line-opacity': 0.75 }
         });
      }
      
      if (sourceSimplified) {
        sourceSimplified.setData(simplifiedGeoJSON);
        // // // // // console.log("[updateMapData] Updated 'simplified-route' source data.");
      } else if (simplifiedGeoJSON.geometry.coordinates.length > 0) {
          // // // // console.warn("[updateMapData] Source 'simplified-route' not found, creating...");
          map.current.addSource('simplified-route', { type: 'geojson', data: simplifiedGeoJSON });
          map.current.addLayer({
            id: 'simplified-route',
            type: 'line',
            source: 'simplified-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': `#${darkenColor(lineInfo?.route_color)}`, 'line-width': 4, 'line-opacity': 0.6, 'line-dasharray': [2, 2] }
          });
      }
      
      if (sourceStops) {
        sourceStops.setData(stopsGeoJSON);
        // // // // // console.log("[updateMapData] Updated 'stops' source data.");
      } else {
          // // // // console.warn("[updateMapData] Source 'stops' not found, creating...");
          map.current.addSource('stops', { type: 'geojson', data: stopsGeoJSON });
          // Recréer les couches stops et stop-labels si la source est recréée
          if (!map.current.getLayer('stops')) {
              map.current.addLayer({
                id: 'stops',
                type: 'circle',
                source: 'stops',
                paint: {
                  'circle-radius': ['case', ['get', 'isTerminus'], 6, 4], // Réduit
                  'circle-color': '#FFFFFF',
                  'circle-stroke-width': ['case', ['get', 'isTerminus'], 3, 2], // Réduit
                  'circle-stroke-color': ['case', ['get', 'isTerminus'], `#${darkenColor(lineInfo?.route_color)}`, '#000000'],
                  'circle-stroke-opacity': ['case', ['get', 'isTerminus'], 0.9, 1]
                }
              });
          }
          if (!map.current.getLayer('stop-labels')) {
              map.current.addLayer({
                id: 'stop-labels',
                type: 'symbol',
                source: 'stops',
                filter: ['!', ['any', ['get', 'isFirstStop'], ['get', 'isLastStop']]],
                layout: {
                  'text-field': ['get', 'name'], 'text-size': 12, 'text-anchor': 'top', 
                  'text-offset': [0, 1.5], 'text-allow-overlap': false, 'text-ignore-placement': false
                },
                paint: { 'text-color': '#000000', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 }
              });
          }
      }
      
      // --- Supprimer et recréer les marqueurs HTML des terminus --- 
      document.querySelectorAll('.custom-marker').forEach(el => el.remove());
      
      stopsData.forEach(stop => {
        if (stop.stop_lon && stop.stop_lat && (stop.stop_id === firstStopId || stop.stop_id === lastStopId)) {
          const markerEl = document.createElement('div');
          markerEl.className = 'custom-marker';
          // ... (création du contenu du marker HTML comme avant) ...
          const card = document.createElement('div');
          card.style.backgroundColor = '#FFFFFF';
          card.style.borderRadius = '4px';
          card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
          card.style.padding = '3px 8px';
          card.style.fontSize = '11px';
          card.style.fontWeight = '500';
          card.style.whiteSpace = 'nowrap';
          card.style.display = 'inline-flex';
          card.style.alignItems = 'center';
          card.style.gap = '3px';
          card.style.transform = 'translateY(-115%)';
          card.style.width = 'fit-content';
          card.style.position = 'relative';
          
          const container = document.createElement('div');
          container.style.display = 'inline-flex';
          container.style.alignItems = 'center';
          container.style.width = 'fit-content';
          container.style.gap = '4px';
          
          const prefix = document.createElement('span');
          prefix.style.color = '#666666';
          prefix.style.fontWeight = '400';
          prefix.textContent = stop.stop_id === firstStopId ? 'De :' : 'Vers :';
          
          const spacer = document.createElement('span');
          spacer.textContent = ' ';
          spacer.style.display = 'inline-block';
          spacer.style.width = '4px';
          
          const name = document.createElement('span');
          name.style.color = '#000000';
          name.style.fontWeight = '500';
          name.textContent = stop.stop_name;
          
          container.appendChild(prefix);
          container.appendChild(name);
          card.appendChild(container);
          markerEl.appendChild(card);
          
          try {
              new window.mapboxgl.Marker({
                element: markerEl,
                anchor: 'bottom'
              })
              .setLngLat([stop.stop_lon, stop.stop_lat])
              .addTo(map.current);
          } catch (e) {
              // // // // console.error("Error adding HTML marker:", e);
          }
        }
      });
      // // // // // console.log("[updateMapData] Updated HTML markers.");
      
      // --- Ajuster la vue --- 
      if (routeCoordinates && routeCoordinates.length > 0) {
        const bounds = routeCoordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new window.mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]));
        
        map.current.fitBounds(bounds, {
          padding: { top: 70, bottom: 70, left: 70, right: 70 },
          maxZoom: 15, 
          duration: 500 // Animation plus douce
        });
        // // // // // console.log("[updateMapData] Adjusted map bounds.");
      }
      
    } catch (error) {
      // // // // console.error('Error updating map data:', error);
      setMapError(`Erreur lors de la mise à jour de la carte: ${error.message}`);
    } finally {
      setIsMapUpdating(false);
      // // // // // console.log("[updateMapData] Finished updating map.");
    }
  };

  // Ajouter cette fonction utilitaire en haut du composant
  const retryWithDelay = async (fn, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        // // // // console.warn(`Tentative ${i + 1}/${retries} échouée, nouvelle tentative dans ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  // Référence pour stocker la dernière requête réussie
  const lastSuccessfulRequest = useRef(null);
  const lastUpdateTime = useRef(null);

  // Charger les positions des véhicules une fois que la timeline est chargée
  useEffect(() => {
    if (!networkId || !lineInfo || loading) return;

    const loadVehiclePositions = async () => {
      try {
        const data = await fetchVehiclePositionData(networkId, lineInfo?.subnetwork_name);
        if (data) {
          const filteredPositions = {};
          Object.entries(data).forEach(([vehicleId, vehicleData]) => {
            if (vehicleData.routeId === lineId) {
              filteredPositions[vehicleId] = vehicleData;
            }
          });
          setVehiclePositions(filteredPositions);
        }
      } catch (err) {
        // // // // console.error('Erreur lors du chargement des positions:', err);
      }
    };

    loadVehiclePositions();
    const intervalId = setInterval(loadVehiclePositions, 15000);

    return () => {
      clearInterval(intervalId);
      if (showMap) {
        Object.values(vehicleMarkers.current).forEach(marker => marker.remove());
        vehicleMarkers.current = {};
      }
    };
  }, [networkId, lineId, lineInfo, loading]); // Ajouter showMap aux dépendances

  // Fonction pour mettre à jour les marqueurs des véhicules
  const updateVehicleMarkers = (positions) => {
    if (!map.current || !lineInfo) return;
    
    // Créer une copie des IDs existants pour éviter la modification directe
    const existingMarkerIds = Array.from(Object.keys(vehicleMarkers.current));
    const currentVehicleIds = new Set(Object.keys(positions));
    const routeColor = `#${lineInfo.route_color || '333333'}`;
    const textColor = `#${lineInfo.route_text_color || 'FFFFFF'}`;

    const now = performance.now();

    // Ajouter ou mettre à jour les marqueurs
    Object.entries(positions).forEach(([vehicleId, data]) => {
      const { lat, lon, bearing } = data;
      const newTargetPos = { lon, lat };

      if (vehicleMarkers.current[vehicleId]) {
        // --- Marqueur existant ---
        const marker = vehicleMarkers.current[vehicleId];
        const currentPos = marker.getLngLat();
        const currentState = vehicleAnimationState.current[vehicleId] || {
          lastPos: { lon: currentPos.lng, lat: currentPos.lat },
          targetPos: { lon: currentPos.lng, lat: currentPos.lat },
          animationFrameId: null
        };

        // Vérifier si la position a changé
        if (currentState.targetPos.lon !== newTargetPos.lon || currentState.targetPos.lat !== newTargetPos.lat) {
          // Annuler l'animation précédente si elle existe
          if (currentState.animationFrameId) {
            cancelAnimationFrame(currentState.animationFrameId);
          }

          // Mettre à jour l'état d'animation
          currentState.lastPos = { lon: currentPos.lng, lat: currentPos.lat };
          currentState.targetPos = newTargetPos;
          currentState.startTime = now;

          // Fonction d'animation
          const animate = (timestamp) => {
            const progress = Math.min(1, (timestamp - currentState.startTime) / 1000);
            
            const newLng = currentState.lastPos.lon + (newTargetPos.lon - currentState.lastPos.lon) * progress;
            const newLat = currentState.lastPos.lat + (newTargetPos.lat - currentState.lastPos.lat) * progress;
            
            try {
              marker.setLngLat([newLng, newLat]);
            } catch (e) {
              // // // // console.error(`Error updating marker position for ${vehicleId}:`, e);
            }

            if (progress < 1) {
              currentState.animationFrameId = requestAnimationFrame(animate);
            } else {
              currentState.animationFrameId = null;
            }
          };

          // Démarrer l'animation
          currentState.animationFrameId = requestAnimationFrame(animate);
          vehicleAnimationState.current[vehicleId] = currentState;
        }

        // Mise à jour de la rotation avec transition CSS
        const markerElement = marker.getElement();
        if (markerElement) {
          const arrowContainer = markerElement.querySelector('.vehicle-arrow-container');
          if (arrowContainer) {
            arrowContainer.style.transition = 'transform 0.5s ease-out';
            arrowContainer.style.transform = `rotate(${bearing !== null ? bearing : 0}deg)`;
          }
        }

      } else {
        // --- Nouveau marqueur ---
        const el = document.createElement('div');
        el.className = 'vehicle-marker';
        el.style.pointerEvents = 'none';

        const backgroundDiv = document.createElement('div');
        backgroundDiv.className = 'vehicle-background';
        backgroundDiv.style.width = '35px';
        backgroundDiv.style.height = '35px';
        backgroundDiv.style.borderRadius = '50%';
        backgroundDiv.style.backgroundColor = `#${darkenColor(lineInfo?.route_color)}`;
        backgroundDiv.style.display = 'flex';
        backgroundDiv.style.justifyContent = 'center';
        backgroundDiv.style.alignItems = 'center';
        backgroundDiv.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
        backgroundDiv.style.position = 'relative';
        backgroundDiv.style.overflow = 'visible';

        const busIconContainer = document.createElement('div');
        busIconContainer.className = 'bus-icon-container';
        busIconContainer.style.position = 'absolute';
        busIconContainer.style.top = '50%';
        busIconContainer.style.left = '50%';
        busIconContainer.style.transform = 'translate(-50%, -50%)';
        busIconContainer.innerHTML = ReactDOMServer.renderToString(
          <FaBus size={18} color={isColorDark(darkenColor(lineInfo?.route_color)) ? '#FFFFFF' : '#000000'} style={{ display: 'block' }} />
        );

        const arrowContainer = document.createElement('div');
        arrowContainer.className = 'vehicle-arrow-container';
        arrowContainer.style.position = 'absolute';
        arrowContainer.style.top = '0';
        arrowContainer.style.left = '0';
        arrowContainer.style.width = '100%';
        arrowContainer.style.height = '100%';
        arrowContainer.style.transform = `rotate(${bearing !== null ? bearing : 0}deg)`;
        arrowContainer.style.pointerEvents = 'none';

        const arrow = document.createElement('div');
        arrow.className = 'vehicle-arrow';
        arrow.style.position = 'absolute';
        arrow.style.top = '-12px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.width = '14px';
        arrow.style.height = '14px';
        arrow.innerHTML = `
          <svg viewBox="0 0 14 14" width="14" height="14">
            <polygon points="7,0 14,14 0,14" fill="#${darkenColor(lineInfo?.route_color)}"/>
            <polygon points="7,3 11.5,12 2.5,12" fill="${isColorDark(darkenColor(lineInfo?.route_color)) ? '#FFFFFF' : '#000000'}"/>
          </svg>
        `;

        arrowContainer.appendChild(arrow);
        backgroundDiv.appendChild(busIconContainer);
        backgroundDiv.appendChild(arrowContainer);
        el.appendChild(backgroundDiv);

        try {
          const marker = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([newTargetPos.lon, newTargetPos.lat])
            .addTo(map.current);
          vehicleMarkers.current[vehicleId] = marker;

          // Ajouter le gestionnaire de clic
          if (data.tripId) {
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';
            el.onclick = () => {
              fetchAndDisplayVehicleShape(data.tripId);
              setSelectedVehicleTripId(data.tripId);
              setSelectedVehicleInfo(data);
              setShowVehicleTimeline(true);
            };
          }
        } catch (e) {
          // // // // console.error(`Error creating marker ${vehicleId}:`, e);
        }
      }

      // Marquer ce véhicule comme traité
      const index = existingMarkerIds.indexOf(vehicleId);
      if (index > -1) {
        existingMarkerIds.splice(index, 1);
      }
    });

    // Supprimer les marqueurs obsolètes ET leur état d'animation
    // Nettoyer les marqueurs obsolètes
    for (const vehicleId of existingMarkerIds) {
      if (!currentVehicleIds.has(vehicleId) && vehicleMarkers.current[vehicleId]) {
        // Annuler l'animation en cours si elle existe
        const state = vehicleAnimationState.current[vehicleId];
        if (state?.animationFrameId) {
          cancelAnimationFrame(state.animationFrameId);
        }
        
        // Supprimer le marqueur
        try {
          vehicleMarkers.current[vehicleId].remove();
        } catch (e) {
          // // // // console.error(`Error removing marker ${vehicleId}:`, e);
        }
        
        // Nettoyer les références
        delete vehicleMarkers.current[vehicleId];
        delete vehicleAnimationState.current[vehicleId];
      }
    }
  };

  // Fonction récursive pour l'animation d'un pas
  const animateVehicleStep = (timestamp, vehicleId, marker, state) => {
    // Assurer que l'état et le marqueur existent toujours
    if (!state || !marker || !vehicleMarkers.current[vehicleId]) {
      // // // // // console.log(`[Animation] Aborting step for ${vehicleId} - state or marker missing`);
      if (state) state.animationFrameId = null;
      return;
    }

    const elapsed = timestamp - state.startTime;
    const progress = Math.min(1, elapsed / VEHICLE_ANIMATION_DURATION);

    // Interpolation linéaire (lerp)
    const currentLon = state.lastPos.lon + (state.targetPos.lon - state.lastPos.lon) * progress;
    const currentLat = state.lastPos.lat + (state.targetPos.lat - state.lastPos.lat) * progress;

    // Mettre à jour la position du marqueur Mapbox
    try {
        marker.setLngLat([currentLon, currentLat]);
    } catch (e) {
        // // // // console.error(`[Animation] Error setting LngLat for ${vehicleId}:`, e);
        // Arrêter l'animation en cas d'erreur pour éviter boucle infinie
        state.animationFrameId = null;
        return;
    }

    if (progress < 1) {
      // Continuer l'animation pour la prochaine frame
      state.animationFrameId = requestAnimationFrame(
        (newTimestamp) => animateVehicleStep(newTimestamp, vehicleId, marker, state)
      );
    } else {
      // Animation terminée pour ce segment
      // // // // // console.log(`[Animation] Finished for ${vehicleId}`);
      state.animationFrameId = null;
      // Assurer la position finale exacte
       try {
            marker.setLngLat([state.targetPos.lon, state.targetPos.lat]);
       } catch (e) {
            // // // // console.error(`[Animation] Error setting final LngLat for ${vehicleId}:`, e);
       }
      // Mettre à jour lastPos pour la prochaine animation éventuelle
      state.lastPos = { ...state.targetPos };
    }
  };

  // --- useEffect pour charger les détails du trajet du véhicule sélectionné ---
  useEffect(() => {
    const fetchVehicleTripDetails = async () => {
      if (!selectedVehicleTripId || !networkId) {
        setSelectedVehicleStopTimes([]); // Clear previous data if no trip selected
        return;
      }

      setVehicleTimelineLoading(true);
      setVehicleTimelineError(null);
      // // // // // console.log(`[Vehicle Timeline] Fetching details for trip: ${selectedVehicleTripId}`);

      try {
        // 1. Fetch stop_times for the specific trip
        const { data: stopTimesData, error: stopTimesError } = await supabase
          .from('stop_times')
          .select('*') // Select all needed fields
          .eq('trip_id', selectedVehicleTripId)
          .eq('network_id', networkId)
          .order('stop_sequence', { ascending: true });

        if (stopTimesError) throw stopTimesError;
        if (!stopTimesData || stopTimesData.length === 0) {
          throw new Error(`Aucun arrêt trouvé pour le trajet ${selectedVehicleTripId}`);
        }

        // // // // // console.log(`[Vehicle Timeline] Found ${stopTimesData.length} stop times`);

        // 2. Get unique stop_ids from the result
        const stopIds = [...new Set(stopTimesData.map(st => st.stop_id))];

        // 3. Fetch stop details for these stop_ids
        const { data: stopsData, error: stopsError } = await supabase
          .from('stops')
          .select('stop_id, stop_name, stop_lat, stop_lon, city')
          .in('stop_id', stopIds)
          .eq('network_id', networkId);

        if (stopsError) throw stopsError;
        // // // // // console.log(`[Vehicle Timeline] Found ${stopsData.length} stop details`);
        const stopsMap = new Map(stopsData.map(stop => [stop.stop_id, stop]));

        // 4. Combine stop_times with stop details
        const combinedStopTimes = stopTimesData.map(st => {
          const stopInfo = stopsMap.get(st.stop_id);
          return {
            ...st,
            stop_name: stopInfo?.stop_name || `Arrêt ${st.stop_id}`,
            stop_lat: stopInfo?.stop_lat,
            stop_lon: stopInfo?.stop_lon,
            city: stopInfo?.city
          };
        });

        setSelectedVehicleStopTimes(combinedStopTimes);
        // // // // // console.log(`[Vehicle Timeline] Data loaded successfully.`);

      } catch (error) {
        // // // // console.error('[Vehicle Timeline] Error fetching trip details:', error);
        setVehicleTimelineError(error.message || 'Erreur lors du chargement des détails du trajet.');
        setSelectedVehicleStopTimes([]); // Clear data on error
      } finally {
        setVehicleTimelineLoading(false);
      }
    };

    fetchVehicleTripDetails();

  }, [selectedVehicleTripId, networkId]); // Re-run when tripId or networkId changes
  // --- Fin useEffect --- 

  // --- useEffect pour charger la marque et le modèle du véhicule --- 
  useEffect(() => {
    const fetchVehicleDetails = async () => {
      if (!selectedVehicleInfo || !selectedVehicleInfo.vehicleId || !networkId) {
        setSelectedVehicleBrand(null);
        setSelectedVehicleModel(null);
        return;
      }

      setVehicleDetailsLoading(true);
      setSelectedVehicleBrand(null); // Reset previous values
      setSelectedVehicleModel(null);

      try {
        const { data, error } = await supabase
          .from('vehicle_details')
          .select('brand, model')
          .eq('network_id', networkId)
          .eq('vehicle_id', selectedVehicleInfo.vehicleId)
          .single(); // We expect only one entry per network/vehicle combo

        if (error) {
          // If error is 'PGRST116', it means no rows were found, which is not a critical error
          if (error.code !== 'PGRST116') {
            // // // // console.error('[Vehicle Details] Error fetching details:', error);
            // Optionally set an error state here if needed
          } else {
            // // // // // console.log(`[Vehicle Details] No details found for vehicle ${selectedVehicleInfo.vehicleId} on network ${networkId}`);
          }
          // Keep brand and model as null
        } else if (data) {
          // // // // // console.log(`[Vehicle Details] Details found:`, data);
          setSelectedVehicleBrand(data.brand);
          setSelectedVehicleModel(data.model);
        }
      } catch (error) {
        // // // // console.error('[Vehicle Details] Exception fetching details:', error);
        // Keep brand and model as null
      } finally {
        setVehicleDetailsLoading(false);
      }
    };

    fetchVehicleDetails();
  }, [selectedVehicleInfo, networkId]);
  // --- Fin useEffect détails véhicule --- 

  // Ajouter une fonction pour récupérer et afficher le tracé d'un véhicule
  const fetchAndDisplayVehicleShape = async (tripId) => {
    if (!map.current || !tripId || vehicleShapeLock) return;
    
    try {
      // Verrouiller pour éviter les clics multiples
      setVehicleShapeLock(true);
      
      // Commencer à charger sans changer visuellement l'interface
      setSelectedVehicleShapeLoading(true);
      // // // // // console.log(`[Vehicle Shape] Fetching shape for vehicle trip: ${tripId}`);
      
      // --- PHASE 1: PRÉPARATION DES DONNÉES (sans modifier la carte) ---
      
      // Récupérer l'ID du shape associé au trip_id
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('shape_id, direction_id, route_id')
        .eq('trip_id', tripId)
        .eq('network_id', networkId)
        .single();
      
      if (tripError) throw tripError;
      if (!tripData || !tripData.shape_id) {
        // // // // console.warn(`[Vehicle Shape] No shape_id found for trip ${tripId}`);
        return;
      }
      
      // Récupérer les coordonnées du shape
      const { data: shapesData, error: shapesError } = await supabase
        .from('shapes')
        .select('*')
        .eq('network_id', networkId)
        .eq('shape_id', tripData.shape_id)
        .order('shape_pt_sequence', { ascending: true });
      
      if (shapesError) throw shapesError;
      
      if (!shapesData || shapesData.length === 0) {
        // // // // console.warn(`[Vehicle Shape] No shape points found for shape_id ${tripData.shape_id}`);
        return;
      }
      
      // Préparer les données pour la carte
      const coordinates = shapesData
        .filter(shape => shape.shape_pt_lon && shape.shape_pt_lat)
        .map(shape => [shape.shape_pt_lon, shape.shape_pt_lat]);
      
      if (coordinates.length === 0) {
        // // // // console.warn(`[Vehicle Shape] No valid coordinates found for shape_id ${tripData.shape_id}`);
        return;
      }
      
      // Récupérer les arrêts pour ce trip
      const { data: vehicleStopTimesData, error: stopTimesError } = await supabase
        .from('stop_times')
        .select('stop_id, stop_sequence')
        .eq('trip_id', tripId)
        .eq('network_id', networkId)
        .order('stop_sequence', { ascending: true });
      
      if (stopTimesError) {
        // // // // console.error(`[Vehicle Shape] Error fetching stop times: ${stopTimesError.message}`);
      }
      
      // Préparer les données des arrêts
      let stopsGeoJSON = null;
      let firstStopId = null;
      let lastStopId = null;
      let terminusStops = [];

      if (vehicleStopTimesData && vehicleStopTimesData.length > 0) {
        const stopIds = vehicleStopTimesData.map(st => st.stop_id);
        firstStopId = vehicleStopTimesData[0].stop_id;
        lastStopId = vehicleStopTimesData[vehicleStopTimesData.length - 1].stop_id;
        
        const { data: stopsData, error: stopsError } = await supabase
          .from('stops')
          .select('*')
          .in('stop_id', stopIds)
          .eq('network_id', networkId);
        
        if (!stopsError && stopsData && stopsData.length > 0) {
          // Identifie les terminus pour plus tard
          terminusStops = stopsData.filter(stop => 
            (stop.stop_id === firstStopId || stop.stop_id === lastStopId) && 
            stop.stop_lon && stop.stop_lat
          );
          
          // Créer un GeoJSON pour les arrêts du véhicule
          stopsGeoJSON = {
            type: 'FeatureCollection',
            features: stopsData
              .filter(stop => stop.stop_lon && stop.stop_lat)
              .map(stop => ({
                type: 'Feature',
                properties: {
                  name: stop.stop_name,
                  description: stop.stop_desc,
                  isTerminus: stop.stop_id === firstStopId || stop.stop_id === lastStopId,
                  isFirstStop: stop.stop_id === firstStopId,
                  isLastStop: stop.stop_id === lastStopId
                },
                geometry: {
                  type: 'Point',
                  coordinates: [stop.stop_lon, stop.stop_lat]
                }
              }))
          };
        }
      }
      
      // Calculer les limites pour ajuster la vue
      let viewBounds;
      try {
        viewBounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new window.mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      } catch (e) {
        // // // // console.error(`[Vehicle Shape] Error calculating bounds: ${e.message}`);
      }
      
      // --- PHASE 2: NETTOYAGE SYNCHRONE ---
      // Nettoyer les anciens marqueurs immédiatement (moins visible que les couches)
      document.querySelectorAll('.custom-marker').forEach(el => el.remove());
      
      // --- PHASE 3: PRÉPARATION DES SOURCES ET COUCHES ---
      // Dans cette phase, nous préparons ou mettons à jour les sources AVANT de les rendre visibles
      
      // Préparer la source du tracé
      const routeGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
        }
      };
      
      // Traiter les sources/couches du véhicule d'abord
      if (map.current.getSource('selected-vehicle-route')) {
        try {
          // Mettre à jour sans encore changer la visibilité
          map.current.getSource('selected-vehicle-route').setData(routeGeoJSON);
        } catch (e) {
          // // // // console.error(`[Vehicle Shape] Error updating route source: ${e.message}`);
          // En cas d'erreur, nettoyer complètement et recréer
          if (map.current.getLayer('selected-vehicle-route')) map.current.removeLayer('selected-vehicle-route');
          if (map.current.getSource('selected-vehicle-route')) map.current.removeSource('selected-vehicle-route');
          
          // Recréer la source
          try {
            map.current.addSource('selected-vehicle-route', { type: 'geojson', data: routeGeoJSON });
            
            map.current.addLayer({
              id: 'selected-vehicle-route',
              type: 'line',
              source: 'selected-vehicle-route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
                'visibility': 'none' // Initialement caché
              },
              paint: {
                'line-color': `#${lineInfo?.route_color || 'FF4136'}`,
                'line-width': 5,
                'line-opacity': 0.9
              }
            });
          } catch (e2) {
            // // // // console.error(`[Vehicle Shape] Error recreating route: ${e2.message}`);
          }
        }
      } else {
        // Créer la source depuis zéro
        try {
          map.current.addSource('selected-vehicle-route', { type: 'geojson', data: routeGeoJSON });
          
          map.current.addLayer({
            id: 'selected-vehicle-route',
            type: 'line',
            source: 'selected-vehicle-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              'visibility': 'none' // Initialement caché
            },
            paint: {
              'line-color': `#${darkenColor(lineInfo?.route_color)}`,
              'line-width': 5,
              'line-opacity': 0.9
            }
          });
        } catch (e) {
          // // // // console.error(`[Vehicle Shape] Error creating new route: ${e.message}`);
        }
      }
      
      // Préparer les arrêts du véhicule si disponibles
      if (stopsGeoJSON && stopsGeoJSON.features.length > 0) {
        try {
          if (map.current.getSource('selected-vehicle-stops')) {
            // Mettre à jour sans changer la visibilité
            map.current.getSource('selected-vehicle-stops').setData(stopsGeoJSON);
          } else {
            // Créer la source et les couches depuis zéro
            map.current.addSource('selected-vehicle-stops', { type: 'geojson', data: stopsGeoJSON });
            
            // Ajouter les couches mais les garder cachées pour l'instant
            map.current.addLayer({
              id: 'selected-vehicle-stops',
              type: 'circle',
              source: 'selected-vehicle-stops',
              layout: { 'visibility': 'none' },
              paint: {
                'circle-radius': [
                  'case',
                  ['get', 'isTerminus'],
                  8, 4
                ],
                'circle-color': '#FFFFFF',
                'circle-stroke-width': [
                  'case',
                  ['get', 'isTerminus'],
                  3, 2
                ],
                'circle-stroke-color': [
                  'case',
                  ['get', 'isTerminus'],
                  `#${darkenColor(lineInfo?.route_color)}`,
                  '#000000'
                ],
                'circle-stroke-opacity': [
                  'case',
                  ['get', 'isTerminus'],
                  0.9, 1
                ]
              }
            });

            // Ajouter la couche pour les flèches de départ/arrivée
            map.current.addLayer({
              id: 'selected-vehicle-arrows',
              type: 'symbol',
              source: 'selected-vehicle-stops',
              layout: {
                'visibility': 'none',
                'icon-image': [
                  'case',
                  ['get', 'isFirstStop'],
                  'arrow-up',
                  ['get', 'isLastStop'],
                  'arrow-down',
                  'circle'
                ],
                'icon-size': 1,
                'icon-offset': [0, -15],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
              },
              filter: ['get', 'isTerminus']
            });

            // Charger les images des flèches
            const loadArrowImages = async () => {
              // Flèche de départ (vers le haut)
              const upArrowSvg = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3L4 11H20L12 3Z" fill="#${darkenColor(lineInfo?.route_color)}"/>
                  <rect x="10" y="9" width="4" height="12" fill="#${darkenColor(lineInfo?.route_color)}"/>
                </svg>
              `;
              
              // Flèche d'arrivée (vers le bas)
              const downArrowSvg = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 21L4 13H20L12 21Z" fill="#${darkenColor(lineInfo?.route_color)}"/>
                  <rect x="10" y="3" width="4" height="12" fill="#${darkenColor(lineInfo?.route_color)}"/>
                </svg>
              `;

              // Convertir les SVG en images
              const createImage = (svg, name) => {
                return new Promise((resolve, reject) => {
                  const img = new Image();
                  img.onload = () => {
                    if (map.current) {
                      map.current.addImage(name, img);
                      resolve();
                    }
                  };
                  img.onerror = reject;
                  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                });
              };

              try {
                await Promise.all([
                  createImage(upArrowSvg, 'arrow-up'),
                  createImage(downArrowSvg, 'arrow-down')
                ]);
              } catch (error) {
                console.error('Error loading arrow images:', error);
              }
            };

            loadArrowImages();
            
            map.current.addLayer({
              id: 'selected-vehicle-stop-labels',
              type: 'symbol',
              source: 'selected-vehicle-stops',
              filter: ['!', ['any', ['get', 'isFirstStop'], ['get', 'isLastStop']]],
              layout: {
                'text-field': ['get', 'name'],
                'text-size': 12,
                'text-anchor': 'top',
                'text-offset': [0, 1.5],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'visibility': 'none' // Initialement caché
              },
              paint: {
                'text-color': '#000000',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 2
              }
            });
          }
        } catch (e) {
          // // // // console.error(`[Vehicle Shape] Error handling stops: ${e.message}`);
        }
      }
      
      // --- PHASE 4: TRANSITION SYNCHRONISÉE ---
      // Maintenant que toutes les sources et couches sont prêtes, nous pouvons faire la transition
      
      // 1. Masquer les couches originales
      const existingLayers = ['route', 'directions-route', 'simplified-route', 'stops', 'stop-labels'];
      existingLayers.forEach(layerId => {
        if (map.current && map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });
      
      // 2. Rendre visibles les couches du véhicule (maintenant prêtes)
      if (map.current.getLayer('selected-vehicle-route')) {
        map.current.setLayoutProperty('selected-vehicle-route', 'visibility', 'visible');
      }
      
      if (map.current.getLayer('selected-vehicle-stops')) {
        map.current.setLayoutProperty('selected-vehicle-stops', 'visibility', 'visible');
      }
      
      if (map.current.getLayer('selected-vehicle-stop-labels')) {
        map.current.setLayoutProperty('selected-vehicle-stop-labels', 'visibility', 'visible');
      }
      if (map.current.getLayer('selected-vehicle-arrows')) {
        map.current.setLayoutProperty('selected-vehicle-arrows', 'visibility', 'visible');
      }
      
      // 3. Ajouter les marqueurs de terminus (maintenant que les couches sont visibles)
      if (terminusStops.length > 0) {
        terminusStops.forEach(stop => {
          const isFirstStop = stop.stop_id === firstStopId;
          
          const markerEl = document.createElement('div');
          markerEl.className = 'custom-marker vehicle-custom-marker';
          markerEl.style.width = 'fit-content';
          markerEl.style.opacity = '0'; // Commencer transparent
          markerEl.style.transition = 'opacity 0.3s ease'; // Transition fluide
          
          const card = document.createElement('div');
          card.style.backgroundColor = '#FFFFFF';
          card.style.borderRadius = '4px';
          card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
          card.style.padding = '3px 8px';
          card.style.fontSize = '11px';
          card.style.fontWeight = '500';
          card.style.whiteSpace = 'nowrap';
          card.style.display = 'inline-flex';
          card.style.alignItems = 'center';
          card.style.gap = '3px';
          card.style.transform = 'translateY(-115%)';
          card.style.width = 'fit-content';
          card.style.position = 'relative';
          
          const container = document.createElement('div');
          container.style.display = 'inline-flex';
          container.style.alignItems = 'center';
          container.style.width = 'fit-content';
          container.style.gap = '4px';
          
          const prefix = document.createElement('span');
          prefix.style.color = '#666666';
          prefix.style.fontWeight = '400';
          prefix.textContent = isFirstStop ? 'De :' : 'Vers :';
          
          const name = document.createElement('span');
          name.style.color = '#000000';
          name.style.fontWeight = '500';
          name.textContent = stop.stop_name;
          
          container.appendChild(prefix);
          container.appendChild(name);
          card.appendChild(container);
          markerEl.appendChild(card);
          
          try {
            const marker = new window.mapboxgl.Marker({
              element: markerEl,
              anchor: 'bottom'
            })
            .setLngLat([stop.stop_lon, stop.stop_lat])
            .addTo(map.current);
            
            // Afficher avec une transition après qu'il ait été ajouté
            setTimeout(() => {
              markerEl.style.opacity = '1';
            }, 50);
          } catch (e) {
            // // // // console.error(`[Vehicle Shape] Error adding terminus marker: ${e.message}`);
          }
        });
      }
      
      // 4. Ajuster la vue pour montrer le tracé complet, si les limites ont été calculées
      if (viewBounds) {
        try {
          map.current.fitBounds(viewBounds, {
            padding: { top: 70, bottom: 70, left: 70, right: 70 },
            maxZoom: 14,
            duration: 800
          });
        } catch (e) {
          // // // // console.error(`[Vehicle Shape] Error adjusting map bounds:`, e);
        }
      }
      
      // 5. Mettre à jour l'état après la transition visuelle
      setSelectedVehicleShape({
        coordinates,
        routeId: tripData.route_id, 
        directionId: tripData.direction_id,
        shapeId: tripData.shape_id,
        stopsGeoJSON
      });
      
    } catch (error) {
      // // // // console.error('[Vehicle Shape] Error fetching shape:', error);
      setSelectedVehicleShapeError(error.message);
      
      // En cas d'erreur, nettoyer et restaurer l'affichage original
      await restoreOriginalRoutes();
    } finally {
      setSelectedVehicleShapeLoading(false);
      
      // Déverrouiller après la fin de toutes les opérations
      setTimeout(() => {
        setVehicleShapeLock(false);
      }, 300);
    }
  };

  // Fonction pour restaurer les tracés originaux
  const restoreOriginalRoutes = async () => { // Rendre la fonction async
    if (!map.current) return;
    
    // // // // // console.log('[Vehicle Shape] Restoring original route layers');
    
    // Supprimer tous les marqueurs existants
    document.querySelectorAll('.custom-marker').forEach(el => el.remove());
    
    // Supprimer le tracé du véhicule
    if (map.current.getLayer('selected-vehicle-route')) {
      map.current.removeLayer('selected-vehicle-route');
    }
    if (map.current.getSource('selected-vehicle-route')) {
      map.current.removeSource('selected-vehicle-route');
    }
    
    // Supprimer les arrêts du véhicule
    if (map.current.getLayer('selected-vehicle-stops')) {
      map.current.removeLayer('selected-vehicle-stops');
    }
    if (map.current.getLayer('selected-vehicle-stop-labels')) {
      map.current.removeLayer('selected-vehicle-stop-labels');
    }
    if (map.current.getSource('selected-vehicle-stops')) {
      map.current.removeSource('selected-vehicle-stops');
    }
    
    // Restaurer la visibilité des tracés et arrêts originaux
    const existingLayers = ['route', 'directions-route', 'simplified-route', 'stops', 'stop-labels'];
    existingLayers.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', 'visible');
      }
    });
    
    // --- Recréer les marqueurs HTML originaux --- 
    try {
      if (trips && trips[currentTripIndex] && trips[currentTripIndex].stop_times) {
        const currentTripStopTimes = trips[currentTripIndex].stop_times;
        if (currentTripStopTimes.length > 0) {
          const firstStopId = currentTripStopTimes[0].stop_id;
          const lastStopId = currentTripStopTimes[currentTripStopTimes.length - 1].stop_id;
          const stopIds = currentTripStopTimes.map(st => st.stop_id);
          
          // Récupérer les détails des arrêts pour le trajet actuel
          const { data: stopsData, error: stopsError } = await supabase
            .from('stops')
            .select('*')
            .in('stop_id', stopIds)
            .eq('network_id', networkId);
            
          if (stopsError) {
            // // // // console.error("[Restore Markers] Error fetching stops:", stopsError);
          } else if (stopsData) {
            // Ajouter les marqueurs HTML personnalisés pour les terminus du trajet ACTUEL
            stopsData.forEach(stop => {
              if (stop.stop_lon && stop.stop_lat && (stop.stop_id === firstStopId || stop.stop_id === lastStopId)) { // Vérifier aussi lon/lat
                const markerEl = document.createElement('div');
                markerEl.className = 'custom-marker'; // Utiliser la classe originale
                markerEl.style.width = 'fit-content';
                
                const card = document.createElement('div');
                card.style.backgroundColor = '#FFFFFF';
                card.style.borderRadius = '4px';
                card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                card.style.padding = '3px 8px';
                card.style.fontSize = '11px';
                card.style.fontWeight = '500';
                card.style.whiteSpace = 'nowrap';
                card.style.display = 'inline-flex';
                card.style.alignItems = 'center';
                card.style.gap = '3px';
                card.style.transform = 'translateY(-115%)';
                card.style.width = 'fit-content';
                card.style.position = 'relative';
                
                const container = document.createElement('div');
                container.style.display = 'inline-flex';
                container.style.alignItems = 'center';
                container.style.width = 'fit-content';
                container.style.gap = '4px';
                
                const prefix = document.createElement('span');
                prefix.style.color = '#666666';
                prefix.style.fontWeight = '400';
                prefix.textContent = stop.stop_id === firstStopId ? 'De :' : 'Vers :';
                
                const name = document.createElement('span');
                name.style.color = '#000000';
                name.style.fontWeight = '500';
                name.textContent = stop.stop_name;
                
                container.appendChild(prefix);
                container.appendChild(name);
                card.appendChild(container);
                markerEl.appendChild(card);
                
                try {
                  new window.mapboxgl.Marker({
                    element: markerEl,
                    anchor: 'bottom'
                  })
                  .setLngLat([stop.stop_lon, stop.stop_lat])
                  .addTo(map.current);
                } catch (e) {
                  // // // // console.error(`[Restore Markers] Error adding original terminus marker: ${e.message}`);
                }
              }
            });
            // // // // // console.log("[Restore Markers] Successfully recreated original terminus markers.");
          }
        }
      }
    } catch (err) {
      // // // // console.error("[Restore Markers] Failed to recreate original terminus markers:", err);
    }
    // --- Fin recréation --- 
    
    setSelectedVehicleShape(null);
  };

  // Ajouter un effet pour supprimer le tracé du véhicule quand on ferme la timeline
  useEffect(() => {
    if (!showVehicleTimeline && map.current) {
      // Restaurer les tracés originaux quand on ferme la timeline
      restoreOriginalRoutes();
    }
  }, [showVehicleTimeline]);

  // Ajouter un effet pour supprimer le tracé du véhicule lors du changement de trajet
  useEffect(() => {
    if (map.current) {
      // Restaurer les tracés originaux quand on change de trajet
      restoreOriginalRoutes();
    }
  }, [currentTripIndex]);

  // Charger les informations de trafic
  useEffect(() => {
    const loadTrafficInfo = async () => {
      if (!selectedTrip) return;

      try {
        const networkId = selectedTrip.network_id;
        const routeId = selectedTrip.route_id;
        const directionId = selectedTrip.direction_id;

        const trafficData = await getActiveTrafficInfo(
          networkId,
          routeId,
          directionId,
          selectedDate
        );

        // // // // // console.log(`[Timetable] ${trafficData.length} informations de trafic chargées`);
        setTrafficInfos(trafficData);
      } catch (error) {
        // // // // console.error('[Timetable] Erreur lors du chargement des informations de trafic:', error);
        setTrafficInfos([]);
      }
    };

    loadTrafficInfo();
  }, [selectedTrip, selectedDate]);

  // Ajouter le chargement des infos trafic à l'intervalle de rafraîchissement des données temps réel
  useEffect(() => {
    const origLoadRealtimeData = loadRealtimeDataRef.current;
    
    // Surcharger la fonction pour ajouter le chargement des infos trafic
    if (origLoadRealtimeData) {
      loadRealtimeDataRef.current = async () => {
        // Appeler la fonction originale
        await origLoadRealtimeData();
        
        // Puis charger les infos trafic
        if (selectedTrip) {
          try {
            const networkId = selectedTrip.network_id;
            const routeId = selectedTrip.route_id;
            const directionId = selectedTrip.direction_id;

            const trafficData = await getActiveTrafficInfo(
              networkId,
              routeId,
              directionId,
              selectedDate
            );

            // // // // // console.log(`[Refresh] ${trafficData.length} informations de trafic chargées`);
            setTrafficInfos(trafficData);
          } catch (error) {
            // // // // console.error('[Refresh] Erreur lors du chargement des informations de trafic:', error);
          }
        }
      };
    }
    
    return () => {
      // Restaurer la fonction originale
      loadRealtimeDataRef.current = origLoadRealtimeData;
    };
  }, [selectedTrip, selectedDate]);

  // Ajouter un effet pour gérer l'intersection observer
  useEffect(() => {
    if (!controlsRef.current || showMap) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingButtons(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
      }
    );

    observer.observe(controlsRef.current);

    return () => {
      observer.disconnect();
    };
  }, [showMap]);

  // Supprimer seulement le spinner global, sans afficher d'erreur par défaut
  if (error) return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center transition-colors duration-200">
      <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-lg shadow-sm border border-red-200 dark:border-red-900 max-w-lg">
        <div className="flex items-center">
          <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="ml-2 text-lg font-semibold text-red-800 dark:text-red-300">Erreur</h3>
        </div>
        <p className="mt-2 text-red-700 dark:text-red-300">{error}</p>
        <Link to={`/network/${networkId}/line/${lineId}/directions`} className="mt-4 inline-flex items-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
          <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour aux directions
        </Link>
      </div>
    </div>
  );
   
  // Mise à jour pour un chargement séquentiel
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
      {/* Header - Toujours affiché immédiatement */}
      <TimetableHeader
        networkId={networkId}
        lineId={lineId}
        lineInfo={lineInfo || {}}
        selectedDirection={selectedDirection}
        directions={directions}
      />

      <main className="max-w-7xl mx-auto py-4 px-3 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow transition-colors duration-200">
          <div className="p-4">
            {/* Ajouter la ref aux contrôles */}
            <div ref={controlsRef}>
              {lineInfo ? (
                <TimetableControls
                  selectedDate={selectedDate}
                  handleDateChange={handleDateChange}
                  selectedTime={selectedTime}
                  handleTimeChange={handleTimeChange}
                  directions={directions}
                  directionId={directionId}
                  handleDirectionChange={handleDirectionChange}
                  directionRef={directionRef}
                  realtimeAvailable={realtimeAvailable}
                  isRealtimeEnabled={isRealtimeEnabled}
                  setIsRealtimeEnabled={setIsRealtimeEnabled}
                  realtimeLoading={realtimeLoading}
                  lineInfo={lineInfo}
                  currentTripIndex={currentTripIndex}
                  trips={trips}
                  handlePreviousTrip={handlePreviousTrip}
                  handleNextTrip={handleNextTrip}
                  toggleMapView={toggleMapView}
                  showMap={showMap}
                  isMapUpdating={isMapUpdating}
                  vehiclePositions={vehiclePositions}
                  currentVehicleBrand={currentVehicleBrand}
                  currentVehicleModel={currentVehicleModel}
                  currentVehicleId={currentVehicleId}
                  currentVehicleLoading={currentVehicleLoading}
                />
              ) : loading && (
                // Placeholder pour les contrôles UNIQUEMENT si lineInfo n'est pas encore là ET qu'on charge
                <div className="animate-pulse space-y-4">
                  <div className="h-10 bg-gray-200 dark:bg-dark-700 rounded-md w-full"></div>
                  <div className="flex space-x-2">
                    <div className="h-8 bg-gray-200 dark:bg-dark-700 rounded-md w-1/3"></div>
                    <div className="h-8 bg-gray-200 dark:bg-dark-700 rounded-md w-1/3"></div>
                    <div className="h-8 bg-gray-200 dark:bg-dark-700 rounded-md w-1/3"></div>
                  </div>
                  <div className="flex justify-center">
                    <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded-md w-40"></div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              {showMap ? (
                <div className="fixed inset-0 z-50 bg-white dark:bg-dark-900 transition-colors duration-200">
                  <div className="relative h-full">
                    <div className="absolute top-0 left-0 right-0 z-10 bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700 transition-colors duration-200">
                      <div className="max-w-7xl mx-auto px-4 py-2">
                        <div className="flex items-start">
                          <div className="flex-1 min-w-0">
                            {selectedVehicleShape && selectedVehicleStopTimes.length > 0 ? (
                              // --- Affichage pour le véhicule sélectionné ---
                              <>
                                {selectedVehicleStopTimes[0]?.stop_name ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `#${lineInfo?.route_color || '000000'}15` }}>
                                        <svg className="w-3.5 h-3.5" style={{ color: `#${lineInfo?.route_color || '000000'}` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                      </div>
                                      <div className="ml-2 min-w-0">
                                        <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                          {selectedVehicleStopTimes[0].stop_name} {/* Premier arrêt du véhicule */}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {(() => {
                                            const firstStop = selectedVehicleStopTimes[0];
                                            if (!firstStop || !firstStop.departure_time) return 'Départ --:--';
                                            
                                            const formattedTime = formatTimeWithDelay(
                                              firstStop.departure_time,
                                              selectedVehicleTripId, // Utiliser l'ID du trajet du véhicule
                                              firstStop.stop_id,
                                              true, // isFirstStop
                                              false, // isLastStop
                                              firstStop.stop_sequence || 0
                                            );
                                            
                                            let timeClass = '';
                                            const now = new Date();
                                            const isToday = selectedDate.toDateString() === now.toDateString();
                                            let isPast = false;
                                            
                                            if (formattedTime.isRealtime) {
                                              if (formattedTime.status === 'late') timeClass = 'text-red-600 dark:text-red-400';
                                              else if (formattedTime.status === 'early') timeClass = 'text-orange-600 dark:text-orange-400';
                                              else if (formattedTime.status === 'on-time') timeClass = 'text-green-600 dark:text-green-400';
                                            }
                                            
                                            if (isToday) {
                                              const timeToCheck = formattedTime.adjusted || formattedTime.original;
                                              if (timeToCheck && timeToCheck !== '--:--') {
                                                const [hours, minutes] = timeToCheck.split(':').map(Number);
                                                if (!isNaN(hours) && !isNaN(minutes)) {
                                                  const stopTimeTotalMinutes = hours * 60 + minutes;
                                                  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
                                                  isPast = nowTotalMinutes > stopTimeTotalMinutes;
                                                }
                                              }
                                            }
                                            
                                            if (isPast) {
                                              timeClass = 'text-gray-500';
                                            }
                                            
                                            return (
                                              <>
                                                Départ{' '}
                                                {formattedTime.isRealtime && formattedTime.original !== formattedTime.adjusted ? (
                                                  <>
                                                    <span className="line-through text-gray-400">{formattedTime.original}</span>
                                                    <span className={`ml-1 font-medium ${timeClass}`}>{formattedTime.adjusted}</span>
                                                  </>
                                                ) : (
                                                  <span className={timeClass}>{formattedTime.adjusted || formattedTime.original}</span>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `#${lineInfo?.route_color || '000000'}15` }}>
                                        <svg className="w-3.5 h-3.5" style={{ color: `#${lineInfo?.route_color || '000000'}` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                      </div>
                                      <div className="ml-2 min-w-0">
                                        <div className="text-xs font-semibold text-gray-900 truncate">
                                          {selectedVehicleStopTimes[selectedVehicleStopTimes.length - 1].stop_name} {/* Dernier arrêt du véhicule */}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {(() => {
                                            const lastStopIndex = selectedVehicleStopTimes.length - 1;
                                            const lastStop = selectedVehicleStopTimes[lastStopIndex];
                                            
                                            if (!lastStop || !lastStop.arrival_time) return 'Arrivée --:--';
                                            
                                            const formattedTime = formatTimeWithDelay(
                                              lastStop.arrival_time,
                                              selectedVehicleTripId, // Utiliser l'ID du trajet du véhicule
                                              lastStop.stop_id,
                                              false, // isFirstStop
                                              true,  // isLastStop
                                              lastStop.stop_sequence || lastStopIndex
                                            );
                                            
                                            let timeClass = '';
                                            const now = new Date();
                                            const isToday = selectedDate.toDateString() === now.toDateString();
                                            let isPast = false;
                                            
                                            if (formattedTime.isRealtime) {
                                              if (formattedTime.status === 'late') timeClass = 'text-red-600 dark:text-red-400';
                                              else if (formattedTime.status === 'early') timeClass = 'text-orange-600 dark:text-orange-400';
                                              else if (formattedTime.status === 'on-time') timeClass = 'text-green-600 dark:text-green-400';
                                            }
                                            
                                            if (isToday) {
                                              const timeToCheck = formattedTime.adjusted || formattedTime.original;
                                              if (timeToCheck && timeToCheck !== '--:--') {
                                                const [hours, minutes] = timeToCheck.split(':').map(Number);
                                                if (!isNaN(hours) && !isNaN(minutes)) {
                                                  const stopTimeTotalMinutes = hours * 60 + minutes;
                                                  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
                                                  isPast = nowTotalMinutes > stopTimeTotalMinutes;
                                                }
                                              }
                                            }
                                            
                                            if (isPast) {
                                              timeClass = 'text-gray-500';
                                            }
                                            
                                            return (
                                              <>
                                                Arrivée{' '}
                                                {formattedTime.isRealtime && formattedTime.original !== formattedTime.adjusted ? (
                                                  <>
                                                    <span className="line-through text-gray-400">{formattedTime.original}</span>
                                                    <span className={`ml-1 font-medium ${timeClass}`}>{formattedTime.adjusted}</span>
                                                  </>
                                                ) : (
                                                  <span className={timeClass}>{formattedTime.adjusted || formattedTime.original}</span>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs">Détails de l'itinéraire du véhicule incomplets</span>
                                )}
                              </>
                            ) : (
                              // --- Affichage pour le trajet principal (existant) ---
                              <>
                                {trips[currentTripIndex] && trips[currentTripIndex].stop_times[0]?.stop_name ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center">
                                      {/* ... Icône départ ... */}
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `#${lineInfo?.route_color || '000000'}15` }}>
                                        <svg className="w-3.5 h-3.5" style={{ color: `#${lineInfo?.route_color || '000000'}` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                      </div>
                                      {/* ... Texte départ (comme avant) ... */}
                                      <div className="ml-2 min-w-0">
                                        <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                          {trips[currentTripIndex].stop_times[0]?.stop_name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {(() => {
                                            const firstStop = trips[currentTripIndex]?.stop_times?.[0];
                                            if (!firstStop || !firstStop.departure_time) return 'Départ --:--';

                                            const formattedTime = formatTimeWithDelay(
                                              firstStop.departure_time,
                                              trips[currentTripIndex]?.trip_id,
                                              firstStop.stop_id,
                                              true, // isFirstStop
                                              false, // isLastStop
                                              firstStop.stop_sequence || 0
                                            );

                                            let timeClass = '';
                                            const now = new Date();
                                            const isToday = selectedDate.toDateString() === now.toDateString();
                                            let isPast = false;

                                            if (formattedTime.isRealtime) {
                                              if (formattedTime.status === 'late') timeClass = 'text-red-600 dark:text-red-400';
                                              else if (formattedTime.status === 'early') timeClass = 'text-orange-600 dark:text-orange-400';
                                              else if (formattedTime.status === 'on-time') timeClass = 'text-green-600 dark:text-green-400';
                                            }

                                            // Check if the time is in the past
                                            if (isToday) {
                                              const timeToCheck = formattedTime.adjusted || formattedTime.original;
                                              if (timeToCheck && timeToCheck !== '--:--') {
                                                const [hours, minutes] = timeToCheck.split(':').map(Number);
                                                if (!isNaN(hours) && !isNaN(minutes)) {
                                                  const stopTimeTotalMinutes = hours * 60 + minutes;
                                                  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
                                                  isPast = nowTotalMinutes > stopTimeTotalMinutes;
                                                }
                                              }
                                            }

                                            // Override color to gray if it's in the past
                                            if (isPast) {
                                              timeClass = 'text-gray-500';
                                            }

                                            return (
                                              <>
                                                Départ{' '}
                                                {formattedTime.isRealtime && formattedTime.original !== formattedTime.adjusted ? (
                                                  <>
                                                    <span className="line-through text-gray-400">{formattedTime.original}</span>
                                                    <span className={`ml-1 font-medium ${timeClass}`}>{formattedTime.adjusted}</span>
                                                  </>
                                                ) : (
                                                  <span className={timeClass}>{formattedTime.adjusted || formattedTime.original}</span>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center">
                                      {/* ... Icône arrivée ... */}
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `#${lineInfo?.route_color || '000000'}15` }}>
                                        <svg className="w-3.5 h-3.5" style={{ color: `#${lineInfo?.route_color || '000000'}` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                      </div>
                                      {/* ... Texte arrivée (comme avant) ... */}
                                      <div className="ml-2 min-w-0">
                                        <div className="text-xs font-semibold text-gray-900 truncate">
                                          {trips[currentTripIndex].stop_times[trips[currentTripIndex].stop_times.length - 1]?.stop_name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {(() => {
                                            const stopTimes = trips[currentTripIndex]?.stop_times;
                                            if (!stopTimes || stopTimes.length === 0) return 'Arrivée --:--';
                                            
                                            const lastStopIndex = stopTimes.length - 1;
                                            const lastStop = stopTimes[lastStopIndex];

                                            if (!lastStop || !lastStop.arrival_time) return 'Arrivée --:--';

                                            const formattedTime = formatTimeWithDelay(
                                              lastStop.arrival_time,
                                              trips[currentTripIndex]?.trip_id,
                                              lastStop.stop_id,
                                              false, // isFirstStop
                                              true,  // isLastStop
                                              lastStop.stop_sequence || lastStopIndex
                                            );

                                            let timeClass = '';
                                            const now = new Date();
                                            const isToday = selectedDate.toDateString() === now.toDateString();
                                            let isPast = false;

                                            if (formattedTime.isRealtime) {
                                              if (formattedTime.status === 'late') timeClass = 'text-red-600 dark:text-red-400';
                                              else if (formattedTime.status === 'early') timeClass = 'text-orange-600 dark:text-orange-400';
                                              else if (formattedTime.status === 'on-time') timeClass = 'text-green-600 dark:text-green-400';
                                            }

                                            // Check if the time is in the past
                                            if (isToday) {
                                              const timeToCheck = formattedTime.adjusted || formattedTime.original;
                                              if (timeToCheck && timeToCheck !== '--:--') {
                                                const [hours, minutes] = timeToCheck.split(':').map(Number);
                                                if (!isNaN(hours) && !isNaN(minutes)) {
                                                  const stopTimeTotalMinutes = hours * 60 + minutes;
                                                  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
                                                  isPast = nowTotalMinutes > stopTimeTotalMinutes;
                                                }
                                              }
                                            }

                                            // Override color to gray if it's in the past
                                            if (isPast) {
                                              timeClass = 'text-gray-500';
                                            }

                                            return (
                                              <>
                                                Arrivée{' '}
                                                {formattedTime.isRealtime && formattedTime.original !== formattedTime.adjusted ? (
                                                  <>
                                                    <span className="line-through text-gray-400">{formattedTime.original}</span>
                                                    <span className={`ml-1 font-medium ${timeClass}`}>{formattedTime.adjusted}</span>
                                                  </>
                                                ) : (
                                                  <span className={timeClass}>{formattedTime.adjusted || formattedTime.original}</span>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs">Détails de l'itinéraire incomplets</span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex items-start h-full ml-4">
                            <button
                              onClick={toggleMapView}
                              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                              <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="h-full w-full relative pt-[60px]">
                      {mapLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                      {mapError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-red-50 p-4 rounded-lg">
                            <p className="text-red-700">{mapError}</p>
                          </div>
                        </div>
                      )}
                      <div ref={mapContainer} className="h-full w-full" />
                      
                      {/* Boutons de navigation */}
                      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex items-center gap-8">
                        <button
                          onClick={handlePreviousTrip}
                          disabled={currentTripIndex === 0 || isMapUpdating}
                          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
                            currentTripIndex === 0 || isMapUpdating
                              ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500' 
                              : ''
                          }`}
                          style={currentTripIndex !== 0 && !isMapUpdating ? {
                            backgroundColor: `#${darkenColor(lineInfo?.route_color)}`,
                            color: `#${lineInfo?.route_text_color || 'FFFFFF'}`
                          } : {}}
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <button
                          onClick={handleNextTrip}
                          disabled={currentTripIndex === trips.length - 1 || isMapUpdating}
                          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
                            currentTripIndex === trips.length - 1 || isMapUpdating
                              ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500' 
                              : ''
                          }`}
                          style={currentTripIndex !== trips.length - 1 && !isMapUpdating ? {
                            backgroundColor: `#${darkenColor(lineInfo?.route_color)}`,
                            color: `#${lineInfo?.route_text_color || 'FFFFFF'}`
                          } : {}}
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : loading ? (
                /* Placeholder wavy pour la timeline pendant le chargement général des données */
                <div className="bg-[#F6F6F6] dark:bg-dark-700 rounded-lg p-6">
                  <div className="relative">
                 
                    <div className="relative space-y-4 py-0">
                      {[...Array(8)].map((_, index) => (
                        <div key={index} className="flex items-start group">
                          <div className="w-16 sm:w-20 flex-shrink-0 text-center">
                            <div className="animate-pulse h-5 bg-gray-200 dark:bg-dark-600 rounded w-12 mx-auto"></div>
                          </div>
                          
                          <div className="z-10 flex items-center justify-center">
                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-dark-600 animate-pulse"></div>
                          </div>
                          
                          <div className="ml-3 flex-1">
                            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm px-4 py-3 mb-2">
                              <div className="animate-pulse flex space-x-4">
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-gray-200 dark:bg-dark-600 rounded w-3/4"></div>
                                  <div className="h-3 bg-gray-200 dark:bg-dark-600 rounded w-1/2"></div>
                                </div>
                              </div>
                            </div>
                            
                            {index < 7 && (
                              <div className="h-2"></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : trips.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-block bg-white dark:bg-dark-800 border-2 border-red-200 dark:border-red-700/50 rounded-xl p-8 shadow-xl transform transition-all hover:scale-105 duration-300 ease-out">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30">
                      <svg 
                        className="h-10 w-10 text-red-600 dark:text-red-400" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        strokeWidth="1.5" 
                        stroke="currentColor" 
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-red-700 dark:text-red-300">Aucun horaire disponible</h3>
                    <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
                      Désolé, aucun passage n'est prévu pour cette ligne le <br />
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{formatDate(selectedDate)}</span>.
                    </p>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
                      Veuillez sélectionner une autre date ou vérifier à nouveau plus tard.
                    </p>
                  </div>
                </div>
              ) : showAllSchedules ? (
                <div className="bg-[#F6F6F6] rounded-lg p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Heure
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Détails
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {trips.map((trip, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {trip.first_departure}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {trip.stop_times.map(stop => (
                                <div key={stop.stop_id}>{stop.stop_name} ({stop.stop_sequence})</div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                // Condition pour afficher la carte ou la timeline (existante)
                showMap ? (
                  <div className="fixed inset-0 z-50 bg-white dark:bg-dark-900 transition-colors duration-200">
                    {/* ... Code de la carte ... */}
                  </div>
                ) : (
                  <StopsTimeline
                    stopTimes={stopTimes}
                    currentTime={currentTime}
                    selectedDate={selectedDate}
                    lineInfo={lineInfo}
                    formatTimeWithDelay={formatTimeWithDelay}
                    currentTrip={trips[currentTripIndex]}
                    stopConnections={stopConnections}
                    trafficInfos={trafficInfos}
                  />
                )
              )}
            </div>
            
            {realtimeError && isRealtimeEnabled && (
              <div className="mt-2 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-md">
                {realtimeError}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Boutons flottants */}
      {showFloatingButtons && !showMap && trips.length > 0 && (
        <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 flex items-center gap-32 z-50">
          <button
            onClick={handlePreviousTrip}
            disabled={currentTripIndex === 0 || isMapUpdating}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
              currentTripIndex === 0 || isMapUpdating
                ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500' 
                : ''
            }`}
            style={currentTripIndex !== 0 && !isMapUpdating ? {
              backgroundColor: `#${darkenColor(lineInfo?.route_color)}`,
              color: `#${lineInfo?.route_text_color || 'FFFFFF'}`
            } : {}}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={handleNextTrip}
            disabled={currentTripIndex === trips.length - 1 || isMapUpdating}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
              currentTripIndex === trips.length - 1 || isMapUpdating
                ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500' 
                : ''
            }`}
            style={currentTripIndex !== trips.length - 1 && !isMapUpdating ? {
              backgroundColor: `#${darkenColor(lineInfo?.route_color)}`,
              color: `#${lineInfo?.route_text_color || 'FFFFFF'}`
            } : {}}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <VehicleTimeline
        showVehicleTimeline={showVehicleTimeline}
        setShowVehicleTimeline={setShowVehicleTimeline}
        selectedVehicleInfo={selectedVehicleInfo}
        selectedVehicleBrand={selectedVehicleBrand}
        selectedVehicleModel={selectedVehicleModel}
        vehicleDetailsLoading={vehicleDetailsLoading}
        vehicleTimelineLoading={vehicleTimelineLoading}
        vehicleTimelineError={vehicleTimelineError}
        selectedVehicleStopTimes={selectedVehicleStopTimes}
        selectedVehicleTripId={selectedVehicleTripId}
        formatTimeWithDelay={formatTimeWithDelay}
        lineInfo={lineInfo}
      />
    </div>
  );
};

export default Timetable;




