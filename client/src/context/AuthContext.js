import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// DEV BYPASS only activates when ALL three conditions are true:
//   1. NODE_ENV is 'development' (npm start, never npm run build)
//   2. REACT_APP_DEV_BYPASS=true is set in client/.env.development.local
//   3. That .env.development.local file is git-ignored by CRA
// Production builds are completely unaffected.

const IS_DEV_BYPASS =
    process.env.NODE_ENV === 'development' &&
    process.env.REACT_APP_DEV_BYPASS === 'true';

// Role is 'admiral' so Dashboard skips the /stats call and renders FleetTab directly.
// Change to 'admin' only if you need to test the full admin dashboard locally.
const DEV_USER = { id: 'dev-admiral', username: 'DevAdmiral', role: 'admiral' };

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (IS_DEV_BYPASS) {
            setUser(DEV_USER);
            setLoading(false);
            return;
        }
        verifyToken();
    }, []);

    const verifyToken = async () => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const { data } = await api.get('/auth/verify');
                setUser(data.user);
            } catch (error) {
                localStorage.removeItem('authToken');
            }
        }
        setLoading(false);
    };

    const login = async (username, password) => {
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('authToken', data.token);
        setUser(data.user);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
