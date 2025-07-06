import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import TimetableHead from './Horaires/TimetableHead';
import Horaires from './Horaires/Horaires';
import { getFormattedDisruptionsForLine } from '../services/lineTrafficService';

const Timetable = () => {
  const { networkId, lineId, directionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lineInfo, setLineInfo] = useState(null);
  const [directions, setDirections] = useState([]);
  const [selectedDirection, setSelectedDirection] = useState(directionId ? parseInt(directionId, 10) : undefined);
  const [trafficDisruptions, setTrafficDisruptions] = useState([]);

  console.log('Timetable - Paramètres URL reçus:', {
    networkId,
    lineId,
    directionId,
    type: {
      networkId: typeof networkId,
      lineId: typeof lineId,
      directionId: typeof directionId
    }
  });

  // Effet pour mettre à jour selectedDirection quand directionId change
  useEffect(() => {
    if (directionId) {
      setSelectedDirection(parseInt(directionId, 10));
    }
  }, [directionId]);

  // Fonction pour charger les informations de la ligne
  const fetchLineInfo = async () => {
    try {
      console.log('Fetching line info for:', { networkId, lineId });
      setLoading(true);
      // Récupérer les infos de la ligne
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('network_id', networkId)
        .eq('route_id', lineId)
        .single();

      if (routeError) {
        console.error('Route data error:', routeError);
        throw routeError;
      }

      console.log('Received route data:', routeData);
      setLineInfo(routeData);

      // Récupérer les directions avec leurs terminus via RPC
      const { data: directionsData, error: directionsError } = await supabase
        .rpc('horaires_get_route_directions', {
          p_network_id: networkId,
          p_route_id: lineId
        });

      if (directionsError) {
        console.error('Directions error:', directionsError);
        throw directionsError;
      }

      console.log('Received directions data:', directionsData);

      // Formater les directions pour l'affichage
      const formattedDirections = directionsData.map(dir => ({
        direction_id: parseInt(dir.direction_id, 10),
        direction_name: dir.terminus.join(' / ')
      }));

      console.log('Formatted directions:', formattedDirections);
      setDirections(formattedDirections);

    } catch (error) {
      console.error('Error in fetchLineInfo:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Timetable useEffect - Paramètres actuels:', {
      networkId,
      lineId,
      selectedDirection,
      directionId
    });
    fetchLineInfo();
  }, [networkId, lineId]);

  // Effet pour récupérer les perturbations de trafic
  useEffect(() => {
    const fetchTrafficDisruptions = async () => {
      if (!networkId || !lineInfo?.route_short_name) return;

      try {
        const disruptions = await getFormattedDisruptionsForLine(networkId, lineInfo.route_short_name);
        setTrafficDisruptions(disruptions);
      } catch (error) {
        console.error('Erreur lors de la récupération des perturbations de trafic:', error);
        setTrafficDisruptions([]);
      }
    };

    fetchTrafficDisruptions();
    
    // Rafraîchir les perturbations toutes les 5 minutes
    const interval = setInterval(fetchTrafficDisruptions, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [networkId, lineInfo?.route_short_name]);

  if (loading) return <div className="timetable"></div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div className="timetable">
      <TimetableHead
        networkId={networkId}
        lineId={lineId}
        directionId={selectedDirection}
        lineInfo={lineInfo}
        directions={directions}
        onDirectionChange={setSelectedDirection}
        trafficDisruptions={trafficDisruptions}
      />
      <Horaires
        networkId={networkId}
        lineId={lineId}
        directionId={selectedDirection}
      />
    </div>
  );
};

export default Timetable;
