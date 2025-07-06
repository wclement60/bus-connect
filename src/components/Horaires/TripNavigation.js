import React, { useState, useEffect, useRef } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { FaMap, FaBus } from 'react-icons/fa';
import { darkenColor } from './utils';
import './Horaires.css';

const TripNavigation = ({
  currentTripIndex,
  trips,
  onPreviousTrip,
  onNextTrip,
  lineInfo,
  isChangingTrip,
  onMapOpen,
  networkId,
  routeId,
  directionId,
  currentTripId,
  vehiclePositions = {}
}) => {
  const [isFixed, setIsFixed] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current) {
        const { top } = navRef.current.getBoundingClientRect();
        // Si le haut du conteneur de navigation est au-dessus de la fenêtre
        setIsFixed(top < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const buttonStyle = {
    backgroundColor: `#${darkenColor(lineInfo?.route_color)}`,
    color: 'white'
  };

  // Extraire l'information du trip actuel pour l'affichage
  const currentTrip = trips[currentTripIndex] || {};
  
  // Obtenir l'heure effective du trip (en suivant la même logique que dans Horaires.js)
  let formattedTime = '';
  if (currentTrip && currentTrip.trip_id) {
    // Définir une fonction pour obtenir l'heure la plus fiable
    const getEffectiveTime = (trip) => {
      // Priorité 1: heure stockée dans window.tripFirstStops (basée sur les arrêts réels)
      if (window.tripFirstStops && window.tripFirstStops[trip.trip_id]) {
        return window.tripFirstStops[trip.trip_id];
      }
      
      // Priorité 2: real_first_time
      if (trip.real_first_time) {
        return trip.real_first_time;
      }
      
      // Priorité 3: first_departure_time
      if (trip.first_departure_time) {
        return trip.first_departure_time;
      }
      
      return '';
    };
    
    const effectiveTime = getEffectiveTime(currentTrip);
    formattedTime = effectiveTime ? effectiveTime.substring(0, 5) : '';
  }

  // Utiliser simplement l'index du tableau + 1 pour l'affichage
  const displayIndex = currentTripIndex + 1;
  
  // Gestionnaire pour l'ouverture de la carte avec les bonnes informations
  const handleMapOpen = () => {
    if (onMapOpen) {
      onMapOpen({
        networkId,
        routeId,
        directionId,
        tripId: currentTripId,
        lineInfo
      });
    }
  };

  // Calculer le nombre de véhicules
  const vehicleCount = Object.keys(vehiclePositions).length;
  
  // Utiliser la même couleur foncée pour le badge que pour le bouton
  const darkerColor = `#${darkenColor(darkenColor(lineInfo?.route_color))}`;
  const mapButtonColor = `#${darkenColor(lineInfo?.route_color || '3b82f6')}`;

  return (
    <>
      <div className="navigation-controls" ref={navRef}>
        <button
          className="nav-button"
          onClick={onPreviousTrip}
          disabled={currentTripIndex === 0}
          style={currentTripIndex !== 0 ? buttonStyle : undefined}
        >
          <IoChevronBack />
        </button>
        
        {/* Bouton Plan Intéractif avec badge */}
        <div
          role="button"
          tabIndex={0}
          className="map-button"
          onClick={handleMapOpen}
          onKeyPress={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleMapOpen();
            }
          }}
          style={{
            backgroundColor: mapButtonColor,
            color: 'white',
            padding: '14px 25px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 10px',
            position: 'relative',
            border: 'none',
            transition: 'all 0.2s ease',
            transform: 'translateY(0)',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(2px)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)';
          }}
        >
          <FaMap style={{ marginRight: '10px', fontSize: '16px' }} />
          Plan Intéractif
          {vehicleCount > 0 && (
            <div style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              backgroundColor: mapButtonColor,
              color: 'white',
              borderRadius: '10%',
              width: '35px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              border: '1px solid white',
            
              zIndex: 10,
              transform: 'scale(1)',
             
            }}>
              <FaBus style={{ marginRight: '3px', fontSize: '10px' }} />
              {vehicleCount}
            </div>
          )}
        </div>
        
        <button
          className="nav-button"
          onClick={onNextTrip}
          disabled={currentTripIndex === trips.length - 1}
          style={currentTripIndex !== trips.length - 1 ? buttonStyle : undefined}
        >
          <IoChevronForward />
        </button>
      </div>

      <div className={`fixed-nav-arrows ${isFixed ? 'visible' : ''}`}>
        <button
          className="nav-button"
          onClick={onPreviousTrip}
          disabled={currentTripIndex === 0}
          style={currentTripIndex !== 0 ? buttonStyle : undefined}
        >
          <IoChevronBack />
        </button>
        <button
          className="nav-button"
          onClick={onNextTrip}
          disabled={currentTripIndex === trips.length - 1}
          style={currentTripIndex !== trips.length - 1 ? buttonStyle : undefined}
        >
          <IoChevronForward />
        </button>
      </div>
      
      {/* Animation pour le badge */}
      <style>
        {`
          .fixed-nav-arrows {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            justify-content: space-between;
            width: 90%; /* Ajustez la largeur comme vous le souhaitez */
            max-width: 500px; /* Optionnel: pour limiter la largeur sur de grands écrans */
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
          }

          .fixed-nav-arrows.visible {
            opacity: 1;
            visibility: visible;
          }

          @keyframes pulseAnimation {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </>
  );
};

export default TripNavigation; 