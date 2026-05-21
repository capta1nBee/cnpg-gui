import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    const envId = localStorage.getItem('activeEnvironmentId');
    if (envId) {
      config.headers['X-Environment-ID'] = envId;
    } else {
      config.headers['X-Environment-ID'] = '00000000-0000-0000-0000-000000000000'; // Fallback
    }
    // Set a default namespace if not provided by components
    // if (!config.headers['X-Namespace']) {
    //   config.headers['X-Namespace'] = 'default';
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // CRITICAL FIX: Do NOT auto-redirect on the login endpoint itself.
    // The login endpoint legitimately returns 401 for wrong credentials.
    // Redirecting here causes an infinite loop: wrong password → 401 → redirect to /login → repeat.
    const requestUrl = error.config?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/');

    // DEFENSE-IN-DEPTH: Also skip redirect if we are already on the login page.
    // This prevents infinite loops from background calls (e.g. TenantProvider)
    // that fire while on /login before a token exists.
    const alreadyOnLogin = window.location.pathname === '/login';

    if (!isAuthEndpoint && !alreadyOnLogin && (error.response?.status === 401 || error.response?.status === 403)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
