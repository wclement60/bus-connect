import React from 'react';
import { FaBus } from "react-icons/fa";
import { darkenColor } from '../utils/ColorUtils';

const VehicleTimeline = ({
  showVehicleTimeline,
  setShowVehicleTimeline,
  selectedVehicleInfo,
  selectedVehicleBrand,
  selectedVehicleModel,
  vehicleDetailsLoading,
  vehicleTimelineLoading,
  vehicleTimelineError,
  selectedVehicleStopTimes,
  selectedVehicleTripId,
  formatTimeWithDelay,
  lineInfo
}) => {
  
  if (!showVehicleTimeline) return null;

  return (
    <div className="fixed top-[100px] left-0 z-[9999] w-48 bg-white/90 border border-l-0 border-gray-200/50 backdrop-blur-sm rounded-r-lg shadow-md p-2 overflow-y-auto max-h-[55vh] vehicle-timeline-panel">
      <div className="flex justify-between items-start mb-1.5 pb-1.5 border-b border-gray-200/60">
        <div className="flex flex-col min-w-0">
          {selectedVehicleInfo?.vehicleId && (
            <div className="flex flex-col">
              <div className="flex items-center text-[11px] text-gray-700">
                <FaBus className="w-3 h-3 mr-1 flex-shrink-0" style={{ color: `#${lineInfo?.route_color || '808080'}` }} />
                {vehicleDetailsLoading ? (
                  <span className="animate-pulse">Chargement...</span>
                ) : (
                  <span className="font-medium">
                    {selectedVehicleBrand || 'Bus'}
                  </span>
                )}
              </div>
              {!vehicleDetailsLoading && selectedVehicleModel && (
                <div className="text-[11px] text-gray-600 ml-4">
                  {selectedVehicleModel}
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-0.5">
                ID: {selectedVehicleInfo.vehicleId}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowVehicleTimeline(false)}
          className="p-0.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Fermer"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      <h3 className="text-[11px] font-semibold text-gray-700 mb-1">
        Prochains arrêts
      </h3>
      {vehicleTimelineLoading && (
        <div className="text-center py-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-[10px] text-gray-500 mt-1.5">Chargement...</p>
        </div>
      )}
      {vehicleTimelineError && (
        <div className="bg-red-50 p-2 rounded-md">
          <p className="text-xs text-red-700">Erreur: {vehicleTimelineError}</p>
        </div>
      )}
      {!vehicleTimelineLoading && !vehicleTimelineError && selectedVehicleStopTimes.length > 0 && (
        <div className="relative space-y-2.5 pt-1.5 pb-1.5">
          {(() => {
            if (!selectedVehicleStopTimes || selectedVehicleStopTimes.length === 0) return null;
            const trueLastStop = selectedVehicleStopTimes[selectedVehicleStopTimes.length - 1];
            if (!trueLastStop) return null;

            return selectedVehicleStopTimes.filter((stop) => {
              if (!stop || !stop.stop_id || !stop.stop_sequence) return false;

              const isPast = (() => {
                const stopTimeForCheck = stop.arrival_time || stop.departure_time;
                if (typeof formatTimeWithDelay !== 'function') return false;
                const formattedTimeForCheck = formatTimeWithDelay(
                  stopTimeForCheck, 
                  selectedVehicleTripId, 
                  stop.stop_id, 
                  false, 
                  false, 
                  stop.stop_sequence
                );
                if (!formattedTimeForCheck || (!formattedTimeForCheck.adjusted && !formattedTimeForCheck.original)) return false;
                const currentTime = new Date();
                let timeToCheck = formattedTimeForCheck.isRealtime ? formattedTimeForCheck.adjusted : formattedTimeForCheck.original;
                if (!timeToCheck || timeToCheck === '-') return false;
                const timeParts = timeToCheck.split(':');
                if (timeParts.length < 2) return false;
                const [hours, minutes] = timeParts.map(Number);
                if (isNaN(hours) || isNaN(minutes)) return false;
                const stopTimeTotalMinutes = hours * 60 + minutes;
                const nowTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                return stopTimeTotalMinutes < nowTotalMinutes;
              })();
              return !isPast || (stop.stop_id === trueLastStop.stop_id && stop.stop_sequence === trueLastStop.stop_sequence);
            }).map((stop, index, filteredStops) => {
              const isLastRendered = index === filteredStops.length - 1;
              const stopTime = stop.arrival_time || stop.departure_time;
              const isTrueTerminus = stop.stop_id === trueLastStop.stop_id && stop.stop_sequence === trueLastStop.stop_sequence;

              if (typeof formatTimeWithDelay !== 'function') 
                return <div key={`${stop.stop_id}-${stop.stop_sequence}`}>Erreur formatage</div>;

              const formattedTime = formatTimeWithDelay(
                stopTime,
                selectedVehicleTripId,
                stop.stop_id,
                index === 0,
                isTrueTerminus,
                stop.stop_sequence
              );
              if (!formattedTime) 
                return <div key={`${stop.stop_id}-${stop.stop_sequence}`}>Erreur formatage temps</div>;

              const isPast = (() => {
                const currentTime = new Date();
                let timeToCheck = formattedTime.isRealtime ? formattedTime.adjusted : formattedTime.original;
                if (!timeToCheck || timeToCheck === '-') return false;
                const timeParts = timeToCheck.split(':');
                if (timeParts.length < 2) return false;
                const [hours, minutes] = timeParts.map(Number);
                if (isNaN(hours) || isNaN(minutes)) return false;
                const stopTimeTotalMinutes = hours * 60 + minutes;
                const nowTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                return stopTimeTotalMinutes < nowTotalMinutes;
              })();

              return (
                <div key={`${stop.trip_id}-${stop.stop_id}-${stop.stop_sequence}`} className="relative flex items-start pl-4">
                  {!isLastRendered && (
                    <div
                      className="absolute w-px bg-gray-300 z-0"
                      style={{ left: '5px', top: '10px', bottom: '-0.75rem' }}
                    ></div>
                  )}

                  {isTrueTerminus ? (
                    <div
                      className="absolute w-3.5 h-3.5 rounded-full flex items-center justify-center z-10"
                      style={{
                        left: '-2px',
                        top: '2px',
                        backgroundColor: `#${darkenColor(lineInfo?.route_color)}1A`
                      }}
                    >
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke={`#${darkenColor(lineInfo?.route_color)}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className={`absolute w-2.5 h-2.5 rounded-full border z-10 bg-white`}
                      style={{
                        left: '0px',
                        top: '4px',
                        borderColor: isPast ? '#D1D5DB' : `#${darkenColor(lineInfo?.route_color)}`
                      }}
                    ></div>
                  )}

                  <div className="ml-1 flex-1 flex flex-col min-w-0">
                    <div className={`text-[11px] ${isPast ? 'text-gray-400' : 'text-gray-800'} ${isTrueTerminus ? 'font-bold' : 'font-medium'} leading-tight truncate`}>
                      {stop.stop_name || 'Arrêt inconnu'}
                    </div>

                    {formattedTime.original && formattedTime.original !== '-' && (
                      <div className={`text-[11px] mt-1 flex items-center space-x-1.5`}>
                        <span className={`${
                          isPast ? 'text-gray-400' :
                          formattedTime.isRealtime ? (
                            formattedTime.status === 'late' ? 'text-red-600 font-semibold' :
                            formattedTime.status === 'early' ? 'text-orange-600 font-semibold' :
                            formattedTime.status === 'on-time' ? 'text-green-600 font-semibold' :
                            'text-gray-600'
                          ) : 'text-gray-600'
                        }`}>
                          {formattedTime.isRealtime && formattedTime.original !== formattedTime.adjusted ? (
                            <>
                              <span className={`line-through text-[9px] ${isPast ? 'text-gray-400/70' : 'text-gray-400'}`}>{formattedTime.original}</span>
                              <span className="ml-1">{formattedTime.adjusted}</span>
                            </>
                          ) : (
                            <span>{formattedTime.adjusted || '-'}</span>
                          )}
                        </span>

                        {formattedTime.isRealtime && formattedTime.displayDelay && (
                          <span className={`text-[9px] px-1 py-0 rounded-full whitespace-nowrap ${isPast ? 'bg-gray-100 text-gray-400' :
                            formattedTime.delay > 0 ? 'bg-red-50 text-red-600' :
                            formattedTime.delay < 0 ? 'bg-orange-50 text-orange-600' :
                            'bg-green-50 text-green-600'
                          }`}>
                            {formattedTime.displayDelay}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
      {!vehicleTimelineLoading && !vehicleTimelineError && selectedVehicleStopTimes.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">Aucun détail d'arrêt trouvé pour ce bus.</p>
      )}
    </div>
  );
};

export default VehicleTimeline; 