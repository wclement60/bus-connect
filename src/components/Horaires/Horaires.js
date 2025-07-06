import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import DateTimePicker from './DateTimePicker';
import TripNavigation from './TripNavigation';
import Timetable from './Timetable';
import NoSchedule from './NoSchedule';
import LoadingSkeleton from './LoadingSkeleton';
import DirectionSelector from './DirectionSelector';
import MapView from '../../pages/Horaires/map';

import './Horaires.css';
import { fetchRealtimeData, fetchVehiclePositionData } from '../../services/realtime';


// Ajouter le style @keyframes au début du fichier
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// Fonction pour assombrir une couleur hexadécimale
const darkenColor = (hex) => {
  if (!hex) return '3b82f6';
  
  // Enlever le # si présent
  hex = hex.replace('#', '');
  
  // Vérifier si c'est une couleur hexadécimale valide
  if (!/^[0-9A-Fa-f]{6}$/i.test(hex)) {
    return '3b82f6';
  }
  
  // Convertir en RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Assombrir
  r = Math.max(0, Math.floor(r * 0.8));
  g = Math.max(0, Math.floor(g * 0.8));
  b = Math.max(0, Math.floor(b * 0.8));
  
  // Reconvertir en hexadécimal
  return r.toString(16).padStart(2, '0') + 
         g.toString(16).padStart(2, '0') + 
         b.toString(16).padStart(2, '0');
};

// Fonction pour convertir les heures au-delà de 24h en format standard (0h-23h)
const formatStandardTime = (timeStr, forDisplay = true) => {
  if (!timeStr || timeStr === '??:??') return timeStr;
  
  // Si le format inclut les secondes (HH:MM:SS), on ne garde que HH:MM
  const time = timeStr.substring(0, 5);
  
  // Si ce n'est pas pour l'affichage ou si l'heure est inférieure à 24, retourner sans modifier
  if (!forDisplay || parseInt(time.split(':')[0]) < 24) {
    return time;
  }
  
  // Extraire les heures et minutes
  const [hours, minutes] = time.split(':').map(Number);
  
  // Convertir les heures supérieures à 23
  const standardHours = hours % 24;
  
  // Formater avec un zéro devant si nécessaire
  return `${standardHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Fonction pour déterminer si le texte doit être blanc ou noir selon la couleur de fond
const getTextColor = (bgHex) => {
  if (!bgHex) return 'FFFFFF';
  
  // Enlever le # si présent
  bgHex = bgHex.replace('#', '');
  
  // Vérifier si c'est une couleur hexadécimale valide
  if (!/^[0-9A-Fa-f]{6}$/i.test(bgHex)) {
    return 'FFFFFF';
  }
  
  // Convertir en RGB
  const r = parseInt(bgHex.substring(0, 2), 16);
  const g = parseInt(bgHex.substring(2, 4), 16);
  const b = parseInt(bgHex.substring(4, 6), 16);
  
  // Calculer la luminosité
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Retourner blanc ou noir selon la luminosité
  return luminance > 0.5 ? '000000' : 'FFFFFF';
};

const Horaires = ({ networkId, lineId, directionId: initialDirectionId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [stopTimes, setStopTimes] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [debugInfo, setDebugInfo] = useState(null);
  const [trips, setTrips] = useState([]);
  const [currentTripIndex, setCurrentTripIndex] = useState(0);
  const [isChangingTrip, setIsChangingTrip] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(null);
  const [showNoSchedule, setShowNoSchedule] = useState(false);
  const noScheduleTimer = useRef(null);
  const [lineInfo, setLineInfo] = useState({
    route_color: '3b82f6',
    route_text_color: 'FFFFFF',
    route_long_name: '',
    route_short_name: ''
  });
  const [progressUpdate, setProgressUpdate] = useState(0);
  const [availableDirections, setAvailableDirections] = useState([]);
  const [directionId, setDirectionId] = useState(initialDirectionId);
  const [stopConnections, setStopConnections] = useState({});
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [realtimeData, setRealtimeData] = useState({ delays: {}, updatedTimes: {}, skippedStops: {} });
  const [isRealtime, setIsRealtime] = useState(false);
  const [rawStopTimes, setRawStopTimes] = useState([]);
  const [networkName, setNetworkName] = useState('');
  const [directionHeadsign, setDirectionHeadsign] = useState('');
  
  // État pour gérer l'affichage de la carte
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapParams, setMapParams] = useState({
    networkId: null,
    routeId: null,
    directionId: null,
    tripId: null
  });
  
  // État pour stocker les positions des véhicules
  const [vehiclePositions, setVehiclePositions] = useState({});
  const [currentVehicle, setCurrentVehicle] = useState(null);
  
  // État pour les annulations et retards manuels
  const [cancelledTripsMap, setCancelledTripsMap] = useState(new Map());
  const [delayedTripsMap, setDelayedTripsMap] = useState(new Map());
  
  useEffect(() => {
    if (currentTripId && vehiclePositions && Object.values(vehiclePositions).length > 0) {
      console.log('Recherche du véhicule pour le trajet:', currentTripId);
      console.log('Véhicules disponibles:', Object.values(vehiclePositions).map(v => ({ 
        tripId: v.tripId, 
        vehicleId: v.vehicleId 
      })));
      
      // Chercher une correspondance exacte
      let matchingVehicle = Object.values(vehiclePositions).find(
        vehicle => vehicle.tripId && vehicle.tripId === currentTripId
      );
      
      // Si pas de correspondance exacte, chercher avec moins de sensibilité à la casse
      if (!matchingVehicle) {
        matchingVehicle = Object.values(vehiclePositions).find(
          vehicle => vehicle.tripId && vehicle.tripId.toLowerCase() === currentTripId.toLowerCase()
        );
      }
      
      // Si toujours pas de correspondance, chercher si le tripId est contenu dans le véhicule ou vice versa
      if (!matchingVehicle) {
        matchingVehicle = Object.values(vehiclePositions).find(
          vehicle => vehicle.tripId && (
            vehicle.tripId.includes(currentTripId) || 
            currentTripId.includes(vehicle.tripId)
          )
        );
      }
      
      if (matchingVehicle) {
        console.log('Véhicule trouvé:', matchingVehicle);
        
        // D'abord, créer un objet de base avec les infos disponibles
        const vehicleData = {
          ...matchingVehicle,
          label: matchingVehicle.vehicleId || `Bus ${matchingVehicle.tripId}` || 'Bus'
        };
        
        setCurrentVehicle(vehicleData);
        
        // Ensuite, récupérer les détails complets du véhicule en arrière-plan
        const fetchVehicleDetails = async () => {
          if (!matchingVehicle.vehicleId || !networkId) return;
          
          try {
            const { data: vehicleDetails, error: vehicleDetailsError } = await supabase
              .from('vehicle_details')
              .select('brand, model')
              .eq('network_id', networkId)
              .eq('vehicle_id', matchingVehicle.vehicleId)
              .single();
            
            if (vehicleDetailsError) {
              if (vehicleDetailsError.code !== 'PGRST116') { // Code pour "No rows returned"
                console.error("Erreur lors de la récupération des détails du véhicule:", vehicleDetailsError);
              }
              return;
            }
            
            if (vehicleDetails) {
              // Créer un label avec la marque et le modèle (comme dans l'image)
              const label = vehicleDetails.brand 
                ? `${vehicleDetails.brand}${vehicleDetails.model ? ' ' + vehicleDetails.model : ''}`
                : vehicleData.label; // Fallback sur le label précédent
              
              setCurrentVehicle({
                ...vehicleData,
                ...vehicleDetails,
                label: label
              });
            }
          } catch (err) {
            console.error("Erreur lors de la récupération des détails du véhicule:", err);
          }
        };
        
        fetchVehicleDetails();
      } else {
        console.log('Aucun véhicule trouvé pour le trajet:', currentTripId);
        setCurrentVehicle(null);
      }
    } else {
      setCurrentVehicle(null);
    }
  }, [currentTripId, vehiclePositions, networkId]);
  
  // Mémoriser l'objet `selectedStop` pour éviter de le recréer à chaque rendu
  const selectedStopForMap = useMemo(() => {
    // On ne prend que le premier arrêt de la liste comme référence
    if (stopTimes && stopTimes.length > 0) {
      const firstStop = stopTimes[0];
      return {
        stop_name: firstStop.stop_name,
        stop_lat: firstStop.stop_lat,
        stop_lon: firstStop.stop_lon
      };
    }
    return null;
  }, [stopTimes]); // Ne recalculer que si `stopTimes` change
  
  // Fonction pour ouvrir la carte
  const handleOpenMap = useCallback((params = {}) => {
    setMapParams({
      networkId: params.networkId || networkId,
      routeId: params.routeId || lineId,
      directionId: params.directionId || directionId,
      tripId: params.tripId || null
    });
    setIsMapOpen(true);
  }, [networkId, lineId, directionId]);
  
  // Fonction pour fermer la carte
  const handleCloseMap = useCallback(() => {
    setIsMapOpen(false);
  }, []);

  useEffect(() => {
    const getRealtimeData = async () => {
        if (!networkId || !lineId) return;

        // Check if the selected date is today
        const today = new Date();
        const isToday = currentDate.getDate() === today.getDate() && 
                        currentDate.getMonth() === today.getMonth() && 
                        currentDate.getFullYear() === today.getFullYear();
        
        // Only fetch realtime data if the date is today
        if (!isToday) {
            setIsRealtime(false);
            setRealtimeData({ delays: {}, updatedTimes: {}, skippedStops: {} });
            return;
        }

        // First, check if realtime is available for this network
        const { data: networkData } = await supabase
            .from('networks')
            .select('has_siri_api, has_gtfs_rt_api')
            .eq('network_id', networkId)
            .single();

        const realtimeAvailable = networkData && (networkData.has_siri_api || networkData.has_gtfs_rt_api);
        setIsRealtime(realtimeAvailable);

        if (realtimeAvailable) {
            try {
                const data = await fetchRealtimeData(networkId, lineId);
                if (data) {
                    setRealtimeData(data);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération des données temps réel:", error);
            }
        }
    };

    getRealtimeData();
    const interval = setInterval(getRealtimeData, 30000); // Mettre à jour toutes les 30 secondes

    return () => clearInterval(interval);
}, [networkId, lineId, currentDate]);

  // Fonction pour récupérer les correspondances
  const fetchConnections = useCallback(async (stopIds) => {
    try {
      const { data, error } = await supabase.rpc('horaires_get_connections', {
        p_network_id: networkId,
        p_route_id: lineId,
        p_stop_ids: stopIds
      });

      if (error) {
        console.error('Erreur lors de la récupération des correspondances:', error);
        return {};
      }

      return data || {};
    } catch (err) {
      console.error('Erreur lors de la récupération des correspondances:', err);
      return {};
    }
  }, [networkId, lineId]);

  // Effet pour charger les directions disponibles
  useEffect(() => {
    const fetchDirections = async () => {
      if (!networkId || !lineId) return;

      try {
        const { data, error } = await supabase
          .from('trips')
          .select('direction_id, trip_headsign')
          .eq('network_id', networkId)
          .eq('route_id', lineId)
          .order('direction_id');

        if (error) throw error;

        // Utiliser un Map pour stocker les directions uniques avec leur nom complet
        const directionsMap = new Map();
        data.forEach(trip => {
          if (!directionsMap.has(trip.direction_id)) {
            directionsMap.set(trip.direction_id, {
            id: trip.direction_id,
            name: trip.trip_headsign
            });
          }
        });

        // Convertir le Map en tableau
        const directions = Array.from(directionsMap.values());
        setAvailableDirections(directions);
        
        // Mettre à jour le directionHeadsign pour la direction actuelle
        const currentDirection = directions.find(dir => dir.id === directionId);
        if (currentDirection && currentDirection.name) {
          setDirectionHeadsign(currentDirection.name);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des directions:', err);
        setError('Impossible de charger les directions disponibles');
      }
    };

    fetchDirections();
  }, [networkId, lineId, directionId]);

  // Effet pour mettre à jour directionId quand initialDirectionId change
  useEffect(() => {
    if (initialDirectionId !== undefined) {
      setDirectionId(initialDirectionId);
    }
  }, [initialDirectionId]);
  
  // Effet pour mettre à jour directionHeadsign quand directionId change
  useEffect(() => {
    // Si les directions sont disponibles, mettre à jour immédiatement le headsign
    if (availableDirections && availableDirections.length > 0) {
      const currentDirection = availableDirections.find(dir => dir.id === directionId);
      if (currentDirection && currentDirection.name) {
        setDirectionHeadsign(currentDirection.name);
      } else {
        // Réinitialiser si la direction n'est pas trouvée
        setDirectionHeadsign('');
      }
    }
  }, [directionId, availableDirections]);

  // Mise à jour périodique de la barre de progression
  useEffect(() => {
    const timer = setInterval(() => {
      setProgressUpdate(prevUpdate => prevUpdate + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Fonction pour gérer le changement de date
  const handleDateChange = (date) => {
    console.log('Nouvelle date sélectionnée:', date);
    setCurrentDate(new Date(date));
  };

  // Fonction pour gérer le changement d'heure
  const handleTimeChange = (time) => {
    console.log('Nouvelle heure sélectionnée:', time);
    setSelectedTime(time);
  };

  // Fonction simple pour charger le trip précédent (navigation séquentielle)
  const handlePreviousTrip = () => {
    if (currentTripIndex > 0) {
      setIsChangingTrip(true);
      const newIndex = currentTripIndex - 1;
      console.log(`Navigation vers le trip précédent: index ${newIndex}/${trips.length - 1}`);
      console.log('Trip ID:', trips[newIndex].trip_id);
      setCurrentTripIndex(newIndex);
      fetchTripDetails(trips[newIndex].trip_id);
      setTimeout(() => {
        setIsChangingTrip(false);
      }, 300);
    }
  };

  // Fonction simple pour charger le trip suivant (navigation séquentielle)
  const handleNextTrip = () => {
    if (currentTripIndex < trips.length - 1) {
      setIsChangingTrip(true);
      const newIndex = currentTripIndex + 1;
      console.log(`Navigation vers le trip suivant: index ${newIndex}/${trips.length - 1}`);
      console.log('Trip ID:', trips[newIndex].trip_id);
      setCurrentTripIndex(newIndex);
      fetchTripDetails(trips[newIndex].trip_id);
      setTimeout(() => {
        setIsChangingTrip(false);
      }, 300);
    }
  };

  // Fonction pour charger les détails d'un trip spécifique
  const fetchTripDetails = async (tripId) => {
    try {
      console.log(`Chargement des détails pour le trip: ${tripId} (réseau: ${networkId}, ligne: ${lineId}, direction: ${directionId})`);
      
      // Ajouter un debug pour voir quel trip est sélectionné dans le tableau des trips
      const selectedTrip = trips.find(trip => trip.trip_id === tripId);
      console.log('Détails du trip sélectionné:', {
        id: tripId,
        first_departure_time: selectedTrip?.first_departure_time,
        real_first_time: selectedTrip?.real_first_time,
        index: trips.findIndex(trip => trip.trip_id === tripId)
      });
      
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('trip_id, route_id, direction_id, trip_headsign')
        .eq('trip_id', tripId)
        .eq('network_id', networkId)
        .eq('route_id', lineId)
        .eq('direction_id', directionId);
        
      if (tripError) {
        console.error('Erreur lors de la vérification du trip:', tripError);
        throw tripError;
      }
      
      if (!tripData || tripData.length === 0) {
        console.error(`Trip non trouvé ou ne correspond pas aux critères: trip=${tripId}, network=${networkId}, line=${lineId}, direction=${directionId}`);
        setError('Erreur: Trajet non trouvé pour cette ligne et direction');
        return;
      }
      
      console.log('Trip vérifié:', tripData[0]);
      
      // Mettre à jour le headsign de la direction
      if (tripData[0].trip_headsign) {
        setDirectionHeadsign(tripData[0].trip_headsign);
      }
      
      const { data, error } = await supabase
        .from('stop_times')
        .select(`
          stop_id,
          arrival_time,
          departure_time,
          stop_sequence,
          stops!inner (
            stop_id,
            stop_name,
            network_id,
            city
          )
        `)
        .eq('trip_id', tripId)
        .eq('stops.network_id', networkId)
        .order('stop_sequence');
      
      if (error) {
        console.error('Erreur lors de la récupération des stop_times:', error);
        throw error;
      }
      
      console.log(`Nombre d'arrêts trouvés (filtrés par réseau): ${data?.length || 0}`);
      
      // Afficher les heures de départ réelles pour diagnostiquer
      if (data && data.length > 0) {
        console.log('Premier arrêt - heure de départ:', data[0].departure_time);
        console.log('Dernier arrêt - heure d\'arrivée:', data[data.length - 1].arrival_time);
      }
      
      if (data && data.length > 0) {
        setRawStopTimes(data);
        setCurrentTripId(tripId);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des détails du trip:', err);
      setError(err.message);
      setRawStopTimes([]);
    }
  };

  useEffect(() => {
    if (rawStopTimes.length === 0) {
      setStopTimes([]);
      return;
    }

    // Debug pour voir le format des données reçues
    console.log('Données brutes des arrêts pour le trip courant:', {
      first_stop_time: rawStopTimes[0]?.departure_time,
      last_stop_time: rawStopTimes[rawStopTimes.length - 1]?.arrival_time,
      stop_count: rawStopTimes.length,
      current_trip_id: currentTripId,
      raw_data: rawStopTimes.slice(0, 2) // Juste les 2 premiers pour ne pas surcharger
    });
    
    // Trouver les informations du trip correspondant
    const currentTrip = trips.find(trip => trip.trip_id === currentTripId);
    console.log('Trip actuel dans le tableau trips:', currentTrip);
    
    // Stocker l'heure réelle du premier arrêt pour ce trip dans une variable globale
    // pour que TripNavigation puisse y accéder
    if (!window.tripFirstStops) {
      window.tripFirstStops = {};
    }
    
    if (rawStopTimes && rawStopTimes.length > 0 && rawStopTimes[0].departure_time) {
      // Pour l'affichage, on utilise le format standard
      const displayFirstStopTime = formatStandardTime(rawStopTimes[0].departure_time.substring(0, 5), true);
      // Pour la logique, on garde le format original pour préserver l'ordre
      const logicalFirstStopTime = formatStandardTime(rawStopTimes[0].departure_time.substring(0, 5), false);
      window.tripFirstStops[currentTripId] = logicalFirstStopTime;
      console.log(`Heure réelle de départ pour le trip ${currentTripId}: ${displayFirstStopTime}`);
      
      // Mettre à jour le trip dans le tableau des trips
      const tripIndex = trips.findIndex(trip => trip.trip_id === currentTripId);
      if (tripIndex !== -1) {
        const updatedTrips = [...trips];
        updatedTrips[tripIndex] = {
          ...updatedTrips[tripIndex],
          real_first_time: rawStopTimes[0].departure_time // Mise à jour avec l'heure réelle
        };
        // Pas besoin de setTrips car cela causerait une boucle de rendu
      }
    }

    const formattedStops = rawStopTimes.map((stop, index) => {
      const stopId = stop.stop_id;
      const stopSequence = stop.stop_sequence;
      const isLastStop = index === rawStopTimes.length - 1;

      const basicKey = `${currentTripId}-${stopId}`;
      const sequenceKey = `${currentTripId}-${stopId}-${stopSequence}`;
      
      const isManuallyCancelled = currentTrip?.isManuallyCancelled;
      const isManuallyDelayed = currentTrip?.isManuallyDelayed;
      const manualDelay = currentTrip?.delayInfo?.delay;
      const isSkipped = isManuallyCancelled || (realtimeData.skippedStops || {})[basicKey] || (realtimeData.skippedStops || {})[sequenceKey];
      
      // Priorité aux retards manuels sur les retards en temps réel
      const delay = isManuallyDelayed ? manualDelay : 
                   (isManuallyCancelled ? null : 
                   ((realtimeData.delays || {})[sequenceKey] || (realtimeData.delays || {})[basicKey]));
      
      const updatedTime = isManuallyCancelled ? null : (realtimeData.updatedTimes || {})[sequenceKey] || (realtimeData.updatedTimes || {})[basicKey];

      // Use arrival_time for the last stop, otherwise departure_time
      const scheduledTime = isLastStop ? stop.arrival_time : stop.departure_time;
      let formattedScheduledTime = scheduledTime ? formatStandardTime(scheduledTime.substring(0, 5), true) : '??:??';

      let newDepartureTime;
      const realtimeInfo = isLastStop ? updatedTime?.arrival : updatedTime?.departure;

      if (realtimeInfo?.time) {
          const date = new Date(realtimeInfo.time);
          if (!isNaN(date)) {
              newDepartureTime = formatStandardTime(date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), true);
          }
      } else if (delay != null && scheduledTime) {
          const [hours, minutes] = scheduledTime.split(':');
          const originalDate = new Date();
          originalDate.setHours(Number(hours), Number(minutes), 0, 0);
          originalDate.setMinutes(originalDate.getMinutes() + delay);
          newDepartureTime = formatStandardTime(originalDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), true);
      }

      return {
        stop_id: stop.stop_id,
        stop_name: stop.stops.stop_name,
        city: stop.stops.city,
        departure_time: formattedScheduledTime,
        realtime_departure_time: newDepartureTime,
        is_skipped: isSkipped,
        delay: delay,
        stop_sequence: stop.stop_sequence,
        is_manually_delayed: isManuallyDelayed
      };
    });

    console.log('Arrêts formatés:', formattedStops.slice(0, 2));
    setStopTimes(formattedStops);
  }, [rawStopTimes, realtimeData, currentTripId, trips]);

  // Effet pour charger les correspondances lorsque les arrêts changent
  useEffect(() => {
    if (rawStopTimes.length === 0) {
      setStopConnections({});
      setConnectionsLoading(false);
      return;
    }

    const updateConnections = async () => {
      setConnectionsLoading(true);
      const stopIds = rawStopTimes.map(stop => stop.stop_id);
      const connections = await fetchConnections(stopIds);
      setStopConnections(connections);
      setConnectionsLoading(false);
    };

    updateConnections();
  }, [rawStopTimes, fetchConnections]);

  // Effet pour actualiser périodiquement les annulations et retards manuels
  useEffect(() => {
    if (!networkId || !currentDate) return;
    
    const fetchManualUpdates = async () => {
      try {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const isoDate = `${year}-${month}-${day}`;
        
        // Récupérer les trajets annulés manuellement
        const { data: cancelledTripsData, error: cancelledTripsError } = await supabase
          .from('cancelled_trips')
          .select('trip_id, reason')
          .eq('network_id', networkId)
          .eq('cancellation_date', isoDate);

        if (cancelledTripsError) {
          console.error("Erreur lors de la récupération des annulations manuelles:", cancelledTripsError);
        } else {
          const newCancelledTripsMap = new Map();
          if (cancelledTripsData) {
            cancelledTripsData.forEach(c => newCancelledTripsMap.set(c.trip_id, c.reason || 'Annulé'));
          }
          setCancelledTripsMap(newCancelledTripsMap);
        }
        
        // Récupérer les trajets retardés manuellement
        const { data: delayedTripsData, error: delayedTripsError } = await supabase
          .from('delayed_trips')
          .select('trip_id, delay_minutes, reason')
          .eq('network_id', networkId)
          .eq('delay_date', isoDate);

        if (delayedTripsError) {
          console.error("Erreur lors de la récupération des retards manuels:", delayedTripsError);
        } else {
          const newDelayedTripsMap = new Map();
          if (delayedTripsData) {
            delayedTripsData.forEach(d => newDelayedTripsMap.set(d.trip_id, {
              delay: d.delay_minutes,
              reason: d.reason || 'Retard'
            }));
          }
          setDelayedTripsMap(newDelayedTripsMap);
        }
      } catch (err) {
        console.error("Erreur lors de l'actualisation des données manuelles:", err);
      }
    };
    
    // Exécuter immédiatement pour avoir les données initiales
    fetchManualUpdates();
    
    // Puis configurer l'intervalle pour les actualisations périodiques (toutes les 30 secondes)
    const intervalId = setInterval(fetchManualUpdates, 30000);
    
    return () => clearInterval(intervalId);
  }, [networkId, currentDate]);

  // Effet pour mettre à jour les trips avec les informations d'annulation et de retard
  useEffect(() => {
    if (trips.length === 0) return;
    
    const updatedTrips = trips.map(trip => ({
      ...trip,
      isManuallyCancelled: cancelledTripsMap.has(trip.trip_id),
      cancellationReason: cancelledTripsMap.get(trip.trip_id) || null,
      isManuallyDelayed: delayedTripsMap.has(trip.trip_id),
      delayInfo: delayedTripsMap.get(trip.trip_id) || null,
    }));
    
    // Vérifier si quelque chose a changé
    const hasChanges = updatedTrips.some((trip, index) => {
      const oldTrip = trips[index];
      return trip.isManuallyCancelled !== oldTrip.isManuallyCancelled ||
             trip.cancellationReason !== oldTrip.cancellationReason ||
             trip.isManuallyDelayed !== oldTrip.isManuallyDelayed ||
             (trip.delayInfo?.delay !== oldTrip.delayInfo?.delay) ||
             (trip.delayInfo?.reason !== oldTrip.delayInfo?.reason);
    });
    
    if (hasChanges) {
      console.log("Mise à jour des trips avec les nouvelles informations d'annulation/retard");
      setTrips(updatedTrips);
      
      // Si le trip actuel a changé, recharger les détails
      const currentTrip = updatedTrips[currentTripIndex];
      if (currentTrip && currentTripId === currentTrip.trip_id) {
        const oldTrip = trips[currentTripIndex];
        if (currentTrip.isManuallyCancelled !== oldTrip.isManuallyCancelled ||
            currentTrip.isManuallyDelayed !== oldTrip.isManuallyDelayed ||
            (currentTrip.delayInfo?.delay !== oldTrip.delayInfo?.delay)) {
          console.log("Le statut du trip actuel a changé, rechargement des détails");
          fetchTripDetails(currentTripId);
        }
      }
    }
  }, [cancelledTripsMap, delayedTripsMap, trips, currentTripIndex, currentTripId]);

  useEffect(() => {
    const fetchHoraires = async () => {
      try {
        setLoading(true);
        setError(null);
        setErrorDetails(null);
        setDebugInfo(null);
        setTrips([]);
        
        console.log('Paramètres initiaux:', { networkId, lineId, directionId });
        
        if (!networkId || !lineId || directionId === undefined) {
          setError(`Paramètres manquants: réseau=${networkId}, ligne=${lineId}, direction=${directionId}`);
          setLoading(false);
          return;
        }
        
        const { data: routeData, error: routeError } = await supabase
          .from('routes')
          .select('route_id, route_short_name, route_long_name, route_color, route_text_color')
          .eq('network_id', networkId)
          .eq('route_id', lineId)
          .single();
          
        if (routeError) {
          console.error('Erreur lors de la récupération des informations de la ligne:', routeError);
        } else if (routeData) {
          console.log('Informations de la ligne récupérées:', routeData);
          setLineInfo({
            route_color: routeData.route_color || '3b82f6',
            route_text_color: routeData.route_text_color || 'FFFFFF',
            route_long_name: routeData.route_long_name || routeData.route_short_name || '',
            route_short_name: routeData.route_short_name || ''
          });
        }
        
        console.log('Vérification des trips dans la base de données...');
        const { data: tripsData, error: tripsError } = await supabase
          .from('trips')
          .select('trip_id, route_id, service_id, direction_id, trip_headsign')
          .eq('network_id', networkId)
          .eq('route_id', lineId)
          .eq('direction_id', directionId);

        if (tripsError) {
          console.error('Erreur lors de la vérification des trips:', tripsError);
        } else {
          console.log(`Nombre de trips trouvés: ${tripsData.length}`, tripsData);

          if (tripsData.length > 0) {
            console.log('Échantillon de trips:', tripsData.slice(0, 3).map(trip => ({
              trip_id: trip.trip_id,
              service_id: trip.service_id,
              direction_id: trip.direction_id,
              trip_headsign: trip.trip_headsign
            })));

            const { data: calendarData, error: calendarError } = await supabase
              .from('calendar')
              .select('*')
              .eq('network_id', networkId)
              .in('service_id', tripsData.map(t => t.service_id));

            if (calendarError) {
              console.error('Erreur lors de la vérification du calendrier:', calendarError);
            } else {
              console.log('Données du calendrier:', calendarData);
              
              if (calendarData && calendarData.length > 0) {
                console.log('Exemple de calendrier:', {
                  service_id: calendarData[0].service_id,
                  start_date: calendarData[0].start_date,
                  end_date: calendarData[0].end_date,
                  jours: {
                    lundi: calendarData[0].monday,
                    mardi: calendarData[0].tuesday,
                    mercredi: calendarData[0].wednesday,
                    jeudi: calendarData[0].thursday,
                    vendredi: calendarData[0].friday,
                    samedi: calendarData[0].saturday,
                    dimanche: calendarData[0].sunday
                  }
                });
              }
            }
          }
        }

        if (tripsData && tripsData.length > 0) {
          const { data: stopTimesData, error: stopTimesError } = await supabase
            .from('stop_times')
            .select('departure_time, stop_sequence')
            .eq('trip_id', tripsData[0].trip_id)
            .order('stop_sequence');

          if (stopTimesError) {
            console.error('Erreur lors de la vérification des stop_times:', stopTimesError);
          } else {
            console.log('Exemple de stop_times pour le premier trip:', stopTimesData);
          }
        }

        const selectedDate = currentDate;
        const currentDay = selectedDate.getDay();
        
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}${month}${day}`;
        const isoDate = `${year}-${month}-${day}`;

        const currentTime = selectedTime;

        console.log('Paramètres de date et heure:', {
          date: selectedDate.toLocaleDateString(),
          formattedDate,
          currentDay,
          currentTime,
          dayName: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][currentDay]
        });

        const params = {
          networkId,
          lineId,
          directionId: String(directionId),
          currentTime,
          formattedDate,
          currentDay,
          dayName: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][currentDay],
          today: selectedDate.toLocaleDateString()
        };
        
        console.log('Paramètres pour horaires_get_timeline:', params);
        setDebugInfo(params);

        if (!networkId || !lineId || directionId === undefined) {
          throw new Error(`Paramètres manquants: réseau=${networkId}, ligne=${lineId}, direction=${directionId}`);
        }

        console.log('Récupération des trips disponibles avec:', {
          p_network_id: networkId,
          p_route_id: lineId,
          p_direction_id: String(directionId),
          p_current_date: formattedDate,
          p_day_of_week: String(currentDay)
        });
        
        const { data: availableTrips, error: tripError } = await supabase
          .rpc('get_available_trips', {
            p_network_id: networkId,
            p_route_id: lineId,
            p_direction_id: String(directionId),
            p_current_date: formattedDate,
            p_day_of_week: String(currentDay)
          });

        if (tripError) {
          console.error('Erreur lors de la récupération des trips disponibles:', tripError);
          throw tripError;
        }

        console.log('Trips disponibles:', availableTrips);

        if (availableTrips && availableTrips.length > 0) {
          const tripsWithStatusInfo = availableTrips.map(trip => ({
            ...trip,
            isManuallyCancelled: cancelledTripsMap.has(trip.trip_id),
            cancellationReason: cancelledTripsMap.get(trip.trip_id) || null,
            isManuallyDelayed: delayedTripsMap.has(trip.trip_id),
            delayInfo: delayedTripsMap.get(trip.trip_id) || null,
          }));

          const filteredTrips = tripsWithStatusInfo.filter(trip => 
            trip.network_id === networkId && 
            trip.route_id === lineId && 
            trip.direction_id === Number(directionId)
          );
          
          console.log(`Nombre de trips filtrés: ${filteredTrips.length}/${availableTrips.length}`);
          
          if (filteredTrips.length === 0) {
            console.warn('Aucun trip ne correspond au réseau, ligne et direction spécifiés');
            setStopTimes([]);
            setLoading(false);
            return;
          }
          
          const tripsWithRealTimes = await Promise.all(filteredTrips.map(async (trip) => {
            try {
              const { data, error } = await supabase
                .from('stop_times')
                .select('departure_time, stop_sequence, stops!inner(network_id)')
                .eq('trip_id', trip.trip_id)
                .eq('stops.network_id', networkId)
                .order('stop_sequence')
                .limit(1);
                
              if (error) {
                console.error(`Erreur lors de la récupération du premier arrêt pour trip ${trip.trip_id}:`, error);
                return {
                  ...trip,
                  real_first_time: trip.first_departure_time
                };
              }
              
              if (data && data.length > 0) {
                return {
                  ...trip,
                  real_first_time: data[0].departure_time
                };
              }
              
              return {
                ...trip,
                real_first_time: trip.first_departure_time
              };
            } catch (err) {
              console.error(`Erreur lors de la récupération du premier arrêt pour trip ${trip.trip_id}:`, err);
              return {
                ...trip,
                real_first_time: trip.first_departure_time
              };
            }
          }));
          
          const [hours, minutes] = currentTime.split(':').map(Number);
          const currentTimeInMinutes = hours * 60 + minutes;
          console.log('Heure sélectionnée en minutes:', currentTimeInMinutes);
          
          // Fonction utilitaire pour extraire les minutes totales d'une heure au format HH:MM:SS
          const getTimeInMinutes = (timeString) => {
            if (!timeString) return -1;
            
            // Extraire seulement HH:MM si le format est plus long
            const timeStr = timeString.substring(0, 5);
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            if (isNaN(hours) || isNaN(minutes)) {
              console.warn('Format d\'heure invalide:', timeString);
              return -1;
            }
            
            // Préserver l'ordre chronologique en ne convertissant pas les heures supérieures à 23
            return hours * 60 + minutes;
          };
          
          // RESET complet du tri des trips
          console.log('Données brutes des trips avant tri:', tripsWithRealTimes.map(t => ({
            trip_id: t.trip_id,
            first_departure_time: t.first_departure_time,
            real_first_time: t.real_first_time,
            stored_time: window.tripFirstStops && window.tripFirstStops[t.trip_id] ? window.tripFirstStops[t.trip_id] : null
          })));
          
          // Tri strict par heure de départ
          const sortedTrips = [...tripsWithRealTimes].sort((a, b) => {
            // Déterminer l'heure de départ effective pour chaque trip
            const getEffectiveTime = (trip) => {
              // Priorité 1: temps stocké dans window.tripFirstStops (le plus fiable car basé sur les arrêts réels)
              if (window.tripFirstStops && window.tripFirstStops[trip.trip_id]) {
                return window.tripFirstStops[trip.trip_id];
              }
              
              // Priorité 2: real_first_time si disponible
              if (trip.real_first_time) {
                return formatStandardTime(trip.real_first_time, false);
              }
              
              // Priorité 3: first_departure_time
              if (trip.first_departure_time) {
                return formatStandardTime(trip.first_departure_time, false);
              }
              
              // Valeur par défaut si aucune heure n'est disponible
              return '99:99:99'; // Valeur très élevée pour mettre à la fin
            };
            
            const timeA = getEffectiveTime(a);
            const timeB = getEffectiveTime(b);
            
            // Comparer les temps en minutes
            const minutesA = getTimeInMinutes(timeA);
            const minutesB = getTimeInMinutes(timeB);
            
            // Pour debug: log si on trouve un cas problématique
            if (minutesA === 900 || minutesB === 900) { // 15:00 = 900 minutes
              console.log('Comparaison de trips autour de 15h:', {
                tripA: { id: a.trip_id, time: timeA, minutes: minutesA },
                tripB: { id: b.trip_id, time: timeB, minutes: minutesB },
              });
            }
            
            return minutesA - minutesB;
          });
          
          // Afficher les trips triés pour vérifier l'ordre chronologique
          console.log('NOUVEAU TRI - Trips triés par heure de départ RÉELLE:', 
            sortedTrips.map((t, index) => {
              const getEffectiveTime = (trip) => {
                if (window.tripFirstStops && window.tripFirstStops[trip.trip_id]) {
                  return window.tripFirstStops[trip.trip_id];
                }
                if (trip.real_first_time) return formatStandardTime(trip.real_first_time, true); // Pour l'affichage
                if (trip.first_departure_time) return formatStandardTime(trip.first_departure_time, true); // Pour l'affichage
                return '??:??';
              };
              
              const time = getEffectiveTime(t);
              const minutesTotal = getTimeInMinutes(time);
              
              return {
                index,
                trip_id: t.trip_id,
                display_time: time.substring(0, 5),
                original_time: t.real_first_time || t.first_departure_time,
                stored_time: window.tripFirstStops ? window.tripFirstStops[t.trip_id] : null,
                minutes: minutesTotal,
                hours_mins: `${Math.floor(minutesTotal/60)}h${minutesTotal % 60}`
              };
            })
          );
          
          // Utiliser l'heure sélectionnée ou l'heure actuelle
          
          // On commence par le premier voyage comme valeur par défaut
          let nextTripIndex = 0;
          
          // Si nous avons une heure sélectionnée, nous trouvons le voyage correspondant
          const [selectedHour, selectedMinute] = selectedTime.split(':').map(Number);
          const selectedTimeInMinutes = selectedHour * 60 + selectedMinute;
          
          console.log("Recherche du voyage le plus proche de", selectedTime, "(", selectedTimeInMinutes, "minutes)");
          
          // Trouver le voyage dont l'heure de départ est la plus proche de l'heure sélectionnée
          let closestTimeDiff = Infinity;
          
          for (let i = 0; i < sortedTrips.length; i++) {
            // Obtenir l'heure effective du trip
            const getEffectiveTime = (trip) => {
              if (window.tripFirstStops && window.tripFirstStops[trip.trip_id]) {
                return window.tripFirstStops[trip.trip_id];
              }
              if (trip.real_first_time) return trip.real_first_time;
              if (trip.first_departure_time) return trip.first_departure_time;
              return '00:00';
            };
            
            const tripTime = getEffectiveTime(sortedTrips[i]);
            const timeStr = tripTime.substring(0, 5);
            const [tripHour, tripMinute] = timeStr.split(':').map(Number);
            const tripTimeInMinutes = tripHour * 60 + tripMinute;
            
            console.log(`Trip ${i}: ${timeStr} (${tripTimeInMinutes} min) - différence: ${Math.abs(tripTimeInMinutes - selectedTimeInMinutes)} min`);
            
            // Calculer la différence de temps
            const timeDiff = Math.abs(tripTimeInMinutes - selectedTimeInMinutes);
            
            // Si ce trip est plus proche que le précédent plus proche
            if (timeDiff < closestTimeDiff) {
              closestTimeDiff = timeDiff;
              nextTripIndex = i;
            }
          }
          
          console.log(`Trip le plus proche sélectionné: ${nextTripIndex}, écart: ${closestTimeDiff} minutes`);
          
          console.log(`Sélection du trip le plus proche: index ${nextTripIndex}/${sortedTrips.length - 1}`, sortedTrips[nextTripIndex]);
          
          // Utiliser directement les trips triés, sans tri supplémentaire
          setTrips(sortedTrips);
          setCurrentTripIndex(nextTripIndex);
          
          fetchTripDetails(sortedTrips[nextTripIndex].trip_id);
          return;
        }

        const { data, error, status, statusText } = await supabase
          .rpc('horaires_get_timeline', {
            p_network_id: networkId,
            p_route_id: lineId,
            p_direction_id: String(directionId),
            p_current_time: currentTime,
            p_current_date: formattedDate,
            p_day_of_week: String(currentDay)
          });

        if (error) {
          console.error('Erreur Supabase RPC:', error);
          setErrorDetails({
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            status,
            statusText,
            params: {
              networkId,
              lineId,
              directionId,
              currentTime,
              formattedDate,
              currentDay
            }
          });
          throw error;
        }

        console.log('Données reçues de horaires_get_timeline:', data);
        
        if (!data || !Array.isArray(data)) {
          console.warn('Format de données inattendu:', data);
          throw new Error('Format de données invalide reçu du serveur');
        }

        if (data.length === 0) {
          console.warn('Aucun horaire trouvé pour:', {
            networkId,
            lineId,
            directionId,
            currentTime,
            formattedDate,
            currentDay
          });
          setStopTimes([]);
          return;
        }

        const formattedStops = data.map(stop => ({
          ...stop,
          departure_time: stop.departure_time ? formatStandardTime(stop.departure_time.substring(0, 5), true) : '??:??'
        }));
        
        console.log('Arrêts formatés:', formattedStops);
        setStopTimes(formattedStops);
        
      } catch (err) {
        console.error('Erreur lors du chargement des horaires:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (networkId && lineId && directionId !== undefined) {
      fetchHoraires();
    } else {
      setLoading(false);
      setError('Paramètres manquants pour charger les horaires');
    }
  }, [networkId, lineId, directionId, currentDate, selectedTime]);

  // Réinitialiser le timer quand les données changent
  useEffect(() => {
    if (noScheduleTimer.current) {
      clearTimeout(noScheduleTimer.current);
    }

    if (!loading && (!stopTimes.length || (stopTimes.length === 1 && stopTimes[0].departure_time === '??:??')) && !isChangingTrip) {
      noScheduleTimer.current = setTimeout(() => {
        setShowNoSchedule(true);
      }, 500); // Réduit à 500ms pour être plus réactif
    } else {
      setShowNoSchedule(false);
    }

    return () => {
      if (noScheduleTimer.current) {
        clearTimeout(noScheduleTimer.current);
      }
    };
  }, [loading, stopTimes, isChangingTrip]);

  // Effet pour charger les positions des véhicules même quand la carte n'est pas ouverte
  useEffect(() => {
    if (!networkId || !lineId) {
      return;
    }

    const loadVehiclePositions = async () => {
      try {
        const data = await fetchVehiclePositionData(networkId);
        if (data && Object.keys(data).length > 0) {
          // Utiliser le timestamp le plus récent de l'API comme référence
          const latestApiTimestamp = Math.max(...Object.values(data).map(v => parseInt(v.timestamp, 10)).filter(t => !isNaN(t)));
          
          const filteredPositions = {};
          
          // Obtenir le timestamp actuel en secondes
          const currentTimestamp = Math.floor(Date.now() / 1000);
          
          // Filtrer les véhicules dont le timestamp est à jour (moins de 2 minutes d'écart)
          Object.entries(data).forEach(([vehicleId, vehicleData]) => {
            if (vehicleData.routeId === lineId) {
              const vehicleTimestamp = parseInt(vehicleData.timestamp, 10);
              
              // Si le timestamp du véhicule est récent (moins de 2 minutes)
              // OU si le timestamp est 0 (certaines APIs comme BIBUS retournent toujours 0)
              if (vehicleTimestamp === 0 || (vehicleTimestamp && (currentTimestamp - vehicleTimestamp < 120))) {
                filteredPositions[vehicleId] = vehicleData;
              }
            }
          });
          setVehiclePositions(filteredPositions);
        } else if (data) {
          // Si l'API renvoie un objet vide, on vide aussi les positions
          setVehiclePositions({});
        }
      } catch (err) {
        console.error('Erreur lors du chargement des positions des véhicules:', err);
      }
    };

    loadVehiclePositions();
    const intervalId = setInterval(loadVehiclePositions, 15000); // Toutes les 15 secondes pour être plus réactif

    return () => clearInterval(intervalId);
  }, [networkId, lineId]);

  const currentTrip = useMemo(() => {
    if (trips && currentTripIndex >= 0 && currentTripIndex < trips.length) {
      return trips[currentTripIndex];
    }
    return null;
  }, [trips, currentTripIndex]);

  // Mettre à jour le titre de la page avec le format demandé
  useEffect(() => {
    const updatePageTitle = async () => {
      // Récupérer le nom du réseau si nécessaire
      if (!networkName && networkId) {
        try {
          const { data } = await supabase
            .from('networks')
            .select('network_name')
            .eq('network_id', networkId)
            .single();
          
          if (data && data.network_name) {
            setNetworkName(data.network_name);
          }
        } catch (error) {
          console.error("Erreur lors de la récupération du nom du réseau:", error);
        }
      }
      
      // Construire le titre
      let title = "Bus Connect";
      
      // Ajouter le numéro de ligne s'il est disponible
      if (lineInfo && lineInfo.route_short_name) {
        title += ` - ${lineInfo.route_short_name}`;
      }
      
      // Ajouter le nom du réseau s'il est disponible
      if (networkName) {
        title += ` ${networkName}`;
      }
      
      // Ajouter la direction si disponible
      if (directionHeadsign) {
        title += ` vers ${directionHeadsign}`;
      } else if (availableDirections && availableDirections.length > 0) {
        // Chercher la direction correspondante
        const currentDirection = availableDirections.find(dir => dir.id === directionId);
        if (currentDirection && currentDirection.name) {
          setDirectionHeadsign(currentDirection.name);
          title += ` vers ${currentDirection.name}`;
        }
      }
      
      // Mettre à jour le titre de la page
      document.title = title;
    };
    
    updatePageTitle();
  }, [networkId, lineInfo, networkName, directionHeadsign, availableDirections, directionId]);

  // Afficher le skeleton pendant le chargement initial
  if (loading) {
    return (
      <div className="horaires-container dark:bg-gray-900">
        <DateTimePicker
          currentDate={currentDate}
          selectedTime={selectedTime}
          onDateChange={handleDateChange}
          onTimeChange={handleTimeChange}
          lineInfo={lineInfo}
          loading={loading}
        />
        <LoadingSkeleton trips={trips} currentTripIndex={currentTripIndex} lineInfo={lineInfo} />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="horaires-error">
        <div className="error-message">Erreur: {error}</div>
        {errorDetails && (
          <div className="error-details">
            <details>
              <summary>Détails de l'erreur</summary>
              <pre>{JSON.stringify(errorDetails, null, 2)}</pre>
            </details>
          </div>
        )}
        {debugInfo && (
          <div className="debug-info">
            <details>
              <summary>Informations de débogage</summary>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="horaires-container dark:bg-gray-900">
      <DateTimePicker
        currentDate={currentDate}
        selectedTime={selectedTime}
        onDateChange={handleDateChange}
        onTimeChange={handleTimeChange}
        lineInfo={lineInfo}
        loading={loading}
      />
      
      {trips.length > 0 && (
        <TripNavigation
          currentTripIndex={currentTripIndex}
          trips={trips}
          isChangingTrip={isChangingTrip}
          onPreviousTrip={handlePreviousTrip}
          onNextTrip={handleNextTrip}
          lineInfo={lineInfo}
          onMapOpen={handleOpenMap}
          networkId={networkId}
          routeId={lineId}
          directionId={directionId}
          currentTripId={trips[currentTripIndex]?.trip_id}
          vehiclePositions={vehiclePositions}
        />
      )}
      
      {/* Afficher le même skeleton pendant la navigation entre trajets */}
      {isChangingTrip ? (
        <LoadingSkeleton trips={trips} currentTripIndex={currentTripIndex} lineInfo={lineInfo} />
      ) : (!stopTimes.length || stopTimes.some(stop => stop.departure_time === '??:??')) ? (
        <NoSchedule currentDate={currentDate} />
      ) : (
        <Timetable
          networkId={networkId}
          stopTimes={stopTimes}
          stopConnections={stopConnections}
          connectionsLoading={connectionsLoading}
          lineInfo={lineInfo}
          isChangingTrip={isChangingTrip}
          isRealtime={isRealtime}
          currentDate={currentDate}
          vehicle={currentVehicle}
          isManuallyCancelled={currentTrip?.isManuallyCancelled}
          cancellationReason={currentTrip?.cancellationReason}
          isManuallyDelayed={currentTrip?.isManuallyDelayed}
          delayInfo={currentTrip?.delayInfo}
        />
      )}
      
      {/* Composant Map */}
      <MapView 
        isOpen={isMapOpen} 
        onClose={handleCloseMap} 
        selectedStop={selectedStopForMap}
        networkId={mapParams.networkId}
        routeId={mapParams.routeId}
        directionId={mapParams.directionId}
        tripId={mapParams.tripId}
        onVehiclePositionsUpdate={setVehiclePositions}
      />
    </div>
  );
};

export default Horaires; 