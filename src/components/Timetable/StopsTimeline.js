import React, { useState, useEffect } from 'react';
import StopTimelineItem from './StopTimelineItem';
import { FaExclamationTriangle, FaBus, FaCaretDown, FaExclamation } from 'react-icons/fa';
import { isColorDark, darkenColor } from '../utils/ColorUtils';

const StopsTimeline = ({
  stopTimes,
  currentTime,
  selectedDate,
  lineInfo,
  formatTimeWithDelay,
  currentTrip,
  stopConnections,
  trafficInfos = [],
  totalStops,
  isChangingTrip = false
}) => {
  // État pour gérer l'animation
  const [shouldAnimate, setShouldAnimate] = useState(false);
  // État pour forcer la mise à jour chaque seconde
  const [currentSecond, setCurrentSecond] = useState(Date.now());
  const currentLineShortName = lineInfo?.route_short_name;

  // Effet pour mettre à jour le temps chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSecond(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fonction pour calculer la progression entre deux arrêts
  const calculateProgress = (currentStop, nextStop, currentTime) => {
    if (!currentStop || !nextStop || !formatTimeWithDelay) return 0;

    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    if (!isToday) return 0;

    // Vérifier si nous sommes dans le segment actif
    const currentStopIndex = stopTimes.indexOf(currentStop);
    const nextStopIndex = stopTimes.indexOf(nextStop);
    
    // Trouver le segment actif en vérifiant la séquence des arrêts
    let activeSegmentIndex = -1;
    for (let i = 0; i < stopTimes.length - 1; i++) {
      const thisStop = stopTimes[i];
      const nextStop = stopTimes[i + 1];
      
      const thisTime = formatTimeWithDelay(
        thisStop.departure_time || thisStop.arrival_time,
        currentTrip?.trip_id,
        thisStop.stop_id,
        i === 0,
        false,
        thisStop.stop_sequence
      );

      const nextTime = formatTimeWithDelay(
        nextStop.departure_time || nextStop.arrival_time,
        currentTrip?.trip_id,
        nextStop.stop_id,
        false,
        i === stopTimes.length - 2,
        nextStop.stop_sequence
      );

      if (!thisTime || !nextTime) continue;

      const thisTimeStr = thisTime.adjusted || thisTime.original;
      const nextTimeStr = nextTime.adjusted || nextTime.original;
      
      const [thisHours, thisMinutes] = thisTimeStr.split(':').map(Number);
      const [nextHours, nextMinutes] = nextTimeStr.split(':').map(Number);
      
      const thisSeconds = (thisHours * 3600) + (thisMinutes * 60);
      let rawNextSeconds = (nextHours * 3600) + (nextMinutes * 60);
      
      let comparisonNextSeconds = rawNextSeconds;
      if (rawNextSeconds < thisSeconds) {
        // Heuristic: Only add 24h if it's a plausible overnight crossing (e.g., late PM to early AM)
        const isLikelyOvernight = (thisHours >= 20 && nextHours <= 5);
        if (isLikelyOvernight) {
          comparisonNextSeconds += 24 * 3600;
        }
        // If it's an anomaly (e.g., 16:51 -> 16:48) and not likely overnight,
        // comparisonNextSeconds remains the raw, earlier time (rawNextSeconds).
        // In this case, comparisonNextSeconds < thisSeconds will hold.
      }

      const currentSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

      if (currentSeconds >= thisSeconds && currentSeconds < comparisonNextSeconds) {
        activeSegmentIndex = i;
        break;
      }
    }

    // N'afficher le bus que sur le segment actif
    if (currentStopIndex !== activeSegmentIndex) {
      return 0;
    }

    const thisStopTime = formatTimeWithDelay(
      currentStop.departure_time || currentStop.arrival_time,
      currentTrip?.trip_id,
      currentStop.stop_id,
      stopTimes[0] === currentStop,
      false,
      currentStop.stop_sequence
    );

    const nextStopTime = formatTimeWithDelay(
      nextStop.departure_time || nextStop.arrival_time,
      currentTrip?.trip_id,
      nextStop.stop_id,
      false,
      stopTimes[stopTimes.length - 1] === nextStop,
      nextStop.stop_sequence
    );

    if (!thisStopTime || !nextStopTime) return 0;

    const thisTime = thisStopTime.adjusted || thisStopTime.original;
    const nextTime = nextStopTime.adjusted || nextStopTime.original;

    const [thisHours, thisMinutes] = thisTime.split(':').map(Number);
    const [nextHours, nextMinutes] = nextTime.split(':').map(Number);
    
    const startSeconds = (thisHours * 3600) + (thisMinutes * 60);
    let endSeconds = (nextHours * 3600) + (nextMinutes * 60);
    
    if (endSeconds < startSeconds) {
      endSeconds += 24 * 3600;
    }

    const currentSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

    if (currentSeconds < startSeconds) {
      return 0;
    }

    if (currentSeconds >= endSeconds) {
      return 100;
    }

    const totalDuration = endSeconds - startSeconds;
    const elapsedTime = currentSeconds - startSeconds;
    const progress = (elapsedTime / totalDuration) * 100;

    return Math.min(100, Math.max(0, progress));
  };

  // Fonction pour déterminer si un horaire est passé (dans le passé)
  const checkIsPastTime = (stopTime) => {
    if (!stopTime || !stopTimes || !Array.isArray(stopTimes) || stopTimes.length === 0) return false;
    
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    if (!isToday) return false;
    
    // Obtenir l'horaire avec le retard éventuel
    let timeToCheck = stopTime;
    const stop = stopTimes.find(s => (s.departure_time === stopTime || s.arrival_time === stopTime));
    
    if (stop && currentTrip) {
      const formattedTime = formatTimeWithDelay(
        stopTime,
        currentTrip.trip_id,
        stop.stop_id,
        stopTimes[0] === stop, // isFirstStop
        stopTimes[stopTimes.length - 1] === stop, // isLastStop
        stop.stop_sequence || stopTimes.indexOf(stop)
      );
      
      // Utiliser l'horaire ajusté si disponible (avec le retard pris en compte)
      if (formattedTime && formattedTime.adjusted) {
        timeToCheck = formattedTime.adjusted;
      }
    }
    
    const [hours, minutes] = timeToCheck.split(':').map(Number);
    const stopTimeTotalMinutes = hours * 60 + minutes;
    const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Un arrêt est considéré comme passé si son heure est inférieure ou égale à l'heure actuelle
    return stopTimeTotalMinutes <= nowTotalMinutes;
  };

  // Calculer la progression générale du voyage (pour la timeline)
  const calculateJourneyProgress = () => {
    if (!stopTimes || !Array.isArray(stopTimes) || stopTimes.length < 2) return 0;
    
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    if (!isToday) return 0;
    
    const currentTimeInSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    // Vérifier si nous sommes avant le premier arrêt
    const firstStop = stopTimes[0];
    if (!firstStop) return 0;
    
    const firstStopTime = firstStop.departure_time || firstStop.arrival_time;
    if (firstStopTime) {
      // Utiliser le temps réel si disponible
      let firstStopTimeToUse = firstStopTime;
      const firstFormattedTime = formatTimeWithDelay(
        firstStopTime,
        currentTrip?.trip_id,
        firstStop.stop_id,
        true,  // isFirstStop
        false, // isLastStop
        firstStop.stop_sequence || 0
      );
      
      if (firstFormattedTime && firstFormattedTime.isRealtime && firstFormattedTime.adjusted) {
        firstStopTimeToUse = firstFormattedTime.adjusted;
      }
      
      const [firstHours, firstMinutes] = firstStopTimeToUse.split(':').map(Number);
      const firstStopTimeInSeconds = firstHours * 3600 + firstMinutes * 60;
      
      if (currentTimeInSeconds < firstStopTimeInSeconds) {
        return 0;
      }
    }
    
    // Vérifier si nous sommes après le dernier arrêt
    const lastStop = stopTimes[stopTimes.length - 1];
    if (!lastStop) return 0;
    
    const lastStopTime = lastStop.arrival_time || lastStop.departure_time;
    if (lastStopTime) {
      // Utiliser le temps réel si disponible
      let lastStopTimeToUse = lastStopTime;
      const lastFormattedTime = formatTimeWithDelay(
        lastStopTime,
        currentTrip?.trip_id,
        lastStop.stop_id,
        false, // isFirstStop
        true,  // isLastStop
        lastStop.stop_sequence || stopTimes.length - 1
      );
      
      if (lastFormattedTime && lastFormattedTime.isRealtime && lastFormattedTime.adjusted) {
        lastStopTimeToUse = lastFormattedTime.adjusted;
      }
      
      const [lastHours, lastMinutes] = lastStopTimeToUse.split(':').map(Number);
      const lastStopTimeInSeconds = lastHours * 3600 + lastMinutes * 60;
      
      if (currentTimeInSeconds > lastStopTimeInSeconds) {
        return 1;
      }
    }
    
    // Trouver entre quels arrêts nous sommes actuellement
    let lastPassedStopIndex = -1;
    let nextStopIndex = -1;
    
    for (let i = 0; i < stopTimes.length; i++) {
      const stop = stopTimes[i];
      const stopTime = stop.departure_time || stop.arrival_time;
      
      if (!stopTime) continue;
      
      // Utiliser le temps réel si disponible
      let stopTimeToUse = stopTime;
      const formattedTime = formatTimeWithDelay(
        stopTime,
        currentTrip?.trip_id,
        stop.stop_id,
        i === 0, // isFirstStop
        i === stopTimes.length - 1, // isLastStop
        stop.stop_sequence || i
      );
      
      if (formattedTime && formattedTime.isRealtime && formattedTime.adjusted) {
        stopTimeToUse = formattedTime.adjusted;
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
    
    // Calculer la progression entre ces deux arrêts
    const lastPassedStop = stopTimes[lastPassedStopIndex];
    const nextStop = stopTimes[nextStopIndex];
    
    const lastPassedStopTime = lastPassedStop.departure_time || lastPassedStop.arrival_time;
    const nextStopTime = nextStop.arrival_time || nextStop.departure_time;
    
    if (!lastPassedStopTime || !nextStopTime) return lastPassedStopIndex / (stopTimes.length - 1);
    
    // Utiliser les temps réels si disponibles
    let lastStopTimeToUse = lastPassedStopTime;
    let nextStopTimeToUse = nextStopTime;
    
    const lastFormattedTime = formatTimeWithDelay(
      lastPassedStopTime,
      currentTrip?.trip_id,
      lastPassedStop.stop_id,
      lastPassedStopIndex === 0,
      false,
      lastPassedStop.stop_sequence || lastPassedStopIndex
    );
    
    const nextFormattedTime = formatTimeWithDelay(
      nextStopTime,
      currentTrip?.trip_id,
      nextStop.stop_id,
      false,
      nextStopIndex === stopTimes.length - 1,
      nextStop.stop_sequence || nextStopIndex
    );
    
    if (lastFormattedTime && lastFormattedTime.isRealtime && lastFormattedTime.adjusted) {
      lastStopTimeToUse = lastFormattedTime.adjusted;
    }
    
    if (nextFormattedTime && nextFormattedTime.isRealtime && nextFormattedTime.adjusted) {
      nextStopTimeToUse = nextFormattedTime.adjusted;
    }
    
    const [lastHours, lastMinutes] = lastStopTimeToUse.split(':').map(Number);
    const [nextHours, nextMinutes] = nextStopTimeToUse.split(':').map(Number);
    
    const lastStopTimeInSeconds = lastHours * 3600 + lastMinutes * 60;
    const nextStopTimeInSeconds = nextHours * 3600 + nextMinutes * 60;
    
    // Si l'heure du prochain arrêt est antérieure à celle du dernier arrêt passé (traversant minuit), ajuster
    const adjustedNextStopTimeInSeconds = nextStopTimeInSeconds < lastStopTimeInSeconds 
      ? nextStopTimeInSeconds + 24 * 3600 
      : nextStopTimeInSeconds;
    
    // Calculer la progression du segment
    const totalSegmentDuration = adjustedNextStopTimeInSeconds - lastStopTimeInSeconds;
    const elapsedInSegment = currentTimeInSeconds - lastStopTimeInSeconds;
    
    // Calculer le pourcentage du segment
    const segmentProgress = Math.min(1, Math.max(0, elapsedInSegment / totalSegmentDuration));
    
    // Calculer la progression de base (pourcentage du trajet terminé jusqu'au dernier arrêt passé)
    const baseProgress = lastPassedStopIndex / (stopTimes.length - 1);
    
    // Calculer la taille du segment (pourcentage du trajet entre le dernier arrêt passé et le prochain arrêt)
    const segmentSize = 1 / (stopTimes.length - 1);
    
    // Retourner la progression totale
    return Math.min(1, baseProgress + segmentProgress * segmentSize);
  };

  // Vérifier si le voyage est annulé
  const isTripCancelled = () => {
    if (!currentTrip || !stopTimes || stopTimes.length === 0) return false;
    
    const firstStop = stopTimes[0];
    if (!firstStop) return false;
    
    const firstStopTime = firstStop.departure_time || firstStop.arrival_time;
    if (!firstStopTime) return false;
    
    const formattedTime = formatTimeWithDelay(
      firstStopTime,
      currentTrip.trip_id,
      firstStop.stop_id,
      true,
      false,
      firstStop.stop_sequence || 0
    );
    
    return formattedTime && formattedTime.isCancelled;
  };
  
  // Vérifier si le voyage est retardé
  const isTripDelayed = () => {
    if (!currentTrip || !stopTimes || stopTimes.length === 0) return false;
    
    const firstStop = stopTimes[0];
    if (!firstStop) return false;
    
    const firstStopTime = firstStop.departure_time || firstStop.arrival_time;
    if (!firstStopTime) return false;
    
    const formattedTime = formatTimeWithDelay(
      firstStopTime,
      currentTrip.trip_id,
      firstStop.stop_id,
      true,
      false,
      firstStop.stop_sequence || 0
    );
    
    return formattedTime && formattedTime.isManualDelay && formattedTime.delay > 0;
  };
  
  // Récupérer les informations sur l'annulation
  const getCancellationInfo = () => {
    if (!isTripCancelled() || !stopTimes || stopTimes.length === 0) return null;
    
    const firstStop = stopTimes[0];
    const lastStop = stopTimes[stopTimes.length - 1];
    
    if (!firstStop || !lastStop) return null;
    
    const firstStopTime = firstStop.departure_time || firstStop.arrival_time;
    const lastStopTime = lastStop.arrival_time || lastStop.departure_time;
    
    if (!firstStopTime || !lastStopTime) return null;
    
    const firstFormattedTime = formatTimeWithDelay(
      firstStopTime,
      currentTrip.trip_id,
      firstStop.stop_id,
      true,
      false,
      firstStop.stop_sequence || 0
    );
    
    if (!firstFormattedTime || !firstFormattedTime.isCancelled) return null;
    
    return {
      departureStop: firstStop.stop_name,
      departureTime: firstFormattedTime.original,
      arrivalStop: lastStop.stop_name,
      arrivalTime: lastStopTime.substring(0, 5),
      reason: firstFormattedTime.cancellationReason
    };
  };

  // Récupérer les informations sur le retard
  const getDelayInfo = () => {
    if (!isTripDelayed() || !stopTimes || stopTimes.length === 0) return null;
    
    const firstStop = stopTimes[0];
    const lastStop = stopTimes[stopTimes.length - 1];
    
    if (!firstStop || !lastStop) return null;
    
    const firstStopTime = firstStop.departure_time || firstStop.arrival_time;
    const lastStopTime = lastStop.arrival_time || lastStop.departure_time;
    
    if (!firstStopTime || !lastStopTime) return null;
    
    const firstFormattedTime = formatTimeWithDelay(
      firstStopTime,
      currentTrip.trip_id,
      firstStop.stop_id,
      true,
      false,
      firstStop.stop_sequence || 0
    );
    
    if (!firstFormattedTime || !firstFormattedTime.isManualDelay || firstFormattedTime.delay <= 0) return null;
    
    return {
      departureStop: firstStop.stop_name,
      departureTime: firstFormattedTime.original,
      departureAdjusted: firstFormattedTime.adjusted,
      arrivalStop: lastStop.stop_name,
      arrivalTime: lastStopTime.substring(0, 5),
      delay: firstFormattedTime.delay,
      displayDelay: firstFormattedTime.displayDelay,
      reason: firstFormattedTime.reason
    };
  };

  // Obtenir les infos trafic qui ne sont pas spécifiques à un arrêt
  const generalTrafficInfo = trafficInfos.find(info => !info.stop_id);
  
  // Fonction pour obtenir l'info trafic pour un arrêt spécifique
  const getStopTrafficInfo = (stopId) => {
    if (!trafficInfos || !trafficInfos.length) return null;
    return trafficInfos.find(info => info.stop_id === stopId) || null;
  };

  const journeyProgress = calculateJourneyProgress();
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const tripCancelled = isTripCancelled();
  const cancellationInfo = getCancellationInfo();
  const tripDelayed = isTripDelayed();
  const delayInfo = getDelayInfo();
  
  // Vérifier si le bus doit être affiché
  const shouldShowBus = isToday && 
    !tripCancelled && 
    journeyProgress > 0 && 
    journeyProgress < 1 && 
    stopTimes.some(stop => {
      const stopTime = stop.departure_time || stop.arrival_time;
      if (!stopTime || !currentTrip) return false;
      
      const formattedTime = formatTimeWithDelay(
        stopTime,
        currentTrip.trip_id,
        stop.stop_id,
        stopTimes[0] === stop,
        stopTimes[stopTimes.length - 1] === stop,
        stop.stop_sequence || stopTimes.indexOf(stop)
      );
      
      return formattedTime && formattedTime.isRealtime;
    });

  // Déclencher l'animation quand shouldShowBus change
  useEffect(() => {
    setShouldAnimate(true);
    const timer = setTimeout(() => setShouldAnimate(false), 1000);
    return () => clearTimeout(timer);
  }, [shouldShowBus]);

  // Style pour l'animation du bus
  const busStyle = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10
  };

  return (
    <div className="bg-[#F6F6F6] rounded-lg p-6">
      {/* Style pour l'animation pulse */}
      <style>
        {`
          @keyframes pulse-in {
            0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
            70% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          }
          @keyframes pulse-out {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            30% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
            100% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          }
          @keyframes arrow-pulse-in {
            0% { transform: translateX(-50%) scale(0.3); opacity: 0; }
            70% { transform: translateX(-50%) scale(1.1); opacity: 0.9; }
            100% { transform: translateX(-50%) scale(1); opacity: 1; }
          }
          @keyframes arrow-pulse-out {
            0% { transform: translateX(-50%) scale(1); opacity: 1; }
            30% { transform: translateX(-50%) scale(1.1); opacity: 0.9; }
            100% { transform: translateX(-50%) scale(0.3); opacity: 0; }
          }
          .pulse-in {
            animation: pulse-in 1s ease-out forwards;
          }
          .pulse-out {
            animation: pulse-out 1s ease-in forwards;
          }
          .arrow-pulse-in {
            animation: arrow-pulse-in 1s ease-out forwards;
            transform: translateX(-50%);
          }
          .arrow-pulse-out {
            animation: arrow-pulse-out 1s ease-in forwards;
            transform: translateX(-50%);
          }
        `}
      </style>

      <div className="mt-[10px]">
        {/* Alerte d'annulation */}
        {cancellationInfo && (
          <div className="mb-6 overflow-hidden rounded-lg shadow-md">
            <div className="px-4 py-2 flex items-center" style={{background: '#cd1600'}}>
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Voyage supprimé</h3>
              </div>
            </div>
            <div className="bg-white border-t-2 border-[#cd1600] px-4 py-3">
              <div className="flex">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#cd1600]"></div>
                    <p className="text-sm font-medium text-gray-900">{cancellationInfo.departureStop}</p>
                    <p className="text-sm font-bold text-gray-800">{cancellationInfo.departureTime}</p>
                  </div>
                  <div className="pl-4 ml-[3px] border-l-2 border-dashed border-[#cd1600]/60 py-2">
                    <div className="text-xs text-[#cd1600] font-medium px-2 py-1 bg-red-50 rounded-md inline-block">
                      {cancellationInfo.reason}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-[#cd1600]"></div>
                    <p className="text-sm font-medium text-gray-900">{cancellationInfo.arrivalStop}</p>
                    <p className="text-sm font-bold text-gray-800">{cancellationInfo.arrivalTime}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerte de retard */}
        {delayInfo && !cancellationInfo && (
          <div className="mb-6 overflow-hidden rounded-lg shadow-md">
            <div className="px-4 py-2 flex items-center" style={{background: '#f97316'}}>
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Voyage retardé ({delayInfo.displayDelay})</h3>
              </div>
            </div>
            <div className="bg-white border-t-2 border-[#f97316] px-4 py-3">
              <div className="flex">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#f97316]"></div>
                    <p className="text-sm font-medium text-gray-900">{delayInfo.departureStop}</p>
                    <p className="text-sm font-bold text-gray-800 line-through">{delayInfo.departureTime}</p>
                    <p className="text-sm font-bold text-[#f97316]">{delayInfo.departureAdjusted}</p>
                  </div>
                  <div className="pl-4 ml-[3px] border-l-2 border-dashed border-[#f97316]/60 py-2">
                    <div className="text-xs text-[#f97316] font-medium px-2 py-1 bg-orange-50 rounded-md inline-block">
                      {delayInfo.reason || "Retard"}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-[#f97316]"></div>
                    <p className="text-sm font-medium text-gray-900">{delayInfo.arrivalStop}</p>
                    <p className="text-sm font-bold text-gray-800">{delayInfo.arrivalTime}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Alerte d'information trafic générale */}
        {generalTrafficInfo && !cancellationInfo && (
          <div className="mb-6 overflow-hidden rounded-lg shadow-md">
            <div className="px-4 py-2 flex items-center" style={{
              background: generalTrafficInfo.type === 'Travaux' ? '#EAB308' : 
                         generalTrafficInfo.type === 'Arrêt non desservi' ? '#EF4444' : 
                         '#3B82F6'
            }}>
              <div className="flex-shrink-0">
                <FaExclamationTriangle className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
                  {generalTrafficInfo.type}
                </h3>
              </div>
            </div>
            <div className="bg-white border-t-2 px-4 py-3" style={{
              borderColor: generalTrafficInfo.type === 'Travaux' ? '#EAB308' : 
                           generalTrafficInfo.type === 'Arrêt non desservi' ? '#EF4444' : 
                           '#3B82F6'
            }}>
              <div className="text-sm">
                <p className="font-medium mb-1">{generalTrafficInfo.message}</p>
                <p className="text-xs text-gray-500">
                  Valable du {new Date(generalTrafficInfo.start_date).toLocaleDateString()} au {new Date(generalTrafficInfo.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="relative">
          {/* Liste des arrêts avec la nouvelle timeline */}
          <div className="space-y-6">
            {stopTimes.map((stop, index) => {
              const stopTime = stop.departure_time || stop.arrival_time;
              const isPastTime = checkIsPastTime(stopTime);
              const isFirstStop = index === 0;
              const isLastStop = index === stopTimes.length - 1;
              const trafficInfo = getStopTrafficInfo(stop.stop_id);

              let filteredAndSortedConnections = [];
              const allConnectionsForStop = stopConnections && stopConnections[stop.stop_id];

              if (allConnectionsForStop && allConnectionsForStop.length > 0) {
                let connectionsToProcess = [...allConnectionsForStop]; // Work on a copy

                // Filter out the current line if its short name is known
                if (currentLineShortName) {
                  connectionsToProcess = connectionsToProcess.filter(
                    route => route.route_short_name !== currentLineShortName
                  );
                }

                // Sort the connections alphanumerically
                connectionsToProcess.sort((a, b) => {
                  const nameA = a.route_short_name || '';
                  const nameB = b.route_short_name || '';
                  // Using 'fr' locale for French-specific sorting, and numeric: true for handling numbers in strings.
                  return nameA.localeCompare(nameB, 'fr', { numeric: true, sensitivity: 'base' });
                });
                filteredAndSortedConnections = connectionsToProcess;
              }

              return (
                <div key={`${stop.stop_id}-${index}`} className="relative min-h-[3.5rem] flex -mt-1">
                  {/* Colonne des horaires */}
                  <div className="w-[4.5rem] pr-4 flex justify-end items-center relative" style={{ 
                    height: isFirstStop || isLastStop ? '20px' : '12px',
                    marginTop: isFirstStop ? '0' : '4px'
                  }}>
                    {formatTimeWithDelay ? (
                      (() => {
                        const formattedTime = formatTimeWithDelay(
                          stopTime,
                          currentTrip?.trip_id,
                          stop.stop_id,
                          isFirstStop,
                          isLastStop,
                          stop.stop_sequence || index
                        );

                        if (!formattedTime) return (
                          <div className="flex items-center">
                            <div className="text-base font-medium text-gray-900">
                              {stopTime}
                            </div>
                          </div>
                        );

                        return (
                          <div className="flex items-center">
                            <div className={`
                              px-2 rounded-lg tabular-nums whitespace-nowrap
                              ${(isFirstStop || isLastStop) ? 'font-bold' : 'font-medium'}
                              ${!stopTime ? 'text-[#999999]' :
                                formattedTime.isCancelled || formattedTime.isSkipped ? 'text-red-600 opacity-75 text-sm' :
                                isPastTime ? 'text-[#666666] text-sm' : 
                                formattedTime.isRealtime ? (
                                  formattedTime.delay > 0 ? 'text-red-600 text-sm' :
                                  formattedTime.delay < 0 ? 'text-orange-600 text-sm' :
                                  'text-green-600 text-base'
                                ) :
                                'text-[#1A1A1A] text-base'
                              }
                            `}>
                              <div>
                                {stopTime ? (
                                  formattedTime.isCancelled || formattedTime.isSkipped ? (
                                    <span className="line-through">{formattedTime.original}</span>
                                  ) : formattedTime.status === 'normal' ? 
                                    formattedTime.original
                                  : formattedTime.status !== 'normal' && formattedTime.original !== formattedTime.adjusted ? (
                                    <div className="flex flex-col text-sm">
                                      <span className="line-through text-gray-400 text-[11px] leading-tight">{formattedTime.original}</span>
                                      <span>{formattedTime.adjusted}</span>
                                    </div>
                                  ) : formattedTime.adjusted
                                ) : "-"}
                              </div>
                              
                              {!formattedTime.isCancelled && !formattedTime.isSkipped && formattedTime.displayDelay && (
                                <div className={`
                                  mt-1 text-[11px] leading-tight px-1.5 py-0.5 rounded-full
                                  ${formattedTime.delay > 0 ? 'bg-red-50 text-red-600' :
                                    formattedTime.delay < 0 ? 'bg-orange-50 text-orange-600' :
                                    'bg-green-50 text-green-600'
                                  }
                                `}>
                                  {formattedTime.displayDelay}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex items-center">
                        <div className="text-base font-medium text-gray-900">
                          {stopTime}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Colonne de la timeline */}
                  <div className="flex flex-col items-center relative" style={{ width: "24px" }}>
                    {/* Trait de connexion (sauf pour le dernier point) */}
                    {!isLastStop && (
                      <div className="absolute" style={{ 
                        top: isFirstStop ? '20px' : '12px',
                        bottom: '-28px',
                        width: '4px',
                        zIndex: 1
                      }}>
                        {/* Trait de base (gris clair) */}
                        <div 
                          className="absolute w-full h-full opacity-20"
                          style={{
                            backgroundColor: `#${darkenColor(lineInfo?.route_color || 'FF0000')}`
                          }}
                        />

                        {/* Trait de progression */}
                        {isToday && !tripCancelled && (
                          <>
                            {/* Trait pour les segments passés */}
                            {checkIsPastTime(stop.departure_time || stop.arrival_time) && 
                             checkIsPastTime(stopTimes[index + 1].departure_time || stopTimes[index + 1].arrival_time) && (
                              <div 
                                className="absolute w-full h-full"
                                style={{ 
                                  backgroundColor: `#${darkenColor(lineInfo?.route_color || 'FF0000')}`
                                }}
                              />
                            )}
                            
                            {/* Trait de progression pour le segment actif */}
                            {(!checkIsPastTime(stopTimes[index + 1].departure_time || stopTimes[index + 1].arrival_time) ||
                              calculateProgress(stop, stopTimes[index + 1], currentSecond) < 100) && (
                              <div 
                                className="absolute w-full"
                                style={{ 
                                  backgroundColor: `#${darkenColor(lineInfo?.route_color || 'FF0000')}`,
                                  height: `${Math.min(calculateProgress(stop, stopTimes[index + 1], currentSecond), 100)}%`,
                                  transition: 'height 0.95s linear',
                                  transform: 'translateY(-16px)'
                                }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Point d'arrêt */}
                    {(() => {
                      const formattedTime = formatTimeWithDelay ? formatTimeWithDelay(
                        stopTime,
                        currentTrip?.trip_id,
                        stop.stop_id,
                        isFirstStop,
                        isLastStop,
                        stop.stop_sequence || index
                      ) : null;

                      return formattedTime?.isSkipped ? (
                        <div 
                          className={`
                            bg-red-600 rounded-full flex items-center justify-center relative shadow-md
                            ${isFirstStop || isLastStop ? 'w-5 h-5' : 'w-3 h-3'}
                          `}
                          style={{ 
                            zIndex: 2
                          }}
                        >
                          <FaExclamation 
                            className="text-white"
                            style={{
                              width: isFirstStop || isLastStop ? '10px' : '6px',
                              height: isFirstStop || isLastStop ? '10px' : '6px'
                            }}
                          />
                        </div>
                      ) : (
                        <div 
                          className={`
                            rounded-full relative bg-white
                            ${isFirstStop || isLastStop ? 'w-5 h-5 border-4' : 'w-3 h-3 border-2'}
                          `}
                          style={{ 
                            borderColor: `#${darkenColor(lineInfo?.route_color || 'FF0000')}`,
                            zIndex: 2
                          }}
                        />
                      );
                    })()}

                    {/* Icône du bus */}
                    {shouldShowBus && calculateProgress(stop, stopTimes[index + 1], currentSecond) > 0 && calculateProgress(stop, stopTimes[index + 1], currentSecond) < 100 && (
                      <div 
                        className={`absolute ${shouldAnimate ? 'pulse-in' : ''}`}
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: `${calculateProgress(stop, stopTimes[index + 1], currentSecond)}%`,
                          transform: 'translate(-50%, -50%)',
                          transition: 'top 0.95s linear',
                          zIndex: 50,
                          pointerEvents: 'none'
                        }}
                      >
                        <div 
                          className="rounded-full flex items-center justify-center relative"
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: `#${darkenColor(lineInfo?.route_color || 'FF0000')}`
                          }}
                        >
                          <FaBus className="text-white" size={14} />
                          <div 
                            className="absolute -bottom-3"
                            style={{
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 51
                            }}
                          >
                            <FaCaretDown 
                              size={26}
                              style={{
                                color: `#${darkenColor(lineInfo?.route_color || 'FF0000')}`
                              }}
                            />
                            
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Colonne du nom d'arrêt et des infos */}
                  <div className={`ml-6 flex-1 -mt-1 ${isPastTime ? 'opacity-50' : ''}`}>
                    {formatTimeWithDelay ? (
                      (() => {
                        const formattedTime = formatTimeWithDelay(
                          stopTime,
                          currentTrip?.trip_id,
                          stop.stop_id,
                          isFirstStop,
                          isLastStop,
                          stop.stop_sequence || index
                        );

                        return (
                          <div className={`
                            transition-all duration-200 rounded-lg px-3 py-2
                            ${!stopTime ? 'bg-[#F6F6F6]/60' :
                              formattedTime?.isCancelled || formattedTime?.isSkipped ? 'bg-red-50/60 opacity-80' :
                              isPastTime ? 'bg-[#F6F6F6]/60' : 
                              formattedTime?.isRealtime ? (
                                formattedTime.delay > 0 ? 'bg-red-50/60' :
                                formattedTime.delay < 0 ? 'bg-orange-50/60' :
                                'bg-green-50/60'
                              ) :
                              'bg-white/60 shadow-sm'
                            }
                            ${trafficInfo ? (
                              trafficInfo.type === 'Travaux' ? 'border-l-4 border-yellow-400' :
                              trafficInfo.type === 'Arrêt non desservi' ? 'border-l-4 border-red-500' :
                              'border-l-4 border-blue-400'
                            ) : formattedTime?.isSkipped ? 'border-l-4 border-red-500' : ''}
                          `}>
                            <div className="text-sm flex flex-col">
                              <span className={`font-medium ${isFirstStop || isLastStop ? 'font-bold' : ''}`}>
                                {stop.stop_name}
                              </span>
                              {stop.city && (
                                <span className="text-xs text-gray-500 mt-0.5">
                                  {stop.city}
                                </span>
                              )}
                            </div>
                            
                            {/* Correspondances */}
                            {filteredAndSortedConnections.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {filteredAndSortedConnections.map((route) => (
                                  <span
                                    key={route.route_id}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{
                                      backgroundColor: `#${darkenColor(route.route_color || '000000')}15`,
                                      color: `#${darkenColor(route.route_color || '000000')}`
                                    }}
                                  >
                                    {route.route_short_name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Info trafic pour l'arrêt */}
                            {trafficInfo && (
                              <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded">
                                <span className="font-medium">{trafficInfo.type}: </span>
                                {trafficInfo.message}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className={`
                        transition-all duration-200 rounded-lg px-3 py-2
                        ${!stopTime ? 'bg-[#F6F6F6]/60' :
                          isPastTime ? 'bg-[#F6F6F6]/60' : 
                          'bg-white/60 shadow-sm'
                        }
                        ${trafficInfo ? (
                          trafficInfo.type === 'Travaux' ? 'border-l-4 border-yellow-400' :
                          trafficInfo.type === 'Arrêt non desservi' ? 'border-l-4 border-red-500' :
                          'border-l-4 border-blue-400'
                        ) : ''}
                      `}>
                        <div className="text-sm flex flex-col">
                          <span className={`font-medium ${isFirstStop || isLastStop ? 'font-bold' : ''}`}>
                            {stop.stop_name}
                          </span>
                          {stop.city && (
                            <span className="text-xs text-gray-500 mt-0.5">
                              {stop.city}
                            </span>
                          )}
                        </div>
                        
                        {/* Correspondances */}
                        {filteredAndSortedConnections.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {filteredAndSortedConnections.map((route) => (
                              <span
                                key={route.route_id}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: `#${darkenColor(route.route_color || '000000')}15`,
                                  color: `#${darkenColor(route.route_color || '000000')}`
                                }}
                              >
                                {route.route_short_name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Info trafic pour l'arrêt */}
                        {trafficInfo && (
                          <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded">
                            <span className="font-medium">{trafficInfo.type}: </span>
                            {trafficInfo.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopsTimeline; 