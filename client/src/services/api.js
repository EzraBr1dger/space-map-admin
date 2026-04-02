import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// True only when dev bypass is active
export const IS_DEV_BYPASS =
    process.env.NODE_ENV === 'development' &&
    process.env.REACT_APP_DEV_BYPASS === 'true';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 errors
// Skip the login redirect when dev bypass is active so a missing backend
// doesn't kick us out of the UI we're trying to test.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !IS_DEV_BYPASS) {
            localStorage.removeItem('authToken');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
