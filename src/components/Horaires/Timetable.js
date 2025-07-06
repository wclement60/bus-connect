import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaBus, FaBroadcastTower, FaExclamation } from 'react-icons/fa';
import { darkenColor } from './utils';

// Composant pour le bandeau de destination
const DestinationBanner = ({ destination, lineInfo, stopTimes }) => {
  const [currentText, setCurrentText] = useState('line');
  const timeoutRef = useRef(null);

  useEffect(() => {
    const sequence = ['line', 'destination', 'terminus', 'arrival'];
    let currentIndex = 0;

    const rotate = () => {
      currentIndex = (currentIndex + 1) % sequence.length;
      setCurrentText(sequence[currentIndex]);
    };

    // Ajuster l'intervalle pour correspondre à la durée de chaque état
    const intervals = {
      line: 3000,        // 3 secondes pour "LIGNE X"
      destination: 3000, // 3 secondes pour "DESTINATION"
      terminus: 3000,    // 3 secondes pour le terminus
      arrival: 11000      // 8 secondes pour le défilement
    };

    const rotateWithDelay = () => {
      const currentState = sequence[currentIndex];
      const delay = intervals[currentState];
      
      timeoutRef.current = setTimeout(() => {
        rotate();
        rotateWithDelay();
      }, delay);
    };

    rotateWithDelay();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Calculer le temps restant et l'heure d'arrivée
  const getArrivalInfo = () => {
    if (!stopTimes || stopTimes.length === 0) return { time: '--:--', minutes: '--' };

    const lastStop = stopTimes[stopTimes.length - 1];
    const arrivalTime = lastStop.realtime_departure_time || lastStop.departure_time;
    
    // Calculer le temps restant
    const now = new Date();
    const [hours, minutes] = arrivalTime.split(':').map(Number);
    const arrival = new Date();
    arrival.setHours(hours);
    arrival.setMinutes(minutes);
    arrival.setSeconds(0);
    
    const diffMinutes = Math.round((arrival - now) / (1000 * 60));
    
    return {
      time: arrivalTime,
      minutes: diffMinutes > 0 ? diffMinutes : '--'
    };
  };

  const arrivalInfo = getArrivalInfo();

  // Utiliser la couleur de la ligne et sa version sombre
  const routeColor = lineInfo?.route_color || '3b82f6';
  const backgroundColor = `#${routeColor}`;
  const darkerBackground = `#${darkenColor(routeColor)}`;
  const textColor = lineInfo?.route_text_color ? `#${lineInfo.route_text_color}` : '#FFFFFF';

  return (
    <div className="w-full max-w-2xl mx-auto" style={{ marginTop: '-15px', marginBottom: '20px'}}>

      <style jsx="true">{`
        @keyframes lineEnter {
          0% { 
            transform: translateY(-100%);
            opacity: 0;
          }
          100% { 
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          10%, 90% { opacity: 1; }
        }

        @keyframes terminusEnter {
          0% {
            transform: scale(1.5);
            opacity: 0;
            filter: blur(4px);
          }
          100% {
            transform: scale(1);
            opacity: 1;
            filter: blur(0);
          }
        }

        @keyframes terminusPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(0.95);
            opacity: 0.8;
          }
        }

        .banner-container {
          background-color: ${darkerBackground};
          position: relative;
          height: 32px;
          display: flex;
          align-items: center;
          padding: 5px 0;
          overflow: hidden;
        }

        .banner-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            45deg, 
            rgba(255, 255, 255, 0.1) 0%, 
            rgba(255, 255, 255, 0) 100%
          );
          z-index: 1;
        }

        .text-container {
          position: relative;
          z-index: 2;
          color: ${textColor};
          width: 100%;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .static-text {
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          animation: lineEnter 0.5s ease-out forwards;
        }

        .destination-text {
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          opacity: 0;
          animation: fadeInOut 3s ease-in-out;
          animation-fill-mode: forwards;
        }

        .terminus-text {
          animation: terminusEnter 0.5s ease-out forwards,
                     terminusPulse 2s ease-in-out infinite 0.5s;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .arrival-text {
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          white-space: nowrap;
          position: absolute;
          transform: translateX(150%);
          animation: slideText 11s linear;
        }

        @keyframes slideText {
          0% {
            transform: translateX(150%);
          }
          100% {
            transform: translateX(-200%);
          }
        }

        .fade-left, .fade-right {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 60px;
          z-index: 3;
        }

        .fade-left {
          left: 0;
          background: linear-gradient(
            to right,
            ${darkerBackground} 0%,
            transparent 100%
          );
        }

        .fade-right {
          right: 0;
          background: linear-gradient(
            to left,
            ${darkerBackground} 0%,
            transparent 100%
          );
        }
      `}</style>
      <div className="banner-container">
        <div className="fade-left"></div>
        <div className="text-container">
          {currentText === 'line' && (
            <div className="static-text">
              LIGNE {lineInfo?.route_short_name || ''}
            </div>
          )}
          {currentText === 'destination' && (
            <div className="destination-text">
              DESTINATION
            </div>
          )}
          {currentText === 'terminus' && (
            <div className="terminus-text">
              {destination}
            </div>
          )}
          {currentText === 'arrival' && (
            <div className="arrival-text">
              Arrivée à {destination} dans {arrivalInfo.minutes !== '--' ? `${arrivalInfo.minutes} min` : '--'}
            </div>
          )}
        </div>
        <div className="fade-right"></div>
      </div>
    </div>
  );
};

const WarningBanner = ({ text, icon }) => {
  return (
    <div className="w-full max-w-2xl mx-auto" style={{ marginTop: '-15px', marginBottom: '20px'}}>
      <style jsx="true">{`
        .warning-banner-container {
          background-color: #f97316; /* Orange-500 */
          color: white;
          height: 32px;
          display: flex;
          align-items: center;
          padding: 0;
          overflow: hidden;
          border-radius: 4px;
        }
        .icon-container {
          padding: 0 12px;
          height: 100%;
          display: flex;
          align-items: center;
          background-color: #ea580c; /* Darker Orange-600 */
          z-index: 2;
        }
        @keyframes pulseIcon {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
        }
        .warning-icon {
          animation: pulseIcon 2.5s ease-in-out infinite;
        }
        .text-scroll-container {
          flex: 1;
          position: relative;
          height: 100%;
          overflow: hidden;
        }
        .scrolling-text-wrapper {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            display: flex;
            align-items: center;
            white-space: nowrap;
            animation: scrollLeft 15s linear infinite;
            font-weight: 500;
        }
        .scrolling-text-wrapper > span {
            padding: 0 1.5rem; /* space between duplicated text */
        }
        @keyframes scrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="warning-banner-container">
        <div className="icon-container">
          {React.cloneElement(icon, {
            className: 'warning-icon'
          })}
        </div>
        <div className="text-scroll-container">
          <div className="scrolling-text-wrapper">
             <span>{text}</span>
             <span>{text}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Timetable = ({ 
  networkId,
  stopTimes, 
  stopConnections, 
  lineInfo,
  isChangingTrip,
  isRealtime,
  currentDate,
  vehicle,
  connectionsLoading = false,
  isManuallyCancelled = false,
  cancellationReason = null,
  isManuallyDelayed = false,
  delayInfo = null
}) => {
  const [showConnected, setShowConnected] = useState(false);
  
  const tripIdentifier = stopTimes.map(stop => stop.stop_id).join('-');
  const firstStop = stopTimes.length > 0 ? stopTimes[0] : null;
  const lastStop = stopTimes.length > 0 ? stopTimes[stopTimes.length - 1] : null;

  useEffect(() => {
    if (vehicle) {
      // Vérifier s'il y a des données modèle/marque
      const hasVehicleData = (vehicle.brand && vehicle.model) || 
                           (vehicle.label && vehicle.label.split(' ').length >= 2);
      
      if (hasVehicleData) {
        // Si on a des données, on alterne
        const interval = setInterval(() => {
          setShowConnected(prev => !prev);
        }, 3000);
        
        return () => clearInterval(interval);
      } else {
        // Si pas de données, on reste sur "Véhicule connecté"
        setShowConnected(true);
      }
    }
  }, [vehicle]);

  const isToday = () => {
    if (!currentDate) return false;
    
    const today = new Date();
    return currentDate.getDate() === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  // Vérifie si la date sélectionnée est dans le passé
  const isPastDate = () => {
    if (!currentDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Réinitialiser l'heure pour comparer uniquement les dates
    const selectedDate = new Date(currentDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    return selectedDate < today;
  };

  if (!stopTimes.length || stopTimes.every(stop => stop.departure_time === '??:??')) {
    return null;
  }
  
  const showRealtimeElements = isRealtime && isToday();
  const hasRealtimeData = stopTimes.some(stop => stop.realtime_departure_time);
  const shouldShowWarning = isToday() && hasRealtimeData && !vehicle;

  return (
    <div className={`bg-[#F6F6F6] dark:bg-gray-800 rounded-lg p-4 md:p-6 timetable-content ${isChangingTrip ? 'changing' : ''}`} style={{ maxWidth: '800px', margin: '0 auto' }}>
      {isManuallyCancelled && firstStop && lastStop && (
        <div className="mb-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm p-4 relative" style={{ border: '1px solid rgba(239, 68, 68, 0.5)' }}>
          {cancellationReason && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {cancellationReason}
              </span>
            </div>
          )}
          
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mr-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
            </div>
            <h3 className="text-gray-800 dark:text-gray-200 font-medium">Trajet annulé</h3>
          </div>
          
          <div className="flex items-center mt-4 pl-2">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}` }}></div>
              <div className="h-16 w-0.5 my-1" style={{ backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}20` }}></div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}` }}></div>
            </div>
            
            <div className="ml-4 flex-1">
              <div className="mb-4">
                <div className="font-medium text-gray-800 dark:text-gray-200">{firstStop.stop_name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{firstStop.departure_time}</div>
              </div>
              
              <div className="mt-8">
                <div className="font-medium text-gray-800 dark:text-gray-200">{lastStop.stop_name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{lastStop.departure_time}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isManuallyDelayed && firstStop && lastStop && !isManuallyCancelled && (
        <div className="mb-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm p-4 relative" style={{ border: '1px solid rgba(234, 88, 12, 0.5)' }}>
          {delayInfo?.reason && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                {delayInfo.reason}
              </span>
            </div>
          )}
          
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center mr-2">
              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
              </svg>
            </div>
            <h3 className="text-gray-800 dark:text-gray-200 font-medium">
              Trajet retardé 
              <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                +{delayInfo?.delay || 0} min
              </span>
            </h3>
          </div>
          
          <div className="flex items-center mt-4 pl-2">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}` }}></div>
              <div className="h-16 w-0.5 my-1" style={{ backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}20` }}></div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}` }}></div>
            </div>
            
            <div className="ml-4 flex-1">
              <div className="mb-4">
                <div className="font-medium text-gray-800 dark:text-gray-200">{firstStop.stop_name}</div>
                <div className="flex items-center">
                  <div className="text-sm font-medium text-orange-600">{firstStop.realtime_departure_time}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 line-through ml-2">{firstStop.departure_time}</div>
                </div>
              </div>
              
              <div className="mt-8">
                <div className="font-medium text-gray-800 dark:text-gray-200">{lastStop.stop_name}</div>
                <div className="flex items-center">
                  <div className="text-sm font-medium text-orange-600">{lastStop.realtime_departure_time}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 line-through ml-2">{lastStop.departure_time}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRealtimeElements && !isManuallyCancelled && !isManuallyDelayed && (
        <div className="mb-6 text-center">
            <div className={`inline-flex items-center justify-center text-gray-800 dark:text-gray-200 p-2 px-4 rounded-full bg-white/80 dark:bg-gray-700/80 shadow-sm w-full max-w-md relative ${vehicle ? 'vehicle-connected-border' : ''}`}>
              <style>
                {`
                  @keyframes borderPulse {
                    0% { border-color: rgba(34, 197, 94, 0.2); }
                    50% { border-color: rgba(34, 197, 94, 0.6); }
                    100% { border-color: rgba(34, 197, 94, 0.2); }
                  }
                  .vehicle-connected-border {
                    border: 2px solid rgba(34, 197, 94, 0.4);
                    animation: borderPulse 2s infinite;
                  }
                `}
              </style>
               <FaBus className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              {vehicle ? (
                <div className="flex-1 relative overflow-hidden" style={{ height: '42px' }}>
                  <div 
                    className={`absolute inset-0 flex items-center w-full transition-all duration-500 ease-in-out ${
                      showConnected ? 'opacity-0 transform -translate-y-full' : 'opacity-100 transform translate-y-0'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col justify-center w-full">
                        {vehicle.brand && vehicle.model ? (
                          <div className="flex flex-col" style={{ textAlign: 'left' }}>
                            <span className="font-semibold text-base leading-tight">{vehicle.brand}</span>
                            <span className="font-normal text-sm leading-tight" style={{ textIndent: '0px' }}>{vehicle.model}</span>
                          </div>
                        ) : vehicle.label ? (
                          (() => {
                            const parts = vehicle.label.split(' ');
                            if (parts.length >= 2) {
                              const brand = parts[0];
                              const model = parts.slice(1).join(' ');
                              return (
                                <div className="flex flex-col" style={{ textAlign: 'left' }}>
                                  <span className="font-semibold text-base leading-tight">{brand}</span>
                                  <span className="font-normal text-sm leading-tight" style={{ textIndent: '0px' }}>{model}</span>
                                </div>
                              );
                            } else {
                              return <span className="font-semibold text-base">{vehicle.label}</span>;
                            }
                          })()
                        ) : (
                          <span className="font-semibold text-base">Bus</span>
                        )}
                      </div>
                      {vehicle.vehicleId && (
                        <span className="text-sm ml-3 text-gray-500 dark:text-gray-400">#{vehicle.vehicleId}</span>
                      )}
                    </div>
                  </div>
                  <div 
                    className={`absolute inset-0 flex items-center w-full transition-all duration-500 ease-in-out ${
                      showConnected ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-full'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full pr-2">
                      <span className="font-medium">Véhicule connecté</span>
                      <div className="relative w-4 h-4 flex items-center justify-center">
                        {/* Point vert fixe */}
                        <div className="w-2 h-2 rounded-full bg-green-500 relative z-10"></div>
                        {/* Cercles de pulse */}
                        <div className="absolute inset-0 w-4 h-4 rounded-full bg-green-500 opacity-30" style={{
                          animation: 'pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite'
                        }}></div>
                        <div className="absolute inset-0 w-4 h-4 rounded-full bg-green-500 opacity-30" style={{
                          animation: 'pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
                          animationDelay: '1s'
                        }}></div>
                      </div>
                      <style jsx>{`
                        @keyframes pulseRing {
                          0% {
                            transform: scale(0.5);
                            opacity: 0.4;
                          }
                          80%, 100% {
                            transform: scale(1.8);
                            opacity: 0;
                          }
                        }
                      `}</style>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center h-10" style={{ height: '42px' }}>
                  <div className="flex items-center gap-1.5 opacity-75">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span className="italic text-sm text-gray-600 dark:text-gray-400">Aucun véhicule connecté</span>
                  </div>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Bandeau de destination ou d'avertissement */}
      {stopTimes.length > 0 && (
        <>
          {vehicle ? (
            <DestinationBanner 
              destination={stopTimes[stopTimes.length - 1].stop_name}
              lineInfo={lineInfo}
              stopTimes={stopTimes}
            />
          ) : shouldShowWarning ? (
            <WarningBanner 
              text="Attention, le véhicule de ce trajet n'est pas connecté au serveur."
              icon={<FaExclamation />}
            />
          ) : null}
        </>
      )}

      <div className="space-y-6" style={{ paddingLeft: '5.5rem' }}>
        {stopTimes.map((stop, index) => {
          // Ignorer les arrêts sans horaire valide
          if (stop.departure_time === '??:??') {
            return null;
          }

          const departureTimeToUse = stop.realtime_departure_time || stop.departure_time;
          const isPastTime = (() => {
            if (isPastDate()) {
              // Si la date est dans le passé, tous les horaires sont considérés comme passés
              return true;
            } else if (!isToday()) {
              // Si la date est dans le futur, aucun horaire n'est considéré comme passé
              return false;
            }
            
            // Pour aujourd'hui, on compare avec l'heure actuelle
            const now = new Date();
            const timeParts = departureTimeToUse.split(':');
            const stopTime = new Date();
            stopTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0);
            return stopTime < now;
          })();
          
          const isFirstStop = index === 0;
          const isLastStop = index === stopTimes.length - 1;
          
          return (
            <div 
              key={`${stop.stop_id}-${index}`} 
              className="relative min-h-[3.5rem] flex -mt-1"
            >
              {/* Colonne des horaires */}
              <div 
                className={`absolute ${isPastTime ? 'opacity-50' : ''}`} 
                style={{ 
                  left: '-5.5rem',
                  width: '5rem',
                  textAlign: 'right',
                  paddingRight: '1rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <div style={{ position: 'relative' }}>
                  {showRealtimeElements && !isPastTime && stop.realtime_departure_time && (
                    <div 
                      style={{
                        position: 'absolute',
                        right: '-8px',
                        top: '-5%',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '12px'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" style={{ width: '15', height: '15' }}>
                        <style>
                          {`
                            @keyframes wave1 { 
                              0% {opacity: 1} 
                              50% {opacity: 1} 
                              75% {opacity: 0.3} 
                              100% {opacity: 1}
                            }
                            @keyframes wave2 { 
                              0% {opacity: 1} 
                              25% {opacity: 1} 
                              50% {opacity: 0.3} 
                              75% {opacity: 1} 
                              100% {opacity: 1}
                            }
                          `}
                        </style>
                        <path 
                          d="M263.4,282c-10.3,0-18.6-8.3-18.6-18.6c0-114.8-93.4-208.2-208.2-208.2C26.3,55.2,18,46.9,18,36.6s8.3-18.6,18.6-18.6C171.9,18,282,128.1,282,263.4c0,10.3-8.3,18.6-18.6,18.6Z" 
                          fill="#e7a500"
                          style={{ animation: 'wave1 1200ms linear infinite' }}
                        />
                        <path 
                          d="M192.8,282c-10.3,0-18.6-8.3-18.6-18.6c0-75.9-61.7-137.6-137.6-137.6-10.3,0-18.6-8.3-18.6-18.6s8.3-18.6,18.6-18.6c96.4,0,174.8,78.4,174.8,174.8c0,10.3-8.4,18.6-18.6,18.6Z" 
                          fill="#e7a500"
                          style={{ animation: 'wave2 1200ms linear infinite' }}
                        />
                      </svg>
                    </div>
                  )}
                  {showRealtimeElements && stop.realtime_departure_time && stop.delay !== undefined ? (
                    stop.delay > 0 ? (
                      <>
                        <div className="font-naotypo-bold font-black text-red-600 dark:text-red-400">{stop.realtime_departure_time}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 line-through">{stop.departure_time}</div>
                        <div className="mt-0.5">
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                            +{stop.delay} min
                          </span>
                        </div>
                      </>
                    ) : stop.delay < 0 ? (
                      <>
                        <div className="font-naotypo-bold font-black text-orange-500 dark:text-orange-400">{stop.realtime_departure_time}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 line-through">{stop.departure_time}</div>
                        <div className="mt-0.5">
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                            {stop.delay} min
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="font-naotypo-bold font-black text-green-600 dark:text-green-400">{stop.realtime_departure_time}</div>
                    )
                  ) : stop.is_manually_delayed && stop.realtime_departure_time ? (
                    <>
                      <div className="font-naotypo-bold font-black text-orange-600 dark:text-orange-400">{stop.realtime_departure_time}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 line-through">{stop.departure_time}</div>
                      <div className="mt-0.5">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                          +{stop.delay} min
                        </span>
                      </div>
                    </>
                  ) : stop.is_skipped ? (
                    <div className="text-gray-400 dark:text-gray-500 line-through">{stop.departure_time}</div>
                  ) : (
                    <div className="font-bold text-gray-800 dark:text-gray-200">{stop.departure_time}</div>
                  )}
                </div>
              </div>
              
              {/* Colonne de la timeline */}
              <div className="flex flex-col items-center relative" style={{ width: "24px", marginLeft: "-0.5rem" }}>
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
                        backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}`
                      }}
                    />

                    {/* Trait de progression - ne montrer que pour aujourd'hui */}
                    {(() => {
                      if (!isToday() || isManuallyCancelled) return null;
                      
                      const now = new Date();
                      const currentTimeParts = departureTimeToUse.split(':');
                      const currentStopTime = new Date();
                      currentStopTime.setHours(parseInt(currentTimeParts[0]), parseInt(currentTimeParts[1]), 0);

                      const nextStop = stopTimes[index + 1];
                      const nextDepartureTimeToUse = nextStop.realtime_departure_time || nextStop.departure_time;
                      const nextTimeParts = nextDepartureTimeToUse.split(':');
                      const nextStopTime = new Date();
                      nextStopTime.setHours(parseInt(nextTimeParts[0]), parseInt(nextTimeParts[1]), 0);

                      if (now >= currentStopTime && now <= nextStopTime) {
                        const totalDuration = nextStopTime - currentStopTime;
                        const elapsed = now - currentStopTime;
                        const progress = Math.min(100, (elapsed / totalDuration) * 100);

                        return (
                          <div className="relative w-full h-full">
                            <div 
                              className="absolute w-full transition-all duration-1000"
                              style={{ 
                                backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}`,
                                height: `${progress}%`,
                                zIndex: -1
                              }}
                            />

                            <div 
                              className="absolute -left-[12px] transition-all duration-1000 flex flex-col items-center opacity-0 animate-fade-in"
                              style={{ 
                                top: `${progress}%`,
                                transform: 'translateY(-50%)',
                                animation: 'fadeIn 0.3s ease-in-out forwards',
                                willChange: 'transform, opacity',
                                zIndex: 2
                              }}
                            >
                              <div 
                                className="rounded-full w-7 h-7 flex items-center justify-center transform-gpu"
                                style={{
                                  backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}`
                                }}
                              >
                                <FaBus className="text-white text-base" />
                              </div>
                              <svg 
                                width="14" 
                                height="8" 
                                viewBox="0 0 14 8" 
                                fill="none" 
                                className="-mt-0.5 transform-gpu"
                              >
                                <path 
                                  d="M7 8L0.937822 0.5L13.0622 0.5L7 8Z" 
                                  fill={`#${darkenColor(lineInfo?.route_color || '3b82f6')}`}
                                />
                              </svg>
                            </div>
                          </div>
                        );
                      }
                      
                      if (now > nextStopTime) {
                        return (
                          <div 
                            className="absolute w-full h-full"
                            style={{ 
                              backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}`,
                              zIndex: -1
                            }}
                          />
                        );
                      }

                      return null;
                    })()}
                  </div>
                )}
                
                {/* Point d'arrêt */}
                <div className="relative flex items-center justify-center w-5 h-5" style={{ zIndex: 1 }}>
                  {/* Effet de pulse pour l'arrêt actuel - ne montrer que pour aujourd'hui */}
                  {(() => {
                    if (!isToday()) return null;
                    
                    const now = new Date();
                    const currentHours = now.getHours();
                    const currentMinutes = now.getMinutes();
                    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

                    const [hours, minutes] = departureTimeToUse.split(':').map(Number);
                    const stopTimeInMinutes = hours * 60 + minutes;
                    
                    if (currentTimeInMinutes === stopTimeInMinutes) {
                      return (
                        <div 
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ zIndex: 1 }}
                        >
                          <div 
                            className="absolute rounded-full animate-ping"
                            style={{
                              backgroundColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}`,
                              width: isFirstStop || isLastStop ? '24px' : '16px',
                              height: isFirstStop || isLastStop ? '24px' : '16px',
                              opacity: 0.15
                            }}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {stop.is_skipped ? (
                    <div className="rounded-full w-5 h-5 flex items-center justify-center bg-red-600 text-white">
                      <FaExclamation className="text-xs" />
                    </div>
                  ) : (
                    <div 
                      className={`
                        rounded-full bg-white dark:bg-gray-800 relative
                        ${isFirstStop || isLastStop ? 'w-5 h-5 border-4' : 'w-3 h-3 border-2'}
                      `}
                      style={{ 
                        borderColor: `#${darkenColor(lineInfo?.route_color || '3b82f6')}`,
                        zIndex: 1
                      }}
                    />
                  )}
                </div>
              </div>
              
              {/* Colonne du nom d'arrêt et des infos */}
              <div className={`ml-2 md:ml-4 flex-1 -mt-1 ${isPastTime ? 'opacity-50' : ''}`}>
                <Link to={`/horaires?network=${networkId}&stop=${stop.stop_id}&name=${encodeURIComponent(stop.stop_name)}`}>
                  <div className={`
                    transition-all duration-200 rounded-lg px-2 md:px-3 py-2
                    ${stop.is_skipped ? 'bg-pink-50 dark:bg-red-900/50 border-red-300 dark:border-red-700 border' :
                      showRealtimeElements && stop.realtime_departure_time && stop.delay !== undefined ? (
                      stop.delay > 0 ? 'bg-red-50 dark:bg-gray-800 dark:border dark:border-red-500' :
                      stop.delay < 0 ? 'bg-orange-50 dark:bg-gray-800 dark:border dark:border-orange-500' :
                      'bg-green-50 dark:bg-gray-800 dark:border dark:border-green-500'
                    ) : 'bg-white/60 dark:bg-gray-700/60 shadow-sm'}
                  `}>
                    <div className="text-sm flex flex-col">
                      <div className="flex items-center">
                        <span className={`font-semibold ${stop.is_skipped ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>{stop.stop_name}</span>
                        {stop.is_skipped && (
                          <span className="ml-2 text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
                            Non desservi
                          </span>
                        )}
                      </div>
                      {stop.city && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{stop.city}</span>
                      )}
                      <div className="mt-1 flex items-baseline space-x-2">
                      </div>
                    </div>

                    {/* Correspondances */}
                    {(() => {
                      const currentConnections = stopConnections[stop.stop_id] || [];

                      // Si on ne charge pas, afficher les vraies correspondances
                      if (!connectionsLoading && currentConnections.length > 0) {
                        const sortedConnections = [...currentConnections].sort((a, b) => {
                          const nameA = a.route_short_name || '';
                          const nameB = b.route_short_name || '';
                          return nameA.localeCompare(nameB, 'fr', { numeric: true });
                        });
                        
                        return (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {sortedConnections.map((route) => (
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
                        );
                      }
                      
                      // Sinon, ne rien afficher
                      return null;
                    })()}

                    {/* Affichage du statut - seulement pour aujourd'hui */}
                    {(() => {
                      if (!isToday() || stop.is_skipped) {
                        return null;
                      }

                      const now = new Date();
                      const timeParts = departureTimeToUse.split(':');
                      const stopTime = new Date();
                      stopTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0);
                      
                      let status = '';
                      let timeLeft = '';
                      
                      if (isPastTime) {
                        const diffMinutes = Math.round((now - stopTime) / (1000 * 60));
                        if (diffMinutes === 0) {
                          status = 'à l\'arrêt';
                          timeLeft = 'maintenant';
                        } else {
                          status = 'Parti';
                          if (diffMinutes <= 60) {
                            timeLeft = `il y a ${diffMinutes} min`;
                          }
                        }
                      } else {
                        status = 'Prévu';
                        const diffMinutes = Math.round((stopTime - now) / (1000 * 60));
                        if (diffMinutes === 0) {
                          timeLeft = 'maintenant';
                        } else if (diffMinutes <= 60) {
                          timeLeft = `dans ${diffMinutes} min`;
                        }
                      }
                      
                      return (timeLeft && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {status} · {timeLeft}
                        </div>
                      ));
                    })()}
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timetable; 