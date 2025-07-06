require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// --- Configuration ---
const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || 'pk.eyJ1Ijoid2VpYmVsY2xlbWVudDYwIiwiYSI6ImNtMm9yZ3JpaDA4OGQybHIxcTBibHk4NXQifQ.iUZ4I9uI1lIWgamjWnDIYg';
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Erreur: Les variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définies.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Fonction pour attendre un certain temps (pour éviter de surcharger l'API Mapbox)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour récupérer le nom de la ville depuis Mapbox
async function getCityFromCoords(lat, lon) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=place&access_token=${MAPBOX_ACCESS_TOKEN}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            // 'place' est le type qui correspond généralement à la ville
            const cityFeature = data.features.find(f => f.place_type.includes('place'));
            return cityFeature ? cityFeature.text : null;
        }
        return null;
    } catch (error) {
        console.error(`Erreur lors de la récupération de la ville pour les coordonnées ${lat}, ${lon}:`, error);
        return null;
    }
}

// Fonction principale
async function updateMissingCities() {
    console.log("Démarrage du script de mise à jour des villes...");

    // 1. Récupérer tous les arrêts où la ville est NULL
    console.log("Récupération des arrêts sans nom de ville...");
    const { data: stops, error: fetchError } = await supabase
        .from('stops')
        .select('stop_id, stop_lat, stop_lon')
        .is('city', null);

    if (fetchError) {
        console.error("Erreur lors de la récupération des arrêts:", fetchError);
        return;
    }

    if (!stops || stops.length === 0) {
        console.log("Aucun arrêt avec une ville manquante n'a été trouvé. Le script est terminé.");
        return;
    }

    console.log(`${stops.length} arrêts à mettre à jour.`);

    let updatedCount = 0;
    let failedCount = 0;

    // 2. Itérer sur chaque arrêt et mettre à jour la ville
    for (const stop of stops) {
        if (!stop.stop_lat || !stop.stop_lon) {
            console.warn(`Coordonnées manquantes pour l'arrêt ID ${stop.stop_id}, arrêt ignoré.`);
            continue;
        }

        const city = await getCityFromCoords(stop.stop_lat, stop.stop_lon);

        if (city) {
            const { error: updateError } = await supabase
                .from('stops')
                .update({ city: city })
                .eq('stop_id', stop.stop_id);

            if (updateError) {
                console.error(`Échec de la mise à jour pour l'arrêt ID ${stop.stop_id}:`, updateError.message);
                failedCount++;
            } else {
                console.log(`Arrêt ID ${stop.stop_id} mis à jour avec la ville: ${city}`);
                updatedCount++;
            }
        } else {
            console.warn(`Aucune ville trouvée pour l'arrêt ID ${stop.stop_id}.`);
            failedCount++;
        }

        // Ajout d'un délai pour respecter les limites de l'API Mapbox (600 requêtes/minute)
        await delay(100); // 100ms de délai entre chaque requête
    }

    console.log("\n--- Rapport final ---");
    console.log(`Mise à jour terminée.`);
    console.log(`Succès: ${updatedCount}`);
    console.log(`Échecs: ${failedCount}`);
    console.log("---------------------\n");
}

updateMissingCities(); 