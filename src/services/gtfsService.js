import { gtfs } from 'gtfs-realtime-bindings';
import { supabase } from './supabase';

export const fetchGTFSData = async (url) => {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const feed = gtfs.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
    return feed;
  } catch (error) {
    console.error('Error fetching GTFS data:', error);
    throw error;
  }
};

export const saveGTFSData = async (data) => {
  try {
    const { data: savedData, error } = await supabase
      .from('gtfs_data')
      .insert([data]);
    
    if (error) throw error;
    return savedData;
  } catch (error) {
    console.error('Error saving GTFS data:', error);
    throw error;
  }
}; 