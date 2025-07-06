import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required. Please check your .env file.');
}

// Créer une instance partagée avec configuration du fuseau horaire Europe/Paris
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: false,
    persistSession: true,
    persistStorage: false
  },
  global: {
    headers: {
      'X-Client-Info': 'bus-connect',
      'Timezone': 'Europe/Paris'
    }
  }
});

// Client avec rôle de service pour les opérations d'administration (si la clé de service est disponible)
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'public'
      },
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        persistStorage: false
      },
      global: {
        headers: {
          'X-Client-Info': 'bus-connect',
          'Timezone': 'Europe/Paris'
        }
      }
    })
  : supabase;

// Cache en mémoire avec expiration
const cache = new Map();
const inFlightRequests = new Map(); // Pour stocker les promesses des requêtes en cours
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (augmenté de 5 à 15 minutes)

// Fonction utilitaire pour gérer le cache
const getCacheKey = (key, params) => {
  return `${key}-${JSON.stringify(params)}`;
};

// Fonction pour récupérer du cache ou faire l'appel API (version améliorée)
const getCachedData = async (key, params, fetchFunction) => {
  const cacheKey = getCacheKey(key, params);
  const now = Date.now();

  // 1. Vérifier le cache existant
  if (cache.has(cacheKey)) {
    const cachedItem = cache.get(cacheKey);
    // Supabase stocke les timestamps en secondes, convertir en ms si nécessaire
    // Pour notre cache simple, nous utilisons Date.now() qui est en ms.
    if (now - cachedItem.timestamp < CACHE_DURATION) {
      return cachedItem.data;
    }
    // Le cache a expiré, le supprimer
    cache.delete(cacheKey);
  }

  // 2. Vérifier si une requête pour cette clé est déjà en cours
  if (inFlightRequests.has(cacheKey)) {
    // Attendre la promesse de la requête en cours
    return await inFlightRequests.get(cacheKey);
  }

  // 3. Aucune donnée en cache valide, aucune requête en cours : effectuer l'appel API
  const fetchPromise = (async () => {
    try {
      const data = await fetchFunction();
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      // Supprimer la requête de la liste des requêtes en cours une fois terminée (succès ou échec)
      inFlightRequests.delete(cacheKey);
    }
  })();

  // Stocker la promesse de la requête en cours
  inFlightRequests.set(cacheKey, fetchPromise);
  return await fetchPromise;
};

/**
 * Fonction utilitaire pour gérer les problèmes de fuseaux horaires
 * @return {Object} Retourne l'objet date d'aujourd'hui formaté pour Supabase
 */
export const getTodayForSupabase = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  return { date: today, dateStr, dayOfWeek };
};

// Fonction pour récupérer les horaires
export const fetchTimetableData = async (networkId, serviceId, directionId) => {
  const cacheKey = 'timetable';
  const params = { networkId, serviceId, directionId };
  
  return getCachedData(cacheKey, params, async () => {
    const { data, error } = await supabase.rpc('get_timetable_data', {
      network_id_param: networkId,
      service_id_param: serviceId,
      direction_id_param: directionId
    });
    
    if (error) throw error;
    return data;
  });
};

// Fonction optimisée pour récupérer les connexions
export const fetchConnections = async (networkId, stopIds) => {
  const cacheKey = 'connections';
  const params = { networkId, stopIds: stopIds.sort().join(',') };
  
  return getCachedData(cacheKey, params, async () => {
    const { data, error } = await supabase.rpc('get_stop_connections', {
      network_id_param: networkId,
      stop_ids: stopIds
    });
    
    if (error) throw error;
    return data;
  });
};

// Gestionnaire de requêtes groupées
const batchRequestsQueue = new Map();
const BATCH_WINDOW = 50; // Fenêtre de temps en ms pour regrouper les requêtes similaires

/**
 * Fonction pour regrouper les requêtes similaires vers Supabase
 * @param {string} endpoint - L'endpoint Supabase (table ou rpc)
 * @param {string} method - La méthode à utiliser (select, insert, etc.)
 * @param {Object} params - Les paramètres de la requête
 * @param {Function} queryBuilder - Fonction qui construit la requête Supabase
 * @returns {Promise<any>} - Résultat de la requête
 */
export const batchRequest = async (endpoint, method, params, queryBuilder) => {
  const cacheKey = `${endpoint}:${method}:${JSON.stringify(params)}`;
  
  // Si une requête similaire est déjà en attente, renvoyez sa promesse
  if (batchRequestsQueue.has(cacheKey)) {
    console.log(`[Batch] Requête regroupée pour ${endpoint}`);
    return batchRequestsQueue.get(cacheKey);
  }
  
  // Créer une nouvelle promesse pour cette requête
  const requestPromise = new Promise((resolve, reject) => {
    // Attendre un court délai pour permettre le regroupement d'autres requêtes similaires
    setTimeout(async () => {
      try {
        // Exécuter la requête avec le queryBuilder fourni
        const result = await queryBuilder();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        // Supprimer cette requête de la file d'attente
        batchRequestsQueue.delete(cacheKey);
      }
    }, BATCH_WINDOW);
  });
  
  // Ajouter cette requête à la file d'attente
  batchRequestsQueue.set(cacheKey, requestPromise);
  return requestPromise;
};

// Fonction pour invalider le cache
export const invalidateCache = (key = null) => {
  if (key) {
    // Supprimer toutes les entrées qui commencent par la clé
    for (const cacheKey of cache.keys()) {
      if (cacheKey.startsWith(key)) {
        cache.delete(cacheKey);
      }
    }
  } else {
    cache.clear();
  }
};

// La ligne d'exportation doit uniquement contenir les éléments non déjà exportés avec "export const"
export { supabase, supabaseAdmin, getCachedData }; 

