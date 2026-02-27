import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FleetTab.css';

const CIS_GROUPS = ['Grievous Fleet', 'Dooku Command', 'Muun Banking Clan', 'Trade Federation', 'Techno Union', 'Unassigned'];

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

function CISFleetTab() {
    const [fleets, setFleets] = useState({});
    const [planets, setPlanets] = useState([]);
    const [selectedFleets, setSelectedFleets] = useState([]);
    const [destination, setDestination] = useState('');
    const [travelDays, setTravelDays] = useState(3);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [editingFleet, setEditingFleet] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortBy, setSortBy] = useState('default');
    const [sortValue, setSortValue] = useState('');
    const [instantMove, setInstantMove] = useState(false);

    const [newFleet, setNewFleet] = useState({
        fleetName: '',
        commander: '',
        group: 'Unassigned',
        startingPlanet: 'Geonosis',
        description: '',
        composition: { dreadnoughts: 0, munificents: 0, providences: 0 }
    });

    const getSortedFleets = () => {
        const entries = Object.entries(fleets);
        if (sortBy === 'group' && sortValue) {
            const matched = entries.filter(([_, f]) => f.group === sortValue);
            const unmatched = entries.filter(([_, f]) => f.group !== sortValue);
            return [...matched, ...unmatched];
        }
        if (sortBy === 'planet' && sortValue) {
            const matched = entries.filter(([_, f]) => f.currentPlanet === sortValue);
            const unmatched = entries.filter(([_, f]) => f.currentPlanet !== sortValue);
            return [...matched, ...unmatched];
        }
        return entries;
    };

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [fleetRes, mapRes] = await Promise.all([
                api.get('/cisfleet'),
                api.get('/mapdata')
            ]);
            setFleets(fleetRes.data.fleets || {});
            setPlanets(Object.keys(mapRes.data.planets || {}));
            setLoading(false);
        } catch (error) {
            showMessage('error', 'Failed to load CIS fleet data');
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const toggleSelect = (fleetId) => {
        setSelectedFleets(prev => {
            if (prev.length === 0) return [fleetId];
            if (prev.includes(fleetId)) return prev.filter(id => id !== fleetId);
            const firstLoc = fleets[prev[0]].currentPlanet;
            const newLoc = fleets[fleetId].currentPlanet;
            if (firstLoc !== newLoc) {
                showMessage('error', 'Cannot select fleets from different locations');
                return prev;
            }
            return [...prev, fleetId];
        });
    };

    const moveFleet = async () => {
        if (selectedFleets.length === 0) return showMessage('error', 'No fleets selected');
        if (!destination) return showMessage('error', 'No destination selected');
        try {
            const response = await api.post('/cisfleet/move', {
                fleetIds: selectedFleets,
                destination,
                travelDays,
                instantMove
            });
            showMessage('success', response.data.message);
            setSelectedFleets([]);
            setDestination('');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to move fleet');
        }
    };

    const addFleet = async () => {
        if (!newFleet.fleetName) return showMessage('error', 'Fleet name is required');
        try {
            await api.post('/cisfleet', newFleet);
            showMessage('success', 'CIS Fleet created successfully');
            setShowAddModal(false);
            setNewFleet({ fleetName: '', commander: '', group: 'Unassigned', startingPlanet: 'Geonosis', description: '', composition: { lucrehulks: 0, frigates: 0 } });
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to create fleet');
        }
    };

    const updateFleet = async () => {
        try {
            await api.put(`/cisfleet/${editingFleet.id}`, {
                fleetName: editingFleet.fleetName,
                commander: editingFleet.commander,
                group: editingFleet.group,
                description: editingFleet.description || '',
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
            await api.delete(`/cisfleet/${fleetId}`);
            showMessage('success', 'Fleet deleted');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to delete fleet');
        }
    };

    if (loading) return <div className="loading">Loading CIS fleet data...</div>;

    return (
        <div className="fleet-tab">
            <h3>CIS Fleet Management</h3>

            {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

            <div className="fleet-controls">
                <button onClick={() => setShowAddModal(true)} className="btn-add">Add New Fleet</button>
                <button onClick={() => setSelectedFleets(Object.keys(fleets))} className="btn-select-all">Select All</button>
                <button onClick={() => setSelectedFleets([])} className="btn-deselect-all">Deselect All</button>

                <select onChange={(e) => { setSortBy(e.target.value ? 'group' : 'default'); setSortValue(e.target.value); }} value={sortBy === 'group' ? sortValue : ''}>
                    <option value="">Group by Faction</option>
                    {CIS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>

                <select onChange={(e) => { setSortBy(e.target.value ? 'planet' : 'default'); setSortValue(e.target.value); }} value={sortBy === 'planet' ? sortValue : ''}>
                    <option value="">Group by Planet</option>
                    {planets.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>

            {selectedFleets.length > 0 && (
                <div className="move-panel">
                    <h4>Move Fleet ({selectedFleets.length} selected)</h4>
                    <div className="move-controls">
                        <select value={destination} onChange={(e) => {
                            setDestination(e.target.value);
                            if (e.target.value && fleets[selectedFleets[0]]) {
                                setTravelDays(calculateTravelDays(fleets[selectedFleets[0]].currentPlanet, e.target.value));
                            }
                        }}>
                            <option value="">-- Select Destination --</option>
                            {planets.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <span className="travel-time">Travel Time: {travelDays} day{travelDays !== 1 ? 's' : ''}</span>
                        <label>
                            <input
                                type="checkbox"
                                checked={instantMove}
                                onChange={(e) => setInstantMove(e.target.checked)}
                            />
                            Instant Move
                        </label>
                        <button onClick={moveFleet} className="btn-move">Move Fleet</button>
                    </div>
                </div>
            )}

            <div className="fleet-list">
                {getSortedFleets().map(([id, fleet]) => (
                    <div key={id} className={`venator-card ${selectedFleets.includes(id) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={selectedFleets.includes(id)} onChange={() => toggleSelect(id)} />
                        <div className="venator-info">
                            <h4>{fleet.fleetName || id}</h4>
                            <p><strong>Commander:</strong> {fleet.commander || 'None'}</p>
                            <p><strong>Faction Group:</strong> {fleet.group}</p>
                            <p><strong>Composition:</strong> {fleet.composition?.dreadnoughts || 0} Dreadnoughts, {fleet.composition?.munificents || 0} Munificents, {fleet.composition?.providences || 0} Providences</p>
                            <p><strong>Location:</strong> {fleet.currentPlanet}</p>
                            {fleet.description && <p><strong>Description:</strong> {fleet.description}</p>}
                            {fleet.travelingTo && (
                                <p className="in-transit">In Transit to {fleet.travelingTo} - Arrives {new Date(fleet.arrivalDate).toLocaleDateString()}</p>
                            )}
                        </div>
                        <div className="venator-actions">
                            <button onClick={() => setEditingFleet({ id, ...fleet })} className="btn-edit">Edit</button>
                            <button onClick={() => deleteFleet(id)} className="btn-delete">Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {showAddModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h4>Add New CIS Fleet</h4>
                        <input type="text" placeholder="Fleet Name (e.g., Invisible Hand)" value={newFleet.fleetName} onChange={(e) => setNewFleet({ ...newFleet, fleetName: e.target.value })} />
                        <input type="text" placeholder="Commander (e.g., General Grievous)" value={newFleet.commander} onChange={(e) => setNewFleet({ ...newFleet, commander: e.target.value })} />
                        <select value={newFleet.group} onChange={(e) => setNewFleet({ ...newFleet, group: e.target.value })}>
                            {CIS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select value={newFleet.startingPlanet} onChange={(e) => setNewFleet({ ...newFleet, startingPlanet: e.target.value })}>
                            {planets.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input type="number" min="0" placeholder="Dreadnoughts" value={editingFleet.composition?.dreadnoughts || ''} onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, dreadnoughts: parseInt(e.target.value) || 0 } })} />
                        <input type="number" min="0" placeholder="Munificents" value={editingFleet.composition?.munificents || ''} onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, munificents: parseInt(e.target.value) || 0 } })} />
                        <input type="number" min="0" placeholder="Providences" value={editingFleet.composition?.providences || ''} onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, providences: parseInt(e.target.value) || 0 } })} />
                        <textarea placeholder="Fleet description (optional)" value={newFleet.description || ''} onChange={(e) => setNewFleet({ ...newFleet, description: e.target.value })} rows={3} />
                        <div className="modal-actions">
                            <button onClick={addFleet} className="btn-save">Create Fleet</button>
                            <button onClick={() => setShowAddModal(false)} className="btn-cancel">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {editingFleet && (
                <div className="modal">
                    <div className="modal-content">
                        <h4>Edit CIS Fleet</h4>
                        <input type="text" placeholder="Fleet Name" value={editingFleet.fleetName} onChange={(e) => setEditingFleet({ ...editingFleet, fleetName: e.target.value })} />
                        <input type="text" placeholder="Commander" value={editingFleet.commander || ''} onChange={(e) => setEditingFleet({ ...editingFleet, commander: e.target.value })} />
                        <select value={editingFleet.group} onChange={(e) => setEditingFleet({ ...editingFleet, group: e.target.value })}>
                            {CIS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <input type="number" min="0" placeholder="Lucrehulks" value={editingFleet.composition?.lucrehulks || ''} onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, lucrehulks: parseInt(e.target.value) || 0 } })} />
                        <input type="number" min="0" placeholder="Frigates" value={editingFleet.composition?.frigates || ''} onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, frigates: parseInt(e.target.value) || 0 } })} />
                        <textarea placeholder="Fleet description (optional)" value={editingFleet.description || ''} onChange={(e) => setEditingFleet({ ...editingFleet, description: e.target.value })} rows={3} />
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

export default CISFleetTab;