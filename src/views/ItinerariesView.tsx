import React, { useState, useRef, useEffect, useCallback } from 'react';
import Map, { Marker, Source, Layer, MapRef, LngLatBoundsLike } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient'; // Assuming you have this configured
import { Feature, LineString } from 'geojson';

// --- Add your Mapbox Access Token ---
const MAPBOX_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN'; // <-- TODO: Replace with your Mapbox token

// --- Interfaces for Route Data (based on placeholder) ---
interface StopInfo {
    stopName: string;
    arrivalTime: string | null;
    departureTime: string | null;
}

interface TransitDetails {
    routeShortName: string;
    routeLongName: string;
    headsign: string;
    agencyName: string;
    stops: StopInfo[];
}

interface RouteLeg {
    mode: 'WALK' | 'TRANSIT';
    startTime: string;
    endTime: string;
    distance: number;
    geometry: LineString; // GeoJSON LineString
    transitDetails?: TransitDetails; // Only for TRANSIT mode
}

interface RoutePlan {
    duration: number; // seconds
    startTime: string;
    endTime: string;
    legs: RouteLeg[];
}

// --- Map Layer Styles --- 
// Define styles as const assertions for type safety with Layer props
const walkLayerStyle = {
    id: 'walk-line',
    type: 'line',
    paint: {
        'line-color': '#333',
        'line-width': 4,
        'line-dasharray': [2, 2] // Dashed line for walking
    },
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    }
} as const; // Use 'as const' for stricter typing

const transitLayerStyle = {
    id: 'transit-line',
    type: 'line',
    paint: {
        'line-color': '#007cbf', // Example blue color for transit
        'line-width': 6
    },
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    }
} as const; // Use 'as const' for stricter typing


const ItinerariesView: React.FC = () => {
    const [startLocation, setStartLocation] = useState<string>('');
    const [endLocation, setEndLocation] = useState<string>('');
    const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const mapRef = useRef<MapRef | null>(null);

    const [initialViewState] = useState({
        longitude: -1.5536, // Centered on Nantes
        latitude: 47.2184,
        zoom: 12
    });

    // --- Function to call the Supabase Edge Function ---
    const fetchRoute = useCallback(async () => {
        if (!startLocation || !endLocation) {
            setError('Veuillez entrer un lieu de départ et d'arrivée.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setRoutePlan(null); // Clear previous route

        try {
            const { data, error: functionError } = await supabase.functions.invoke('calculate-route', {
                body: { start: startLocation, end: endLocation },
            });

            if (functionError) {
                throw functionError;
            }

            // TODO: Add more robust validation for the received data structure
            if (data && data.legs) {
                setRoutePlan(data as RoutePlan);
            } else {
                 throw new Error('Réponse invalide de la fonction de calcul d'itinéraire.');
            }

        } catch (err: any) {
            console.error('Error fetching route:', err);
            setError(`Erreur lors du calcul d'itinéraire: ${err.message || 'Erreur inconnue'}`);
            setRoutePlan(null);
        } finally {
            setIsLoading(false);
        }
    }, [startLocation, endLocation]);

    // --- Prepare GeoJSON data for map layers ---
    const walkGeoJson: Feature<LineString> | null = routePlan && routePlan.legs?.some(leg => leg.mode === 'WALK')
        ? {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: routePlan.legs.filter(leg => leg.mode === 'WALK').flatMap(leg => leg.geometry.coordinates)
            }
          }
        : null;

     const transitGeoJson: Feature<LineString> | null = routePlan && routePlan.legs?.some(leg => leg.mode === 'TRANSIT')
        ? {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: routePlan.legs.filter(leg => leg.mode === 'TRANSIT').flatMap(leg => leg.geometry.coordinates)
            }
          }
        : null;

    // --- Fit map bounds to the route when a plan is loaded ---
    useEffect(() => {
        if (routePlan && routePlan.legs.length > 0 && mapRef.current) {
            const allCoordinates = routePlan.legs.flatMap(leg => leg.geometry.coordinates);
            if (allCoordinates.length > 0) {
                // Ensure coordinates are valid numbers before creating bounds
                const validCoords = allCoordinates.filter(coord => 
                    coord && coord.length === 2 && 
                    typeof coord[0] === 'number' && !isNaN(coord[0]) &&
                    typeof coord[1] === 'number' && !isNaN(coord[1])
                );

                if (validCoords.length === 0) return;

                const bounds = validCoords.reduce<[[number, number], [number, number]]>(
                    (currentBounds, coord) => {
                        return [
                           [ Math.min(currentBounds[0][0], coord[0]), Math.min(currentBounds[0][1], coord[1]) ], // min lng/lat
                           [ Math.max(currentBounds[1][0], coord[0]), Math.max(currentBounds[1][1], coord[1]) ]  // max lng/lat
                        ];
                    },
                    [validCoords[0], validCoords[0]] // Initialize bounds with the first valid coordinate
                );

                // Check if bounds are valid before fitting
                 if (bounds && bounds[0][0] !== Infinity && bounds[0][1] !== Infinity &&
                    bounds[1][0] !== -Infinity && bounds[1][1] !== -Infinity) {
                        mapRef.current.fitBounds(bounds, { padding: 80, duration: 1000 }); // Add padding
                 }
            }
        }
    }, [routePlan]);

    // --- Helper to format time ---
    const formatTime = (dateString: string | null): string => {
        if (!dateString) return '';
         try {
            return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            console.error("Error formatting time:", dateString, e);
            return 'Invalid date';
        }
    }

    // --- Helper to calculate duration between two date strings ---
     const calculateLegDuration = (start: string, end: string): string => {
        try {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const diffSeconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
            if (isNaN(diffSeconds) || diffSeconds < 0) return '';
             const minutes = Math.round(diffSeconds / 60);
            return `${minutes} min`;
        } catch (e) {
            console.error("Error calculating duration:", start, end, e);
            return '';
        }
    }

    // --- Helper to format total duration --- 
    const formatTotalDuration = (seconds: number): string => {
        const minutes = Math.round(seconds / 60);
        return `${minutes} min`;
    }


    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)', /* Adjust based on your header/nav height */ }}>
            {/* --- Left Panel: Inputs and Route Details --- */}
            <div style={{ width: '350px', padding: '20px', overflowY: 'auto', borderRight: '1px solid #ccc', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                <h2>Calculer un itinéraire</h2>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="start" style={{ display: 'block', marginBottom: '5px' }}>Départ:</label>
                    <input
                        type="text"
                        id="start"
                        value={startLocation}
                        onChange={(e) => setStartLocation(e.target.value)}
                        placeholder="Adresse, lieu, arrêt..."
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="end" style={{ display: 'block', marginBottom: '5px' }}>Arrivée:</label>
                    <input
                        type="text"
                        id="end"
                        value={endLocation}
                        onChange={(e) => setEndLocation(e.target.value)}
                        placeholder="Adresse, lieu, arrêt..."
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <button
                    onClick={fetchRoute}
                    disabled={isLoading}
                    style={{ padding: '10px 15px', cursor: isLoading ? 'wait' : 'pointer', marginBottom: '15px' }}
                >
                    {isLoading ? 'Recherche...' : 'Rechercher'}
                </button>

                {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

                {/* --- Display Route Details --- */}
                {routePlan && (
                     <div style={{ marginTop: '20px', flexGrow: 1 }}>
                        <h3>Itinéraire ({formatTotalDuration(routePlan.duration)})</h3>
                        <p>{formatTime(routePlan.startTime)} - {formatTime(routePlan.endTime)}</p>
                        <hr style={{ margin: '15px 0' }} />
                        {routePlan.legs.map((leg, index) => (
                            <div key={index} style={{ marginBottom: '15px', paddingLeft: '30px', position: 'relative' }}>
                                {/* Timeline / Icon */} 
                                <div style={{
                                     position: 'absolute',
                                     left: '0px',
                                     top: '2px',
                                     width: '25px', // Adjust width as needed
                                     textAlign: 'center',
                                }}>
                                    {/* Icon */} 
                                     <span style={{ fontSize: '1.2em' }}>
                                         {leg.mode === 'WALK' ? '🚶' : '🚌'}
                                     </span>
                                     {/* Vertical line connecting icons (except for last leg) */} 
                                     {index < routePlan.legs.length - 1 && (
                                         <div style={{
                                             position: 'absolute',
                                             left: '50%',
                                             top: '22px', // Start below the icon
                                             bottom: '-15px', // Extend down to next leg's top alignment roughly
                                             borderLeft: '2px dotted #ccc',
                                             marginLeft: '-1px' // Center the line
                                         }}></div>
                                    )}
                                </div>

                                <p style={{ fontWeight: 'bold', marginBottom: '3px' }}>
                                     {leg.mode === 'WALK' ? `Marche` : `Ligne ${leg.transitDetails?.routeShortName || '?'}`}
                                     <span style={{ fontWeight: 'normal', color: '#666', marginLeft: '8px' }}>
                                         ({calculateLegDuration(leg.startTime, leg.endTime)})
                                     </span>
                                 </p>

                                {leg.mode === 'TRANSIT' && leg.transitDetails && (
                                     <div>
                                         <p style={{ fontSize: '0.9em', color: '#555' }}>Direction: {leg.transitDetails.headsign}</p>
                                         <p style={{ fontSize: '0.9em', color: '#555' }}>{leg.transitDetails.stops[0]?.stopName} ({formatTime(leg.transitDetails.stops[0]?.departureTime)})</p>
                                         {/* Could add a button to show intermediate stops */}
                                         <p style={{ fontSize: '0.8em', color: '#888', margin: '4px 0' }}>...</p>
                                         <p style={{ fontSize: '0.9em', color: '#555' }}>{leg.transitDetails.stops[leg.transitDetails.stops.length - 1]?.stopName} ({formatTime(leg.transitDetails.stops[leg.transitDetails.stops.length - 1]?.arrivalTime)})</p>
                                     </div>
                                 )}
                                 {leg.mode === 'WALK' && (
                                    <p style={{ fontSize: '0.9em', color: '#555' }}>{leg.distance} mètres</p>
                                 )}

                            </div>
                        ))}
                     </div>
                 )}


            </div>

            {/* --- Right Panel: Map --- */}
            <div style={{ flex: 1, position: 'relative' }}>
                 {MAPBOX_TOKEN && MAPBOX_TOKEN !== 'YOUR_MAPBOX_ACCESS_TOKEN' ? (
                     <Map
                         ref={mapRef}
                         initialViewState={initialViewState}
                         style={{ width: '100%', height: '100%' }}
                         mapStyle="mapbox://styles/mapbox/streets-v11" // Choose your preferred map style
                         mapboxAccessToken={MAPBOX_TOKEN}
                     >
                         {/* Draw Walking Route */}
                         {walkGeoJson && (
                            <Source id="walk-data" type="geojson" data={walkGeoJson}>
                                <Layer {...walkLayerStyle} />
                             </Source>
                         )}

                         {/* Draw Transit Route */}
                         {transitGeoJson && (
                             <Source id="transit-data" type="geojson" data={transitGeoJson}>
                                <Layer {...transitLayerStyle} />
                             </Source>
                         )}

                          {/* Markers for Start and End of the whole trip */}
                         {routePlan && routePlan.legs.length > 0 && 
                           routePlan.legs[0].geometry.coordinates.length > 0 && 
                           routePlan.legs[routePlan.legs.length-1].geometry.coordinates.length > 0 && (
                             <>
                                 {/* Start Marker */}
                                <Marker
                                     longitude={routePlan.legs[0].geometry.coordinates[0][0]}
                                     latitude={routePlan.legs[0].geometry.coordinates[0][1]}
                                     anchor="bottom" >
                                     <div style={{ fontSize: '24px' }}>📍</div> {/* Simple pin emoji */}
                                </Marker>
                                 {/* End Marker */} 
                                 {(() => {
                                     const lastLeg = routePlan.legs[routePlan.legs.length - 1];
                                     const lastCoord = lastLeg.geometry.coordinates[lastLeg.geometry.coordinates.length - 1];
                                     if (!lastCoord) return null;
                                    return (
                                         <Marker
                                             longitude={lastCoord[0]}
                                             latitude={lastCoord[1]}
                                             anchor="bottom" >
                                             <div style={{ fontSize: '24px' }}>🏁</div> {/* Simple flag emoji */}
                                         </Marker>
                                     );
                                 })()}
                             </>
                         )}
                     </Map>
                 ) : (
                     <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: '#eee'}}>
                         <p>Veuillez ajouter votre token Mapbox valide dans le fichier src/views/ItinerariesView.tsx.</p>
                     </div>
                 )}
             </div>
         </div>
     );
 };

 export default ItinerariesView; 