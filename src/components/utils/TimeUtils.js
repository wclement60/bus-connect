/**
 * Fonctions utilitaires pour la manipulation des horaires et des retards
 */

/**
 * Obtient le retard pour un arrêt spécifique
 * @param {string} tripId - ID du trajet
 * @param {string} stopId - ID de l'arrêt
 * @param {Object} delaysData - Données de retards
 * @param {number|null} stopSequence - Séquence de l'arrêt (optionnel)
 * @returns {number} - Le retard en minutes (0 si aucun retard)
 */
export const getStopDelay = (tripId, stopId, delaysData, stopSequence = null) => {
  if (!tripId || !stopId || !delaysData) return 0;
  
  // Si la séquence est fournie, essayer d'abord avec la clé combinée
  if (stopSequence !== null) {
    const combinedKey = `${tripId}-${stopId}-${stopSequence}`;
    if (delaysData[combinedKey] !== undefined) return delaysData[combinedKey];
  }
  
  // Fallback sur la clé simple
  return delaysData[`${tripId}-${stopId}`] || 0;
};

/**
 * Obtient l'heure mise à jour pour un arrêt spécifique
 * @param {string} tripId - ID du trajet
 * @param {string} stopId - ID de l'arrêt
 * @param {Object} updatedTimesData - Données d'horaires mis à jour
 * @param {boolean} isArrival - Si on veut l'heure d'arrivée (sinon départ)
 * @param {number|null} stopSequence - Séquence de l'arrêt (optionnel)
 * @returns {Object|null} - L'heure mise à jour ou null
 */
export const getUpdatedStopTime = (tripId, stopId, updatedTimesData, isArrival = false, stopSequence = null) => {
  if (!tripId || !stopId || !updatedTimesData) return null;
  
  // Si la séquence est fournie, utiliser une clé combinée
  if (stopSequence !== null) {
    const combinedKey = `${tripId}-${stopId}-${stopSequence}`;
    const updatedTimeWithSequence = updatedTimesData[combinedKey];
    
    if (updatedTimeWithSequence) {
      return isArrival ? updatedTimeWithSequence.arrival : updatedTimeWithSequence.departure;
    }
  }
  
  // Fallback à l'ancienne méthode
  const updatedTime = updatedTimesData[`${tripId}-${stopId}`];
  if (!updatedTime) return null;
  
  return isArrival ? updatedTime.arrival : updatedTime.departure;
};

/**
 * Formate un horaire avec les données de retard
 * @param {string} time - Horaire au format "HH:MM:SS"
 * @param {string} tripId - ID du trajet
 * @param {string} stopId - ID de l'arrêt
 * @param {Object} delaysData - Données de retards
 * @param {Object} updatedTimesData - Données d'horaires mis à jour
 * @param {boolean} realtimeEnabled - Si le temps réel est activé
 * @param {Array} cancelledTrips - Liste des trajets annulés
 * @param {Array} manualDelayedTrips - Liste des trajets avec retards manuels
 * @param {Object} skippedStopsData - Données des arrêts supprimés
 * @param {boolean} isFirstStop - Si c'est le premier arrêt
 * @param {boolean} isLastStop - Si c'est le dernier arrêt
 * @param {number|null} stopSequence - Séquence de l'arrêt
 * @param {boolean} isChangingTrip - Si on est en train de changer de trajet
 * @param {Date} selectedDate - Date sélectionnée
 * @returns {Object} - Objet avec les informations d'horaire formaté
 */
export const formatTimeWithDelayInternal = (
  time, 
  tripId, 
  stopId, 
  delaysData, 
  updatedTimesData, 
  realtimeEnabled, 
  cancelledTrips = [], 
  manualDelayedTrips = [], 
  skippedStopsData = {}, 
  isFirstStop = false, 
  isLastStop = false, 
  stopSequence = null, 
  isChangingTrip = false,
  selectedDate = new Date()
) => {
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
  
  // Vérifier si nous sommes sur le jour actuel
  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();
  
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

  // Si AUCUNE donnée temps réel ou retard manuel n'a été trouvée, retourner l'horaire théorique
  if (!dataFoundForKey) {
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
    
  return { 
    original: basicTime, 
    adjusted: adjustedTime, 
    delay: roundedDelay, 
    status,
    displayDelay,
    isRealtime: true, // Toujours vrai pour l'affichage uniforme
    isManualDelay: isManualDelay, // Garder cette info en interne
    reason: isManualDelay && manualDelay ? manualDelay.reason : null // Ajouter la raison du retard
  };
};

/**
 * Vérifie si un horaire est dépassé (dans le passé)
 * @param {string} stopTime - L'horaire à vérifier
 * @param {Date} selectedDate - La date sélectionnée
 * @returns {boolean} - true si l'horaire est dans le passé
 */
export const isTimeInPast = (stopTime, selectedDate = new Date()) => {
  if (!stopTime) return false;
  
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  if (!isToday) return false;
  
  const [hours, minutes] = stopTime.substring(0, 5).split(':').map(Number);
  const stopTimeTotalMinutes = hours * 60 + minutes;
  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
  
  return stopTimeTotalMinutes <= nowTotalMinutes;
};

/**
 * Calcule le temps entre deux arrêts
 * @param {Object} currentStop - L'arrêt actuel avec les horaires
 * @param {Object} nextStop - L'arrêt suivant avec les horaires
 * @returns {number} - Le temps en minutes entre les deux arrêts
 */
export const calculateTimeBetweenStops = (currentStop, nextStop) => {
  if (!currentStop || !nextStop) return 0;
  
  // Utiliser l'heure de départ du premier arrêt
  const departureTime = currentStop.departure_time || currentStop.arrival_time;
  if (!departureTime) return 0;
  
  // Utiliser l'heure d'arrivée du second arrêt
  const arrivalTime = nextStop.arrival_time || nextStop.departure_time;
  if (!arrivalTime) return 0;
  
  // Extraire les heures et minutes
  const [depHours, depMinutes] = departureTime.split(':').map(Number);
  const [arrHours, arrMinutes] = arrivalTime.split(':').map(Number);
  
  // Calculer en minutes
  let depTotalMinutes = depHours * 60 + depMinutes;
  let arrTotalMinutes = arrHours * 60 + arrMinutes;
  
  // Gérer les cas où on passe minuit
  if (arrTotalMinutes < depTotalMinutes) {
    arrTotalMinutes += 24 * 60;
  }
  
  return arrTotalMinutes - depTotalMinutes;
}; 