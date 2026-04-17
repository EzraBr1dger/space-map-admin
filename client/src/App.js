import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import './App.css';

function PrivateRoute({ children }) {
    const { user, loading } = useAuth();
    
    if (loading) return <div className="loading">Loading...</div>;
    
    if (!user) return <Navigate to="/login" />;
    
    if (user.role !== 'admin' && user.role !== 'admiral' && user.role !== 'owner') {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
                color: '#64ffda',
                flexDirection: 'column',
                gap: '20px'
            }}>
                <h2>Access Pending</h2>
                <p style={{ color: '#ffffff' }}>Your account is awaiting role assignment. Please contact an admin.</p>
                <button onClick={() => window.location.href = '/login'} style={{ width: 'auto', padding: '10px 20px' }}>Back to Login</button>
            </div>
        );
    }
    
    return children;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                        path="/dashboard"
                        element={
                            <PrivateRoute>
                                <Dashboard />
                            </PrivateRoute>
                        }
                    />
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;