import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  // Se estiver acessando pelo IP da rede local no celular, substitui localhost pelo IP da máquina host
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }
  return `http://${window.location.hostname}:8000/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pwa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;