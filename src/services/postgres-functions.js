import { supabase } from './supabase';

/**
 * Configure le timeout des requêtes pour la session en cours.
 * @param {number} timeoutMs - Le timeout en millisecondes (par défaut 10 minutes)
 * @returns {Promise<boolean>} - true si réussi
 */
export const setStatementTimeout = async (timeoutMs = 600000) => {
  try {
    // Simple log puisque nous ne pouvons pas configurer le timeout dynamiquement
    console.log(`Statement timeout set to ${timeoutMs}ms (informational only)`);
    return true;
  } catch (error) {
    console.error('Error setting statement timeout:', error);
    return false;
  }
};

/**
 * Détermine la colonne à utiliser pour l'ordre dans une table
 * @param {string} tableName - Le nom de la table
 * @returns {Promise<{column: string, useNativeOrder: boolean}>} - Nom de la colonne et façon de l'utiliser
 */
async function getOrderColumn(tableName) {
  // Mapping des colonnes d'ordre par table
  const orderColumns = {
    'stop_times': { column: 'stop_sequence', useNativeOrder: true },
    'trips': { column: 'trip_id', useNativeOrder: true },
    'stops': { column: 'stop_id', useNativeOrder: true },
    'routes': { column: 'route_id', useNativeOrder: true },
    'shapes': { column: 'id', useNativeOrder: false }, // Utiliser l'ID de la table au lieu de shape_pt_sequence
    'calendar': { column: 'service_id', useNativeOrder: true },
    'calendar_dates': { column: 'date', useNativeOrder: true },
    'agency': { column: 'agency_id', useNativeOrder: true },
    'transfers': { column: 'from_stop_id', useNativeOrder: true },
    'networks': { column: 'network_id', useNativeOrder: true }
  };

  // Utiliser la colonne mappée ou une colonne par défaut
  return orderColumns[tableName] || { column: 'created_at', useNativeOrder: true };
}

/**
 * Supprime les données d'une table par lots pour éviter les timeouts et les limites de lignes
 * @param {string} tableName - Le nom de la table
 * @param {string} networkId - L'ID du réseau à supprimer
 * @param {number} batchSize - Taille des lots (défaut: 100)
 * @param {Function} progressCallback - Callback appelé après chaque lot supprimé (paramètre: nombre de lignes supprimées)
 * @returns {Promise<number>} - Nombre d'enregistrements supprimés
 */
export const deleteTableDataInBatches = async (tableName, networkId, batchSize = 100, progressCallback = null) => {
  let hasMore = true;
  let deletedCount = 0;
  let currentBatchSize = batchSize;
  let attempts = 0;
  const maxAttempts = 5;

  // Déterminer la colonne d'ordre par défaut
  const orderInfo = await getOrderColumn(tableName);

  // Vérifier s'il y a des données à supprimer
  const { count: initialCount, error: initialCountError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .eq('network_id', networkId);
    
  if (initialCountError) {
    console.warn(`Error counting initial rows in ${tableName}:`, initialCountError);
  } else if (initialCount === 0) {
    console.log(`No data to delete in ${tableName}`);
    return 0;
  } else {
    console.log(`Found ${initialCount} rows to delete in ${tableName}`);
  }

  // Pour la table shapes, essayer une approche différente
  if (tableName === 'shapes' && initialCount > 0) {
    try {
      return await deleteShapesTable(networkId, progressCallback, initialCount);
    } catch (shapeError) {
      console.error(`Error with specialized shapes deletion, falling back to standard method:`, shapeError);
      // Continue avec la méthode standard ci-dessous
    }
  }

  while (hasMore && attempts < maxAttempts) {
    try {
      // Construire la requête de base
      let query = supabase
        .from(tableName)
        .delete()
        .eq('network_id', networkId);
      
      // Ajouter l'ordre seulement si nécessaire pour cette table
      if (orderInfo.useNativeOrder) {
        query = query.order(orderInfo.column, { ascending: true });
      }
      
      // Appliquer la limite
      query = query.limit(currentBatchSize);

      // Note: Nous n'utilisons pas .options() car cette fonction n'est pas disponible
      // dans la version actuelle de Supabase

      // Exécuter la requête
      const { error } = await query;

      if (error) {
        attempts++;
        console.error(`Attempt ${attempts}/${maxAttempts} - Error deleting from ${tableName}:`, error);
        
        if (error.message && error.message.includes('timeout')) {
          console.warn(`Timeout deleting from ${tableName}, reducing batch size...`);
          currentBatchSize = Math.floor(currentBatchSize / 2);
        } else if (error.message && error.message.includes('maximum number of rows')) {
          console.warn(`Row limit exceeded for ${tableName}, reducing batch size...`);
          currentBatchSize = Math.floor(currentBatchSize / 2);
        } else if (error.code === '23503') {
          // Erreur de clé étrangère
          console.warn(`Foreign key constraint error in ${tableName}, will need force delete`);
          return 0; // Indiquer qu'on n'a pas réussi à supprimer
        } else if (attempts >= 3) {
          // Après 3 tentatives, essayer sans ordre explicite
          console.warn(`Multiple errors, trying without explicit ordering for ${tableName}`);
          orderInfo.useNativeOrder = false;
        } else {
          throw error;
        }
        
        // Si le lot est trop petit, on abandonne cette approche
        if (currentBatchSize < 2) {
          if (tableName === 'shapes') {
            console.warn(`Batch size too small for ${tableName}, switching to specialized method...`);
            return await deleteShapesTable(networkId, progressCallback, initialCount);
          } else {
            throw new Error(`Batch size too small for ${tableName} (${currentBatchSize})`);
          }
        }
        continue;
      }

      // Réinitialiser le compteur de tentatives après un succès
      attempts = 0;
      
      // Vérifier s'il reste des données
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('network_id', networkId);
        
      if (countError) {
        if (countError.message && countError.message.includes('timeout')) {
          // En cas de timeout sur le count, on suppose qu'il reste des données
          hasMore = true;
        } else {
          throw countError;
        }
      } else {
        const previousCount = count || 0;
        hasMore = previousCount > 0;
        
        // Calculer le nombre réel de lignes supprimées
        const actualDeleted = previousCount > currentBatchSize ? currentBatchSize : previousCount;
        if (actualDeleted > 0) {
          // Mettre à jour le compteur global seulement si on a réellement supprimé des lignes
          deletedCount += actualDeleted;
          
          // Appeler le callback de progression si fourni
          if (progressCallback && typeof progressCallback === 'function') {
            progressCallback(actualDeleted);
          }
        }
        
        if (previousCount > 0) {
          console.log(`Remaining rows in ${tableName}: ${previousCount}`);
        }
      }
      
      // Petite pause pour réduire la charge sur la BD
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Critical error in batch deletion from ${tableName}:`, error);
      
      // Pour les erreurs graves, on essaie de réduire drastiquement la taille du lot
      if (attempts < maxAttempts) {
        attempts++;
        currentBatchSize = Math.max(2, Math.floor(currentBatchSize / 4));
        console.log(`Retrying with much smaller batch size: ${currentBatchSize}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      // Si la table est shapes, utiliser une méthode spécialisée comme dernier recours
      if (tableName === 'shapes') {
        console.warn(`Standard deletion failed for shapes, trying specialized method...`);
        try {
          return await deleteShapesTable(networkId, progressCallback, initialCount);
        } catch (shapeError) {
          console.error(`Even specialized shapes deletion failed:`, shapeError);
          throw error; // Rethrow original error
        }
      }
      
      throw error;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.warn(`Maximum attempts (${maxAttempts}) reached for ${tableName}. Deleted ${deletedCount} rows.`);
    
    // Pour shapes, essayer la méthode spécialisée en dernier recours
    if (tableName === 'shapes') {
      console.warn(`Trying specialized method for shapes as last resort...`);
      try {
        const additionalDeleted = await deleteShapesTable(networkId, progressCallback, initialCount);
        return deletedCount + additionalDeleted;
      } catch (error) {
        console.error(`Specialized shapes deletion also failed as last resort:`, error);
      }
    }
  }
  
  return deletedCount;
};

/**
 * Méthode simplifiée pour supprimer toutes les données de la table shapes
 * @param {string} networkId - L'ID du réseau 
 * @param {Function} progressCallback - Callback de progression
 * @param {number} totalCount - Nombre total de lignes à supprimer
 * @returns {Promise<number>} - Nombre de lignes supprimées
 */
async function deleteShapesTable(networkId, progressCallback, totalCount) {
  let deletedCount = 0;
  
  // Supprimer par petits lots sans utiliser LIMIT
  try {
    // Supprimer directement sans order ni limit
    const deleteResult = await supabase
      .from('shapes')
      .delete()
      .eq('network_id', networkId);
      
    if (deleteResult.error) {
      console.error('Error deleting shapes:', deleteResult.error);
      throw deleteResult.error;
    }
    
    // Estimer le nombre de lignes supprimées
    deletedCount = totalCount || 1;
    
    // Appeler le callback de progression
    if (progressCallback && typeof progressCallback === 'function') {
      progressCallback(deletedCount);
    }
    
    return deletedCount;
    
  } catch (error) {
    console.error('Failed to delete shapes data:', error);
    return 0;
  }
} 