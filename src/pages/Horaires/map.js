import React, { useEffect, useRef, useState } from 'react';
import { FaTimes, FaBus } from 'react-icons/fa';
import { RiErrorWarningFill } from "react-icons/ri";
import ReactDOMServer from 'react-dom/server';
import * as turf from '@turf/turf';
import './map.css';
import { supabase } from '../../services/supabase';
import { fetchVehiclePositionData, fetchRealtimeData } from '../../services/realtime';
import { darkenColor } from '../../components/utils/ColorUtils';

// Déplacer le chargement du script en dehors du composant pour qu'il ne soit chargé qu'une seule fois
let mapboxPromise = null;
const getMapboxScript = () => {
  if (!mapboxPromise) {
    mapboxPromise = new Promise((resolve, reject) => {
      if (window.mapboxgl) {
        resolve(window.mapboxgl);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.async = true;
      script.onload = () => {
        if (window.mapboxgl) {
          // Configurer le token une seule fois globalement
          window.mapboxgl.accessToken = 'pk.eyJ1Ijoid2VpYmVsY2xlbWVudDYwIiwiYSI6ImNtMm9yZ3JpaDA4OGQybHIxcTBibHk4NXQifQ.iUZ4I9uI1lIWgamjWnDIYg';
          resolve(window.mapboxgl);
        } else {
          reject(new Error('Mapbox GL not available after loading script'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Mapbox GL script'));
      document.head.appendChild(script);
      
      // Ajouter aussi la feuille de style Mapbox
      if (!document.querySelector('link[href*="mapbox-gl.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        document.head.appendChild(link);
      }
    });
  }
  return mapboxPromise;
};

// Fonction pour déterminer si le texte doit être blanc ou noir selon la luminosité du fond
const getContrastTextColor = (bgColor) => {
  if (!bgColor) return 'FFFFFF';
  
  // Supprimer le # si présent
  bgColor = bgColor.replace('#', '');
  
  const r = parseInt(bgColor.slice(0, 2), 16);
  const g = parseInt(bgColor.slice(2, 4), 16);
  const b = parseInt(bgColor.slice(4, 6), 16);
  
  // Calcul de la luminosité (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Si la luminosité est élevée (couleur claire), on retourne du texte noir, sinon blanc
  return luminance > 0.5 ? '000000' : 'FFFFFF';
};

const RealtimeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" style={{ width: '12px', height: '12px', marginRight: '2px', marginTop: '0px', transform: 'rotate(230deg)' }}>
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
);

const WavyPlaceholder = ({ width = '120px', height = '20px' }) => (
  <div style={{
    width,
    height,
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'wave 1.5s infinite linear',
    borderRadius: '4px',
    display: 'inline-block'
  }}>
    <style>
      {`
        @keyframes wave {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}
    </style>
  </div>
);

const MapView = ({ isOpen, onClose, networkId, routeId, directionId, tripId, onVehiclePositionsUpdate }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const defaultTerminusMarkers = useRef([]);
  const vehicleStopElements = useRef({ layers: [], markers: [] });
  const [mapError, setMapError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [vehiclePositions, setVehiclePositions] = useState({});
  const vehicleMarkers = useRef({});
  const vehicleAnimationState = useRef({});

  const [selectedVehicleInfo, setSelectedVehicleInfo] = useState(null);
  const [selectedVehicleStops, setSelectedVehicleStops] = useState([]);
  const [vehicleDetailsLoading, setVehicleDetailsLoading] = useState(false);
  const [selectedVehicleShape, setSelectedVehicleShape] = useState(null);
  const [selectedVehiclePastShape, setSelectedVehiclePastShape] = useState(null);
  const [selectedVehicleBrand, setSelectedVehicleBrand] = useState(null);
  const [selectedVehicleModel, setSelectedVehicleModel] = useState(null);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [vehicleTripStops, setVehicleTripStops] = useState([]);
  const [displayedStops, setDisplayedStops] = useState([]);
  const [displayedRemainingMinutes, setDisplayedRemainingMinutes] = useState(null);

  const handleCloseVehicleDetails = () => {
    // Fermer la popup sans réinitialiser complètement les données du véhicule
    setIsPanelVisible(false);
    
    // Réinitialiser le tracé du véhicule
    setSelectedVehicleShape(null);
    setSelectedVehiclePastShape(null);

    // Réinitialiser l'opacité des véhicules sur la carte
    Object.values(vehicleMarkers.current).forEach(marker => {
      marker.getElement().style.opacity = '1';
      marker.getElement().classList.remove('selected-vehicle');
    });
  };

  const formatDelay = (delayInMinutes) => {
    if (!isFinite(delayInMinutes) || delayInMinutes === null) {
      return { text: '', class: '' };
    }
    
    const minutes = Math.round(delayInMinutes);

    if (minutes > 0) {
        return { text: `+${minutes} min`, class: 'late' };
    } else if (minutes < 0) {
        return { text: `${minutes} min`, class: 'early' };
    } else {
        return { text: '', class: 'ontime' };
    }
  };

  const loadVehicleDetails = async (vehicleData) => {
    const { tripId, routeId, lat, lon, label, vehicleId } = vehicleData;
    if (!tripId || !routeId) return;

    setVehicleDetailsLoading(true);
    setSelectedVehicleInfo(vehicleData);
    setSelectedVehicleStops([]);
    setSelectedVehicleShape(null);
    setSelectedVehiclePastShape(null);
    setSelectedVehicleBrand(null);
    setSelectedVehicleModel(null);
    setIsPanelVisible(true);
    setVehicleTripStops([]); // Vider les arrêts précédents
    
    try {
        // Récupérer le nom du sous-réseau si disponible
        const subnetworkName = routeInfo?.subnetwork_name || null;

        // 1. Récupérer les horaires des arrêts
        const { data: stopsData, error: stopsError } = await supabase
            .from('stop_times')
            .select('*, stops(stop_name, stop_lon, stop_lat, stop_desc)')
            .eq('trip_id', tripId)
            .eq('network_id', networkId)
            .order('stop_sequence');

        if (stopsError) throw stopsError;
        if (!stopsData || stopsData.length === 0) {
            setVehicleDetailsLoading(false);
            return;
        }

        console.log("[Vehicle Stops] Base data:", stopsData);

        // 2. Récupérer les données temps réel
        const realtimeData = await fetchRealtimeData(networkId, routeId, subnetworkName);
        console.log("[Vehicle Stops] Realtime data:", realtimeData);

        // 3. Traiter les données
        const processedStops = stopsData.map(stop => {
            // Extraire l'heure de départ théorique
            const departureTime = stop.departure_time;
            // Extraire juste l'heure et les minutes (format HH:MM)
            const timeDisplay = departureTime.substring(0, 5);
            
            // Valeurs par défaut
            let realtimeTime = '';
            let delay = 0;
            let isRealtime = false;
            let isSkipped = false;

            // Chercher les données temps réel
            if (realtimeData) {
                // Exemple de format: "tripId-stopId"
                const key = `${tripId}-${stop.stop_id}`;
                
                // Vérifier s'il y a un retard
                if (realtimeData.delays && realtimeData.delays[key] !== undefined) {
                    delay = realtimeData.delays[key];
                    isRealtime = true;
                    
                    // Calculer l'heure ajustée si on a un retard
                    if (departureTime) {
                        const [hours, minutes] = departureTime.split(':').map(Number);
                        const date = new Date();
                        date.setHours(hours, minutes, 0, 0);
                        date.setTime(date.getTime() + delay * 60000); // convertir en ms
                        
                        const realHours = String(date.getHours()).padStart(2, '0');
                        const realMinutes = String(date.getMinutes()).padStart(2, '0');
                        realtimeTime = `${realHours}:${realMinutes}`;
                    }
                }
                
                // Vérifier les horaires mis à jour directement si disponibles
                if (realtimeData.updatedTimes && realtimeData.updatedTimes[key]) {
                    const updatedTime = realtimeData.updatedTimes[key];
                    if (updatedTime.departureTime) {
                        realtimeTime = updatedTime.departureTime;
                        isRealtime = true;
                    }
                }
                
                // Vérifier si l'arrêt est supprimé
                if (realtimeData.skippedStops && realtimeData.skippedStops[key]) {
                    isSkipped = true;
                }
            }
            
            // Structure similaire à celle de la timeline
            return {
                ...stop,
                stop_name: stop.stops?.stop_name,
                stop_desc: stop.stops?.stop_desc,
                departure_time: timeDisplay,
                realtime_departure_time: realtimeTime || timeDisplay,
                delay: delay,
                isRealtime: isRealtime,
                isSkipped: isSkipped
            };
        });
        
        console.log("[Vehicle Stops] Processed with realtime:", processedStops);
        
        // Pour les lignes circulaires, on ne peut pas dédupliquer par stop_id
        // car le même arrêt peut être visité plusieurs fois avec des horaires différents
        
        // 1. Trier par heure de passage
        const sortedStops = [...processedStops].sort((a, b) => {
            // Convertir les heures en minutes depuis minuit pour faciliter la comparaison
            const timeToMinutes = (timeStr) => {
                if (!timeStr) return 0;
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours * 60 + minutes;
            };
            
            const timeA = timeToMinutes(a.realtime_departure_time);
            const timeB = timeToMinutes(b.realtime_departure_time);
            return timeA - timeB;
        });
        
        // 2. Pour l'affichage dans le panneau, filtrer pour ne montrer que les arrêts strictement futurs
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentMinutes = currentHour * 60 + currentMinute;
        console.log(`[Vehicle Stops] Current time: ${currentHour}:${currentMinute} (${currentMinutes} minutes)`);
        
        // Fenêtre de temps pour les arrêts à afficher (en minutes) - par défaut 120 minutes (2 heures)
        const timeWindow = 120;
        
        const futureStops = sortedStops.filter(stop => {
            if (!stop.realtime_departure_time) return false;
            
            const [hours, minutes] = stop.realtime_departure_time.split(':').map(Number);
            const stopMinutes = hours * 60 + minutes;
            
            console.log(`[Vehicle Stops] Stop time: ${hours}:${minutes} (${stopMinutes} minutes)`);
            
            // Gérer le cas où on passe minuit
            let adjustedStopMinutes = stopMinutes;
            let adjustedCurrentMinutes = currentMinutes;
            
            // Si l'heure de l'arrêt est après 22h et l'heure actuelle est avant 2h
            if (hours >= 22 && currentHour < 2) {
                adjustedCurrentMinutes = currentMinutes + 24 * 60; // Ajouter 24h à l'heure actuelle
            }
            // Si l'heure de l'arrêt est avant 2h et l'heure actuelle est après 22h
            else if (hours < 2 && currentHour >= 22) {
                adjustedStopMinutes = stopMinutes + 24 * 60; // Ajouter 24h à l'heure de l'arrêt
            }
            
            // N'inclure que les arrêts strictement futurs
            // Cela signifie que l'heure de l'arrêt doit être supérieure à l'heure actuelle
            return adjustedStopMinutes > adjustedCurrentMinutes;
        });
        
        console.log(`[Vehicle Stops] Filtered future stops: ${futureStops.length} out of ${sortedStops.length}`);
        
        // Calculer l'heure d'arrivée au terminus et le temps restant
        let arrivalTime = null;
        let remainingMinutes = null;
        
        if (futureStops.length > 0) {
            // Trouver le dernier arrêt (terminus)
            const lastStop = futureStops[futureStops.length - 1];
            
            if (lastStop && lastStop.realtime_departure_time) {
                // Utiliser l'heure de départ du dernier arrêt comme heure d'arrivée
                arrivalTime = lastStop.realtime_departure_time;
                
                // Calculer le temps restant en minutes
                const now = new Date();
                const [hours, minutes] = arrivalTime.split(':').map(Number);
                
                // Créer une date pour l'heure d'arrivée
                const arrivalDate = new Date();
                arrivalDate.setHours(hours, minutes, 0, 0);
                
                // Gérer le cas où l'arrivée est après minuit
                if (hours < 4 && now.getHours() > 20) {
                    arrivalDate.setDate(arrivalDate.getDate() + 1);
                }
                
                // Calculer la différence en minutes
                remainingMinutes = Math.round((arrivalDate - now) / (1000 * 60));
            }
        }
        
        // Mettre à jour les informations du véhicule avec l'heure d'arrivée et le temps restant
        setSelectedVehicleInfo(prev => ({
            ...prev,
            arrivalTime,
            remainingMinutes
        }));
        
        setSelectedVehicleStops(futureStops);

        // 4. Récupérer les informations du trip (dont le headsign)
        const { data: tripData, error: tripError } = await supabase
            .from('trips')
            .select('trip_headsign, shape_id')
            .eq('trip_id', tripId)
            .eq('network_id', networkId)
            .single();
                
        if (tripError) throw tripError;
            
        // Mettre à jour les informations du véhicule avec le headsign
        if (tripData?.trip_headsign) {
            setSelectedVehicleInfo(prev => ({
                ...prev,
                tripHeadsign: tripData.trip_headsign
            }));
        }

        // 4. Récupérer et traiter les données de tracé
        try {
            if (tripData?.shape_id) {
                const { data: shapeData, error: shapeError } = await supabase
                    .from('shapes')
                    .select('shape_pt_lat, shape_pt_lon')
                    .eq('shape_id', tripData.shape_id)
                    .eq('network_id', networkId)
                    .order('shape_pt_sequence');
                    
                if (shapeError) throw shapeError;
                
                if (shapeData) {
                    const coordinates = shapeData.map(p => [p.shape_pt_lon, p.shape_pt_lat]);
                    setSelectedVehicleShape(coordinates);

                    // Calculer la partie passée du tracé avec Turf.js
                    if (coordinates.length > 1) {
                        const vehiclePoint = turf.point([lon, lat]);
                        const shapeLine = turf.lineString(coordinates);
                        const snapped = turf.nearestPointOnLine(shapeLine, vehiclePoint);
                        const startPoint = turf.point(coordinates[0]);
                        const pastLine = turf.lineSlice(startPoint, snapped, shapeLine);
                        setSelectedVehiclePastShape(pastLine.geometry.coordinates);
                    }
                }
            }
        } catch (err) {
            console.warn("Error processing shape data:", err);
        }

        // 5. Récupérer les détails du véhicule (marque et modèle)
        if (vehicleId && networkId) {
            try {
                const { data: vehicleDetails, error: vehicleDetailsError } = await supabase
                    .from('vehicle_details')
                    .select('brand, model')
                    .eq('network_id', networkId)
                    .eq('vehicle_id', vehicleId)
                    .single();

                if (vehicleDetailsError) {
                    if (vehicleDetailsError.code !== 'PGRST116') {
                        console.error("[Vehicle Details] Error fetching details:", vehicleDetailsError);
                    }
                } else if (vehicleDetails) {
                    setSelectedVehicleBrand(vehicleDetails.brand);
                    setSelectedVehicleModel(vehicleDetails.model);
                }
            } catch (err) {
                console.error("Error fetching vehicle details:", err);
            }
        }

        // Stocker la liste complète des arrêts du trajet
        setVehicleTripStops(sortedStops);
    } catch (err) {
        console.error("Erreur lors de la récupération des détails du trajet du véhicule:", err);
    } finally {
        setVehicleDetailsLoading(false);
    }
  };

  useEffect(() => {
    // Si la carte ne doit pas être ouverte, on ne fait rien.
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    const markers = []; // Garder une trace des marqueurs pour les supprimer

    const initializeAndLoadMap = async () => {
      if (!networkId || !routeId) {
        setMapError("Les informations sur la ligne sont manquantes.");
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setMapError(null);
      setRouteInfo(null);

      try {
        // --- 1. Récupérer les données de la ligne en premier ---
        const { data, error } = await supabase.rpc('get_route_map_data', {
          p_network_id: networkId,
          p_route_id: routeId,
          p_direction_id: directionId,
          p_trip_id: tripId,
        });

        if (error) throw error;
        if (!isMounted) return; // Annuler si le composant a été démonté

        setRouteInfo(data.route);
        
        // --- 2. Calculer les limites géographiques à partir des données ---
        const mapboxgl = await getMapboxScript();
        const bounds = new mapboxgl.LngLatBounds();
        
        const hasShape = data.shape && data.shape.length > 0;
        const hasStops = data.stops && data.stops.length > 0;

        if (hasShape) {
          data.shape.forEach(point => bounds.extend([point.lon, point.lat]));
        } else if (hasStops) {
          data.stops.forEach(stop => bounds.extend([stop.stop_lon, stop.stop_lat]));
        } else {
          throw new Error("Aucune donnée géographique trouvée pour cette ligne.");
        }

        if (bounds.isEmpty()) {
            throw new Error("Les coordonnées géographiques de la ligne sont invalides.");
        }

        // --- 3. Initialiser la carte directement avec les bonnes limites ---
        if (mapContainer.current) {
          map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            bounds: bounds,
            fitBoundsOptions: {
              padding: 60,
              maxZoom: 16
            },
            attributionControl: false,
            dragRotate: false,
            touchPitch: false,
            bearing: 0,
            pitchWithRotate: false
          });

          // Forcer la rotation à 0 à chaque tentative de rotation
          map.current.once('load', () => {
            if (!isMounted) return;
            
            // Désactiver la rotation
            map.current.setBearing(0);
            map.current.on('rotate', () => {
              map.current.setBearing(0);
            });

            map.current.addControl(new mapboxgl.NavigationControl({
              showCompass: false,
              showZoom: true
            }), 'bottom-right');

            // --- 4. Dessiner le tracé et les arrêts sur la carte ---
            if (hasShape) {
                const routeColor = data.route?.route_color ? `#${data.route.route_color}` : '#3B82F6';
                const darkenedColor = '#' + darkenColor(routeColor.replace('#', ''), 0.8);
                map.current.addSource('route-line', {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'geometry': { 'type': 'LineString', 'coordinates': data.shape.map(p => [p.lon, p.lat]) }
                    }
                });
                map.current.addLayer({
                    'id': 'route-line-layer', 'type': 'line', 'source': 'route-line',
                    'layout': { 'line-join': 'round', 'line-cap': 'round' },
                    'paint': { 
                        'line-color': darkenedColor, 
                        'line-width': 5, 
                        'line-opacity': 0.75,
                        'line-opacity-transition': { 'duration': 400 }
                    }
                });
            }

            if (hasStops) {
              const routeColor = data.route?.route_color ? `#${data.route.route_color}` : '#3B82F6';
              const darkenedColor = '#' + darkenColor(routeColor.replace('#', ''), 0.8);

              // Arrêts intermédiaires
              const intermediateStopsFeatures = data.stops
                  .filter((stop, index) => index > 0 && index < data.stops.length - 1 && stop.stop_lon && stop.stop_lat)
                  .map(stop => ({
                      type: 'Feature',
                      geometry: { type: 'Point', coordinates: [stop.stop_lon, stop.stop_lat] },
                      properties: { title: stop.stop_name }
                  }));

              if (intermediateStopsFeatures.length > 0) {
                  map.current.addSource('default-stops-source', {
                      type: 'geojson',
                      data: { type: 'FeatureCollection', features: intermediateStopsFeatures }
                  });
                  map.current.addLayer({
                      id: 'default-stops-points',
                      type: 'circle',
                      source: 'default-stops-source',
                      paint: { 'circle-radius': 6, 'circle-color': '#FFFFFF', 'circle-stroke-width': 2, 'circle-stroke-color': darkenedColor }
                  });
                  map.current.addLayer({
                      id: 'default-stops-labels',
                      type: 'symbol',
                      source: 'default-stops-source',
                      layout: { 'text-field': ['get', 'title'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1], 'text-allow-overlap': false, 'visibility': 'visible' },
                      paint: { 'text-color': '#000000', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }
                  });
              }
              
              // Marqueurs des terminus
              data.stops.forEach((stop, index) => {
                  if (index === 0 || index === data.stops.length - 1) {
                      const el = document.createElement('div');
                      el.className = 'terminus-wrapper';
                      const point = document.createElement('div');
                      point.className = 'terminus-point';
                      point.style.borderColor = darkenedColor;
                      const label = document.createElement('div');
                      label.className = 'terminus-name-label';
                      label.innerText = `${index === 0 ? 'De : ' : 'Vers : '}${stop.stop_name}`;
                      el.appendChild(point);
                      el.appendChild(label);
                      
                      const marker = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
                          .setLngLat([stop.stop_lon, stop.stop_lat])
                          .addTo(map.current);
                      defaultTerminusMarkers.current.push(marker);
                  }
              });
            }
            setLoading(false);
          });
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation de la carte:", err);
        if (isMounted) {
          setMapError(err.message);
          setLoading(false);
        }
      }
    };

    initializeAndLoadMap();

    // Fonction de nettoyage
    return () => {
      isMounted = false;
      defaultTerminusMarkers.current.forEach(marker => marker.remove());
      defaultTerminusMarkers.current = [];
      Object.values(vehicleMarkers.current).forEach(marker => marker.remove());
      vehicleMarkers.current = {};
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isOpen, networkId, routeId, directionId, tripId]);

  // Effet pour le tracé du voyage sélectionné
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !routeInfo) return;

    const mapInstance = map.current;
    
    // ID des couches
    const defaultRouteLayerId = 'route-line-layer';
    const vehicleFutureShapeLayerId = 'vehicle-future-shape-layer';
    const vehiclePastShapeLayerId = 'vehicle-past-shape-layer';

    const routeColor = routeInfo.route_color ? `#${routeInfo.route_color}` : '#3B82F6';
    const darkenedColor = '#' + darkenColor(routeColor.replace('#', ''), 0.8);

    // Fonction pour ajouter/mettre à jour une couche de tracé
    const addOrUpdateShapeLayer = (id, data, color, opacity = 1, lineStyle = 'solid') => {
        const source = mapInstance.getSource(id);
        const geojsonData = data ? { type: 'Feature', geometry: { type: 'LineString', coordinates: data } } : null;

        if (source && geojsonData) {
            source.setData(geojsonData);
            mapInstance.setPaintProperty(id, 'line-opacity', opacity);
        } else if (geojsonData) {
            mapInstance.addSource(id, { type: 'geojson', data: geojsonData });
            mapInstance.addLayer({
                id: id,
                type: 'line',
                source: id,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': color,
                    'line-width': 5,
                    'line-opacity': 0,
                    'line-opacity-transition': { duration: 300 },
                    ...(lineStyle === 'dashed' && { 'line-dasharray': [2, 2] })
                }
            }, defaultRouteLayerId);
            
            setTimeout(() => {
                if(mapInstance.getLayer(id)) mapInstance.setPaintProperty(id, 'line-opacity', opacity);
            }, 50);
        } else if (mapInstance.getLayer(id)) {
            mapInstance.setPaintProperty(id, 'line-opacity', 0);
        }
    };
    
    // Gérer l'affichage
    if (selectedVehicleShape) {
        // Un véhicule est sélectionné
        mapInstance.setPaintProperty(defaultRouteLayerId, 'line-opacity', 0);
        addOrUpdateShapeLayer(vehicleFutureShapeLayerId, selectedVehicleShape, darkenedColor, 0.85);
        addOrUpdateShapeLayer(vehiclePastShapeLayerId, selectedVehiclePastShape, '#A9A9A9', 0.75); // Gris pour le passé
    } else {
        // Aucun véhicule n'est sélectionné
        mapInstance.setPaintProperty(defaultRouteLayerId, 'line-opacity', 0.75);
        addOrUpdateShapeLayer(vehicleFutureShapeLayerId, null, darkenedColor);
        addOrUpdateShapeLayer(vehiclePastShapeLayerId, null, '#A9A9A9');
    }
  }, [selectedVehicleShape, selectedVehiclePastShape, routeInfo]);

  // Effet pour gérer l'affichage des arrêts (par défaut vs véhicule)
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !routeInfo) return;

    const mapInstance = map.current;
    let isEffectCancelled = false;

    const toggleDefaultStops = (visible) => {
        const visibility = visible ? 'visible' : 'none';
        ['default-stops-points', 'default-stops-labels'].forEach(layerId => {
            if (mapInstance.getLayer(layerId)) {
                mapInstance.setLayoutProperty(layerId, 'visibility', visibility);
            }
        });
        defaultTerminusMarkers.current.forEach(marker => {
            marker.getElement().style.visibility = visible ? 'visible' : 'hidden';
        });
    };

    const clearVehicleStopElements = () => {
        vehicleStopElements.current.markers.forEach(m => m.remove());
        vehicleStopElements.current.layers.forEach(id => {
            if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
        });
        if (mapInstance.getSource('vehicle-stops-source')) {
            mapInstance.removeSource('vehicle-stops-source');
        }
        vehicleStopElements.current = { layers: [], markers: [] };
    };

    clearVehicleStopElements();

    if (selectedVehicleInfo && selectedVehicleInfo.tripId) {
        toggleDefaultStops(false);

        // Récupérer tous les arrêts pour ce trip, sans filtrage
        supabase
            .from('stop_times')
            .select('*, stops(stop_name, stop_lon, stop_lat, stop_desc)')
            .eq('trip_id', selectedVehicleInfo.tripId)
            .eq('network_id', networkId)
            .order('stop_sequence')
            .then(({ data: allStopsData, error }) => {
                if (isEffectCancelled || error || !allStopsData || allStopsData.length === 0) {
                    return;
                }

                const stopsWithCoords = allStopsData.filter(s => s.stops?.stop_lon && s.stops?.stop_lat);
        if (stopsWithCoords.length === 0) return;

        const routeColor = routeInfo.route_color ? `#${routeInfo.route_color}` : '#3B82F6';
        const darkenedColor = '#' + darkenColor(routeColor.replace('#', ''), 0.8);

        // Séparer les arrêts terminus des arrêts intermédiaires
        const firstStop = stopsWithCoords[0];
        const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
        const intermediateStops = stopsWithCoords.length > 2 ? stopsWithCoords.slice(1, stopsWithCoords.length - 1) : [];

        // 1. Afficher les arrêts intermédiaires (points et étiquettes via GeoJSON)
        if (intermediateStops.length > 0) {
            const features = intermediateStops.map(stop => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [stop.stops.stop_lon, stop.stops.stop_lat] },
                properties: { title: stop.stops.stop_name }
            }));

            mapInstance.addSource('vehicle-stops-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: features }
            });

            const pointsLayerId = 'vehicle-stops-points';
            mapInstance.addLayer({
                id: pointsLayerId,
                type: 'circle',
                source: 'vehicle-stops-source',
                paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': darkenedColor }
            });
            vehicleStopElements.current.layers.push(pointsLayerId);

            const labelsLayerId = 'vehicle-stops-labels';
            mapInstance.addLayer({
                id: labelsLayerId,
                type: 'symbol',
                source: 'vehicle-stops-source',
                layout: { 'text-field': ['get', 'title'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 0.8], 'text-allow-overlap': false },
                paint: { 'text-color': '#000000', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
            });
            vehicleStopElements.current.layers.push(labelsLayerId);
        }
        
        // 2. Toujours afficher les marqueurs de départ et d'arrivée distinctement
        [firstStop, lastStop].forEach((stop, index) => {
            if (!stop) return;
            
            const el = document.createElement('div');
            el.className = 'terminus-wrapper';
            const point = document.createElement('div');
            point.className = 'terminus-point';
            point.style.borderColor = darkenedColor;
            const label = document.createElement('div');
            label.className = 'terminus-name-label';
            label.innerText = `${index === 0 ? 'De : ' : 'Vers : '}${stop.stops.stop_name}`;
            el.appendChild(point);
            el.appendChild(label);
            
            const marker = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([stop.stops.stop_lon, stop.stops.stop_lat])
                .addTo(map.current);
            vehicleStopElements.current.markers.push(marker);
        });
            });
    } else {
        toggleDefaultStops(true);
    }

    return () => {
      isEffectCancelled = true;
    };
  }, [selectedVehicleInfo, routeInfo, networkId]);

  // Effet pour empêcher le scroll de la carte lors du scroll dans la popup
  useEffect(() => {
    if (!isPanelVisible) return;
    
    const stopPropagation = (e) => {
      e.stopPropagation();
    };
    
    const preventMapScroll = (e) => {
      // Empêcher le défilement de la carte
      e.stopPropagation();
      // Ne pas bloquer le défilement naturel dans la popup
    };
    
    const nextStopsColumn = document.querySelector('.next-stops-column');
    const nextStopsList = document.querySelector('.next-stops-list');
    
    if (nextStopsColumn) {
      nextStopsColumn.addEventListener('wheel', preventMapScroll);
      nextStopsColumn.addEventListener('touchmove', preventMapScroll);
      nextStopsColumn.addEventListener('scroll', stopPropagation);
    }
    
    if (nextStopsList) {
      nextStopsList.addEventListener('wheel', preventMapScroll);
      nextStopsList.addEventListener('touchmove', preventMapScroll);
      nextStopsList.addEventListener('scroll', stopPropagation);
    }
    
    return () => {
      if (nextStopsColumn) {
        nextStopsColumn.removeEventListener('wheel', preventMapScroll);
        nextStopsColumn.removeEventListener('touchmove', preventMapScroll);
        nextStopsColumn.removeEventListener('scroll', stopPropagation);
      }
      
      if (nextStopsList) {
        nextStopsList.removeEventListener('wheel', preventMapScroll);
        nextStopsList.removeEventListener('touchmove', preventMapScroll);
        nextStopsList.removeEventListener('scroll', stopPropagation);
      }
    };
  }, [isPanelVisible]);

  // Effet pour charger les positions des véhicules
  useEffect(() => {
    if (!isOpen || !networkId || !routeId) {
      return;
    }

    const loadVehiclePositions = async () => {
      try {
        const data = await fetchVehiclePositionData(networkId);
        if (data && Object.keys(data).length > 0) {
          // Utiliser le timestamp le plus récent de l'API comme référence pour éviter les pbs de synchro d'horloge
          const latestApiTimestamp = Math.max(...Object.values(data).map(v => parseInt(v.timestamp, 10)).filter(t => !isNaN(t)));

          const filteredPositions = {};
          
          // Obtenir le timestamp actuel en secondes
          const currentTimestamp = Math.floor(Date.now() / 1000);
          
          // Filtrer les véhicules dont le timestamp est à jour (moins de 2 minutes d'écart)
          Object.entries(data).forEach(([vehicleId, vehicleData]) => {
            if (vehicleData.routeId === routeId) {
              const vehicleTimestamp = parseInt(vehicleData.timestamp, 10);
              
              // Si le timestamp du véhicule est récent (moins de 2 minutes)
              // OU si le timestamp est 0 (certaines APIs comme BIBUS retournent toujours 0)
              if (vehicleTimestamp === 0 || (vehicleTimestamp && (currentTimestamp - vehicleTimestamp < 120))) {
                filteredPositions[vehicleId] = vehicleData;
              }
            }
          });
          setVehiclePositions(filteredPositions);
          
          // Mettre à jour les positions des véhicules dans le composant parent
          if (onVehiclePositionsUpdate) {
            onVehiclePositionsUpdate(filteredPositions);
          }
        } else if (data) {
          // Si l'API renvoie un objet vide, on vide aussi les positions
          setVehiclePositions({});
          if (onVehiclePositionsUpdate) {
            onVehiclePositionsUpdate({});
          }
        }
      } catch (err) {
        console.error('Erreur lors du chargement des positions des véhicules:', err);
      }
    };

    loadVehiclePositions();
    const intervalId = setInterval(loadVehiclePositions, 15000);

    return () => clearInterval(intervalId);
  }, [isOpen, networkId, routeId, onVehiclePositionsUpdate]);

  // Effet pour mettre à jour les marqueurs des véhicules
  useEffect(() => {
    if (!map.current || !routeInfo) return;

    // Attendre que la carte soit complètement chargée avec tous les autres éléments
    if (!map.current.isStyleLoaded()) {
      const checkMapLoaded = setInterval(() => {
        if (map.current && map.current.isStyleLoaded()) {
          clearInterval(checkMapLoaded);
          updateVehicleMarkers();
        }
      }, 100);
      return () => clearInterval(checkMapLoaded);
    }

    updateVehicleMarkers();

    function updateVehicleMarkers() {
      const positions = vehiclePositions;
      const existingMarkerIds = Object.keys(vehicleMarkers.current);
      const currentVehicleIds = new Set(Object.keys(positions));
      const routeColor = `#${routeInfo.route_color || '3B82F6'}`;
      const darkenedColor = '#' + darkenColor(routeColor.replace('#', ''), 0.8);

      const isColorDark = (hexColor) => {
        if (!hexColor) return true;
        const color = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128;
      };
      
      const now = performance.now();

      // Supprimer les marqueurs obsolètes
      existingMarkerIds.forEach(vehicleId => {
        if (!currentVehicleIds.has(vehicleId)) {
          if (vehicleMarkers.current[vehicleId]) {
            const state = vehicleAnimationState.current[vehicleId];
            if (state?.animationFrameId) {
              cancelAnimationFrame(state.animationFrameId);
            }
            vehicleMarkers.current[vehicleId].remove();
            delete vehicleMarkers.current[vehicleId];
            delete vehicleAnimationState.current[vehicleId];
          }
        }
      });

      // Ajouter ou mettre à jour les marqueurs
      Object.entries(positions).forEach(([vehicleId, data]) => {
        const { lat, lon, bearing } = data;
        const newTargetPos = { lon, lat };
        const isSelected = selectedVehicleInfo?.vehicleId === vehicleId && isPanelVisible;

        if (vehicleMarkers.current[vehicleId]) {
          // --- Marqueur existant ---
          const marker = vehicleMarkers.current[vehicleId];
          const currentPos = marker.getLngLat();
          const currentState = vehicleAnimationState.current[vehicleId] || {
            lastPos: { lon: currentPos.lng, lat: currentPos.lat },
            targetPos: { lon: currentPos.lng, lat: currentPos.lat },
            animationFrameId: null
          };

          if (currentState.targetPos.lon !== newTargetPos.lon || currentState.targetPos.lat !== newTargetPos.lat) {
            if (currentState.animationFrameId) {
              cancelAnimationFrame(currentState.animationFrameId);
            }

            currentState.lastPos = { lon: currentPos.lng, lat: currentPos.lat };
            currentState.targetPos = newTargetPos;
            currentState.startTime = now;

            const animate = (timestamp) => {
              if (!currentState.startTime) currentState.startTime = timestamp;
              const progress = Math.min(1, (timestamp - currentState.startTime) / 1000);
              
              const newLng = currentState.lastPos.lon + (newTargetPos.lon - currentState.lastPos.lon) * progress;
              const newLat = currentState.lastPos.lat + (newTargetPos.lat - currentState.lastPos.lat) * progress;
              
              marker.setLngLat([newLng, newLat]);

              if (progress < 1) {
                currentState.animationFrameId = requestAnimationFrame(animate);
              } else {
                currentState.animationFrameId = null;
              }
            };

            currentState.animationFrameId = requestAnimationFrame(animate);
            vehicleAnimationState.current[vehicleId] = currentState;
          }

          // Gérer le style sélectionné/non sélectionné
          const markerElement = marker.getElement();
          
          // Mettre à jour l'opacité en fonction de la sélection, mais seulement si le panneau est visible
          if (selectedVehicleInfo && isPanelVisible) {
              markerElement.style.opacity = isSelected ? '1' : '0.4';
          } else {
              markerElement.style.opacity = '1';
          }

          // Ajouter ou supprimer la classe selected-vehicle en fonction de la sélection
          if (isSelected) {
              markerElement.classList.add('selected-vehicle');
          } else {
              markerElement.classList.remove('selected-vehicle');
          }

          const arrowContainer = markerElement.querySelector('.vehicle-arrow-container');
          if (arrowContainer) {
              arrowContainer.style.transform = `rotate(${bearing !== null ? bearing : 0}deg)`;
          }

        } else {
          // --- Nouveau marqueur ---
          const el = document.createElement('div');
          el.className = 'vehicle-marker';

          // Appliquer le style sélectionné/non sélectionné même aux nouveaux marqueurs
          if (selectedVehicleInfo && isPanelVisible) {
            el.style.opacity = isSelected ? '1' : '0.2';
          }
          if (isSelected) {
            el.classList.add('selected-vehicle');
          }
          
          if (data.tripId) {
            el.onclick = () => {
              if (selectedVehicleInfo && selectedVehicleInfo.vehicleId === data.vehicleId) {
                setIsPanelVisible(!isPanelVisible);
              } else {
                loadVehicleDetails(data);
              }
            };
          }

          const busIconHTML = ReactDOMServer.renderToString(
            <FaBus size={18} color={'#' + getContrastTextColor(darkenedColor)} />
          );

          el.innerHTML = `
            <div class="vehicle-background" style="background-color: ${darkenedColor};">
              <div class="bus-icon-container">${busIconHTML}</div>
              <div class="vehicle-arrow-container" style="transform: rotate(${bearing !== null ? bearing : 0}deg);">
                <div class="vehicle-arrow">
                  <svg viewBox="0 0 14 14" width="14" height="14">
                    <polygon points="7,0 14,14 0,14" fill="${darkenedColor}"/>
                    <polygon points="7,3 11.5,12 2.5,12" fill="${isColorDark(darkenedColor) ? '#FFFFFF' : '#000000'}"/>
                  </svg>
                </div>
              </div>
            </div>
          `;

          // Créer le marqueur avec une priorité d'affichage élevée
          const marker = new window.mapboxgl.Marker({
            element: el,
            anchor: 'center'
          })
          .setLngLat([lon, lat])
          .addTo(map.current);

          vehicleMarkers.current[vehicleId] = marker;
          vehicleAnimationState.current[vehicleId] = {
            lastPos: { lon, lat },
            targetPos: { lon, lat },
            startTime: now,
            animationFrameId: null
          };
        }
      });
    }
  }, [vehiclePositions, routeInfo, selectedVehicleInfo, isPanelVisible]);

  // Conserver l'effet pour s'assurer que les véhicules sont au-dessus quand la carte bouge
  useEffect(() => {
    if (!map.current) return;

    const onMapMove = () => {
      // Pour tous les véhicules actuellement affichés
      const vehicleIds = Object.keys(vehicleMarkers.current);
      if (vehicleIds.length > 0) {
        // Prendre une "photo" de l'état actuel de chaque marqueur
        const tempMarkerData = vehicleIds.map(id => {
          const marker = vehicleMarkers.current[id];
          const element = marker.getElement().cloneNode(true);
          const lngLat = marker.getLngLat();
          
          // Conserver l'état de l'animation
          const animState = vehicleAnimationState.current[id];
          if (animState?.animationFrameId) {
            cancelAnimationFrame(animState.animationFrameId);
          }
          
          // Supprimer le marqueur actuel
          marker.remove();
          
          return { id, lngLat, element, animState };
        });

        // Recréer tous les marqueurs pour s'assurer qu'ils sont au-dessus
        tempMarkerData.forEach(({ id, lngLat, element, animState }) => {
          const newMarker = new window.mapboxgl.Marker({
            element: element,
            anchor: 'center'
          })
          .setLngLat(lngLat)
          .addTo(map.current);
          
          vehicleMarkers.current[id] = newMarker;
          
          // Restaurer l'état de l'animation si nécessaire
          if (animState) {
            vehicleAnimationState.current[id] = animState;
            vehicleAnimationState.current[id].animationFrameId = null;
          }
        });
      }
    };

    // Déclencher la réorganisation des marqueurs lors des mouvements de carte
    map.current.on('zoom', onMapMove);
    map.current.on('dragend', onMapMove);
    
    return () => {
      if (map.current) {
        map.current.off('zoom', onMapMove);
        map.current.off('dragend', onMapMove);
      }
    };
  }, []);

  // Effet pour actualiser l'affichage (temps restant et arrêts) toutes les 10 secondes
  useEffect(() => {
    if (!isPanelVisible || vehicleTripStops.length === 0) {
      return;
    }

    const updateDisplay = () => {
      // 1. Filtrer pour les arrêts futurs
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentMinutes = currentHour * 60 + currentMinute;

      const futureStops = vehicleTripStops.filter(stop => {
        if (!stop.realtime_departure_time) return false;
        
        const [hours, minutes] = stop.realtime_departure_time.split(':').map(Number);
        const stopMinutes = hours * 60 + minutes;
        
        let adjustedStopMinutes = stopMinutes;
        let adjustedCurrentMinutes = currentMinutes;
        
        if (hours < 4 && currentHour >= 22) {
            adjustedStopMinutes = stopMinutes + 24 * 60;
        } else if (currentHour < 4 && hours >= 22) {
            adjustedCurrentMinutes = currentMinutes + 24 * 60;
        }
        
        return adjustedStopMinutes >= adjustedCurrentMinutes;
      });
      setDisplayedStops(futureStops);

      // 2. Calculer le temps restant
      const lastStop = vehicleTripStops[vehicleTripStops.length - 1];
      if (lastStop && lastStop.realtime_departure_time) {
        const arrivalTime = lastStop.realtime_departure_time;
        const [hours, minutes] = arrivalTime.split(':').map(Number);
        const arrivalDate = new Date();
        arrivalDate.setHours(hours, minutes, 0, 0);

        if (hours < 4 && now.getHours() > 20) {
          arrivalDate.setDate(arrivalDate.getDate() + 1);
        }
        
        const newRemainingMinutes = Math.max(0, Math.round((arrivalDate - now) / (1000 * 60)));
        setDisplayedRemainingMinutes(newRemainingMinutes);
      }
    };

    updateDisplay(); // Mise à jour initiale
    const intervalId = setInterval(updateDisplay, 10000); // Rafraîchir toutes les 10 secondes

    return () => clearInterval(intervalId);
  }, [isPanelVisible, vehicleTripStops]);

  // Effet pour actualiser les données du véhicule sélectionné toutes les 30 secondes
  useEffect(() => {
    // Si aucun véhicule n'est sélectionné ou si le panneau n'est pas visible, ne rien faire
    if (!selectedVehicleInfo || !isPanelVisible) {
      return;
    }

    // Fonction pour rafraîchir les détails
    const refreshVehicleDetails = () => {
      if (selectedVehicleInfo && selectedVehicleInfo.vehicleId) {
        // Vérifier si la position du véhicule a été mise à jour
        const currentVehicleData = vehiclePositions[selectedVehicleInfo.vehicleId];
        if (currentVehicleData) {
          loadVehicleDetails(currentVehicleData);
        }
      }
    };

    // Actualiser les détails toutes les 30 secondes
    const intervalId = setInterval(refreshVehicleDetails, 30000);

    // Nettoyer l'intervalle lors du démontage
    return () => clearInterval(intervalId);
  }, [selectedVehicleInfo, isPanelVisible, vehiclePositions]);

  // Effet pour mettre à jour le tracé passé du véhicule lorsqu'il se déplace
  useEffect(() => {
    // S'assurer que nous avons toutes les données nécessaires
    if (!selectedVehicleShape || !selectedVehicleInfo || !vehiclePositions[selectedVehicleInfo.vehicleId]) {
      return;
    }

    const vehicleData = vehiclePositions[selectedVehicleInfo.vehicleId];
    const { lat, lon } = vehicleData;
    const coordinates = selectedVehicleShape;

    // Calculer le nouveau tracé passé
    if (coordinates.length > 1) {
      try {
        const vehiclePoint = turf.point([lon, lat]);
        const shapeLine = turf.lineString(coordinates);
        
        // Trouver le point le plus proche sur la ligne
        const snapped = turf.nearestPointOnLine(shapeLine, vehiclePoint);
        
        // Définir le point de départ du tracé
        const startPoint = turf.point(coordinates[0]);
        
        // Couper la ligne du début jusqu'au point 'snapped'
        const pastLine = turf.lineSlice(startPoint, snapped, shapeLine);
        
        // Mettre à jour l'état avec les nouvelles coordonnées du tracé passé
        setSelectedVehiclePastShape(pastLine.geometry.coordinates);
      } catch (error) {
        console.error("Erreur lors de la mise à jour du tracé passé:", error);
      }
    }
  }, [vehiclePositions, selectedVehicleInfo, selectedVehicleShape]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="map-overlay">
      <div ref={mapContainer} className="map-container" />
      
      {loading && (
        <div className="map-loading">
          <div className="map-spinner"></div>
        </div>
      )}
      
      <button onClick={onClose} className="map-close-button" aria-label="Fermer la carte">
        <FaTimes size={20} />
      </button>
      
      {mapError && (
        <div className="map-error">
          <p>{mapError}</p>
        </div>
      )}
      
      {routeInfo && !loading && (
        <div className="map-route-info">
          <div 
            className="route-badge" 
            style={{ 
              backgroundColor: '#' + darkenColor((routeInfo.route_color || '3B82F6')),
              color: '#' + getContrastTextColor(darkenColor((routeInfo.route_color || '3B82F6')))
            }}
          >
            {routeInfo.route_short_name}
          </div>
        
        </div>
      )}

      {selectedVehicleInfo && (
        <div className={`vehicle-details-panel ${isPanelVisible ? 'visible' : ''}`}>
            <div className="vehicle-details-header">
                <div className="header-content">
                                            <div className="route-header-info" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div 
                                className="route-number" 
                                style={{ 
                                    backgroundColor: routeInfo ? 
                                        '#' + darkenColor((routeInfo.route_color || '3B82F6')) : 
                                        '#3B82F6',
                                    color: routeInfo ? 
                                        '#' + getContrastTextColor(darkenColor((routeInfo.route_color || '3B82F6'))) : 
                                        '#FFFFFF'
                                }}
                            >
                                {routeInfo?.route_short_name || ''}
                            </div>
                            <div className="route-terminus" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {vehicleDetailsLoading ? (
                                    <WavyPlaceholder width="180px" height="24px" />
                                ) : (
                                    <>
                                        <div style={{ fontWeight: 'bold' }}>vers {selectedVehicleInfo.tripHeadsign}</div>
                                        {selectedVehicleInfo.arrivalTime && displayedRemainingMinutes !== null && (
                                            <>
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center',
                                                    gap: '2px'
                                                }}>
                                                    <span>dans </span>
                                                    <RealtimeIcon />
                                                    <span className={displayedRemainingMinutes < 1 ? 'blink-fade' : ''}>
                                                        {displayedRemainingMinutes < 1 ? '<1' : String(displayedRemainingMinutes).padStart(2, '0')} min
                                                    </span>
                                                </div>
                                                <style>
                                                    {`
                                                        @keyframes blinkFade {
                                                            0% { opacity: 1; }
                                                            50% { opacity: 0.3; }
                                                            100% { opacity: 1; }
                                                        }
                                                        .blink-fade {
                                                            animation: blinkFade 2s infinite;
                                                        }
                                                    `}
                                                </style>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    
                    <div className="vehicle-header-info">
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            width: '100%',
                            gap: '8px'
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                gap: '8px',
                                flex: 1
                            }}>
                                <FaBus 
                                    className="vehicle-icon-small" 
                                    size={16} 
                                    color={routeInfo ? 
                                        '#' + darkenColor((routeInfo.route_color || '3B82F6')) : 
                                        '#3B82F6'
                                    } 
                                />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {selectedVehicleBrand && (
                                        <span className="vehicle-header-text" style={{ lineHeight: '1.2' }}>
                                            {selectedVehicleBrand}
                                        </span>
                                    )}
                                    {selectedVehicleModel && (
                                        <span className="vehicle-header-text" style={{ lineHeight: '1.2' }}>
                                            {selectedVehicleModel}
                                        </span>
                                    )}
                                    {!selectedVehicleBrand && !selectedVehicleModel && (
                                        <span className="vehicle-header-text">Véhicule</span>
                                    )}
                                </div>
                            </div>
                            {selectedVehicleInfo.vehicleId && (
                                <span className="vehicle-id" style={{ marginLeft: 'auto' }}>#{selectedVehicleInfo.vehicleId}</span>
                            )}
                        </div>
                    </div>
                </div>
                
                <button onClick={handleCloseVehicleDetails} className="close-panel-button">
                    <FaTimes size={32} />
                </button>
            </div>
            
            <div className="vehicle-details-content" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Section info véhicule et temps restant */}
                <div style={{ 
                    padding: '0px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                </div>

                {/* Section liste des arrêts */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <div className="next-stops-list" style={{ paddingTop: '0' }}>
                        <div className="stops-header">Prochains arrêts</div>
                        {vehicleDetailsLoading ? (
                            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {['140px', '180px', '160px', '200px', '130px'].map((width, index) => (
                                    <div key={index} className="next-stop-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <div className="next-stop-name">
                                            <WavyPlaceholder width={width} height="18px" />
                                        </div>
                                        <div className="next-stop-time">
                                            <WavyPlaceholder width="50px" height="16px" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : displayedStops.length > 0 ? (
                            displayedStops.map((stop, index) => {
                                const isLast = index === displayedStops.length - 1;
                                const isTimelineFormat = 'realtime_departure_time' in stop && 'stop_name' in stop;
                                
                                if (isTimelineFormat) {
                                    const { stop_name, departure_time, realtime_departure_time, delay, isRealtime, isSkipped } = stop;
                                    const delayInfo = formatDelay(delay);
                                    let scheduledTimeString = departure_time || '--:--';
                                    let realTimeString = realtime_departure_time || scheduledTimeString;

                                    return (
                                        <div key={`timeline-${stop.stop_id}-${realTimeString.replace(':', '')}`} className={`next-stop-item ${isSkipped ? 'skipped' : ''}`}>
                                            <div className="next-stop-name">
                                                {isLast ? <strong>{stop_name}</strong> : stop_name}
                                                {isLast && <span style={{ marginLeft: '8px', background: '#6b7280', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Terminus</span>}
                                            </div>
                                            <div className="next-stop-time" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                {isRealtime ? (
                                                    <>
                                                        <span className={`time-text realtime ${delayInfo.class}`} style={{ display: 'flex', alignItems: 'center' }}>
                                                            <RealtimeIcon />
                                                            {realTimeString}
                                                            {delay !== 0 && delayInfo.text && (
                                                                <span className={`delay-badge ${delayInfo.class}`}>{delayInfo.text}</span>
                                                            )}
                                                        </span>
                                                        {delay !== 0 && <span className="scheduled-time">{scheduledTimeString}</span>}
                                                    </>
                                                ) : (
                                                    <span className="time-text">{scheduledTimeString}</span>
                                                )}
                                                {isSkipped && (
                                                    <span style={{ 
                                                        background: '#dc2626', 
                                                        color: 'white', 
                                                        padding: '2px 6px', 
                                                        borderRadius: '4px', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 'bold',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        marginTop: '2px'
                                                    }}>
                                                        <RiErrorWarningFill size={12} />
                                                        Arrêt supprimé
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                
                                if (!stop.stops) return null;

                                const { stop_name } = stop.stops;
                                const { departure_time, realtime_departure_time, delay, isRealtime, isSkipped } = stop;
                                const delayInfo = formatDelay(delay);
                                
                                let scheduledTimeString = departure_time ? departure_time.substring(0, 5) : '--:--';
                                let realTimeString = realtime_departure_time ? realtime_departure_time.substring(0, 5) : scheduledTimeString;

                                return (
                                    <div key={`${stop.trip_id}-${stop.stop_id}-${stop.stop_sequence}`} className={`next-stop-item ${isSkipped ? 'skipped' : ''}`}>
                                        <div className="next-stop-name">
                                            {isLast ? <strong>{stop_name}</strong> : stop_name}
                                            {isLast && <span style={{ marginLeft: '8px', background: '#6b7280', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Terminus</span>}
                                        </div>
                                        <div className="next-stop-time" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            {isRealtime ? (
                                                <>
                                                    <span className={`time-text realtime ${delayInfo.class}`} style={{ display: 'flex', alignItems: 'center' }}>
                                                        <RealtimeIcon />
                                                        {realTimeString}
                                                        {delay !== 0 && delayInfo.text && (
                                                            <span className={`delay-badge ${delayInfo.class}`}>{delayInfo.text}</span>
                                                        )}
                                                    </span>
                                                    {delay !== 0 && <span className="scheduled-time">{scheduledTimeString}</span>}
                                                </>
                                            ) : (
                                                <span className="time-text">{scheduledTimeString}</span>
                                            )}
                                            {isSkipped && (
                                                <span style={{ 
                                                    background: '#dc2626', 
                                                    color: 'white', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 'bold',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    marginTop: '2px'
                                                }}>
                                                    <RiErrorWarningFill size={12} />
                                                    Arrêt supprimé
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="no-stops-info">
                                <p>Aucune information sur les arrêts n'est disponible.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default MapView; 