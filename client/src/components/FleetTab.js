import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FleetTab.css';
import { useAuth } from '../context/AuthContext';

const BATTALIONS = ['501st', '212th', '104th', '91st', '41st Elite', '21st', 'Coruscant Guard', 'Unassigned', '442nd', '87th'];

function FleetTab() {
    const { user } = useAuth();

    //  EXISTING STATE (unchanged)
    const [fleets, setFleets] = useState({});
    const [venatorStats, setVenatorStats] = useState({ total: 0, assigned: 0, available: 0 });
    const [planets, setPlanets] = useState([]);
    const [selectedFleets, setSelectedFleets] = useState([]);
    const [destination, setDestination] = useState('');
    const travelDays = 0.25;
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
        battalions: [],
        startingPlanet: 'Coruscant',
        description: '',
        composition: { venators: 0, frigates: 0 }
    });

    //  NEW STATE (for sector overview) 
    const [planetDetails, setPlanetDetails] = useState({});

    //  EXISTING FUNCTION (unchanged) 
    const getSortedFleets = () => {
        const entries = Object.entries(fleets);
        if (sortBy === 'battalion' && sortValue) {
            const matched = entries.filter(([_, f]) => {
                const bats = f.battalions ? Object.values(f.battalions) : (f.battalion ? [f.battalion] : []);
                return bats.includes(sortValue);
            });
            const unmatched = entries.filter(([_, f]) => {
                const bats = f.battalions ? Object.values(f.battalions) : (f.battalion ? [f.battalion] : []);
                return !bats.includes(sortValue);
            });
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

    //  EXISTING FUNCTION (added setPlanetDetails)
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
            setPlanetDetails(planetsData);
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

    //  EXISTING FUNCTIONS (all unchanged) 
    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const toggleSelect = (fleetId) => {
        setSelectedFleets(prev => {
            if (prev.length === 0) return [fleetId];
            if (prev.includes(fleetId)) return prev.filter(id => id !== fleetId);
            const firstSelectedLocation = fleets[prev[0]].currentPlanet;
            const newFleetLocation = fleets[fleetId].currentPlanet;
            if (firstSelectedLocation !== newFleetLocation) {
                showMessage('error', 'Cannot select Fleets from different locations');
                return prev;
            }
            return [...prev, fleetId];
        });
    };

    const selectAll = () => setSelectedFleets(Object.keys(fleets));
    const deselectAll = () => setSelectedFleets([]);

    const moveFleet = async () => {
        if (selectedFleets.length === 0) { showMessage('error', 'No fleets selected'); return; }
        if (!destination) { showMessage('error', 'No destination selected'); return; }
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
        if (!newFleet.fleetName) { showMessage('error', 'Fleet name is required'); return; }
        if (newFleet.composition.venators > venatorStats.available) {
            showMessage('error', `Only ${venatorStats.available} Venators available`); return;
        }
        try {
            await api.post('/fleet', newFleet);
            showMessage('success', 'Fleet created successfully');
            setShowAddModal(false);
            setNewFleet({ fleetName: '', commander: '', battalion: 'Unassigned', startingPlanet: 'Coruscant', composition: { venators: 0, frigates: 0 } });
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to create fleet');
        }
    };

    const updateFleet = async () => {
        console.log('DESCRIPTION BEING SENT:', editingFleet.description);
        const venatorDifference = editingFleet.composition.venators - (fleets[editingFleet.id]?.composition?.venators || 0);
        if (venatorDifference > venatorStats.available) {
            showMessage('error', `Only ${venatorStats.available} Venators available`); return;
        }
        try {
            await api.put(`/fleet/${editingFleet.id}`, {
                fleetName: editingFleet.fleetName,
                commander: editingFleet.commander,
                battalions: editingFleet.battalions || [],
                composition: editingFleet.composition,
                description: editingFleet.description || ''
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

    //  NEW COMPUTED HELPERS 
    const fleetEntries = Object.entries(fleets);
    const transitFleets = fleetEntries.filter(([_, f]) => f.travelingTo);
    const frigateCount = fleetEntries.reduce((sum, [_, f]) => sum + (f.composition?.frigates || 0), 0);
    const transitCount = transitFleets.length;
    const totalAssets = venatorStats.total + frigateCount;

    const getTransitProgress = (fleet) => {
        if (!fleet.travelingTo) return 0;
        if (!fleet.arrivalDate) return 50;
        const arrival = new Date(fleet.arrivalDate);
        const now = new Date();
        if (now >= arrival) return 100;
        if (!fleet.departureDate) return 50;
        const departure = new Date(fleet.departureDate);
        const total = arrival - departure;
        if (total <= 0) return 100;
        return Math.min(99, Math.max(1, Math.round(((now - departure) / total) * 100)));
    };

    const getBattalionString = (fleet) => {
        if (fleet.battalions) {
            const bats = Object.values(fleet.battalions);
            return bats.length > 0 ? bats.join(', ') : '—';
        }
        return fleet.battalion || '—';
    };

    const getFleetSector = (planetName) => {
        if (!planetName || !planetDetails[planetName]) return null;
        const pd = planetDetails[planetName];
        return pd.sector || pd.sectorNumber || null;
    };

    const getFleetDate = (fleet) => {
        const dateStr = fleet.arrivalDate || fleet.created;
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        } catch { return '—'; }
    };

    const getSectors = () => {
        const sectors = {};
        Object.entries(planetDetails).forEach(([planetName, pd]) => {
            const sectorId = pd.sector || pd.sectorNumber;
            if (!sectorId) return;
            const sId = String(sectorId);
            if (!sectors[sId]) {
                sectors[sId] = {
                    id: sId,
                    planets: [],
                    status: pd.sectorStatus || 'PEACEFUL',
                    repControl: pd.repControl || 0,
                    sepControl: pd.sepControl || 0,
                    mndControl: pd.mndControl || 0,
                    assetCount: 0
                };
            }
            if (!sectors[sId].planets.includes(planetName)) sectors[sId].planets.push(planetName);
            if (pd.sectorStatus === 'CONTESTED') sectors[sId].status = 'CONTESTED';
            else if (pd.sectorStatus === 'FRONTLINE' && sectors[sId].status !== 'CONTESTED') sectors[sId].status = 'FRONTLINE';
        });
        fleetEntries.forEach(([_, fleet]) => {
            if (!fleet.travelingTo && fleet.currentPlanet) {
                const pd = planetDetails[fleet.currentPlanet];
                if (pd) {
                    const sId = String(pd.sector || pd.sectorNumber || '');
                    if (sId && sectors[sId]) sectors[sId].assetCount += 1;
                }
            }
        });
        return Object.values(sectors).sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
    };

    const sectorList = getSectors();

    if (loading) return <div className="ft-loading">LOADING FLEET DATA...</div>;

    return (
        <div className="ft-container">

            {/* ── ASSET TRACKER ── */}
            <div className="ft-asset-tracker">
                <div className="ft-tracker-title">
                    <span className="ft-title-tri">▲</span> ASSET TRACKER
                </div>
                <div className="ft-stat-cards">
                    <div className="ft-stat-card ft-card-blue">
                        <div className="ft-stat-num ft-num-blue">{venatorStats.assigned}</div>
                        <div className="ft-stat-label">VENATORS</div>
                    </div>
                    <div className="ft-stat-card ft-card-purple">
                        <div className="ft-stat-num ft-num-purple">{frigateCount}</div>
                        <div className="ft-stat-label">FRIGATES</div>
                    </div>
                    <div className="ft-stat-card ft-card-orange">
                        <div className="ft-stat-num ft-num-orange">{transitCount}</div>
                        <div className="ft-stat-label">IN TRANSIT</div>
                    </div>
                    <div className="ft-stat-card ft-card-gold">
                        <div className="ft-stat-num ft-num-gold">{totalAssets}</div>
                        <div className="ft-stat-label">TOTAL ASSETS</div>
                    </div>
                </div>
                <div className="ft-travel-banner">
                    <span className="ft-tb-label">TRAVEL TIMES:</span>
                    <span className="ft-tb-item">Within Sector: <strong>2h</strong></span>
                    <span className="ft-tb-item">Next Sector: <strong>12h</strong></span>
                    <span className="ft-tb-item">Each Additional: <strong>+6h</strong></span>
                    <span className="ft-tb-right">Damage logged after every PD · SoL PDs repair 30%</span>
                </div>
            </div>

            {/*  MESSAGE  */}
            {message.text && (
                <div className={`ft-message ft-msg-${message.type}`}>{message.text}</div>
            )}

            {/*  GALACTIC SECTOR OVERVIEW (renders only if planet data has sector fields)  */}
            {sectorList.length > 0 && (
                <div className="ft-sector-section">
                    <div className="ft-section-header">
                        <span className="ft-hdr-diamond">✦</span> GALACTIC SECTOR OVERVIEW
                    </div>
                    <div className="ft-sector-grid">
                        {sectorList.map((sector) => (
                            <div key={sector.id} className={`ft-sector-card ft-sec-${sector.status.toLowerCase()}`}>
                                <div className="ft-sc-top">
                                    <span className="ft-sc-name">Sector {sector.id}</span>
                                    <span className={`ft-sc-status ft-st-${sector.status.toLowerCase()}`}>{sector.status}</span>
                                </div>
                                <div className="ft-sc-planets">{sector.planets.join(', ')}</div>
                                <div className="ft-sc-control">
                                    {sector.repControl > 0 && <span className="ft-ctrl-rep">REP {sector.repControl}%</span>}
                                    {sector.sepControl > 0 && <span className="ft-ctrl-sep">SEP {sector.sepControl}%</span>}
                                    {sector.mndControl > 0 && <span className="ft-ctrl-mnd">MND {sector.mndControl}%</span>}
                                    {!sector.repControl && !sector.sepControl && !sector.mndControl && (
                                        <span className="ft-ctrl-none">Unclaimed</span>
                                    )}
                                    {sector.assetCount > 0 && (
                                        <span className="ft-sc-assets">{sector.assetCount} assets present</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/*  ACTIVE HYPERSPACE ROUTES  */}
            {transitFleets.length > 0 && (
                <div className="ft-routes-section">
                    <div className="ft-section-header">
                        <span className="ft-hdr-diamond">✦</span> ACTIVE HYPERSPACE ROUTES
                    </div>
                    {transitFleets.map(([id, fleet]) => {
                        const pct = getTransitProgress(fleet);
                        const barColor = pct >= 100 ? '#00c853' : '#ff9800';
                        return (
                            <div key={id} className="ft-route-entry">
                                <div className="ft-route-top">
                                    <span className="ft-route-name">{fleet.fleetName || id}</span>
                                    <span className="ft-route-path">
                                        {fleet.currentPlanet} → <span className="ft-route-dest">{fleet.travelingTo}</span>
                                    </span>
                                    <span className="ft-route-pct" style={{ color: barColor }}>{pct}%</span>
                                    {pct >= 100 && (
                                        <button onClick={loadData} className="ft-btn-confirm">CONFIRM ARRIVAL</button>
                                    )}
                                </div>
                                <div className="ft-prog-wrap">
                                    <div className="ft-prog-bar" style={{ width: `${pct}%`, background: barColor }} />
                                </div>
                                {fleet.arrivalDate && (
                                    <div className="ft-route-eta">ETA: {new Date(fleet.arrivalDate).toLocaleString()}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/*  FLEET CONTROLS  */}
            <div className="ft-controls">
                <button onClick={() => setShowAddModal(true)} className="ft-btn ft-btn-add">+ ADD FLEET</button>
                <button onClick={selectAll} className="ft-btn ft-btn-select">SELECT ALL</button>
                <button onClick={deselectAll} className="ft-btn ft-btn-deselect">DESELECT ALL</button>
                <select className="ft-select" onChange={(e) => {
                    if (e.target.value) { setSortBy('battalion'); setSortValue(e.target.value); }
                    else { setSortBy('default'); setSortValue(''); }
                }} value={sortBy === 'battalion' ? sortValue : ''}>
                    <option value="">Group by Battalion</option>
                    {BATTALIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select className="ft-select" onChange={(e) => {
                    if (e.target.value) { setSortBy('planet'); setSortValue(e.target.value); }
                    else { setSortBy('default'); setSortValue(''); }
                }} value={sortBy === 'planet' ? sortValue : ''}>
                    <option value="">Group by Planet</option>
                    {planets.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="ft-venator-stat">
                    VENATORS: <strong>{venatorStats.available}</strong>/{venatorStats.total} available
                </span>
            </div>

            {/*  MOVE PANEL  */}
            {selectedFleets.length > 0 && (
                <div className="ft-move-panel">
                    <div className="ft-move-title">◈ HYPERSPACE DISPATCH — {selectedFleets.length} UNIT(S) SELECTED</div>
                    <div className="ft-move-controls">
                        <select className="ft-select" value={destination} onChange={(e) => setDestination(e.target.value)}>
                            <option value="">— SELECT DESTINATION —</option>
                            {planets.filter(p => planetAccess[p] !== false).map(planet => (
                                <option key={planet} value={planet}>{planet}</option>
                            ))}
                        </select>
                        <span className="ft-travel-badge">TRAVEL TIME: 6H</span>
                        {user?.role === 'admin' && (
                            <label className="ft-instant-label">
                                <input type="checkbox" checked={instantMove} onChange={(e) => setInstantMove(e.target.checked)} />
                                INSTANT MOVE (ADMIN)
                            </label>
                        )}
                        <button onClick={moveFleet} className="ft-btn ft-btn-move">DISPATCH</button>
                        <button onClick={deselectAll} className="ft-btn ft-btn-cancel">CANCEL</button>
                    </div>
                </div>
            )}

            {/*  FLEET TABLE  */}
            <div className="ft-fleet-section">
                <div className="ft-fleet-sec-title">FLEETS</div>
                <div className="ft-fleet-sub-hdr">FLEET ROSTER</div>
                <div className="ft-fleet-table">
                    {getSortedFleets().map(([id, fleet]) => {
                        const isTransit = !!fleet.travelingTo;
                        const pct = isTransit ? getTransitProgress(fleet) : null;
                        const sector = getFleetSector(fleet.currentPlanet);
                        const fleetDate = getFleetDate(fleet);
                        return (
                            <div
                                key={id}
                                className={`ft-fleet-row${selectedFleets.includes(id) ? ' ft-row-selected' : ''}${isTransit ? ' ft-row-transit' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    className="ft-checkbox"
                                    checked={selectedFleets.includes(id)}
                                    onChange={() => toggleSelect(id)}
                                />
                                <span className="ft-row-icon">{fleet.composition?.venators > 0 ? '▲' : '●'}</span>
                                <div className="ft-row-name-col">
                                    <span className="ft-row-name">{fleet.fleetName || id}</span>
                                    {fleet.commander && <span className="ft-row-cmdr">{fleet.commander}</span>}
                                </div>
                                <span className="ft-row-dash">–</span>
                                <div className="ft-row-loc-col">
                                    {isTransit ? (
                                        <>
                                            <div className="ft-row-transit-line">
                                                Hyperspace → <span className="ft-row-transit-dest">{fleet.travelingTo}</span>
                                            </div>
                                            <div className="ft-row-prog-line">
                                                <div className="ft-row-prog-track">
                                                    <div className="ft-row-prog-fill" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="ft-row-prog-pct">{pct}%</span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="ft-row-planet">{fleet.currentPlanet || '—'}</span>
                                    )}
                                </div>
                                <span className="ft-row-sector">{sector ? `Sector ${sector}` : ''}</span>
                                <span className="ft-row-date">{fleetDate}</span>
                                <div className="ft-row-actions">
                                    {!isTransit && (
                                        <button
                                            onClick={() => { deselectAll(); setSelectedFleets([id]); }}
                                            className="ft-btn-sm ft-bsm-move"
                                        >MOVE</button>
                                    )}
                                    <button
                                        onClick={() => setEditingFleet({
                                            id, ...fleet,
                                            battalions: fleet.battalions
                                                ? Object.values(fleet.battalions)
                                                : (fleet.battalion ? [fleet.battalion] : [])
                                        })}
                                        className="ft-btn-sm ft-bsm-edit"
                                    >EDIT</button>
                                    <button onClick={() => deleteFleet(id)} className="ft-btn-sm ft-bsm-del">DEL</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/*  ADD FLEET MODAL  */}
            {showAddModal && (
                <div className="ft-modal">
                    <div className="ft-modal-content">
                        <div className="ft-modal-title">◈ ADD NEW FLEET</div>
                        <input className="ft-input" type="text" placeholder="Fleet Name (e.g., 7th Sky Corps)"
                            value={newFleet.fleetName}
                            onChange={(e) => setNewFleet({ ...newFleet, fleetName: e.target.value })} />
                        <input className="ft-input" type="text" placeholder="Commander (e.g., Obi-Wan Kenobi)"
                            value={newFleet.commander}
                            onChange={(e) => setNewFleet({ ...newFleet, commander: e.target.value })} />
                        <div className="ft-bat-section">
                            <div className="ft-bat-label">BATTALIONS</div>
                            <div className="ft-bat-grid">
                                {BATTALIONS.map(b => (
                                    <label key={b} className="ft-bat-item">
                                        <input type="checkbox"
                                            checked={newFleet.battalions.includes(b)}
                                            onChange={(e) => {
                                                const updated = e.target.checked
                                                    ? [...newFleet.battalions, b]
                                                    : newFleet.battalions.filter(x => x !== b);
                                                setNewFleet({ ...newFleet, battalions: updated });
                                            }} />
                                        {b}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <select className="ft-input" value={newFleet.startingPlanet}
                            onChange={(e) => setNewFleet({ ...newFleet, startingPlanet: e.target.value })}>
                            {planets.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input className="ft-input" type="number" min="0" max={venatorStats.available}
                            placeholder={`Venators (${venatorStats.available} available)`}
                            value={newFleet.composition.venators || ''}
                            onChange={(e) => setNewFleet({ ...newFleet, composition: { ...newFleet.composition, venators: parseInt(e.target.value) || 0 } })} />
                        <input className="ft-input" type="number" min="0" placeholder="Frigates"
                            value={newFleet.composition.frigates || ''}
                            onChange={(e) => setNewFleet({ ...newFleet, composition: { ...newFleet.composition, frigates: parseInt(e.target.value) || 0 } })} />
                        <textarea className="ft-textarea" placeholder="Fleet description (optional)" rows={3}
                            value={newFleet.description || ''}
                            onChange={(e) => setNewFleet({ ...newFleet, description: e.target.value })} />
                        <div className="ft-modal-actions">
                            <button onClick={addFleet} className="ft-btn ft-btn-save">CREATE FLEET</button>
                            <button onClick={() => setShowAddModal(false)} className="ft-btn ft-btn-cancel">CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/*  EDIT FLEET MODAL  */}
            {editingFleet && (
                <div className="ft-modal">
                    <div className="ft-modal-content">
                        <div className="ft-modal-title">◈ EDIT FLEET</div>
                        <input className="ft-input" type="text" placeholder="Fleet Name"
                            value={editingFleet.fleetName}
                            onChange={(e) => setEditingFleet({ ...editingFleet, fleetName: e.target.value })} />
                        <input className="ft-input" type="text" placeholder="Commander"
                            value={editingFleet.commander || ''}
                            onChange={(e) => setEditingFleet({ ...editingFleet, commander: e.target.value })} />
                        <div className="ft-bat-section">
                            <div className="ft-bat-label">BATTALIONS</div>
                            <div className="ft-bat-grid">
                                {BATTALIONS.map(b => (
                                    <label key={b} className="ft-bat-item">
                                        <input type="checkbox"
                                            checked={(Array.isArray(editingFleet.battalions)
                                                ? editingFleet.battalions
                                                : Object.values(editingFleet.battalions || {})).includes(b)}
                                            onChange={(e) => {
                                                const current = Array.isArray(editingFleet.battalions)
                                                    ? editingFleet.battalions
                                                    : Object.values(editingFleet.battalions || {});
                                                const updated = e.target.checked ? [...current, b] : current.filter(x => x !== b);
                                                setEditingFleet({ ...editingFleet, battalions: updated });
                                            }} />
                                        {b}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <input className="ft-input" type="number" min="0" placeholder="Venators"
                            value={editingFleet.composition?.venators || ''}
                            onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, venators: parseInt(e.target.value) || 0 } })} />
                        <input className="ft-input" type="number" min="0" placeholder="Frigates"
                            value={editingFleet.composition?.frigates || ''}
                            onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, frigates: parseInt(e.target.value) || 0 } })} />
                        <textarea className="ft-textarea" placeholder="Fleet description (optional)" rows={3}
                            value={editingFleet.description || ''}
                            onChange={(e) => setEditingFleet({ ...editingFleet, description: e.target.value })} />
                        <div className="ft-modal-actions">
                            <button onClick={updateFleet} className="ft-btn ft-btn-save">SAVE CHANGES</button>
                            <button onClick={() => setEditingFleet(null)} className="ft-btn ft-btn-cancel">CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default FleetTab;
