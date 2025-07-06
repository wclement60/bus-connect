import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchRealtimeData } from '../services/realtime';

const TestRealtimeData = () => {
  const { networkId, lineId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Chargement des données temps réel pour le réseau ${networkId}, ligne ${lineId}`);
        const realtimeData = await fetchRealtimeData(networkId, lineId);
        
        setData(realtimeData);
      } catch (err) {
        console.error('Erreur lors du chargement des données temps réel:', err);
        setError(err.message || 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    if (networkId && lineId) {
      loadData();
    }
  }, [networkId, lineId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Test des données temps réel</h1>
      <div className="bg-gray-100 p-4 mb-4 rounded">
        <p>Réseau: <span className="font-bold">{networkId}</span></p>
        <p>Ligne: <span className="font-bold">{lineId}</span></p>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-2">Résultats</h2>
          
          <div className="bg-white shadow-md rounded-lg p-4 mb-4">
            <h3 className="text-lg font-medium mb-2">Délais</h3>
            {Object.keys(data.delays).length === 0 ? (
              <p className="text-gray-500">Aucun délai disponible</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.delays).map(([key, delay]) => (
                  <div key={key} className="border rounded p-2">
                    <div className="font-medium">{key}</div>
                    <div className={`text-sm ${delay > 0 ? 'text-red-600' : delay < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {delay > 0 ? `+${delay} minutes de retard` : 
                       delay < 0 ? `${Math.abs(delay)} minutes d'avance` : 
                       'À l\'heure'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white shadow-md rounded-lg p-4">
            <h3 className="text-lg font-medium mb-2">Heures mises à jour</h3>
            {Object.keys(data.updatedTimes).length === 0 ? (
              <p className="text-gray-500">Aucune heure mise à jour disponible</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.updatedTimes).map(([key, times]) => (
                  <div key={key} className="border rounded p-2">
                    <div className="font-medium">{key}</div>
                    <div className="text-sm">
                      {times.arrival && (
                        <div>Arrivée: {formatDate(times.arrival)}</div>
                      )}
                      {times.departure && (
                        <div>Départ: {formatDate(times.departure)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestRealtimeData; 