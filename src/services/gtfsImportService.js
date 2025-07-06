import Papa from 'papaparse';
import { supabase } from './supabase';

const cleanValue = (value, type) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  if (type === 'integer') {
    return isNaN(parseInt(value)) ? null : parseInt(value);
  }
  if (type === 'decimal') {
    return isNaN(parseFloat(value)) ? null : parseFloat(value);
  }
  if (type === 'boolean') {
    return value === '1' || value.toLowerCase() === 'true';
  }
  return value;
};

const cleanData = (data, schema, networkId) => {
  return data.map(row => {
    const cleanRow = { network_id: networkId };
    for (const [key, value] of Object.entries(row)) {
      const type = schema[key];
      if (type) {
        cleanRow[key] = cleanValue(value, type);
      }
    }
    return cleanRow;
  });
};

const GTFS_SCHEMAS = {
  agency: {
    agency_id: 'text',
    agency_name: 'text',
    agency_url: 'text',
    agency_timezone: 'text',
    agency_lang: 'text',
    agency_phone: 'text',
    agency_fare_url: 'text',
    agency_email: 'text'
  },
  stops: {
    stop_id: 'text',
    stop_code: 'text',
    stop_name: 'text',
    stop_desc: 'text',
    stop_lat: 'decimal',
    stop_lon: 'decimal',
    zone_id: 'text',
    stop_url: 'text',
    location_type: 'integer',
    parent_station: 'text',
    wheelchair_boarding: 'integer',
    stop_timezone: 'text',
    platform_code: 'text',
    level_id: 'text'
  },
  routes: {
    route_id: 'text',
    agency_id: 'text',
    route_short_name: 'text',
    route_long_name: 'text',
    route_desc: 'text',
    route_type: 'integer',
    route_url: 'text',
    route_color: 'text',
    route_text_color: 'text',
    route_sort_order: 'integer'
  },
  trips: {
    trip_id: 'text',
    route_id: 'text',
    service_id: 'text',
    trip_headsign: 'text',
    trip_short_name: 'text',
    direction_id: 'integer',
    block_id: 'text',
    shape_id: 'text',
    wheelchair_accessible: 'integer',
    bikes_allowed: 'integer'
  },
  stop_times: {
    trip_id: 'text',
    arrival_time: 'text',
    departure_time: 'text',
    stop_id: 'text',
    stop_sequence: 'integer',
    stop_headsign: 'text',
    pickup_type: 'integer',
    drop_off_type: 'integer',
    shape_dist_traveled: 'decimal',
    timepoint: 'integer',
    drop_off_booking_rule_id: 'text'
  },
  calendar: {
    service_id: 'text',
    monday: 'boolean',
    tuesday: 'boolean',
    wednesday: 'boolean',
    thursday: 'boolean',
    friday: 'boolean',
    saturday: 'boolean',
    sunday: 'boolean',
    start_date: 'text',
    end_date: 'text'
  },
  calendar_dates: {
    service_id: 'text',
    date: 'text',
    exception_type: 'integer'
  },
  shapes: {
    shape_id: 'text',
    shape_pt_lat: 'decimal',
    shape_pt_lon: 'decimal',
    shape_pt_sequence: 'integer',
    shape_dist_traveled: 'decimal'
  },
  transfers: {
    from_stop_id: 'text',
    to_stop_id: 'text',
    transfer_type: 'integer',
    min_transfer_time: 'integer'
  }
};

const getConflictColumns = (tableName) => {
  switch (tableName) {
    case 'stop_times':
      return 'network_id,trip_id,stop_sequence';
    case 'shapes':
      return 'network_id,shape_id,shape_pt_sequence';
    case 'transfers':
      return 'network_id,from_stop_id,to_stop_id';
    case 'calendar_dates':
      return 'network_id,service_id,date';
    case 'agency':
      return 'network_id,agency_id';
    case 'stops':
      return 'network_id,stop_id';
    case 'routes':
      return 'network_id,route_id';
    case 'calendar':
      return 'network_id,service_id';
    case 'trips':
      return 'network_id,trip_id';
    default:
      throw new Error(`No conflict columns defined for table ${tableName}`);
  }
};

const importGTFSFile = async (file, tableName, networkId) => {
  return new Promise((resolve, reject) => {
    console.log(`Starting import for table ${tableName} in network ${networkId}`);
    
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          console.log(`Parsed ${results.data.length} rows for ${tableName}`);
          
          // Remove empty rows and clean data
          const schema = GTFS_SCHEMAS[tableName];
          if (!schema) {
            throw new Error(`No schema defined for table ${tableName}`);
          }

          const cleanedData = cleanData(
            results.data.filter(row => Object.values(row).some(val => val !== '')),
            schema,
            networkId
          );
          
          if (cleanedData.length === 0) {
            throw new Error(`No valid data found in file for ${tableName}`);
          }

          console.log(`Inserting ${cleanedData.length} rows into ${tableName}`);
          
          // Réduire la taille des lots pour éviter les timeouts
          const batchSize = tableName === 'stop_times' ? 500 : 1000;
          let successCount = 0;
          
          for (let i = 0; i < cleanedData.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, cleanedData.length);
            const batch = cleanedData.slice(i, batchEnd);
            
            try {
              // Utiliser upsert avec les bonnes colonnes de conflit
              const { error } = await supabase
                .from(tableName)
                .upsert(batch, {
                  onConflict: getConflictColumns(tableName)
                });
              
              if (error) {
                console.error(`Error inserting batch ${i}-${batchEnd} into ${tableName}:`, error);
                throw error;
              }
              
              successCount += batch.length;
              console.log(`Progress for ${tableName}: ${successCount}/${cleanedData.length} (${Math.round(successCount/cleanedData.length*100)}%)`);
              
              // Ajouter une pause entre les lots pour éviter de surcharger la base de données
              if (i + batchSize < cleanedData.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (batchError) {
              // Réessayer avec des lots plus petits si on a un timeout
              if (batchError.message && batchError.message.includes('timeout')) {
                console.log(`Timeout detected, retrying with smaller batch size for ${tableName}`);
                const smallerBatchSize = Math.floor(batch.length / 2);
                
                for (let j = 0; j < batch.length; j += smallerBatchSize) {
                  const smallerBatch = batch.slice(j, j + smallerBatchSize);
                  
                  try {
                    const { error } = await supabase
                      .from(tableName)
                      .upsert(smallerBatch, {
                        onConflict: getConflictColumns(tableName)
                      });
                    
                    if (error) throw error;
                    
                    successCount += smallerBatch.length;
                    
                    // Pause plus longue entre les petits lots
                    await new Promise(resolve => setTimeout(resolve, 200));
                  } catch (smallerBatchError) {
                    console.error(`Error with smaller batch in ${tableName}:`, smallerBatchError);
                    // Continuer malgré l'erreur pour traiter le maximum de données
                  }
                }
              } else {
                // Pour les autres types d'erreurs, les signaler mais continuer
                console.error(`Error with batch in ${tableName}:`, batchError);
              }
            }
          }

          console.log(`Successfully imported ${successCount} rows for ${tableName}`);
          resolve({ tableName, success: true, count: successCount });
        } catch (error) {
          console.error(`Error processing ${tableName}:`, error);
          reject(error);
        }
      },
      error: (error) => {
        console.error(`Error parsing file for ${tableName}:`, error);
        reject(error);
      }
    });
  });
};

export const importGTFSData = async (files, networkId) => {
  if (!networkId) {
    throw new Error('Network ID is required for GTFS import');
  }

  try {
    console.log('Starting GTFS data import...');
    console.log('Files to import:', Object.keys(files));
    console.log('Network ID:', networkId);

    // Import dans l'ordre pour respecter les contraintes de clés étrangères
    const importOrder = [
      'agency',
      'stops',
      'routes',
      'calendar',
      'calendar_dates',
      'shapes',
      'trips',
      'stop_times',
      'transfers'
    ];

    for (const tableName of importOrder) {
      if (files[tableName]) {
        try {
          await importGTFSFile(files[tableName], tableName, networkId);
        } catch (error) {
          console.error(`Error importing ${tableName}:`, error);
          return {
            success: false,
            error: `Error importing ${tableName}: ${error.message}`
          };
        }
      }
    }

    return {
      success: true,
      message: 'GTFS data imported successfully'
    };
  } catch (error) {
    console.error('Error importing GTFS data:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
};

// Fonction utilitaire pour vérifier si une table existe
export const checkTableExists = async (tableName) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('count(*)')
      .limit(1);
    
    if (error) {
      console.error(`Error checking table ${tableName}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}; 