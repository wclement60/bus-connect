import React, { useState, useEffect } from 'react';
import MarqueeSelect from '../MarqueeSelect';
import { FaBus } from "react-icons/fa";
import { darkenColor } from '../utils/ColorUtils';

const TimetableControls = ({
  selectedDate,
  handleDateChange,
  selectedTime,
  handleTimeChange,
  directions,
  directionId,
  handleDirectionChange,
  directionRef,
  realtimeAvailable,
  isRealtimeEnabled,
  setIsRealtimeEnabled,
  realtimeLoading,
  lineInfo,
  currentTripIndex,
  trips,
  handlePreviousTrip,
  handleNextTrip,
  toggleMapView,
  showMap,
  isMapUpdating,
  vehiclePositions,
  currentVehicleBrand,
  currentVehicleModel,
  currentVehicleId,
  currentVehicleLoading
}) => {
  // Calculer le nombre de véhicules
  const vehicleCount = Object.keys(vehiclePositions || {}).length;
  
  // État pour l'animation du texte
  const [showConnected, setShowConnected] = useState(false);

  // Effet pour alterner le texte seulement si on a des données du véhicule
  useEffect(() => {
    if (currentVehicleId && (currentVehicleBrand || currentVehicleModel)) {
      const interval = setInterval(() => {
        setShowConnected(prev => !prev);
      }, 3000); // Alterner toutes les 3 secondes

      return () => clearInterval(interval);
    } else {
      // Si pas de données véhicule, garder "Véhicule connecté" affiché
      setShowConnected(true);
    }
  }, [currentVehicleId, currentVehicleBrand, currentVehicleModel]);

  return (
    <div className="space-y-3 px-2 sm:px-0">
      {/* Contrôles de date et heure - Rangée 1 */}
      <div className="flex flex-wrap gap-2 justify-center w-full">
        {/* Sélecteur de date */}
        <div className="min-w-[130px] flex-1 max-w-[190px]">
          <div className="flex items-center bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700 p-2.5 transition-colors">
            <svg className="w-6 h-6 text-gray-500 dark:text-gray-400 ml-1 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={(() => {
                // Utiliser le format local pour éviter le décalage de fuseau horaire
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              })()}
              onChange={(e) => handleDateChange(new Date(e.target.value))}
              min={(() => {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              })()}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base text-gray-700 dark:text-gray-200 font-medium p-0 w-full"
            />
          </div>
        </div>

        {/* Sélecteur d'heure */}
        <div className="min-w-[130px] flex-1 max-w-[190px]">
          <div className="flex items-center bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700 p-2.5 transition-colors">
            <svg className="w-6 h-6 text-gray-500 dark:text-gray-400 ml-1 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base text-gray-700 dark:text-gray-200 font-medium p-0 w-full"
            />
          </div>
        </div>
      </div>

      {/* Sélecteur de direction - Rangée 2 */}
      {directions.length > 0 && directionId !== undefined && (
        <div className="flex justify-center w-full px-2">
          <div className="w-full max-w-[450px] bg-white dark:bg-dark-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-dark-600">
            <MarqueeSelect 
              options={directions} 
              value={directionId !== undefined ? parseInt(directionId, 10) : undefined}
              onChange={(value) => handleDirectionChange(value)} 
              placeholder="Sélectionner une direction"
            />
          </div>
        </div>
      )}

      {/* Boutons navigation et temps réel - Rangée 3 et 4 */}
      {(trips.length > 0 && lineInfo) && (
        <>
          <div className="flex flex-wrap justify-center items-center w-full gap-4 px-2">
            {!showMap && (
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
            )}

            <div className="flex flex-col items-center">
              <button
                onClick={toggleMapView}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 relative ${
                  showMap
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500'
                    : ''
                }`}
                style={!showMap ? {
                  backgroundColor: `#${darkenColor(lineInfo?.route_color)}`,
                  color: `#${lineInfo?.route_text_color || 'FFFFFF'}`
                } : {}}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {vehicleCount > 0 && (
                  <div 
                    className="absolute -top-2 -right-2 flex items-center justify-center gap-1 min-w-[24px] h-6 bg-white shadow-md rounded-full px-2 text-sm font-medium border" 
                    style={{ 
                      color: `#${darkenColor(lineInfo?.route_color)}`,
                      borderColor: `#${darkenColor(lineInfo?.route_color)}30`
                    }}
                  >
                    {vehicleCount}
                    <FaBus size={12} />
                  </div>
                )}
              </button>
              <span 
                className="mt-2 text-sm font-medium"
                style={{
                  color: `#${darkenColor(lineInfo?.route_color)}`
                }}
              >
               Plan Intéractif
              </span>
            </div>

            {!showMap && (
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
            )}
          </div>

          <div className="flex justify-center w-full px-2">
            {realtimeAvailable && (
              <div 
                className={`w-full max-w-[450px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-sm transition-all duration-200 border relative ${
                  currentVehicleId ? 'bg-white' : 'bg-gray-50'
                }`}
                style={{
                  borderColor: `#${darkenColor(lineInfo?.route_color)}30`,
                  color: currentVehicleId ? `#${darkenColor(lineInfo?.route_color)}` : '#666666'
                }}
              >
                <div className="flex-1 overflow-hidden">
                  {currentVehicleLoading ? (
                    <div className="animate-pulse h-[36px] flex items-center">Chargement...</div>
                  ) : currentVehicleId ? (
                    // Si on a des données véhicule, alterner, sinon garder "Véhicule connecté"
                    (currentVehicleBrand || currentVehicleModel) ? (
                      <div className="relative h-[36px] flex items-center">
                        <div 
                          className={`absolute left-0 w-full transition-transform duration-500 ${
                            showConnected ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start leading-tight">
                              <span className="font-medium truncate">{currentVehicleBrand || 'Bus'}</span>
                              {currentVehicleModel && (
                                <span className="text-[10px] opacity-75 truncate">{currentVehicleModel}</span>
                              )}
                            </div>
                            {currentVehicleId && (
                              <span className="text-[10px] opacity-75 ml-2">#{currentVehicleId}</span>
                            )}
                          </div>
                        </div>
                        <div 
                          className={`absolute left-0 w-full transition-transform duration-500 ${
                            showConnected ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
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
                      // Pas de données véhicule, afficher seulement "Véhicule connecté"
                      <div className="h-[36px] flex items-center">
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
                    )
                  ) : (
                    <div className="h-[36px] flex items-center">
                      <div className="flex items-center gap-1.5 opacity-75">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        <span>Aucun véhicule connecté</span>
                      </div>
                    </div>
                  )}
                </div>
                <FaBus 
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    currentVehicleId ? '' : 'opacity-50'
                  }`}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TimetableControls; 