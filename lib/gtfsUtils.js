// lib/gtfsUtils.js

// IMPORTANT: This order is critical. Dependent tables (children) must come before tables they depend on (parents).
// This list should include ALL tables that can be associated with a network_id and might be deleted.
const GTFS_TABLE_DELETION_ORDER = [
    'stop_times',       // Depends on trips, stops
    'frequencies',      // Depends on trips
    'delayed_trips',    // Assuming this depends on trips
    'trips',            // Depends on routes, calendar/calendar_dates, shapes
    'transfers',        // Depends on stops (from_stop_id, to_stop_id)
    'fare_rules',       // Depends on fare_attributes, routes, stops (origin_id, destination_id, contains_id)
    'calendar_dates',   // Depends on calendar (service_id)
    'shapes',           // Shape points, referenced by trips via shape_id
    'favorite_stops',   // Assuming this depends on stops and a user/profile
    'stops',
    'favorite_lines',   // Assuming this depends on routes and a user/profile
    'routes',           // Depends on agency
    'calendar',         // Defines service_ids
    'agency',           // Agency details
    'fare_attributes',  // Fare details
    'favorite_networks' // Assuming this depends on the 'networks' table and a user/profile. Data for a network.
    // The 'networks' table itself is handled as a separate concern (deleteNetworkRecord flag).
];

// This map defines a conceptual parent-child relationship for cascading deletions.
// If a 'parent' (key) is selected for deletion by the user,
// all 'children' (values) must also be added to the deletion set.
// These children will then be ordered correctly by GTFS_TABLE_DELETION_ORDER.
const CONCEPTUAL_CHILDREN_MAP = {
    // If 'networks' itself is selected (meaning "delete everything for this network"),
    // all associated GTFS tables are considered its children for deletion.
    'networks': [...GTFS_TABLE_DELETION_ORDER.filter(t => t !== 'networks')], // Exclude 'networks' itself from this list

    'agency': ['routes', 'trips', 'stop_times', 'frequencies', 'calendar', 'calendar_dates', 'fare_rules', 'transfers', 'shapes', 'favorite_lines', 'favorite_stops', 'delayed_trips'], // Simplified: if agency goes, most of its data goes.
    'routes': ['trips', 'stop_times', 'frequencies', 'fare_rules', 'favorite_lines', 'delayed_trips'],
    'trips': ['stop_times', 'frequencies', 'delayed_trips', 'shapes'], // shapes are referenced by trips
    'stops': ['stop_times', 'transfers', 'fare_rules', 'favorite_stops'], // fare_rules can reference stops
    'calendar': ['trips', 'calendar_dates', 'stop_times', 'frequencies', 'delayed_trips'], // Indirectly through trips
    'fare_attributes': ['fare_rules'],
    // Tables that are mostly leaves or whose children are not typically managed this way:
    // 'stop_times', 'frequencies', 'delayed_trips', 'transfers', 'fare_rules', 'calendar_dates', 'shapes',
    // 'favorite_stops', 'favorite_lines', 'favorite_networks' have no further "conceptual children" in this map.
};

/**
 * Determines the full set of tables to clear and their correct deletion order.
 * @param {string[]} selectedTablesByUser - Array of table names explicitly selected by the user.
 * @param {boolean} explicitlyDeleteNetworkRecord - Flag indicating if the 'networks' table record itself should be deleted.
 * @returns {{tablesToClearInOrder: string[], deleteNetworkRecord: boolean}}
 */
function determineFullDeletionScopeAndOrder(selectedTablesByUser, explicitlyDeleteNetworkRecord = false) {
    const tablesToClear = new Set();

    // If the 'networks' table itself is selected by the user, it implies deleting all associated GTFS data.
    if (selectedTablesByUser.includes('networks')) {
        (CONCEPTUAL_CHILDREN_MAP['networks'] || []).forEach(table => tablesToClear.add(table));
        // also add 'networks' to selectedTablesByUser for the logic below if it wasn't already explicitly there for some reason
        // but 'networks' table is handled by the `deleteNetworkRecord` flag primarily.
        // For clarity, `tablesToClear` will contain GTFS tables, `deleteNetworkRecord` handles the 'networks' table row.
    }

    const queue = [...selectedTablesByUser.filter(t => t !== 'networks')]; // Process actual GTFS tables
    const visitedForExpansion = new Set();

    while (queue.length > 0) {
        const currentTable = queue.shift();
        if (visitedForExpansion.has(currentTable)) {
            continue;
        }
        visitedForExpansion.add(currentTable);
        tablesToClear.add(currentTable);

        const childrenToAlsoClear = CONCEPTUAL_CHILDREN_MAP[currentTable] || [];
        childrenToAlsoClear.forEach(childTable => {
            if (!visitedForExpansion.has(childTable)) { // Add to queue only if not processed for expansion
                queue.push(childTable);
            }
            tablesToClear.add(childTable); // Always add to the set of tables to clear
        });
    }

    // Order the final set of tables according to the master deletion order.
    const finalListOfTablesToClear = GTFS_TABLE_DELETION_ORDER.filter(table => tablesToClear.has(table));
    
    // Determine if the 'networks' table record itself should be deleted.
    // This is true if explicitly requested OR if the user selected 'networks' table.
    let shouldDeleteNetworkRecord = explicitlyDeleteNetworkRecord || selectedTablesByUser.includes('networks');

    return {
        tablesToClearInOrder: finalListOfTablesToClear,
        deleteNetworkRecord: shouldDeleteNetworkRecord,
    };
}

module.exports = {
    determineFullDeletionScopeAndOrder,
    GTFS_TABLE_DELETION_ORDER // Export if needed elsewhere
}; 