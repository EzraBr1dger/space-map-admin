import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FleetTab.css';

const BATTALIONS = ['501st', '212th', '104th', '91st', '41st Elite', '21st', 'Coruscant Guard', 'Unassigned'];

function FleetTab() {
    const [venators, setVenators] = useState({});
    const [planets, setPlanets] = useState([]);
    const [selectedVenators, setSelectedVenators] = useState([]);
    const [destination, setDestination] = useState('');
    const [travelDays, setTravelDays] = useState(3);
    const [instantMove, setInstantMove] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingVenator, setEditingVenator] = useState(null);

    // New venator form
    const [newVenator, setNewVenator] = useState({
        customName: '',
        battalion: 'Unassigned',
        commander: '',
        startingPlanet: 'Coruscant'
    });

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

    const addVenator = async () => {
        try {
            await api.post('/fleet', newVenator);
            showMessage('success', 'Venator added successfully');
            setShowAddModal(false);
            setNewVenator({
                customName: '',
                battalion: 'Unassigned',
                commander: '',
                startingPlanet: 'Coruscant'
            });
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to add venator');
        }
    };

    const updateVenator = async () => {
        try {
            await api.put(`/fleet/${editingVenator.id}`, editingVenator);
            showMessage('success', 'Venator updated successfully');
            setEditingVenator(null);
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to update venator');
        }
    };

    const deleteVenator = async (venatorId) => {
        if (!window.confirm('Are you sure you want to delete this venator?')) return;

        try {
            await api.delete(`/fleet/${venatorId}`);
            showMessage('success', 'Venator deleted successfully');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to delete venator');
        }
    };

    if (loading) return <div className="loading">Loading fleet data...</div>;

    return (
        <div className="fleet-tab">
            <h3>Fleet Composition Management</h3>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="fleet-controls">
                <button onClick={() => setShowAddModal(true)} className="btn-add">Add New Venator</button>
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
                            <button onClick={() => deleteVenator(id)} className="btn-delete">Delete</button>
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

            {/* Add Venator Modal */}
            {showAddModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h4>Add New Venator</h4>
                        <input
                            type="text"
                            placeholder="Custom Name (e.g., Resolute)"
                            value={newVenator.customName}
                            onChange={(e) => setNewVenator({ ...newVenator, customName: e.target.value })}
                        />
                        <select
                            value={newVenator.battalion}
                            onChange={(e) => setNewVenator({ ...newVenator, battalion: e.target.value })}
                        >
                            {BATTALIONS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Commander (e.g., Anakin Skywalker)"
                            value={newVenator.commander}
                            onChange={(e) => setNewVenator({ ...newVenator, commander: e.target.value })}
                        />
                        <select
                            value={newVenator.startingPlanet}
                            onChange={(e) => setNewVenator({ ...newVenator, startingPlanet: e.target.value })}
                        >
                            {planets.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <div className="modal-actions">
                            <button onClick={addVenator} className="btn-save">Add Venator</button>
                            <button onClick={() => setShowAddModal(false)} className="btn-cancel">Cancel</button>
                        </div>
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