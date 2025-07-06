import React, { useEffect, useRef, useState } from 'react';
import { FaTimes, FaBus, FaMapMarkerAlt, FaList } from 'react-icons/fa';
import { RiErrorWarningFill } from 'react-icons/ri';
import { supabase } from '../services/supabase';
import { fetchVehiclePositionData, fetchRealtimeData } from '../services/realtime';
import { darkenColor } from './utils/ColorUtils';
import ReactDOMServer from 'react-dom/server';
import './InteractiveMap.css';

// Charger le script Mapbox
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
          window.mapboxgl.accessToken = 'pk.eyJ1Ijoid2VpYmVsY2xlbWVudDYwIiwiYSI6ImNtMm9yZ3JpaDA4OGQybHIxcTBibHk4NXQifQ.iUZ4I9uI1lIWgamjWnDIYg';
          resolve(window.mapboxgl);
        } else {
          reject(new Error('Mapbox GL not available after loading script'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Mapbox GL script'));
      document.head.appendChild(script);
      
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

// Fonction pour obtenir la couleur de texte contrastée
const getContrastTextColor = (bgColor) => {
  if (!bgColor) return 'FFFFFF';
  bgColor = bgColor.replace('#', '');
  const r = parseInt(bgColor.slice(0, 2), 16);
  const g = parseInt(bgColor.slice(2, 4), 16);
  const b = parseInt(bgColor.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '000000' : 'FFFFFF';
};

// Icône temps réel
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

// Placeholder animé
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

const InteractiveMap = ({ isOpen, onClose, networkId, networkName, lines }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loading, setLoading] = useState(true);
  const [selectedLines, setSelectedLines] = useState([]);
  const [vehiclePositions, setVehiclePositions] = useState({});
  const vehicleMarkers = useRef({});
  const [userLocation, setUserLocation] = useState(null);
  const userLocationMarker = useRef(null);
  const watchId = useRef(null);
  const [mapError, setMapError] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // États pour les détails de véhicule
  const [selectedVehicleInfo, setSelectedVehicleInfo] = useState(null);
  const [selectedVehicleStops, setSelectedVehicleStops] = useState([]);
  const [vehicleDetailsLoading, setVehicleDetailsLoading] = useState(false);
  const [selectedVehicleBrand, setSelectedVehicleBrand] = useState(null);
  const [selectedVehicleModel, setSelectedVehicleModel] = useState(null);
  const [isVehiclePanelVisible, setIsVehiclePanelVisible] = useState(false);
  const [vehicleTripStops, setVehicleTripStops] = useState([]);
  const [displayedStops, setDisplayedStops] = useState([]);
  const [displayedRemainingMinutes, setDisplayedRemainingMinutes] = useState(null);

  // États pour la géolocalisation
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationPermissionState, setLocationPermissionState] = useState('prompt');
  const [showLocationDeniedToast, setShowLocationDeniedToast] = useState(false);

  // Filtrer les lignes selon la recherche
  const filteredLines = lines.filter(line => 
    line.route_short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.route_long_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fonction pour formater les retards
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

  // Fermer les détails de véhicule
  const handleCloseVehicleDetails = () => {
    setIsVehiclePanelVisible(false);
    setSelectedVehicleInfo(null);
    setSelectedVehicleStops([]);
    
    // Réinitialiser l'opacité des véhicules sur la carte
    Object.values(vehicleMarkers.current).forEach(marker => {
      marker.getElement().style.opacity = '1';
      marker.getElement().classList.remove('selected-vehicle');
    });
  };

  // Charger les détails d'un véhicule
  const loadVehicleDetails = async (vehicleData) => {
    const { tripId, routeId, lat, lon, label, vehicleId } = vehicleData;
    if (!tripId || !routeId) return;

    setVehicleDetailsLoading(true);
    setSelectedVehicleInfo(vehicleData);
    setSelectedVehicleStops([]);
    setSelectedVehicleBrand(null);
    setSelectedVehicleModel(null);
    setIsVehiclePanelVisible(true);
    setVehicleTripStops([]);
    
    try {
        // Récupérer le nom du sous-réseau si disponible
        const line = lines.find(l => l.route_id === routeId);
        const subnetworkName = line?.subnetwork_name || null;

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

        // 2. Récupérer les données temps réel
        const realtimeData = await fetchRealtimeData(networkId, routeId, subnetworkName);

        // 3. Traiter les données
        const processedStops = stopsData.map(stop => {
            const departureTime = stop.departure_time;
            const timeDisplay = departureTime.substring(0, 5);
            
            let realtimeTime = '';
            let delay = 0;
            let isRealtime = false;
            let isSkipped = false;

            if (realtimeData) {
                const key = `${tripId}-${stop.stop_id}`;
                
                if (realtimeData.delays && realtimeData.delays[key] !== undefined) {
                    delay = realtimeData.delays[key];
                    isRealtime = true;
                    
                    if (departureTime) {
                        const [hours, minutes] = departureTime.split(':').map(Number);
                        const date = new Date();
                        date.setHours(hours, minutes, 0, 0);
                        date.setTime(date.getTime() + delay * 60000);
                        
                        const realHours = String(date.getHours()).padStart(2, '0');
                        const realMinutes = String(date.getMinutes()).padStart(2, '0');
                        realtimeTime = `${realHours}:${realMinutes}`;
                    }
                }
                
                if (realtimeData.updatedTimes && realtimeData.updatedTimes[key]) {
                    const updatedTime = realtimeData.updatedTimes[key];
                    if (updatedTime.departureTime) {
                        realtimeTime = updatedTime.departureTime;
                        isRealtime = true;
                    }
                }
                
                if (realtimeData.skippedStops && realtimeData.skippedStops[key]) {
                    isSkipped = true;
                }
            }
            
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
        
        // Trier par heure de passage
        const sortedStops = [...processedStops].sort((a, b) => {
            const timeToMinutes = (timeStr) => {
                if (!timeStr) return 0;
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours * 60 + minutes;
            };
            
            const timeA = timeToMinutes(a.realtime_departure_time);
            const timeB = timeToMinutes(b.realtime_departure_time);
            return timeA - timeB;
        });
        
        // Filtrer pour les arrêts futurs
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentMinutes = currentHour * 60 + currentMinute;
        
        const futureStops = sortedStops.filter(stop => {
            if (!stop.realtime_departure_time) return false;
            
            const [hours, minutes] = stop.realtime_departure_time.split(':').map(Number);
            const stopMinutes = hours * 60 + minutes;
            
            let adjustedStopMinutes = stopMinutes;
            let adjustedCurrentMinutes = currentMinutes;
            
            if (hours >= 22 && currentHour < 2) {
                adjustedCurrentMinutes = currentMinutes + 24 * 60;
            } else if (hours < 2 && currentHour >= 22) {
                adjustedStopMinutes = stopMinutes + 24 * 60;
            }
            
            return adjustedStopMinutes > adjustedCurrentMinutes;
        });
        
        // Calculer l'heure d'arrivée au terminus et le temps restant
        let arrivalTime = null;
        let remainingMinutes = null;
        
        if (futureStops.length > 0) {
            const lastStop = futureStops[futureStops.length - 1];
            
            if (lastStop && lastStop.realtime_departure_time) {
                arrivalTime = lastStop.realtime_departure_time;
                
                const now = new Date();
                const [hours, minutes] = arrivalTime.split(':').map(Number);
                
                const arrivalDate = new Date();
                arrivalDate.setHours(hours, minutes, 0, 0);
                
                if (hours < 4 && now.getHours() > 20) {
                    arrivalDate.setDate(arrivalDate.getDate() + 1);
                }
                
                remainingMinutes = Math.round((arrivalDate - now) / (1000 * 60));
            }
        }
        
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
            
        if (tripData?.trip_headsign) {
            setSelectedVehicleInfo(prev => ({
                ...prev,
                tripHeadsign: tripData.trip_headsign
            }));
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

        setVehicleTripStops(sortedStops);
    } catch (err) {
        console.error("Erreur lors de la récupération des détails du trajet du véhicule:", err);
    } finally {
        setVehicleDetailsLoading(false);
    }
  };

  // Initialiser la carte
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const initializeMap = async () => {
      try {
        const mapboxgl = await getMapboxScript();
        
        if (!isMounted || !mapContainer.current) return;

        // Créer la carte centrée sur la France par défaut
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [2.213749, 46.227638], // Centre de la France
          zoom: 6, // Zoom plus large au début
          attributionControl: false,
          dragRotate: false,
          touchPitch: false,
          pitchWithRotate: false
        });

        map.current.on('load', () => {
          if (!isMounted) return;

          // Ajouter les contrôles
          map.current.addControl(new mapboxgl.NavigationControl({
            showCompass: false,
            showZoom: true
          }), 'bottom-right');

          setLoading(false);

          // Centrer automatiquement sur la zone du réseau
          centerOnNetwork();

          // Si on a une position utilisateur, centrer dessus
          if (userLocation) {
            map.current.flyTo({
              center: [userLocation.longitude, userLocation.latitude],
              zoom: 14,
              duration: 1000
            });
          }
        });

      } catch (err) {
        console.error("Erreur lors de l'initialisation de la carte:", err);
        if (isMounted) {
          setMapError(err.message);
          setLoading(false);
        }
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isOpen]);

  // Géolocalisation de l'utilisateur
  useEffect(() => {
    if (!isOpen) return;

    // Attendre que la carte soit prête
    const initGeolocation = () => {
      if (!map.current || !map.current.isStyleLoaded()) {
        setTimeout(initGeolocation, 100);
        return;
      }

      // Si on a déjà une position et pas de marqueur, recréer le marqueur
      if (userLocation && !userLocationMarker.current) {
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        el.innerHTML = `
          <div class="pulse-ring"></div>
          <div class="location-dot"></div>
        `;

        userLocationMarker.current = new window.mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map.current);
      }

      const updateUserLocation = (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });

        if (map.current && map.current.isStyleLoaded()) {
          // Créer ou mettre à jour le marqueur de position
          if (!userLocationMarker.current) {
            const el = document.createElement('div');
            el.className = 'user-location-marker';
            el.innerHTML = `
              <div class="pulse-ring"></div>
              <div class="location-dot"></div>
            `;

            userLocationMarker.current = new window.mapboxgl.Marker({
              element: el,
              anchor: 'center'
            })
            .setLngLat([longitude, latitude])
            .addTo(map.current);

            // Centrer seulement si c'est la première fois
            if (!userLocation) {
              map.current.flyTo({
                center: [longitude, latitude],
                zoom: 14,
                duration: 1000
              });
            }
          } else {
            // Mettre à jour la position
            userLocationMarker.current.setLngLat([longitude, latitude]);
          }
        }
      };

      const handleError = (error) => {
        console.warn('Erreur de géolocalisation:', error);
        // En cas d'erreur, essayer de nouveau après un délai
        setTimeout(() => {
          if (navigator.geolocation && isOpen) {
            navigator.geolocation.getCurrentPosition(updateUserLocation, () => {}, {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 30000
            });
          }
        }, 2000);
      };

      // Démarrer la géolocalisation seulement si l'autorisation est accordée
      if (navigator.geolocation && !watchId.current) {
        // Vérifier d'abord l'état des permissions
        checkLocationPermission().then(permissionState => {
          if (permissionState === 'granted') {
            // Position initiale avec options strictes
            navigator.geolocation.getCurrentPosition(updateUserLocation, handleError, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });

            // Suivre la position avec options plus flexibles
            watchId.current = navigator.geolocation.watchPosition(updateUserLocation, handleError, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 30000
            });
          }
          // Si pas d'autorisation, ne rien faire automatiquement
          // L'utilisateur pourra cliquer sur le bouton pour demander l'autorisation
        });
      }
    };

    initGeolocation();

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [isOpen]);

  // Garder une référence des lignes précédemment sélectionnées
  const prevSelectedLines = useRef([]);

  // Charger les lignes sélectionnées (arrêts + tracés) avec le système RPC ultra-rapide
  useEffect(() => {
    if (!map.current) return;

    const loadSelectedLines = async () => {
      // Attendre que la carte soit complètement prête
      const waitForMapReady = () => {
        return new Promise((resolve) => {
          if (map.current.isStyleLoaded()) {
            resolve();
          } else {
            map.current.on('styledata', resolve);
          }
        });
      };

      await waitForMapReady();

      const previousLines = prevSelectedLines.current;
      const currentLines = selectedLines;

      console.log(`[loadSelectedLines] Chargement: ${currentLines.length} lignes sélectionnées`);

      // Nettoyer les anciennes lignes qui ne sont plus sélectionnées
      const linesToRemove = previousLines.filter(lineId => !currentLines.includes(lineId));
      
      linesToRemove.forEach(lineId => {
        // Nettoyer les tracés
        const sourceId = `line-source-${lineId}`;
        const layerId = `line-${lineId}`;
        
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      // Charger les nouvelles données avec le système RPC
      if (currentLines.length > 0) {
        await loadLineStops(currentLines);
      } else {
        // Nettoyer tous les arrêts si aucune ligne sélectionnée
        const stopsSourceId = 'selected-lines-stops';
        const stopsLayerId = 'selected-lines-stops-layer';
        const stopsLabelsLayerId = 'selected-lines-stops-labels';

        [stopsLayerId, stopsLabelsLayerId].forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        });
        if (map.current.getSource(stopsSourceId)) {
          map.current.removeSource(stopsSourceId);
        }
      }

      // Mettre à jour la référence des lignes précédentes
      prevSelectedLines.current = [...currentLines];
    };

    loadSelectedLines().catch(err => {
      console.error('[loadSelectedLines] Erreur:', err);
    });
  }, [selectedLines, lines, networkId]);

  // Fonction pour zoomer automatiquement sur les lignes sélectionnées
  const zoomToSelectedLines = async (shapesData) => {
    if (!map.current || !shapesData || shapesData.length === 0) return;

    try {
      const mapboxgl = await getMapboxScript();
      const bounds = new mapboxgl.LngLatBounds();
      let hasCoordinates = false;

      // Collecter toutes les coordonnées des lignes sélectionnées
      shapesData.forEach(shape => {
        const allCoordinates = shape.coordinates;
        if (allCoordinates && allCoordinates.length > 0) {
          // Parcourir tous les segments de la ligne
          allCoordinates.forEach(coordinateSegment => {
            if (coordinateSegment && coordinateSegment.length > 0) {
              coordinateSegment.forEach(coord => {
                if (coord && coord.length >= 2) {
                  bounds.extend([coord[0], coord[1]]);
                  hasCoordinates = true;
                }
              });
            }
          });
        }
      });

      // Zoomer sur les bounds si on a des coordonnées
      if (hasCoordinates) {
        map.current.fitBounds(bounds, {
          padding: { 
            top: 80, 
            bottom: 80, 
            left: isPanelOpen ? 430 : 80, // Plus de padding à gauche si le panneau est ouvert
            right: 80 
          },
          maxZoom: 15,
          duration: 1500, // Animation plus douce
          essential: true // Assure que l'animation se joue même si le navigateur réduit les performances
        });

        console.log(`[zoomToSelectedLines] Zoom automatique sur ${shapesData.length} ligne(s) sélectionnée(s)`);
      } else {
        console.log(`[zoomToSelectedLines] Aucune coordonnée trouvée pour le zoom`);
      }

    } catch (err) {
      console.error('[zoomToSelectedLines] Erreur lors du zoom:', err);
    }
  };

  // Fonction pour charger les tracés des lignes à partir des données RPC
  const loadLineShapesFromRPC = async (shapesData) => {
    if (!map.current) return;

    // S'assurer que la carte est prête
    if (!map.current.isStyleLoaded()) {
      console.log('[loadLineShapesFromRPC] Carte pas encore prête, on attend...');
      await new Promise((resolve) => {
        map.current.on('styledata', resolve);
      });
    }

    try {
      // Nettoyer les sources et couches existantes
      shapesData.forEach(shape => {
        const layerId = `line-${shape.route_id}`;
        const sourceId = `line-source-${shape.route_id}`;
        
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      // Ajouter les nouveaux tracés (déjà groupés par la RPC)
      shapesData.forEach(shape => {
        const allCoordinates = shape.coordinates; // Déjà un array d'arrays de coordonnées
        
        if (!allCoordinates || allCoordinates.length === 0) {
          console.log(`[loadLineShapesFromRPC] Pas de coordonnées pour la ligne ${shape.route_short_name}`);
          return;
        }

        const routeColor = shape.route_color ? `#${shape.route_color}` : '#3B82F6';
        const darkenedColor = '#' + darkenColor(routeColor.replace('#', ''), 0.8);
        
        const layerId = `line-${shape.route_id}`;
        const sourceId = `line-source-${shape.route_id}`;

        // Créer un MultiLineString pour tous les segments de la ligne
        const geometry = allCoordinates.length === 1 
          ? {
              type: 'LineString',
              coordinates: allCoordinates[0]
            }
          : {
              type: 'MultiLineString',
              coordinates: allCoordinates
            };

        // Ajouter la source GeoJSON
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: geometry,
            properties: {
              route_id: shape.route_id,
              route_short_name: shape.route_short_name,
              route_long_name: shape.route_long_name,
              route_color: shape.route_color
            }
          }
        });

        // Ajouter la couche de ligne (style identique à l'ancien système)
        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': darkenedColor,
            'line-width': 4,
            'line-opacity': 0.7
          }
        });

        const totalPoints = allCoordinates.reduce((sum, coords) => sum + coords.length, 0);
        console.log(`[loadLineShapesFromRPC] Tracé ajouté pour ${shape.route_short_name}: ${allCoordinates.length} segment(s), ${totalPoints} points au total`);
      });

    } catch (err) {
      console.error('[loadLineShapesFromRPC] Erreur lors du chargement des tracés:', err);
    }
  };

  // Fonction pour charger et afficher les arrêts des lignes sélectionnées
  const loadLineStops = async (selectedLineIds) => {
    if (!map.current) return;

    // S'assurer que la carte est prête
    if (!map.current.isStyleLoaded()) {
      console.log('[loadLineStops] Carte pas encore prête, on attend...');
      await new Promise((resolve) => {
        map.current.on('styledata', resolve);
      });
    }

    console.log(`[loadLineStops] Début du chargement pour ${selectedLineIds.length} lignes:`, selectedLineIds);
    
    // Sauvegarder l'état des lignes sélectionnées au début pour éviter les conditions de course
    const currentSelectedLines = [...selectedLineIds];

    try {
      // Nettoyer les arrêts existants
      const stopsSourceId = 'selected-lines-stops';
      const stopsLayerId = 'selected-lines-stops-layer';
      const stopsLabelsLayerId = 'selected-lines-stops-labels';

      [stopsLayerId, stopsLabelsLayerId].forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      if (map.current.getSource(stopsSourceId)) {
        map.current.removeSource(stopsSourceId);
      }

      if (selectedLineIds.length === 0) return;

      // Utiliser les fonctions RPC optimisées en parallèle
      const startTime = performance.now();
      
      const [stopsResult, shapesResult] = await Promise.all([
        supabase.rpc('plan_interactif_stops', {
          p_network_id: networkId,
          p_route_ids: selectedLineIds
        }),
        supabase.rpc('plan_interactif_shapes', {
          p_network_id: networkId,
          p_route_ids: selectedLineIds
        })
      ]);

      const endTime = performance.now();
      console.log(`[loadLineStops] Fonctions RPC exécutées en parallèle en ${Math.round(endTime - startTime)}ms`);

      const { data: uniqueStops, error: stopsError } = stopsResult;
      const { data: shapesData, error: shapesError } = shapesResult;

      if (stopsError) {
        console.error('[loadLineStops] Erreur lors de l\'appel RPC stops:', stopsError);
        return;
      }

      if (shapesError) {
        console.error('[loadLineStops] Erreur lors de l\'appel RPC shapes:', shapesError);
        // Continue même si les shapes échouent
      }

      if (!uniqueStops || uniqueStops.length === 0) {
        console.log('[loadLineStops] Aucun arrêt trouvé');
        return;
      }

      console.log(`[loadLineStops] ${uniqueStops.length} arrêts uniques trouvés`);
      
      // Charger les tracés des lignes si disponibles
      if (shapesData && shapesData.length > 0) {
        console.log(`[loadLineStops] ${shapesData.length} tracés de lignes trouvés`);
        await loadLineShapesFromRPC(shapesData);
        
        // Zoomer automatiquement sur les lignes sélectionnées
        await zoomToSelectedLines(shapesData);
      }

      // Vérifier si les lignes sélectionnées ont changé pendant le traitement
      if (JSON.stringify(currentSelectedLines.sort()) !== JSON.stringify(selectedLines.sort())) {
        console.log(`[loadLineStops] Annulation - les lignes sélectionnées ont changé pendant le traitement`);
        return;
      }

      // Créer les features GeoJSON pour les arrêts
      const features = uniqueStops.map(stop => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [stop.stop_lon, stop.stop_lat]
        },
        properties: {
          stop_id: stop.stop_id,
          stop_name: stop.stop_name
        }
      }));

      // Ajouter la source GeoJSON
      map.current.addSource(stopsSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });

      // Déterminer les couleurs selon le nombre de lignes sélectionnées
      let strokeColor = '#6b7280'; // Gris par défaut
      let fillColor = '#ffffff'; // Blanc par défaut
      
      if (selectedLineIds.length === 1) {
        // Une seule ligne : couleur de la ligne pour le contour, blanc pour le remplissage
        const line = lines.find(l => l.route_id === selectedLineIds[0]);
        if (line && line.route_color) {
          const routeColor = `#${line.route_color}`;
          strokeColor = '#' + darkenColor(routeColor.replace('#', ''), 0.8);
        }
        fillColor = '#ffffff';
      } else {
        // Plusieurs lignes : contour et point intérieur blanc
        strokeColor = '#000000'; // Contour noir pour la visibilité
        fillColor = '#ffffff';   // Intérieur blanc
      }

      // Ajouter la couche des points d'arrêts
      map.current.addLayer({
        id: stopsLayerId,
        type: 'circle',
        source: stopsSourceId,
        minzoom: 12, // Les arrêts apparaissent à partir du zoom 12
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12, 3,  // Rayon 3 au zoom 12
            16, 5   // Rayon 5 au zoom 16
          ],
          'circle-color': fillColor,
          'circle-stroke-width': 2,
          'circle-stroke-color': strokeColor,
          'circle-opacity': 0.9
        }
      });

      // Ajouter la couche des labels d'arrêts
      map.current.addLayer({
        id: stopsLabelsLayerId,
        type: 'symbol',
        source: stopsSourceId,
        minzoom: 13, // Les labels apparaissent à partir du zoom 13
        layout: {
          'text-field': ['get', 'stop_name'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13, 10,  // Taille 10 au zoom 13
            16, 12   // Taille 12 au zoom 16
          ],
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13, 0.7,  // Opacité 0.7 au zoom 13
            15, 1     // Opacité 1 au zoom 15
          ]
        }
      });

      console.log(`[loadLineStops] Succès! Affichage de ${uniqueStops.length} arrêts uniques pour ${selectedLineIds.length} ligne(s)`);

    } catch (err) {
      console.error('[loadLineStops] Erreur lors du chargement des arrêts:', err);
    }
  };

  // Charger les positions des véhicules
  useEffect(() => {
    if (!isOpen || !networkId || selectedLines.length === 0) return;

    const loadVehiclePositions = async () => {
      try {
        const data = await fetchVehiclePositionData(networkId);
        if (data && Object.keys(data).length > 0) {
          // Filtrer les véhicules pour les lignes sélectionnées
          const filteredPositions = {};
          
          Object.entries(data).forEach(([vehicleId, vehicleData]) => {
            if (selectedLines.includes(vehicleData.routeId)) {
              const vehicleTimestamp = parseInt(vehicleData.timestamp, 10);
              const currentTimestamp = Math.floor(Date.now() / 1000);
              
              // Garder les véhicules récents (moins de 2 minutes)
              if (vehicleTimestamp === 0 || (vehicleTimestamp && (currentTimestamp - vehicleTimestamp < 120))) {
                filteredPositions[vehicleId] = vehicleData;
              }
            }
          });
          
          setVehiclePositions(filteredPositions);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des positions des véhicules:', err);
      }
    };

    loadVehiclePositions();
    const intervalId = setInterval(loadVehiclePositions, 15000);

    return () => clearInterval(intervalId);
  }, [isOpen, networkId, selectedLines]);

  // Afficher les marqueurs de véhicules
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Nettoyer les marqueurs existants
    Object.values(vehicleMarkers.current).forEach(marker => marker.remove());
    vehicleMarkers.current = {};

    // Ajouter les nouveaux marqueurs
    Object.entries(vehiclePositions).forEach(([vehicleId, data]) => {
      const { lat, lon, bearing, routeId } = data;
      const line = lines.find(l => l.route_id === routeId);
      if (!line) return;

      const routeColor = line.route_color ? `#${line.route_color}` : '#3B82F6';
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

      const el = document.createElement('div');
      el.className = 'vehicle-marker';
      
      // Ajouter le gestionnaire de clic pour ouvrir les détails
      if (data.tripId) {
        el.onclick = () => {
          if (selectedVehicleInfo && selectedVehicleInfo.vehicleId === data.vehicleId) {
            setIsVehiclePanelVisible(!isVehiclePanelVisible);
          } else {
            loadVehicleDetails(data);
          }
        };
        el.style.cursor = 'pointer';
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

      const marker = new window.mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
      .setLngLat([lon, lat])
      .addTo(map.current);

      vehicleMarkers.current[vehicleId] = marker;
    });

    // Gérer l'opacité des véhicules quand un est sélectionné
    if (selectedVehicleInfo && isVehiclePanelVisible) {
      Object.entries(vehicleMarkers.current).forEach(([vehicleId, marker]) => {
        const isSelected = vehicleId === selectedVehicleInfo.vehicleId;
        const element = marker.getElement();
        element.style.opacity = isSelected ? '1' : '0.4';
        if (isSelected) {
          element.classList.add('selected-vehicle');
        } else {
          element.classList.remove('selected-vehicle');
        }
      });
    } else {
      // Réinitialiser l'opacité de tous les véhicules
      Object.values(vehicleMarkers.current).forEach(marker => {
        marker.getElement().style.opacity = '1';
        marker.getElement().classList.remove('selected-vehicle');
      });
    }
  }, [vehiclePositions, lines, selectedVehicleInfo, isVehiclePanelVisible]);

  // Effet pour actualiser l'affichage des arrêts toutes les 10 secondes
  useEffect(() => {
    if (!isVehiclePanelVisible || vehicleTripStops.length === 0) {
      return;
    }

    const updateDisplay = () => {
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

      // Calculer le temps restant
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

    updateDisplay();
    const intervalId = setInterval(updateDisplay, 10000);

    return () => clearInterval(intervalId);
  }, [isVehiclePanelVisible, vehicleTripStops]);

  // Centrer automatiquement sur la zone du réseau
  const centerOnNetwork = async () => {
    if (!map.current || !lines || lines.length === 0) return;

    try {
      // Récupérer un échantillon de coordonnées du réseau pour calculer les bounds
      const { data: stopsData, error: stopsError } = await supabase
        .from('stops')
        .select('stop_lat, stop_lon')
        .eq('network_id', networkId)
        .not('stop_lat', 'is', null)
        .not('stop_lon', 'is', null)
        .limit(100); // Échantillon de 100 arrêts

      if (stopsError || !stopsData || stopsData.length === 0) return;

      const mapboxgl = await getMapboxScript();
      const bounds = new mapboxgl.LngLatBounds();
      
      stopsData.forEach(stop => {
        bounds.extend([stop.stop_lon, stop.stop_lat]);
      });
      
      // Centrer sur les bounds du réseau avec un padding
      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 13,
        duration: 2000
      });

    } catch (err) {
      console.error('Erreur lors du centrage sur le réseau:', err);
    }
  };

  // Gérer la sélection des lignes
  const toggleLine = (lineId) => {
    setSelectedLines(prev => {
      if (prev.includes(lineId)) {
        return prev.filter(id => id !== lineId);
      } else {
        // Limiter à 5 lignes maximum
        if (prev.length >= 5) {
          return prev; // Ne pas ajouter si on a déjà 5 lignes
        }
        return [...prev, lineId];
      }
    });
  };

  // Vérifier les permissions de géolocalisation
  const checkLocationPermission = async () => {
    if (!navigator.permissions) {
      return 'prompt'; // Fallback pour navigateurs sans support des permissions
    }
    
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setLocationPermissionState(permission.state);
      return permission.state;
    } catch (error) {
      return 'prompt';
    }
  };

  // Demander l'autorisation de géolocalisation
  const requestLocationPermission = () => {
    if (navigator.geolocation && map.current) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          setLocationPermissionState('granted');
          setShowLocationModal(false);
          
          // Créer ou mettre à jour le marqueur de position utilisateur
          if (!userLocationMarker.current) {
            const el = document.createElement('div');
            el.className = 'user-location-marker';
            el.innerHTML = `
              <div class="pulse-ring"></div>
              <div class="location-dot"></div>
            `;

            userLocationMarker.current = new window.mapboxgl.Marker({
              element: el,
              anchor: 'center'
            })
            .setLngLat([longitude, latitude])
            .addTo(map.current);
          } else {
            userLocationMarker.current.setLngLat([longitude, latitude]);
          }
          
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1000
          });
        },
        (error) => {
          console.warn('Erreur lors de la récupération de la position:', error);
          setLocationPermissionState('denied');
          setShowLocationModal(false);
          
          // Afficher le toast d'erreur
          setShowLocationDeniedToast(true);
          setTimeout(() => setShowLocationDeniedToast(false), 5000);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    }
  };

  // Centrer sur la position utilisateur
  const centerOnUserLocation = async () => {
    if (userLocation && map.current) {
      // Si on a déjà la position, s'assurer que le marqueur est visible et zoomer dessus
      if (!userLocationMarker.current) {
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        el.innerHTML = `
          <div class="pulse-ring"></div>
          <div class="location-dot"></div>
        `;

        userLocationMarker.current = new window.mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map.current);
      }
      
      map.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15,
        duration: 1000
      });
    } else {
      // Vérifier l'état des permissions
      const permissionState = await checkLocationPermission();
      
      if (permissionState === 'granted') {
        // Permission accordée, récupérer la position directement
        requestLocationPermission();
      } else if (permissionState === 'denied') {
        // Permission refusée
        setShowLocationDeniedToast(true);
        setTimeout(() => setShowLocationDeniedToast(false), 5000);
      } else {
        // Permission pas encore demandée, afficher le modal
        setShowLocationModal(true);
      }
    }
  };

  // Nettoyer les sélections quand on ferme la carte
  const handleClose = () => {
    setSelectedLines([]);
    setVehiclePositions({});
    
    // Nettoyer les arrêts si la carte est initialisée
    if (map.current) {
      const stopsSourceId = 'selected-lines-stops';
      const stopsLayerId = 'selected-lines-stops-layer';
      const stopsLabelsLayerId = 'selected-lines-stops-labels';

      [stopsLayerId, stopsLabelsLayerId].forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      if (map.current.getSource(stopsSourceId)) {
        map.current.removeSource(stopsSourceId);
      }
    }
    
    // Nettoyer seulement le marqueur visuel, garder userLocation pour la prochaine ouverture
    if (userLocationMarker.current) {
      userLocationMarker.current.remove();
      userLocationMarker.current = null;
    }
    
    // Arrêter le suivi de géolocalisation
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="interactive-map-overlay">
      <div ref={mapContainer} className="interactive-map-container" />
      
      {loading && (
        <div className="map-loading">
          <div className="map-spinner"></div>
        </div>
      )}
      
      <button 
        onClick={handleClose} 
        className="map-close-button" 
        aria-label="Fermer la carte"
        style={{ opacity: isPanelOpen ? 0.3 : 1 }}
      >
        <FaTimes size={20} />
      </button>

      {!isPanelOpen && (
        <button 
          onClick={() => setIsPanelOpen(true)} 
          className="panel-toggle-button"
          aria-label="Lignes de bus"
          title="Lignes de bus"
        >
          <FaList size={20} />
          <span className="button-tooltip">Lignes de bus</span>
        </button>
      )}

      <button 
        onClick={centerOnUserLocation} 
        className="location-button"
        aria-label="Centrer sur ma position"
        title="Centrer sur ma position"
      >
        <FaMapMarkerAlt size={16} />
        <span className="button-tooltip">Me localiser</span>
      </button>
      
      {mapError && (
        <div className="map-error">
          <p>{mapError}</p>
        </div>
      )}

      {/* Panneau de sélection des lignes */}
      <div className={`lines-selection-panel ${isPanelOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <div className="panel-header-content">
            <h3>Sélectionner les lignes</h3>
            <p className="network-name">{networkName}</p>
          </div>
          {isPanelOpen && (
            <button 
              onClick={() => setIsPanelOpen(false)} 
              className="panel-close-button"
              aria-label="Fermer le panneau"
            >
              <FaTimes size={18} />
            </button>
          )}
        </div>
        
        <div className="search-container">
          <input
            type="text"
            placeholder="Rechercher une ligne..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="lines-list">
          {filteredLines.filter(line => line.etat === 1).map(line => {
            const backgroundColor = darkenColor(line.route_color);
            const textColor = getContrastTextColor(backgroundColor);
            const isSelected = selectedLines.includes(line.route_id);
            const isDisabled = !isSelected && selectedLines.length >= 5;
            
            return (
              <label 
                key={line.route_id} 
                className={`line-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleLine(line.route_id)}
                  disabled={isDisabled}
                  className="line-checkbox"
                />
                <div 
                  className="line-badge"
                  style={{
                    backgroundColor: `#${backgroundColor}`,
                    color: `#${textColor}`,
                    opacity: isDisabled ? 0.5 : 1
                  }}
                >
                  {line.route_short_name}
                </div>
                <span className="line-name" style={{ opacity: isDisabled ? 0.5 : 1 }}>
                  {line.route_long_name}
                </span>
              </label>
            );
          })}
        </div>

        <div className="panel-footer">
          <p className="selected-count">
            {selectedLines.length}/5 ligne{selectedLines.length > 1 ? 's' : ''} sélectionnée{selectedLines.length > 1 ? 's' : ''}
          </p>
          {selectedLines.length >= 5 && (
            <p className="max-lines-warning">
              Maximum de 5 lignes atteint
            </p>
          )}
        </div>
      </div>

      {/* Modal de demande d'autorisation géolocalisation */}
      {showLocationModal && (
        <div className="location-permission-modal-overlay">
          <div className="location-permission-modal">
            <div className="modal-header">
              <FaMapMarkerAlt size={24} color="#3b82f6" />
              <h3>Autorisation de géolocalisation</h3>
            </div>
            <div className="modal-content">
              <p>
                Cette application souhaite accéder à votre position pour vous localiser sur la carte 
                et vous offrir une meilleure expérience de navigation.
              </p>
              <p className="privacy-note">
                📍 Votre position ne sera jamais partagée ou stockée sur nos serveurs.
              </p>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowLocationModal(false)}
                className="modal-button modal-button-cancel"
              >
                Refuser
              </button>
              <button 
                onClick={requestLocationPermission}
                className="modal-button modal-button-accept"
              >
                Autoriser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast d'erreur géolocalisation */}
      {showLocationDeniedToast && (
        <div className="location-denied-toast">
          <div className="toast-content">
            <div className="toast-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div className="toast-text">
              <div className="toast-title">Géolocalisation refusée</div>
              <div className="toast-message">Activez-la dans les paramètres de votre navigateur pour utiliser cette fonctionnalité.</div>
            </div>
            <button 
              className="toast-close"
              onClick={() => setShowLocationDeniedToast(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Panneau des détails de véhicule */}
      {selectedVehicleInfo && (
        <div className={`vehicle-details-panel ${isVehiclePanelVisible ? 'visible' : ''}`}>
          <div className="vehicle-details-header">
            <div className="header-content">
              <div className="route-header-info" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div 
                  className="route-number" 
                  style={{ 
                    backgroundColor: selectedVehicleInfo?.routeId ? 
                      '#' + darkenColor((lines.find(l => l.route_id === selectedVehicleInfo.routeId)?.route_color || '3B82F6')) : 
                      '#3B82F6',
                    color: selectedVehicleInfo?.routeId ? 
                      '#' + getContrastTextColor(darkenColor((lines.find(l => l.route_id === selectedVehicleInfo.routeId)?.route_color || '3B82F6'))) : 
                      '#FFFFFF',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  {lines.find(l => l.route_id === selectedVehicleInfo?.routeId)?.route_short_name || ''}
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
                      color={selectedVehicleInfo?.routeId ? 
                        '#' + darkenColor((lines.find(l => l.route_id === selectedVehicleInfo.routeId)?.route_color || '3B82F6')) : 
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
                    const { stop_name, departure_time, realtime_departure_time, delay, isRealtime, isSkipped } = stop;
                    const delayInfo = formatDelay(delay);
                    let scheduledTimeString = departure_time || '--:--';
                    let realTimeString = realtime_departure_time || scheduledTimeString;

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

export default InteractiveMap; 