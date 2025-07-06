import { supabase } from './supabase';
import * as protobuf from 'protobufjs';
import JSZip from 'jszip';

// Définition protobuf complète incluant VehiclePosition et tous les types nécessaires
const GTFS_RT_PROTO = `
syntax = "proto2";
package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}

message FeedHeader {
  required string version = 1;
  optional uint64 timestamp = 2;
  optional bool incrementality = 3 [default = false];
}

message FeedEntity {
  required string id = 1;
  optional bool is_deleted = 2 [default = false];
  optional TripUpdate trip_update = 3;
  optional VehiclePosition vehicle = 4;
  optional Alert alert = 5;
}

message TripUpdate {
  required TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 3;
  repeated StopTimeUpdate stop_time_update = 2;
  optional uint64 timestamp = 4;
  optional int32 delay = 5;
}

message StopTimeUpdate {
  optional uint32 stop_sequence = 1;
  optional string stop_id = 4;
  optional StopTimeEvent arrival = 2;
  optional StopTimeEvent departure = 3;
  optional ScheduleRelationship schedule_relationship = 5 [default = SCHEDULED];
  
  enum ScheduleRelationship {
    SCHEDULED = 0;
    SKIPPED = 1;
    NO_DATA = 2;
  }
}

message StopTimeEvent {
  optional int32 delay = 1;
  optional int64 time = 2;
  optional int32 uncertainty = 3;
}

message VehiclePosition {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 8;
  optional Position position = 2;
  optional uint32 current_stop_sequence = 3;
  optional string stop_id = 7;
  optional VehicleStopStatus current_status = 4 [default = IN_TRANSIT_TO];
  optional uint64 timestamp = 5;
  optional OccupancyStatus occupancy_status = 9;
  
  enum VehicleStopStatus {
    INCOMING_AT = 0;
    STOPPED_AT = 1;
    IN_TRANSIT_TO = 2;
  }
  
  enum OccupancyStatus {
    EMPTY = 0;
    MANY_SEATS_AVAILABLE = 1;
    FEW_SEATS_AVAILABLE = 2;
    STANDING_ROOM_ONLY = 3;
    CRUSHED_STANDING_ROOM_ONLY = 4;
    FULL = 5;
    NOT_ACCEPTING_PASSENGERS = 6;
  }
}

message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;
  optional Cause cause = 6 [default = UNKNOWN_CAUSE];
  optional Effect effect = 7 [default = UNKNOWN_EFFECT];
  optional TranslatedString url = 8;
  optional TranslatedString header_text = 10;
  optional TranslatedString description_text = 11;
  
  enum Cause {
    UNKNOWN_CAUSE = 1;
    OTHER_CAUSE = 2;
    TECHNICAL_PROBLEM = 3;
    STRIKE = 4;
    DEMONSTRATION = 5;
    ACCIDENT = 6;
    HOLIDAY = 7;
    WEATHER = 8;
    MAINTENANCE = 9;
    CONSTRUCTION = 10;
    POLICE_ACTIVITY = 11;
    MEDICAL_EMERGENCY = 12;
  }
  
  enum Effect {
    NO_SERVICE = 1;
    REDUCED_SERVICE = 2;
    SIGNIFICANT_DELAYS = 3;
    DETOUR = 4;
    ADDITIONAL_SERVICE = 5;
    MODIFIED_SERVICE = 6;
    OTHER_EFFECT = 7;
    UNKNOWN_EFFECT = 8;
    STOP_MOVED = 9;
  }
}

message TimeRange {
  optional uint64 start = 1;
  optional uint64 end = 2;
}

message Position {
  required float latitude = 1;
  required float longitude = 2;
  optional float bearing = 3;
  optional double odometer = 4;
  optional float speed = 5;
}

message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  optional uint32 direction_id = 6;
  optional string start_time = 2;
  optional string start_date = 3;
  optional ScheduleRelationship schedule_relationship = 4;
  
  enum ScheduleRelationship {
    SCHEDULED = 0;
    ADDED = 1;
    UNSCHEDULED = 2;
    CANCELED = 3;
  }
}

message VehicleDescriptor {
  optional string id = 1;
  optional string label = 2;
  optional string license_plate = 3;
}

message EntitySelector {
  optional string agency_id = 1;
  optional string route_id = 2;
  optional int32 route_type = 3;
  optional TripDescriptor trip = 4;
  optional string stop_id = 5;
}

message TranslatedString {
  repeated Translation translation = 1;
  
  message Translation {
    required string text = 1;
    optional string language = 2;
  }
}
`;

/**
 * Vérifie si un tableau d'octets représente un fichier ZIP
 * @param {Uint8Array} bytes - Tableau d'octets à vérifier
 * @returns {boolean} - true si c'est un fichier ZIP
 */
function isZipFile(bytes) {
  // Signature d'un fichier ZIP: PK (0x50 0x4B 0x03 0x04)
  return bytes.length > 4 && 
         bytes[0] === 0x50 && 
         bytes[1] === 0x4B && 
         bytes[2] === 0x03 && 
         bytes[3] === 0x04;
}

/**
 * Effectue une requête en utilisant un proxy CORS si nécessaire
 * @param {string} url - URL de la requête
 * @param {Object} options - Options de la requête fetch
 * @returns {Promise<Response>} - Réponse de la requête
 */
const fetchWithCorsProxy = async (url, options = {}) => {
  // Liste des domaines nécessitant un proxy
  const PROXY_DOMAINS = ['ara-api.enroute.mobi'];
  
  const urlObj = new URL(url);
  const needsProxy = PROXY_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  
  if (needsProxy) {
    // Utiliser un proxy CORS local ou public selon l'environnement
    const proxyUrl = process.env.REACT_APP_CORS_PROXY_URL || 'https://cors-anywhere.herokuapp.com/';
    // // console.log('🔄 [CORS] Utilisation du proxy:', proxyUrl);
    
    // Ajouter les headers nécessaires pour le proxy
    const proxyOptions = {
      ...options,
      headers: {
        ...options.headers,
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    
    return fetch(`${proxyUrl}${url}`, proxyOptions);
  }
  
  return fetch(url, options);
};

/**
 * Récupère les données temps réel SIRI pour un réseau et une ligne spécifiques
 * @param {string} networkId - Identifiant du réseau
 * @param {string} lineId - Identifiant de la ligne
 * @param {string} subnetworkName - Nom du sous-réseau (optionnel)
 * @returns {Promise<Object>} - Données de retard et mises à jour
 */
export const fetchSiriRealtimeData = async (networkId, lineId, subnetworkName = null) => {
  try {
    let apiUrl, apiParams, requiresApiKey;
    
    // // // console.log('🔍 [SIRI] Début fetchSiriRealtimeData:', { networkId, lineId, subnetworkName });
    
    if (subnetworkName) {
      const { data: networkData, error: networkError } = await supabase
        .from('networks')
        .select('subnetworks')
        .eq('network_id', networkId)
        .single();
      
      // // console.log('📋 [SIRI] Données réseau:', networkData);
      
      if (networkError) {
        // // console.error('❌ [SIRI] Erreur réseau:', networkError);
        return { delays: {}, updatedTimes: {}, skippedStops: {} };
      }
      
      if (networkData?.subnetworks) {
        const subnetwork = networkData.subnetworks.find(s => s.name === subnetworkName);
        // // console.log('🔎 [SIRI] Configuration sous-réseau:', subnetwork);
        
        if (subnetwork?.realtime?.type === 'siri') {
          apiUrl = subnetwork.realtime.url;
          apiParams = subnetwork.realtime.params || {};
          requiresApiKey = subnetwork.realtime.requires_api_key || false;
          // // // console.log('✅ [SIRI] Configuration trouvée:', { apiUrl, apiParams, requiresApiKey });
        }
      }
    }
    
    if (!apiUrl) {
      const { data: networkData, error } = await supabase
        .from('networks')
        .select('siri_api_url, siri_api_params, requires_api_key')
        .eq('network_id', networkId)
        .single();
      
      // // console.log('🔍 [SIRI] Configuration globale:', networkData);
      
      if (error || !networkData?.siri_api_url) {
        // // console.error('❌ [SIRI] Erreur configuration globale:', error);
        return { delays: {}, updatedTimes: {}, skippedStops: {} };
      }
      
      apiUrl = networkData.siri_api_url;
      apiParams = networkData.siri_api_params || {};
      requiresApiKey = networkData.requires_api_key || false;
    }
    
    const url = new URL(apiUrl);
    const params = { ...apiParams };
    
    // Configuration des headers de base
    const requestHeaders = {
      'Accept': 'application/xml, text/xml, application/json, application/zip, application/octet-stream'
    };
    
    // Gestion de l'authentification
    if (requiresApiKey) {
      const apiKey = process.env.REACT_APP_SIRI_API_KEY || '';
      
      // Vérifier si l'URL contient un indicateur pour le type d'authentification
      if (apiUrl.includes('ara-api.enroute.mobi')) {
        // Pour ara-api.enroute.mobi, utiliser Bearer token
        requestHeaders['Authorization'] = `Bearer ${apiKey}`;
      } else if (apiParams?.apiKeyHeader) {
        // Si un header spécifique est défini dans les paramètres
        requestHeaders[apiParams.apiKeyHeader] = apiKey;
      } else {
        // Par défaut, ajouter la clé API aux paramètres d'URL
        params.apiKey = apiKey;
      }
    }
    
    // Ajouter LineRef si nécessaire
    if (apiParams?.useLineRef) {
      params.LineRef = lineId;
    }
    
    // Construire l'URL finale avec les paramètres
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    // Faire la requête avec les headers appropriés
    const fetchOptions = {
      method: 'GET',
      headers: requestHeaders,
      credentials: apiParams?.includeCookies ? 'include' : 'same-origin',
      mode: 'cors'
    };
    
    // // console.log('🚀 [SIRI] URL appelée:', url.toString());
    // // console.log('🔑 [SIRI] Headers:', requestHeaders);
    // // console.log('⚙️ [SIRI] Options:', fetchOptions);
    
    // Utiliser fetchWithCorsProxy au lieu de fetch direct
    const response = await fetchWithCorsProxy(url.toString(), fetchOptions);
    
    /* console.log('📥 [SIRI] Réponse:', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      type: response.type,
      contentType: response.headers.get('content-type')
    }); */
    
    // En mode no-cors, la réponse sera de type 'opaque'
    if (response.type === 'opaque') {
      // // console.log('⚠️ [SIRI] Réponse opaque reçue (normal en mode no-cors)');
      // On ne peut pas vérifier le status ni lire le contenu
      return { delays: {}, updatedTimes: {}, skippedStops: {} };
    }

    if (!response.ok) {
      if (response.status === 401) {
        // // console.error('❌ [SIRI] Erreur d\'authentification - Vérifiez la clé API');
        return { delays: {}, updatedTimes: {}, skippedStops: {} };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    // // console.log('📄 [SIRI] Type de contenu:', contentType);
    
    // Si c'est un ZIP
    if (contentType && contentType.includes('application/zip')) {
      const arrayBuffer = await response.arrayBuffer();
      // // console.log('📦 [SIRI] Taille du ZIP:', arrayBuffer.byteLength, 'octets');
      
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(arrayBuffer);
        
        // Liste des fichiers dans le ZIP
        const fileNames = Object.keys(zipContent.files);
        // // console.log('📦 [SIRI] Fichiers dans le ZIP:', fileNames);
        
        // Chercher un fichier XML ou JSON
        for (const fileName of fileNames) {
          if (fileName.endsWith('.xml') || fileName.includes('siri')) {
            // // console.log('📦 [SIRI] Fichier XML trouvé:', fileName);
            const content = await zipContent.files[fileName].async('text');
            return processSiriXmlData(content, lineId);
          } else if (fileName.endsWith('.json')) {
            // // console.log('📦 [SIRI] Fichier JSON trouvé:', fileName);
            const content = await zipContent.files[fileName].async('text');
            const jsonData = JSON.parse(content);
            return processSiriJsonData(jsonData, lineId);
          }
        }
        
        // Si aucun fichier spécifique trouvé, prendre le premier
        if (fileNames.length > 0) {
          const content = await zipContent.files[fileNames[0]].async('text');
          if (content.trim().startsWith('<')) {
            return processSiriXmlData(content, lineId);
          } else if (content.trim().startsWith('{')) {
            return processSiriJsonData(JSON.parse(content), lineId);
          }
        }
      } catch (zipError) {
        // // console.error('Erreur lors de la décompression du ZIP:', zipError);
      }
    } else {
      // Si ce n'est pas un ZIP, lire directement
      const responseText = await response.text();
      // // console.log('📦 [SIRI] Taille des données:', responseText.length, 'caractères');
      
      if (responseText.trim().startsWith('<')) {
        return processSiriXmlData(responseText, lineId);
      } else if (responseText.trim().startsWith('{')) {
        return processSiriJsonData(JSON.parse(responseText), lineId);
      }
    }
    
    // // console.error('Aucune méthode n\'a permis de décoder les données SIRI');
    return { delays: {}, updatedTimes: {}, skippedStops: {} };
  } catch (error) {
    // // console.error('Erreur lors de la récupération des données SIRI:', error);
    return { delays: {}, updatedTimes: {}, skippedStops: {} };
  }
};

/**
 * Traite les données SIRI au format XML
 * @param {string} xmlText - Données XML
 * @param {string} lineId - ID de la ligne pour filtrer
 * @returns {Object} - Données de retard et mises à jour
 */
const processSiriXmlData = (xmlText, lineId) => {
  const delays = {};
  const updatedTimes = {};
  const skippedStops = {}; // Ajouter un objet pour les arrêts non desservis
  
  try {
    // Analyser la réponse SIRI (format XML)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Vérifier si le document est valide
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      // // console.error('Erreur de parsing XML:', parserError.textContent);
      return { delays, updatedTimes, skippedStops };
    }
    
    // Extraire les données de retard et les mises à jour
    const monitoredStopVisits = xmlDoc.getElementsByTagName('MonitoredStopVisit');
    // // // console.log(`Nombre de MonitoredStopVisit trouvés: ${monitoredStopVisits.length}`);
    
    Array.from(monitoredStopVisits).forEach(visit => {
      try {
        // Récupérer les données de base
        const monitoredVehicleJourney = visit.getElementsByTagName('MonitoredVehicleJourney')[0];
        if (!monitoredVehicleJourney) {
          // // console.log('Pas de MonitoredVehicleJourney trouvé pour l\'arrêt');
          return;
        }
        
        // Récupérer les IDs
        const stopId = visit.getElementsByTagName('MonitoringRef')[0]?.textContent;
        const tripId = monitoredVehicleJourney.getElementsByTagName('DatedVehicleJourneyRef')[0]?.textContent;
        
        if (!stopId || !tripId) {
          // // console.log('StopId ou TripId manquant pour un arrêt:', visit.outerHTML);
          return;
        }
        
        // Extraire l'ID court du stopId (ex: "CCAC:StopPoint:BP:CESCLO1:LOC" -> "CESCLO1")
        const shortStopId = stopId.split(':').slice(-2, -1)[0];
        const shortTripId = tripId.split(':').slice(-2, -1)[0];
        
        // Vérifier la ligne si nécessaire
        const lineRef = monitoredVehicleJourney.getElementsByTagName('LineRef')[0]?.textContent;
        if (lineId && lineRef && !lineRef.includes(lineId)) {
          return;
        }
        
        // Récupérer les horaires
        const monitoredCall = monitoredVehicleJourney.getElementsByTagName('MonitoredCall')[0];
        if (!monitoredCall) {
          // // console.log('Pas de MonitoredCall trouvé pour l\'arrêt:', shortStopId);
          return;
        }
        
        // Vérifier si l'arrêt est marqué comme non desservi
        const callStatus = monitoredCall.getElementsByTagName('CallStatus')[0]?.textContent || 
                          monitoredCall.getElementsByTagName('StopStatus')[0]?.textContent;
                          
        if (callStatus === 'cancelled' || callStatus === 'skipped' || callStatus === 'notExpected') {
          const basicKey = `${shortTripId}-${shortStopId}`;
          skippedStops[basicKey] = true;
          return; // Passer à l'arrêt suivant
        }
        
        // Vérifier le vehicle journey status (peut indiquer si l'arrêt est non desservi)
        const journeyStatus = monitoredVehicleJourney.getElementsByTagName('JourneyStatus')?.[0]?.textContent;
        if (journeyStatus === 'cancelled' || journeyStatus === 'modified') {
          const basicKey = `${shortTripId}-${shortStopId}`;
          skippedStops[basicKey] = true;
          return; // Passer à l'arrêt suivant
        }
        
        // Horaire programmé
        const aimedArrivalTime = monitoredCall.getElementsByTagName('AimedArrivalTime')[0]?.textContent;
        const aimedDepartureTime = monitoredCall.getElementsByTagName('AimedDepartureTime')[0]?.textContent;
        
        // Horaire prévu/temps réel
        const expectedArrivalTime = monitoredCall.getElementsByTagName('ExpectedArrivalTime')[0]?.textContent;
        const expectedDepartureTime = monitoredCall.getElementsByTagName('ExpectedDepartureTime')[0]?.textContent;
        
        // Statut du départ
        const departureStatus = monitoredCall.getElementsByTagName('DepartureStatus')[0]?.textContent;
        
        // Si le statut indique que l'arrêt ne sera pas desservi
        if (departureStatus === 'cancelled' || departureStatus === 'noStop') {
          const basicKey = `${shortTripId}-${shortStopId}`;
          skippedStops[basicKey] = true;
          return; // Passer à l'arrêt suivant
        }
        
        // Récupérer l'ordre de l'arrêt (équivalent de stop_sequence)
        const stopOrder = monitoredCall.getElementsByTagName('Order')[0]?.textContent;
        
        // Calculer le retard
        let delay = 0;
        const delayElement = monitoredVehicleJourney.getElementsByTagName('Delay')[0];
        
        if (delayElement) {
          const delayText = delayElement.textContent;
          if (delayText === 'PT0S') {
            delay = 0;
          } else {
            const match = delayText.match(/PT(\d+)S/);
            if (match) {
              delay = Math.round(parseInt(match[1], 10) / 60);
            }
          }
        } else if (expectedArrivalTime && aimedArrivalTime) {
          const expectedDate = new Date(expectedArrivalTime);
          const aimedDate = new Date(aimedArrivalTime);
          delay = Math.round((expectedDate.getTime() - aimedDate.getTime()) / (60 * 1000));
        } else if (expectedDepartureTime && aimedDepartureTime) {
          const expectedDate = new Date(expectedDepartureTime);
          const aimedDate = new Date(aimedDepartureTime);
          delay = Math.round((expectedDate.getTime() - aimedDate.getTime()) / (60 * 1000));
        }
        
        // Créer les clés
        const basicKey = `${shortTripId}-${shortStopId}`;
        const sequenceKey = stopOrder ? `${shortTripId}-${shortStopId}-${stopOrder}` : basicKey;
        
        // Enregistrer le retard avec les deux clés si possible
        delays[basicKey] = delay; // Pour compatibilité
        if (stopOrder) {
            delays[sequenceKey] = delay;
        }
        
        // Enregistrer les horaires programmés et mis à jour
        if (expectedArrivalTime || expectedDepartureTime || aimedArrivalTime || aimedDepartureTime) {
          const timeData = {
            arrival: expectedArrivalTime ? new Date(expectedArrivalTime) : 
                    aimedArrivalTime ? new Date(aimedArrivalTime) : null,
            departure: expectedDepartureTime ? new Date(expectedDepartureTime) : 
                      aimedDepartureTime ? new Date(aimedDepartureTime) : null,
            originalArrival: aimedArrivalTime ? new Date(aimedArrivalTime) : null,
            originalDeparture: aimedDepartureTime ? new Date(aimedDepartureTime) : null,
            status: departureStatus || 'onTime'
          };
          
          updatedTimes[basicKey] = timeData; // Pour compatibilité
          if (stopOrder) {
            updatedTimes[sequenceKey] = timeData;
          }
        }
        
        /* console.log(`Traitement de l'arrêt ${shortStopId} du trajet ${shortTripId}:`, {
          delay,
          status: departureStatus,
          aimedArrivalTime,
          aimedDepartureTime,
          expectedArrivalTime,
          expectedDepartureTime
        }); */
      } catch (error) {
        // // console.error('Erreur lors du traitement d\'un arrêt:', error);
      }
    });
    
    // // // console.log(`Résultats du traitement SIRI: ${Object.keys(delays).length} retards, ${Object.keys(updatedTimes).length} mises à jour`);
  } catch (error) {
    // // console.error('Erreur lors du traitement des données XML SIRI:', error);
  }
  
  return { delays, updatedTimes, skippedStops };
};

/**
 * Traite les données SIRI au format JSON
 * @param {Object} data - Données SIRI en JSON
 * @param {string} lineId - ID de la ligne pour filtrer
 * @returns {Object} - Données de retard et mises à jour
 */
const processSiriJsonData = (data, lineId) => {
  const delays = {};
  const updatedTimes = {};
  const skippedStops = {}; // Ajouter un objet pour les arrêts non desservis
  
  // Vérifier si le format est celui attendu
  const siriData = data.Siri || data.siri || data;
  
  // Chercher les arrêts dans différents chemins possibles de l'objet JSON
  const stopVisits = siriData.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ||
                     siriData.ServiceDelivery?.StopMonitoringDelivery?.MonitoredStopVisit ||
                     siriData.StopMonitoringDelivery?.MonitoredStopVisit ||
                     [];
  
  if (!Array.isArray(stopVisits) || stopVisits.length === 0) {
    // // console.warn('Aucun arrêt trouvé dans les données SIRI JSON:', siriData);
    return { delays, updatedTimes, skippedStops };
  }
  
  stopVisits.forEach(visit => {
    // Le chemin des données peut varier selon l'implémentation
    const monitoredVisit = visit.MonitoredVehicleJourney || visit;
    const monitoredStop = visit.MonitoredStopVisit || visit;
    
    const stopId = monitoredStop.MonitoredStopPointRef || 
                   monitoredVisit.MonitoredCall?.StopPointRef;
                   
    const tripId = monitoredVisit.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ||
                  monitoredVisit.VehicleJourneyRef;
    
    // Filtrer par ligne si nécessaire
    const routeId = monitoredVisit.LineRef;
    if (lineId && routeId && routeId !== lineId) {
      return;
    }
    
    if (!stopId || !tripId) {
      return;
    }
    
    // Horaires programmés et temps réel
    const monitoredCall = monitoredVisit.MonitoredCall || {};
    
    // Vérifier si l'arrêt est marqué comme non desservi
    const callStatus = monitoredCall.CallStatus || monitoredCall.StopStatus;
    if (callStatus === 'cancelled' || callStatus === 'skipped' || callStatus === 'notExpected') {
      const key = `${tripId}-${stopId}`;
      skippedStops[key] = true;
      return; // Passer à l'arrêt suivant
    }
    
    const aimedArrivalTime = monitoredCall.AimedArrivalTime;
    const aimedDepartureTime = monitoredCall.AimedDepartureTime;
    const expectedArrivalTime = monitoredCall.ExpectedArrivalTime;
    const expectedDepartureTime = monitoredCall.ExpectedDepartureTime;
    
    // Récupérer l'ordre de l'arrêt (équivalent de stop_sequence)
    const stopOrder = monitoredCall.Order || monitoredStop.StopSequence;

    // Calculer le retard
    let delay = 0;
    if (monitoredCall.Delay) {
      delay = Math.round(parseInt(monitoredCall.Delay, 10) / 60);
    } else if (expectedArrivalTime && aimedArrivalTime) {
      const expectedDate = new Date(expectedArrivalTime);
      const aimedDate = new Date(aimedArrivalTime);
      delay = Math.round((expectedDate - aimedDate) / (60 * 1000));
    } else if (expectedDepartureTime && aimedDepartureTime) {
      const expectedDate = new Date(expectedDepartureTime);
      const aimedDate = new Date(aimedDepartureTime);
      delay = Math.round((expectedDate - aimedDate) / (60 * 1000));
    }
    
    const key = `${tripId}-${stopId}`;
    
    // Enregistrer le retard s'il est différent de zéro
    if (delay !== 0) {
      delays[key] = delay;
    }
    
    // Enregistrer les horaires
    if (expectedArrivalTime || expectedDepartureTime || aimedArrivalTime || aimedDepartureTime) {
      updatedTimes[key] = {
        arrival: expectedArrivalTime ? new Date(expectedArrivalTime) : 
                aimedArrivalTime ? new Date(aimedArrivalTime) : null,
        departure: expectedDepartureTime ? new Date(expectedDepartureTime) : 
                  aimedDepartureTime ? new Date(aimedDepartureTime) : null,
        originalArrival: aimedArrivalTime ? new Date(aimedArrivalTime) : null,
        originalDeparture: aimedDepartureTime ? new Date(aimedDepartureTime) : null
      };
    }
  });
  
  return { delays, updatedTimes, skippedStops };
};

/**
 * Récupère les données temps réel GTFS-RT pour un réseau et une ligne spécifiques
 * @param {string} networkId - Identifiant du réseau
 * @param {string} lineId - Identifiant de la ligne
 * @param {string} subnetworkName - Nom du sous-réseau (optionnel)
 * @returns {Promise<Object>} - Données de retard et mises à jour
 */
export const fetchGtfsRtData = async (networkId, lineId, subnetworkName = null) => {
  console.log('[DEBUG] fetchGtfsRtData CALLED WITH:', { networkId, lineId, subnetworkName });
  try {
    let apiUrl, apiParams, requiresApiKey;
    
    // // // console.log('🔍 [DEBUG] Début fetchGtfsRtData:', { networkId, lineId, subnetworkName });
    
    if (subnetworkName) {
      const { data: networkData, error: networkError } = await supabase
        .from('networks')
        .select('subnetworks')
        .eq('network_id', networkId)
        .single();
      
      // // console.log('📋 [DEBUG] Données réseau:', networkData);
      
      if (networkError) {
        // // console.error('❌ [DEBUG] Erreur réseau:', networkError);
        return { delays: {}, updatedTimes: {} };
      }
      
      if (networkData?.subnetworks) {
        const subnetwork = networkData.subnetworks.find(s => s.name === subnetworkName);
        // // console.log('🔎 [DEBUG] Sous-réseau trouvé:', subnetwork);
        
        if (subnetwork?.realtime?.type === 'gtfs-rt') {
          apiUrl = subnetwork.realtime.url;
          apiParams = subnetwork.realtime.params || {};
          requiresApiKey = subnetwork.realtime.requires_api_key || false;
          // // // console.log('✅ [DEBUG] Configuration sous-réseau:', { apiUrl, apiParams, requiresApiKey });
        }
      }
    }
    
    if (!apiUrl) {
      const { data: networkData, error } = await supabase
        .from('networks')
        .select('gtfs_rt_url, gtfs_rt_params, requires_api_key')
        .eq('network_id', networkId)
        .single();
      
      // // console.log('🔍 [DEBUG] Configuration globale:', networkData);
      
      if (error || !networkData?.gtfs_rt_url) {
        // // console.error('❌ [DEBUG] Erreur configuration globale:', error);
        return { delays: {}, updatedTimes: {} };
      }
      
      apiUrl = networkData.gtfs_rt_url;
      apiParams = networkData.gtfs_rt_params || {};
      requiresApiKey = networkData.requires_api_key || false;
    }
    
    const url = new URL(apiUrl);
    const params = { ...apiParams };
    
    if (apiParams?.useRouteId) {
      params.route_id = lineId;
    }
    
    if (requiresApiKey) {
      params.apiKey = process.env.REACT_APP_GTFS_RT_API_KEY || '';
    }
    
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    // // console.log('🚀 [DEBUG-GTFS] URL appelée:', url.toString());
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/x-protobuf, application/json, application/zip, application/octet-stream'
      }
    });
    
    /* console.log('📥 [DEBUG-GTFS] Réponse:', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    }); */
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    // // console.log('📄 [DEBUG] Type de contenu:', contentType);
    
    // Cloner la réponse pour pouvoir la lire plusieurs fois si nécessaire
    const responseClone = response.clone();
    
    // Si le contenu est du JSON
    if (contentType && contentType.includes('application/json')) {
      const jsonData = await response.json();
      // // console.log('GTFS-RT: Données JSON reçues', jsonData);
      
      // Vérifier si c'est une structure JSON typique d'une API REST
      if (jsonData.feed && jsonData.feed.entity) {
        return await processGtfsRtData(jsonData.feed, lineId, networkId, subnetworkName);
      } else if (jsonData.data && Array.isArray(jsonData.data.trips)) {
        return await processGtfsRtData(jsonData, lineId, networkId, subnetworkName);
      }
      
      return await processGtfsRtData(jsonData, lineId, networkId, subnetworkName);
    }
    
    // Si c'est un ZIP ou un octet-stream
    const arrayBuffer = await responseClone.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    console.log('[DEBUG] fetchGtfsRtData RAW DATA RECEIVED (bytes length):', bytes.byteLength);
    
    // Vérifier si c'est un fichier ZIP
    if (isZipFile(bytes)) {
      try {
        // // console.log('📦 [DEBUG] Fichier ZIP détecté, tentative de décompression...');
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(arrayBuffer);
        
        // Liste des fichiers dans le ZIP
        const fileNames = Object.keys(zipContent.files);
        // // console.log('📦 [DEBUG] Fichiers dans le ZIP:', fileNames);
        
        // Chercher un fichier protobuf dans le ZIP
        for (const fileName of fileNames) {
          if (fileName.endsWith('.pb') || fileName.endsWith('.protobuf') || fileName.endsWith('.bin')) {
            // // console.log('📦 [DEBUG] Fichier protobuf trouvé:', fileName);
            const content = await zipContent.files[fileName].async('arraybuffer');
            try {
              const root = protobuf.parse(GTFS_RT_PROTO).root;
              const FeedMessage = root.lookupType('transit_realtime.FeedMessage');
              const message = FeedMessage.decode(new Uint8Array(content));
              const decodedData = FeedMessage.toObject(message, {
                longs: String,
                enums: String,
                bytes: String
              });
              return await processGtfsRtData(decodedData, lineId, networkId, subnetworkName);
            } catch (e) {
              // // console.error('Erreur lors du décodage Protobuf du fichier décompressé:', e);
            }
          }
        }
      } catch (zipError) {
        // // console.error('Erreur lors de la décompression du ZIP:', zipError);
      }
    } else {
      // Si ce n'est pas un ZIP, essayer de décoder comme protobuf directement
      try {
        const root = protobuf.parse(GTFS_RT_PROTO).root;
        const FeedMessage = root.lookupType('transit_realtime.FeedMessage');
        const message = FeedMessage.decode(bytes);
        const decodedData = FeedMessage.toObject(message, {
          longs: String,
          enums: String,
          bytes: String
        });
        return await processGtfsRtData(decodedData, lineId, networkId, subnetworkName);
      } catch (protobufError) {
        // // console.error('Erreur lors du décodage Protobuf:', protobufError);
      }
    }
    
    // // console.error('Aucune méthode n\'a permis de décoder les données GTFS-RT');
    return { delays: {}, updatedTimes: {} };
  } catch (error) {
    // // console.error('Erreur lors de la récupération des données GTFS-RT:', error);
    return { delays: {}, updatedTimes: {} };
  }
};

/**
 * Traite les données GTFS-RT décodées
 * @param {Object} data - Données GTFS-RT décodées
 * @param {string} lineId - ID de la ligne pour filtrer les résultats
 * @returns {Object} - Données de retard et mises à jour
 */
const processGtfsRtData = async (data, lineId, networkId, subnetworkName) => {
  console.log('[DEBUG] processGtfsRtData CALLED WITH (data sample - first entity):', data && data.entity ? data.entity[0] : 'No data or no entities', 'FOR lineId:', lineId);
  const delays = {};
  const updatedTimes = {};
  const skippedStops = {};

  if (data.feed && data.feed.entity) {
    data = data.feed;
  } else if (data.data && Array.isArray(data.data.trips)) {
    data.data.trips.forEach(trip => {
      const tripId = trip.trip_id;
      const routeId = trip.route_id;

      // Strictement filtrer par lineId ici avant tout traitement pour ce format
      if (lineId && routeId !== lineId) {
        console.log(`[DEBUG] processGtfsRtData (custom format) - IGNORING trip ${tripId} (route ${routeId}) because it does not match requested lineId ${lineId}`);
        return; // Ne pas traiter ce voyage s'il n'est pas de la bonne ligne
      }
      console.log(`[DEBUG] processGtfsRtData (custom format) - PROCESSING trip ${tripId} (route ${routeId}) for requested lineId ${lineId}`);

      if (trip.stops && Array.isArray(trip.stops)) {
        trip.stops.forEach(stop => {
          const stopId = stop.stop_id;
          const delay = stop.delay ? Math.round(stop.delay / 60) : 0;
          
          // Vérifier si l'arrêt est supprimé
          if (stop.schedule_relationship === 'SKIPPED') {
            const basicKey = `${tripId}-${stopId}`;
            skippedStops[basicKey] = true;
          }
          // Stocker le retard dans tous les cas
          delays[`${tripId}-${stopId}`] = delay;
          
          // Stocker les heures mises à jour
          if (stop.arrival_time || stop.departure_time) {
            updatedTimes[`${tripId}-${stopId}`] = {
              arrival: stop.arrival_time ? new Date(stop.arrival_time) : null,
              departure: stop.departure_time ? new Date(stop.departure_time) : null
            };
          }
        });
      }
    });
    
    return { delays, updatedTimes, skippedStops };
  }
  
  // Format GTFS-RT standard
  if (!data.entity || !Array.isArray(data.entity)) {
    // // console.warn('Format GTFS-RT inattendu:', data);
    return { delays, updatedTimes, skippedStops };
  }
  
  // Étape 1: Collecter les identifiants pour lesquels on a besoin des horaires planifiés
  const stopTimesToFetch = [];
  data.entity.forEach(entity => {
    if (entity.tripUpdate && entity.tripUpdate.trip && entity.tripUpdate.stopTimeUpdate) {
      const tripId = entity.tripUpdate.trip.tripId;
      if (lineId && entity.tripUpdate.trip.routeId && entity.tripUpdate.trip.routeId !== lineId) {
        return;
      }
      entity.tripUpdate.stopTimeUpdate.forEach(update => {
        const hasTime = update.arrival?.time || update.departure?.time;
        const hasDelay = update.arrival?.delay !== undefined || update.departure?.delay !== undefined;
        if (hasTime && !hasDelay) {
          stopTimesToFetch.push({
            tripId: tripId,
            stopSequence: update.stopSequence,
            stopId: update.stopId
          });
        }
      });
    }
  });

  // Étape 2: Récupérer les horaires planifiés
  const scheduledTimesMap = new Map();
  if (stopTimesToFetch.length > 0) {
    const uniqueTripIds = [...new Set(stopTimesToFetch.map(st => st.tripId))];
    
    let query = supabase
      .from('stop_times')
      .select('trip_id, stop_sequence, stop_id, arrival_time, departure_time')
      .in('trip_id', uniqueTripIds);

    // Ajout du filtrage par networkId si disponible
    if (networkId) {
      query = query.eq('network_id', networkId);
    }
    // Ajout du filtrage par subnetworkName si disponible
    if (subnetworkName) {
      query = query.eq('subnetwork_name', subnetworkName);
    }
      
    const { data: stopTimesData, error } = await query;

    if (error) {
      console.error('Erreur lors de la récupération des horaires planifiés (stop_times):', error);
    } else if (stopTimesData) {
      stopTimesData.forEach(st => {
        const keySeq = `${st.trip_id}-${st.stop_sequence}`;
        scheduledTimesMap.set(keySeq, st);
        const keyId = `${st.trip_id}-${st.stop_id}`;
        scheduledTimesMap.set(keyId, st);
      });
    }
  }

  // Étape 3: Traiter les entités pour calculer les retards
  data.entity.forEach(entity => {
    if (entity.tripUpdate && entity.tripUpdate.trip) {
      const tripId = entity.tripUpdate.trip.tripId;
      const routeId = entity.tripUpdate.trip.routeId;

      // Strictement filtrer par lineId AVANT de traiter les stopTimeUpdate
      if (lineId && routeId !== lineId) {
        console.log(`[DEBUG] processGtfsRtData (standard format) - IGNORING entity for trip ${tripId} (route ${routeId}) because it does not match requested lineId ${lineId}`);
        return; // Ignorer complètement cette entité si elle n'est pas pour la bonne ligne
      }
      console.log(`[DEBUG] processGtfsRtData (standard format) - PROCESSING entity for trip ${tripId} (route ${routeId}) for requested lineId ${lineId}`);

      if (entity.tripUpdate.stopTimeUpdate && Array.isArray(entity.tripUpdate.stopTimeUpdate)) {
        entity.tripUpdate.stopTimeUpdate.forEach((update, index) => {
          const stopId = update.stopId;
          const stopSequence = update.stopSequence !== undefined ? update.stopSequence : index;
          
          // Créer des clés avec et sans séquence pour compatibilité
          const basicKey = `${tripId}-${stopId}`;
          const sequenceKey = `${tripId}-${stopId}-${stopSequence}`;
          
          // Vérifier si l'arrêt est supprimé (SKIPPED)
          if (update.scheduleRelationship === 'SKIPPED' || update.scheduleRelationship === '1') {
            skippedStops[basicKey] = true;
            skippedStops[sequenceKey] = true;
            return; // Passer à l'arrêt suivant
          }
          
          // Calculer le retard (en minutes)
          let delay = 0;
          const hasDelay = (update.departure && update.departure.delay !== undefined) || (update.arrival && update.arrival.delay !== undefined);

          if (hasDelay) {
            if (update.departure && update.departure.delay !== undefined) {
              delay = Math.round(update.departure.delay / 60);
            } else if (update.arrival && update.arrival.delay !== undefined) {
              delay = Math.round(update.arrival.delay / 60);
            }
          } else {
            const lookupKeySeq = `${tripId}-${stopSequence}`;
            const lookupKeyId = `${tripId}-${stopId}`;
            const scheduledStopTime = scheduledTimesMap.get(lookupKeySeq) || scheduledTimesMap.get(lookupKeyId);

            if (scheduledStopTime) {
              let scheduledTimeStr = null;
              let timestampToCompare = null;

              // On privilégie l'heure de départ pour le calcul du retard, car c'est la plus pertinente
              // pour un voyageur qui attend. Pour le terminus, seule l'arrivée sera disponible.
              if (update.departure && update.departure.time) {
                timestampToCompare = update.departure.time;
                scheduledTimeStr = scheduledStopTime.departure_time;
              } else if (update.arrival && update.arrival.time) {
                timestampToCompare = update.arrival.time;
                scheduledTimeStr = scheduledStopTime.arrival_time;
              }

              if (scheduledTimeStr && timestampToCompare) {
                try {
                  const rtDate = new Date(parseInt(timestampToCompare, 10) * 1000); // Date UTC temps-réel
                  const timeParts = scheduledTimeStr.split(':').map(Number);
                  const hour = timeParts[0];
                  const minute = timeParts[1];
                  const second = timeParts[2] || 0;

                  const dayOffset = Math.floor(hour / 24);
                  const correctedHour = hour % 24;

                  let scheduledDate;
                  const tripStartDateStr = entity.tripUpdate.trip.startDate;

                  if (tripStartDateStr && /^\d{8}$/.test(tripStartDateStr)) {
                    // Cas 1: La date de service est fournie. C'est le plus fiable.
                    const year = parseInt(tripStartDateStr.substring(0, 4), 10);
                    const month = parseInt(tripStartDateStr.substring(4, 6), 10) - 1;
                    const day = parseInt(tripStartDateStr.substring(6, 8), 10);
                    
                    // On crée la date planifiée en se basant sur la date de service et l'heure locale, 
                    // puis on laisse JS la convertir en timestamp UTC pour la comparaison.
                    const serviceDate = new Date(year, month, day);
                    serviceDate.setDate(serviceDate.getDate() + dayOffset);
                    serviceDate.setHours(correctedHour, minute, second, 0);
                    scheduledDate = serviceDate;

                  } else {
                    // Cas 2: Pas de date de service. On utilise une heuristique locale.
                    const rtLocalDate = new Date(parseInt(timestampToCompare, 10) * 1000);
                    
                    // On construit 3 dates candidates: hier, aujourd'hui, demain en se basant sur l'heure locale du navigateur.
                    const todayCandidate = new Date(rtLocalDate);
                    todayCandidate.setHours(correctedHour, minute, second, 0);
                    todayCandidate.setDate(todayCandidate.getDate() + dayOffset); // Appliquer l'offset de jour pour les heures > 24

                    const yesterdayCandidate = new Date(todayCandidate);
                    yesterdayCandidate.setDate(yesterdayCandidate.getDate() - 1);

                    const tomorrowCandidate = new Date(todayCandidate);
                    tomorrowCandidate.setDate(tomorrowCandidate.getDate() + 1);

                    const candidates = [ yesterdayCandidate, todayCandidate, tomorrowCandidate ];

                    // On choisit la date candidate dont le timestamp est le plus proche du timestamp temps réel.
                    scheduledDate = candidates.reduce((closest, current) => {
                        const diffClosest = Math.abs(rtLocalDate.getTime() - closest.getTime());
                        const diffCurrent = Math.abs(rtLocalDate.getTime() - current.getTime());
                        return diffCurrent < diffClosest ? current : closest;
                    });
                  }
                  
                  // On compare les deux timestamps (en ms) pour obtenir le retard.
                  const calculatedDelayInSeconds = (rtDate.getTime() - scheduledDate.getTime()) / 1000;
                  delay = Math.round(calculatedDelayInSeconds / 60);

                } catch(e) {
                  console.error("Erreur de calcul du retard :", e);
                  delay = 0;
                }
              }
            }
          }
          
          // Stocker le retard dans tous les cas
          delays[basicKey] = delay; // Pour compatibilité
          delays[sequenceKey] = delay; // Nouvelle clé avec séquence
          
          // Stocker les heures mises à jour
          const arrivalTime = update.arrival && update.arrival.time ? 
            parseInt(update.arrival.time) * 1000 : null;
          const departureTime = update.departure && update.departure.time ? 
            parseInt(update.departure.time) * 1000 : null;
            
          if (arrivalTime || departureTime) {
            const timeData = {
              arrival: arrivalTime ? new Date(arrivalTime) : null,
              departure: departureTime ? new Date(departureTime) : null
            };
            
            updatedTimes[basicKey] = timeData; // Pour compatibilité
            updatedTimes[sequenceKey] = timeData; // Nouvelle clé avec séquence
          }
        });
      }
    }
  });
  
  // Log amélioré pour voir un échantillon des retards stockés
  const delaysSample = Object.entries(delays).slice(0, 5).reduce((obj, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});
  console.log('[DEBUG] processGtfsRtData RETURNING delays (sample):', delaysSample, 'Total delays found:', Object.keys(delays).length);
  return { delays, updatedTimes, skippedStops };
};

/**
 * Fonction unifiée pour récupérer les données temps réel
 * Cette fonction vérifie les API disponibles et utilise celle qui convient
 * @param {string} networkId - Identifiant du réseau
 * @param {string} lineId - Identifiant de la ligne
 * @param {string} subnetworkName - Nom du sous-réseau (optionnel)
 * @returns {Promise<Object>} - Données de retard et mises à jour
 */
export const fetchRealtimeData = async (networkId, lineId, subnetworkName = null) => {
  console.log('[DEBUG] fetchRealtimeData CALLED WITH:', { networkId, lineId, subnetworkName });
  try {
    // Vérifier quelles API sont disponibles pour ce réseau
    const { data: networkData, error } = await supabase
      .from('networks')
      .select('has_siri_api, has_gtfs_rt_api, subnetworks')
      .eq('network_id', networkId)
      .single();
    
    if (error) {
      // // console.error('❌ Erreur lors de la vérification des API disponibles:', error);
      return { delays: {}, updatedTimes: {} };
    }

    // Si on a un sous-réseau, vérifier sa configuration spécifique
    let realtimeType = null;
    if (subnetworkName && networkData.subnetworks) {
      const subnetwork = networkData.subnetworks.find(s => s.name === subnetworkName);
      if (subnetwork?.realtime?.type) {
        realtimeType = subnetwork.realtime.type.toUpperCase();
        // // // console.log(`📡 Type d'API temps réel pour le sous-réseau ${subnetworkName}:`, realtimeType);
      }
    }

    // Si pas de type spécifique au sous-réseau, utiliser la configuration globale
    if (!realtimeType) {
      if (networkData.has_gtfs_rt_api) {
        realtimeType = 'GTFS-RT';
      } else if (networkData.has_siri_api) {
        realtimeType = 'SIRI';
      }
      // // console.log(`📡 Type d'API temps réel global:`, realtimeType);
    }

    // Utiliser l'API appropriée selon le type
    if (realtimeType === 'SIRI') {
      // // console.log('🚀 Utilisation de l\'API SIRI');
      return await fetchSiriRealtimeData(networkId, lineId, subnetworkName);
    } else if (realtimeType === 'GTFS-RT') {
      // // console.log('🚀 Utilisation de l\'API GTFS-RT');
      return await fetchGtfsRtData(networkId, lineId, subnetworkName);
    }

    // // console.log('⚠️ Aucune API temps réel configurée');
    // Si aucune API n'est configurée ou si une erreur survient avant le retour spécifique
    console.log('[DEBUG] fetchRealtimeData RETURNING (default or error before specific API call):', { delays: {}, updatedTimes: {} });
    return { delays: {}, updatedTimes: {} };
  } catch (error) {
    // // console.error('Erreur lors de la récupération des données temps réel:', error);
    console.log('[DEBUG] fetchRealtimeData CAUGHT ERROR, RETURNING default:', { delays: {}, updatedTimes: {} }, error);
    return { delays: {}, updatedTimes: {} };
  }
};

/**
 * Récupère les données de position des véhicules (GTFS-RT Vehicle Positions)
 * @param {string} networkId - Identifiant du réseau
 * @param {string} subnetworkName - Nom du sous-réseau (optionnel)
 * @returns {Promise<Object>} - Positions des véhicules formatées
 */
export const fetchGtfsRtVpData = async (networkId, subnetworkName = null) => {
  try {
    let apiUrl, apiParams, requiresApiKey;

    // // console.log('🔍 [VP-GTFS] Début fetchGtfsRtVpData:', { networkId, subnetworkName });

    // Récupérer la config depuis la BDD (similaire à GTFS-RT TripUpdates)
    // TODO: Adapter les noms des colonnes si différents de ceux suggérés (vp_gtfs_rt_url, etc.)
    const { data: networkData, error } = await supabase
      .from('networks')
      .select('vp_gtfs_rt_url, vp_params, vp_requires_api_key, subnetworks')
      .eq('network_id', networkId)
      .single();

    if (error) throw new Error(`Erreur BDD config VP: ${error.message}`);

    if (subnetworkName && networkData.subnetworks) {
      const subnetwork = networkData.subnetworks.find(s => s.name === subnetworkName);
      if (subnetwork?.vehicle_position?.type === 'gtfs-rt') { // Adapter la structure si besoin
        apiUrl = subnetwork.vehicle_position.url;
        apiParams = subnetwork.vehicle_position.params || {};
        requiresApiKey = subnetwork.vehicle_position.requires_api_key || false;
      }
    }

    if (!apiUrl) {
       if (!networkData?.vp_gtfs_rt_url) throw new Error('URL VP GTFS-RT manquante');
       apiUrl = networkData.vp_gtfs_rt_url;
       apiParams = networkData.vp_params || {}; // Utiliser les params spécifiques VP
       requiresApiKey = networkData.vp_requires_api_key || false;
    }

    const url = new URL(apiUrl);
    const params = { ...apiParams };

    if (requiresApiKey) {
      params.apiKey = process.env.REACT_APP_VP_GTFS_RT_API_KEY || process.env.REACT_APP_GTFS_RT_API_KEY || ''; // Utiliser une clé spécifique VP si définie
    }

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    // // console.log('🚀 [VP-GTFS] URL appelée:', url.toString());

    const response = await fetchWithCorsProxy(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json, application/x-protobuf, application/octet-stream' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    // Vérifier le type de contenu de la réponse
    const contentType = response.headers.get('content-type');
    // // console.log('[VP-GTFS] Type de contenu reçu:', contentType);

    let decodedData;
    
    // Si c'est du JSON (comme pour BIBUS)
    if (contentType && contentType.includes('application/json')) {
      // // console.log('[VP-GTFS] Traitement en tant que JSON');
      decodedData = await response.json();
    } else {
      // Sinon, traiter comme du protobuf binaire
      // // console.log('[VP-GTFS] Traitement en tant que protobuf binaire');
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // // console.log('[VP-GTFS] Données brutes reçues (taille): ', bytes.byteLength);
      const root = protobuf.parse(GTFS_RT_PROTO).root;
      const FeedMessage = root.lookupType('transit_realtime.FeedMessage');
      // // console.log('[VP-GTFS] Protobuf chargé. Décodage...');
      
      try {
        const message = FeedMessage.decode(bytes);
        // // console.log('[VP-GTFS] Décodage OK. Conversion en objet...');
        decodedData = FeedMessage.toObject(message, {
          longs: String,
          enums: String,
          bytes: String
        });
        // // console.log('[VP-GTFS] Conversion en objet OK.');
      } catch (decodeError) {
        // // console.error('[VP-GTFS] Erreur pendant le décodage/conversion protobuf:', decodeError);
        throw decodeError; // Relancer l'erreur pour qu'elle soit potentiellement attrapée plus haut
      }
    }

    // // console.log('[VP-GTFS] Appel de processGtfsRtVpData...');
    return processGtfsRtVpData(decodedData);

  } catch (error) {
    // // console.error('Erreur lors de la récupération des données GTFS-RT VP:', error);
    return {}; // Retourner un objet vide en cas d'erreur
  }
};

/**
 * Traite les données GTFS-RT Vehicle Positions décodées
 * @param {Object} data - Données décodées
 * @returns {Object} - Positions formatées { vehicleId: { lat, lon, bearing, routeId, tripId } }
 */
const processGtfsRtVpData = (data) => {
  // // console.log('[VP Process] Début processGtfsRtVpData. Données reçues:', data);
  const positions = {};
  if (!data.entity || !Array.isArray(data.entity)) {
    // // console.warn('Format GTFS-RT VP inattendu:', data);
    return positions;
  }

  data.entity.forEach(entity => {
    // Log pour chaque entité avant traitement
    // // // console.log('[VP Process] Traitement entité:', entity.id);
    if (entity.vehicle && entity.vehicle.position && entity.vehicle.trip) {
      const vehicle = entity.vehicle;
      // Extraire l'ID du véhicule de différentes façons selon la structure
      let vehicleId = vehicle.vehicle?.id || entity.id;
      // Pour BIBUS, l'ID peut être dans le format "vehicle:268435659", on extrait juste le nombre
      if (vehicleId && vehicleId.includes(':')) {
        vehicleId = vehicleId.split(':').pop();
      }
      
      // Ignorer si pas de position valide
      if (vehicle.position.latitude == null || vehicle.position.longitude == null) {
        // // // // console.log(`[VP Process] Position invalide pour ${vehicleId}, ignoré.`);
        return;
      }

      // Pour le timestamp, accepter 0 comme valeur valide (certaines APIs comme BIBUS retournent toujours 0)
      let timestamp = vehicle.timestamp ? parseInt(vehicle.timestamp) : 0;
      // Si le timestamp est une chaîne "0", le convertir en nombre
      if (vehicle.timestamp === "0") {
        timestamp = 0;
      } else if (timestamp > 0) {
        timestamp = timestamp * 1000; // Convertir en ms seulement si > 0
      }

      positions[vehicleId] = {
        lat: vehicle.position.latitude,
        lon: vehicle.position.longitude,
        bearing: vehicle.position.bearing,
        routeId: vehicle.trip.routeId,
        tripId: vehicle.trip.tripId,
        vehicleId: vehicleId, // Inclure vehicleId pour référence
        label: vehicle.vehicle?.label || vehicleId, // Utiliser le label si disponible, sinon l'ID
        timestamp: timestamp
      };
      // // // console.log(`[VP Process] Position ajoutée pour ${vehicleId}:`, positions[vehicleId]);
    }
  });
  // // // console.log(`[VP-GTFS] ${Object.keys(positions).length} positions traitées.`);
  // // console.log('[VP Process] Fin processGtfsRtVpData. Retourne:', positions);
  return positions;
};

/**
 * Récupère les données de position des véhicules (SIRI-VM)
 * @param {string} networkId - Identifiant du réseau
 * @param {string} subnetworkName - Nom du sous-réseau (optionnel)
 * @returns {Promise<Object>} - Positions des véhicules formatées
 */
export const fetchSiriVmData = async (networkId, subnetworkName = null) => {
  try {
    let apiUrl, apiParams, requiresApiKey;
    // // console.log('🔍 [VP-SIRI] Début fetchSiriVmData:', { networkId, subnetworkName });

    // Récupérer la config depuis la BDD
    // TODO: Adapter les noms des colonnes (vp_siri_vm_url, etc.)
    const { data: networkData, error } = await supabase
      .from('networks')
      .select('vp_siri_vm_url, vp_params, vp_requires_api_key, subnetworks') 
      .eq('network_id', networkId)
      .single();

    if (error) throw new Error(`Erreur BDD config VP: ${error.message}`);

    if (subnetworkName && networkData.subnetworks) {
      const subnetwork = networkData.subnetworks.find(s => s.name === subnetworkName);
      if (subnetwork?.vehicle_position?.type === 'siri-vm') { // Adapter si besoin
        apiUrl = subnetwork.vehicle_position.url;
        apiParams = subnetwork.vehicle_position.params || {};
        requiresApiKey = subnetwork.vehicle_position.requires_api_key || false;
      }
    }

    if (!apiUrl) {
      if (!networkData?.vp_siri_vm_url) throw new Error('URL VP SIRI-VM manquante');
      apiUrl = networkData.vp_siri_vm_url;
      apiParams = networkData.vp_params || {};
      requiresApiKey = networkData.vp_requires_api_key || false;
    }

    const url = new URL(apiUrl);
    const params = { ...apiParams };
    const requestHeaders = {
      'Accept': 'application/xml, text/xml, application/json, application/zip'
    };

    if (requiresApiKey) {
      const apiKey = process.env.REACT_APP_VP_SIRI_API_KEY || process.env.REACT_APP_SIRI_API_KEY || ''; // Clé spécifique VP ou fallback
       if (apiUrl.includes('ara-api.enroute.mobi')) {
         requestHeaders['Authorization'] = `Bearer ${apiKey}`;
       } else if (apiParams?.apiKeyHeader) {
         requestHeaders[apiParams.apiKeyHeader] = apiKey;
       } else {
         params.apiKey = apiKey;
       }
    }

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    // // console.log('🚀 [VP-SIRI] URL appelée:', url.toString());

    const response = await fetchWithCorsProxy(url.toString(), {
      method: 'GET',
      headers: requestHeaders,
      credentials: apiParams?.includeCookies ? 'include' : 'same-origin',
      mode: 'cors'
    });
    
    if (response.type === 'opaque') {
       // // console.log('⚠️ [VP-SIRI] Réponse opaque reçue');
       return {};
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const contentType = response.headers.get('content-type');
    // // console.log('📄 [VP-SIRI] Type de contenu:', contentType);

    if (contentType && contentType.includes('application/zip')) {
      const arrayBuffer = await response.arrayBuffer();
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(arrayBuffer);
      const fileNames = Object.keys(zipContent.files);
      for (const fileName of fileNames) {
        if (fileName.endsWith('.xml')) {
          const content = await zipContent.files[fileName].async('text');
          return processSiriVmData(content);
        }
      }
      throw new Error('Aucun fichier XML trouvé dans le ZIP SIRI-VM');
    } else {
      const responseText = await response.text();
      if (responseText.trim().startsWith('<')) {
        return processSiriVmData(responseText);
      } else {
         throw new Error('Réponse SIRI-VM non XML inattendue');
      }
    }

  } catch (error) {
    // // console.error('Erreur lors de la récupération des données SIRI-VM:', error);
    return {};
  }
};

/**
 * Traite les données SIRI-VM (XML)
 * @param {string} xmlText - Données XML
 * @returns {Object} - Positions formatées { vehicleId: { lat, lon, bearing, routeId, tripId } }
 */
const processSiriVmData = (xmlText) => {
  const positions = {};
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) throw new Error(`Erreur parsing XML SIRI-VM: ${parserError.textContent}`);

    const vehicleActivities = xmlDoc.getElementsByTagName('VehicleActivity');
    // // // console.log(`[VP-SIRI] ${vehicleActivities.length} VehicleActivity trouvées.`);

    Array.from(vehicleActivities).forEach(activity => {
      const monitoredVehicleJourney = activity.getElementsByTagName('MonitoredVehicleJourney')[0];
      if (!monitoredVehicleJourney) return;

      const vehicleLocation = monitoredVehicleJourney.getElementsByTagName('VehicleLocation')[0];
      const vehicleRef = monitoredVehicleJourney.getElementsByTagName('VehicleRef')[0]?.textContent;
      const lineRef = monitoredVehicleJourney.getElementsByTagName('LineRef')[0]?.textContent;
      const datedVehicleJourneyRef = monitoredVehicleJourney.getElementsByTagName('DatedVehicleJourneyRef')[0]?.textContent;
      const bearing = monitoredVehicleJourney.getElementsByTagName('Bearing')[0]?.textContent;
      const recordedAtTime = activity.getElementsByTagName('RecordedAtTime')[0]?.textContent;

      if (!vehicleLocation || !vehicleRef) return;

      const latitude = vehicleLocation.getElementsByTagName('Latitude')[0]?.textContent;
      const longitude = vehicleLocation.getElementsByTagName('Longitude')[0]?.textContent;

      if (latitude && longitude) {
        // Extraire les IDs courts si nécessaire (à adapter selon le format réel)
        const shortVehicleId = vehicleRef.includes(':') ? vehicleRef.split(':').pop() : vehicleRef;
        const shortTripId = datedVehicleJourneyRef?.includes(':') ? datedVehicleJourneyRef.split(':').pop() : datedVehicleJourneyRef;
        const shortRouteId = lineRef?.includes(':') ? lineRef.split(':').pop() : lineRef;
        
        positions[shortVehicleId] = {
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
          bearing: bearing ? parseFloat(bearing) : null,
          routeId: shortRouteId,
          tripId: shortTripId,
          vehicleId: shortVehicleId,
          timestamp: recordedAtTime ? new Date(recordedAtTime).getTime() : null
        };
      }
    });
    // // console.log(`[VP-SIRI] ${Object.keys(positions).length} positions traitées.`);

  } catch (error) {
    // // console.error('Erreur lors du traitement des données XML SIRI-VM:', error);
  }
  return positions;
};

/**
 * Fonction unifiée pour récupérer les données de position des véhicules
 * @param {string} networkId - Identifiant du réseau
 * @param {string} subnetworkName - Nom du sous-réseau (optionnel)
 * @returns {Promise<Object>} - Positions formatées
 */
export const fetchVehiclePositionData = async (networkId, subnetworkName = null) => {
  try {
    // // console.log(`[VP Fetch] Début fetchVehiclePositionData pour network: ${networkId}, subnetwork: ${subnetworkName}`);
    // Vérifier quelles API sont disponibles
    // TODO: Adapter les noms des colonnes (has_gtfs_rt_vp_api, etc.)
    const { data: networkData, error } = await supabase
      .from('networks')
      .select('has_gtfs_rt_vp_api, has_siri_vm_api, subnetworks, vp_gtfs_rt_url, vp_siri_vm_url') // Ajouter les URLs pour le log
      .eq('network_id', networkId)
      .single();
    
    // // console.log('[VP Fetch] Configuration réseau brute récupérée:', networkData);

    if (error) {
      // // console.error('[VP Fetch] Erreur BDD check VP API:', error);
      throw new Error(`Erreur BDD check VP API: ${error.message}`);
    }

    let vpType = null;
    let foundConfig = null; // Pour loguer la config utilisée

    if (subnetworkName && networkData.subnetworks) {
      const subnetwork = networkData.subnetworks.find(s => s.name === subnetworkName);
      // // console.log(`[VP Fetch] Sous-réseau trouvé pour ${subnetworkName}:`, subnetwork);
      // TODO: Adapter la structure 'vehicle_position' si différente
      if (subnetwork?.vehicle_position?.type) {
        vpType = subnetwork.vehicle_position.type.toUpperCase();
        foundConfig = subnetwork.vehicle_position;
        // // console.log(`[VP Fetch] Type API trouvé dans sous-réseau (${subnetworkName}): ${vpType}`, foundConfig);
      }
    }

    if (!vpType) {
      // // console.log('[VP Fetch] Pas de config VP dans sous-réseau ou pas de sous-réseau, vérification config globale.');
      if (networkData.has_gtfs_rt_vp_api) {
        vpType = 'GTFS-RT';
        foundConfig = { type: 'GTFS-RT', url: networkData.vp_gtfs_rt_url }; // Simuler une config pour le log
      } else if (networkData.has_siri_vm_api) {
        vpType = 'SIRI-VM';
        foundConfig = { type: 'SIRI-VM', url: networkData.vp_siri_vm_url }; // Simuler une config pour le log
      }
      // // console.log(`[VP Fetch] Type API trouvé dans config globale: ${vpType}`, foundConfig);
    }

    // // console.log(`[VP Fetch] API type final sélectionné: ${vpType || 'Aucune'}`);

    if (vpType === 'GTFS-RT') {
      // // console.log('[VP Fetch] Appel de fetchGtfsRtVpData...');
      return await fetchGtfsRtVpData(networkId, subnetworkName);
    } else if (vpType === 'SIRI-VM') {
      // // console.log('[VP Fetch] Appel de fetchSiriVmData...');
      return await fetchSiriVmData(networkId, subnetworkName);
    }

    // // console.log('⚠️ [VP Fetch] Aucune API de position des véhicules configurée pour ce réseau/sous-réseau.');
    return {};
  } catch (error) {
    // // console.error('Erreur lors de la récupération des données de position véhicules:', error);
    return {};
  }
}; 

