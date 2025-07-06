import React from 'react';
import { FaExclamationTriangle, FaTools, FaTimesCircle, FaBan, FaExclamation } from 'react-icons/fa';
import { darkenColor } from '../utils/ColorUtils';

const StopTimelineItem = ({
  stop,
  index,
  isFirstStop,
  isLastStop,
  stopTime,
  formatTimeWithDelay,
  currentTrip,
  isPastTime,
  nextStop,
  stopConnections,
  lineInfo,
  trafficInfo,
  totalStops
}) => {
  const hasStop = !!stopTime;
  const hasStopTrafficInfo = trafficInfo && (trafficInfo.stop_id === stop.stop_id || trafficInfo.stop_id === null);

  // Obtenir l'horaire formaté avec potentiellement les informations de temps réel
  const formattedTime = formatTimeWithDelay(
    stopTime,
    currentTrip?.trip_id,
    stop.stop_id,
    isFirstStop,
    isLastStop,
    stop.stop_sequence || index
  );

  return (
    <div key={`${stop.stop_id || index}-${index}`} className="flex">
      <div className="w-[4.5rem] pr-4 flex justify-end">
        <div className={`
          px-2 py-0.5 rounded-lg tabular-nums whitespace-nowrap text-sm
          ${(isFirstStop || isLastStop) ? 'font-bold' : 'font-medium'}
          ${!hasStop ? 'text-[#999999]' :
            formattedTime.isCancelled || formattedTime.isSkipped ? 'text-red-600 opacity-75' :
            isPastTime ? 'text-[#666666]' : 
            formattedTime.isRealtime ? (
              formattedTime.delay > 0 ? 'text-red-600' :
              formattedTime.delay < 0 ? 'text-orange-600' :
              'text-green-600'
            ) :
            'text-[#1A1A1A]'
          }
        `}>
          {hasStop ? (
            formattedTime.isCancelled || formattedTime.isSkipped ? (
              <span className="line-through">{formattedTime.original}</span>
            ) : formattedTime.status === 'normal' ? 
              formattedTime.original
            : formattedTime.status !== 'normal' && formattedTime.original !== formattedTime.adjusted ? (
              <div className="flex flex-col">
                <span className="line-through text-gray-400 text-[11px] leading-tight">{formattedTime.original}</span>
                <span>{formattedTime.adjusted}</span>
              </div>
            ) : formattedTime.adjusted
          ) : "-"}
          
          {!formattedTime.isCancelled && !formattedTime.isSkipped && formattedTime.displayDelay && (
            <span className={`
              mt-1 text-[11px] leading-tight px-1.5 py-0.5 rounded-full
              ${formattedTime.delay > 0 ? 'bg-red-50 text-red-600' :
                formattedTime.delay < 0 ? 'bg-orange-50 text-orange-600' :
                'bg-green-50 text-green-600'
              }
            `}>
              {formattedTime.displayDelay}
            </span>
          )}
        </div>
      </div>

      {/* Timeline simplifiée */}
      <div className="flex flex-col items-center" style={{ width: "24px" }}>
        {!isLastStop && (
          <div 
            className="w-[2px]"
            style={{ 
              marginTop: "10px",
              marginBottom: "10px",
              height: "calc(100% - 20px)",
              backgroundColor: `#${lineInfo?.route_color || 'FF0000'}`
            }}
          />
        )}

        <div 
          className={`
            rounded-full
            ${isFirstStop || isLastStop ? 'w-5 h-5' : 'w-3 h-3'}
            ${hasStopTrafficInfo || formattedTime.isSkipped ? 'bg-red-600' : `bg-[#${lineInfo?.route_color || 'FF0000'}]`}
          `}
          style={{ 
            backgroundColor: hasStopTrafficInfo || formattedTime.isSkipped ? '#dc2626' : 
                          formattedTime.isCancelled ? '#B0B0B0' : 
                          `#${lineInfo?.route_color || 'FF0000'}`
          }}
        >
          {(hasStopTrafficInfo || formattedTime.isSkipped) && (
            <FaExclamation className={`text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${isFirstStop || isLastStop ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
          )}
        </div>
      </div>

      {/* Reste du contenu */}
      <div className="ml-6 flex-1">
        <div className={`
          transition-all duration-200 rounded-lg px-3 py-2
          ${!hasStop ? 'bg-[#F6F6F6]/60' :
            formattedTime.isCancelled || formattedTime.isSkipped ? 'bg-red-50/60 opacity-80' :
            isPastTime ? 'bg-[#F6F6F6]/60' : 
            formattedTime.isRealtime ? (
              formattedTime.delay > 0 ? 'bg-red-50/60' :
              formattedTime.delay < 0 ? 'bg-orange-50/60' :
              'bg-green-50/60'
            ) :
            'bg-white/60 shadow-sm'
          }
          ${hasStopTrafficInfo ? (
            trafficInfo.type === 'Travaux' ? 'border-l-4 border-yellow-400' :
            trafficInfo.type === 'Arrêt non desservi' ? 'border-l-4 border-red-500' :
            'border-l-4 border-blue-400'
          ) : formattedTime.isSkipped ? 'border-l-4 border-red-500' : ''}
        `}>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center">
              <h3 className={`
                text-sm ${(isFirstStop || isLastStop) ? 'font-bold' : 'font-medium'}
                ${!hasStop ? 'text-[#999999]' :
                  formattedTime.isCancelled || formattedTime.isSkipped ? 'text-red-600 opacity-75' :
                  isPastTime ? 'text-[#666666]' : 
                  'text-[#1A1A1A]'
                }
              `}>
                {stop.stop_name}
              </h3>
              
              {/* Message court pour l'arrêt non desservi */}
              {(hasStopTrafficInfo && trafficInfo.type === 'Arrêt non desservi' || formattedTime.isSkipped) && (
                <span className="ml-2 text-xs font-bold text-red-600">Non desservi</span>
              )}
            </div>
            
            {/* Display city only if it exists */}
            {stop.city && (
              <p className={`
                text-[11px] leading-tight
                ${!hasStop ? 'text-[#999999]' :
                  formattedTime.isCancelled || formattedTime.isSkipped ? 'text-red-600/75 opacity-75' :
                  isPastTime ? 'text-[#666666]/75' : 
                  'text-gray-500'
                }
              `}>
                {stop.city}
              </p>
            )}
            
            {/* Check connections for both the original stop ID and without prefix if applicable */}
            {(() => {
              // Récupérer les correspondances pour cet arrêt
              let connections = stopConnections?.[stop.stop_id] || [];
              
              // Si aucune correspondance n'a été trouvée, on regarde si ce n'est pas un problème d'identifiant
              if (connections.length === 0) {
                // Essayer d'autres formats d'identifiants
                if (stop.stop_id.includes(':')) {
                  // Si le stop_id a un préfixe, essayer sans
                  const unprefixedId = stop.stop_id.split(':')[1];
                  connections = stopConnections?.[unprefixedId] || [];
                } else {
                  // Si le stop_id n'a pas de préfixe, essayer plusieurs préfixes (IDF)
                  const departmentPrefixes = ['60:', '95:', '75:', '77:', '78:', '91:', '92:', '93:', '94:'];
                  for (const prefix of departmentPrefixes) {
                    const prefixedId = `${prefix}${stop.stop_id}`;
                    if (stopConnections?.[prefixedId]?.length > 0) {
                      connections = stopConnections[prefixedId];
                      break;
                    }
                  }
                }
              }
              
              // Déduplication des lignes par route_short_name pour éviter les doublons
              const uniqueRoutes = [];
              const seenRouteNames = new Set();
              
              if (connections && connections.length > 0) {
                connections.forEach(route => {
                  // Ne pas ajouter la ligne courante aux correspondances
                  if (route && route.route_short_name && 
                      !seenRouteNames.has(route.route_short_name) && 
                      route.route_short_name !== lineInfo?.route_short_name) {
                    seenRouteNames.add(route.route_short_name);
                    uniqueRoutes.push(route);
                  }
                });

                // Trier par nom de ligne pour une présentation cohérente
                uniqueRoutes.sort((a, b) => {
                  if (!a.route_short_name) return 1;
                  if (!b.route_short_name) return -1;
                  return a.route_short_name.localeCompare(b.route_short_name);
                });

                // Si des correspondances existent, les afficher
                return uniqueRoutes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {uniqueRoutes.map((route) => (
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
            })()}

            {/* Afficher un court message de travaux si applicable */}
            {hasStopTrafficInfo && trafficInfo.type === 'Travaux' && (
              <div className="mt-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                <FaTools className="inline mr-1 w-3 h-3" /> Travaux en cours
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopTimelineItem; 