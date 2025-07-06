import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { getNetworks, getRoutesByNetwork, getStopsByRouteAndDirection, getTripSchedulesForDate, getShapesForRoute, getShapeGeometry } from '../../services/admin';
import ShapePreviewMap from '../../components/admin/ShapePreviewMap';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableStopItem = ({ stop, stopTime, onTimeChange }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: stop.stop_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none', // For better mobile experience
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center space-x-4 p-2 bg-gray-50 rounded-md">
      <div {...listeners} className="cursor-grab p-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </div>
      <span className="flex-1 font-medium">{stop.stop_name}</span>
      <input 
        type="time"
        value={stopTime || ''}
        onChange={(e) => onTimeChange(stop.stop_id, e.target.value)}
        className="p-2 border border-gray-300 rounded-md"
      />
    </div>
  );
};

const SpecialSchedule = () => {
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [directionLabels, setDirectionLabels] = useState({});
  const [selectedDirection, setSelectedDirection] = useState('');
  const [stops, setStops] = useState([]);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [stopTimes, setStopTimes] = useState({});
  const [scheduleData, setScheduleData] = useState({ schedules: [], stops: [] });
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [shapes, setShapes] = useState([]);
  const [selectedShape, setSelectedShape] = useState('');
  const [tripShortName, setTripShortName] = useState('');
  const [tripHeadsign, setTripHeadsign] = useState('');
  const [editingTrip, setEditingTrip] = useState(null);
  const [shapeGeometry, setShapeGeometry] = useState([]);
  const [activeStops, setActiveStops] = useState([]);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    const loadNetworks = async () => {
      const networks = await getNetworks();
      setNetworks(networks);
    };
    loadNetworks();
  }, []);

  useEffect(() => {
    if (selectedNetwork) {
      const loadRoutes = async () => {
        const routes = await getRoutesByNetwork(selectedNetwork.network_id);
        setRoutes(routes);
        setSelectedRoute(null);
        setDirectionLabels({});
        setSelectedDirection('');
        setStops([]);
      };
      loadRoutes();
    }
  }, [selectedNetwork]);

  useEffect(() => {
    if (selectedRoute) {
      const loadDirectionLabels = async () => {
        const { data, error } = await supabase.rpc(
          'get_route_directions',
          {
            route_id_param: selectedRoute.route_id,
            network_id_param: selectedNetwork.network_id
          }
        );
        if (error) {
          console.error('Erreur lors du chargement des directions:', error);
          return;
        }
        const labels = {};
        (data || []).forEach(dir => {
          const terminusNames = Array.isArray(dir.terminus_names) ? dir.terminus_names : [];
          labels[dir.direction_id] = terminusNames.length > 0 
            ? terminusNames.join(' / ') 
            : `Direction ${dir.direction_id === 0 ? 'Aller' : 'Retour'}`;
        });
        setDirectionLabels(labels);
        setSelectedDirection('');
        setStops([]);
      };
      loadDirectionLabels();
    }
  }, [selectedRoute]);

  useEffect(() => {
    if (selectedRoute && selectedDirection !== '' && scheduleDate) {
      const loadExistingSchedules = async () => {
        setLoadingSchedules(true);
        try {
          const data = await getTripSchedulesForDate(
            selectedNetwork.network_id,
            selectedRoute.route_id,
            selectedDirection,
            scheduleDate
          );
          setScheduleData(data);
        } catch (error) {
          console.error("Erreur lors du chargement des horaires existants:", error);
          setScheduleData({ schedules: [], stops: [] });
        } finally {
          setLoadingSchedules(false);
        }
      };
      loadExistingSchedules();
    } else {
      setScheduleData({ schedules: [], stops: [] });
    }
  }, [selectedRoute, selectedDirection, scheduleDate, selectedNetwork]);

  useEffect(() => {
    if (selectedRoute && selectedDirection !== '') {
      const loadStops = async () => {
        try {
          const stopsForDirection = await getStopsByRouteAndDirection(
            selectedNetwork.network_id,
            selectedRoute.route_id,
            selectedDirection
          );
          setStops(stopsForDirection);
          setStopTimes({});
        } catch (error) {
          console.error("Error fetching stops for direction", error);
          setStops([]);
        }
      };
      const loadShapes = async () => {
        try {
          const shapeData = await getShapesForRoute(
            selectedNetwork.network_id,
            selectedRoute.route_id,
            selectedDirection
          );
          setShapes(shapeData);
          if (shapeData.length === 1) {
            setSelectedShape(shapeData[0]);
          } else {
            setSelectedShape('');
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des tracés:", error);
          setShapes([]);
        }
      };
      loadStops();
      loadShapes();
    }
  }, [selectedRoute, selectedDirection, selectedNetwork]);

  useEffect(() => {
    if (selectedShape) {
      const loadGeometry = async () => {
        try {
          const geometry = await getShapeGeometry(selectedNetwork.network_id, selectedShape);
          setShapeGeometry(geometry);
        } catch (error) {
          console.error("Erreur lors de la récupération de la géométrie:", error);
          setShapeGeometry([]);
        }
      };
      loadGeometry();
    } else {
      setShapeGeometry([]);
    }
  }, [selectedShape, selectedNetwork]);

  useEffect(() => {
    const stopsToUse = editingTrip ? scheduleData.stops : stops;
    setActiveStops(stopsToUse);
  }, [editingTrip, scheduleData.stops, stops]);
  
  const handleTimeChange = (stopId, time) => {
    setStopTimes(prev => ({ ...prev, [stopId]: time }));
  };

  const handleEditClick = (trip) => {
    setEditingTrip(trip);
    setSelectedShape(trip.shape_id || '');
    setTripShortName(trip.trip_short_name || '');
    setTripHeadsign(trip.trip_headsign || '');
    
    const times = {};
    trip.stop_times.forEach(st => {
      times[st.stop_id] = st.departure_time;
    });
    setStopTimes(times);
    
    // Scroll to the form
    const formElement = document.getElementById('schedule-form');
    formElement?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingTrip(null);
    setSelectedShape('');
    setTripShortName('');
    setStopTimes({});
    setTripHeadsign('');
  };

  const handleDeleteClick = async (trip) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le voyage ${trip.trip_id} ? Cette action est irréversible.`)) {
      try {
        const { data, error } = await supabase.rpc('delete_special_trip', {
          p_trip_id: trip.trip_id,
          p_network_id: selectedNetwork.network_id,
        });

        if (error) throw error;

        if (data.success) {
          alert('Voyage supprimé avec succès.');
          // Re-fetch data
          const updatedData = await getTripSchedulesForDate(selectedNetwork.network_id, selectedRoute.route_id, selectedDirection, scheduleDate);
          setScheduleData(updatedData);
        } else {
          alert(`Erreur lors de la suppression: ${data.error}`);
        }
      } catch (error) {
        console.error("Erreur RPC delete_special_trip:", error);
        alert(`Une erreur est survenue: ${error.message}`);
      }
    }
  };

  function handleDragEnd(event) {
    const {active, over} = event;
    
    if (active.id !== over.id) {
      setActiveStops((items) => {
        const oldIndex = items.findIndex(item => item.stop_id === active.id);
        const newIndex = items.findIndex(item => item.stop_id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const handleSaveSchedule = async () => {
    // Validate inputs
    if (!selectedNetwork || !selectedRoute || selectedDirection === '' || !scheduleDate || !selectedShape || !tripHeadsign) {
      alert("Veuillez remplir tous les champs (réseau, ligne, direction, date, tracé et destination).");
      return;
    }

    const filledStops = activeStops.filter(stop => stopTimes[stop.stop_id] && stopTimes[stop.stop_id].trim() !== '');

    if (filledStops.length === 0) {
      alert("Veuillez renseigner un horaire pour au moins un arrêt.");
      return;
    }

    const stopTimesPayload = filledStops.map((stop, index) => ({
      stop_id: stop.stop_id,
      stop_sequence: index + 1,
      arrival_time: stopTimes[stop.stop_id],
      departure_time: stopTimes[stop.stop_id],
    }));

    if (editingTrip) {
      // Update existing trip
      const params = {
        p_trip_id: editingTrip.trip_id,
        p_network_id: selectedNetwork.network_id,
        p_shape_id: selectedShape,
        p_trip_short_name: tripShortName,
        p_stop_times: stopTimesPayload,
        p_trip_headsign: tripHeadsign,
      };
      
      try {
        const { data, error } = await supabase.rpc('update_special_trip', params);
        if (error) throw error;

        if (data.success) {
          alert(`Horaire mis à jour avec succès !`);
          cancelEdit();
          // Re-fetch data
          const updatedData = await getTripSchedulesForDate(selectedNetwork.network_id, selectedRoute.route_id, selectedDirection, scheduleDate);
          setScheduleData(updatedData);
        } else {
          alert(`Erreur lors de la mise à jour: ${data.error}`);
        }
      } catch (error) {
        console.error("Erreur RPC update_special_trip:", error);
        alert(`Une erreur est survenue: ${error.message}`);
      }

    } else {
      // Create new trip
      const params = {
        p_network_id: selectedNetwork.network_id,
        p_route_id: selectedRoute.route_id,
        p_direction_id: parseInt(selectedDirection, 10),
        p_trip_headsign: tripHeadsign,
        p_date: scheduleDate,
        p_stop_times: stopTimesPayload,
        p_shape_id: selectedShape,
        p_trip_short_name: tripShortName,
      };
      
      try {
        const { data, error } = await supabase.rpc('create_special_trip', params);
  
        if (error) {
          throw error;
        }
  
        if (data.success) {
          alert(`Horaire spécial créé avec succès ! Trip ID: ${data.trip_id}`);
          // Reset form
          setSelectedRoute(null);
          setDirectionLabels({});
          setSelectedDirection('');
          setStops([]);
          setStopTimes({});
          setTripShortName('');
          setSelectedShape('');
          setTripHeadsign('');
        } else {
          alert(`Erreur lors de la création de l'horaire spécial: ${data.error}`);
        }
      } catch (error) {
        console.error("Erreur lors de l'appel RPC create_special_trip:", error);
        alert(`Une erreur est survenue: ${error.message}`);
      }
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Créer un horaire spécial</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Network Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Réseau</label>
          <select 
            onChange={(e) => {
              const network = networks.find(n => n.network_id === e.target.value);
              setSelectedNetwork(network);
            }}
            value={selectedNetwork ? selectedNetwork.network_id : ''}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">Sélectionnez un réseau</option>
            {networks.map(network => (
              <option key={network.network_id} value={network.network_id}>{network.network_name}</option>
            ))}
          </select>
        </div>

        {/* Route Selector */}
        {selectedNetwork && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Ligne</label>
            <select 
              onChange={(e) => {
                const route = routes.find(r => r.route_id === e.target.value);
                setSelectedRoute(route);
              }}
              value={selectedRoute ? selectedRoute.route_id : ''}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Sélectionnez une ligne</option>
              {routes.map(route => (
                <option key={route.route_id} value={route.route_id}>{route.route_long_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Direction Selector */}
        {selectedRoute && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Direction</label>
            <select 
              onChange={(e) => setSelectedDirection(e.target.value)}
              value={selectedDirection}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Sélectionnez une direction</option>
              {Object.entries(directionLabels).map(([dirId, label]) => (
                <option key={dirId} value={dirId}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Picker */}
        {selectedDirection && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input 
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        )}

        {/* Shape Selector */}
        {selectedDirection && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Tracé (Shape)</label>
            <select 
              onChange={(e) => setSelectedShape(e.target.value)}
              value={selectedShape}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Sélectionnez un tracé</option>
              {shapes.map(shapeId => (
                <option key={shapeId} value={shapeId}>{shapeId}</option>
              ))}
            </select>
            {shapeGeometry.length > 0 && (
              <div className="mt-4">
                <ShapePreviewMap shapeGeometry={shapeGeometry} />
              </div>
            )}
          </div>
        )}

        {/* Trip Headsign */}
        {selectedDirection && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Destination (Headsign)</label>
            <input
              type="text"
              value={tripHeadsign}
              onChange={(e) => setTripHeadsign(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              placeholder="Ex: Gare Centre"
              required
            />
          </div>
        )}

        {/* Trip Short Name */}
        {selectedDirection && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Nom court du voyage (optionnel)</label>
            <input
              type="text"
              value={tripShortName}
              onChange={(e) => setTripShortName(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              placeholder="Ex: Course spéciale"
            />
          </div>
        )}
      </div>

      {/* Existing Schedules Table */}
      {loadingSchedules ? (
        <p>Chargement des horaires existants...</p>
      ) : scheduleData.schedules.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">Horaires existants pour le {new Date(scheduleDate).toLocaleDateString('fr-FR')}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b font-semibold text-left">Arrêt</th>
                  {scheduleData.schedules.map(schedule => (
                    <th key={schedule.trip_id} className="py-2 px-4 border-b font-semibold text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <span>{schedule.trip_id}</span>
                        <button onClick={() => handleEditClick(schedule)} className="p-1 text-blue-600 hover:text-blue-800">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteClick(schedule)} className="p-1 text-red-600 hover:text-red-800">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleData.stops.map(stop => (
                  <tr key={stop.stop_id}>
                    <td className="py-2 px-4 border-b">{stop.stop_name}</td>
                    {scheduleData.schedules.map(schedule => {
                      const stopTime = schedule.stop_times.find(st => st.stop_id === stop.stop_id);
                      return (
                        <td key={`${schedule.trip_id}-${stop.stop_id}`} className="py-2 px-4 border-b text-center">
                          {stopTime ? stopTime.departure_time.slice(0, 5) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-8">Aucun horaire existant pour cette sélection.</p>
      )}

      {/* Form for new/edit schedule */}
      <div id="schedule-form" className="mt-8">
        <h3 className="text-xl font-bold mb-2">{editingTrip ? `Modifier l'horaire: ${editingTrip.trip_id}` : 'Ajouter un nouvel horaire'}</h3>
        
        {/* Stops List for new schedule */}
        {(editingTrip || stops.length > 0) && (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={activeStops.map(s => s.stop_id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {activeStops.map(stop => (
                  <SortableStopItem 
                    key={stop.stop_id} 
                    stop={stop} 
                    stopTime={stopTimes[stop.stop_id]}
                    onTimeChange={handleTimeChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <button
          onClick={handleSaveSchedule}
          disabled={!selectedDirection || (editingTrip ? false : stops.length === 0) || !selectedShape}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {editingTrip ? "Enregistrer les modifications" : "Enregistrer l'horaire"}
        </button>
        {editingTrip && (
          <button onClick={cancelEdit} className="mt-4 ml-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
            Annuler
          </button>
        )}
      </div>
    </div>
  );
};

export default SpecialSchedule; 