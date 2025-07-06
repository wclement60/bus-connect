// Cache utility for Supabase queries
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export const getCachedData = async (key, fetchFunction) => {
  const now = Date.now();
  const cachedItem = cache.get(key);

  // Return cached data if it exists and hasn't expired
  if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
    return cachedItem.data;
  }

  // Fetch fresh data
  const data = await fetchFunction();
  
  // Store in cache
  cache.set(key, {
    data,
    timestamp: now
  });

  return data;
};

export const invalidateCache = (key) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}; 