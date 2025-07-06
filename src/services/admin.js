import { supabaseAdmin } from './supabase';

/**
 * Récupère les utilisateurs de la base de données avec pagination, recherche et tri
 * @param {number} page - Numéro de la page (commence à 1)
 * @param {number} perPage - Nombre d'éléments par page
 * @param {string} searchQuery - Terme de recherche (optionnel)
 * @param {string} sortField - Champ de tri (optionnel)
 * @param {boolean} sortAsc - Tri ascendant si true, descendant si false
 * @param {string} genderFilter - Filtre par genre (optionnel)
 * @returns {Promise<{users: Array, total: number, totalByGender: Object}>} - Les utilisateurs et les statistiques
 */
export const getAllUsers = async (page = 1, perPage = 10, searchQuery = '', sortField = 'created_at', sortAsc = false, genderFilter = '') => {
  try {
    let query = supabaseAdmin.from('users').select('*', { count: 'exact' });

    // Ajouter la recherche si un terme est fourni
    if (searchQuery) {
      query = query.or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
    }

    // Ajouter le filtre par genre si spécifié
    if (genderFilter) {
      query = query.eq('gender', genderFilter);
    }

    // Ajouter le tri
    query = query.order(sortField, { ascending: sortAsc });

    // Ajouter la pagination
    const start = (page - 1) * perPage;
    query = query.range(start, start + perPage - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Récupérer les statistiques par genre en une seule requête
    const { data: genderStats, error: statsError } = await supabaseAdmin
      .from('users')
      .select('gender')
      .not('gender', 'is', null);

    if (statsError) {
      throw statsError;
    }

    // Calculer les totaux par genre
    const totalByGender = genderStats.reduce((acc, user) => {
      const gender = user.gender || 'other';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, { male: 0, female: 0, other: 0 });

    // Ajouter le total général
    totalByGender.total = count || 0;

    return {
      users: data || [],
      total: count || 0,
      totalByGender
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Met à jour les informations d'un utilisateur
 */
export const updateUser = async (userId, updates) => {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Supprime un utilisateur et ses données associées
 */
export const deleteUser = async (userId) => {
  try {
    // Supprimer les préférences utilisateur
    await supabaseAdmin
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);
    
    // Supprimer les favoris
    await Promise.all([
      supabaseAdmin.from('favorite_networks').delete().eq('user_id', userId),
      supabaseAdmin.from('favorite_lines').delete().eq('user_id', userId),
      supabaseAdmin.from('favorite_stops').delete().eq('user_id', userId)
    ]);
    
    // Supprimer l'utilisateur
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Récupère la liste des réseaux disponibles
 */
export const getNetworks = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('networks')
      .select('*')
      .order('network_name');
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    // console.error('Erreur lors de la récupération des réseaux:', error);
    throw error;
  }
};

/**
 * Récupère les lignes pour un réseau donné
 */
export const getRoutesByNetwork = async (networkId) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('routes')
      .select('*')
      .eq('network_id', networkId)
      .order('route_short_name');
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    // console.error('Erreur lors de la récupération des lignes:', error);
    throw error;
  }
};

/**
 * Récupère les trips pour une ligne, une direction et une date donnée
 */
export const getTripsByRouteAndDate = async (networkId, routeId, directionId, date) => {
  try {
    // Récupérer d'abord les services valides pour cette date
    const { data: services, error: servicesError } = await supabaseAdmin
      .from('calendar_dates')
      .select('service_id')
      .eq('network_id', networkId)
      .eq('date', date)
      .eq('exception_type', 1);
    
    if (servicesError) throw servicesError;
    
    // Récupérer également les services réguliers
    const dayOfWeek = new Date(date).getDay(); // 0 = Dimanche, 1 = Lundi, etc.
    const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayField = dayFields[dayOfWeek];
    
    const { data: regularServices, error: regularServicesError } = await supabaseAdmin
      .from('calendar')
      .select('service_id')
      .eq('network_id', networkId)
      .lte('start_date', date)
      .gte('end_date', date)
      .eq(dayField, 1); // Vérifier que le service est actif pour ce jour de la semaine
    
    if (regularServicesError) throw regularServicesError;
    
    // Récupérer les services exceptionnellement supprimés
    const { data: removedServices, error: removedServicesError } = await supabaseAdmin
      .from('calendar_dates')
      .select('service_id')
      .eq('network_id', networkId)
      .eq('date', date)
      .eq('exception_type', 2);
      
    if (removedServicesError) throw removedServicesError;
    const removedServiceIds = removedServices.map(s => s.service_id);
    
    // Combiner les services et exclure les services supprimés
    const validServiceIds = [
      ...services.map(s => s.service_id),
      ...regularServices.map(s => s.service_id).filter(id => !removedServiceIds.includes(id))
    ];
    
    if (validServiceIds.length === 0) {
      return [];
    }
    
    // Récupérer les trips
    const { data: trips, error: tripsError } = await supabaseAdmin
      .from('trips')
      .select('*')
      .eq('network_id', networkId)
      .eq('route_id', routeId)
      .eq('direction_id', directionId)
      .in('service_id', validServiceIds);
    
    if (tripsError) throw tripsError;
    
    return trips;
  } catch (error) {
    // console.error('Erreur lors de la récupération des trips:', error);
    throw error;
  }
};

/**
 * Récupère tous les trips pour une date donnée sans filtrer par ligne ou direction
 */
export const getAllTripsByDate = async (networkId, date) => {
  try {
    // Récupérer d'abord les services valides pour cette date
    const { data: services, error: servicesError } = await supabaseAdmin
      .from('calendar_dates')
      .select('service_id')
      .eq('network_id', networkId)
      .eq('date', date)
      .eq('exception_type', 1);
    
    if (servicesError) throw servicesError;
    
    // Récupérer également les services réguliers
    const dayOfWeek = new Date(date).getDay(); // 0 = Dimanche, 1 = Lundi, etc.
    const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayField = dayFields[dayOfWeek];
    
    const { data: regularServices, error: regularServicesError } = await supabaseAdmin
      .from('calendar')
      .select('service_id')
      .eq('network_id', networkId)
      .lte('start_date', date)
      .gte('end_date', date)
      .eq(dayField, 1); // Vérifier que le service est actif pour ce jour de la semaine
    
    if (regularServicesError) throw regularServicesError;
    
    // Récupérer les services exceptionnellement supprimés
    const { data: removedServices, error: removedServicesError } = await supabaseAdmin
      .from('calendar_dates')
      .select('service_id')
      .eq('network_id', networkId)
      .eq('date', date)
      .eq('exception_type', 2);
      
    if (removedServicesError) throw removedServicesError;
    const removedServiceIds = removedServices.map(s => s.service_id);
    
    // Combiner les services et exclure les services supprimés
    const validServiceIds = [
      ...services.map(s => s.service_id),
      ...regularServices.map(s => s.service_id).filter(id => !removedServiceIds.includes(id))
    ];
    
    if (validServiceIds.length === 0) {
      return [];
    }
    
    // Récupérer tous les trips sans filtrer par route ou direction
    const { data: trips, error: tripsError } = await supabaseAdmin
      .from('trips')
      .select('*, routes(route_short_name, route_long_name)')
      .eq('network_id', networkId)
      .in('service_id', validServiceIds);
    
    if (tripsError) throw tripsError;
    
    return trips;
  } catch (error) {
    // console.error('Erreur lors de la récupération des trips:', error);
    throw error;
  }
};

/**
 * Récupère un trip par son ID
 */
export const getTripById = async (networkId, tripId) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('trips')
      .select(`
        *,
        routes (
          route_short_name,
          route_long_name,
          route_color,
          route_text_color
        )
      `)
      .eq('network_id', networkId)
      .eq('trip_id', tripId)
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    // console.error('Erreur lors de la récupération du trip:', error);
    throw error;
  }
};

/**
 * Marque un trip comme supprimé avec la raison fournie
 */
export const markTripAsCancelled = async (networkId, tripId, date, reason) => {
  try {
    const { error } = await supabaseAdmin
      .from('cancelled_trips')
      .insert({
        network_id: networkId,
        trip_id: tripId,
        cancellation_date: date,
        reason: reason
      });
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors du marquage du trip comme supprimé:', error);
    throw error;
  }
};

/**
 * Marque plusieurs trips comme supprimés avec la raison fournie
 */
export const markTripsAsCancelled = async (trips) => {
  try {
    const { error } = await supabaseAdmin
      .from('cancelled_trips')
      .insert(trips);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors du marquage des trips comme supprimés:', error);
    throw error;
  }
};

/**
 * Récupère les trips supprimés pour un réseau et une date donnés
 */
export const getCancelledTrips = async (networkId, date) => {
  try {
    // D'abord, récupérer les voyages annulés
    const { data: cancelledData, error: cancelledError } = await supabaseAdmin
      .from('cancelled_trips')
      .select('*')
      .eq('network_id', networkId)
      .eq('cancellation_date', date);
    
    if (cancelledError) throw cancelledError;
    
    // Ensuite, récupérer les détails des trips correspondants
    if (cancelledData.length > 0) {
      const tripIds = cancelledData.map(ct => ct.trip_id);
      
      const { data: tripsData, error: tripsError } = await supabaseAdmin
        .from('trips')
        .select(`
          trip_id, 
          trip_headsign, 
          direction_id, 
          route_id, 
          routes(
            route_id,
            route_short_name, 
            route_long_name, 
            route_color, 
            route_text_color
          )
        `)
        .eq('network_id', networkId)
        .in('trip_id', tripIds);
      
      if (tripsError) throw tripsError;
      
      // Récupérer les horaires de premier et dernier arrêt
      const tripsWithTimes = await Promise.all(
        tripIds.map(async (tripId) => {
          try {
            // Premier arrêt
            const { data: firstStop } = await supabaseAdmin
              .from('stop_times')
              .select('departure_time, stop_id, stops(stop_name)')
              .eq('trip_id', tripId)
              .eq('network_id', networkId)
              .order('stop_sequence', { ascending: true })
              .limit(1);

            // Dernier arrêt  
            const { data: lastStop } = await supabaseAdmin
              .from('stop_times')
              .select('arrival_time, stop_id, stops(stop_name)')
              .eq('trip_id', tripId)
              .eq('network_id', networkId)
              .order('stop_sequence', { ascending: false })
              .limit(1);

            return {
              tripId,
              firstStop: firstStop?.[0] || null,
              lastStop: lastStop?.[0] || null
            };
          } catch (e) {
            // console.error(`Erreur lors de la récupération des horaires pour ${tripId}:`, e);
            return { tripId, firstStop: null, lastStop: null };
          }
        })
      );
      
      // Associer les données des trips, des routes et des horaires aux voyages annulés
      const enrichedData = cancelledData.map(cancelled => {
        const tripDetails = tripsData.find(t => t.trip_id === cancelled.trip_id) || {};
        const times = tripsWithTimes.find(t => t.tripId === cancelled.trip_id) || {};
        
        return {
          ...cancelled,
          trips: tripDetails,
          firstStop: times.firstStop,
          lastStop: times.lastStop
        };
      });
      
      return enrichedData;
    }
    
    return cancelledData;
  } catch (error) {
    // console.error('Erreur lors de la récupération des trips supprimés:', error);
    throw error;
  }
};

/**
 * Annule la suppression d'un trip
 */
export const unmarkTripAsCancelled = async (id) => {
  try {
    const { error } = await supabaseAdmin
      .from('cancelled_trips')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors de l\'annulation de la suppression du trip:', error);
    throw error;
  }
};

/**
 * Annule la suppression de tous les trips pour un réseau et une date
 */
export const restoreAllCancelledTrips = async (networkId, date) => {
  try {
    const { error } = await supabaseAdmin
      .from('cancelled_trips')
      .delete()
      .eq('network_id', networkId)
      .eq('cancellation_date', date);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors de la restauration de tous les trips:', error);
    throw error;
  }
};

/**
 * Marque un trip comme retardé avec le nombre de minutes
 */
export const markTripAsDelayed = async (networkId, tripId, date, delayMinutes, reason) => {
  try {
    const { error } = await supabaseAdmin
      .from('delayed_trips')
      .insert({
        network_id: networkId,
        trip_id: tripId,
        delay_date: date,
        delay_minutes: delayMinutes,
        reason: reason || 'Retard'
      });
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors du marquage du trip comme retardé:', error);
    throw error;
  }
};

/**
 * Marque plusieurs trips comme retardés
 */
export const markTripsAsDelayed = async (trips) => {
  try {
    const { error } = await supabaseAdmin
      .from('delayed_trips')
      .insert(trips);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors du marquage des trips comme retardés:', error);
    throw error;
  }
};

/**
 * Récupère les trips retardés pour un réseau et une date donnés
 */
export const getDelayedTrips = async (networkId, date) => {
  try {
    // D'abord, récupérer les voyages retardés
    const { data: delayedData, error: delayedError } = await supabaseAdmin
      .from('delayed_trips')
      .select('*')
      .eq('network_id', networkId)
      .eq('delay_date', date);
    
    if (delayedError) throw delayedError;
    
    // Ensuite, récupérer les détails des trips correspondants
    if (delayedData.length > 0) {
      const tripIds = delayedData.map(dt => dt.trip_id);
      
      const { data: tripsData, error: tripsError } = await supabaseAdmin
        .from('trips')
        .select(`
          trip_id, 
          trip_headsign, 
          direction_id, 
          route_id, 
          routes(
            route_id,
            route_short_name, 
            route_long_name, 
            route_color, 
            route_text_color
          )
        `)
        .eq('network_id', networkId)
        .in('trip_id', tripIds);
      
      if (tripsError) throw tripsError;
      
      // Récupérer les horaires de premier et dernier arrêt
      const tripsWithTimes = await Promise.all(
        tripIds.map(async (tripId) => {
          try {
            // Premier arrêt
            const { data: firstStop } = await supabaseAdmin
              .from('stop_times')
              .select('departure_time, stop_id, stops(stop_name)')
              .eq('trip_id', tripId)
              .eq('network_id', networkId)
              .order('stop_sequence', { ascending: true })
              .limit(1);

            // Dernier arrêt  
            const { data: lastStop } = await supabaseAdmin
              .from('stop_times')
              .select('arrival_time, stop_id, stops(stop_name)')
              .eq('trip_id', tripId)
              .eq('network_id', networkId)
              .order('stop_sequence', { ascending: false })
              .limit(1);

            return {
              tripId,
              firstStop: firstStop?.[0] || null,
              lastStop: lastStop?.[0] || null
            };
          } catch (e) {
            // console.error(`Erreur lors de la récupération des horaires pour ${tripId}:`, e);
            return { tripId, firstStop: null, lastStop: null };
          }
        })
      );
      
      // Associer les données des trips, des routes et des horaires aux voyages retardés
      const enrichedData = delayedData.map(delayed => {
        const tripDetails = tripsData.find(t => t.trip_id === delayed.trip_id) || {};
        const times = tripsWithTimes.find(t => t.tripId === delayed.trip_id) || {};
        
        return {
          ...delayed,
          trips: tripDetails,
          firstStop: times.firstStop,
          lastStop: times.lastStop
        };
      });
      
      return enrichedData;
    }
    
    return delayedData;
  } catch (error) {
    // console.error('Erreur lors de la récupération des trips retardés:', error);
    throw error;
  }
};

/**
 * Supprime un retard pour un trip
 */
export const removeDelayForTrip = async (id) => {
  try {
    const { error } = await supabaseAdmin
      .from('delayed_trips')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors de la suppression du retard:', error);
    throw error;
  }
};

/**
 * Supprime tous les retards pour un réseau et une date
 */
export const removeAllDelays = async (networkId, date) => {
  try {
    const { error } = await supabaseAdmin
      .from('delayed_trips')
      .delete()
      .eq('network_id', networkId)
      .eq('delay_date', date);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    // console.error('Erreur lors de la suppression de tous les retards:', error);
    throw error;
  }
};

/**
 * Récupère les arrêts d'une ligne dans une direction donnée
 */
export const getStopsByRouteAndDirection = async (networkId, routeId, directionId) => {
  try {
    // D'abord, récupérer tous les trips sur cette ligne et direction
    const { data: tripsData, error: tripsError } = await supabaseAdmin
      .from('trips')
      .select('trip_id')
      .eq('network_id', networkId)
      .eq('route_id', routeId)
      .eq('direction_id', directionId);
    
    if (tripsError) throw tripsError;
    if (!tripsData || tripsData.length === 0) return [];

    const tripIds = tripsData.map(t => t.trip_id);
    
    // Récupérer les arrêts pour ces trips
    const { data: stopsData, error: stopsError } = await supabaseAdmin
      .from('stop_times')
      .select(`
        stop_id,
        stop_sequence,
        trip_id,
        stops (
          stop_id,
          stop_name,
          stop_lat,
          stop_lon
        )
      `)
      .in('trip_id', tripIds)
      .eq('network_id', networkId);
    
    if (stopsError) throw stopsError;
    if (!stopsData || stopsData.length === 0) return [];
    
    // Trouver le voyage avec le plus d'arrêts pour l'utiliser comme modèle pour l'ordre
    const stopCounts = tripIds.map(id => ({
        trip_id: id,
        count: stopsData.filter(st => st.trip_id === id).length
    }));

    if (stopCounts.length === 0) return [];

    const representativeTripId = stopCounts.sort((a,b) => b.count - a.count)[0].trip_id;

    // Obtenir l'ordre des arrêts de ce voyage de référence
    const representativeOrder = stopsData
        .filter(st => st.trip_id === representativeTripId)
        .sort((a, b) => a.stop_sequence - b.stop_sequence)
        .map(st => st.stop_id);

    // Obtenir tous les arrêts uniques de tous les voyages
    const allStopsMap = new Map();
    stopsData.forEach(stopTime => {
        if(stopTime.stops && !allStopsMap.has(stopTime.stop_id)){
            allStopsMap.set(stopTime.stop_id, stopTime.stops)
        }
    });

    // Trier tous les arrêts uniques selon l'ordre de référence
    const sortedStops = Array.from(allStopsMap.values()).sort((a,b) => {
        const indexA = representativeOrder.indexOf(a.stop_id);
        const indexB = representativeOrder.indexOf(b.stop_id);
        
        if(indexA === -1) return 1;
        if(indexB === -1) return -1;
        return indexA - indexB;
    });

    return sortedStops;
  } catch (error) {
    console.error('Erreur lors de la récupération des arrêts:', error);
    throw error;
  }
};

/**
 * Récupère les shape_id uniques pour une ligne et une direction données.
 */
export const getShapesForRoute = async (networkId, routeId, directionId) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('trips')
      .select('shape_id')
      .eq('network_id', networkId)
      .eq('route_id', routeId)
      .eq('direction_id', directionId);

    if (error) {
      throw error;
    }

    if (!data) {
      return [];
    }

    // Rendre les shape_id uniques et filtrer les valeurs null/vides
    const uniqueShapeIds = [...new Set(data.map(item => item.shape_id).filter(id => id))];
    
    return uniqueShapeIds;
  } catch (error) {
    console.error('Erreur lors de la récupération des tracés:', error);
    throw error;
  }
};

/**
 * Récupère la géométrie (points lat/lon) pour un shape_id donné.
 */
export const getShapeGeometry = async (networkId, shapeId) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('shapes')
      .select('shape_pt_lat, shape_pt_lon')
      .eq('network_id', networkId)
      .eq('shape_id', shapeId)
      .order('shape_pt_sequence', { ascending: true });

    if (error) {
      throw error;
    }

    // Formatter les données pour Mapbox (tableau de [lon, lat])
    return data.map(pt => [pt.shape_pt_lon, pt.shape_pt_lat]);
  } catch (error) {
    console.error('Erreur lors de la récupération de la géométrie du tracé:', error);
    throw error;
  }
};

/**
 * Récupère les horaires de tous les voyages pour une ligne, une direction et une date données.
 */
export const getTripSchedulesForDate = async (networkId, routeId, directionId, date) => {
  try {
    const trips = await getTripsByRouteAndDate(networkId, routeId, directionId, date);

    if (!trips || trips.length === 0) {
      return { schedules: [], stops: [] };
    }

    const tripIds = trips.map(t => t.trip_id);

    const { data: stopTimes, error: stopTimesError } = await supabaseAdmin
      .from('stop_times')
      .select('trip_id, stop_id, departure_time, stop_sequence, stops(stop_name)')
      .in('trip_id', tripIds)
      .eq('network_id', networkId)
      .order('stop_sequence');

    if (stopTimesError) {
      throw stopTimesError;
    }

    const schedules = trips.map(trip => {
      return {
        ...trip,
        stop_times: stopTimes.filter(st => st.trip_id === trip.trip_id),
      };
    }).sort((a, b) => {
      const timeA = a.stop_times[0]?.departure_time || '99:99';
      const timeB = b.stop_times[0]?.departure_time || '99:99';
      return timeA.localeCompare(timeB);
    });

    // Generate unique stops list from all trips for the day
    const allStopsMap = new Map();
    schedules.forEach(schedule => {
      schedule.stop_times.forEach(st => {
        if (st.stops && !allStopsMap.has(st.stop_id)) {
          allStopsMap.set(st.stop_id, {
            stop_id: st.stop_id,
            stop_name: st.stops.stop_name,
            // Use the sequence for sorting
            min_sequence: st.stop_sequence
          });
        } else if (st.stops) {
          const existing = allStopsMap.get(st.stop_id);
          if (st.stop_sequence < existing.min_sequence) {
            existing.min_sequence = st.stop_sequence;
            allStopsMap.set(st.stop_id, existing);
          }
        }
      });
    });

    const uniqueStops = Array.from(allStopsMap.values()).sort((a, b) => a.min_sequence - b.min_sequence);

    return { schedules, stops: uniqueStops };
  } catch (error) {
    console.error('Erreur lors de la récupération des horaires de voyage:', error);
    throw error;
  }
};

/**
 * Récupère tous les arrêts d'une ligne sans filtrer par direction
 */
export const getStopsByRoute = async (networkId, routeId) => {
  try {
    // Récupérer un trip pour chaque direction disponible (0 et 1)
    const { data: tripsData, error: tripsError } = await supabaseAdmin
      .from('trips')
      .select('trip_id, direction_id')
      .eq('network_id', networkId)
      .eq('route_id', routeId)
      .or('direction_id.eq.0,direction_id.eq.1')
      .order('direction_id', { ascending: true });
    
    if (tripsError) throw tripsError;
    if (!tripsData || tripsData.length === 0) return [];
    
    // Obtenir un objet unique des trips par direction
    const tripsByDirection = {};
    tripsData.forEach(trip => {
      if (!tripsByDirection[trip.direction_id]) {
        tripsByDirection[trip.direction_id] = trip.trip_id;
      }
    });
    
    // Récupérer les arrêts pour tous les trips sélectionnés
    let allStops = [];
    for (const tripId of Object.values(tripsByDirection)) {
      const { data: stopsData, error: stopsError } = await supabaseAdmin
        .from('stop_times')
        .select(`
          stop_id,
          stops (
            stop_id,
            stop_name,
            stop_lat,
            stop_lon
          )
        `)
        .eq('trip_id', tripId)
        .eq('network_id', networkId)
        .order('stop_sequence', { ascending: true });
      
      if (stopsError) throw stopsError;
      
      if (stopsData && stopsData.length > 0) {
        allStops = [...allStops, ...stopsData];
      }
    }
    
    // Transformer les données pour extraire les infos des arrêts et éliminer les doublons
    const uniqueStops = [];
    const stopIds = new Set();
    
    allStops.forEach(stopTime => {
      if (stopTime.stops && !stopIds.has(stopTime.stop_id)) {
        stopIds.add(stopTime.stop_id);
        uniqueStops.push({
          stop_id: stopTime.stop_id,
          stop_name: stopTime.stops.stop_name,
          stop_lat: stopTime.stops.stop_lat,
          stop_lon: stopTime.stops.stop_lon
        });
      }
    });
    
    // Trier par nom d'arrêt pour faciliter la recherche
    uniqueStops.sort((a, b) => a.stop_name.localeCompare(b.stop_name));
    
    return uniqueStops;
  } catch (error) {
    // console.error('Erreur lors de la récupération des arrêts:', error);
    throw error;
  }
}; 
