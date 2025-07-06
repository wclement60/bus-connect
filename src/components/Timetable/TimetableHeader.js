import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { darkenColor } from '../utils/ColorUtils';

const TimetableHeader = ({
  networkId,
  lineId,
  lineInfo,
  selectedDirection,
  directions
}) => {
  const [hasSingleDirection, setHasSingleDirection] = useState(false);
  const [checkingDirections, setCheckingDirections] = useState(true);

  useEffect(() => {
    // Vérifier si la ligne n'a qu'une seule direction
    const checkDirections = async () => {
      try {
        const { data: directionsData, error: directionsError } = await supabase.rpc(
          'get_route_directions',
          {
            route_id_param: lineId,
            network_id_param: networkId
          }
        );

        if (directionsError) throw directionsError;
        
        // Si la ligne a exactement une direction, on renvoie vers la liste des lignes
        setHasSingleDirection(directionsData && directionsData.length === 1);
      } catch (err) {
        console.error("Erreur lors de la vérification des directions:", err);
        // Par défaut, on suppose qu'il y a plusieurs directions
        setHasSingleDirection(false);
      } finally {
        setCheckingDirections(false);
      }
    };

    checkDirections();
  }, [networkId, lineId]);

  return (
    <div className="bg-white dark:bg-dark-800 shadow relative transition-colors duration-200">
      <div className="absolute top-0 left-0 z-10">
        {checkingDirections ? (
          // Bouton désactivé pendant le chargement
          <div className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-dark-700 rounded-br-full relative opacity-50">
            <div className="absolute transform -translate-x-2 -translate-y-2">
              <svg className="h-7 w-7 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </div>
        ) : (
          // Lien avec le style de flèche comme dans LineList/DirectionList
          <Link
            to={hasSingleDirection 
              ? `/network/${networkId}/lines` 
              : `/network/${networkId}/line/${lineId}/directions`
            }
            className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-dark-700 rounded-br-full relative hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
          >
            <div className="absolute transform -translate-x-2 -translate-y-2">
              <svg className="h-7 w-7 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
        )}
      </div>
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="py-3 sm:py-6">
          <div className="flex flex-col items-center justify-center">
            <div 
              className="h-12 sm:h-14 min-w-[60px] rounded-[10px] flex items-center justify-center px-4 sm:px-5"
              style={{ 
                backgroundColor: `#${darkenColor(lineInfo?.route_color)}`,
                color: `#${lineInfo?.route_text_color || 'FFFFFF'}`
              }}
            >
              <span className="font-bold text-xl sm:text-2xl whitespace-nowrap">{lineInfo?.route_short_name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableHeader; 