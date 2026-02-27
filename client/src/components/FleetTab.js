import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FleetTab.css';
import { useAuth } from '../context/AuthContext';

const BATTALIONS = ['501st', '212th', '104th', '91st', '41st Elite', '21st', 'Coruscant Guard', 'Unassigned'];

const PLANET_DISTANCES = {
    'Coruscant-Kamino': 2,
    'Coruscant-Naboo': 1,
    'Coruscant-Alderaan': 1,
    'Coruscant-Kashyyyk': 3,
    'Coruscant-Onderon': 4,
    'Coruscant-Geonosis': 5,
    'Coruscant-Ryloth': 6,
    'Coruscant-Tatooine': 7,
    'Coruscant-Mustafar': 7,
};

const calculateTravelDays = (from, to) => {
    if (from === to) return 0;
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    return PLANET_DISTANCES[key1] || PLANET_DISTANCES[key2] || 5;
};

function FleetTab() {
    const { user } = useAuth();
    const [fleets, setFleets] = useState({});
    const [venatorStats, setVenatorStats] = useState({ total: 0, assigned: 0, available: 0 });
    const [planets, setPlanets] = useState([]);
    const [selectedFleets, setSelectedFleets] = useState([]);
    const [destination, setDestination] = useState('');
    const [travelDays, setTravelDays] = useState(3);
    const [instantMove, setInstantMove] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [editingFleet, setEditingFleet] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortBy, setSortBy] = useState('default');
    const [sortValue, setSortValue] = useState('');
    const [planetAccess, setPlanetAccess] = useState({});

    const [newFleet, setNewFleet] = useState({
        fleetName: '',
        commander: '',
        battalion: 'Unassigned',
        startingPlanet: 'Coruscant',
        description: '',
        composition: {
            venators: 0,
            frigates: 0
        }
    });

    const getSortedFleets = () => {
        const entries = Object.entries(fleets);
        
        if (sortBy === 'battalion' && sortValue) {
            const matched = entries.filter(([_, f]) => f.battalion === sortValue);
            const unmatched = entries.filter(([_, f]) => f.battalion !== sortValue);
            return [...matched, ...unmatched];
        }
        
        if (sortBy === 'planet' && sortValue) {
            const matched = entries.filter(([_, f]) => f.currentPlanet === sortValue);
            const unmatched = entries.filter(([_, f]) => f.currentPlanet !== sortValue);
            return [...matched, ...unmatched];
        }
        
        return entries;
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [fleetRes, mapRes] = await Promise.all([
                api.get('/fleet'),
                api.get('/mapdata')
            ]);
            setFleets(fleetRes.data.fleets || {});
            setVenatorStats(fleetRes.data.venatorStats || { total: 0, assigned: 0, available: 0 });
            const planetsData = mapRes.data.planets || {};
            setPlanets(Object.keys(planetsData));
            const access = {};
            for (const [name, data] of Object.entries(planetsData)) {
                access[name] = data.cisAccessible !== false;
            }
            setPlanetAccess(access);
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

    const toggleSelect = (fleetId) => {
        setSelectedFleets(prev => {
            if (prev.length === 0) {
                return [fleetId];
            }
            
            if (prev.includes(fleetId)) {
                return prev.filter(id => id !== fleetId);
            }
            
            const firstSelectedLocation = fleets[prev[0]].currentPlanet;
            const newFleetLocation = fleets[fleetId].currentPlanet;
            
            if (firstSelectedLocation !== newFleetLocation) {
                showMessage('error', 'Cannot select Fleets from different locations');
                return prev;
            }
            
            return [...prev, fleetId];
        });
    };

    const selectAll = () => {
        setSelectedFleets(Object.keys(fleets));
    };

    const deselectAll = () => {
        setSelectedFleets([]);
    };

    const moveFleet = async () => {
        if (selectedFleets.length === 0) {
            showMessage('error', 'No fleets selected');
            return;
        }
        if (!destination) {
            showMessage('error', 'No destination selected');
            return;
        }

        try {
            const response = await api.post('/fleet/move', {
                fleetIds: selectedFleets,
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

    const addFleet = async () => {
        if (!newFleet.fleetName) {
            showMessage('error', 'Fleet name is required');
            return;
        }
        if (newFleet.composition.venators > venatorStats.available) {
            showMessage('error', `Only ${venatorStats.available} Venators available`);
            return;
        }

        try {
            await api.post('/fleet', newFleet);
            showMessage('success', 'Fleet created successfully');
            setShowAddModal(false);
            setNewFleet({
                fleetName: '',
                commander: '',
                battalion: 'Unassigned',
                startingPlanet: 'Coruscant',
                composition: { venators: 0, frigates: 0 }
            });
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to create fleet');
        }
    };

    const updateFleet = async () => {
        const venatorDifference = editingFleet.composition.venators - (fleets[editingFleet.id]?.composition?.venators || 0);
        
        if (venatorDifference > venatorStats.available) {
            showMessage('error', `Only ${venatorStats.available} Venators available`);
            return;
        }

        try {
            await api.put(`/fleet/${editingFleet.id}`, {
                fleetName: editingFleet.fleetName,
                commander: editingFleet.commander,
                battalion: editingFleet.battalion,
                composition: editingFleet.composition
            });
            showMessage('success', 'Fleet updated successfully');
            setEditingFleet(null);
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to update fleet');
        }
    };

    const deleteFleet = async (fleetId) => {
        if (!window.confirm('Are you sure you want to delete this fleet?')) return;

        try {
            await api.delete(`/fleet/${fleetId}`);
            showMessage('success', 'Fleet deleted successfully');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to delete fleet');
        }
    };

    if (loading) return <div className="loading">Loading fleet data...</div>;

    return (
        <div className="fleet-tab">
            <h3>Fleet Composition Management</h3>
            
            <div className="venator-stats">
                <p>
                    <strong>Available Venators:</strong> {venatorStats.available} / {venatorStats.total} 
                    <span className="storage-info"> ({venatorStats.available} in storage)</span>
                </p>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="fleet-controls">
                <button onClick={() => setShowAddModal(true)} className="btn-add">Add New Fleet</button>
                <button onClick={selectAll} className="btn-select-all">Select All</button>
                <button onClick={deselectAll} className="btn-deselect-all">Deselect All</button>
                
                <select onChange={(e) => {
                    if (e.target.value) {
                        setSortBy('battalion');
                        setSortValue(e.target.value);
                    } else {
                        setSortBy('default');
                        setSortValue('');
                    }
                }} value={sortBy === 'battalion' ? sortValue : ''}>
                    <option value="">Group by Battalion</option>
                    {BATTALIONS.map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>
                
                <select onChange={(e) => {
                    if (e.target.value) {
                        setSortBy('planet');
                        setSortValue(e.target.value);
                    } else {
                        setSortBy('default');
                        setSortValue('');
                    }
                }} value={sortBy === 'planet' ? sortValue : ''}>
                    <option value="">Group by Planet</option>
                    {planets.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>

            {selectedFleets.length > 0 && (
                <div className="move-panel">
                    <h4>Move Fleet ({selectedFleets.length} selected)</h4>
                    <div className="move-controls">
                        <select value={destination} onChange={(e) => {
                            setDestination(e.target.value);
                            if (e.target.value && fleets[selectedFleets[0]]) {
                                const from = fleets[selectedFleets[0]].currentPlanet;
                                const days = calculateTravelDays(from, e.target.value);
                                setTravelDays(days);
                            }
                        }}>
                            <option value="">-- Select Destination --</option>
                            {planets.filter(p => planetAccess[p] !== false).map(planet => (
                                <option key={planet} value={planet}>{planet}</option>
                            ))}
                        </select>
                        
                        <span className="travel-time">Travel Time: {travelDays} day{travelDays !== 1 ? 's' : ''}</span>
                        
                        {user?.role === 'admin' && (
                            <label>
                                <input
                                    type="checkbox"
                                    checked={instantMove}
                                    onChange={(e) => setInstantMove(e.target.checked)}
                                />
                                Instant Move (Admin Only)
                            </label>
                        )}
                        
                        <button onClick={moveFleet} className="btn-move">Move Fleet</button>
                    </div>
                </div>
            )}

            <div className="fleet-list">
                {getSortedFleets().map(([id, fleet]) => (
                    <div 
                        key={id} 
                        className={`venator-card ${selectedFleets.includes(id) ? 'selected' : ''}`}
                    >
                        <input
                            type="checkbox"
                            checked={selectedFleets.includes(id)}
                            onChange={() => toggleSelect(id)}
                        />
                        <div className="venator-info">
                            <h4>{fleet.fleetName || id}</h4>
                            <p><strong>Commander:</strong> {fleet.commander || 'None'}</p>
                            <p><strong>Battalion:</strong> {fleet.battalion}</p>
                            <p><strong>Composition:</strong> {fleet.composition?.venators || 0} Venators, {fleet.composition?.frigates || 0} Frigates</p>
                            <p><strong>Location:</strong> {fleet.currentPlanet}</p>
                            {fleet.description && (
                                <p><strong>Description:</strong> {fleet.description}</p>
                            )}
                            {fleet.travelingTo && (
                                <p className="in-transit">
                                    In Transit to {fleet.travelingTo} - Arrives {new Date(fleet.arrivalDate).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                        <div className="venator-actions">
                            <button onClick={() => setEditingFleet({ id, ...fleet })} className="btn-edit">Edit</button>
                            <button onClick={() => deleteFleet(id)} className="btn-delete">Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Fleet Modal */}
            {showAddModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h4>Add New Fleet</h4>
                        <input
                            type="text"
                            placeholder="Fleet Name (e.g., 7th Sky Corps)"
                            value={newFleet.fleetName}
                            onChange={(e) => setNewFleet({ ...newFleet, fleetName: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Commander (e.g., Obi-Wan Kenobi)"
                            value={newFleet.commander}
                            onChange={(e) => setNewFleet({ ...newFleet, commander: e.target.value })}
                        />
                        <select
                            value={newFleet.battalion}
                            onChange={(e) => setNewFleet({ ...newFleet, battalion: e.target.value })}
                        >
                            {BATTALIONS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <select
                            value={newFleet.startingPlanet}
                            onChange={(e) => setNewFleet({ ...newFleet, startingPlanet: e.target.value })}
                        >
                            {planets.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input
                            type="number"
                            min="0"
                            max={venatorStats.available}
                            placeholder={`Venators (${venatorStats.available} available)`}
                            value={newFleet.composition.venators || ''}
                            onChange={(e) => setNewFleet({ 
                                ...newFleet, 
                                composition: { ...newFleet.composition, venators: parseInt(e.target.value) || 0 }
                            })}
                        />
                        <input
                            type="number"
                            min="0"
                            placeholder="Frigates (0 = none)"
                            value={newFleet.composition.frigates || ''}
                            onChange={(e) => setNewFleet({ 
                                ...newFleet, 
                                composition: { ...newFleet.composition, frigates: parseInt(e.target.value) || 0 }
                            })}
                        />
                        <textarea
                            placeholder="Fleet description (optional)"
                            value={newFleet.description || ''}
                            onChange={(e) => setNewFleet({ ...newFleet, description: e.target.value })}
                            rows={3}
                        />
                        <div className="modal-actions">
                            <button onClick={addFleet} className="btn-save">Create Fleet</button>
                            <button onClick={() => setShowAddModal(false)} className="btn-cancel">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Fleet Modal */}
            {editingFleet && (
                <div className="modal">
                    <div className="modal-content">
                        <h4>Edit Fleet</h4>
                        <input
                            type="text"
                            placeholder="Fleet Name"
                            value={editingFleet.fleetName}
                            onChange={(e) => setEditingFleet({ ...editingFleet, fleetName: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Commander"
                            value={editingFleet.commander || ''}
                            onChange={(e) => setEditingFleet({ ...editingFleet, commander: e.target.value })}
                        />
                        <select
                            value={editingFleet.battalion}
                            onChange={(e) => setEditingFleet({ ...editingFleet, battalion: e.target.value })}
                        >
                            {BATTALIONS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <input
                            type="number"
                            min="0"
                            placeholder="Venators"
                            value={editingFleet.composition?.venators || ''}
                            onChange={(e) => setEditingFleet({ 
                                ...editingFleet, 
                                composition: { ...editingFleet.composition, venators: parseInt(e.target.value) || 0 }
                            })}
                        />
                        <input
                            type="number"
                            min="0"
                            placeholder="Frigates"
                            value={editingFleet.composition?.frigates || ''}
                            onChange={(e) => setEditingFleet({ 
                                ...editingFleet, 
                                composition: { ...editingFleet.composition, frigates: parseInt(e.target.value) || 0 }
                            })}
                        />
                        <textarea
                            placeholder="Fleet description (optional)"
                            value={editingFleet.description || ''}
                            onChange={(e) => setEditingFleet({ ...editingFleet, description: e.target.value })}
                            rows={3}
                        />
                        <div className="modal-actions">
                            <button onClick={updateFleet} className="btn-save">Save Changes</button>
                            <button onClick={() => setEditingFleet(null)} className="btn-cancel">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FleetTab;