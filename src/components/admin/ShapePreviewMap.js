import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1Ijoid2VpYmVsY2xlbWVudDYwIiwiYSI6ImNtMm9yZ3JpaDA4OGQybHIxcTBibHk4NXQifQ.iUZ4I9uI1lIWgamjWnDIYg';

const ShapePreviewMap = ({ shapeGeometry }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return; 
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [2.35, 48.85],
      zoom: 9
    });

    map.current.on('load', () => {
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
      });
      map.current.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3887be', 'line-width': 5, 'line-opacity': 0.75 }
      });
      setIsMapLoaded(true);
    });

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    }
  }, []); // Runs once on mount

  // Update map geometry
  useEffect(() => {
    if (!isMapLoaded || !shapeGeometry || !map.current) return;

    const source = map.current.getSource('route');
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: shapeGeometry
        }
      });
    }

    if (shapeGeometry.length > 0) {
      const bounds = shapeGeometry.reduce((bounds, coord) => {
          return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(shapeGeometry[0], shapeGeometry[0]));

      map.current.fitBounds(bounds, {
        padding: 40,
        duration: 500
      });
    }
  }, [shapeGeometry, isMapLoaded]); // Reruns when geometry changes or map loads

  return (
    <div ref={mapContainer} style={{ height: '300px', borderRadius: '8px' }} />
  );
};

export default ShapePreviewMap; 