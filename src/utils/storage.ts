export const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    // Check if it's a QuotaExceededError
    if (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    ) {
      console.warn('LocalStorage quota exceeded! Clearing old caches...');
      
      // Clear all plan caches to make room
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('plan_editor_cache_') || k.startsWith('phacdo_cache_'))) {
          keysToRemove.push(k);
        }
      }
      
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // Try again once
      try {
        localStorage.setItem(key, value);
      } catch (retryError) {
        console.error('Final failure to setItem despite clearing cache:', retryError);
      }
    } else {
      console.error('Error setting localStorage:', e);
    }
  }
};
