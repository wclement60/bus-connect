import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { getCachedData } from '../utils/supabaseCache';
import AlertBanner from './AlertBanner';
import { getFormattedDisruptionsForLine } from '../services/lineTrafficService';
import { PiWarningCircleFill } from 'react-icons/pi';

// Fonction pour assombrir une couleur hexadécimale
const darkenColor = (color) => {
  // Si pas de couleur, retourne la couleur par défaut
  if (!color) return '6B7280';
  
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

// Fonction pour déterminer si le texte doit être blanc ou noir selon la luminosité du fond
const getContrastTextColor = (bgColor) => {
  if (!bgColor) return 'FFFFFF';
  
  const r = parseInt(bgColor.slice(0, 2), 16);
  const g = parseInt(bgColor.slice(2, 4), 16);
  const b = parseInt(bgColor.slice(4, 6), 16);
  
  // Calcul de la luminosité (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Si la luminosité est élevée (couleur claire), on retourne du texte noir, sinon blanc
  return luminance > 0.5 ? '000000' : 'FFFFFF';
};

const DirectionList = () => {
  const { networkId, lineId } = useParams();
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lineInfo, setLineInfo] = useState(null);
  const [networkName, setNetworkName] = useState('');
  const [isDisrupted, setIsDisrupted] = useState(false);

  // Mettre à jour le titre de la page avec le numéro de ligne et le nom du réseau
  useEffect(() => {
    if (lineInfo && networkName) {
      document.title = `Bus Connect - ${lineInfo.route_short_name} ${networkName}`;
    } else if (lineInfo) {
      document.title = `Bus Connect - ${lineInfo.route_short_name}`;
    } else {
      document.title = "Bus Connect";
    }
  }, [lineInfo, networkName]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch line information using cache
        const lineData = await getCachedData(
          `line-${lineId}-${networkId}`,
          async () => {
            const { data, error } = await supabase
              .from('routes')
              .select('*')
              .eq('route_id', lineId)
              .eq('network_id', networkId)
              .single();
            if (error) throw error;
            return data;
          }
        );
        setLineInfo(lineData);

        // Check for disruptions
        if (lineData?.route_short_name) {
          const disruptions = await getFormattedDisruptionsForLine(networkId, lineData.route_short_name);
          if (disruptions.length > 0) {
            setIsDisrupted(true);
          }
        }

        // Récupérer le nom du réseau
        const networkData = await getCachedData(
          `network-${networkId}`,
          async () => {
            const { data, error } = await supabase
              .from('networks')
              .select('network_name')
              .eq('network_id', networkId)
              .single();
            if (error) throw error;
            return data;
          }
        );
        setNetworkName(networkData.network_name);

        // Fetch directions using cache
        const directionsData = await getCachedData(
          `directions-${lineId}-${networkId}`,
          async () => {
            const { data, error } = await supabase.rpc(
              'get_route_directions',
              {
                route_id_param: lineId,
                network_id_param: networkId
              }
            );
            if (error) {
              if (error.code === '42883') {
                throw new Error("La fonction 'get_route_directions' n'a pas été trouvée ou sa signature a changé.");
              }
              throw error;
            }
            return data;
          }
        );

        // Format directions data
        const formattedDirections = (directionsData || []).map(dir => ({
          ...dir,
          terminus_names: Array.isArray(dir.terminus_names) ? dir.terminus_names : []
        }));
        
        setDirections(formattedDirections);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [networkId, lineId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center transition-colors duration-200">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-blue-600 dark:text-blue-400 font-medium">Chargement des directions...</p>
      </div>
    </div>
  );

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
        <Link to={`/network/${networkId}/lines`} className="mt-4 inline-flex items-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
          <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour à la liste des lignes
        </Link>
      </div>
    </div>
  );

  const lineColor = lineInfo?.route_color || '6B7280';
  const backgroundColor = darkenColor(lineColor);
  const textColor = getContrastTextColor(backgroundColor);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
      <AlertBanner networkId={networkId} />
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 shadow relative transition-colors duration-200">
        <div className="absolute top-0 left-0 z-10">
          <Link to={`/network/${networkId}/lines`} className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-dark-700 rounded-br-full relative hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors">
            <div className="absolute transform -translate-x-2 -translate-y-2">
              <svg className="h-7 w-7 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="py-3 sm:py-6 ml-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div 
                    className="min-w-fit h-6 sm:h-8 rounded-[8px] flex items-center justify-center px-4 sm:px-5 text-center"
                    style={{ 
                      backgroundColor: `#${backgroundColor}`,
                      color: `#${textColor}`,
                      position: 'relative'
                    }}
                  >
                    <span className="font-bold text-sm whitespace-nowrap">{lineInfo?.route_short_name}</span>
                    {isDisrupted && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '22px',
                          height: '22px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10
                        }}
                        title="Cette ligne est actuellement perturbée"
                      >
                        <PiWarningCircleFill 
                          style={{
                            color: '#ef4444',
                            fontSize: '18px'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-2 sm:ml-3">
                  <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white break-words">
                    {lineInfo?.route_long_name}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sélectionner une direction</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-2 sm:py-8 px-3 sm:px-6 lg:px-8 mb-16 sm:mb-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          {directions.map((direction) => (
            <Link
              key={direction.direction_id}
              to={`/network/${networkId}/line/${lineId}/direction/${direction.direction_id}/timetable`}
              className="group block"
            >
              <div 
                className="bg-white dark:bg-dark-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-dark-700 hover:border-blue-400 dark:hover:border-blue-500 overflow-hidden h-full"
              >
                <div 
                  className="px-3 py-2 sm:py-3 border-b dark:border-dark-700"
                  style={{ backgroundColor: `#${backgroundColor}20` }}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {direction.direction_id === 0 ? (
                        <svg className="h-5 w-5 mr-1.5 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke={`#${backgroundColor}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 mr-1.5 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke={`#${backgroundColor}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold" style={{ color: `#${backgroundColor}` }}>
                      Direction {direction.direction_id === 0 ? 'Aller' : 'Retour'}
                    </h3>
                  </div>
                </div>
                <div className="p-2 sm:p-4">
                  <div className="mb-1 sm:mb-3">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {direction.terminus_names.length > 1 ? 'Terminus possibles' : 'Terminus'}
                      {direction.terminus_names.length === 0 && ' (Non défini)'}
                    </h4>
                  </div>
                  
                  {direction.terminus_names && direction.terminus_names.length > 0 && (
                    <div className="bg-gray-50 dark:bg-dark-700 rounded p-1.5 sm:p-3 border border-gray-100 dark:border-dark-600">
                      <ul className="space-y-1 sm:space-y-2">
                        {direction.terminus_names.map((terminusName, index) => (
                          <li key={index} className="flex items-center">
                            <div 
                              className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center mr-1.5 sm:mr-2"
                              style={{ 
                                backgroundColor: `#${backgroundColor}`
                              }}
                            >
                              <span className="text-[10px] sm:text-xs font-bold" style={{ color: `#${textColor}` }}>{index + 1}</span> 
                            </div>
                            <span className="text-gray-800 dark:text-gray-200 text-xs sm:text-sm font-medium">{terminusName}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="mt-2 sm:mt-4 flex items-center justify-between text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300 transition-colors">
                    <span className="text-xs font-medium">Voir horaires</span>
                    <svg className="h-3.5 w-3.5 sm:h-5 sm:w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default DirectionList; 