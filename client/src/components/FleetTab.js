import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FleetTab.css';
import { useAuth } from '../context/AuthContext';

const BATTALIONS = ['501st', '212th', '104th', '91st', '41st Elite', '21st', 'Coruscant Guard', 'Unassigned'];

const PLANET_DISTANCES = {
    // Core Worlds (close together)
    'Coruscant-Kamino': 2,
    'Coruscant-Naboo': 1,
    'Coruscant-Alderaan': 1,
    
    // Mid Rim
    'Coruscant-Kashyyyk': 3,
    'Coruscant-Onderon': 4,
    
    // Outer Rim (far)
    'Coruscant-Geonosis': 5,
    'Coruscant-Ryloth': 6,
    'Coruscant-Tatooine': 7,
    'Coruscant-Mustafar': 7,
};

// Function to calculate travel days
const calculateTravelDays = (from, to) => {
    if (from === to) return 0;
    
    // Check both directions
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    
    return PLANET_DISTANCES[key1] || PLANET_DISTANCES[key2] || 5; // Default 5 days
};

function FleetTab() {
    const { user } = useAuth();
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
        setSelectedVenators(prev => {
            // If this is the first selection, just add it
            if (prev.length === 0) {
                return [venatorId];
            }
            
            // If already selected, deselect it
            if (prev.includes(venatorId)) {
                return prev.filter(id => id !== venatorId);
            }
            
            // Check if new venator is at same location as already selected ones
            const firstSelectedLocation = venators[prev[0]].currentPlanet;
            const newVenatorLocation = venators[venatorId].currentPlanet;
            
            if (firstSelectedLocation !== newVenatorLocation) {
                showMessage('error', 'Cannot select Venators from different locations');
                return prev;
            }
            
            // Add to selection
            return [...prev, venatorId];
        });
    };

    const selectAll = () => {
        setSelectedVenators(Object.keys(venators));
    };

    const selectByBattalion = (battalion) => {
        const venatorIds = Object.entries(venators)
            .filter(([_, v]) => v.battalion === battalion)
            .map(([id, _]) => id);
        setSelectedVenators(venatorIds);
    };

    const selectByPlanet = (planet) => {
        const venatorIds = Object.entries(venators)
            .filter(([_, v]) => v.currentPlanet === planet)
            .map(([id, _]) => id);
        setSelectedVenators(venatorIds);
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
                
                <select onChange={(e) => {
                    if (e.target.value) {
                        selectByBattalion(e.target.value);
                        e.target.value = ''; // Reset dropdown
                    }
                }}>
                    <option value="">Select by Battalion</option>
                    {BATTALIONS.map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>
                
                <select onChange={(e) => {
                    if (e.target.value) {
                        selectByPlanet(e.target.value);
                        e.target.value = ''; // Reset dropdown
                    }
                }}>
                    <option value="">Select by Planet</option>
                    {planets.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>

            {selectedVenators.length > 0 && (
                <div className="move-panel">
                    <h4>Move Fleet ({selectedVenators.length} selected)</h4>
                    <div className="move-controls">
                        <select value={destination} onChange={(e) => {
                            setDestination(e.target.value);
                            // Auto-calculate travel days when destination changes
                            if (e.target.value && venators[selectedVenators[0]]) {
                                const from = venators[selectedVenators[0]].currentPlanet;
                                const days = calculateTravelDays(from, e.target.value);
                                setTravelDays(days);
                            }
                        }}>
                            <option value="">-- Select Destination --</option>
                            {planets.map(planet => (
                                <option key={planet} value={planet}>{planet}</option>
                            ))}
                        </select>
                        
                        {/* Show travel time but don't allow editing */}
                        <span className="travel-time">Travel Time: {travelDays} day{travelDays !== 1 ? 's' : ''}</span>
                        
                        {/* Only show instant move for admin role */}
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