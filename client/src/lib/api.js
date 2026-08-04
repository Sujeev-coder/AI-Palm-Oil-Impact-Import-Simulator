import axios from 'axios';

export const API_BASE_URL = 'https://ai-palm-oil-impact-import-simulator.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;