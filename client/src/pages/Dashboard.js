import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import SuppliesTab from '../components/SuppliesTab';
import MapDataTab from '../components/MapDataTab';
import AnnouncementsTab from '../components/AnnouncementsTab';
import ActionsTab from '../components/ActionsTab';
import FleetTab from '../components/FleetTab';
import CISFleetTab from '../components/CISFleetTab';
import './Dashboard.css';

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('supplies');
    const { user, logout } = useAuth();

    useEffect(() => {
        // If user is admiral, set fleet tab as default
        if (user?.role === 'admiral') {
            setActiveTab('fleet');
        }
        
        loadStats();
        const interval = setInterval(loadStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [user]);

    const loadStats = async () => {
        try {
            const { data } = await api.get('/stats/dashboard');
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Admiral sees different dashboard
    if (user?.role === 'admiral') {
        return (
            <div className="dashboard">
                <div className="container">
                    <div className="navbar">
                        <div className="user-info">
                            Welcome, Admiral <span>{user?.username}</span>
                        </div>
                        <button className="logout-btn" onClick={logout}>Logout</button>
                    </div>

                    <div className="header">
                        <h1>Fleet Composition Management</h1>
                        <p>Capital Ship Command & Control</p>
                    </div>

                    <FleetTab />
                </div>
            </div>
        );
    }

    // Admin sees full dashboard
    if (loading) return <div className="loading">Loading statistics...</div>;
    if (!stats) return <div className="loading">No data available</div>;

    return (
        <div className="dashboard">
            <div className="container">
                <div className="navbar">
                    <div className="user-info">
                        Welcome, <span>{user?.username}</span>
                    </div>
                    <button className="logout-btn" onClick={logout}>Logout</button>
                </div>

                <div className="header">
                    <h1>The Galaxy Control Page</h1>
                    <p>Real-time planetary production management system (made by Ezra_Br1dger)</p>
                    <p style={{ marginTop: '10px', opacity: 0.7 }}>
                        Last updated: <span>{new Date(stats.lastUpdated).toLocaleString()}</span>
                    </p>
                </div>

                <div className="stats-grid">
                    <StatCard title="Planet Overview">
                        <StatItem label="Total Planets" value={stats.planets.total} />
                        <StatItem label="Active Planets" value={stats.planets.active} className="status-active" />
                        <StatItem label="Inactive Planets" value={stats.planets.inactive} className="status-inactive" />
                        <StatItem label="Contested Planets" value={stats.planets.contested} className="status-contested" />
                    </StatCard>

                    <StatCard title="Faction Control">
                        <StatItem label="Republic Planets" value={stats.planets.republic} style={{ color: '#4fc3f7' }} />
                        <StatItem label="Separatists Planets" value={stats.planets.separatists} style={{ color: '#f44336' }} />
                        <StatItem label="Republic Active" value={stats.production.republic.activePlanets} />
                        <StatItem label="Separatists Active" value={stats.production.separatists.activePlanets} />
                    </StatCard>

                    <StatCard title="Supply Status">
                        <StatItem label="Total Supply" value={formatNumber(stats.supplies.totalSupply)} />
                        {Object.entries(stats.supplies.items).map(([item, amount]) => (
                            <StatItem key={item} label={item} value={formatNumber(amount)} />
                        ))}
                    </StatCard>

                    <StatCard title="Weekly Production">
                        <StatItem label="Production Cycles" value={stats.productionCycles} />
                        {Object.entries(stats.production.totalProduction).map(([resource, amount]) => (
                            <StatItem key={resource} label={resource} value={`${formatNumber(amount)}/week`} />
                        ))}
                    </StatCard>
                </div>

                <div className="management-section">
                    <div className="tabs">
                        <button 
                            className={`tab ${activeTab === 'supplies' ? 'active' : ''}`}
                            onClick={() => setActiveTab('supplies')}
                        >
                            Supplies
                        </button>
                        <button 
                            className={`tab ${activeTab === 'mapdata' ? 'active' : ''}`}
                            onClick={() => setActiveTab('mapdata')}
                        >
                            Map Data
                        </button>
                        <button 
                            className={`tab ${activeTab === 'fleet' ? 'active' : ''}`}
                            onClick={() => setActiveTab('fleet')}
                        >
                            Fleet Composition
                        </button>
                        <button 
                            className={`tab ${activeTab === 'actions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('actions')}
                        >
                            Actions
                        </button>
                        <button 
                            className={`tab ${activeTab === 'cisfleet' ? 'active' : ''}`}
                            onClick={() => setActiveTab('cisfleet')}
                        >
                            CIS Fleet
                        </button>
                        <button 
                            className={`tab ${activeTab === 'announcements' ? 'active' : ''}`}
                            onClick={() => setActiveTab('announcements')}
                        >
                            Announcements
                        </button>
                    </div>

                    <div className="tab-content">
                        {activeTab === 'supplies' && <SuppliesTab />}
                        {activeTab === 'mapdata' && <MapDataTab />}
                        {activeTab === 'fleet' && <FleetTab />}
                        {activeTab === 'actions' && <ActionsTab />}
                        {activeTab === 'announcements' && <AnnouncementsTab />}
                        {activeTab === 'cisfleet' && <CISFleetTab />}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, children }) {
    return (
        <div className="stat-card">
            <h3>{title}</h3>
            {children}
        </div>
    );
}

function StatItem({ label, value, className = '', style = {} }) {
    return (
        <div className="stat-item">
            <span>{label}:</span>
            <span className={className} style={style}>{value}</span>
        </div>
    );
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

export default Dashboard;