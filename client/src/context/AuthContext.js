import { createContext, useState, useContext, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import api from '../services/api';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const IS_DEV_BYPASS =
    process.env.NODE_ENV === 'development' &&
    process.env.REACT_APP_DEV_BYPASS === 'true';

const DEV_USER = { id: 'dev-admiral', email: 'dev@admin.com', role: 'admiral' };

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (IS_DEV_BYPASS) {
            setUser(DEV_USER);
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const token = await firebaseUser.getIdToken();
                localStorage.setItem('authToken', token);
                try {
                    const { data } = await api.get('/auth/verify');
                    setUser(data.user);
                } catch {
                    setUser(null);
                }
            } else {
                localStorage.removeItem('authToken');
                setUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email, password) => {
        const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
        const token = await firebaseUser.getIdToken();
        localStorage.setItem('authToken', token);
        const { data } = await api.get('/auth/verify');
        setUser(data.user);
        return data;
    };

    const logout = async () => {
        await signOut(auth);
        localStorage.removeItem('authToken');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};