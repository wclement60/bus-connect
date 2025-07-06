import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import Papa from 'papaparse';
import { deleteTableDataInBatches, setStatementTimeout } from '../../services/postgres-functions';

const GTFS_FILES = {
  'agency.txt': 'agency',
  'calendar.txt': 'calendar',
  'calendar_dates.txt': 'calendar_dates',
  'routes.txt': 'routes',
  'stops.txt': 'stops',
  'stop_times.txt': 'stop_times',
  'trips.txt': 'trips',
  'shapes.txt': 'shapes',
  'transfers.txt': 'transfers'
};

// Définition des champs numériques pour chaque table
const NUMERIC_FIELDS = {
  routes: ['route_type', 'route_sort_order'],
  stops: ['stop_lat', 'stop_lon', 'location_type', 'wheelchair_boarding'],
  stop_times: ['stop_sequence', 'pickup_type', 'drop_off_type', 'shape_dist_traveled', 'timepoint'],
  trips: ['direction_id', 'wheelchair_accessible', 'bikes_allowed'],
  shapes: ['shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence', 'shape_dist_traveled'],
  transfers: ['transfer_type', 'min_transfer_time'],
  calendar_dates: ['exception_type']
};

// Définition des champs booléens pour chaque table
const BOOLEAN_FIELDS = {
  calendar: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
};

// Définition explicite des colonnes GTFS standard pour chaque table
const VALID_GTFS_COLUMNS = {
  agency: ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang', 'agency_phone', 'agency_fare_url', 'agency_email'],
  calendar: ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
  calendar_dates: ['service_id', 'date', 'exception_type'],
  routes: ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_desc', 'route_type', 'route_url', 'route_color', 'route_text_color', 'route_sort_order'],
  stops: ['stop_id', 'stop_code', 'stop_name', 'stop_desc', 'stop_lat', 'stop_lon', 'zone_id', 'stop_url', 'location_type', 'parent_station', 'stop_timezone', 'wheelchair_boarding', 'level_id', 'platform_code'],
  stop_times: ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'stop_headsign', 'pickup_type', 'drop_off_type', 'shape_dist_traveled', 'timepoint'],
  trips: ['route_id', 'service_id', 'trip_id', 'trip_headsign', 'trip_short_name', 'direction_id', 'block_id', 'shape_id', 'wheelchair_accessible', 'bikes_allowed'],
  shapes: ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence', 'shape_dist_traveled'],
  transfers: ['from_stop_id', 'to_stop_id', 'transfer_type', 'min_transfer_time']
};

// Colonnes ajoutées par le script ou gérées spécifiquement
const ALLOWED_EXTRA_COLUMNS = ['network_id', 'subnetwork_name', 'subnetwork_metadata', '_original_agency_id', '_original_route_id'];

const Upload = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [subnetworkName, setSubnetworkName] = useState('');
  const [realtimeType, setRealtimeType] = useState('');
  const [realtimeUrl, setRealtimeUrl] = useState('');
  const [realtimeApiKey, setRealtimeApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState('');
  const [showManageNetworks, setShowManageNetworks] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState(0);
  const [deletingCurrentTable, setDeletingCurrentTable] = useState('');
  const [estimatedRowCount, setEstimatedRowCount] = useState(0);
  const [deletedRowCount, setDeletedRowCount] = useState(0);
  const [agencyIdMapping, setAgencyIdMapping] = useState({});
  const [useExistingNetwork, setUseExistingNetwork] = useState(false);
  const [existingNetworkId, setExistingNetworkId] = useState('');
  const [uploadMode, setUploadMode] = useState('directory');
  const [networkConfigured, setNetworkConfigured] = useState(false);
  const [missingFiles, setMissingFiles] = useState([]);
  const [existingTables, setExistingTables] = useState({});

  // State for table deletion modal
  const [showDeleteTableModal, setShowDeleteTableModal] = useState(false);
  const [tableToDelete, setTableToDelete] = useState(null);
  const [tableFileNameToDelete, setTableFileNameToDelete] = useState(null); // For display in modal

  // Charger la liste des réseaux et les informations sauvegardées
  useEffect(() => {
    if (showManageNetworks || useExistingNetwork) {
      fetchNetworks();
    }

    // Restaurer les informations du réseau depuis localStorage
    const savedNetworkInfo = localStorage.getItem('gtfsUploadNetworkInfo');
    if (savedNetworkInfo) {
      try {
        const networkInfo = JSON.parse(savedNetworkInfo);
        if (networkInfo.networkConfigured) {
          setNetworkConfigured(true);
          setUseExistingNetwork(networkInfo.useExistingNetwork);
          
          if (networkInfo.useExistingNetwork) {
            setExistingNetworkId(networkInfo.existingNetworkId);
            // Déclencher un chargement des données pour ce réseau
            if (networkInfo.existingNetworkId) {
              checkExistingTables(networkInfo.existingNetworkId);
            }
          } else {
            setNetworkId(networkInfo.networkId);
            setNetworkName(networkInfo.networkName);
          }
          
          setSubnetworkName(networkInfo.subnetworkName || '');
          setRealtimeType(networkInfo.realtimeType || '');
          setRealtimeUrl(networkInfo.realtimeUrl || '');
          setRealtimeApiKey(networkInfo.realtimeApiKey || '');
          setUploadedFiles(networkInfo.uploadedFiles || []);
        }
      } catch (e) {
        console.error('Erreur lors de la restauration des données:', e);
        localStorage.removeItem('gtfsUploadNetworkInfo');
      }
    }
  }, [showManageNetworks, useExistingNetwork]);

  // Vérifie quelles tables existent déjà pour ce réseau
  const checkExistingTables = async (networkId) => {
    if (!networkId) return;
    
    setLoading(true);
    try {
      const tablesData = {};
      const missingFilesList = [];
      
      // Vérifier chaque table GTFS
      for (const [fileName, tableName] of Object.entries(GTFS_FILES)) {
        const { count: rowCount, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('network_id', networkId);
          
        if (error) {
          console.error(`Erreur lors de la vérification de ${tableName}:`, error);
          tablesData[tableName] = { exists: false, count: 0 };
          missingFilesList.push(fileName);
        } else {
          // rowCount should be a number (0 or more) if the query is successful.
          // If there was an issue that didn't throw an error but resulted in no count, 
          // rowCount might be null, so we default to 0.
          const currentCount = rowCount === null ? 0 : rowCount;
          tablesData[tableName] = { exists: currentCount > 0, count: currentCount };
          if (currentCount === 0) {
            missingFilesList.push(fileName);
          }
        }
      }
      
      setExistingTables(tablesData);
      setMissingFiles(missingFilesList);
      
      // Également mettre à jour uploadedFiles en fonction des tables existantes
      const uploadedFilesList = [];
      Object.entries(GTFS_FILES).forEach(([fileName, tableName]) => {
        if (tablesData[tableName]?.exists) {
          uploadedFilesList.push(fileName);
        }
      });
      setUploadedFiles(uploadedFilesList);
      
    } catch (err) {
      console.error('Erreur lors de la vérification des tables:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNetworks = async () => {
    try {
      const { data, error } = await supabase
        .from('networks')
        .select('*')
        .order('network_name');

      if (error) throw error;
      setNetworks(data || []);
    } catch (err) {
      console.error('Error fetching networks:', err);
      setError('Erreur lors du chargement des réseaux');
    }
  };

  // Ajouter une fonction pour supprimer des données par lots
  const deleteDataInBatches = async (table, networkId, batchSize = 50) => {
    let hasMore = true;
    let totalDeleted = 0;
    
    // Définir les clés primaires pour chaque table
    const primaryKeys = {
      'stops': 'stop_id',
      'stop_times': ['trip_id', 'stop_sequence'],
      'trips': 'trip_id',
      'routes': 'route_id',
      'calendar': 'service_id',
      'calendar_dates': ['service_id', 'date'],
      'agency': 'agency_id',
      'shapes': ['shape_id', 'shape_pt_sequence'],
      'transfers': ['from_stop_id', 'to_stop_id']
    };
    
    // Vérifier si une clé primaire est définie pour cette table
    if (!primaryKeys[table]) {
      console.warn(`Pas de clé primaire définie pour ${table}, impossible de supprimer par lots`);
      return 0;
    }
    
    const keyField = primaryKeys[table];
    const isCompositeKey = Array.isArray(keyField);
    
    try {
      console.log(`Début de la suppression par lots pour ${table}...`);
      
      // Si c'est une clé composite, utiliser une stratégie différente
      if (isCompositeKey) {
        // Pour les tables avec clés composites, on fait juste une suppression directe
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('network_id', networkId);
          
        if (error) {
          console.warn(`Erreur lors de la suppression groupée de ${table}:`, error);
          return 0;
        }
        
        // On estime le nombre de lignes supprimées à 1 (juste pour indiquer que c'est fait)
        console.log(`Suppression groupée effectuée pour ${table}`);
        return 1;
      }
      
      // Pour les tables avec clé simple
      while (hasMore) {
        try {
          // 1. Récupérer un lot de clés primaires
          const { data, error } = await supabase
            .from(table)
            .select(keyField)
            .eq('network_id', networkId)
            .limit(batchSize);
            
          if (error) {
            console.warn(`Erreur lors de la récupération d'un lot de ${table}:`, error);
            return totalDeleted;
          }
          
          if (!data || data.length === 0) {
            hasMore = false;
            break;
          }
          
          // 2. Extraire les valeurs des clés primaires
          const keys = data.map(item => item[keyField]);
          
          // 3. Supprimer ce lot via la clause in
          const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .in(keyField, keys)
            .eq('network_id', networkId);
            
          if (deleteError) {
            console.warn(`Erreur lors de la suppression du lot de ${table}:`, deleteError);
            
            // Si erreur, essayer la suppression un par un
            for (const key of keys) {
              try {
                await supabase
                  .from(table)
                  .delete()
                  .eq(keyField, key)
                  .eq('network_id', networkId);
                  
                totalDeleted++;
              } catch (err) {
                // Ignorer les erreurs individuelles
              }
            }
          } else {
            totalDeleted += keys.length;
            console.log(`${keys.length} éléments supprimés dans ${table} (total: ${totalDeleted})`);
          }
          
          // Court délai entre les lots pour éviter la surcharge
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.error(`Erreur lors de la suppression par lots pour ${table}:`, err);
          hasMore = false;
        }
      }
      
      return totalDeleted;
    } catch (error) {
      console.error(`Erreur générale pour ${table}:`, error);
      return totalDeleted;
    }
  };

  const deleteNetwork = async () => {
    if (!selectedNetwork) return;

    setLoading(true);
    setError(null);
    setDeletionProgress(0);
    setDeletingCurrentTable('');
    setDeletedRowCount(0);
    setEstimatedRowCount(0);
    
    try {
      // Configurer un timeout plus long (info seulement)
      await setStatementTimeout();
      
      const networkId = selectedNetwork.network_id;
      console.log(`Attempting to delete network ${networkId}...`);
      
      // L'ordre des tables à supprimer (des plus dépendantes aux moins dépendantes)
      const deletionOrder = [
        'stop_times',
        'transfers',
        'trips',
        'stops',
        'shapes', 
        'routes',
        'calendar_dates',
        'calendar',
        'agency'
      ];
      
      // PHASE 1: Supprimer d'abord les tables de favoris utilisateurs
      setDeletingCurrentTable('Suppression des favoris...');
      setDeletionProgress(5);
      
      const userTables = ['favorite_lines', 'favorite_stops', 'favorite_networks'];
      for (const table of userTables) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('network_id', networkId);
            
          if (error) {
            console.warn(`Warning: Error clearing ${table}:`, error);
          } else {
            console.log(`Successfully cleared ${table}`);
          }
        } catch (err) {
          console.warn(`Error with ${table}:`, err);
        }
      }
      
      setDeletionProgress(15);
      
      // PHASE 2: Supprimer toutes les tables liées au réseau
      let progress = 15;
      const progressIncrement = 60 / deletionOrder.length;
      
      for (const table of deletionOrder) {
        setDeletingCurrentTable(`Suppression de ${table}...`);
        const deleted = await deleteDataInBatches(table, networkId, 150);
        console.log(`Terminé: ${deleted} lignes supprimées dans ${table}`);
        progress += progressIncrement;
        setDeletionProgress(Math.min(75, Math.round(progress)));
        
        // Pause après chaque table pour laisser les contraintes se résoudre
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // PHASE 3: Tentative directe sur les tables problématiques
      setDeletingCurrentTable('Vérifications finales...');
      setDeletionProgress(80);
      
      // Tenter une suppression directe des stops (souvent problématique)
      try {
        const { error } = await supabase.from('stops').delete().eq('network_id', networkId);
        if (!error) {
          console.log('Suppression finale des stops réussie');
        }
      } catch (e) {
        console.warn('Erreur lors de la suppression directe des stops:', e);
      }
      
      // Petit délai de sécurité
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // PHASE 4: Tentative finale de suppression du réseau
      setDeletingCurrentTable('Suppression du réseau...');
      setDeletionProgress(90);
      
      try {
        const { error } = await supabase
          .from('networks')
          .delete()
          .eq('network_id', networkId);
          
        if (error) {
          console.error('Error deleting network:', error);
          
          if (error.code === '23503') {
            // Tentative d'identification de la table bloquante
            const match = error.details?.match(/table "([^"]+)"/);
            const blockingTable = match ? match[1] : 'unknown';
            
            // Message spécifique pour les stops
            if (blockingTable === 'stops') {
              throw new Error(
                "La suppression du réseau a échoué car des arrêts (stops) sont encore référencés. " +
                "Les autres données ont été supprimées. Contactez l'administrateur pour une suppression complète."
              );
            } else {
              throw new Error(`Le réseau n'a pas pu être supprimé car des données dans "${blockingTable}" y font encore référence.`);
            }
          } else {
            throw new Error(`Impossible de supprimer le réseau: ${error.message}`);
          }
        } else {
          console.log('Network deleted successfully');
        }
      } catch (err) {
        console.error('Final error:', err);
        throw err;
      }
      
      setDeletionProgress(100);
      
      // Succès
      setSuccess(true);
      setDeleteConfirmation(false);
      setSelectedNetwork(null);
      await fetchNetworks();
      
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error deleting network:', err);
      setError(err.message || "Une erreur est survenue lors de la suppression du réseau");
    } finally {
      setLoading(false);
      setDeletingCurrentTable('');
    }
  };

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    const txtFiles = selectedFiles.filter(file => 
      file.name.endsWith('.txt') && GTFS_FILES[file.name]
    );
    setFiles(txtFiles);
  };

  // Function to reset everything
  const handleReset = () => {
    setNetworkConfigured(false);
    setUploadedFiles([]);
    setFiles([]);
    setSuccess(false);
    setError(null);
    setMissingFiles([]);
    setExistingTables({});
    
    // Supprimer les informations sauvegardées
    localStorage.removeItem('gtfsUploadNetworkInfo');
  };

  // Function to check if network info is valid
  const isNetworkInfoValid = () => {
    if (useExistingNetwork) {
      return !!existingNetworkId;
    } else {
      return networkName.trim() !== '' && networkId.trim() !== '';
    }
  };

  // Function to handle network configuration
  const handleNetworkConfiguration = () => {
    if (!isNetworkInfoValid()) {
      setError(useExistingNetwork 
        ? 'Veuillez sélectionner un réseau existant' 
        : 'Veuillez fournir un nom et un ID pour le réseau');
      return false;
    }
    
    setNetworkConfigured(true);
    
    // Sauvegarder les informations du réseau dans localStorage
    const networkInfo = {
      networkConfigured: true,
      useExistingNetwork,
      networkId,
      networkName,
      existingNetworkId,
      subnetworkName,
      realtimeType,
      realtimeUrl,
      realtimeApiKey,
      uploadedFiles
    };
    localStorage.setItem('gtfsUploadNetworkInfo', JSON.stringify(networkInfo));
    
    // Si on utilise un réseau existant, vérifier les tables existantes
    if (useExistingNetwork && existingNetworkId) {
      checkExistingTables(existingNetworkId);
    }
    
    return true;
  };

  // Fonction pour nettoyer et filtrer les données GTFS
  const cleanData = (data, tableName, networkId) => {
    const validColumns = VALID_GTFS_COLUMNS[tableName] || [];
    if (!validColumns.length) {
      console.warn(`Aucune colonne GTFS valide définie pour la table ${tableName}`);
      // Retourner les données telles quelles si aucune colonne n'est définie pour éviter de tout supprimer
      // Ou décider d'une autre stratégie, par exemple, ne rien retourner.
      // Pour l'instant, on retourne les données en ajoutant juste network_id pour les tables inconnues
      return data.map(row => ({ ...row, network_id: networkId }));
    }
  
    return data.map(row => {
      const filteredRow = {};
  
      // 1. Filtrer pour ne garder que les colonnes GTFS valides définies
      for (const key in row) {
        // Garder la clé si elle est dans les colonnes GTFS valides pour cette table
        if (validColumns.includes(key)) {
          filteredRow[key] = row[key];
        } 
        // Optionnel: Logguer les colonnes ignorées si besoin de débogage
        // else {
        //   console.log(`Colonne ignorée pour ${tableName}: ${key}`);
        // }
      }
  
      // 2. Ajouter network_id (toujours requis)
      filteredRow.network_id = networkId;
  
      // 3. Gérer les colonnes spécifiques au script (subnetwork, etc.)
      //    Ces colonnes doivent être présentes dans la DB ou gérées lors de l'erreur d'insertion
      try {
        if (subnetworkName) {
          filteredRow.subnetwork_name = subnetworkName;
  
          if (realtimeType || realtimeUrl || realtimeApiKey) {
            const metadata = {
              name: subnetworkName,
              realtime: {}
            };
            if (realtimeType) metadata.realtime.type = realtimeType;
            if (realtimeUrl) metadata.realtime.url = realtimeUrl;
            if (realtimeApiKey) metadata.realtime.api_key = realtimeApiKey;
            if (Object.keys(metadata.realtime).length === 0) {
              delete metadata.realtime;
            }
            // Ajouter seulement si l'objet metadata n'est pas vide
            if (Object.keys(metadata).length > 1 || metadata.name) { 
              filteredRow.subnetwork_metadata = metadata;
            }
          }
        }
        
        // Ajouter les colonnes _original_* si elles existent dans la ligne originale (utilisé pour routes/agency)
        if ('_original_agency_id' in row) {
          filteredRow._original_agency_id = row._original_agency_id;
        }
        if ('_original_route_id' in row) {
          filteredRow._original_route_id = row._original_route_id;
        }
      } catch (e) {
        console.warn(`Avertissement: Impossible d'ajouter les métadonnées de sous-réseau/colonnes spéciales: ${e.message}`);
        // Assurer la suppression si l'ajout échoue
        delete filteredRow.subnetwork_name;
        delete filteredRow.subnetwork_metadata;
      }
  
      // 4. Nettoyer les types (numérique, booléen, coords) sur les colonnes restantes dans filteredRow
      // Appliquer le nettoyage uniquement sur les colonnes qui existent dans filteredRow
      if (NUMERIC_FIELDS[tableName]) {
        NUMERIC_FIELDS[tableName].forEach(field => {
          if (field in filteredRow) { // Vérifier si le champ existe après filtrage
            const value = filteredRow[field];
            if (value === '' || value === null || value === undefined) {
              filteredRow[field] = null;
            } else {
              const numValue = Number(value);
              filteredRow[field] = isNaN(numValue) ? null : numValue;
            }
          }
        });
      }
  
      if (BOOLEAN_FIELDS[tableName]) {
        BOOLEAN_FIELDS[tableName].forEach(field => {
          if (field in filteredRow) { // Vérifier si le champ existe après filtrage
            const value = filteredRow[field];
            // Conversion plus robuste en booléen (0 -> false, 1 -> true)
            filteredRow[field] = value === '1' || value === 1 || String(value).toLowerCase() === 'true';
          }
        });
      }
  
      // Nettoyer les coordonnées géographiques (si présentes)
      ['stop_lat', 'stop_lon', 'shape_pt_lat', 'shape_pt_lon'].forEach(field => {
        if (field in filteredRow) { // Vérifier si le champ existe après filtrage
          const value = filteredRow[field];
          if (value === '' || value === null || value === undefined) {
            filteredRow[field] = null;
          } else {
            // Utiliser parseFloat pour les coordonnées
            const numValue = parseFloat(value);
            filteredRow[field] = isNaN(numValue) ? null : numValue;
          }
        }
      });
  
      // 5. Retourner la ligne filtrée et nettoyée
      return filteredRow;
    });
  };

  // Fonction pour traiter un fichier GTFS
  const processGTFSFile = async (file, tableName, networkId) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            if (results.data.length === 0) {
              console.warn(`No data found in ${file.name}`);
              resolve();
              return;
            }

            setCurrentFile(`Processing ${file.name}...`);

            // Nettoyer et FILTRER les données
            const cleanedFilteredData = cleanData(results.data, tableName, networkId);
            
            if (cleanedFilteredData.length === 0 && results.data.length > 0) {
              console.warn(`Toutes les données pour ${file.name} ont été filtrées.`);
              resolve(); // Ne rien faire si tout est filtré
              return;
            } else if (cleanedFilteredData.length === 0) {
              console.warn(`Aucune donnée valide à traiter pour ${file.name}`);
              resolve();
              return;
            }

            // Insérer les données par lots de 1000 lignes
            const batchSize = 1000;
            for (let i = 0; i < cleanedFilteredData.length; i += batchSize) {
              const batch = cleanedFilteredData.slice(i, i + batchSize);
              
              try {
                const { error } = await supabase
                  .from(tableName)
                  .upsert(batch);

                if (error) {
                  // Si l'erreur est liée aux colonnes subnetwork_*, tenter une insertion sans ces champs
                  if (error.message && (error.message.includes('subnetwork_name') || error.message.includes('subnetwork_metadata'))) {
                    console.warn(`Avertissement: Les colonnes de sous-réseau n'existent pas encore ou problème détecté, tentative sans ces champs.`);
                    console.info('Vérifiez/exécutez la migration: supabase/migrations/20240513_add_subnetwork_columns_to_gtfs_tables.sql');
                    
                    // Supprimer les champs problématiques de tous les éléments du lot
                    const cleanedBatch = batch.map(item => {
                      const newItem = { ...item };
                      delete newItem.subnetwork_name;
                      delete newItem.subnetwork_metadata;
                      return newItem;
                    });
                    
                    // Tenter à nouveau l'insertion sans les champs de sous-réseau
                    const { error: retryError } = await supabase.from(tableName).upsert(cleanedBatch);
                    
                    if (retryError) {
                      // Si l'erreur persiste et concerne une contrainte de clé étrangère
                      if (retryError.message && retryError.message.includes('routes_agency_id_network_id_fkey')) {
                        console.error(`Erreur de contrainte de clé étrangère pour agency_id.`);
                        
                        // Résoudre ce problème en récupérant à nouveau tous les agency_id valides
                        const { data: validAgencies } = await supabase
                          .from('agency')
                          .select('agency_id')
                          .eq('network_id', networkId);
                          
                        if (validAgencies && validAgencies.length > 0) {
                          // Utiliser le premier agency_id valide comme solution de secours
                          const validAgencyId = validAgencies[0].agency_id;
                          
                          // Mettre à jour tous les éléments du lot avec cet agency_id valide
                          const fixedBatch = cleanedBatch.map(item => ({
                            ...item,
                            agency_id: validAgencyId
                          }));
                          
                          // Tenter l'insertion une dernière fois
                          const { error: lastError } = await supabase.from(tableName).upsert(fixedBatch);
                          
                          if (lastError) {
                            console.error(`Échec de la dernière tentative d'insertion:`, lastError);
                            throw lastError;
                          } else {
                            console.log(`Insertion réussie avec l'agency_id de secours: ${validAgencyId}`);
                          }
                        } else {
                          console.error(`Impossible de trouver un agency_id valide.`);
                          throw retryError;
                        }
                      } else {
                        console.error(`Error inserting batch in ${tableName} (retry attempt):`, retryError);
                        throw retryError;
                      }
                    }
                  } else if (error.message && error.message.includes('routes_agency_id_network_id_fkey')) {
                    // Gestion spécifique de l'erreur de contrainte de clé étrangère
                    console.error(`Erreur de contrainte de clé étrangère pour agency_id.`);
                    
                    // Résoudre ce problème en récupérant à nouveau tous les agency_id valides
                    const { data: validAgencies } = await supabase
                      .from('agency')
                      .select('agency_id')
                      .eq('network_id', networkId);
                      
                    if (validAgencies && validAgencies.length > 0) {
                      // Utiliser le premier agency_id valide comme solution de secours
                      const validAgencyId = validAgencies[0].agency_id;
                      
                      // Mettre à jour tous les éléments du lot avec cet agency_id valide
                      const fixedBatch = batch.map(item => ({
                        ...item,
                        agency_id: validAgencyId
                      }));
                      
                      // Tenter l'insertion une dernière fois
                      const { error: lastError } = await supabase.from(tableName).upsert(fixedBatch);
                      
                      if (lastError) {
                        console.error(`Échec de la dernière tentative d'insertion:`, lastError);
                        throw lastError;
                      } else {
                        console.log(`Insertion réussie avec l'agency_id de secours: ${validAgencyId}`);
                      }
                    } else {
                      console.error(`Impossible de trouver un agency_id valide.`);
                      throw error;
                    }
                  } else {
                    console.error(`Error inserting batch in ${tableName}:`, error);
                    throw error;
                  }
                }
              } catch (error) {
                console.error(`Error processing batch for ${tableName}:`, error);
                throw error;
              }
            }

            resolve();
          } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            reject(error);
          }
        },
        error: (error) => {
          console.error(`Error parsing ${file.name}:`, error);
          reject(error);
        }
      });
    });
  };

  // Fonction pour traiter les fichiers routes.txt avec les agency_id mappés
  const processGTFSFileWithMappedAgencyIds = async (file, tableName, networkId) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            if (results.data.length === 0) {
              console.warn(`No data found in ${file.name}`);
              resolve();
              return;
            }

            setCurrentFile(`Processing ${file.name} with mapped agency IDs...`);

            // Nettoyer et FILTRER les données avant de mapper les IDs
            const cleanedFilteredData = cleanData(results.data, tableName, networkId);

            if (cleanedFilteredData.length === 0 && results.data.length > 0) {
              console.warn(`Toutes les données pour ${file.name} (avec mapping) ont été filtrées.`);
              resolve(); // Ne rien faire si tout est filtré
              return;
            } else if (cleanedFilteredData.length === 0) {
              console.warn(`Aucune donnée valide à traiter pour ${file.name} (avec mapping)`);
              resolve();
              return;
            }

            // Récupérer tous les agency_id disponibles dans la base de données pour ce réseau
            const { data: availableAgencies, error: agencyError } = await supabase
              .from('agency')
              .select('agency_id')
              .eq('network_id', networkId);

            if (agencyError) {
              console.warn(`Erreur lors de la récupération des agency_id disponibles:`, agencyError);
            }

            // Créer un ensemble des agency_id disponibles pour faciliter la recherche
            const availableAgencyIds = new Set();
            if (availableAgencies) {
              availableAgencies.forEach(agency => availableAgencyIds.add(agency.agency_id));
            }

            // Mettre à jour les references agency_id avec les nouveaux IDs mappés DANS les données déjà filtrées/nettoyées
            for (const row of cleanedFilteredData) {
              // Si l'agency_id a un mapping ET que la colonne existe dans la ligne filtrée, l'appliquer
              if (row.agency_id && agencyIdMapping[row.agency_id]) {
                const mappedId = agencyIdMapping[row.agency_id];
                console.log(`Mapping agency_id ${row.agency_id} to ${mappedId}`);
                row.agency_id = mappedId;
              }
              
              // Vérifier si l'agency_id existe dans la base de données
              if (row.agency_id && availableAgencyIds.size > 0 && !availableAgencyIds.has(row.agency_id)) {
                console.warn(`Attention: agency_id "${row.agency_id}" non trouvé dans la table agency.`);
                
                // Essayer de trouver un agency_id qui pourrait correspondre (avec le même préfixe avant un underscore)
                const baseAgencyId = row.agency_id.split('_')[0];
                let matchFound = false;
                
                // Parcourir les agency_id disponibles pour trouver une correspondance
                for (const availableId of availableAgencyIds) {
                  if (availableId.startsWith(baseAgencyId + '_') || availableId === baseAgencyId) {
                    console.log(`Correspondance trouvée: utilisation de ${availableId} au lieu de ${row.agency_id}`);
                    row.agency_id = availableId;
                    matchFound = true;
                    break;
                  }
                }
                
                // Si aucune correspondance n'est trouvée, nous pourrions rencontrer une erreur de clé étrangère
                if (!matchFound) {
                  console.warn(`ERREUR POTENTIELLE: Aucune correspondance trouvée pour ${row.agency_id}`);
                  
                  // Si nous avons au moins une agence, utiliser la première comme solution de secours
                  if (availableAgencyIds.size > 0) {
                    const firstAgencyId = Array.from(availableAgencyIds)[0];
                    console.log(`Solution de secours: utilisation de ${firstAgencyId} au lieu de ${row.agency_id}`);
                    row.agency_id = firstAgencyId;
                  }
                }
              }
              
              // Si on a un sous-réseau défini, on peut aussi ajouter un suffixe aux route_id pour éviter les conflits
              if (subnetworkName && tableName === 'routes' && row.route_id) {
                // Vérifier si cette route existe déjà pour ce réseau
                const { data, error } = await supabase
                  .from('routes')
                  .select('route_id')
                  .eq('network_id', networkId)
                  .eq('route_id', row.route_id);
                
                if (data && data.length > 0) {
                  // Si la route existe déjà, on ajoute un suffixe
                  const newRouteId = `${row.route_id}_${subnetworkName.replace(/\s+/g, '_')}`;
                  row._original_route_id = row.route_id; // Garder une trace de l'ID original
                  row.route_id = newRouteId;
                }
              }
            }

            // Insérer les données par lots de 1000 lignes
            const batchSize = 1000;
            for (let i = 0; i < cleanedFilteredData.length; i += batchSize) {
              const batch = cleanedFilteredData.slice(i, i + batchSize);
              
              try {
                const { error } = await supabase
                  .from(tableName)
                  .upsert(batch);

                if (error) {
                  // Si l'erreur est liée aux colonnes subnetwork_*, tenter une insertion sans ces champs
                  if (error.message && (error.message.includes('subnetwork_name') || error.message.includes('subnetwork_metadata'))) {
                    console.warn(`Avertissement: Les colonnes de sous-réseau n'existent pas encore ou problème détecté, tentative sans ces champs (dans processGTFSFileWithMappedAgencyIds).`);
                    console.info('Vérifiez/exécutez la migration: supabase/migrations/20240513_add_subnetwork_columns_to_gtfs_tables.sql');
                    
                    // Supprimer les champs problématiques de tous les éléments du lot
                    const cleanedBatch = batch.map(item => {
                      const newItem = { ...item };
                      delete newItem.subnetwork_name;
                      delete newItem.subnetwork_metadata;
                      return newItem;
                    });
                    
                    // Tenter à nouveau l'insertion sans les champs de sous-réseau
                    const { error: retryError } = await supabase.from(tableName).upsert(cleanedBatch);
                    
                    if (retryError) {
                      // Si l'erreur persiste et concerne une contrainte de clé étrangère
                      if (retryError.message && retryError.message.includes('routes_agency_id_network_id_fkey')) {
                        console.error(`Erreur de contrainte de clé étrangère pour agency_id.`);
                        
                        // Résoudre ce problème en récupérant à nouveau tous les agency_id valides
                        const { data: validAgencies } = await supabase
                          .from('agency')
                          .select('agency_id')
                          .eq('network_id', networkId);
                          
                        if (validAgencies && validAgencies.length > 0) {
                          // Utiliser le premier agency_id valide comme solution de secours
                          const validAgencyId = validAgencies[0].agency_id;
                          
                          // Mettre à jour tous les éléments du lot avec cet agency_id valide
                          const fixedBatch = cleanedBatch.map(item => ({
                            ...item,
                            agency_id: validAgencyId
                          }));
                          
                          // Tenter l'insertion une dernière fois
                          const { error: lastError } = await supabase.from(tableName).upsert(fixedBatch);
                          
                          if (lastError) {
                            console.error(`Échec de la dernière tentative d'insertion:`, lastError);
                            throw lastError;
                          } else {
                            console.log(`Insertion réussie avec l'agency_id de secours: ${validAgencyId}`);
                          }
                        } else {
                          console.error(`Impossible de trouver un agency_id valide.`);
                          throw retryError;
                        }
                      } else {
                        console.error(`Error inserting batch in ${tableName} (retry attempt):`, retryError);
                        throw retryError;
                      }
                    }
                  } else if (error.message && error.message.includes('routes_agency_id_network_id_fkey')) {
                    // Gestion spécifique de l'erreur de contrainte de clé étrangère
                    console.error(`Erreur de contrainte de clé étrangère pour agency_id.`);
                    
                    // Résoudre ce problème en récupérant à nouveau tous les agency_id valides
                    const { data: validAgencies } = await supabase
                      .from('agency')
                      .select('agency_id')
                      .eq('network_id', networkId);
                      
                    if (validAgencies && validAgencies.length > 0) {
                      // Utiliser le premier agency_id valide comme solution de secours
                      const validAgencyId = validAgencies[0].agency_id;
                      
                      // Mettre à jour tous les éléments du lot avec cet agency_id valide
                      const fixedBatch = batch.map(item => ({
                        ...item,
                        agency_id: validAgencyId
                      }));
                      
                      // Tenter l'insertion une dernière fois
                      const { error: lastError } = await supabase.from(tableName).upsert(fixedBatch);
                      
                      if (lastError) {
                        console.error(`Échec de la dernière tentative d'insertion:`, lastError);
                        throw lastError;
                      } else {
                        console.log(`Insertion réussie avec l'agency_id de secours: ${validAgencyId}`);
                      }
                    } else {
                      console.error(`Impossible de trouver un agency_id valide.`);
                      throw error;
                    }
                  } else {
                    console.error(`Error inserting batch in ${tableName}:`, error);
                    throw error;
                  }
                }
              } catch (error) {
                console.error(`Error processing batch for ${tableName}:`, error);
                throw error;
              }
            }

            resolve();
          } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            reject(error);
          }
        },
        error: (error) => {
          console.error(`Error parsing ${file.name}:`, error);
          reject(error);
        }
      });
    });
  };

  const handleUpload = async () => {
    // If network isn't configured yet, configure it first
    if (!networkConfigured) {
      if (!handleNetworkConfiguration()) {
        return;
      }
    }

    if (files.length === 0) {
      setError('Veuillez sélectionner des fichiers GTFS (.txt)');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setIsProcessing(true);
    setProgress(0);
    // Réinitialiser le mapping des agency_id
    setAgencyIdMapping({});

    // Déterminer l'ID du réseau à utiliser
    let targetNetworkId = useExistingNetwork ? existingNetworkId : networkId;

    // Préparer les métadonnées du sous-réseau si défini
    let subnetworkMetadata = null;
    if (subnetworkName) {
      subnetworkMetadata = {
        name: subnetworkName,
        // Ajouter les informations de temps réel si définies
        realtime: {}
      };
      
      if (realtimeType) {
        subnetworkMetadata.realtime.type = realtimeType;
      }
      
      if (realtimeUrl) {
        subnetworkMetadata.realtime.url = realtimeUrl;
      }
      
      if (realtimeApiKey) {
        subnetworkMetadata.realtime.api_key = realtimeApiKey;
      }
      
      // Si aucune information de temps réel n'est fournie, supprimer l'objet vide
      if (Object.keys(subnetworkMetadata.realtime).length === 0) {
        delete subnetworkMetadata.realtime;
      }
    }

    try {
      // Create network only if this is the first upload and we're not using an existing network
      if (!useExistingNetwork && uploadedFiles.length === 0) {
        // Préparer les métadonnées du réseau
        const networkData = {
          network_id: targetNetworkId,
          network_name: networkName
        };
        
        // Si un sous-réseau est défini, l'ajouter aux métadonnées
        // NOTE: Vérifier d'abord si la colonne subnetworks existe, sinon éviter de l'utiliser
        // Nous stockerons ces informations dans la colonne une fois qu'elle sera créée
        if (subnetworkMetadata) {
          try {
            // Tester si la colonne subnetworks existe en insérant un réseau fictif
            const testName = `test_${Date.now()}`;
            const { error: testError } = await supabase
              .from('networks')
              .insert([{
                network_id: testName,
                network_name: testName,
                subnetworks: [subnetworkMetadata]
              }]);
              
            // Si l'insertion a réussi, supprimer ce réseau de test
            if (!testError) {
              networkData.subnetworks = [subnetworkMetadata];
              await supabase.from('networks').delete().eq('network_id', testName);
            } else if (testError.message.includes('subnetworks')) {
              // Si l'erreur concerne la colonne subnetworks, elle n'existe pas encore
              console.warn('La colonne subnetworks n\'existe pas encore, les métadonnées de sous-réseau ne seront pas stockées.');
              console.info('Veuillez exécuter la migration pour ajouter cette colonne: supabase/migrations/20240513_add_subnetworks_column.sql');
            } else {
              // Une autre erreur est survenue lors du test
              throw testError;
            }
          } catch (testError) {
            console.warn('Erreur lors du test de la colonne subnetworks:', testError);
          }
        }
        
        const { error: networkError } = await supabase
          .from('networks')
          .insert([networkData]);

        if (networkError) throw networkError;
      } else if (subnetworkMetadata) {
        // Si on utilise un réseau existant et qu'on a défini un sous-réseau,
        // on doit mettre à jour les métadonnées du réseau si la colonne existe
        
        try {
          // D'abord, récupérer les informations actuelles du réseau
          const { data: networkData, error: fetchError } = await supabase
            .from('networks')
            .select('*')
            .eq('network_id', targetNetworkId)
            .single();
            
          if (fetchError) {
            console.warn('Erreur lors de la récupération des informations du réseau:', fetchError);
          } else if (networkData) {
            // Vérifier si la colonne subnetworks existe dans les données récupérées
            if ('subnetworks' in networkData) {
              // Préparer les métadonnées mises à jour
              let updatedSubnetworks = networkData.subnetworks || [];
              
              // Vérifier si le tableau existe
              if (Array.isArray(updatedSubnetworks)) {
                // Vérifier si ce sous-réseau existe déjà par nom
                const existingIndex = updatedSubnetworks.findIndex(
                  sn => sn.name === subnetworkMetadata.name
                );
                
                if (existingIndex >= 0) {
                  // Mettre à jour le sous-réseau existant
                  updatedSubnetworks[existingIndex] = {
                    ...updatedSubnetworks[existingIndex],
                    ...subnetworkMetadata
                  };
                } else {
                  // Ajouter le nouveau sous-réseau
                  updatedSubnetworks.push(subnetworkMetadata);
                }
              } else {
                // Si le champ existe mais n'est pas un tableau, le remplacer
                updatedSubnetworks = [subnetworkMetadata];
              }
              
              // Mettre à jour les métadonnées du réseau
              const { error: updateError } = await supabase
                .from('networks')
                .update({ subnetworks: updatedSubnetworks })
                .eq('network_id', targetNetworkId);
                
              if (updateError) {
                console.warn('Erreur lors de la mise à jour des métadonnées du réseau:', updateError);
              }
            } else {
              console.warn('La colonne subnetworks n\'existe pas encore, les métadonnées de sous-réseau ne seront pas stockées.');
              console.info('Veuillez exécuter la migration pour ajouter cette colonne: supabase/migrations/20240513_add_subnetworks_column.sql');
            }
          }
        } catch (subnetworkError) {
          console.warn('Erreur lors de la mise à jour des métadonnées de sous-réseau:', subnetworkError);
          // Ne pas bloquer l'importation si la mise à jour des métadonnées échoue
        }
      }

      // Définir l'ordre de traitement des fichiers GTFS pour respecter les dépendances
      // IMPORTANT: agency.txt doit être traité en premier pour que les références soient correctes
      const processingOrder = [
        'agency.txt',    // Traiter agency en premier (CRUCIAL)
        'stops.txt',     // Puis stops
        'calendar.txt',  // Puis calendar
        'routes.txt',    // Puis routes (qui dépend de agency)
        'shapes.txt',    // Puis shapes
        'trips.txt',     // Puis trips (qui dépend de routes)
        'stop_times.txt', // Puis stop_times (qui dépend de trips et stops)
        'calendar_dates.txt', // Puis calendar_dates
        'transfers.txt'  // Et enfin transfers
      ];

      // Vérifier si on est en mode individuel et que agency.txt n'est pas encore traité
      if (uploadMode === 'individual' && !uploadedFiles.includes('agency.txt') && !files.some(f => f.name === 'agency.txt')) {
        // Vérifier si on a agency.txt dans les fichiers actuels
        const agencyFile = files.find(file => file.name === 'agency.txt');
        if (!agencyFile) {
          // Vérifier si agency existe déjà pour ce réseau
          const { data: existingAgency } = await supabase
            .from('agency')
            .select('agency_id')
            .eq('network_id', targetNetworkId)
            .limit(1);
            
          if (!existingAgency || existingAgency.length === 0) {
            throw new Error('Pour commencer, vous devez d\'abord importer le fichier agency.txt.');
          }
        }
      }

      // Organiser les fichiers selon l'ordre de traitement
      const orderedFiles = [];
      processingOrder.forEach(fileName => {
        const matchedFile = files.find(file => file.name === fileName);
        if (matchedFile) {
          orderedFiles.push(matchedFile);
        }
      });

      // Ajouter les fichiers qui ne sont pas dans l'ordre prédéfini
      files.forEach(file => {
        if (!orderedFiles.includes(file)) {
          orderedFiles.push(file);
        }
      });

      // Process each GTFS file in the specific order
      for (let i = 0; i < orderedFiles.length; i++) {
        const file = orderedFiles[i];
        const tableName = GTFS_FILES[file.name];
        
        if (!tableName) continue;

        // Si c'est le fichier routes.txt et qu'on a des mappings d'agency_id, il faut mettre à jour les références
        if (tableName === 'routes' && Object.keys(agencyIdMapping).length > 0) {
          await processGTFSFileWithMappedAgencyIds(file, tableName, targetNetworkId);
        } else {
          await processGTFSFile(file, tableName, targetNetworkId);
        }
        
        // Add to uploaded files
        if (!uploadedFiles.includes(file.name)) {
          const newUploadedFiles = [...uploadedFiles, file.name];
          setUploadedFiles(newUploadedFiles);
          
          // Mettre à jour les informations sauvegardées
          const savedNetworkInfo = localStorage.getItem('gtfsUploadNetworkInfo');
          if (savedNetworkInfo) {
            try {
              const networkInfo = JSON.parse(savedNetworkInfo);
              networkInfo.uploadedFiles = newUploadedFiles;
              localStorage.setItem('gtfsUploadNetworkInfo', JSON.stringify(networkInfo));
            } catch (e) {
              console.error('Erreur lors de la mise à jour des données:', e);
            }
          }
          
          // Mettre à jour les fichiers manquants
          setMissingFiles(prev => prev.filter(f => f !== file.name));
        }
        
        setProgress(((i + 1) / orderedFiles.length) * 100);
      }

      // Après traitement, vérifier à nouveau les tables existantes
      const targetId = useExistingNetwork ? existingNetworkId : networkId;
      await checkExistingTables(targetId);
      
      setSuccess(true);
      // Clear file selection for next upload
      setFiles([]);
      
      if (uploadMode === 'directory') {
        // If directory mode, redirect after success
        setTimeout(() => {
          navigate('/admin');
        }, 2000);
      } else {
        // Individual mode - clear success message after a moment
        setTimeout(() => {
          setSuccess(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsProcessing(false);
      setCurrentFile('');
    }
  };

  // Function to delete data for a specific table
  const handleDeleteTableData = async () => {
    if (!tableToDelete || (!existingNetworkId && !networkId)) {
      setError("Aucune table ou réseau sélectionné pour la suppression.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    const targetNetworkId = useExistingNetwork ? existingNetworkId : networkId;

    try {
      // Set a longer statement timeout for potentially large delete operations
      await setStatementTimeout(); 

      console.log(`Tentative de suppression des données de la table '${tableToDelete}' pour le network_id '${targetNetworkId}'`);

      const { error: deleteError } = await supabase
        .from(tableToDelete)
        .delete()
        .eq('network_id', targetNetworkId);

      if (deleteError) {
        console.error(`Erreur lors de la suppression des données de la table ${tableToDelete}:`, deleteError);
        throw new Error(`Impossible de supprimer les données de ${tableFileNameToDelete}: ${deleteError.message}`);
      }

      console.log(`Données de la table '${tableToDelete}' supprimées avec succès pour le network_id '${targetNetworkId}'`);
      setSuccess(`Les données du fichier ${tableFileNameToDelete} ont été supprimées avec succès.`);
      
      // Reset modal state
      setShowDeleteTableModal(false);
      setTableToDelete(null);
      setTableFileNameToDelete(null);

      // Refresh the list of existing tables for the current network
      await checkExistingTables(targetNetworkId);
      
      // Clear success message after a few seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('Erreur lors de la suppression des données de la table:', err);
      setError(err.message || "Une erreur est survenue lors de la suppression des données.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Import GTFS Data</h1>
            <button
              onClick={() => setShowManageNetworks(!showManageNetworks)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showManageNetworks ? 'Retour à l\'import' : 'Gérer les réseaux'}
            </button>
          </div>

          {showManageNetworks ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg">
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nom du réseau
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {networks.map((network) => (
                        <tr key={network.network_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {network.network_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {network.network_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setSelectedNetwork(network);
                                setDeleteConfirmation(true);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal de confirmation de suppression */}
              {deleteConfirmation && selectedNetwork && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Confirmer la suppression
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Êtes-vous sûr de vouloir supprimer toutes les données du réseau "{selectedNetwork.network_name}" ?
                      Cette action est irréversible.
                    </p>
                    
                    {/* Container pour la barre de progression */}
                    <div className="mb-4">
                      {loading ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                              Suppression de {deletingCurrentTable || 'données'}... 
                              {estimatedRowCount > 0 && `(${deletedRowCount}/${estimatedRowCount} lignes)`}
                            </span>
                            <span className="text-sm font-medium text-blue-600">{deletionProgress}%</span>
                          </div>
                          <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${deletionProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <div></div>
                      )}
                    </div>
                    
                    <div className="flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmation(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                        disabled={loading}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={loading ? null : deleteNetwork}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        {loading ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {!networkConfigured ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <input
                        id="create-new-network"
                        name="network-option"
                        type="radio"
                        checked={!useExistingNetwork}
                        onChange={() => setUseExistingNetwork(false)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="create-new-network" className="ml-2 block text-sm font-medium text-gray-700">
                        Créer un nouveau réseau
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="use-existing-network"
                        name="network-option"
                        type="radio"
                        checked={useExistingNetwork}
                        onChange={() => setUseExistingNetwork(true)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="use-existing-network" className="ml-2 block text-sm font-medium text-gray-700">
                        Ajouter à un réseau existant
                      </label>
                    </div>
                  </div>

                  {!useExistingNetwork ? (
                    <>
                      <div>
                        <label htmlFor="networkName" className="block text-sm font-medium text-gray-700">
                          Network Name *
                        </label>
                        <input
                          type="text"
                          id="networkName"
                          value={networkName}
                          onChange={(e) => setNetworkName(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="Enter network name"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="networkId" className="block text-sm font-medium text-gray-700">
                          Network ID *
                        </label>
                        <input
                          type="text"
                          id="networkId"
                          value={networkId}
                          onChange={(e) => setNetworkId(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="Enter network ID"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label htmlFor="existingNetworkId" className="block text-sm font-medium text-gray-700">
                        Sélectionner un réseau *
                      </label>
                      <select
                        id="existingNetworkId"
                        value={existingNetworkId}
                        onChange={(e) => {
                          setExistingNetworkId(e.target.value);
                          if (e.target.value) {
                            checkExistingTables(e.target.value);
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      >
                        <option value="">-- Sélectionner un réseau --</option>
                        {networks.map((network) => (
                          <option key={network.network_id} value={network.network_id}>
                            {network.network_name} ({network.network_id})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Only show info about existing tables if a network is selected */}
                  {useExistingNetwork && existingNetworkId && Object.keys(existingTables).length > 0 && (
                    <div className="border border-blue-100 bg-blue-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-blue-800 mb-2">Tables existantes dans ce réseau</h3>
                      <ul className="text-sm divide-y divide-blue-200">
                        {Object.entries(GTFS_FILES).map(([fileName, tableName]) => (
                          <li key={fileName} className="py-1.5 flex justify-between">
                            <span>{fileName}</span>
                            {existingTables[tableName]?.exists ? (
                              <span className="text-green-600 font-medium">
                                ✓ {existingTables[tableName].count} enregistrements
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium">✗ Manquant</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <label htmlFor="subnetworkName" className="block text-sm font-medium text-gray-700">
                      Sous-réseau / Source des données
                    </label>
                    <input
                      type="text"
                      id="subnetworkName"
                      value={subnetworkName}
                      onChange={(e) => setSubnetworkName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Ex: Urbain, Interurbain, SIRI, GTFS-RT..."
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Optionnel. Utilisé pour différencier les sources de données dans le même réseau (urbain/interurbain, sources temps réel différentes, etc.)
                    </p>
                  </div>

                  <div className="space-y-3 border border-gray-200 p-4 rounded-md">
                    <h3 className="text-sm font-medium text-gray-700">Paramètres du temps réel (optionnels)</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="realtime_type" className="block text-xs font-medium text-gray-700">
                          Type d'API temps réel
                        </label>
                        <select
                          id="realtime_type"
                          value={realtimeType}
                          onChange={(e) => setRealtimeType(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        >
                          <option value="">-- Aucun --</option>
                          <option value="siri">SIRI</option>
                          <option value="gtfs_rt">GTFS-RT</option>
                          <option value="gtfs_rt_json">GTFS-RT JSON</option>
                          <option value="other">Autre</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="realtime_url" className="block text-xs font-medium text-gray-700">
                          URL de l'API
                        </label>
                        <input
                          type="text"
                          id="realtime_url"
                          value={realtimeUrl}
                          onChange={(e) => setRealtimeUrl(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="https://api.example.com/realtime"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="realtime_api_key" className="block text-xs font-medium text-gray-700">
                        Clé API (si nécessaire)
                      </label>
                      <input
                        type="text"
                        id="realtime_api_key"
                        value={realtimeApiKey}
                        onChange={(e) => setRealtimeApiKey(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        placeholder="Votre clé API"
                      />
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Ces paramètres seront associés au sous-réseau pour faciliter la distinction entre différentes sources de données temps réel.
                    </p>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <input
                          id="upload-directory"
                          name="upload-mode"
                          type="radio"
                          checked={uploadMode === 'directory'}
                          onChange={() => setUploadMode('directory')}
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="upload-directory" className="ml-2 block text-sm font-medium text-gray-700">
                          Upload Directory
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="upload-files"
                          name="upload-mode"
                          type="radio"
                          checked={uploadMode === 'individual'}
                          onChange={() => setUploadMode('individual')}
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="upload-files" className="ml-2 block text-sm font-medium text-gray-700">
                          Upload Individual Files
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleNetworkConfiguration}
                      disabled={!isNetworkInfoValid()}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Continuer avec ce réseau
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Network information summary */}
                  <div className="bg-gray-50 p-4 rounded-md mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Réseau sélectionné</h3>
                    <p className="text-sm text-gray-900">
                      <span className="font-bold">
                        {useExistingNetwork 
                          ? networks.find(n => n.network_id === existingNetworkId)?.network_name
                          : networkName}
                      </span>
                      {subnetworkName && <span className="ml-2 text-gray-600">({subnetworkName})</span>}
                    </p>
                    <button
                      onClick={handleReset}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Changer de réseau
                    </button>
                  </div>

                  {/* Unified GTFS File Status Display */}
                  {(useExistingNetwork && existingNetworkId || !useExistingNetwork && networkId) && (
                    <div className="border border-gray-200 bg-white p-4 rounded-md mb-4">
                      <h3 className="text-sm font-medium text-gray-800 mb-3">
                        Statut des fichiers GTFS pour le réseau :
                      </h3>
                      <ul className="text-sm divide-y divide-gray-200">
                        {Object.entries(GTFS_FILES).map(([fileName, tableName]) => {
                          const isImported = existingTables[tableName]?.exists;
                          const recordCount = existingTables[tableName]?.count;
                          const isSelectedForUpload = files.some(f => f.name === fileName);

                          let statusText = '';
                          let statusColor = '';
                          let statusIcon = '';

                          if (isImported) {
                            statusIcon = '✓';
                            statusText = `Importé (${recordCount} enregistrements)`;
                            statusColor = 'text-green-600 font-medium';
                          } else if (isSelectedForUpload) {
                            statusIcon = '⏳';
                            statusText = `Prêt à importer`;
                            statusColor = 'text-blue-600 font-medium';
                          } else {
                            statusIcon = '✗';
                            statusText = `Manquant`;
                            statusColor = 'text-red-600 font-medium';
                          }

                          return (
                            <li key={fileName} className="py-2 flex justify-between items-center">
                              <span className="text-gray-700">{fileName}</span>
                              <div className="flex items-center">
                                <span className={`${statusColor} mr-4`}>
                                  {statusIcon} {statusText}
                                </span>
                                {isImported && (
                                  <button
                                    onClick={() => {
                                      setTableToDelete(tableName);
                                      setTableFileNameToDelete(fileName);
                                      setShowDeleteTableModal(true);
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                    disabled={loading} // Disable if any global loading is happening
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Modal de confirmation de suppression de table spécifique */}
                  {showDeleteTableModal && tableToDelete && (
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                      <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Confirmer la suppression des données
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                          Êtes-vous sûr de vouloir supprimer toutes les données du fichier "<span className="font-semibold">{tableFileNameToDelete}</span>" 
                          pour le réseau "<span className="font-semibold">{useExistingNetwork ? networks.find(n => n.network_id === existingNetworkId)?.network_name : networkName}</span>" ?
                          <br />
                          Cette action est irréversible.
                        </p>
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowDeleteTableModal(false);
                              setTableToDelete(null);
                              setTableFileNameToDelete(null);
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={loading}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTableData()} // This function will be created next
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                          >
                            {loading ? 'Suppression...' : 'Supprimer les données'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* File input section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {uploadedFiles.length > 0 ? 'Ajouter/Remplacer des fichiers GTFS' : 'Sélectionner les fichiers GTFS *'}
                    </label>
                    
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        {uploadMode === 'directory' ? (
                          <>
                            <input
                              type="file"
                              webkitdirectory="true"
                              directory="true"
                              multiple
                              onChange={handleFileChange}
                              className="sr-only"
                              id="file-upload"
                            />
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                            >
                              <span>Select Directory</span>
                            </label>
                            <p className="text-xs text-gray-500">
                              Directory containing GTFS .txt files
                            </p>
                          </>
                        ) : (
                          <>
                            <input
                              type="file"
                              multiple
                              accept=".txt"
                              onChange={handleFileChange}
                              className="sr-only"
                              id="file-upload"
                            />
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                            >
                              <span>Select Files</span>
                            </label>
                            <p className="text-xs text-gray-500">
                              Select GTFS .txt files individually
                            </p>
                          </>
                        )}
                        {files.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-600">Selected files:</p>
                            <ul className="mt-2 text-sm text-gray-500 list-disc list-inside">
                              {files.map((file, index) => {
                                const isMissing = missingFiles.includes(file.name);
                                const colorClass = GTFS_FILES[file.name] 
                                  ? (isMissing ? 'text-yellow-600 font-medium' : 'text-green-600')
                                  : 'text-red-600';
                                return (
                                  <li key={index} className={colorClass}>
                                    {file.name} 
                                    {!GTFS_FILES[file.name] && ' (non supporté)'} 
                                    {GTFS_FILES[file.name] && isMissing && ' (fichier manquant)'}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={loading || files.length === 0}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Process Files'}
                    </button>
                  </div>
                </>
              )}

              {isProcessing && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{currentFile || 'Processing files...'}</span>
                    <span className="text-sm font-medium text-gray-700">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4 mt-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4 mt-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Success</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>{showManageNetworks ? 'Réseau supprimé avec succès!' : uploadMode === 'directory' ? 'Files processed successfully!' : 'Fichiers importés avec succès!'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;