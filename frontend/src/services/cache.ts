export const cache = {
  get: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(`jarvis_cache_${key}`);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key: string, data: any) => {
    try {
      localStorage.setItem(`jarvis_cache_${key}`, JSON.stringify(data));
      localStorage.setItem(`jarvis_time_${key}`, String(Date.now()));
    } catch (e) {
      console.warn('Erro ao salvar cache local', e);
    }
  },
  isFresh: (key: string, maxAgeMs = 300000): boolean => {
    const time = localStorage.getItem(`jarvis_time_${key}`);
    if (!time) return false;
    return Date.now() - Number(time) < maxAgeMs;
  },
};