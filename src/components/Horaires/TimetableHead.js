import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaBus } from "react-icons/fa";
import { PiWarningCircleFill } from "react-icons/pi";
import './TimetableHead.css';
import DirectionSelector from './DirectionSelector';
import AlertBanner from '../AlertBanner';
import TrafficNotificationBell from './TrafficNotificationBell';

const TimetableHead = ({ 
  networkId, 
  lineId, 
  directionId, 
  lineInfo, 
  directions, 
  onDirectionChange,
  trafficDisruptions = []
}) => {
  const navigate = useNavigate();

  const handleDirectionChange = (newDirectionId) => {
    onDirectionChange(newDirectionId);
    navigate(`/network/${networkId}/line/${lineId}/direction/${newDirectionId}/timetable`);
  };

  // Adapter le format des directions pour le composant DirectionSelector
  const formattedDirections = directions.map(direction => ({
    direction_id: direction.direction_id,
    name: direction.direction_name
  }));

  // Fonction utilitaire pour assombrir une couleur
  const darkenColor = (color) => {
    if (!color) return '000000';
    
    const r = parseInt(color.slice(0, 2), 16);
    const g = parseInt(color.slice(2, 4), 16);
    const b = parseInt(color.slice(4, 6), 16);
    
    const darkenAmount = 0.85;
    const darkenR = Math.floor(r * darkenAmount);
    const darkenG = Math.floor(g * darkenAmount);
    const darkenB = Math.floor(b * darkenAmount);
    
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

  // Calculer la couleur de fond (assombrie)
  const backgroundColor = darkenColor(lineInfo?.route_color) || '3b82f6';
  // Déterminer la couleur de texte optimale pour le contraste
  const textColor = getContrastTextColor(backgroundColor);

  return (
    <>
      <AlertBanner networkId={networkId} />
      <div className="timetable-header dark:bg-gray-800 dark:border-gray-700">
        <div className="absolute top-0 left-0 z-10">
          <Link to={`/network/${networkId}/line/${lineId}/directions`} className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-dark-700 rounded-br-full relative hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors">
            <div className="absolute transform -translate-x-2 -translate-y-2">
              <svg className="h-7 w-7 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
        </div>
        <div className="header-content" style={{ position: 'relative' }}>
          <div className="line-info">
            <div 
              className="line-number"
              style={{
                backgroundColor: `#${backgroundColor}`,
                color: `#${textColor}`,
                position: 'relative'
              }}
            >
              {lineInfo?.route_short_name ? (
                <span className="line-number-text">{lineInfo.route_short_name}</span>
              ) : (
                <FaBus size={18} />
              )}
              
              {/* Indicateur de perturbation */}
              {trafficDisruptions && trafficDisruptions.length > 0 && (
                <div 
                  className="disruption-indicator"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '22px',
                    height: '22px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                  title={`${trafficDisruptions.length} perturbation${trafficDisruptions.length > 1 ? 's' : ''} en cours`}
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
            <div className="line-name">{lineInfo?.route_long_name}</div>
          </div>
          
          {/* Cloche de notification tout à droite */}
          <div style={{ 
            position: 'absolute', 
            right: '20px', 
            top: '0.75rem', 
            zIndex: 10,
            maxWidth: 'fit-content'
          }}>
            <TrafficNotificationBell disruptions={trafficDisruptions} />
          </div>
          
          <DirectionSelector
            value={directionId}
            onChange={handleDirectionChange}
            directions={formattedDirections}
            disabled={false}
          />
        </div>
      </div>
    </>
  );
};

export default TimetableHead; 