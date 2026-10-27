import axios from 'axios';

// ✅ FIX 1: add /api in baseURL
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
});

// REQUEST INTERCEPTOR — attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// RESPONSE INTERCEPTOR — handle token expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');

        // ✅ FIX 2: also add /api here
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
          { refreshToken }
        );

        const newToken = res.data.accessToken;

        localStorage.setItem('accessToken', newToken);

        original.headers.Authorization = `Bearer ${newToken}`;

        return api(original); // retry request
      } catch (err) {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;