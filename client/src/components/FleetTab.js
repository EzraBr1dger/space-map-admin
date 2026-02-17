import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FleetTab.css';

const BATTALIONS = ['501st', '212th', '104th', '91st', '41st Elite', '21st', 'Coruscant Guard', 'Unassigned'];

function FleetTab() {
    const [venators, setVenators] = useState({});
    const [totalCapitalShips, setTotalCapitalShips] = useState(0);
    const [planets, setPlanets] = useState([]);
    const [selectedVenators, setSelectedVenators] = useState([]);
    const [destination, setDestination] = useState('');
    const [travelDays, setTravelDays] = useState(3);
    const [instantMove, setInstantMove] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [editingVenator, setEditingVenator] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [venatorRes, mapRes] = await Promise.all([
                api.get('/fleet'),
                api.get('/mapdata')
            ]);
            
            setVenators(venatorRes.data.venators || {});
            setTotalCapitalShips(venatorRes.data.totalCapitalShips || 0);
            setPlanets(Object.keys(mapRes.data.planets || {}));
            setLoading(false);
        } catch (error) {
            console.error('Error loading data:', error);
            showMessage('error', 'Failed to load fleet data');
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const toggleSelect = (venatorId) => {
        setSelectedVenators(prev =>
            prev.includes(venatorId)
                ? prev.filter(id => id !== venatorId)
                : [...prev, venatorId]
        );
    };

    const selectAll = () => {
        setSelectedVenators(Object.keys(venators));
    };

    const deselectAll = () => {
        setSelectedVenators([]);
    };

    const moveFleet = async () => {
        if (selectedVenators.length === 0) {
            showMessage('error', 'No venators selected');
            return;
        }
        if (!destination) {
            showMessage('error', 'No destination selected');
            return;
        }

        try {
            const response = await api.post('/fleet/move', {
                venatorIds: selectedVenators,
                destination,
                travelDays,
                instantMove
            });

            showMessage('success', response.data.message);
            deselectAll();
            setDestination('');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to move fleet');
        }
    };

    const updateVenator = async () => {
        try {
            await api.put(`/fleet/${editingVenator.id}`, {
                customName: editingVenator.customName,
                battalion: editingVenator.battalion,
                commander: editingVenator.commander
            });
            showMessage('success', 'Venator updated successfully');
            setEditingVenator(null);
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to update venator');
        }
    };

    if (loading) return <div className="loading">Loading fleet data...</div>;

    return (
        <div className="fleet-tab">
            <h3>Fleet Composition Management</h3>
            <p className="fleet-info">Total Capital Ships in Fleet: <strong>{totalCapitalShips}</strong></p>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="fleet-controls">
                <button onClick={selectAll} className="btn-select-all">Select All</button>
                <button onClick={deselectAll} className="btn-deselect-all">Deselect All</button>
            </div>

            <div className="fleet-list">
                {Object.entries(venators).map(([id, venator]) => (
                    <div 
                        key={id} 
                        className={`venator-card ${selectedVenators.includes(id) ? 'selected' : ''}`}
                    >
                        <input
                            type="checkbox"
                            checked={selectedVenators.includes(id)}
                            onChange={() => toggleSelect(id)}
                        />
                        <div className="venator-info">
                            <h4>{venator.customName || id}</h4>
                            <p><strong>Battalion:</strong> {venator.battalion}</p>
                            <p><strong>Commander:</strong> {venator.commander || 'None'}</p>
                            <p><strong>Location:</strong> {venator.currentPlanet}</p>
                            {venator.travelingTo && (
                                <p className="in-transit">
                                    In Transit to {venator.travelingTo} - Arrives {new Date(venator.arrivalDate).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                        <div className="venator-actions">
                            <button onClick={() => setEditingVenator({ id, ...venator })} className="btn-edit">Edit</button>
                        </div>
                    </div>
                ))}
            </div>

            {selectedVenators.length > 0 && (
                <div className="move-panel">
                    <h4>Move Fleet ({selectedVenators.length} selected)</h4>
                    <div className="move-controls">
                        <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                            <option value="">-- Select Destination --</option>
                            {planets.map(planet => (
                                <option key={planet} value={planet}>{planet}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min="1"
                            max="30"
                            value={travelDays}
                            onChange={(e) => setTravelDays(parseInt(e.target.value))}
                            placeholder="Travel days"
                        />
                        <label>
                            <input
                                type="checkbox"
                                checked={instantMove}
                                onChange={(e) => setInstantMove(e.target.checked)}
                            />
                            Instant Move (Admin Only)
                        </label>
                        <button onClick={moveFleet} className="btn-move">Move Fleet</button>
                    </div>
                </div>
            )}

            {/* Edit Venator Modal */}
            {editingVenator && (
                <div className="modal">
                    <div className="modal-content">
                        <h4>Edit Venator</h4>
                        <input
                            type="text"
                            placeholder="Custom Name"
                            value={editingVenator.customName}
                            onChange={(e) => setEditingVenator({ ...editingVenator, customName: e.target.value })}
                        />
                        <select
                            value={editingVenator.battalion}
                            onChange={(e) => setEditingVenator({ ...editingVenator, battalion: e.target.value })}
                        >
                            {BATTALIONS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Commander"
                            value={editingVenator.commander || ''}
                            onChange={(e) => setEditingVenator({ ...editingVenator, commander: e.target.value })}
                        />
                        <div className="modal-actions">
                            <button onClick={updateVenator} className="btn-save">Save Changes</button>
                            <button onClick={() => setEditingVenator(null)} className="btn-cancel">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FleetTab;