import React, { useState } from 'react';
import api from '../services/api';
import './ActionsTab.css';

function ActionsTab() {
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const incrementProductionCycle = async () => {
        if (!window.confirm('Are you sure you want to increment the production cycle? This will affect weekly production calculations.')) {
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post('/stats/production-cycles/increment');
            showMessage('success', data.message);
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to increment production cycle');
        } finally {
            setLoading(false);
        }
    };

    const recalculateStats = async () => {
        if (!window.confirm('Are you sure you want to recalculate faction stats? This will update production data based on current planet status.')) {
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post('/stats/recalculate');
            showMessage('success', data.message);
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to recalculate stats');
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        showMessage('success', 'Refreshing all data...');
        
        try {
            // Force a page reload to refresh all components
            window.location.reload();
        } catch (error) {
            showMessage('error', 'Failed to refresh data');
            setLoading(false);
        }
    };

    const exportData = async () => {
        setLoading(true);
        try {
            showMessage('success', 'Exporting data...');

            const [planetsRes, suppliesRes, statsRes] = await Promise.all([
                api.get('/mapdata'),
                api.get('/supplies'),
                api.get('/stats/dashboard')
            ]);

            const exportData = {
                timestamp: new Date().toISOString(),
                planets: planetsRes.data,
                supplies: suppliesRes.data,
                stats: statsRes.data
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `space-map-export-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            showMessage('success', 'Data exported successfully!');
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to export data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="actions-tab">
            <h3>System Actions</h3>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="actions-grid">
                <ActionCard
                    title="Increment Production Cycle"
                    description="Advances the weekly production cycle counter. This affects production calculations and should be done at the end of each week."
                    buttonText="Increment Cycle"
                    buttonClass="btn-increment"
                    onClick={incrementProductionCycle}
                    disabled={loading}
                />

                <ActionCard
                    title="Recalculate Faction Stats"
                    description="Recalculates faction production statistics based on current planet ownership and status. Use this after making bulk changes to planets."
                    buttonText="Recalculate Stats"
                    buttonClass="btn-recalculate"
                    onClick={recalculateStats}
                    disabled={loading}
                />

                <ActionCard
                    title="Refresh All Data"
                    description="Reloads all data from Firebase including stats, supplies, planets, and announcements. Use this to see the latest updates."
                    buttonText="Refresh Data"
                    buttonClass="btn-refresh"
                    onClick={refreshData}
                    disabled={loading}
                />

                <ActionCard
                    title="Export Data"
                    description="Downloads a complete backup of all system data including planets, supplies, and statistics in JSON format."
                    buttonText="Export Data"
                    buttonClass="btn-export"
                    onClick={exportData}
                    disabled={loading}
                />
            </div>

            {loading && (
                <div className="loading-overlay">
                    <div className="loading-spinner">Processing...</div>
                </div>
            )}
        </div>
    );
}

function ActionCard({ title, description, buttonText, buttonClass, onClick, disabled }) {
    return (
        <div className="action-card">
            <h4>{title}</h4>
            <p>{description}</p>
            <button 
                className={buttonClass} 
                onClick={onClick}
                disabled={disabled}
            >
                {buttonText}
            </button>
        </div>
    );
}

export default ActionsTab;