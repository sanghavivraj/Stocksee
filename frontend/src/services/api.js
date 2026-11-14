import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send the anonymous visitor cookie
  timeout: 15000,
});

/** Turn API errors into readable messages for toasts. */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    error.userMessage = error.response?.data?.error
      || (error.code === 'ECONNABORTED' ? 'The request timed out' : 'Network error, please try again');
    return Promise.reject(error);
  },
);

export default api;
