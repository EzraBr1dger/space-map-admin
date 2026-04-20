import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './CISFleetTab.css';
import { useAuth } from '../context/AuthContext';

const CIS_GROUPS = [
    'Grievous Fleet', 'Dooku Command', 'Muun Banking Clan',
    'Trade Federation', 'Techno Union', 'Unassigned'
];

function CISFleetTab() {
    const { user } = useAuth();

    const [fleets, setFleets] = useState({});
    const [planets, setPlanets] = useState([]);
    const [selectedFleets, setSelectedFleets] = useState([]);
    const [destination, setDestination] = useState('');
    const [travelDays, setTravelDays] = useState(3);
    const [instantMove, setInstantMove] = useState(false);
    const [instantProgress, setInstantProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [editingFleet, setEditingFleet] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortBy, setSortBy] = useState('default');
    const [sortValue, setSortValue] = useState('');
    const [planetAccess, setPlanetAccess] = useState({});
    const [now, setNow] = useState(Date.now());
    const [editTab, setEditTab] = useState('info');
    const [viewingFleet, setViewingFleet] = useState(null);

    const [newFleet, setNewFleet] = useState({
        fleetName: '',
        commander: '',
        group: 'Unassigned',
        startingPlanet: 'Geonosis',
        description: '',
        composition: { lucrehulks: 0, munificents: 0, providences: 0 }
    });

    // 1-second clock keeps transit progress bars live
    useEffect(() => {
        const clock = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(clock);
    }, []);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [fleetRes, mapRes] = await Promise.all([
                api.get('/cisfleet'),
                api.get('/mapdata')
            ]);
            setFleets(fleetRes.data.fleets || {});
            const planetsData = mapRes.data.planets || {};
            setPlanets(Object.keys(planetsData));
            const access = {};
            for (const [name, data] of Object.entries(planetsData)) {
                access[name] = data.cisAccessible !== false;
            }
            setPlanetAccess(access);
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

    const getSortedFleets = () => {
        const entries = Object.entries(fleets);
        if (sortBy === 'group' && sortValue) {
            const matched   = entries.filter(([_, f]) => f.group === sortValue);
            const unmatched = entries.filter(([_, f]) => f.group !== sortValue);
            return [...matched, ...unmatched];
        }
        if (sortBy === 'planet' && sortValue) {
            const matched   = entries.filter(([_, f]) => f.currentPlanet === sortValue);
            const unmatched = entries.filter(([_, f]) => f.currentPlanet !== sortValue);
            return [...matched, ...unmatched];
        }
        return entries;
    };

    const toggleSelect = (fleetId) => {
        setSelectedFleets(prev => {
            if (prev.length === 0) return [fleetId];
            if (prev.includes(fleetId)) return prev.filter(id => id !== fleetId);
            const firstLoc = fleets[prev[0]].currentPlanet;
            const newLoc   = fleets[fleetId].currentPlanet;
            if (firstLoc !== newLoc) {
                showMessage('error', 'Cannot select fleets from different locations');
                return prev;
            }
            return [...prev, fleetId];
        });
    };

    const selectAll   = () => setSelectedFleets(Object.keys(fleets));
    const deselectAll = () => setSelectedFleets([]);

    // Transit progress driven by real backend timestamps
    const getTransitProgress = (fleet) => {
        if (!fleet.travelingTo) return 0;
        if (!fleet.arrivalDate) return 50;
        const arrival = new Date(fleet.arrivalDate).getTime();
        if (now >= arrival) return 100;
        if (!fleet.departureDate) return 50;
        const departure = new Date(fleet.departureDate).getTime();
        const total = arrival - departure;
        if (total <= 0) return 100;
        return Math.min(99, Math.max(1, Math.round(((now - departure) / total) * 100)));
    };

    // Admin bar: 0-25% red 25-50% orange 50-75% yellow 75-100% green
    const getInstantBarColor = (pct) => {
        if (pct < 25) return '#f44336';
        if (pct < 50) return '#ff9800';
        if (pct < 75) return '#ffeb3b';
        return '#4caf50';
    };

    const moveFleet = async () => {
        if (selectedFleets.length === 0) { showMessage('error', 'No fleets selected'); return; }
        if (!destination) { showMessage('error', 'No destination selected'); return; }

        const payload = { fleetIds: [...selectedFleets], destination, travelDays, instantMove };

        const doDispatch = async () => {
            try {
                const response = await api.post('/cisfleet/move', payload);
                showMessage('success', response.data.message);
                setInstantProgress(null);
                deselectAll();
                setDestination('');
                await loadData();
            } catch (error) {
                setInstantProgress(null);
                showMessage('error', error.response?.data?.error || 'Failed to move fleet');
            }
        };

        if (instantMove) {
            setInstantProgress(0);
            const startTime = Date.now();
            const duration  = 10000;
            const tick = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const pct = Math.min(100, Math.round((elapsed / duration) * 100));
                setInstantProgress(pct);
                if (pct >= 100) { clearInterval(tick); doDispatch(); }
            }, 100);
            return;
        }

        await doDispatch();
    };

    const addFleet = async () => {
        if (!newFleet.fleetName) { showMessage('error', 'Fleet name is required'); return; }
        try {
            await api.post('/cisfleet', newFleet);
            showMessage('success', 'CIS Fleet created successfully');
            setShowAddModal(false);
            setNewFleet({
                fleetName: '', commander: '', group: 'Unassigned',
                startingPlanet: 'Geonosis', description: '',
                composition: { lucrehulks: 0, munificents: 0, providences: 0 }
            });
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to create fleet');
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

    const saveFleetInfo = async () => {
        try {
            await api.put(`/cisfleet/${editingFleet.id}`, {
                fleetName:   editingFleet.fleetName,
                commander:   editingFleet.commander  || '',
                group:       editingFleet.group      || 'Unassigned',
                description: editingFleet.description || '',
                composition: fleets[editingFleet.id]?.composition || editingFleet.composition
            });
            showMessage('success', 'Fleet info saved');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to save fleet info');
        }
    };

    const saveFleetComposition = async () => {
        try {
            const f = fleets[editingFleet.id];
            await api.put(`/cisfleet/${editingFleet.id}`, {
                fleetName:   f.fleetName,
                commander:   f.commander   || '',
                group:       f.group       || 'Unassigned',
                description: f.description || '',
                composition: editingFleet.composition
            });
            showMessage('success', 'Composition saved');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to save composition');
        }
    };

    const togglePlanetAccess = async (planetName) => {
        const newValue = !planetAccess[planetName];
        setPlanetAccess(prev => ({ ...prev, [planetName]: newValue }));
        try {
            await api.patch('/mapdata/planet-access', { planetName, cisAccessible: newValue });
        } catch (error) {
            showMessage('error', 'Failed to update planet access');
            setPlanetAccess(prev => ({ ...prev, [planetName]: !newValue }));
        }
    };

    //  Computed values 
    const fleetEntries = Object.entries(fleets);
    const transitFleets = fleetEntries.filter(([_, f]) => f.travelingTo);
    const transitCount  = transitFleets.length;
    const totalFleets   = fleetEntries.length;

    // Sum all CIS ship types across all fleets
    const totalShips = fleetEntries.reduce((sum, [_, f]) => {
        const c = f.composition || {};
        return sum + (c.lucrehulks || 0) + (c.munificents || 0) + (c.providences || 0) + (c.dreadnoughts || 0) + (c.frigates || 0);
    }, 0);

    // Unique active faction groups
    const activeFactions = new Set(
        fleetEntries.map(([_, f]) => f.group).filter(g => g && g !== 'Unassigned')
    ).size;

    if (loading) return <div className="ft-loading">LOADING CIS FLEET DATA...</div>;

    return (
        <div className="cis-theme">

            {/*  ASSET TRACKER  */}
            <div className="ft-asset-tracker">
                <div className="ft-tracker-title">
                    <span className="ft-title-tri">◆</span> CIS FLEET COMMAND
                </div>
                <div className="ft-stat-cards">
                    <div className="ft-stat-card ft-card-red">
                        <div className="ft-stat-num ft-num-red">{totalFleets}</div>
                        <div className="ft-stat-label">TOTAL FLEETS</div>
                    </div>
                    <div className="ft-stat-card ft-card-maroon">
                        <div className="ft-stat-num ft-num-maroon">{totalShips}</div>
                        <div className="ft-stat-label">TOTAL SHIPS</div>
                    </div>
                    <div className="ft-stat-card ft-card-orange">
                        <div className="ft-stat-num ft-num-orange">{transitCount}</div>
                        <div className="ft-stat-label">IN TRANSIT</div>
                    </div>
                    <div className="ft-stat-card ft-card-dim">
                        <div className="ft-stat-num ft-num-red" style={{ opacity: 0.6 }}>{activeFactions}</div>
                        <div className="ft-stat-label">FACTIONS ACTIVE</div>
                    </div>
                </div>
            </div>

            {/*  MESSAGE  */}
            {message.text && (
                <div className={`ft-message ft-msg-${message.type}`}>{message.text}</div>
            )}

            {/*  ACTIVE HYPERSPACE ROUTES  */}
            {transitFleets.length > 0 && (
                <div className="ft-routes-section">
                    <div className="ft-section-header">
                        <span className="ft-hdr-diamond">◆</span> ACTIVE HYPERSPACE ROUTES
                    </div>
                    {transitFleets.map(([id, fleet]) => {
                        const pct = getTransitProgress(fleet);
                        const barColor = pct >= 100 ? '#c62828' : '#ff9800';
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
                <button onClick={selectAll}   className="ft-btn ft-btn-select">SELECT ALL</button>
                <button onClick={deselectAll} className="ft-btn ft-btn-deselect">DESELECT ALL</button>

                <select className="ft-select" onChange={(e) => {
                    if (e.target.value) { setSortBy('group');  setSortValue(e.target.value); }
                    else               { setSortBy('default'); setSortValue(''); }
                }} value={sortBy === 'group' ? sortValue : ''}>
                    <option value="">Group by Faction</option>
                    {CIS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>

                <select className="ft-select" onChange={(e) => {
                    if (e.target.value) { setSortBy('planet'); setSortValue(e.target.value); }
                    else               { setSortBy('default'); setSortValue(''); }
                }} value={sortBy === 'planet' ? sortValue : ''}>
                    <option value="">Group by Planet</option>
                    {planets.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>

            {/*  MOVE PANEL  */}
            {selectedFleets.length > 0 && (
                <div className="ft-move-panel">
                    <div className="ft-move-title">◈ HYPERSPACE DISPATCH — {selectedFleets.length} UNIT(S) SELECTED</div>
                    <div className="ft-move-controls">
                        <select className="ft-select" value={destination} onChange={(e) => {
                            setDestination(e.target.value);
                            if (e.target.value && selectedFleets.length > 0) {
                                // Basic travel time: keep existing travelDays as-is from state
                            }
                        }}>
                            <option value="">— SELECT DESTINATION —</option>
                            {planets.filter(p => planetAccess[p] !== false).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <span className="ft-travel-badge">
                            TRAVEL: {travelDays} day{travelDays !== 1 ? 's' : ''}
                        </span>
                        {/* Manual travel days input for CIS (no sector map) */}
                        <input
                            type="number"
                            min="1"
                            value={travelDays}
                            onChange={e => setTravelDays(Math.max(1, parseInt(e.target.value) || 1))}
                            style={{
                                width: 60, padding: '5px 8px', borderRadius: 1,
                                border: '1px solid rgba(229,57,53,0.2)',
                                background: 'rgba(30,0,0,0.22)', color: '#c0cfe0',
                                fontFamily: 'Courier New', fontSize: '0.78rem'
                            }}
                        />
                        {user?.role === 'admin' && (
                            <label className="ft-instant-label">
                                <input
                                    type="checkbox"
                                    checked={instantMove}
                                    onChange={e => setInstantMove(e.target.checked)}
                                    disabled={instantProgress !== null}
                                />
                                INSTANT MOVE (ADMIN)
                            </label>
                        )}
                        <button onClick={moveFleet} className="ft-btn ft-btn-move" disabled={instantProgress !== null}>DISPATCH</button>
                        <button onClick={deselectAll} className="ft-btn ft-btn-cancel" disabled={instantProgress !== null}>CANCEL</button>
                    </div>
                    {instantProgress !== null && (
                        <div className="ft-instant-prog-wrap">
                            <div className="ft-instant-prog-label">ADMIN DISPATCH IN PROGRESS — {instantProgress}%</div>
                            <div className="ft-instant-prog-track">
                                <div
                                    className="ft-instant-prog-fill"
                                    style={{ width: `${instantProgress}%`, background: getInstantBarColor(instantProgress) }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/*  FLEET CARDS  */}
            <div className="ft-fleet-section">
                <div className="ft-fleet-sec-title">CIS FLEET ROSTER</div>

                {getSortedFleets().length === 0 ? (
                    <div style={{ padding: '24px 16px', color: 'rgba(192,207,224,0.3)', fontSize: '0.8rem', letterSpacing: '1px' }}>
                        No fleets on record.
                    </div>
                ) : (
                    <div className="cis-fleet-grid">
                        {getSortedFleets().map(([id, fleet]) => {
                            const isTransit = !!fleet.travelingTo;
                            const pct = isTransit ? getTransitProgress(fleet) : null;

                            // Build composition string
                            const c = fleet.composition || {};
                            const compParts = [];
                            if (c.lucrehulks  > 0) compParts.push(`${c.lucrehulks} Lucrehulk${c.lucrehulks  !== 1 ? 's' : ''}`);
                            if (c.dreadnoughts > 0) compParts.push(`${c.dreadnoughts} Dreadnought${c.dreadnoughts !== 1 ? 's' : ''}`);
                            if (c.munificents > 0) compParts.push(`${c.munificents} Munificent${c.munificents !== 1 ? 's' : ''}`);
                            if (c.providences > 0) compParts.push(`${c.providences} Providence${c.providences !== 1 ? 's' : ''}`);
                            if (c.frigates    > 0) compParts.push(`${c.frigates} Frigate${c.frigates    !== 1 ? 's' : ''}`);
                            const compStr = compParts.length > 0 ? compParts.join(' · ') : '—';

                            return (
                                <div
                                    key={id}
                                    className={`cis-fleet-card${selectedFleets.includes(id) ? ' cis-card-selected' : ''}${isTransit ? ' cis-card-transit' : ''}`}
                                >
                                    {/*  CARD HEADER  two rows  */}
                                    <div className="cis-card-header">
                                        {/* Row 1: checkbox + fleet name — full width, never shares space with buttons */}
                                        <div className="cis-header-row1">
                                            <input
                                                type="checkbox"
                                                className="ft-checkbox"
                                                checked={selectedFleets.includes(id)}
                                                onChange={() => toggleSelect(id)}
                                            />
                                            <span className="cis-fleet-name">{fleet.fleetName || id}</span>
                                        </div>
                                        {/* Row 2: group tag left, action buttons right */}
                                        <div className="cis-header-row2">
                                            <div className="cis-header-tag-area">
                                                {fleet.group && fleet.group !== 'Unassigned' && (
                                                    <span className="cis-group-tag">{fleet.group}</span>
                                                )}
                                            </div>
                                            <div className="ft-row-actions">
                                                <button
                                                    onClick={() => setViewingFleet({ id, ...fleet })}
                                                    className="ft-btn-sm cis-bsm-view"
                                                >VIEW</button>
                                                {!isTransit && (
                                                    <button
                                                        onClick={() => { deselectAll(); setSelectedFleets([id]); }}
                                                        className="ft-btn-sm cis-bsm-move"
                                                    >MOVE</button>
                                                )}
                                                <button
                                                    onClick={() => { setEditTab('info'); setEditingFleet({ id, ...fleet }); }}
                                                    className="ft-btn-sm ft-bsm-edit"
                                                >EDIT</button>
                                                <button
                                                    onClick={() => deleteFleet(id)}
                                                    className="ft-btn-sm ft-bsm-del"
                                                >DEL</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/*  CARD BODY  */}
                                    <div className="cis-card-body">
                                        <div className="cis-card-fields">
                                            {fleet.commander && (
                                                <div className="cis-field">
                                                    <span className="cis-field-label">Commander</span>
                                                    <span className="cis-field-value">{fleet.commander}</span>
                                                </div>
                                            )}
                                            <div className="cis-field">
                                                <span className="cis-field-label">Location</span>
                                                <span className={`cis-field-value${isTransit ? ' cis-field-transit' : ' cis-field-planet'}`}>
                                                    {isTransit
                                                        ? `Hyperspace → ${fleet.travelingTo}`
                                                        : (fleet.currentPlanet || '—')}
                                                </span>
                                            </div>
                                            <div className="cis-field cis-field-wide">
                                                <span className="cis-field-label">Composition</span>
                                                <span className="cis-field-value">{compStr}</span>
                                            </div>
                                        </div>

                                        {/* Transit progress bar */}
                                        {isTransit && (
                                            <div className="cis-transit-section">
                                                <div className="cis-prog-row">
                                                    <div className="cis-prog-track">
                                                        <div className="cis-prog-fill" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="cis-prog-pct">{pct}%</span>
                                                </div>
                                                {fleet.arrivalDate && (
                                                    <div className="cis-eta">
                                                        ETA: {new Date(fleet.arrivalDate).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Description box */}
                                        {fleet.description && (
                                            <div className="cis-card-desc">
                                                <div className="cis-desc-text">{fleet.description}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/*  ADD FLEET MODAL  */}
            {showAddModal && (
                <div className="ft-modal">
                    <div className="ft-modal-content">
                        <div className="ft-modal-title">◈ ADD NEW CIS FLEET</div>
                        <input className="ft-input" type="text" placeholder="Fleet Name (e.g., Invisible Hand)"
                            value={newFleet.fleetName}
                            onChange={e => setNewFleet({ ...newFleet, fleetName: e.target.value })} />
                        <input className="ft-input" type="text" placeholder="Commander (e.g., General Grievous)"
                            value={newFleet.commander}
                            onChange={e => setNewFleet({ ...newFleet, commander: e.target.value })} />
                        <select className="ft-input" value={newFleet.group}
                            onChange={e => setNewFleet({ ...newFleet, group: e.target.value })}>
                            {CIS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select className="ft-input" value={newFleet.startingPlanet}
                            onChange={e => setNewFleet({ ...newFleet, startingPlanet: e.target.value })}>
                            {planets.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <label className="cis-input-label">Lucrehulks</label>
                        <input className="ft-input" type="number" min="0" placeholder="Lucrehulks"
                            value={newFleet.composition?.lucrehulks || ''}
                            onChange={e => setNewFleet({ ...newFleet, composition: { ...newFleet.composition, lucrehulks: parseInt(e.target.value) || 0 } })} />
                        <label className="cis-input-label">Munificents</label>
                        <input className="ft-input" type="number" min="0" placeholder="Munificents"
                            value={newFleet.composition?.munificents || ''}
                            onChange={e => setNewFleet({ ...newFleet, composition: { ...newFleet.composition, munificents: parseInt(e.target.value) || 0 } })} />
                        <label className="cis-input-label">Providences</label>
                        <input className="ft-input" type="number" min="0" placeholder="Providences"
                            value={newFleet.composition?.providences || ''}
                            onChange={e => setNewFleet({ ...newFleet, composition: { ...newFleet.composition, providences: parseInt(e.target.value) || 0 } })} />
                        <textarea className="ft-textarea" placeholder="Fleet description (optional)" rows={3}
                            value={newFleet.description || ''}
                            onChange={e => setNewFleet({ ...newFleet, description: e.target.value })} />
                        <div className="ft-modal-actions">
                            <button onClick={addFleet} className="ft-btn ft-btn-save">CREATE FLEET</button>
                            <button onClick={() => setShowAddModal(false)} className="ft-btn ft-btn-cancel">CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/*  EDIT FLEET MODAL  */}
            {editingFleet && (() => {
                const isInTransit = !!fleets[editingFleet.id]?.travelingTo;
                return (
                    <div className="ft-modal">
                        <div className="ft-modal-content">

                            {/* Header */}
                            <div className="ft-modal-hdr">
                                <div className="ft-modal-title">◈ {editingFleet.fleetName || 'EDIT FLEET'}</div>
                                {isInTransit && (
                                    <div className="ft-modal-transit-warn">⚠ IN TRANSIT</div>
                                )}
                            </div>

                            {/* Tabs */}
                            <div className="ft-edit-tabs">
                                <button
                                    className={`ft-edit-tab${editTab === 'info' ? ' ft-tab-active' : ''}`}
                                    onClick={() => setEditTab('info')}
                                >FLEET INFO</button>
                                <button
                                    className={`ft-edit-tab${editTab === 'assets' ? ' ft-tab-active' : ''}`}
                                    onClick={() => setEditTab('assets')}
                                    disabled={isInTransit}
                                    title={isInTransit ? 'Cannot modify assets while in transit' : ''}
                                >MANAGE ASSETS</button>
                            </div>

                            {/*  FLEET INFO TAB  */}
                            {editTab === 'info' && (
                                <>
                                    <input className="ft-input" type="text" placeholder="Fleet Name"
                                        value={editingFleet.fleetName}
                                        onChange={e => setEditingFleet({ ...editingFleet, fleetName: e.target.value })} />
                                    <input className="ft-input" type="text" placeholder="Commander"
                                        value={editingFleet.commander || ''}
                                        onChange={e => setEditingFleet({ ...editingFleet, commander: e.target.value })} />
                                    <select className="ft-input" value={editingFleet.group || 'Unassigned'}
                                        onChange={e => setEditingFleet({ ...editingFleet, group: e.target.value })}>
                                        {CIS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <textarea className="ft-textarea" placeholder="Fleet description (optional)" rows={3}
                                        value={editingFleet.description || ''}
                                        onChange={e => setEditingFleet({ ...editingFleet, description: e.target.value })} />
                                    <div className="ft-modal-actions">
                                        <button onClick={saveFleetInfo} className="ft-btn ft-btn-save">SAVE INFO</button>
                                        <button onClick={() => setEditingFleet(null)} className="ft-btn ft-btn-cancel">CLOSE</button>
                                    </div>
                                </>
                            )}

                            {/*  MANAGE ASSETS TAB  */}
                            {editTab === 'assets' && (
                                <>
                                    <div className="cis-asset-block">
                                        <div className="cis-asset-block-title">SHIP COMPOSITION</div>

                                        <div className="cis-ship-row">
                                            <span className="cis-ship-label">Lucrehulks</span>
                                            <span className="cis-ship-count">{fleets[editingFleet.id]?.composition?.lucrehulks || 0}</span>
                                            <input className="ft-input ft-frigate-input" type="number" min="0"
                                                value={editingFleet.composition?.lucrehulks ?? ''}
                                                onChange={e => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, lucrehulks: parseInt(e.target.value) || 0 } })} />
                                        </div>

                                        <div className="cis-ship-row">
                                            <span className="cis-ship-label">Munificents</span>
                                            <span className="cis-ship-count">{fleets[editingFleet.id]?.composition?.munificents || 0}</span>
                                            <input className="ft-input ft-frigate-input" type="number" min="0"
                                                value={editingFleet.composition?.munificents ?? ''}
                                                onChange={e => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, munificents: parseInt(e.target.value) || 0 } })} />
                                        </div>

                                        <div className="cis-ship-row">
                                            <span className="cis-ship-label">Providences</span>
                                            <span className="cis-ship-count">{fleets[editingFleet.id]?.composition?.providences || 0}</span>
                                            <input className="ft-input ft-frigate-input" type="number" min="0"
                                                value={editingFleet.composition?.providences ?? ''}
                                                onChange={e => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, providences: parseInt(e.target.value) || 0 } })} />
                                        </div>

                                        <div className="cis-comp-save-row">
                                            <button onClick={saveFleetComposition} className="ft-btn ft-btn-save">SAVE COMPOSITION</button>
                                        </div>
                                    </div>

                                    <div className="ft-modal-actions">
                                        <button onClick={() => setEditingFleet(null)} className="ft-btn ft-btn-cancel">CLOSE</button>
                                    </div>
                                </>
                            )}

                        </div>
                    </div>
                );
            })()}

            {/*  VIEW FLEET MODAL  */}
            {viewingFleet && (() => {
                const vc = viewingFleet.composition || {};
                const vParts = [];
                if (vc.lucrehulks   > 0) vParts.push(`${vc.lucrehulks} Lucrehulk${vc.lucrehulks !== 1 ? 's' : ''}`);
                if (vc.dreadnoughts > 0) vParts.push(`${vc.dreadnoughts} Dreadnought${vc.dreadnoughts !== 1 ? 's' : ''}`);
                if (vc.munificents  > 0) vParts.push(`${vc.munificents} Munificent${vc.munificents !== 1 ? 's' : ''}`);
                if (vc.providences  > 0) vParts.push(`${vc.providences} Providence${vc.providences !== 1 ? 's' : ''}`);
                if (vc.frigates     > 0) vParts.push(`${vc.frigates} Frigate${vc.frigates !== 1 ? 's' : ''}`);
                const vCompStr = vParts.length > 0 ? vParts.join(' · ') : '—';
                const vTransit = !!viewingFleet.travelingTo;
                const vPct = vTransit ? getTransitProgress(viewingFleet) : null;
                return (
                    <div className="cis-view-overlay" onClick={() => setViewingFleet(null)}>
                        <div className="cis-view-panel" onClick={e => e.stopPropagation()}>
                            <div className="cis-view-header">
                                <div className="cis-view-title">
                                    <span className="cis-view-fleet-name">{viewingFleet.fleetName || viewingFleet.id}</span>
                                    {viewingFleet.group && viewingFleet.group !== 'Unassigned' && (
                                        <span className="cis-group-tag">{viewingFleet.group}</span>
                                    )}
                                </div>
                                <button className="cis-view-close" onClick={() => setViewingFleet(null)}>✕</button>
                            </div>
                            <div className="cis-view-body">
                                {viewingFleet.commander && (
                                    <div className="cis-view-section">
                                        <div className="cis-view-label">Commander</div>
                                        <div className="cis-view-value">{viewingFleet.commander}</div>
                                    </div>
                                )}
                                <div className="cis-view-section">
                                    <div className="cis-view-label">Location</div>
                                    <div className={`cis-view-value${vTransit ? ' cis-field-transit' : ' cis-field-planet'}`}>
                                        {vTransit ? `Hyperspace → ${viewingFleet.travelingTo}` : (viewingFleet.currentPlanet || '—')}
                                    </div>
                                    {vTransit && viewingFleet.arrivalDate && (
                                        <div className="cis-view-eta">
                                            ETA: {new Date(viewingFleet.arrivalDate).toLocaleString()} · {vPct}% complete
                                        </div>
                                    )}
                                </div>
                                <div className="cis-view-section">
                                    <div className="cis-view-label">Composition</div>
                                    <div className="cis-view-value">{vCompStr}</div>
                                </div>
                                {viewingFleet.description && (
                                    <div className="cis-view-section">
                                        <div className="cis-view-label">Description</div>
                                        <div className="cis-view-desc">{viewingFleet.description}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/*  PLANET ACCESS PANEL  */}
            <div className="cis-planet-access">
                <div className="cis-planet-access-title">◆ REPUBLIC TRAVEL PERMISSIONS</div>
                <div className="cis-planet-access-desc">
                    Unchecked planets cannot be travelled to by Republic fleets.
                </div>
                <div className="cis-planet-access-list">
                    {planets.map(planet => (
                        <label key={planet} className="cis-planet-access-item">
                            <input
                                type="checkbox"
                                checked={planetAccess[planet] !== false}
                                onChange={() => togglePlanetAccess(planet)}
                            />
                            {planet}
                        </label>
                    ))}
                </div>
            </div>

        </div>
    );
}

export default CISFleetTab;
