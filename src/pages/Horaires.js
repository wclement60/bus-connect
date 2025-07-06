import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { fetchRealtimeData } from '../services/realtime';
import { Link, useSearchParams } from 'react-router-dom';
import { FaSearch, FaClock, FaArrowRight, FaBus, FaMapMarkerAlt, FaLayerGroup, FaTimes, FaMap } from 'react-icons/fa';
import { getTodayForSupabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import FavoriteButton from '../components/FavoriteButton';
// Import MapView component
import MapView from './Horaires/map';

// Importer le composant NetworkLogo
import NetworkLogo from '../components/NetworkLogo';

const Horaires = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [stopSchedules, setStopSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [realtimeData, setRealtimeData] = useState({});
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [networksLoading, setNetworksLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState(null);
  const [mapInteractionMessage, setMapInteractionMessage] = useState(null); // For messages like "Zoom in"
  
  // Add state for interactive map
  const [isMapOpen, setIsMapOpen] = useState(false);
  
  // Refs and consts for map move handling
  const mapMoveTimeoutIdRef = useRef(null);
  const lastFetchedInitialStopsBoundsKeyRef = useRef(null);
  const MIN_ZOOM_FOR_INITIAL_STOPS = 13; // Zoom level to start showing initial stops
  
  // Map related states and refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(null);
  const stopMarkers = useRef({});
  const selectedMarker = useRef(null);
  const activeSelectedStopMarker = useRef(null); // Pour le marqueur de l'arrêt activement sélectionné
  const groupedStopMarkers = useRef([]); // Nouvelle référence pour les marqueurs du groupe
  
  // Trip details states
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripStops, setTripStops] = useState([]);
  const [tripShape, setTripShape] = useState(null);
  const [tripRouteColor, setTripRouteColor] = useState('#3B82F6');
  const [tripDetailsLoading, setTripDetailsLoading] = useState(false);
  const [tripDetailsError, setTripDetailsError] = useState(null);
  const tripStopMarkers = useRef([]);
  const tripShapeLine = useRef(null);
  const tripShapeLinePast = useRef(null);
  const tripTerminusMarkers = useRef([]);
  const [isShowingTripDetails, setIsShowingTripDetails] = useState(false); // Pour suivre l'état d'affichage des détails

  // Ajouter ces états pour la gestion de l'interface mobile
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  
  // États pour la gestion du glissement
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const sidebarRef = useRef(null);
  const contentRef = useRef(null);
  
  // Ajouter un état pour la recherche de réseau et les résultats filtrés
  const [networkSearchTerm, setNetworkSearchTerm] = useState('');
  const [filteredNetworks, setFilteredNetworks] = useState([]);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const networkDropdownRef = useRef(null);

  const [initialMapStops, setInitialMapStops] = useState([]);
  const [initialStopsFetched, setInitialStopsFetched] = useState(false);

  const [pollingInterval, setPollingInterval] = useState(null);

  // Fonction pour actualiser les données temps réel de toutes les routes affichées
  const refreshRealtimeData = useCallback(async () => {
    if (!stopSchedules || stopSchedules.length === 0) return;

    try {
      const realtimePromises = stopSchedules.map(route => 
        fetchRealtimeData(route.network_id, route.route_id)
      );

      const results = await Promise.all(realtimePromises);
      
      const newRealtimeData = { ...realtimeData };
      stopSchedules.forEach((route, index) => {
        if (results[index]) {
          newRealtimeData[route.route_id] = results[index];
        }
      });

      setRealtimeData(newRealtimeData);
    } catch (err) {
      console.error('Error refreshing realtime data:', err);
    }
  }, [stopSchedules, realtimeData]);

  // Mettre en place le polling quand stopSchedules change
  useEffect(() => {
    // Nettoyer l'intervalle existant
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Si on a des horaires à actualiser, démarrer le polling
    if (stopSchedules && stopSchedules.length > 0) {
      // Actualiser immédiatement
      refreshRealtimeData();

      // Mettre en place l'intervalle de polling (toutes les 30 secondes)
      const interval = setInterval(refreshRealtimeData, 30000);
      setPollingInterval(interval);
    }

    // Cleanup function
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [stopSchedules, refreshRealtimeData]);

  // Nettoyer le polling quand le composant est démonté
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Ajouter un effet pour filtrer les réseaux lorsque le terme de recherche change
  useEffect(() => {
    if (networkSearchTerm.trim() === '') {
      setFilteredNetworks([]);
      return;
    }
    
    const searchResults = networks.filter(network => 
      network.network_name.toLowerCase().includes(networkSearchTerm.toLowerCase()) ||
      (network.region && network.region.toLowerCase().includes(networkSearchTerm.toLowerCase()))
    );
    
    setFilteredNetworks(searchResults.slice(0, 15)); // Limiter à 15 résultats pour éviter une liste trop longue
  }, [networkSearchTerm, networks]);

  // Ajouter un effet pour fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target)) {
        setShowNetworkDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fonction pour gérer la sélection d'un réseau
  const handleNetworkSelection = (networkId) => {
    // Si le réseau change, réinitialiser l'arrêt sélectionné et les horaires
    if (selectedNetwork !== networkId) {
      setSelectedStop(null);
      setStopSchedules([]);
      setSearchTerm(''); // Effacer la recherche d'arrêt
      setSearchResults([]);
    }
    
    setSelectedNetwork(networkId);
    
    // Trouver le nom du réseau sélectionné pour l'afficher dans le champ
    const selectedNetworkObj = networks.find(n => n.network_id === networkId);
    if (selectedNetworkObj) {
      let displayName = selectedNetworkObj.network_name;
      if (selectedNetworkObj.network_type) {
        displayName += ` (${selectedNetworkObj.network_type})`;
      }
      setNetworkSearchTerm(displayName);
    } else {
      setNetworkSearchTerm('');
    }
    
    setShowNetworkDropdown(false);
  };

  // Fonction pour réinitialiser la sélection
  const clearNetworkSelection = () => {
    setSelectedNetwork('');
    setNetworkSearchTerm('');
    setShowNetworkDropdown(false);
    
    // Réinitialiser l'arrêt si le réseau est effacé
    setSelectedStop(null);
    setStopSchedules([]);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Vérifier si on est sur mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Vérifier au chargement
    checkIfMobile();
    
    // Vérifier à chaque redimensionnement
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Empêcher le défilement du document lorsque le panneau est ouvert sur mobile
  useEffect(() => {
    const handleBodyOverflow = () => {
      document.body.style.overflow = (isMobile && sidebarExpanded) ? 'hidden' : '';
      document.documentElement.style.overflow = (isMobile && sidebarExpanded) ? 'hidden' : '';
      
      // Fixer la position pour éviter le défilement de la page entière
      if (isMobile && sidebarExpanded) {
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.documentElement.style.position = 'fixed';
        document.documentElement.style.width = '100%';
      } else {
        document.body.style.position = '';
        document.body.style.width = '';
        document.documentElement.style.position = '';
        document.documentElement.style.width = '';
      }
    };
    
    handleBodyOverflow();
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
    };
  }, [isMobile, sidebarExpanded]);
  
  // Redimensionner la carte quand l'interface mobile change
  useEffect(() => {
    if (map.current && mapLoaded) {
      map.current.resize();
    }
  }, [isMobile, sidebarExpanded, mapLoaded]);

  // Gestionnaires d'événements tactiles simplifiés pour le glissement
  const handleTouchStart = (e) => {
    // Ne démarrer le glissement que si on touche la poignée
    const target = e.target;
    const isHandle = target.closest('.panel-handle');
    
    if (isHandle) {
      setTouchStart(e.targetTouches[0].clientY);
      setIsSwiping(true);
      setSwipeDistance(0);
    }
  };
  
  const handleTouchMove = (e) => {
    if (!touchStart || !isSwiping) return;
    
    // Calculer la distance parcourue
    const currentTouch = e.targetTouches[0].clientY;
    const distance = currentTouch - touchStart;
    
    // Sauvegarder la position actuelle
    setTouchEnd(currentTouch);
    
    // Ne considérer que les glissements vers le bas
    if (distance > 0) {
      e.preventDefault();
      setSwipeDistance(distance);
      
      // Appliquer la transformation au panneau pendant le glissement
      if (sidebarRef.current) {
        const dampedDistance = Math.pow(distance, 0.6); // Effet de résistance encore plus important
        sidebarRef.current.style.transform = `translateY(${dampedDistance}px)`;
      }
    }
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !isSwiping) {
      resetSwipe();
      return;
    }
    
    // Calculer la distance finale
    const distance = touchEnd - touchStart;
    
    // Rendre la fermeture encore moins sensible
    const shouldClose = distance > 200 || distance > window.innerHeight * 0.4;
    
    if (shouldClose) {
      setSidebarExpanded(false);
    }
    
    // Animation de retour à la position initiale
    if (sidebarRef.current) {
      sidebarRef.current.style.transition = 'transform 200ms ease-out';
      sidebarRef.current.style.transform = '';
    }
    
    // Réinitialiser avec un petit délai pour laisser l'animation se terminer
    setTimeout(resetSwipe, 250);
  };
  
  const resetSwipe = () => {
    setTouchStart(null);
    setTouchEnd(null);
    setIsSwiping(false);
    setSwipeDistance(0);
    
    // Réinitialiser la position du panneau
    if (sidebarRef.current) {
      sidebarRef.current.style.transform = '';
    }
  };

  // Modifier la fonction fetchNetworks pour utiliser la structure correcte de la base de données
  useEffect(() => {
    const fetchNetworks = async () => {
      setNetworksLoading(true);
      try {
        // Récupérer les réseaux
        const { data: networksData, error: networksError } = await supabase
          .from('networks')
          .select('*')
          .order('network_name');
        
        if (networksError) throw networksError;
        
        // Récupérer toutes les agences
        const { data: agenciesData, error: agenciesError } = await supabase
          .from('agency')
          .select('agency_id, network_id, agency_name, network_type');
        
        if (agenciesError) {
          console.warn("Impossible de récupérer les données d'agence:", agenciesError);
          // Continuer avec seulement les réseaux
          setNetworks(networksData || []);
        } else {
          // Fusionner les données des réseaux avec les noms d'agence
          const networksWithAgencies = networksData.map(network => {
            const matchingAgency = agenciesData.find(
              agency => String(agency.network_id) === String(network.network_id)
            );
            
            return {
              ...network,
              agency_name: matchingAgency ? matchingAgency.agency_name : 'Inconnu',
              network_type: matchingAgency ? matchingAgency.network_type : null,
              // Si region est null ou undefined, utiliser "Non classée" par défaut
              region: network.region || "Non classée"
            };
          });
          
          setNetworks(networksWithAgencies || []);
        }
      } catch (err) {
        console.error('Error fetching networks:', err);
        // En cas d'erreur, réessayer avec seulement les réseaux de base
        try {
          const { data, error } = await supabase
            .from('networks')
            .select('network_id, network_name')
            .order('network_name');
          
          if (error) throw error;
          setNetworks(data || []);
        } catch (fallbackErr) {
          console.error('Fallback error:', fallbackErr);
        }
      } finally {
        setNetworksLoading(false);
      }
    };

    fetchNetworks();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!window.mapboxgl) {
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.async = true;
      
      script.onload = () => {
        const link = document.createElement('link');
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        window.mapboxgl.accessToken = 'pk.eyJ1Ijoid2VpYmVsY2xlbWVudDYwIiwiYSI6ImNtMm9yZ3JpaDA4OGQybHIxcTBibHk4NXQifQ.iUZ4I9uI1lIWgamjWnDIYg';
        initializeMap();
      };

      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    } else {
      window.mapboxgl.accessToken = 'pk.eyJ1Ijoid2VpYmVsY2xlbWVudDYwIiwiYSI6ImNtMm9yZ3JpaDA4OGQybHIxcTBibHk4NXQifQ.iUZ4I9uI1lIWgamjWnDIYg';
      initializeMap();
    }
  }, []);

  // Fetch initial stops for the map - REMOVED, will be handled by map move events
  /*
  useEffect(() => {
    if (mapLoaded && !initialStopsFetched && searchResults.length === 0 && !selectedStop) {
      const fetchInitialStops = async () => {
        setMapLoading(true); // Utiliser mapLoading pour l'indicateur
        try {
          const { data, error } = await supabase
            .from('stops')
            .select('stop_id, stop_name, network_id, city, stop_lat, stop_lon')
            .not('stop_lat', 'is', null)
            .not('stop_lon', 'is', null)
            .limit(100); // Limiter le nombre d'arrêts initiaux

          if (error) throw error;
          setInitialMapStops(data || []);
          setInitialStopsFetched(true);
        } catch (err) {
          console.error('Error fetching initial stops:', err);
          // Pas besoin de définir mapError ici, car c'est un chargement de fond
        } finally {
          setMapLoading(false);
        }
      };
      fetchInitialStops();
    }
  }, [mapLoaded, initialStopsFetched, searchResults.length, selectedStop]);
  */

  // Initialize map function
  const initializeMap = () => {
    if (map.current || !window.mapboxgl || !mapContainer.current) return;
    
    setMapLoading(true);
    
    try {
      map.current = new window.mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [2.3488, 48.8534], // Paris by default
        zoom: 9,
        attributionControl: false
      });

      map.current.addControl(new window.mapboxgl.NavigationControl(), 'bottom-right');
      map.current.addControl(new window.mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true
      }), 'bottom-right');

      map.current.on('load', () => {
        // Ajouter les sources et les couches pour le tracé du trajet
        
        // Source pour la partie future du trajet (après l'arrêt sélectionné)
        map.current.addSource('trip-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });
        
        // Source pour la partie passée du trajet (avant l'arrêt sélectionné)
        map.current.addSource('trip-route-past', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });
        
        // Couche pour la partie future du trajet (colorée selon la ligne)
        map.current.addLayer({
          id: 'trip-route-line',
          type: 'line',
          source: 'trip-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 4
          }
        });
        
        // Couche pour la partie passée du trajet (en gris)
        map.current.addLayer({
          id: 'trip-route-line-past',
          type: 'line',
          source: 'trip-route-past',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#888888',
            'line-width': 4,
            'line-opacity': 0.7,
            'line-dasharray': [1, 1]
          }
        });

        // Source pour les étiquettes des arrêts du trajet
        map.current.addSource('trip-stop-labels', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Couche pour les étiquettes des arrêts du trajet
        map.current.addLayer({
          id: 'trip-stop-labels-layer',
          type: 'symbol',
          source: 'trip-stop-labels',
          layout: {
            'text-field': ['get', 'stop_name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.0], // Décalage pour que le texte soit au-dessus du marqueur
            'text-anchor': 'top',
            'text-size': 10,
            'text-allow-overlap': false // Peut être ajusté si nécessaire
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 1
          }
        });
        
        setMapLoaded(true);
        setMapLoading(false);
        // Initial check for stops after map loads
        handleMapMove(); 
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Erreur lors du chargement de la carte');
        setMapLoading(false);
      });
      map.current.on('moveend', handleMapMove); // Add listener for map movements
    } catch (err) {
      console.error('Error initializing map:', err);
      setMapError('Erreur lors de l\'initialisation de la carte');
      setMapLoading(false);
    }
  };

  // Handle map movement to fetch initial stops
  const handleMapMove = () => {
    if (mapMoveTimeoutIdRef.current) {
      clearTimeout(mapMoveTimeoutIdRef.current);
    }

    mapMoveTimeoutIdRef.current = setTimeout(async () => {
      if (!map.current || !mapLoaded) return;

      // If a network search, stop selection, or trip details are active, don't fetch initial stops
      if (selectedNetwork || selectedStop || isShowingTripDetails || searchTerm.length > 0 || searchResults.length > 0) {
        // If we were showing initial stops, clear them and any message
        if (initialMapStops.length > 0) setInitialMapStops([]);
        if (mapInteractionMessage) setMapInteractionMessage(null);
        lastFetchedInitialStopsBoundsKeyRef.current = null; // Reset bounds so fetch happens if user clears search
        return;
      }

      const currentZoom = map.current.getZoom();

      if (currentZoom < MIN_ZOOM_FOR_INITIAL_STOPS) {
        if (initialMapStops.length > 0) {
          setInitialMapStops([]); // This will trigger useEffect to clear markers
        }
        setMapInteractionMessage("Zoomez davantage pour afficher les arrêts.");
        lastFetchedInitialStopsBoundsKeyRef.current = null; // Allow fetching if zoom changes back
        return;
      }
      
      if (mapInteractionMessage === "Zoomez davantage pour afficher les arrêts.") {
        setMapInteractionMessage(null);
      }

      const bounds = map.current.getBounds();
      const boundsKey = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;

      if (lastFetchedInitialStopsBoundsKeyRef.current === boundsKey) {
        return; // Bounds haven't changed enough, or data for these bounds already fetched
      }
      
      // If we are here, it means we should fetch.
      // If there was a different message (e.g. "No stops found"), clear it before fetching.
      if (mapInteractionMessage && mapInteractionMessage !== "Zoomez davantage pour afficher les arrêts.") {
        setMapInteractionMessage(null);
      }
      
      await fetchStopsInBounds(bounds, boundsKey);

    }, 750); // Debounce/delay before fetching
  };
  
  // Fetch stops within the current map bounds
  const fetchStopsInBounds = async (bounds, newBoundsKey) => {
    setMapLoading(true); // Use general map loading indicator
    setMapInteractionMessage(null); // Clear previous messages
    try {
      const { data, error } = await supabase
        .from('stops')
        .select('stop_id, stop_name, network_id, city, stop_lat, stop_lon')
        .not('stop_lat', 'is', null)
        .not('stop_lon', 'is', null)
        .gte('stop_lat', bounds.getSouth())
        .lte('stop_lat', bounds.getNorth())
        .gte('stop_lon', bounds.getWest())
        .lte('stop_lon', bounds.getEast())
        .limit(200); // Limit to avoid overwhelming the map and API

      if (error) throw error;

      if (data && data.length > 0) {
        setInitialMapStops(data);
        lastFetchedInitialStopsBoundsKeyRef.current = newBoundsKey; // Store key of successfully fetched bounds
      } else {
        setInitialMapStops([]);
        setMapInteractionMessage("Aucun arrêt trouvé dans cette zone.");
        // Don't update lastFetchedInitialStopsBoundsKeyRef if no stops found,
        // so a small pan might try again if it was a sparse area.
        // Or, one could argue to store it to prevent refetching for an empty area.
        // For now, let's allow refetching if area was empty.
      }
    } catch (err) {
      console.error('Error fetching stops in bounds:', err);
      setMapInteractionMessage('Erreur lors du chargement des arrêts.');
      setInitialMapStops([]); // Clear stops on error
    } finally {
      setMapLoading(false);
    }
  };

  // Reset the map markers when search results change or initial stops update
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear previous general stop markers (search results or initial stops)
    Object.values(stopMarkers.current).forEach(marker => marker.remove());
    stopMarkers.current = {};
    
    let stopsToDisplay = [];
    let currentMarkerType = 'initial';

    if (searchResults.length > 0) {
      stopsToDisplay = searchResults;
      currentMarkerType = 'search_result';
    } else if (!selectedNetwork && !selectedStop && initialMapStops.length > 0) {
      // Only display initialMapStops if no search, no selected network, and no selected stop
      stopsToDisplay = initialMapStops;
      currentMarkerType = 'initial';
    }


    // Add markers for stops to display
    stopsToDisplay.forEach(stop => {
      if (stop.stop_lat && stop.stop_lon && 
          !isNaN(parseFloat(stop.stop_lat)) && 
          !isNaN(parseFloat(stop.stop_lon))) {
        // Pass the markerType to createStopMarker
        const marker = createStopMarker(stop, currentMarkerType);
        if (marker) {
            // Use a unique key
            const markerKey = stop.original_stops // For grouped search results
                ? `${stop.network_id}-${stop.display_name}-${stop.city}` 
                : `${stop.network_id}-${stop.stop_id}`; // For initial stops or non-grouped results
            stopMarkers.current[markerKey] = marker;
        }
      }
    });

    // Center map on stops to display if there are any, and not showing trip details
    // And not currently just showing initial stops (map interaction should handle zoom/pan for those)
    if (stopsToDisplay.length > 0 && currentMarkerType === 'search_result' && !isShowingTripDetails) {
      const validPoints = stopsToDisplay
        .map(stop => {
          // Extraire lat et lon, en s'assurant qu'ils sont des nombres valides.
          const lat = parseFloat(stop.stop_lat);
          const lon = parseFloat(stop.stop_lon);

          if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            return [lon, lat];
          }
          return null; // Retourner null pour les arrêts avec des coordonnées invalides
        })
        .filter(point => point !== null); // Filtrer les résultats nuls
      
      // N'ajuster la carte que s'il y a des points valides
      if (validPoints.length > 0) {
        try {
          // Créer les bounds seulement après avoir vérifié que nous avons des points valides
          const bounds = new window.mapboxgl.LngLatBounds(validPoints[0]);
          
          // Étendre les bounds pour inclure tous les autres points
          validPoints.forEach(point => {
            bounds.extend(point);
          });
          
          map.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15
          });
        } catch (error) {
          console.error("Erreur lors de l'ajustement de la carte:", error);
          // En cas d'erreur, revenir à une vue par défaut
          map.current.flyTo({
            center: [2.3488, 48.8534], // Paris par défaut
            zoom: 9
          });
        }
      } else {
        // Si aucun point valide, revenir à une vue par défaut
        map.current.flyTo({
          center: [2.3488, 48.8534], // Paris par défaut
          zoom: 9
        });
      }
    }
  }, [searchResults, selectedStop, initialMapStops, mapLoaded, isShowingTripDetails]);

  // Update map when selected stop changes
  useEffect(() => {
    if (!map.current || !mapLoaded || isShowingTripDetails) return; // Ne pas créer de marqueurs si on affiche des détails

    // Nettoyer les marqueurs existants (activeSelectedStopMarker, groupedStopMarkers)
    // but not stopMarkers.current which are for search/initial
    clearAllMarkers();

    if (selectedStop && typeof selectedStop.stop_lat !== 'undefined' && typeof selectedStop.stop_lon !== 'undefined') {
      const mainLat = parseFloat(selectedStop.stop_lat);
      const mainLon = parseFloat(selectedStop.stop_lon);
      
      // Créer un tableau pour collecter tous les points valides
      const validPoints = [];
      
      // Ajouter le point principal s'il est valide
      if (!isNaN(mainLat) && !isNaN(mainLon) && 
          mainLat >= -90 && mainLat <= 90 && 
          mainLon >= -180 && mainLon <= 180) {
        
        // Ajouter aux points valides
        validPoints.push([mainLon, mainLat]);
        
        // Créer le marqueur principal
        const el = document.createElement('div');
        el.className = 'active-selected-stop-marker'; 
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = 'white'; 
        el.style.border = '4px solid #3B82F6';
        // el.style.boxShadow = '0 0 0 2px #3B82F6'; // Supprimé, géré par la bordure directe
        el.style.cursor = 'pointer'; 
        el.style.zIndex = '5';
        // Les styles flex pour le logo sont supprimés

        activeSelectedStopMarker.current = new window.mapboxgl.Marker(el)
          .setLngLat([mainLon, mainLat])
          .addTo(map.current);

        // Collecter les points des arrêts groupés
        if (Array.isArray(selectedStop.original_stops) && selectedStop.original_stops.length > 0) {
          selectedStop.original_stops.forEach(originalStop => {
            if (!originalStop || typeof originalStop.stop_lat === 'undefined' || typeof originalStop.stop_lon === 'undefined') {
              return; // Ignorer les arrêts malformés
            }

            const ogLat = parseFloat(originalStop.stop_lat);
            const ogLon = parseFloat(originalStop.stop_lon);

            // Ignorer les points invalides ou déjà ajoutés (comme le principal)
            if (isNaN(ogLat) || isNaN(ogLon) || 
                ogLat < -90 || ogLat > 90 || 
                ogLon < -180 || ogLon > 180 || 
                (ogLat === mainLat && ogLon === mainLon)) {
              return;
            }

            // Ajouter aux points valides
            validPoints.push([ogLon, ogLat]);
            
            // Créer le marqueur pour cet arrêt groupé
            const ogEl = document.createElement('div');
            ogEl.style.width = '20px';
            ogEl.style.height = '20px';
            ogEl.style.borderRadius = '50%';
            ogEl.style.backgroundColor = 'white';
            ogEl.style.border = '4px solid #3B82F6'; // Même style que le marqueur actif
            // ogEl.style.boxShadow = '0 0 0 2px #3B82F6'; // Supprimé
            ogEl.style.opacity = '1.0'; 
            ogEl.style.cursor = 'pointer';
            ogEl.style.zIndex = '5';
            // Les styles flex pour le logo sont supprimés

            const groupedMarker = new window.mapboxgl.Marker(ogEl)
              .setLngLat([ogLon, ogLat])
              .addTo(map.current);
            groupedStopMarkers.current.push(groupedMarker);
          });
        }
        
        // Ajuster la vue de la carte en fonction des points collectés
        if (validPoints.length > 1) {
          // Construire les limites à partir des points valides
          try {
            const bounds = validPoints.reduce((bounds, point) => {
              return bounds.extend(point);
            }, new window.mapboxgl.LngLatBounds(validPoints[0], validPoints[0]));
            
            map.current.fitBounds(bounds, { 
              padding: 70, 
              maxZoom: 16 
            });
          } catch (e) {
            console.error('Error fitting bounds:', e);
            // Fallback: si l'ajustement des limites échoue, centrer sur le point principal
            map.current.flyTo({
              center: [mainLon, mainLat],
              zoom: 15,
              essential: true
            });
          }
        } else {
          // Si un seul point valide, centrer sur lui
          map.current.flyTo({
            center: [mainLon, mainLat],
            zoom: 15,
            essential: true
          });
        }
      } else {
        console.warn('Selected stop has invalid main coordinates:', selectedStop);
      }
    } else if (selectedStop) {
      console.warn('Selected stop is missing lat/lon:', selectedStop);
    }
  }, [selectedStop, mapLoaded, isShowingTripDetails]);

  // Create a marker for a stop
  const createStopMarker = (stop, markerType = 'search_result') => {
    if (!stop.stop_lat || !stop.stop_lon || 
        isNaN(parseFloat(stop.stop_lat)) || 
        isNaN(parseFloat(stop.stop_lon))) {
      return null;
    }
    
    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);
    
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }

    const el = document.createElement('div');
    // Common style for the clickable marker element
    el.style.cursor = 'pointer';


    if (markerType === 'initial') {
        el.style.textAlign = 'center';
        el.style.zIndex = '3'; // Lower z-index for initial stops

        const circle = document.createElement('div');
        circle.style.width = '12px'; 
        circle.style.height = '12px';
        circle.style.backgroundColor = 'white';
        circle.style.border = '3px solid black'; // User: 4px black border, white interior
        circle.style.borderRadius = '50%';
        circle.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
        circle.style.margin = '0 auto'; // Center the circle
        el.appendChild(circle);

        const label = document.createElement('div');
        label.textContent = stop.stop_name;
        label.style.fontSize = '10px';
        label.style.color = '#333333'; 
        label.style.marginTop = '2px';
        label.style.fontWeight = '500';
        label.style.backgroundColor = 'rgba(255, 255, 255, 0.75)';
        label.style.padding = '1px 3px';
        label.style.borderRadius = '3px';
        label.style.whiteSpace = 'nowrap'; 
        label.style.textShadow = '0px 0px 2px rgba(255,255,255,0.7)';


        // Prevent label from capturing clicks meant for the marker itself if they overlap
        // (though visually it's below)
        label.style.pointerEvents = 'none'; 

        el.appendChild(label);
    } else { // 'search_result' or other default markers (currently only search_result uses this path actively for general stops)
        el.className = 'stop-marker'; // Existing class for styling via CSS if any
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.overflow = 'hidden';
        el.style.borderRadius = '50%';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.backgroundColor = '#3B82F6'; // Default BG if logo fails for search results
        el.style.zIndex = '5';


        // Grossir le point si c'est l'arrêt sélectionné (this logic might be redundant if selectedStop has its own markers)
        // This part is more for when 'searchResults' contains the currently selected stop.
        const isSelectedCurrently = selectedStop && 
                                  (selectedStop.stop_ids ? 
                                   selectedStop.stop_ids.includes(stop.stop_id) : 
                                   selectedStop.stop_id === stop.stop_id);
        
        if (isSelectedCurrently) {
            el.style.width = '30px';
            el.style.height = '30px';
            el.style.border = '3px solid #3B82F6'; // Blue highlight for selected search result
            el.style.zIndex = '10'; 
        } else {
            el.style.width = '20px';
            el.style.height = '20px';
            el.style.border = '2px solid white';
        }
        
        // Créer une image pour le logo du réseau (for search_result type)
        const img = document.createElement('img');
        // Ensure network_id exists. If it's an initial stop without specific network context, this might be missing.
        // However, initial stops are styled above. This path is for search results which should have network_id.
        img.src = stop.network_id ? `/logos/${stop.network_id}.svg` : '/logos/default.svg';
        img.style.width = '80%';
        img.style.height = '80%';
        img.style.objectFit = 'contain';
        
        let fallbackContent = null;
        img.onerror = () => {
            img.remove(); // Remove broken image
            el.style.backgroundColor = '#cccccc'; // Fallback avec un fond gris
            
            // Create fallback text (e.g., first two letters of network_id or stop_name)
            fallbackContent = document.createElement('span');
            fallbackContent.style.color = 'black';
            fallbackContent.style.fontSize = '10px';
            fallbackContent.style.fontWeight = 'bold';
            let text = '??';
            if (stop.network_id) {
                text = stop.network_id.substring(0, 2).toUpperCase();
            } else if (stop.stop_name) {
                text = stop.stop_name.substring(0, 1).toUpperCase();
            }
            fallbackContent.textContent = text;
            el.appendChild(fallbackContent);
        };
        el.appendChild(img);
    }
    
    const marker = new window.mapboxgl.Marker(el)
      .setLngLat([lon, lat])
      .setPopup(new window.mapboxgl.Popup({ offset: 25 })
        .setHTML(`<h3>${stop.stop_name}</h3><p>${stop.city || ''}</p>`))
      .addTo(map.current);

    // Add click event to marker to select the stop
    // Si stop.original_stops existe, c'est un résultat de recherche groupé, sinon un arrêt normal ou initial
    el.addEventListener('click', () => {
      // Pour les arrêts initiaux ou les arrêts directs (non groupés des résultats de recherche),
      // nous devons simuler la structure d'un arrêt groupé pour handleStopSelect.
      if (!stop.original_stops) {
        const stopToSelect = {
          ...stop,
          display_name: stop.stop_name,
          stop_ids: [stop.stop_id],
          original_stops: [stop]
        };
        handleStopSelect(stopToSelect);
      } else {
        handleStopSelect(stop);
      }
    });

    return marker;
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    
    // Nettoyer tous les marqueurs lorsque la recherche change
    clearAllMarkers();
    
    // Réinitialiser les états si la recherche est effacée
    if (e.target.value.length === 0) {
      setSelectedStop(null);
      setStopSchedules([]);
      setSelectedTrip(null);
      setIsShowingTripDetails(false);
    }
    
    if (e.target.value.length >= 3) {
      searchStops(e.target.value);
    } else {
      setSearchResults([]);
    }
  };

  // Handle network selection change
  const handleNetworkChange = (e) => {
    setSelectedNetwork(e.target.value);
  };

  // Search for stops matching the search term
  const searchStops = async (term) => {
    if (term.length < 3) return;
    
    setSearchLoading(true);
    try {
      const params = {
        search_term: term
      };
  
      if (selectedNetwork) {
        params.p_network_id = selectedNetwork;
      }

      const { data, error } = await supabase.rpc('search_stops_unaccent', params);
      
      if (error) throw error;

      // Regrouper uniquement les arrêts qui ont exactement le même nom (pas de normalisation)
      const groupedStops = {};
      data.forEach(stop => {
        // Utiliser le nom exact pour le regroupement - pas de normalisation
        const exactName = stop.stop_name;
        // Inclure network_id et city pour éviter de regrouper des arrêts de réseaux ou villes différentes
        const key = `${exactName}-${stop.city || ''}-${stop.network_id}`;
        
        if (!groupedStops[key]) {
          groupedStops[key] = {
            ...stop,
            display_name: stop.stop_name, // Conserver le nom d'origine
            stop_ids: [stop.stop_id],
            original_stops: [stop]
          };
        } else {
          // Ajouter l'ID à la liste des IDs regroupés
          groupedStops[key].stop_ids.push(stop.stop_id);
          groupedStops[key].original_stops.push(stop);
        }
      });
      
      // Convertir en tableau et trier par nom
      const results = Object.values(groupedStops).sort((a, b) => 
        a.display_name.localeCompare(b.display_name)
      );
      
      setSearchResults(results.slice(0, 20)); // Limiter à 20 résultats finaux
    } catch (err) {
      console.error('Error searching stops:', err);
      setError('Erreur lors de la recherche des arrêts');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle stop selection
  const handleStopSelect = async (stop) => {
    // Effacer tous les marqueurs existants avant d'en créer de nouveaux
    clearAllMarkers();
    
    // Réinitialiser les états liés aux détails du trajet
    setSelectedTrip(null);
    setTripStops([]);
    setIsShowingTripDetails(false);
    
    setSelectedStop(stop);
    setSearchTerm(stop.display_name || stop.stop_name);
    setSearchResults([]);

    setSearchParams({
      network: stop.network_id,
      stop: stop.stop_id,
      name: stop.display_name || stop.stop_name
    }, { replace: true });

    // Mettre à jour la sélection du réseau et le terme de recherche du réseau
    // si le réseau de l'arrêt est différent du réseau actuellement sélectionné
    // ou si aucun réseau n'est sélectionné.
    if (stop.network_id && (stop.network_id !== selectedNetwork || !selectedNetwork)) {
      setSelectedNetwork(stop.network_id);
      const networkInfo = networks.find(n => n.network_id === stop.network_id);
      if (networkInfo) {
        setNetworkSearchTerm(networkInfo.network_name);
      } else {
        // Si les informations du réseau ne sont pas encore chargées, 
        // nous pourrions vouloir les récupérer ou utiliser network_id comme fallback.
        setNetworkSearchTerm(stop.network_id); // Fallback au network_id
      }
    }
    
    // Sur mobile, étendre automatiquement le panneau de résultats
    if (isMobile) {
      setSidebarExpanded(true);
    }
    
    await fetchStopSchedulesForMultipleIds(stop);
  };
  
  // Fetch schedules for multiple stop IDs
  const fetchStopSchedulesForMultipleIds = async (stop) => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    setStopSchedules([]); // Clear previous schedules

    try {
      const stopIds = stop.stop_ids || [stop.stop_id];
      console.log(`Récupération des horaires pour les arrêts: ${stopIds.join(', ')} du réseau: ${stop.network_id} pour aujourd'hui.`);

      // --- LOGIQUE DE FILTRAGE PAR CALENDRIER ---
      // Utiliser la fonction spéciale pour gérer le décalage horaire
      const { date: today, dateStr: todayDateStr, dayOfWeek } = getTodayForSupabase();

      const parseGtfsDate = (dateStr) => {
        if (!dateStr) return null;
        let year, month, day;
        if (dateStr.includes('-')) { 
          [year, month, day] = dateStr.split('-').map(Number);
        } else if (dateStr.length === 8) { 
          year = parseInt(dateStr.substring(0, 4), 10);
          month = parseInt(dateStr.substring(4, 6), 10);
          day = parseInt(dateStr.substring(6, 8), 10);
        } else {
          return null; 
        }
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month -1 || date.getUTCDate() !== day) {
            return null;
        }
        return date;
      };
      
      const { data: calendarData, error: calendarError } = await supabase
        .from('calendar')
        .select('service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date')
        .eq('network_id', stop.network_id);

      if (calendarError) throw new Error(`Erreur lors de la récupération du calendrier: ${calendarError.message}`);

      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from('calendar_dates')
        .select('service_id, exception_type, date')
        .eq('network_id', stop.network_id)
        .eq('date', todayDateStr);

      if (exceptionsError) throw new Error(`Erreur lors de la récupération des exceptions du calendrier: ${exceptionsError.message}`);

      let validServiceIds = calendarData
        .filter(service => {
          const startDate = parseGtfsDate(service.start_date);
          const endDate = parseGtfsDate(service.end_date);
          if (!startDate || !endDate) return false;
          const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
          const isDateValid = todayUtc >= startDate && todayUtc <= endDate;
          const dayFieldName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
          const runsOnDay = service[dayFieldName] === true || service[dayFieldName] === 1;
          return isDateValid && runsOnDay;
        })
        .map(service => service.service_id);

      if (exceptionsData && exceptionsData.length > 0) {
        const exceptionsMap = new Map();
        exceptionsData.forEach(ex => exceptionsMap.set(ex.service_id, ex.exception_type));
        validServiceIds = validServiceIds.filter(serviceId => {
          const exceptionType = exceptionsMap.get(serviceId);
          if (exceptionType === 2) return false; 
          return true;
        });
        exceptionsData.forEach(ex => {
          if (ex.exception_type === 1 && !validServiceIds.includes(ex.service_id)) {
            validServiceIds.push(ex.service_id); 
          }
        });
      }
      
      console.log(`Service IDs valides pour aujourd'hui (${todayDateStr}, jour ${dayOfWeek}):`, validServiceIds);

      if (validServiceIds.length === 0) {
        console.log("Aucun service valide trouvé pour aujourd'hui.");
        setInfoMessage("Aucun service n'est planifié sur ce réseau pour aujourd'hui.");
        setLoading(false);
        setStopSchedules([]);
        return;
      }

      // Get current time in HH:MM:SS format for filtering
      const currentDateQuery = new Date();
      const hours = currentDateQuery.getHours().toString().padStart(2, '0');
      const minutes = currentDateQuery.getMinutes().toString().padStart(2, '0');
      const seconds = currentDateQuery.getSeconds().toString().padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}:${seconds}`;
      console.log(`[OPTIM] Current time for stop_times query: ${currentTimeStr}`);

      const { data: stopTimesData, error: stopTimesError } = await supabase
        .from('stop_times')
        .select(
          'trip_id,arrival_time,departure_time,stop_sequence,stop_id'
        )
        .in('stop_id', stopIds)
        .eq('network_id', stop.network_id)
        .gte('departure_time', currentTimeStr) // <-- ADDED THIS LINE
        .order('departure_time');
      
      if (stopTimesError) throw stopTimesError;
      
      if (!stopTimesData || stopTimesData.length === 0) {
        console.log(`[DEBUG] Aucun stop_times initial trouvé pour les arrêts ${stopIds.join(', ')} avant filtrage par trips valides.`);
        setInfoMessage(`Aucun passage enregistré n\'a été trouvé pour cet arrêt dans la base de données.`);
        setLoading(false);
        return;
      }
      console.log(`[DEBUG] Trouvé ${stopTimesData.length} stop_times initiaux pour les arrêts ${stopIds.join(', ')}.`);
      const initialTripIdsInStopTimes = [...new Set(stopTimesData.map(st => st.trip_id))];
      console.log(`[DEBUG] Trip IDs présents dans ces stop_times initiaux (échantillon):`, initialTripIdsInStopTimes.slice(0, 20));
        
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(
          'trip_id,route_id,service_id,trip_headsign,direction_id'
        )
        .in('service_id', validServiceIds) 
        .eq('network_id', stop.network_id);
        
      if (tripsError) throw tripsError;
      
      if (!tripsData || tripsData.length === 0) {
        console.log("Aucun trajet (trip) trouvé pour ce réseau utilisant les services valides aujourd'hui.");
        setInfoMessage("Aucun service actif aujourd\'hui ne semble correspondre à des trajets pour ce réseau.");
        setStopSchedules([]);
        setLoading(false);
        return;
      }
      
      console.log(`Trouvé ${tripsData.length} trajets (trips) correspondants aux services valides (actifs aujourd'hui).`);
      const validTripIdsFromFilteredTrips = tripsData.map(t => t.trip_id);
      console.log(`[DEBUG] Trip IDs des trajets valides aujourd'hui (échantillon):`, validTripIdsFromFilteredTrips.slice(0, 20));

      // Initialiser tripsMap ici, car il est utilisé dans la logique de limitation qui suit
      const tripsMap = {};
      tripsData.forEach(trip => {
        tripsMap[trip.trip_id] = trip;
      });
      console.log(`[DEBUG] tripsMap initialisé avec ${Object.keys(tripsMap).length} entrées.`);

      const initialTripIdsSet = new Set(initialTripIdsInStopTimes);
      const validTripIdsSet = new Set(validTripIdsFromFilteredTrips);
      const commonTripIds = [...initialTripIdsSet].filter(tripId => validTripIdsSet.has(tripId));
      console.log(`[DEBUG] Nombre de Trip IDs communs entre stop_times initiaux et trips valides: ${commonTripIds.length}`);
      
      // Nouveaux logs pour investiguer les trips potentiellement manqués
      const potentiallyMissedTripIds = initialTripIdsInStopTimes.filter(tripId => !validTripIdsSet.has(tripId));
      if (potentiallyMissedTripIds.length > 0) {
        console.log(`[DEBUG INVESTIGATION] ${potentiallyMissedTripIds.length} Trip IDs sont dans les stop_times initiaux mais PAS dans les trips actifs du jour. Récupération de leurs service_id...`);
        const { data: missedTripsServiceInfo, error: missedTripsError } = await supabase
          .from('trips')
          .select('trip_id, service_id')
          .in('trip_id', potentiallyMissedTripIds)
          .eq('network_id', stop.network_id);

        if (missedTripsError) {
          console.error('[DEBUG INVESTIGATION] Erreur lors de la récupération des service_id pour les trips manqués:', missedTripsError);
        } else if (missedTripsServiceInfo && missedTripsServiceInfo.length > 0) {
          const missedTripsServiceMap = new Map();
          missedTripsServiceInfo.forEach(trip => missedTripsServiceMap.set(trip.trip_id, trip.service_id));
          
          const lateStopTimesWithMissedServices = stopTimesData
            .filter(st => potentiallyMissedTripIds.includes(st.trip_id) && parseInt(st.departure_time.split(':')[0], 10) >= 12) // Focus sur l'après-midi/soir
            .map(st => ({ 
              trip_id: st.trip_id, 
              departure_time: st.departure_time, 
              stop_id: st.stop_id,
              actual_service_id: missedTripsServiceMap.get(st.trip_id) || 'Non trouvé'
            }))
            .sort((a,b) => a.departure_time.localeCompare(b.departure_time));

          if (lateStopTimesWithMissedServices.length > 0) {
            console.warn(`[DEBUG INVESTIGATION] Passages de l'après-midi/soir potentiellement manqués car leur service_id n'est pas dans [${validServiceIds.join(', ')}]:`, 
              lateStopTimesWithMissedServices.slice(0, 30) // Afficher jusqu'à 30 pour avoir une bonne vue
            );
          } else {
            console.log('[DEBUG INVESTIGATION] Aucun passage de l\'après-midi/soir trouvé parmi les trips dont les service_id ne sont pas AutoGen_1 ou AutoGen_2.');
          }
        } else {
          console.log('[DEBUG INVESTIGATION] Aucune information de service trouvée pour les trips manqués.');
        }
      }
      // Fin des nouveaux logs
      
      if (commonTripIds.length > 0) {
        const stopTimesForCommonTrips = stopTimesData.filter(st => commonTripIds.includes(st.trip_id) && stopIds.includes(st.stop_id));
        console.log(`[DEBUG] Échantillon des ${stopTimesForCommonTrips.length} stop_times associés aux ${commonTripIds.length} Trip IDs communs (avant filtrage final pour filteredStopTimesData):`,
          stopTimesForCommonTrips.slice(0, 10).map(st => ({trip_id: st.trip_id, stop_id: st.stop_id, departure: st.departure_time}))
        );
      } else if (initialTripIdsSet.size > 0 && validTripIdsSet.size > 0) {
        console.warn(`[DEBUG] ALERTE: Aucun Trip ID commun. Les arrêts recherchés ne sont desservis par aucun des trajets actifs aujourd'hui.`);
      }

      const filteredStopTimesData = stopTimesData.filter(st => 
        validTripIdsSet.has(st.trip_id) && // Doit appartenir à un trip actif aujourd'hui
        stopIds.includes(st.stop_id)      // Doit être pour l'un des arrêts recherchés
      );
      
      // --- DEBUT DE LA NOUVELLE LOGIQUE DE LIMITATION ---
      const MAX_THEORETICAL_DEPARTURES_PER_GROUP = 10; // Limiter à 10 départs théoriques par groupe
      const provisionalGroupCounts = {};
      const processedStopTimes = [];

      // tripsMap doit être défini ici si ce n'est pas déjà fait plus haut.
      // Assumons que tripsMap est déjà créé à partir de tripsData
      // const tripsMap = {}; 
      // tripsData.forEach(trip => { tripsMap[trip.trip_id] = trip; });
      // Cette initialisation de tripsMap est faite plus bas dans le code original, déplaçons-la ou assurons-nous qu'elle est disponible.
      // Pour l'instant, on va supposer qu'elle est disponible. Si ce n'est pas le cas, il faudra l'ajouter ici.

      for (const st of filteredStopTimesData) { // filteredStopTimesData est trié par departure_time
        const trip = tripsMap[st.trip_id]; // tripsMap doit être accessible ici
        if (!trip || !trip.route_id) {
          console.warn(`[OPTIM] Trip ou route_id manquant pour stop_time trip_id ${st.trip_id} lors de la limitation provisoire.`);
          continue; 
        }

        const provisionalKey = `${trip.route_id}-${trip.direction_id !== undefined && trip.direction_id !== null ? trip.direction_id : 'unknown_dir'}`;
        provisionalGroupCounts[provisionalKey] = (provisionalGroupCounts[provisionalKey] || 0) + 1;

        if (provisionalGroupCounts[provisionalKey] <= MAX_THEORETICAL_DEPARTURES_PER_GROUP) {
          processedStopTimes.push(st);
        }
      }
      console.log(`[OPTIM] Nombre de stop_times après limitation provisoire par groupe: ${processedStopTimes.length} (au lieu de ${filteredStopTimesData.length})`);
      // --- FIN DE LA NOUVELLE LOGIQUE DE LIMITATION ---


      if (processedStopTimes.length > 0) { // Changé de filteredStopTimesData à processedStopTimes
        console.log(`[DEBUG] Échantillon de processedStopTimes (après limitation provisoire):`,
          processedStopTimes.slice(0, 10).map(st => ({trip_id: st.trip_id, stop_id: st.stop_id, departure: st.departure_time}))
        );
      }

      if (!processedStopTimes || processedStopTimes.length === 0) { // Changé de filteredStopTimesData
        console.log("Aucun horaire de passage trouvé pour les arrêts sélectionnés ET les services valides aujourd'hui (après croisement et limitation).");
        // ... (gestion des messages d'info existants)
        if (commonTripIds.length > 0 && filteredStopTimesData.length > 0) { // Check filteredStopTimesData here to know if there *were* theoretical times
            setInfoMessage("Les services actifs aujourd'hui ne semblent pas desservir ces arrêts spécifiques avec des horaires correspondants (ou tous les passages sont déjà passés après considération des limites).");
        } else if (commonTripIds.length > 0) {
             setInfoMessage("Les services actifs aujourd'hui ne semblent pas desservir ces arrêts spécifiques avec des horaires correspondants.");
        } else {
            setInfoMessage("Aucun passage n'est prévu pour cet arrêt avec les services actifs aujourd'hui.");
        }
        setStopSchedules([]);
        setLoading(false);
        return;
      }
      console.log(`Trouvé ${processedStopTimes.length} horaires de passage après filtrage par trips valides et limitation.`); // Changé
        
      const tripIdsForLastStopQuery = [...new Set(processedStopTimes.map(st => st.trip_id))]; // Changé
              
      const routeIds = [...new Set(tripsData.filter(trip => tripIdsForLastStopQuery.includes(trip.trip_id)).map(trip => trip.route_id))];
      
      const { data: routesData, error: routesError } = await supabase
        .from('routes')
        .select(
          'route_id,route_short_name,route_long_name,route_color,route_text_color'
        )
        .in('route_id', routeIds)
        .eq('network_id', stop.network_id); 
      
      if (routesError) throw routesError;
      
      if (!routesData || routesData.length === 0) {
        console.log("Aucune information de ligne (route) trouvée pour les trajets identifiés.");
        setInfoMessage("Impossible de récupérer les détails des lignes pour les horaires trouvés.");
        setStopSchedules([]);
        setLoading(false);
        return;
      }
      console.log(`Trouvé ${routesData.length} lignes correspondantes`);
      
      const tripLastStopsMap = {};
      
      await Promise.all(tripIdsForLastStopQuery.map(async (tripId) => {
        try {
          const { data: tripStopTimes, error: tripStopTimesError } = await supabase
            .from('stop_times')
            .select('stop_id,stop_sequence')
            .eq('trip_id', tripId)
            .eq('network_id', stop.network_id) 
            .order('stop_sequence', { ascending: true });
          
          if (tripStopTimesError) throw tripStopTimesError;
          
          if (tripStopTimes && tripStopTimes.length > 0) {
            const lastStopTime = tripStopTimes[tripStopTimes.length - 1];
            const { data: lastStopData, error: lastStopError } = await supabase
              .from('stops')
              .select('stop_name, city')
              .eq('stop_id', lastStopTime.stop_id)
              .eq('network_id', stop.network_id) 
              .limit(1);
            
            if (lastStopError) throw lastStopError;
            
            if (lastStopData && lastStopData.length > 0) {
              tripLastStopsMap[tripId] = {
                destination: lastStopData[0].stop_name,
                city: lastStopData[0].city ? lastStopData[0].city : null
              };
            }
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération du dernier arrêt pour le trajet ${tripId}:`, error);
        }
      }));
      
      const routesMap = {};
      routesData.forEach(route => {
        routesMap[route.route_id] = route;
      });
      
      // Log pour les trip_id dans processedStopTimes qui ne sont pas dans tripsMap (devrait être 0 si tripsMap est bien peuplé avant)
      const missingTripIdsInTripsMap = processedStopTimes // Changé
        .map(st => st.trip_id)
        .filter(tripId => !tripsMap[tripId]);
      if (missingTripIdsInTripsMap.length > 0) {
        console.warn(`[DEBUG] ALERTE: ${missingTripIdsInTripsMap.length} trip_ids de processedStopTimes ne sont pas dans tripsMap. Échantillon:`, [...new Set(missingTripIdsInTripsMap)].slice(0,10));
      }

      const combinedData = processedStopTimes // Changé
        .filter(stopTime => tripsMap[stopTime.trip_id] !== undefined) 
        .map(stopTime => {
          const trip = tripsMap[stopTime.trip_id] || {}; // Ne devrait plus être undefined grâce au filtre précédent
          const route = trip.route_id ? routesMap[trip.route_id] || {} : {};
          const lastStop = tripLastStopsMap[stopTime.trip_id] || {};
          
          return {
            ...stopTime,
            trips: { ...trip, routes: route, lastStop: lastStop }
          };
        });
      
      console.log(`Données combinées générées pour ${combinedData.length} passages`);
      
      const schedulesByRouteAndDestination = {};
      
      if (combinedData && combinedData.length > 0) {
        console.log(`[DEBUG] combinedData avant regroupement par destination (échantillon):`, combinedData.slice(0, 5).map(cd => ({ departure: cd.departure_time, trip_id: cd.trip_id, stop_id: cd.stop_id, destination: cd.trips?.lastStop?.destination, route_id: cd.trips?.route_id }) ));

        combinedData.forEach(item => {
          if (!item.trips || !item.trips.route_id || !item.trips.lastStop || !item.trips.lastStop.destination) {
            console.warn("[DEBUG] Item ignoré car données de trip/route/lastStop manquantes:", item);
            return;
          }
          
          const routeId = item.trips.route_id;
          const directionId = item.trips.direction_id;
          const destination = item.trips.lastStop.destination;
          const city = item.trips.lastStop.city;
          
          // Log pour la condition isTerminus
          const isTerminusForThisItem = item.trips.lastStop.destination === stop.display_name && stopIds.includes(item.stop_id);
          if (isTerminusForThisItem) {
            console.log(`[DEBUG] Vérification isTerminus: Arrêt recherché '${stop.display_name}' (IDs: ${stopIds.join(',')}) EST terminus '${destination}' pour trip ${item.trip_id} à l'arrêt ${item.stop_id}. Item ignoré.`);
            return;
          }
          
          const routeKey = `${routeId}-${directionId}-${destination}`;
          
          if (!schedulesByRouteAndDestination[routeKey]) {
            schedulesByRouteAndDestination[routeKey] = {
              route_id: routeId,
              direction_id: directionId,
              network_id: stop.network_id,
              route_short_name: item.trips.routes?.route_short_name || '',
              route_long_name: item.trips.routes?.route_long_name || '',
              route_color: item.trips.routes?.route_color || '000000',
              route_text_color: item.trips.routes?.route_text_color || 'FFFFFF',
              destination: destination,
              city: city,
              departures: [],
              _debug_original_item_departures: [] // Pour le débogage
            };
          }
          
          if (item.departure_time) {
            // Vérifier si un départ très proche en temps (± 3 minutes) existe déjà pour éviter les doublons
            const departureTime = item.departure_time;
            const [hours, minutes] = departureTime.split(':').map(Number);
            const departureMinutes = hours * 60 + minutes;
            
            // Vérifier s'il existe déjà un départ similaire
            const existingSimilarDeparture = schedulesByRouteAndDestination[routeKey].departures.find(dep => {
              const [depHours, depMinutes] = dep.time.split(':').map(Number);
              const depTotalMinutes = depHours * 60 + depMinutes;
              // Considérer comme doublon si moins de 3 minutes d'écart
              return Math.abs(depTotalMinutes - departureMinutes) <= 3;
            });
            
            // N'ajouter que si ce n'est pas un doublon
            if (!existingSimilarDeparture) {
              schedulesByRouteAndDestination[routeKey].departures.push({
                trip_id: item.trip_id,
                time: item.departure_time,
                stop_id: item.stop_id, // Conserver pour référence
                stop_name: stop.original_stops.find(s => s.stop_id === item.stop_id)?.stop_name || '' // Pour débogage
              });
            } else {
              console.log(`[DEBUG] Départ ignoré car trop proche d'un autre: ${departureTime} pour ligne ${schedulesByRouteAndDestination[routeKey].route_short_name} vers ${destination}`);
            }
            schedulesByRouteAndDestination[routeKey]._debug_original_item_departures.push(item.departure_time); // Pour le débogage
          }
        });
      }
      
      const schedulesArray = Object.values(schedulesByRouteAndDestination);
      console.log(`[DEBUG] Nombre de lignes/destinations AVANT filtrage des départs passés: ${schedulesArray.length}`);
      schedulesArray.forEach(route => console.log(`[DEBUG] Route ${route.route_short_name} vers ${route.destination}, départs bruts: ${route._debug_original_item_departures.join(', ')}`));
      
      // Nouvelle logique pour le filtrage et le tri basé sur le temps réel
      const schedulesArrayProvisional = Object.values(schedulesByRouteAndDestination);

      // Récupérer toutes les données temps réel pour les routes concernées
      // Assurez-vous que `fetchRealtimeData` est bien la fonction importée de `../services/realtime`
      const routeRealtimePromises = schedulesArrayProvisional.map(route => 
        fetchRealtimeData(stop.network_id, route.route_id)
      );

      const realtimeResultsForRoutes = await Promise.all(routeRealtimePromises);

      const localRealtimeDataMap = {};
      schedulesArrayProvisional.forEach((route, index) => {
        if (realtimeResultsForRoutes[index]) {
          localRealtimeDataMap[route.route_id] = realtimeResultsForRoutes[index];
        }
      });

      schedulesArrayProvisional.forEach(route => {
        route.departures.forEach(departure => {
          let delayMinutes = 0;
          let actualTimeFromRT = null; // Heure absolue fournie par le flux RT

          const routeRt = localRealtimeDataMap[route.route_id];
          if (routeRt) {
            const key = `${departure.trip_id}-${departure.stop_id}`;
            // Essayer aussi avec stop_sequence si disponible dans `departure` et si `processGtfsRtData` la stocke
            // const keyWithSeq = `${departure.trip_id}-${departure.stop_id}-${departure.stop_sequence}`;

            if (routeRt.delays) {
              if (routeRt.delays[key] !== undefined) delayMinutes = routeRt.delays[key];
              // else if (departure.stop_sequence && routeRt.delays[keyWithSeq] !== undefined) delayMinutes = routeRt.delays[keyWithSeq];
            }
            if (routeRt.updatedTimes) {
              if (routeRt.updatedTimes[key]) actualTimeFromRT = routeRt.updatedTimes[key].departure || routeRt.updatedTimes[key].arrival;
              // else if (departure.stop_sequence && routeRt.updatedTimes[keyWithSeq]) {
              //   actualTimeFromRT = routeRt.updatedTimes[keyWithSeq].departure || routeRt.updatedTimes[keyWithSeq].arrival;
              // }
            }
          }

          if (actualTimeFromRT) {
            departure.effectiveTime = new Date(actualTimeFromRT);
          } else {
            const [h, m] = departure.time.split(':').map(Number);
            const theoreticalDate = new Date(); 
            // Ajuster la date théorique pour qu'elle soit "aujourd'hui" pour la comparaison,
            // car l'heure de départ est juste HH:MM.
            // Si h >= 24, cela sera géré correctement par setHours pour le jour suivant.
            theoreticalDate.setHours(h, m, 0, 0); // Heure théorique
            departure.effectiveTime = new Date(theoreticalDate.getTime() + delayMinutes * 60000); // Ajouter le retard en millisecondes
          }
        });

        route.departures.sort((a, b) => a.effectiveTime - b.effectiveTime);
      });
      
      const now = new Date();
      schedulesArrayProvisional.forEach(route => {
        console.log(`[DEBUG] Filtrage des départs pour ${route.route_short_name} vers ${route.destination}. Heure actuelle: ${now.toLocaleTimeString()}`);
        route.departures = route.departures.filter(dep => {
          const isUpcoming = dep.effectiveTime >= now;
          if (!isUpcoming) {
            console.log(`[DEBUG] Départ passé (effectiveTime: ${dep.effectiveTime.toLocaleTimeString()}) ignoré: ${dep.time} (théorique) pour trip ${dep.trip_id}`);
          }
          return isUpcoming;
        });
        route.departures = route.departures.slice(0, 5);
      });
      
      const finalSchedulesArray = schedulesArrayProvisional.filter(route => route.departures.length > 0);
      
      let messaggioInformativo = infoMessage; // Renommé pour éviter conflit avec la variable globale

      if (finalSchedulesArray.length === 0 && schedulesArrayProvisional.some(r => r.departures.length > 0 || (r._debug_original_item_departures && r._debug_original_item_departures.length > 0))) {
        // Ce cas est si après le filtrage par temps effectif, il ne reste plus rien, mais il y avait des départs (même théoriques)
        console.log("Tous les passages pour cet arrêt (en tenant compte du temps réel) sont terminés pour aujourd'hui.");
        messaggioInformativo = "Tous les passages (y compris ceux en retard) sont terminés pour aujourd'hui.";
      } else if (finalSchedulesArray.length === 0 && !messaggioInformativo) {
        // Si aucun départ du tout, même théorique, et pas déjà un message d'info.
        console.log("Aucun prochain passage trouvé pour cet arrêt aujourd'hui après tous les filtres.");
        messaggioInformativo = "Aucun passage n'a été trouvé pour cet arrêt aujourd'hui.";
      }
      setInfoMessage(messaggioInformativo);

      finalSchedulesArray.sort((a, b) => {
        if (a.route_short_name !== b.route_short_name) {
          return a.route_short_name.localeCompare(b.route_short_name);
        }
        return a.destination.localeCompare(b.destination);
      });
      
      console.log(`Affichage de ${finalSchedulesArray.length} lignes avec leurs destinations pour aujourd'hui.`);
      setStopSchedules(finalSchedulesArray);
      
      // Mettre à jour l'état global realtimeData pour que l'affichage l'utilise immédiatement
      const newGlobalRealtimeData = {...realtimeData};
      Object.entries(localRealtimeDataMap).forEach(([routeId, data]) => {
          newGlobalRealtimeData[routeId] = data;
      });
      setRealtimeData(newGlobalRealtimeData); // Assure que les composants d'affichage ont les mêmes données RT

      // La boucle fetchRealtimeDataForRoute ci-dessous est redondante si on fait ça, mais peut servir pour des mises à jour futures continues.
      // Pour l'instant, on peut la commenter ou la supprimer si la source RT n'est pas un polling.
      /*
      finalSchedulesArray.forEach(route => {
        fetchRealtimeDataForRoute(stop.network_id, route.route_id);
      });
      */
    } catch (err) {
      console.error('Error fetching stop schedules:', err);
      setError('Erreur lors du chargement des horaires: ' + (err.message || 'Erreur inconnue'));
      setStopSchedules([]); 
    } finally {
      setLoading(false);
    }
  };

  // Fetch realtime data for a route
  const fetchRealtimeDataForRoute = async (networkId, routeId) => {
    try {
      const realtimeResult = await fetchRealtimeData(networkId, routeId);
      console.log(`[DEBUG] Horaires.js - fetchRealtimeDataForRoute - RECEIVED realtimeResult FOR network ${networkId}, route ${routeId}:`, realtimeResult);
      if (realtimeResult) {
        setRealtimeData(prevData => {
          const newData = {
            ...prevData,
            [routeId]: realtimeResult
          };
          console.log(`[DEBUG] Horaires.js - fetchRealtimeDataForRoute - UPDATED realtimeData STATE:`, newData);
          return newData;
        });
      }
    } catch (err) {
      console.error('Error fetching realtime data:', err);
    }
  };

  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
  };

  // Get realtime delay for a trip
  const getRealtimeDelay = (routeId, tripId, stopId) => {
    let delay = 0;
    const key = `${tripId}-${stopId}`;

    if (realtimeData[routeId] && realtimeData[routeId].delays && realtimeData[routeId].delays[key]) {
      delay = realtimeData[routeId].delays[key];
    }
    // Log retiré pour concision, sera rétabli si besoin
    return delay;
  };

  // Nouvelle fonction pour obtenir toutes les infos temps réel pertinentes
  const getRealtimeInfo = (routeId, tripId, stopId) => {
    const info = {
      delay: 0,
      actualTime: null, // Heure absolue si fournie par le temps réel
      hasRealtimeUpdate: false
    };

    const key = `${tripId}-${stopId}`;

    if (realtimeData[routeId]) {
      if (realtimeData[routeId].delays && realtimeData[routeId].delays[key] !== undefined) {
        info.delay = realtimeData[routeId].delays[key];
        info.hasRealtimeUpdate = true;
      }
      // Vérifier aussi updatedTimes, car un StopTimeEvent peut avoir un .time sans .delay
      if (realtimeData[routeId].updatedTimes && realtimeData[routeId].updatedTimes[key]) {
        const rtTimes = realtimeData[routeId].updatedTimes[key];
        // Prioriser l'heure de départ si disponible, sinon arrivée
        info.actualTime = rtTimes.departure || rtTimes.arrival;
        info.hasRealtimeUpdate = true;
        // Si nous avons une heure absolue et pas de delay explicite, nous pourrions calculer le retard ici
        // Mais pour l'instant, la simple présence de actualTime indique une mise à jour.
      }
    }
    console.log(`[DEBUG] Horaires.js - getRealtimeInfo - route: ${routeId}, trip: ${tripId}, stop: ${stopId}, INFO:`, info, `current realtimeData for route:`, realtimeData[routeId]);
    return info;
  };

  // Format time with delay
  const formatTimeWithDelay = (timeStr, routeId, tripId, stopId) => {
    if (!timeStr) return '';
    
    const { delay, actualTime } = getRealtimeInfo(routeId, tripId, stopId);

    if (actualTime) {
      // Si une heure absolue est fournie par le temps réel, l'utiliser
      const date = new Date(actualTime);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (delay === 0) {
      return formatTime(timeStr);
    }
    
    // Calculate time with delay
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + Math.floor(delay / 60), 0);
    
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Nettoyer les détails du trajet sur la carte
  const clearTripDetails = () => {
    // Nettoyer tous les marqueurs (et tracés d'itinéraire)
    clearAllMarkers();
    
    // Nettoyer uniquement ce qui n'est pas déjà fait par clearAllMarkers
    if (map.current) {
      // Vider les étiquettes des arrêts
      if (map.current.getSource('trip-stop-labels')) {
        map.current.getSource('trip-stop-labels').setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      
      // Réinitialiser le filtre de la couche des labels d'arrêts du trajet
      if (map.current.getLayer('trip-stop-labels-layer')) {
        map.current.setFilter('trip-stop-labels-layer', null);
      }
    }
    
    // Réinitialiser les états
    setSelectedTrip(null);
    setTripStops([]);
    setTripShape(null);
    setTripRouteColor('#3B82F6');
    setIsShowingTripDetails(false);
    
    // Recréer les marqueurs d'arrêt uniquement si nous ne sommes pas en train d'afficher des détails
    if (selectedStop && !isShowingTripDetails) {
      // (Code existant pour recréer les marqueurs si nécessaire)
      // ...
    }
  };

  // Fonction globale pour nettoyer tous les marqueurs
  const clearAllMarkers = () => {
    // Nettoyer les marqueurs d'arrêt sélectionné
    if (activeSelectedStopMarker.current) {
      activeSelectedStopMarker.current.remove();
      activeSelectedStopMarker.current = null;
    }
    
    // Nettoyer les marqueurs d'arrêts groupés
    groupedStopMarkers.current.forEach(marker => marker.remove());
    groupedStopMarkers.current = [];
    
    // Nettoyer les marqueurs de trajet
    tripStopMarkers.current.forEach(marker => marker.remove());
    tripStopMarkers.current = [];
    
    // Nettoyer les marqueurs de terminus
    tripTerminusMarkers.current.forEach(marker => marker.remove());
    tripTerminusMarkers.current = [];
    
    // Nettoyer également les tracés d'itinéraire
    if (map.current) {
      // Vider le tracé de la route future
      if (map.current.getSource('trip-route')) {
        map.current.getSource('trip-route').setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
      }
      
      // Vider le tracé de la route passée
      if (map.current.getSource('trip-route-past')) {
        map.current.getSource('trip-route-past').setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
      }
    }
  };

  // Fonction pour récupérer et afficher les détails d'un trajet sélectionné
  const fetchTripDetails = async (networkId, tripId, routeId, routeColor) => {
    if (!map.current || !mapLoaded) return;
    
    // Marquer que nous affichons des détails de trajet
    setIsShowingTripDetails(true);
    
    // Nettoyer tous les marqueurs et détails précédents
    clearTripDetails();
    clearAllMarkers();  // Assurance double pour nettoyer tous les marqueurs
    
    setTripDetailsLoading(true);
    setTripDetailsError(null);
    setSelectedTrip(tripId);
    
    try {
      // Récupérer les arrêts de ce trajet
      const { data: stopTimesData, error: stopTimesError } = await supabase
        .from('stop_times')
        .select(`
          stop_id,
          stop_sequence,
          arrival_time,
          departure_time
        `)
        .eq('trip_id', tripId)
        .eq('network_id', networkId)
        .order('stop_sequence', { ascending: true });
      
      if (stopTimesError) throw stopTimesError;
      
      if (!stopTimesData || stopTimesData.length === 0) {
        throw new Error("Aucun arrêt trouvé pour ce trajet");
      }
      
      // Récupérer les détails des arrêts
      const stopIds = stopTimesData.map(st => st.stop_id);
      
      const { data: stopsData, error: stopsError } = await supabase
        .from('stops')
        .select('stop_id, stop_name, stop_lat, stop_lon, city, network_id') // Ajout de network_id
        .in('stop_id', stopIds)
        .eq('network_id', networkId);
      
      if (stopsError) throw stopsError;
      
      // Combiner les données des arrêts avec leurs horaires
      const stopsWithTimes = stopTimesData.map(st => {
        const stopInfo = stopsData.find(s => s.stop_id === st.stop_id);
        return {
          ...st,
          ...stopInfo
        };
      });
      
      setTripStops(stopsWithTimes);
      
      // Récupérer le tracé (shape) du trajet
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('shape_id')
        .eq('trip_id', tripId)
        .eq('network_id', networkId)
        .limit(1);
      
      if (tripError) throw tripError;
      
      if (tripData && tripData.length > 0 && tripData[0].shape_id) {
        const shapeId = tripData[0].shape_id;
        
        const { data: shapeData, error: shapeError } = await supabase
          .from('shapes')
          .select('shape_pt_lat, shape_pt_lon, shape_pt_sequence')
          .eq('shape_id', shapeId)
          .eq('network_id', networkId)
          .order('shape_pt_sequence', { ascending: true });
        
        if (shapeError) throw shapeError;
        
        if (shapeData && shapeData.length > 0) {
          setTripShape(shapeData);
          
          // Filtrer les coordonnées valides de manière moins restrictive
          console.log(`Récupération de ${shapeData.length} points de tracé pour le trajet ${tripId}`);
          
          // Convertir toutes les coordonnées, même si certaines semblent invalides
          const allCoordinates = shapeData.map(point => {
            const lon = parseFloat(point.shape_pt_lon);
            const lat = parseFloat(point.shape_pt_lat);
            return [lon, lat];
          });
          
          // Filtrer seulement les coordonnées vraiment invalides (NaN)
          const coordinates = allCoordinates.filter(coord => {
            const isValid = !isNaN(coord[0]) && !isNaN(coord[1]);
            if (!isValid) {
              console.warn(`Point invalide détecté: [${coord[0]}, ${coord[1]}]`);
            }
            return isValid;
          });
          
          console.log(`Après filtrage basique: ${coordinates.length}/${allCoordinates.length} points valides conservés`);
          
          if (coordinates.length > 0) {
            const color = `#${routeColor || '3B82F6'}`;
            setTripRouteColor(color);
            
            // Trouver l'arrêt sélectionné pour diviser le trajet
            const selectedStopId = selectedStop ? selectedStop.stop_id : null;
            const selectedStopIds = selectedStop && selectedStop.stop_ids ? selectedStop.stop_ids : [selectedStopId];
            
            // Trouver l'index de l'arrêt sélectionné dans la séquence des arrêts
            let selectedStopIndex = -1;
            
            if (selectedStopIds && selectedStopIds.length > 0) {
              // Trouver le premier arrêt dans la liste qui correspond à l'un des IDs sélectionnés
              for (let i = 0; i < stopsWithTimes.length; i++) {
                if (selectedStopIds.includes(stopsWithTimes[i].stop_id)) {
                  selectedStopIndex = i;
                  break;
                }
              }
            }
            
            // Log pour comprendre la division du tracé
            if (selectedStopIndex !== -1) {
              console.log(`Arrêt sélectionné trouvé à l'index ${selectedStopIndex}: ${stopsWithTimes[selectedStopIndex].stop_name}`);
            } else {
              console.log(`Aucun arrêt sélectionné trouvé dans la séquence des arrêts du trajet`);
            }
            
            // Si on trouve l'arrêt dans la séquence, on divise le tracé
            if (selectedStopIndex !== -1 && stopsWithTimes[selectedStopIndex] && 
                stopsWithTimes[selectedStopIndex].stop_lat && stopsWithTimes[selectedStopIndex].stop_lon) {
              
              // Trouver le point du tracé le plus proche de l'arrêt sélectionné
              const selectedStopLat = parseFloat(stopsWithTimes[selectedStopIndex].stop_lat);
              const selectedStopLon = parseFloat(stopsWithTimes[selectedStopIndex].stop_lon);
              
              let closestPointIndex = 0;
              let minDistance = Number.MAX_VALUE;
              
              coordinates.forEach((coord, index) => {
                const dx = coord[0] - selectedStopLon;
                const dy = coord[1] - selectedStopLat;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                  minDistance = distance;
                  closestPointIndex = index;
                }
              });
              
              console.log(`Point du tracé le plus proche de l'arrêt sélectionné: index ${closestPointIndex}/${coordinates.length-1}, distance: ${minDistance.toFixed(6)} degrés`);
              
              // Diviser les coordonnées en deux parties
              const pastCoordinates = coordinates.slice(0, closestPointIndex + 1);
              const futureCoordinates = coordinates.slice(closestPointIndex);
              
              console.log(`Division du tracé: ${pastCoordinates.length} points dans la partie passée, ${futureCoordinates.length} points dans la partie future`);
              
              // Mettre à jour les sources pour les deux parties du trajet
              if (pastCoordinates.length > 0) {
                map.current.getSource('trip-route-past').setData({
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: pastCoordinates
                  }
                });
              }
              
              if (futureCoordinates.length > 0) {
                map.current.getSource('trip-route').setData({
                  type: 'Feature',
                  properties: { color },
                  geometry: {
                    type: 'LineString',
                    coordinates: futureCoordinates
                  }
                });
              }

              // Ajuster la vue pour voir la partie FUTURE du trajet et les arrêts restants
              if (futureCoordinates.length > 0) {
                try {
                  const futureBounds = new window.mapboxgl.LngLatBounds();
                  let toekomstHasValidPoints = false; // Renommé pour éviter la confusion avec la variable plus haut

                  futureCoordinates.forEach(coord => {
                    if (Array.isArray(coord) && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1])) {
                      futureBounds.extend(coord);
                      toekomstHasValidPoints = true;
                    }
                  });

                  // Inclure les arrêts restants du trajet dans les bounds
                  // selectedStopIndex est l'index de l'arrêt actuel ou du premier arrêt du groupe sélectionné dans stopsWithTimes
                  if (stopsWithTimes && selectedStopIndex !== -1) {
                    for (let i = selectedStopIndex; i < stopsWithTimes.length; i++) {
                      const stop = stopsWithTimes[i];
                      if (stop.stop_lat && stop.stop_lon) {
                        const lat = parseFloat(stop.stop_lat);
                        const lon = parseFloat(stop.stop_lon);
                        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                          futureBounds.extend([lon, lat]);
                          toekomstHasValidPoints = true;
                        }
                      }
                    }
                  }

                  if (toekomstHasValidPoints) {
                    console.log(`Ajustement de la vue pour inclure la partie FUTURE du tracé et les arrêts restants`);
                    map.current.fitBounds(futureBounds, {
                      padding: { top: 80, bottom: 80, left: 80, right: 80 },
                      maxZoom: 15 // Zoom un peu plus généreux pour la partie future
                    });
                  } else {
                    // Fallback si pas de points valides dans le futur (ne devrait pas arriver si futureCoordinates existe)
                    map.current.flyTo({ center: coordinates[0], zoom: 13 });
                  }
                } catch (err) {
                  console.error('Error adjusting map view to future path:', err);
                  if (coordinates.length > 0) map.current.flyTo({ center: coordinates[0], zoom: 13 });
                }
              } else if (coordinates.length > 0) {
                 // S'il n'y a pas de tracé futur (ex: on est au terminus) mais qu'il y a un tracé global,
                 // zoom sur l'ensemble du tracé comme avant (ou sur le dernier arrêt).
                const bounds = new window.mapboxgl.LngLatBounds();
                coordinates.forEach(coord => bounds.extend(coord));
                stopsWithTimes.forEach(stop => {
                  if (stop.stop_lat && stop.stop_lon) bounds.extend([parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)]);
                });
                if (!bounds.isEmpty()) {
                    map.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });
                } else if (coordinates.length > 0) {
                    map.current.flyTo({ center: coordinates[0], zoom: 13 });
                }
              }
            } else {
              // Si on ne trouve pas l'arrêt ou si on n'a pas d'arrêt sélectionné, 
              // on affiche tout le tracé en couleur normale et on zoome sur l'ensemble
              console.log(`Affichage de l'ensemble du tracé (${coordinates.length} points) sans division`);
              map.current.getSource('trip-route').setData({
                type: 'Feature',
                properties: { color },
                geometry: {
                  type: 'LineString',
                  coordinates
                }
              });
            }
            
            // Ajuster la vue pour voir tout le trajet
            try {
              // Créer un objet bounds pour contenir à la fois le tracé ET les marqueurs
              const bounds = new window.mapboxgl.LngLatBounds();
              let hasValidPoints = false;

              // Ajouter tous les points du tracé aux bounds
              if (coordinates.length > 0) {
                coordinates.forEach(coord => {
                  if (Array.isArray(coord) && coord.length === 2 && 
                      !isNaN(coord[0]) && !isNaN(coord[1])) {
                    bounds.extend(coord);
                    hasValidPoints = true;
                  }
                });
              }

              // Ajouter les positions des arrêts du trajet (particulièrement important pour les terminus)
              if (stopsWithTimes && stopsWithTimes.length > 0) {
                stopsWithTimes.forEach(stop => {
                  if (stop.stop_lat && stop.stop_lon) {
                    const lat = parseFloat(stop.stop_lat);
                    const lon = parseFloat(stop.stop_lon);
                    if (!isNaN(lat) && !isNaN(lon) && 
                        lat >= -90 && lat <= 90 && 
                        lon >= -180 && lon <= 180) {
                      bounds.extend([lon, lat]);
                      hasValidPoints = true;
                    }
                  }
                });
              }

              // Si on a des points valides, ajuster la vue
              if (hasValidPoints) {
                console.log(`Ajustement de la vue pour inclure le tracé et les arrêts du trajet`);
                map.current.fitBounds(bounds, {
                  padding: {top: 80, bottom: 80, left: 80, right: 80}, // Padding plus important pour éviter que les badges soient coupés
                  maxZoom: 14 // Zoom un peu moins aggressif pour voir plus de contexte
                });
              } else if (coordinates.length > 0) {
                // Fallback: centrer sur le premier point du tracé
                console.log(`Fallback: centrage sur le premier point du tracé`);
                map.current.flyTo({
                  center: coordinates[0],
                  zoom: 13
                });
              } else if (stopsWithTimes && stopsWithTimes.length > 0) {
                // Fallback: centrer sur le premier arrêt du trajet
                const firstStop = stopsWithTimes[0];
                if (firstStop.stop_lat && firstStop.stop_lon) {
                  const lat = parseFloat(firstStop.stop_lat);
                  const lon = parseFloat(firstStop.stop_lon);
                  if (!isNaN(lat) && !isNaN(lon)) {
                    console.log(`Fallback: centrage sur le premier arrêt du trajet`);
                    map.current.flyTo({
                      center: [lon, lat],
                      zoom: 13
                    });
                  }
                }
              }
            } catch (err) {
              console.error('Error adjusting map view:', err);
              // En cas d'erreur, revenir à une vue centrée sur le premier point si disponible
              if (coordinates.length > 0) {
                map.current.flyTo({
                  center: coordinates[0],
                  zoom: 13
                });
              }
            }
          } else {
            console.warn(`Aucune coordonnée valide trouvée pour le tracé du trajet ${tripId}`);
          }
        } else {
          console.log(`Aucun point de tracé (shape) trouvé pour le trajet ${tripId}`);
        }
      }
      
      // Ajouter les marqueurs pour chaque arrêt du trajet
      addTripStopMarkers(stopsWithTimes, routeColor);
      const stopIdsWithCustomLabels = addTripTerminusMarkers(stopsWithTimes); // Récupère les IDs des arrêts avec étiquettes De/Vers

      // Masquer les labels Mapbox standards pour les arrêts qui ont une étiquette De/Vers
      if (map.current.getLayer('trip-stop-labels-layer') && stopIdsWithCustomLabels.length > 0) {
        map.current.setFilter('trip-stop-labels-layer', ['!in', 'stop_id', ...stopIdsWithCustomLabels]);
      }
      
    } catch (err) {
      console.error('Error fetching trip details:', err);
      setTripDetailsError(err.message || 'Erreur lors du chargement des détails du trajet');
      clearTripDetails();
    } finally {
      setTripDetailsLoading(false);
    }
  };
  
  // Ajouter les marqueurs pour les arrêts du trajet
  const addTripStopMarkers = (stops, routeColor) => {
    if (!map.current || !mapLoaded) return;
    
    // Supprimer les marqueurs précédents
    tripStopMarkers.current.forEach(marker => marker.remove());
    tripStopMarkers.current = [];
    
    const stopLabelFeatures = [];

    stops.forEach((stop, index) => {
      if (!stop.stop_lat || !stop.stop_lon || 
          isNaN(parseFloat(stop.stop_lat)) || 
          isNaN(parseFloat(stop.stop_lon))) {
        return;
      }
      
      const lat = parseFloat(stop.stop_lat);
      const lon = parseFloat(stop.stop_lon);
      
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return;
      }
      
      // Vérifier si cet arrêt est l'arrêt sélectionné par l'utilisateur
      const isSelectedStop = selectedStop && 
                           (selectedStop.stop_ids ? 
                            selectedStop.stop_ids.includes(stop.stop_id) : 
                            selectedStop.stop_id === stop.stop_id);
      
      // Créer un élément pour le marqueur
      const el = document.createElement('div');
      el.className = 'trip-stop-marker';
      
      if (isSelectedStop) {
        // Grossir le point si c'est l'arrêt sélectionné
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.border = `4px solid #${routeColor || '3B82F6'}`;
        el.style.zIndex = '10'; // S'assurer qu'il est au-dessus des autres
      } else if (index === 0 || index === stops.length - 1) {
        // Premier et dernier arrêt légèrement plus grands
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.border = `3px solid #${routeColor || '3B82F6'}`;
      } else {
        // Arrêts normaux
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.border = `2px solid #${routeColor || '3B82F6'}`;
      }
      
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'white'; // Fond blanc
      el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
      // Les styles flex et overflow sont supprimés car plus de contenu interne
      
      const marker = new window.mapboxgl.Marker(el)
        .setLngLat([lon, lat])
        .addTo(map.current);
      
      tripStopMarkers.current.push(marker);

      // Préparer la feature pour l'étiquette
      stopLabelFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          stop_name: stop.stop_name,
          stop_id: stop.stop_id // Ajout de stop_id ici pour le filtrage
        }
      });
    });

    // Mettre à jour la source des étiquettes
    if (map.current.getSource('trip-stop-labels')) {
      map.current.getSource('trip-stop-labels').setData({
        type: 'FeatureCollection',
        features: stopLabelFeatures
      });
    }
  };

  // Nouvelle fonction pour ajouter les marqueurs de terminus (Départ/Arrivée)
  const addTripTerminusMarkers = (stops) => {
    if (!map.current || !mapLoaded || !stops || stops.length < 1) return [];

    tripTerminusMarkers.current.forEach(marker => marker.remove());
    tripTerminusMarkers.current = [];
    const stopIdsWithLabels = [];

    const firstStopOfTrip = stops[0];
    const lastStopOfTrip = stops[stops.length - 1];

    // Étiquette "De : [Arrêt Recherché]"
    if (selectedStop && selectedStop.stop_lat && selectedStop.stop_lon && 
        !isNaN(parseFloat(selectedStop.stop_lat)) && !isNaN(parseFloat(selectedStop.stop_lon))) {

      // Vérifier si l'un des arrêts originaux du selectedStop est présent dans le trajet actuel
      const isSelectedStopRepresentedInTrip = selectedStop.original_stops 
        ? selectedStop.original_stops.some(os => stops.find(s => s.stop_id === os.stop_id))
        : stops.find(s => s.stop_id === selectedStop.stop_id);

      // Vérifier que selectedStop (ou l'un de ses arrêts) n'est pas le terminus de CE trajet
      const isSelectedStopTheTerminus = selectedStop.original_stops
        ? selectedStop.original_stops.some(os => os.stop_id === lastStopOfTrip.stop_id)
        : selectedStop.stop_id === lastStopOfTrip.stop_id;

      if (isSelectedStopRepresentedInTrip && !isSelectedStopTheTerminus) {
        const lat = parseFloat(selectedStop.stop_lat); // Coordonnées du point de recherche/groupe
        const lon = parseFloat(selectedStop.stop_lon);

        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          const markerEl = document.createElement('div');
          markerEl.style.width = 'fit-content';
          markerEl.style.zIndex = '15';

          const card = document.createElement('div');
          card.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
          card.style.borderRadius = '3px';
          card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)';
          card.style.padding = '4px 8px'; // Padding légèrement augmenté
          card.style.fontSize = '11px'; // Police légèrement plus grande
          card.style.fontWeight = '500';
          card.style.whiteSpace = 'nowrap';
          card.style.display = 'inline-flex';
          card.style.alignItems = 'center';
          card.style.gap = '3px';

          // Déterminer si l'arrêt sélectionné (ou l'un de ses quais) est le premier arrêt du trajet
          const isSelectedStopTheFirstOfTrip = selectedStop.original_stops
            ? selectedStop.original_stops.some(os => os.stop_id === firstStopOfTrip.stop_id)
            : selectedStop.stop_id === firstStopOfTrip.stop_id;

          if (isSelectedStopTheFirstOfTrip) {
            card.style.transform = 'translate(-5%, -120%)'; // Augmenté la distance verticale
            card.style.textAlign = 'left';
          } else {
            card.style.transform = 'translate(-50%, -130%)'; // Augmenté la distance verticale
            card.style.textAlign = 'center';
          }

          const prefix = document.createElement('span');
          prefix.style.color = '#4A4A4A';
          prefix.style.fontWeight = '500'; // Un peu plus gras
          prefix.textContent = 'De :';

          const name = document.createElement('span');
          name.style.color = '#000000';
          name.style.fontWeight = '600'; // Plus gras
          name.textContent = selectedStop.display_name; // Utiliser display_name pour le groupe

          card.appendChild(prefix);
          card.appendChild(document.createTextNode(' '));
          card.appendChild(name);
          markerEl.appendChild(card);
          
          const marker = new window.mapboxgl.Marker(markerEl)
            .setLngLat([lon, lat])
            .addTo(map.current);
          
          tripTerminusMarkers.current.push(marker);
          // Ajouter les IDs originaux du selectedStop au filtrage si c'est un groupe
          if (selectedStop.original_stops) {
            selectedStop.original_stops.forEach(os => stopIdsWithLabels.push(os.stop_id));
          } else {
            stopIdsWithLabels.push(selectedStop.stop_id);
          }
        }
      }
    }

    // Étiquette "Vers : [Terminus du trajet]"
    if (lastStopOfTrip && lastStopOfTrip.stop_lat && lastStopOfTrip.stop_lon && 
        !isNaN(parseFloat(lastStopOfTrip.stop_lat)) && !isNaN(parseFloat(lastStopOfTrip.stop_lon))) {
      
      const lat = parseFloat(lastStopOfTrip.stop_lat);
      const lon = parseFloat(lastStopOfTrip.stop_lon);

      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const markerEl = document.createElement('div');
        markerEl.style.width = 'fit-content';
        markerEl.style.zIndex = '15';

        const card = document.createElement('div');
        card.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        card.style.borderRadius = '3px';
        card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)';
        card.style.padding = '4px 8px'; // Padding légèrement augmenté
        card.style.fontSize = '11px'; // Police légèrement plus grande
        card.style.fontWeight = '500';
        card.style.whiteSpace = 'nowrap';
        card.style.display = 'inline-flex';
        card.style.alignItems = 'center';
        card.style.gap = '3px';
        card.style.transform = 'translate(-80%, -120%)'; // Ajusté verticalement
        card.style.textAlign = 'right';

        const prefix = document.createElement('span');
        prefix.style.color = '#4A4A4A';
        prefix.style.fontWeight = '500'; // Un peu plus gras
        prefix.textContent = 'Vers :';

        const name = document.createElement('span');
        name.style.color = '#000000';
        name.style.fontWeight = '600'; // Plus gras
        name.textContent = lastStopOfTrip.stop_name; // Nom du terminus du trajet

        card.appendChild(prefix);
        card.appendChild(document.createTextNode(' '));
        card.appendChild(name);
        markerEl.appendChild(card);
        
        const marker = new window.mapboxgl.Marker(markerEl)
          .setLngLat([lon, lat])
          .addTo(map.current);
        
        tripTerminusMarkers.current.push(marker);
        stopIdsWithLabels.push(lastStopOfTrip.stop_id);
      }
    }
    return [...new Set(stopIdsWithLabels)]; // Assurer des IDs uniques pour le filtrage
  };

  // Remplacer la fonction handleSidebarScroll par une version plus simple
  const handleSidebarScroll = (e) => {
    // Cette fonction est maintenant simplifiée pour éviter d'interférer avec le défilement normal
    // tout en restant un point d'entrée pour des améliorations futures si nécessaire
  };

  // Effet pour charger l'arrêt depuis l'URL
  useEffect(() => {
    const loadStopFromUrl = async () => {
      const stopId = searchParams.get('stop');
      const networkId = searchParams.get('network');
      
      if (stopId && networkId && networks.length > 0) {
        if (selectedStop && selectedStop.stop_ids && selectedStop.stop_ids.includes(stopId) && selectedStop.network_id === networkId) {
          if (isMobile) {
            setSidebarExpanded(true);
          }
          return;
        }
        try {
          const { data: stopData, error } = await supabase
            .from('stops')
            .select('*')
            .eq('stop_id', stopId)
            .eq('network_id', networkId)
            .single();

          if (error) throw error;
          if (stopData) {
            // Formater les données de l'arrêt comme attendu par handleStopSelect
            const stop = {
              ...stopData,
              display_name: stopData.stop_name,
              stop_ids: [stopData.stop_id],
              original_stops: [stopData]
            };
            
            // Mettre à jour le réseau sélectionné
            setSelectedNetwork(networkId);
            const networkInfo = networks.find(n => n.network_id === networkId);
            if (networkInfo) {
              let displayName = networkInfo.network_name;
              if (networkInfo.network_type) {
                displayName += ` (${networkInfo.network_type})`;
              }
              setNetworkSearchTerm(displayName);
            } else {
              // Si le réseau n'est pas trouvé dans la liste, afficher l'ID en attendant
              setNetworkSearchTerm(networkId);
            }
            
            // Sélectionner l'arrêt et charger ses horaires
            await handleStopSelect(stop);
          }
        } catch (err) {
          console.error('Erreur lors du chargement de l\'arrêt depuis l\'URL:', err);
          setError('Impossible de charger l\'arrêt demandé');
        }
      }
    };

    loadStopFromUrl();
  }, [searchParams, networks, isMobile]); // Dépendances de l'effet

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* MapBox Map */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full z-0"
      />
      
      {/* Map overlay for loading and error states */}
      {mapLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}
      
      {mapError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md z-10">
          <p>{mapError}</p>
        </div>
      )}
      
      {/* Trip details loading indicator */}
      {tripDetailsLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-md z-10 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          <p>Chargement du trajet...</p>
        </div>
      )}
      
      {/* Trip details error */}
      {tripDetailsError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md z-10">
          <p>{tripDetailsError}</p>
        </div>
      )}
      
      {/* Trip details mode indicator */}
      {selectedTrip && (
        <div className="absolute top-4 right-4 z-10">
          <button 
            className="bg-white dark:bg-dark-800 shadow-md rounded-full p-2"
            onClick={clearTripDetails}
            title="Fermer les détails"
          >
            <FaTimes size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      )}
      
      {/* Bouton de recherche sur mobile (mode carte) - Ajuster la position pour qu'il soit complètement visible */}
      {isMobile && !sidebarExpanded && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <button 
            onClick={() => setSidebarExpanded(true)}
            className="bg-white dark:bg-dark-800 shadow-lg rounded-lg p-3 w-full flex items-center"
          >
            <FaSearch className="text-gray-400 mr-2" />
            <span className="text-gray-700 dark:text-gray-300">Rechercher un arrêt...</span>
          </button>
        </div>
      )}
      
      {/* Sidebar avec recherche et résultats - version adaptative */}
      <div 
        ref={sidebarRef}
        className={`absolute z-20 transition-all duration-300 ease-in-out ${
          isMobile 
            ? sidebarExpanded 
              ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl' // Hauteur maximale en vh pour assurer la visibilité complète
              : 'inset-x-0 -bottom-full max-h-[85vh] rounded-t-xl' // Mode mobile caché
            : 'top-0 left-0 h-full w-full md:w-1/3 lg:w-1/4'  // Mode desktop
        }`}
        style={{
          transition: isSwiping ? 'none' : 'all 300ms ease-in-out',
          height: isMobile ? 'auto' : '100%' // Auto height sur mobile pour s'adapter au contenu
        }}
      >
        {/* Poignée de glissement sur mobile - Plus grande et plus visible */}
        {isMobile && (
          <div 
            className="h-8 w-full flex justify-center items-center rounded-t-xl bg-white dark:bg-dark-800 cursor-pointer panel-handle"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-16 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full my-2"></div>
          </div>
        )}
        
        <div 
          className="bg-white dark:bg-dark-800 shadow-lg p-4 overflow-y-auto backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
          style={{ 
            height: isMobile ? 'calc(85vh - 2rem)' : '100%', // Hauteur calculée pour tenir compte de la poignée
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
          onTouchStart={(e) => {
            // Ne pas initialiser le glissement dans le contenu sauf tout en haut
            if (isMobile && e.currentTarget.scrollTop <= 5) {
              handleTouchStart(e);
            }
          }}
          onTouchMove={(e) => {
            if (isMobile && isSwiping) {
              handleTouchMove(e);
            }
          }}
          onTouchEnd={(e) => {
            if (isMobile && isSwiping) {
              handleTouchEnd(e);
            }
          }}
        >
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Horaires des arrêts</h1>
            {isMobile && (
              <button 
                onClick={() => setSidebarExpanded(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2" // Agrandir la zone tactile
              >
                <FaTimes size={24} /> {/* Icône plus grande */}
              </button>
            )}
          </div>
          
          {/* Network select - Ajuster pour assurer la visibilité complète */}
          <div className="mb-4 relative" ref={networkDropdownRef}>
            <label htmlFor="network-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Réseau
            </label>
            <div className="relative">
              <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="pl-4 pr-2">
                  {selectedNetwork ? (
                    <NetworkLogo 
                      networkId={selectedNetwork}
                      networkName={networks.find(n => n.network_id === selectedNetwork)?.network_name || ''}
                      size="small"
                    />
                  ) : (
                    <FaLayerGroup className="text-gray-400" />
                  )}
                </div>
                <input
                  id="network-search"
                  type="text"
                  placeholder="Rechercher un réseau..."
                  value={networkSearchTerm}
                  onChange={(e) => {
                    setNetworkSearchTerm(e.target.value);
                    setShowNetworkDropdown(true);
                  }}
                  onFocus={() => {
                    if(networkSearchTerm.trim().length > 0 || networks.length > 0) {
                       setShowNetworkDropdown(true);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {networkSearchTerm && (
                  <button
                    onClick={clearNetworkSelection}
                    className="px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
              
              {/* Liste déroulante des réseaux filtrés */}
              {showNetworkDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                  {(networkSearchTerm.trim() === '' ? networks : filteredNetworks).length > 0 ? (
                    <ul>
                      {(networkSearchTerm.trim() === '' ? networks : filteredNetworks).map((network) => (
                        <li
                          key={`${network.network_id}-${network.agency_id || ''}`}
                          onClick={() => handleNetworkSelection(network.network_id)}
                          className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                             <NetworkLogo networkId={network.network_id} agencyId={network.agency_id} alt={network.network_name} className="w-10 h-10 object-contain flex-shrink-0"/>
                             <div className="flex-grow">
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{network.network_name}</p>
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                  <span>{network.region}</span>
                                  {network.network_type && (
                                    <span 
                                      className="ml-2 px-2 py-0.5 rounded-full text-white text-xs font-semibold uppercase tracking-wider"
                                      style={{ 
                                        backgroundImage: 'linear-gradient(135deg, #07d6fb, #ff66c4)'
                                      }}
                                    >
                                      {network.network_type}
                                    </span>
                                  )}
                                </div>
                             </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-4 text-sm text-gray-500">Aucun réseau trouvé.</p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Search box - Assurer qu'elle est complètement visible */}
          <div className="relative mb-6">
            <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="pl-4 pr-2">
                <FaSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={!selectedNetwork ? "Veuillez choisir d'abord un réseau de bus" : "Rechercher un arrêt"}
                value={searchTerm}
                onChange={handleSearchChange}
                className="flex-grow py-3 px-2 outline-none dark:bg-dark-800 dark:text-white w-full disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                disabled={!selectedNetwork}
              />
            </div>
            
            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {searchResults.map((stop) => (
                  <li
                    key={`${stop.network_id}-${stop.display_name}-${stop.city || ''}-${stop.stop_ids.join(',')}`}
                    onClick={() => handleStopSelect(stop)}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <NetworkLogo 
                          networkId={stop.network_id}
                          networkName={stop.network_id}
                          size="medium"
                        />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{stop.display_name}</p>
                        <div className="flex items-center">
                          {stop.city && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">{stop.city}</span>
                          )}
                          {stop.city && (
                            <span className="text-gray-400 mx-1">·</span>
                          )}
                          <div className="flex items-center">
                            <FaMapMarkerAlt className="text-gray-400 mr-1" size={12} />
                            {stop.original_stops && stop.original_stops.length > 1 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                ({stop.original_stops.length} arrêts)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Selected stop information */}
          {selectedStop && (
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-md p-4 mb-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-grow">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <NetworkLogo 
                      networkId={selectedStop.network_id}
                      networkName={selectedStop.network_id}
                      size="medium"
                    />
                  </div>
                  <div className="ml-3">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedStop.stop_name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedStop.city ? `${selectedStop.city} · ` : ""}{selectedStop.network_id}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <FavoriteButton
                    type="stop"
                    item={{
                      networkId: selectedStop.network_id,
                      stopId: selectedStop.stop_id,
                      stopName: selectedStop.stop_name,
                      stopLat: selectedStop.stop_lat,
                      stopLon: selectedStop.stop_lon
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-center my-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded my-4">
              <p>{error}</p>
            </div>
          )}
          
          {/* Schedules list */}
          {!loading && stopSchedules.length > 0 && (
            <div className="space-y-4 pb-24"> {/* Augmenter le padding bottom ici */}
              <h3 className="text-lg font-bold flex items-center">
                <FaBus className="mr-2" />
                Prochains passages
              </h3>
              
              {stopSchedules.map((route, routeIndex) => (
                <div key={routeIndex} className="bg-white dark:bg-dark-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center p-3">
                    <div 
                      className="w-12 h-8 rounded-[8px] flex items-center justify-center font-bold text-sm px-1"
                      style={{ 
                        backgroundColor: `#${route.route_color || '3B82F6'}`,
                        color: `#${route.route_text_color || 'FFFFFF'}` 
                      }}
                    >
                      <span className="truncate max-w-full">{route.route_short_name}</span>
                    </div>
                    <div className="flex-1 ml-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-base dark:text-white">
                          <FaArrowRight className="inline-block mr-1 text-xs" />
                          {route.trip_headsign ? route.trip_headsign : route.destination}
                          {route.trip_headsign && route.destination && route.trip_headsign.toLowerCase() !== route.destination.toLowerCase() ? 
                            <span className="font-normal"> → {route.destination}</span> : ''}
                        </span>
                        {route.city && (!route.trip_headsign || !route.trip_headsign.includes(route.city)) && 
                        (!route.destination || !route.destination.includes(route.city)) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{route.city}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {route.departures.length > 0 ? (
                      route.departures.map((departure, depIndex) => (
                        <div 
                          key={depIndex} 
                          className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 last:border-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-700"
                          onClick={() => fetchTripDetails(route.network_id, departure.trip_id, route.route_id, route.route_color)}
                        >
                          <div className="text-lg font-bold dark:text-white flex items-center">
                            {(() => {
                              const rtInfo = getRealtimeInfo(route.route_id, departure.trip_id, departure.stop_id);
                              const theoreticalTime = formatTime(departure.time);
                              let finalDisplayTime;
                              let calculatedDelayMinutes;

                              if (rtInfo.actualTime) {
                                const actualTimeDateObj = new Date(rtInfo.actualTime);
                                finalDisplayTime = `${actualTimeDateObj.getHours().toString().padStart(2, '0')}:${actualTimeDateObj.getMinutes().toString().padStart(2, '0')}`;

                                // Convertir les heures théoriques en minutes totales
                                const [tH, tM] = theoreticalTime.split(':').map(Number);
                                const theoreticalTotalMinutes = tH * 60 + tM;
                                
                                // Convertir l'heure réelle en minutes totales
                                const actualTotalMinutes = actualTimeDateObj.getHours() * 60 + actualTimeDateObj.getMinutes();
                                
                                // Calculer la différence
                                calculatedDelayMinutes = actualTotalMinutes - theoreticalTotalMinutes;
                              } else { 
                                calculatedDelayMinutes = rtInfo.hasRealtimeUpdate ? rtInfo.delay : 0;
                                if (rtInfo.hasRealtimeUpdate && calculatedDelayMinutes !== 0) {
                                  const [schedH, schedM] = theoreticalTime.split(':').map(Number);
                                  const newTimeObj = new Date();
                                  newTimeObj.setHours(schedH, schedM + calculatedDelayMinutes, 0, 0);
                                  finalDisplayTime = `${newTimeObj.getHours().toString().padStart(2, '0')}:${newTimeObj.getMinutes().toString().padStart(2, '0')}`;
                                } else {
                                  finalDisplayTime = theoreticalTime;
                                  // Ensure calculatedDelayMinutes is 0 if no RT update or RT says on time with delay 0
                                  calculatedDelayMinutes = 0; 
                                }
                              }

                              const showTheoreticalStripped = rtInfo.hasRealtimeUpdate && finalDisplayTime !== theoreticalTime;
                              const isOnTimeWithRealtime = rtInfo.hasRealtimeUpdate && calculatedDelayMinutes === 0;

                              let timeColorClass = '';
                              if (calculatedDelayMinutes === 0 && rtInfo.hasRealtimeUpdate) {
                                timeColorClass = 'text-green-600 dark:text-green-400'; // Vert quand à l'heure avec info temps réel
                              } else if (calculatedDelayMinutes > 0) {
                                timeColorClass = 'text-red-700 dark:text-red-500';
                              } else if (calculatedDelayMinutes < 0) {
                                timeColorClass = 'text-orange-600 dark:text-orange-500';
                              } else {
                                timeColorClass = 'text-gray-900 dark:text-white'; // Gris par défaut si pas d'info temps réel
                              }

                              return (
                                <>
                                  {showTheoreticalStripped ? (
                                    <span className="line-through text-gray-400 dark:text-gray-500 mr-2 text-sm">
                                      {theoreticalTime}
                                    </span>
                                  ) : null}
                                  <span className={timeColorClass}>
                                    {finalDisplayTime}
                                  </span>
                                  {rtInfo.hasRealtimeUpdate && calculatedDelayMinutes !== 0 && (
                                    <span className={`ml-2 text-xs ${calculatedDelayMinutes > 0 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'} px-2 py-0.5 rounded-full`}>
                                      {calculatedDelayMinutes > 0 ? '+' : ''}{calculatedDelayMinutes} min
                                    </span>
                                  )}
                                  {rtInfo.hasRealtimeUpdate && calculatedDelayMinutes === 0 && (
                                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                      À l'heure
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          
                          <FaArrowRight className="text-blue-600 dark:text-blue-400" size={14} />
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                        Pas de passage à venir
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Spacer pour assurer un espace suffisant en bas */}
              <div className="h-16"></div>
            </div>
          )}
          
          {!loading && selectedStop && stopSchedules.length === 0 && !error && infoMessage && (
            <div className="bg-yellow-100 dark:bg-dark-700 p-4 rounded-lg text-center border border-yellow-300 dark:border-yellow-600 mb-24">
              <p className="text-yellow-700 dark:text-yellow-300">{infoMessage}</p>
            </div>
          )}
          
          {/* Fallback si aucun message d'info spécifique mais pas d'horaires */}
          {!loading && selectedStop && stopSchedules.length === 0 && !error && !infoMessage && (
             <div className="bg-gray-100 dark:bg-dark-700 p-4 rounded-lg text-center mb-24">
              <p className="text-gray-600 dark:text-gray-300">Aucun horaire disponible pour cet arrêt.</p>
            </div>
          )}
          

        </div>
      </div>

      {/* Bouton de retour en mode carte pour mobile quand on est en mode détail trajet */}
      {isMobile && selectedTrip && (
        <div className="absolute bottom-4 left-4 z-30">
          <button 
            onClick={() => setSidebarExpanded(false)}
            className="bg-white dark:bg-dark-800 shadow-lg rounded-full p-3"
            title="Voir la carte"
          >
            <FaMapMarkerAlt className="text-blue-600" size={20} />
          </button>
        </div>
      )}

      {/* Ajuster également la zone de contenu pour assurer un meilleur défilement */}
      <div 
        ref={contentRef}
        className="flex-1 px-4 py-3 overflow-y-auto"
        style={{
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: isMobile ? '120px' : '0', // Padding supplémentaire sur mobile
        }}
      >
      </div>
      
      {/* Interactive Map Component */}
      <MapView 
        isOpen={isMapOpen} 
        onClose={() => setIsMapOpen(false)} 
        selectedStop={selectedStop}
      />
    </div>
  );
};

export default Horaires; 