import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { 
  getNetworks, 
  getRoutesByNetwork, 
  getTripsByRouteAndDate,
  markTripAsCancelled,
  markTripsAsCancelled,
  getCancelledTrips,
  unmarkTripAsCancelled,
  getTripById,
  getAllTripsByDate,
  restoreAllCancelledTrips,
  markTripAsDelayed,
  markTripsAsDelayed,
  getDelayedTrips,
  removeDelayForTrip,
  removeAllDelays
} from '../../services/admin';

const CANCELLATION_REASONS = [
  'Mouvement Social',
  'Retard',
  'Panne de bus',
  'Travaux',
  'Circulation difficile',
  'Intempéries'
];

const DELAY_REASONS = [
  'Trafic dense',
  'Problème technique',
  'Intempéries',
  'Accident',
  'Travaux',
  'Affluence voyageurs',
  'Manifestation'
];

const TripCancellation = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // États pour la sélection
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [directions, setDirections] = useState([]);
  const [selectedDirection, setSelectedDirection] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedReason, setSelectedReason] = useState(CANCELLATION_REASONS[0]);
  const [selectedDelayReason, setSelectedDelayReason] = useState(DELAY_REASONS[0]);
  const [cancellAllTrips, setCancellAllTrips] = useState(false);
  const [allNetworkTrips, setAllNetworkTrips] = useState([]);
  
  // États pour les trips
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedTrips, setSelectedTrips] = useState([]);
  const [tripDetails, setTripDetails] = useState(null);
  const [loadingTripTimes, setLoadingTripTimes] = useState(false);
  const [tripsWithTimes, setTripsWithTimes] = useState({});

  // État pour les trips déjà annulés
  const [cancelledTrips, setCancelledTrips] = useState([]);
  const [displayMode, setDisplayMode] = useState('cancel');
  
  // États pour les retards
  const [delayedTrips, setDelayedTrips] = useState([]);
  const [delayMinutes, setDelayMinutes] = useState(5);
  const [delayAllTrips, setDelayAllTrips] = useState(false);
  const [actionMode, setActionMode] = useState('cancel'); // 'cancel' ou 'delay'

  // Charger les réseaux au démarrage
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('users')
        .select('modtools')
        .eq('id', user.id)
        .single();

      if (!data || data.modtools !== 1) {
        navigate('/');
      }
    };

    const loadNetworks = async () => {
      setLoading(true);
      try {
        const data = await getNetworks();
        setNetworks(data);
      } catch (err) {
        setError('Erreur lors du chargement des réseaux: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
    loadNetworks();
  }, [navigate]);

  // Charger les lignes quand un réseau est sélectionné
  useEffect(() => {
    if (!selectedNetwork) {
      setRoutes([]);
      setSelectedRoute(null);
      return;
    }

    const loadRoutes = async () => {
      setLoading(true);
      try {
        const data = await getRoutesByNetwork(selectedNetwork.network_id);
        setRoutes(data);
      } catch (err) {
        setError('Erreur lors du chargement des lignes: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [selectedNetwork]);

  // Charger les directions réelles avec les terminus pour la ligne sélectionnée
  useEffect(() => {
    if (!selectedRoute || !selectedNetwork) {
      setDirections([]);
      setSelectedDirection(null);
      return;
    }

    const loadDirections = async () => {
      try {
        // Utiliser la fonction RPC pour récupérer les directions avec les noms de terminus
        const { data, error } = await supabase.rpc(
          'get_route_directions',
          {
            route_id_param: selectedRoute.route_id,
            network_id_param: selectedNetwork.network_id
          }
        );
        
        if (error) {
          console.error('Erreur lors du chargement des directions:', error);
          // En cas d'erreur, utiliser les directions par défaut
          setDirections([
            { id: 0, name: 'Direction Aller' },
            { id: 1, name: 'Direction Retour' }
          ]);
          return;
        }
        
        // Traiter les données pour créer des objets de direction avec libellés personnalisés
        const formattedDirections = (data || []).map(dir => {
          // S'assurer que terminus_names est toujours un tableau
          const terminusNames = Array.isArray(dir.terminus_names) ? dir.terminus_names : [];
          
          // Créer un libellé avec les terminus (ex: "Collège / Gare / Mairie")
          const directionLabel = terminusNames.length > 0 
            ? terminusNames.join(' / ')
            : `Direction ${dir.direction_id === 0 ? 'Aller' : 'Retour'}`;
            
          return {
            id: dir.direction_id,
            name: directionLabel,
            terminus: terminusNames
          };
        });
        
        // Si aucune direction n'est récupérée, utiliser les directions par défaut
        if (formattedDirections.length === 0) {
          setDirections([
            { id: 0, name: 'Direction Aller' },
            { id: 1, name: 'Direction Retour' }
          ]);
        } else {
          setDirections(formattedDirections);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des directions:', err);
        // En cas d'erreur, utiliser les directions par défaut
        setDirections([
          { id: 0, name: 'Direction Aller' },
          { id: 1, name: 'Direction Retour' }
        ]);
      }
    };

    loadDirections();
  }, [selectedRoute, selectedNetwork]);

  // Charger les trips annulés quand un réseau et une date sont sélectionnés
  useEffect(() => {
    if (!selectedNetwork || !selectedDate) return;

    const loadCancelledTrips = async () => {
      try {
        const data = await getCancelledTrips(selectedNetwork.network_id, selectedDate);
        setCancelledTrips(data || []);
      } catch (err) {
        console.error('Erreur lors du chargement des trips annulés:', err);
        // Si erreur, initialiser avec tableau vide
        setCancelledTrips([]);
      }
    };

    loadCancelledTrips();
  }, [selectedNetwork, selectedDate, displayMode]);

  // Charger les trips retardés quand un réseau et une date sont sélectionnés
  useEffect(() => {
    if (!selectedNetwork || !selectedDate) return;

    const loadDelayedTrips = async () => {
      try {
        const data = await getDelayedTrips(selectedNetwork.network_id, selectedDate);
        setDelayedTrips(data || []);
      } catch (err) {
        console.error('Erreur lors du chargement des trips retardés:', err);
        // Si erreur (probablement table inexistante), initialiser avec tableau vide
        setDelayedTrips([]);
      }
    };

    loadDelayedTrips();
  }, [selectedNetwork, selectedDate, displayMode]);

  // Fonction auxiliaire pour obtenir le nom de la direction à partir de l'ID
  const getDirectionName = (directionId) => {
    const direction = directions.find(d => d.id === directionId);
    return direction ? direction.name : `Direction ${directionId === 0 ? 'Aller' : 'Retour'}`;
  };

  // Charger les trips quand une ligne, une direction et une date sont sélectionnés
  const handleSearch = async () => {
    if (!selectedNetwork || !selectedRoute || selectedDirection === null || !selectedDate) {
      setError('Veuillez sélectionner tous les critères');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setTrips([]);
    setSelectedTrip(null);
    setTripsWithTimes({});

    try {
      console.log("Début de la recherche - Critères:", {
        network_id: selectedNetwork.network_id,
        route_id: selectedRoute.route_id,
        direction_id: selectedDirection.id,
        date: selectedDate
      });

      const data = await getTripsByRouteAndDate(
        selectedNetwork.network_id,
        selectedRoute.route_id,
        selectedDirection.id,
        selectedDate
      );

      console.log("Résultats bruts:", data);

      // Récupérer les détails complets des routes pour tous les trips
      const tripsWithRouteDetails = await Promise.all(
        data.map(async (trip) => {
          // Récupérer les informations de route complètes
          const { data: routeData } = await supabase
            .from('routes')
            .select('*')
            .eq('route_id', trip.route_id)
            .eq('network_id', selectedNetwork.network_id)
            .single();
            
          return { ...trip, routeDetails: routeData };
        })
      );

      console.log("Trips avec détails de route:", tripsWithRouteDetails);

      // Filtrer les trips par l'heure si spécifiée
      let filteredTrips = tripsWithRouteDetails;
      if (selectedTime) {
        // Convertir l'heure sélectionnée en minutes depuis minuit
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const selectedMinutes = hours * 60 + minutes;
        
        // Chercher les stop_times pour chaque trip
        const tripsWithStopTimes = await Promise.all(
          filteredTrips.map(async (trip) => {
            const { data: stopTimes } = await supabase
              .from('stop_times')
              .select('departure_time')
              .eq('trip_id', trip.trip_id)
              .eq('network_id', selectedNetwork.network_id)
              .order('stop_sequence', { ascending: true })
              .limit(1);
            
            if (stopTimes && stopTimes.length > 0) {
              const [stopHours, stopMinutes] = stopTimes[0].departure_time.split(':').map(Number);
              const stopTimeMinutes = stopHours * 60 + stopMinutes;
              return { ...trip, departureMinutes: stopTimeMinutes };
            }
            
            return null;
          })
        );
        
        // Filtrer les trips qui sont proches de l'heure sélectionnée (± 30 minutes)
        filteredTrips = tripsWithStopTimes
          .filter(trip => trip && Math.abs(trip.departureMinutes - selectedMinutes) <= 30)
          .sort((a, b) => a.departureMinutes - b.departureMinutes);
      }

      console.log("Trips après filtrage par heure:", filteredTrips);

      // Filtrer les trips déjà annulés
      const cancelledTripIds = cancelledTrips.map(ct => ct.trip_id);
      console.log("IDs des trips annulés:", cancelledTripIds);
      filteredTrips = filteredTrips.filter(trip => !cancelledTripIds.includes(trip.trip_id));

      try {
        // Filtrer les trips déjà retardés
        const delayedTripIds = delayedTrips.map(dt => dt.trip_id) || [];
        console.log("IDs des trips retardés:", delayedTripIds);
        filteredTrips = filteredTrips.filter(trip => !delayedTripIds.includes(trip.trip_id));
      } catch (delayError) {
        console.warn("Erreur lors du filtrage des trips retardés - Continuez sans filtre:", delayError);
      }

      console.log("Trips finaux après tous les filtrages:", filteredTrips);

      setTrips(filteredTrips);
      
      if (filteredTrips.length === 0) {
        setError('Aucun voyage trouvé avec ces critères');
      } else {
        // Charger les horaires de départ et d'arrivée pour chaque voyage
        loadTripTimes(filteredTrips);
      }
    } catch (err) {
      console.error("Erreur lors de la recherche:", err);
      setError('Erreur lors de la recherche: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour charger les horaires des voyages
  const loadTripTimes = async (tripsToLoad) => {
    setLoadingTripTimes(true);
    const newTripsWithTimes = { ...tripsWithTimes };

    await Promise.all(
      tripsToLoad.map(async (trip) => {
        try {
          // Charger le premier arrêt (départ)
          const { data: firstStop } = await supabase
            .from('stop_times')
            .select('departure_time, stops(stop_name)')
            .eq('trip_id', trip.trip_id)
            .eq('network_id', selectedNetwork.network_id)
            .order('stop_sequence', { ascending: true })
            .limit(1);

          // Charger le dernier arrêt (arrivée)
          const { data: lastStop } = await supabase
            .from('stop_times')
            .select('arrival_time, stops(stop_name)')
            .eq('trip_id', trip.trip_id)
            .eq('network_id', selectedNetwork.network_id)
            .order('stop_sequence', { ascending: false })
            .limit(1);

          if (firstStop?.length > 0 && lastStop?.length > 0) {
            newTripsWithTimes[trip.trip_id] = {
              departure: {
                time: firstStop[0].departure_time,
                stopName: firstStop[0].stops?.stop_name
              },
              arrival: {
                time: lastStop[0].arrival_time,
                stopName: lastStop[0].stops?.stop_name
              }
            };
          }
        } catch (error) {
          console.error(`Erreur lors du chargement des horaires pour ${trip.trip_id}:`, error);
        }
      })
    );

    setTripsWithTimes(newTripsWithTimes);
    setLoadingTripTimes(false);
  };

  // Fonction pour trier les voyages par heure de départ
  const getSortedTrips = () => {
    if (!trips || trips.length === 0 || Object.keys(tripsWithTimes).length === 0) {
      return trips;
    }

    // Copier les voyages pour pouvoir les trier
    return [...trips].sort((a, b) => {
      const departureTimeA = tripsWithTimes[a.trip_id]?.departure?.time || '99:99:99';
      const departureTimeB = tripsWithTimes[b.trip_id]?.departure?.time || '99:99:99';
      
      // Convertir en minutes depuis minuit pour la comparaison
      const [hoursA, minutesA] = departureTimeA.split(':').map(Number);
      const [hoursB, minutesB] = departureTimeB.split(':').map(Number);
      
      const totalMinutesA = hoursA * 60 + minutesA;
      const totalMinutesB = hoursB * 60 + minutesB;
      
      return totalMinutesA - totalMinutesB;
    });
  };

  // Fonction pour trier les voyages annulés par heure
  const getSortedCancelledTrips = () => {
    if (!cancelledTrips || cancelledTrips.length === 0) {
      return cancelledTrips;
    }

    return [...cancelledTrips].sort((a, b) => {
      // Si l'information d'heure de départ est disponible, l'utiliser
      const departureTimeA = a.firstStop?.departure_time || '99:99:99';
      const departureTimeB = b.firstStop?.departure_time || '99:99:99';
      
      // Convertir en minutes depuis minuit pour la comparaison
      const [hoursA, minutesA] = departureTimeA.split(':').map(Number);
      const [hoursB, minutesB] = departureTimeB.split(':').map(Number);
      
      const totalMinutesA = hoursA * 60 + minutesA;
      const totalMinutesB = hoursB * 60 + minutesB;
      
      return totalMinutesA - totalMinutesB;
    });
  };

  // Fonction pour trier les voyages retardés par heure
  const getSortedDelayedTrips = () => {
    if (!delayedTrips || delayedTrips.length === 0) {
      return delayedTrips;
    }

    return [...delayedTrips].sort((a, b) => {
      // Si l'information d'heure de départ est disponible, l'utiliser
      const departureTimeA = a.firstStop?.departure_time || '99:99:99';
      const departureTimeB = b.firstStop?.departure_time || '99:99:99';
      
      // Convertir en minutes depuis minuit pour la comparaison
      const [hoursA, minutesA] = departureTimeA.split(':').map(Number);
      const [hoursB, minutesB] = departureTimeB.split(':').map(Number);
      
      const totalMinutesA = hoursA * 60 + minutesA;
      const totalMinutesB = hoursB * 60 + minutesB;
      
      return totalMinutesA - totalMinutesB;
    });
  };

  // Charger tous les voyages pour l'option "Supprimer toutes les courses"
  useEffect(() => {
    if ((cancellAllTrips || delayAllTrips) && selectedNetwork && selectedDate) {
      const loadAllTrips = async () => {
        setLoading(true);
        try {
          const allTrips = await getAllTripsByDate(selectedNetwork.network_id, selectedDate);
          
          // Filtrer les trips déjà annulés
          const cancelledTripIds = cancelledTrips.map(ct => ct.trip_id);
          // Filtrer les trips déjà retardés
          const delayedTripIds = delayedTrips.map(dt => dt.trip_id) || [];
          
          const filteredTrips = allTrips.filter(trip => 
            !cancelledTripIds.includes(trip.trip_id) && !delayedTripIds.includes(trip.trip_id)
          );
          
          setAllNetworkTrips(filteredTrips);
        } catch (err) {
          console.error('Erreur lors du chargement de tous les voyages:', err);
        } finally {
          setLoading(false);
        }
      };
      
      loadAllTrips();
    }
  }, [cancellAllTrips, delayAllTrips, selectedNetwork, selectedDate, cancelledTrips, delayedTrips]);

  // Charger les détails d'un trip
  const handleTripSelection = async (trip) => {
    setSelectedTrip(trip);
    setTripDetails(null);

    try {
      const data = await getTripById(selectedNetwork.network_id, trip.trip_id);
      
      // Charger les horaires du trip
      const { data: stopTimes } = await supabase
        .from('stop_times')
        .select(`
          *,
          stops (
            stop_name,
            stop_lat,
            stop_lon
          )
        `)
        .eq('trip_id', trip.trip_id)
        .eq('network_id', selectedNetwork.network_id)
        .order('stop_sequence', { ascending: true });
      
      setTripDetails({ ...data, stopTimes });
    } catch (err) {
      console.error('Erreur lors du chargement des détails:', err);
    }
  };

  // Gérer la sélection multiple de trajets
  const handleTripCheckboxChange = (trip) => {
    if (selectedTrips.some(t => t.trip_id === trip.trip_id)) {
      setSelectedTrips(selectedTrips.filter(t => t.trip_id !== trip.trip_id));
    } else {
      setSelectedTrips([...selectedTrips, trip]);
    }
  };

  // Marquer un ou plusieurs trips comme supprimés
  const handleCancelTrip = async () => {
    if (!selectedTrip && !cancellAllTrips && selectedTrips.length === 0) {
      setError('Veuillez sélectionner au moins un voyage ou cocher "Supprimer toutes les courses"');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (cancellAllTrips) {
        // Annuler tous les trajets du jour pour le réseau entier
        const tripsToCancel = allNetworkTrips.map(trip => ({
          network_id: selectedNetwork.network_id,
          trip_id: trip.trip_id,
          cancellation_date: selectedDate,
          reason: selectedReason
        }));
        
        if (tripsToCancel.length === 0) {
          setError('Aucun voyage disponible à supprimer pour cette date');
          setLoading(false);
          return;
        }
        
        await markTripsAsCancelled(tripsToCancel);
        setSuccess(`${tripsToCancel.length} voyages ont été marqués comme supprimés pour l'ensemble du réseau`);
        setTrips([]);
        setSelectedTrip(null);
        setSelectedTrips([]);
      } else if (selectedTrips.length > 0) {
        // Annuler plusieurs trajets sélectionnés
        const tripsToCancel = selectedTrips.map(trip => ({
          network_id: selectedNetwork.network_id,
          trip_id: trip.trip_id,
          cancellation_date: selectedDate,
          reason: selectedReason
        }));
        
        await markTripsAsCancelled(tripsToCancel);
        setSuccess(`${tripsToCancel.length} voyages ont été marqués comme supprimés`);
        
        // Retirer les trips de la liste
        const tripIdsToRemove = selectedTrips.map(t => t.trip_id);
        setTrips(trips.filter(t => !tripIdsToRemove.includes(t.trip_id)));
        setSelectedTrip(null);
        setSelectedTrips([]);
      } else {
        // Annuler seulement le trip sélectionné
        await markTripAsCancelled(
          selectedNetwork.network_id,
          selectedTrip.trip_id,
          selectedDate,
          selectedReason
        );
        setSuccess('Le voyage a été marqué comme supprimé');
        
        // Retirer le trip de la liste
        setTrips(trips.filter(t => t.trip_id !== selectedTrip.trip_id));
        setSelectedTrip(null);
      }
      
      // Recharger les trips annulés
      const data = await getCancelledTrips(selectedNetwork.network_id, selectedDate);
      setCancelledTrips(data);
    } catch (err) {
      setError('Erreur lors de l\'annulation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Annuler la suppression d'un trip
  const handleRestoreTrip = async (cancelledTrip) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await unmarkTripAsCancelled(cancelledTrip.id);
      setSuccess('La suppression du voyage a été annulée');
      
      // Mettre à jour la liste des trips annulés
      setCancelledTrips(cancelledTrips.filter(ct => ct.id !== cancelledTrip.id));
    } catch (err) {
      setError('Erreur lors de la restauration: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Restaurer tous les trajets annulés
  const handleRestoreAllTrips = async () => {
    if (!selectedNetwork || !selectedDate || cancelledTrips.length === 0) {
      setError('Aucun voyage à restaurer');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await restoreAllCancelledTrips(selectedNetwork.network_id, selectedDate);
      setSuccess(`Tous les voyages supprimés (${cancelledTrips.length}) ont été rétablis`);
      setCancelledTrips([]);
    } catch (err) {
      setError('Erreur lors de la restauration: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Marquer un ou plusieurs trips comme retardés
  const handleDelayTrip = async () => {
    if (!selectedTrip && !delayAllTrips && selectedTrips.length === 0) {
      setError('Veuillez sélectionner au moins un voyage ou cocher "Retarder toutes les courses"');
      return;
    }

    if (delayMinutes <= 0) {
      setError('Veuillez entrer un nombre de minutes de retard valide (supérieur à 0)');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (delayAllTrips) {
        // Retarder tous les trajets du jour pour le réseau entier
        const tripsToDelay = allNetworkTrips.map(trip => ({
          network_id: selectedNetwork.network_id,
          trip_id: trip.trip_id,
          delay_date: selectedDate,
          delay_minutes: delayMinutes,
          reason: selectedDelayReason
        }));
        
        if (tripsToDelay.length === 0) {
          setError('Aucun voyage disponible à retarder pour cette date');
          setLoading(false);
          return;
        }
        
        await markTripsAsDelayed(tripsToDelay);
        setSuccess(`${tripsToDelay.length} voyages ont été marqués comme retardés pour l'ensemble du réseau`);
        setTrips([]);
        setSelectedTrip(null);
        setSelectedTrips([]);
      } else if (selectedTrips.length > 0) {
        // Retarder plusieurs trajets sélectionnés
        const tripsToDelay = selectedTrips.map(trip => ({
          network_id: selectedNetwork.network_id,
          trip_id: trip.trip_id,
          delay_date: selectedDate,
          delay_minutes: delayMinutes,
          reason: selectedDelayReason
        }));
        
        await markTripsAsDelayed(tripsToDelay);
        setSuccess(`${tripsToDelay.length} voyages ont été marqués comme retardés`);
        
        // Retirer les trips de la liste
        const tripIdsToRemove = selectedTrips.map(t => t.trip_id);
        setTrips(trips.filter(t => !tripIdsToRemove.includes(t.trip_id)));
        setSelectedTrip(null);
        setSelectedTrips([]);
      } else {
        // Retarder seulement le trip sélectionné
        await markTripAsDelayed(
          selectedNetwork.network_id,
          selectedTrip.trip_id,
          selectedDate,
          delayMinutes,
          selectedDelayReason
        );
        setSuccess('Le voyage a été marqué comme retardé');
        
        // Retirer le trip de la liste
        setTrips(trips.filter(t => t.trip_id !== selectedTrip.trip_id));
        setSelectedTrip(null);
      }
      
      // Recharger les trips retardés
      const data = await getDelayedTrips(selectedNetwork.network_id, selectedDate);
      setDelayedTrips(data);
    } catch (err) {
      setError('Erreur lors du retard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Annuler le retard d'un trip
  const handleRemoveDelay = async (delayedTrip) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await removeDelayForTrip(delayedTrip.id);
      setSuccess('Le retard du voyage a été annulé');
      
      // Mettre à jour la liste des trips retardés
      setDelayedTrips(delayedTrips.filter(dt => dt.id !== delayedTrip.id));
    } catch (err) {
      setError('Erreur lors de l\'annulation du retard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Annuler tous les retards
  const handleRemoveAllDelays = async () => {
    if (!selectedNetwork || !selectedDate || delayedTrips.length === 0) {
      setError('Aucun voyage retardé à restaurer');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await removeAllDelays(selectedNetwork.network_id, selectedDate);
      setSuccess(`Tous les retards (${delayedTrips.length}) ont été supprimés`);
      setDelayedTrips([]);
    } catch (err) {
      setError('Erreur lors de la suppression des retards: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Suppression de voyages</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
          {success}
        </div>
      )}
      
      <div className="flex gap-4 mb-6">
        <button 
          className={`px-4 py-2 rounded-md ${displayMode === 'cancel' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setDisplayMode('cancel')}
        >
          Modifier des voyages
        </button>
        <button 
          className={`px-4 py-2 rounded-md ${displayMode === 'manage' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setDisplayMode('manage')}
        >
          Gérer les modifications ({cancelledTrips.length + delayedTrips.length})
        </button>
      </div>
      
      {displayMode === 'cancel' && (
        <div className="flex gap-4 mb-6">
          <button 
            className={`px-4 py-2 rounded-md ${actionMode === 'cancel' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActionMode('cancel')}
          >
            Supprimer des voyages
          </button>
          <button 
            className={`px-4 py-2 rounded-md ${actionMode === 'delay' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActionMode('delay')}
          >
            Retarder des voyages
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Critères de recherche</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Réseau
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md"
              value={selectedNetwork?.network_id || ''}
              onChange={(e) => {
                const network = networks.find(n => n.network_id === e.target.value);
                setSelectedNetwork(network || null);
              }}
              disabled={loading}
            >
              <option value="">Sélectionner un réseau</option>
              {networks.map(network => (
                <option key={network.network_id} value={network.network_id}>
                  {network.network_name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 rounded-md"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={loading}
            />
          </div>

          {displayMode === 'cancel' && (
            <>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={actionMode === 'cancel' ? cancellAllTrips : delayAllTrips}
                    onChange={(e) => actionMode === 'cancel' ? setCancellAllTrips(e.target.checked) : setDelayAllTrips(e.target.checked)}
                    disabled={loading}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {actionMode === 'cancel' 
                      ? 'Supprimer toutes les courses du jour sélectionné (tout le réseau)'
                      : 'Retarder toutes les courses du jour sélectionné (tout le réseau)'}
                  </span>
                </label>
              </div>

              {/* Afficher l'input pour les minutes de retard en mode retard */}
              {actionMode === 'delay' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minutes de retard
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                    disabled={loading}
                  />
                </div>
              )}

              {actionMode === 'delay' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raison du retard
                  </label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={selectedDelayReason}
                    onChange={(e) => setSelectedDelayReason(e.target.value)}
                    disabled={loading}
                  >
                    {DELAY_REASONS.map(reason => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!(actionMode === 'cancel' ? cancellAllTrips : delayAllTrips) && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ligne
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={selectedRoute?.route_id || ''}
                      onChange={(e) => {
                        const route = routes.find(r => r.route_id === e.target.value);
                        setSelectedRoute(route || null);
                      }}
                      disabled={!selectedNetwork || loading}
                    >
                      <option value="">Sélectionner une ligne</option>
                      {routes.map(route => (
                        <option key={route.route_id} value={route.route_id}>
                          {route.route_short_name} - {route.route_long_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Direction
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={selectedDirection?.id ?? ''}
                      onChange={(e) => {
                        const dirId = parseInt(e.target.value);
                        const direction = directions.find(d => d.id === dirId);
                        setSelectedDirection(direction || null);
                      }}
                      disabled={!selectedRoute || loading}
                    >
                      <option value="">Sélectionner une direction</option>
                      {directions.map(dir => (
                        <option key={dir.id} value={dir.id}>
                          {dir.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heure approximative (optionnel)
                    </label>
                    <input
                      type="time"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  
                  <button
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    onClick={handleSearch}
                    disabled={!selectedNetwork || !selectedRoute || selectedDirection === null || !selectedDate || loading}
                  >
                    {loading ? 'Chargement...' : 'Rechercher les voyages'}
                  </button>
                </>
              )}
              
              {actionMode === 'cancel' && cancellAllTrips && selectedNetwork && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Attention :</strong> Cette opération annulera {allNetworkTrips.length} voyages 
                    pour le réseau {selectedNetwork.network_name} le {new Date(selectedDate).toLocaleDateString()}.
                  </p>
                </div>
              )}

              {actionMode === 'delay' && delayAllTrips && selectedNetwork && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Attention :</strong> Cette opération retardera de {delayMinutes} minutes {allNetworkTrips.length} voyages 
                    pour le réseau {selectedNetwork.network_name} le {new Date(selectedDate).toLocaleDateString()}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          {displayMode === 'cancel' ? (
            <>
              <h2 className="text-xl font-semibold mb-4">Voyages disponibles</h2>
              
              {trips.length > 0 && !(actionMode === 'cancel' ? cancellAllTrips : delayAllTrips) ? (
                <div className="mb-4">
                  <div className="mb-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                checked={selectedTrips.length === trips.length && trips.length > 0}
                                onChange={() => {
                                  if (selectedTrips.length === trips.length) {
                                    setSelectedTrips([]);
                                  } else {
                                    setSelectedTrips([...trips]);
                                  }
                                }}
                                disabled={loading}
                              />
                            </div>
                          </th>
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ligne
                          </th>
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID
                          </th>
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Destination
                          </th>
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Départ
                          </th>
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Arrivée
                          </th>
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedTrips().map(trip => (
                          <tr 
                            key={trip.trip_id} 
                            className={selectedTrip?.trip_id === trip.trip_id ? 'bg-blue-50' : (
                              selectedTrips.some(t => t.trip_id === trip.trip_id) ? 'bg-gray-50' : ''
                            )}
                          >
                            <td className="px-2 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                checked={selectedTrips.some(t => t.trip_id === trip.trip_id)}
                                onChange={() => handleTripCheckboxChange(trip)}
                                disabled={loading}
                              />
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap">
                              {trip.routeDetails ? (
                                <div className="flex items-center">
                                  <span 
                                    className="px-2 py-1 text-sm font-medium rounded-md"
                                    style={{ 
                                      backgroundColor: `#${trip.routeDetails.route_color || "808080"}`, 
                                      color: `#${trip.routeDetails.route_text_color || "FFFFFF"}`
                                    }}
                                  >
                                    {trip.routeDetails.route_short_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">-</span>
                              )}
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-500">
                              {trip.trip_id.substring(0, 6)}...
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-900">
                              {trip.trip_headsign}
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-500">
                              {loadingTripTimes 
                                ? '...' 
                                : tripsWithTimes[trip.trip_id]?.departure?.time || '-'}
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-500">
                              {loadingTripTimes 
                                ? '...' 
                                : tripsWithTimes[trip.trip_id]?.arrival?.time || '-'}
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-xs font-medium">
                              <button
                                className="text-blue-600 hover:text-blue-900"
                                onClick={() => handleTripSelection(trip)}
                              >
                                Détails
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {actionMode === 'cancel' ? 'Raison de la suppression' : 'Minutes de retard'}
                    </label>
                    {actionMode === 'cancel' ? (
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        disabled={loading}
                      >
                        {CANCELLATION_REASONS.map(reason => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={delayMinutes}
                        onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                        disabled={loading}
                      />
                    )}
                  </div>
                  
                  {actionMode === 'cancel' ? (
                    <button
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400"
                      onClick={handleCancelTrip}
                      disabled={(selectedTrips.length === 0 && !selectedTrip && !cancellAllTrips) || loading}
                    >
                      {loading 
                        ? 'Traitement...' 
                        : selectedTrips.length > 0 
                          ? `Supprimer les voyages sélectionnés (${selectedTrips.length})` 
                          : 'Supprimer ce voyage'
                      }
                    </button>
                  ) : (
                    <button
                      className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors disabled:bg-gray-400"
                      onClick={handleDelayTrip}
                      disabled={(selectedTrips.length === 0 && !selectedTrip && !delayAllTrips) || loading || delayMinutes <= 0}
                    >
                      {loading 
                        ? 'Traitement...' 
                        : selectedTrips.length > 0 
                          ? `Retarder les voyages sélectionnés (${selectedTrips.length})` 
                          : 'Retarder ce voyage'
                      }
                    </button>
                  )}
                </div>
              ) : actionMode === 'cancel' && cancellAllTrips ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {actionMode === 'cancel' ? 'Raison de la suppression' : 'Minutes de retard'}
                    </label>
                    {actionMode === 'cancel' ? (
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        disabled={loading}
                      >
                        {CANCELLATION_REASONS.map(reason => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={delayMinutes}
                        onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                        disabled={loading}
                      />
                    )}
                  </div>
                  
                  {actionMode === 'cancel' ? (
                    <button
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400"
                      onClick={handleCancelTrip}
                      disabled={!selectedNetwork || loading || allNetworkTrips.length === 0}
                    >
                      {loading 
                        ? 'Traitement...' 
                        : `Supprimer tous les voyages (${allNetworkTrips.length})`
                      }
                    </button>
                  ) : (
                    <button
                      className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors disabled:bg-gray-400"
                      onClick={handleDelayTrip}
                      disabled={!selectedNetwork || loading || allNetworkTrips.length === 0 || delayMinutes <= 0}
                    >
                      {loading 
                        ? 'Traitement...' 
                        : `Retarder tous les voyages (${allNetworkTrips.length})`
                      }
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">
                  {loading 
                    ? 'Chargement des voyages...' 
                    : actionMode === 'cancel' 
                      ? 'Choisissez un réseau et une date pour supprimer tous les voyages du jour.' 
                      : 'Aucun voyage trouvé. Veuillez sélectionner les critères et lancer une recherche.'
                  }
                </p>
              )}
              
              {tripDetails && (
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-lg font-medium mb-3">Détails du voyage</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>ID:</strong> {tripDetails.trip_id}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Ligne:</strong> {tripDetails.routes.route_short_name} - {tripDetails.routes.route_long_name}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Direction:</strong> {getDirectionName(tripDetails.direction_id)}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      <strong>Destination:</strong> {tripDetails.trip_headsign}
                    </p>
                    
                    <h4 className="text-md font-medium mb-2">Arrêts</h4>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Séq.
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Arrêt
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Arrivée
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Départ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {tripDetails.stopTimes && tripDetails.stopTimes.map(stopTime => (
                            <tr key={`${stopTime.trip_id}-${stopTime.stop_id}-${stopTime.stop_sequence}`}>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                {stopTime.stop_sequence}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                {stopTime.stops.stop_name}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                {stopTime.arrival_time}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                {stopTime.departure_time}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Voyages modifiés</h2>
                <div className="flex gap-2">
                  {cancelledTrips.length > 0 && (
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 text-sm"
                      onClick={handleRestoreAllTrips}
                      disabled={loading}
                    >
                      Rétablir tous les voyages supprimés
                    </button>
                  )}
                  {delayedTrips.length > 0 && (
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 text-sm"
                      onClick={handleRemoveAllDelays}
                      disabled={loading}
                    >
                      Supprimer tous les retards
                    </button>
                  )}
                </div>
              </div>
              
              {/* Voyages annulés */}
              {cancelledTrips.length > 0 && (
                <>
                  <h3 className="text-lg font-medium mb-2">Voyages supprimés ({cancelledTrips.length})</h3>
                  <div className="max-h-96 overflow-y-auto mb-6">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ligne
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Trajet
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Horaires
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Raison
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedCancelledTrips().map(cancelled => {
                          const route = cancelled.trips?.routes;
                          const routeColor = route?.route_color || "808080";
                          const routeTextColor = route?.route_text_color || "FFFFFF";
                          const direction = getDirectionName(cancelled.trips?.direction_id);
                          
                          return (
                            <tr key={cancelled.id}>
                              <td className="px-3 py-4 whitespace-nowrap">
                                {route ? (
                                  <div className="flex items-center">
                                    <span 
                                      className="px-2 py-1 text-sm font-medium rounded-md"
                                      style={{ 
                                        backgroundColor: `#${routeColor}`, 
                                        color: `#${routeTextColor}`
                                      }}
                                    >
                                      {route.route_short_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-sm">-</span>
                                )}
                              </td>
                              <td className="px-3 py-4">
                                <div className="text-xs">
                                  <p className="font-medium text-gray-900">{cancelled.trips?.trip_headsign || '-'}</p>
                                  <p className="text-gray-500">
                                    <span className="mr-2">{direction}</span>
                                    <span className="text-xs text-gray-400">{cancelled.trip_id.substring(0, 6)}...</span>
                                  </p>
                                </div>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap">
                                {cancelled.firstStop && cancelled.lastStop ? (
                                  <div className="text-xs">
                                    <div className="flex items-center mb-1">
                                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                                      <span className="font-medium">{cancelled.firstStop.departure_time?.substring(0, 5)}</span>
                                      <span className="ml-1 text-gray-500 max-w-[100px] truncate">{cancelled.firstStop.stops?.stop_name}</span>
                                    </div>
                                    <div className="flex items-center">
                                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                                      <span className="font-medium">{cancelled.lastStop.arrival_time?.substring(0, 5)}</span>
                                      <span className="ml-1 text-gray-500 max-w-[100px] truncate">{cancelled.lastStop.stops?.stop_name}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-sm">-</span>
                                )}
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap text-sm">
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  {cancelled.reason}
                                </span>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  className="text-green-600 hover:text-green-900"
                                  onClick={() => handleRestoreTrip(cancelled)}
                                  disabled={loading}
                                >
                                  Rétablir
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              
              {/* Voyages retardés */}
              {delayedTrips.length > 0 && (
                <>
                  <h3 className="text-lg font-medium mb-2">Voyages retardés ({delayedTrips.length})</h3>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ligne
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Trajet
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Horaires
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Retard
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedDelayedTrips().map(delayed => {
                          const route = delayed.trips?.routes;
                          const routeColor = route?.route_color || "808080";
                          const routeTextColor = route?.route_text_color || "FFFFFF";
                          const direction = getDirectionName(delayed.trips?.direction_id);
                          
                          return (
                            <tr key={delayed.id}>
                              <td className="px-3 py-4 whitespace-nowrap">
                                {route ? (
                                  <div className="flex items-center">
                                    <span 
                                      className="px-2 py-1 text-sm font-medium rounded-md"
                                      style={{ 
                                        backgroundColor: `#${routeColor}`, 
                                        color: `#${routeTextColor}`
                                      }}
                                    >
                                      {route.route_short_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-sm">-</span>
                                )}
                              </td>
                              <td className="px-3 py-4">
                                <div className="text-xs">
                                  <p className="font-medium text-gray-900">{delayed.trips?.trip_headsign || '-'}</p>
                                  <p className="text-gray-500">
                                    <span className="mr-2">{direction}</span>
                                    <span className="text-xs text-gray-400">{delayed.trip_id.substring(0, 6)}...</span>
                                  </p>
                                </div>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap">
                                {delayed.firstStop && delayed.lastStop ? (
                                  <div className="text-xs">
                                    <div className="flex items-center mb-1">
                                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                                      <span className="font-medium">{delayed.firstStop.departure_time?.substring(0, 5)}</span>
                                      <span className="ml-1 text-gray-500 max-w-[100px] truncate">{delayed.firstStop.stops?.stop_name}</span>
                                    </div>
                                    <div className="flex items-center">
                                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                                      <span className="font-medium">{delayed.lastStop.arrival_time?.substring(0, 5)}</span>
                                      <span className="ml-1 text-gray-500 max-w-[100px] truncate">{delayed.lastStop.stops?.stop_name}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-sm">-</span>
                                )}
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap text-sm">
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                  +{delayed.delay_minutes} min
                                </span>
                                {delayed.reason && (
                                  <span className="block mt-1 text-xs text-gray-500">
                                    {delayed.reason}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  className="text-green-600 hover:text-green-900"
                                  onClick={() => handleRemoveDelay(delayed)}
                                  disabled={loading}
                                >
                                  Supprimer le retard
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              
              {cancelledTrips.length === 0 && delayedTrips.length === 0 && (
                <p className="text-gray-500">
                  Aucun voyage modifié pour cette date.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripCancellation; 