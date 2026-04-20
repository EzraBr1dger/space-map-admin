import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import './FleetTab.css';
import { useAuth } from '../context/AuthContext';

const BATTALIONS = ['501st', '212th', '104th', '91st', '41st Elite', '21st', 'Coruscant Guard', 'Unassigned', '442nd', '87th'];

/*const PLANET_DISTANCES = {
    'Coruscant-Kamino': 2,
    'Coruscant-Naboo': 1,
    'Coruscant-Alderaan': 1,
    'Coruscant-Kashyyyk': 3,
    'Coruscant-Onderon': 4,
    'Coruscant-Geonosis': 5,
    'Coruscant-Ryloth': 6,
    'Coruscant-Tatooine': 7,
    'Coruscant-Mustafar': 7,
};*/

/*const calculateTravelDays = (from, to) => {
    if (from === to) return 0;
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    return PLANET_DISTANCES[key1] || PLANET_DISTANCES[key2] || 5;
};*/

function FleetTab() {
    const { user } = useAuth();

    //  EXISTING STATE (unchanged)
    const [fleets, setFleets] = useState({});
    const [venatorStats, setVenatorStats] = useState({ total: 0, assigned: 0, available: 0 });
    const [planets, setPlanets] = useState([]);
    const [selectedFleets, setSelectedFleets] = useState([]);
    const [destination, setDestination] = useState('');
    const [travelDays, setTravelDays] = useState(0.25);
    const [instantMove, setInstantMove] = useState(false);
    const [instantProgress, setInstantProgress] = useState(null);
    // { [fleetId]: { startTime, duration, payload, fleetName } }
    const [pendingAssignments, setPendingAssignments] = useState({});
    // { [fleetId]: [{ startTime, duration }] } multiple venators can be inbound per fleet
    const [pendingVenators, setPendingVenators] = useState({});
    // Stores setTimeout IDs so they can be cleared on unmount
    const assignmentTimersRef = useRef({});
    const venatorTimersRef = useRef({});
    // 'info' | 'assets' which tab is active in the edit modal
    const [editTab, setEditTab] = useState('info');
    // quantity selected for venator add/remove actions in edit modal
    const [venatorQty, setVenatorQty] = useState(1);
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

    //  NEW STATE
    const [planetDetails, setPlanetDetails] = useState({});
    // Ticks every second and is used only to re-render progress bars from real timestamps.
    // No API call is made here; all math uses departureDate/arrivalDate from backend.
    const [now, setNow] = useState(Date.now());

    // 1-second clock: keeps progress bars live without touching the backend
    useEffect(() => {
        const clock = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(clock);
    }, []);

    // 30-second poll: re-fetches backend so server-side arrival confirmations appear
    useEffect(() => {
        const poll = setInterval(() => loadData(), 30000);
        return () => clearInterval(poll);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear all pending timers when the component unmounts
    useEffect(() => {
        const aTimers = assignmentTimersRef.current;
        const vTimers = venatorTimersRef.current;
        return () => {
            Object.values(aTimers).forEach(clearTimeout);
            Object.values(vTimers).flat().forEach(clearTimeout);
        };
    }, []);

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

    const loadData = async () => {
        try {
            const [fleetRes, mapRes] = await Promise.all([
                api.get('/fleet'),
                api.get('/mapdata')
            ]);
            applyData(fleetRes.data, mapRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
            showMessage('error', 'Failed to load fleet data');
            setLoading(false);
        }
    };

    const applyData = (fleetData, mapData) => {
        setFleets(fleetData.fleets || {});
        setVenatorStats(fleetData.venatorStats || { total: 0, assigned: 0, available: 0 });
        const planetsData = mapData.planets || {};
        setPlanets(Object.keys(planetsData));
        setPlanetDetails(planetsData);
        const access = {};
        for (const [name, data] of Object.entries(planetsData)) {
            access[name] = data.cisAccessible !== false;
        }
        setPlanetAccess(access);
        setLoading(false);
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

        // Capture values now interval callbacks won't see updated state
        const payload = { fleetIds: [...selectedFleets], destination, travelDays, instantMove };

        const doDispatch = async () => {
            try {
                const response = await api.post('/fleet/move', payload);
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
            // 10-second animated progress bar before actual dispatch
            setInstantProgress(0);
            const startTime = Date.now();
            const duration = 10000;
            const tick = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const pct = Math.min(100, Math.round((elapsed / duration) * 100));
                setInstantProgress(pct);
                if (pct >= 100) {
                    clearInterval(tick);
                    doDispatch();
                }
            }, 100);
            return;
        }

        await doDispatch();
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
            setNewFleet({ fleetName: '', commander: '', battalions: [], startingPlanet: 'Coruscant', composition: { venators: 0, frigates: 0 } });
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to create fleet');
        }
    };

    // eslint-disable-next-line no-unused-vars
    const updateFleet = async () => {
        console.log('DESCRIPTION BEING SENT:', editingFleet.description);
        const venatorDifference = editingFleet.composition.venators - (fleets[editingFleet.id]?.composition?.venators || 0);
        if (venatorDifference > venatorStats.available) {
            showMessage('error', `Only ${venatorStats.available} Venators available`); return;
        }

        const fleetId = editingFleet.id;
        const fleetName = editingFleet.fleetName;
        const payload = {
            fleetName,
            commander: editingFleet.commander,
            battalions: editingFleet.battalions || [],
            composition: editingFleet.composition,
            description: editingFleet.description || ''
        };

        // Detect whether battalions actually changed
        const currentFleet = fleets[fleetId];
        const currentBatArr = currentFleet?.battalions
            ? Object.values(currentFleet.battalions)
            : (currentFleet?.battalion ? [currentFleet.battalion] : []);
        const newBatArr = payload.battalions;
        const batsChanged =
            JSON.stringify([...newBatArr].sort()) !== JSON.stringify([...currentBatArr].sort());

        // Delay only when: battalions changed AND the fleet isn't currently unassigned
        if (batsChanged && !isCurrentlyUnassigned(currentFleet)) {
            const duration = getBattalionAssignDuration();
            const label = instantMove ? '10s (admin)' : '20 min';

            setPendingAssignments(prev => ({
                ...prev,
                [fleetId]: { startTime: Date.now(), duration, payload, fleetName }
            }));
            showMessage('success', `Battalion reassignment queued — ${label} delay`);
            setEditingFleet(null);

            // Store timer ID so unmount cleanup can cancel it
            assignmentTimersRef.current[fleetId] = setTimeout(async () => {
                delete assignmentTimersRef.current[fleetId];
                try {
                    await api.put(`/fleet/${fleetId}`, payload);
                    showMessage('success', `Battalions assigned to ${fleetName}`);
                } catch (error) {
                    showMessage('error', error.response?.data?.error || 'Battalion assignment failed');
                }
                setPendingAssignments(prev => {
                    const next = { ...prev };
                    delete next[fleetId];
                    return next;
                });
                loadData();
            }, duration);
            return;
        }

        // Instant save no battalion change, or fleet was previously unassigned
        try {
            await api.put(`/fleet/${fleetId}`, payload);
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

    // Uses the `now` state (updated every second) so React re-renders progress bars live.
    // All math is based purely on real backend timestamps no fake values.
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

    // eslint-disable-next-line no-unused-vars
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

    // Travel time: same sector=2h, adjacent=12h, each additional sector=+6h
    const calculateTravelDays = (fromPlanet, toPlanet) => {
        if (!fromPlanet || !toPlanet) return 0.25;
        if (fromPlanet === toPlanet) return 2 / 24;
        const fromPd = planetDetails[fromPlanet];
        const toPd = planetDetails[toPlanet];
        if (!fromPd || !toPd) return 0.25;
        const fromSector = parseInt(fromPd.sector || fromPd.sectorNumber || 0);
        const toSector = parseInt(toPd.sector || toPd.sectorNumber || 0);
        if (!fromSector || !toSector) return 0.25;
        if (fromSector === toSector) return 2 / 24;
        const diff = Math.abs(fromSector - toSector);
        if (diff === 1) return 12 / 24;
        return (12 + (diff - 1) * 6) / 24;
    };

    const formatTravelTime = (days) => {
        const hours = Math.round(days * 24);
        return hours < 1 ? '<1H' : `${hours}H`;
    };

    // Determines controlling faction from backend control fields (highest value > 0 wins)
    const getControllingFaction = (sector) => {
        const candidates = [
            { name: 'Republic', value: sector.repControl || 0, cls: 'ft-ctrl-rep' },
            { name: 'CIS',      value: sector.sepControl || 0, cls: 'ft-ctrl-sep' },
            { name: 'Mandalorian', value: sector.mndControl || 0, cls: 'ft-ctrl-mnd' },
        ].filter(f => f.value > 0).sort((a, b) => b.value - a.value);
        return candidates[0] || null;
    };

    // Admin 10-second bar: 0–25% red, 25–50% orange, 50–75% yellow, 75–100% green
    const getInstantBarColor = (pct) => {
        if (pct < 25) return '#f44336';
        if (pct < 50) return '#ff9800';
        if (pct < 75) return '#ffeb3b';
        return '#4caf50';
    };

    // 20 min normally; 10 s with admin bypass
    const getBattalionAssignDuration = () => instantMove ? 10000 : 20 * 60 * 1000;

    // True when the fleet's current battalions are empty or only "Unassigned"
    const isCurrentlyUnassigned = (fleet) => {
        const bats = fleet?.battalions
            ? Object.values(fleet.battalions).filter(b => b && b !== 'Unassigned')
            : (fleet?.battalion && fleet.battalion !== 'Unassigned' ? [fleet.battalion] : []);
        return bats.length === 0;
    };

    // 0-100 progress for a pending battalion assignment, driven by the 1-second `now` tick
    const getAssignProgress = (pa) => {
        const elapsed = now - pa.startTime;
        if (elapsed >= pa.duration) return 100;
        return Math.min(99, Math.max(1, Math.round((elapsed / pa.duration) * 100)));
    };

    // Human-readable countdown for a pending assignment
    const getAssignCountdown = (pa) => {
        const remaining = Math.max(0, pa.startTime + pa.duration - now);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    // 14h normally; 10s with admin bypass for venator inbound travel
    const getVenatorTravelDuration = () => instantMove ? 10000 : 14 * 60 * 60 * 1000;

    // Save only name/commander/description does NOT touch battalions or composition
    const saveFleetInfo = async () => {
        const fleetId = editingFleet.id;
        const currentFleet = fleets[fleetId];
        try {
            await api.put(`/fleet/${fleetId}`, {
                fleetName: editingFleet.fleetName,
                commander: editingFleet.commander || '',
                battalions: currentFleet?.battalions ? Object.values(currentFleet.battalions) : [],
                composition: currentFleet?.composition || editingFleet.composition,
                description: editingFleet.description || ''
            });
            showMessage('success', 'Fleet info saved');
            await loadData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to save fleet info');
        }
    };

    // Which fleet currently has this battalion (excluding the fleet being edited)
    const getBattalionFleet = (battalion) => {
        for (const [fId, f] of Object.entries(fleets)) {
            if (fId === editingFleet?.id) continue;
            const bats = f.battalions ? Object.values(f.battalions) : (f.battalion ? [f.battalion] : []);
            if (bats.includes(battalion)) return [fId, f.fleetName || fId];
        }
        return null;
    };

    // Battalions not already in the current fleet, with conflict info
    const getAvailableBattalions = () => {
        if (!editingFleet) return [];
        const current = editingFleet.battalions || [];
        return BATTALIONS
            .filter(b => b !== 'Unassigned' && !current.includes(b))
            .map(bat => {
                const conflict = getBattalionFleet(bat);
                return { bat, otherFleetId: conflict?.[0] || null, otherFleetName: conflict?.[1] || null };
            });
    };

    // Assign a battalion to the current fleet (with exclusivity enforcement + delay)
    const assignBattalion = async (battalion, otherFleetId, otherFleetName) => {
        // Step 1: remove from other fleet immediately if needed
        if (otherFleetId) {
            const other = fleets[otherFleetId];
            const otherBats = other?.battalions
                ? Object.values(other.battalions).filter(b => b !== battalion)
                : [];
            try {
                await api.put(`/fleet/${otherFleetId}`, {
                    fleetName: other.fleetName,
                    commander: other.commander || '',
                    battalions: otherBats,
                    composition: other.composition || { venators: 0, frigates: 0 },
                    description: other.description || ''
                });
            } catch (err) {
                showMessage('error', `Failed to remove ${battalion} from ${otherFleetName}`);
                return;
            }
        }

        const newBats = [...(editingFleet.battalions || []).filter(b => b !== battalion), battalion];
        setEditingFleet(prev => ({ ...prev, battalions: newBats }));

        const fleetId = editingFleet.id;
        const fleetName = editingFleet.fleetName;
        const payload = {
            fleetName,
            commander: editingFleet.commander || '',
            battalions: newBats,
            composition: editingFleet.composition || { venators: 0, frigates: 0 },
            description: editingFleet.description || ''
        };

        // Instant if fleet currently has no real battalions
        if (isCurrentlyUnassigned(fleets[fleetId])) {
            try {
                await api.put(`/fleet/${fleetId}`, payload);
                showMessage('success', `${battalion} assigned to ${fleetName}`);
                loadData();
            } catch (err) {
                showMessage('error', 'Assignment failed');
            }
            return;
        }

        // Delayed assignment cancel any existing pending timer first
        if (assignmentTimersRef.current[fleetId]) clearTimeout(assignmentTimersRef.current[fleetId]);
        const duration = getBattalionAssignDuration();
        const label = instantMove ? '10s (admin)' : '20 min';
        const suffix = otherFleetId ? ` (reassigned from ${otherFleetName})` : '';
        setPendingAssignments(prev => ({ ...prev, [fleetId]: { startTime: Date.now(), duration, payload, fleetName } }));
        showMessage('success', `${battalion} queued for ${fleetName} — ${label}${suffix}`);

        assignmentTimersRef.current[fleetId] = setTimeout(async () => {
            delete assignmentTimersRef.current[fleetId];
            try {
                await api.put(`/fleet/${fleetId}`, payload);
                showMessage('success', `${battalion} fully assigned to ${fleetName}`);
            } catch (error) {
                showMessage('error', error.response?.data?.error || 'Battalion assignment failed');
            }
            setPendingAssignments(prev => { const n = { ...prev }; delete n[fleetId]; return n; });
            loadData();
        }, duration);
    };

    // Remove a battalion from the current fleet instant, no delay
    const removeBattalion = async (battalion) => {
        const newBats = (editingFleet.battalions || []).filter(b => b !== battalion);
        setEditingFleet(prev => ({ ...prev, battalions: newBats }));
        const fleetId = editingFleet.id;
        try {
            await api.put(`/fleet/${fleetId}`, {
                fleetName: editingFleet.fleetName,
                commander: editingFleet.commander || '',
                battalions: newBats,
                composition: editingFleet.composition || { venators: 0, frigates: 0 },
                description: editingFleet.description || ''
            });
            showMessage('success', `${battalion} removed`);
            loadData();
        } catch (err) {
            showMessage('error', 'Failed to remove battalion');
        }
    };

    // Queue one or more venators to arrive at a fleet after 14h (or 10s admin)
    const addVenator = (fleetId, fleetName, qty = 1) => {
        if (venatorStats.available < qty) {
            showMessage('error', 'Not enough venators in reserve');
            return;
        }
        const duration = getVenatorTravelDuration();
        const label = instantMove ? '10s (admin)' : '14h';

        for (let i = 0; i < qty; i++) {
            const startTime = Date.now() + i * 50; // slight offset so each entry is unique
            setPendingVenators(prev => ({
                ...prev,
                [fleetId]: [...(prev[fleetId] || []), { startTime, duration }]
            }));

            const timerId = setTimeout(async () => {
                try {
                    const freshRes = await api.get('/fleet');
                    const freshFleet = freshRes.data.fleets[fleetId];
                    if (!freshFleet) return;
                    await api.put(`/fleet/${fleetId}`, {
                        fleetName: freshFleet.fleetName,
                        commander: freshFleet.commander || '',
                        battalions: freshFleet.battalions ? Object.values(freshFleet.battalions) : [],
                        composition: { ...freshFleet.composition, venators: (freshFleet.composition?.venators || 0) + 1 },
                        description: freshFleet.description || ''
                    });
                    showMessage('success', `Venator arrived at ${freshFleet.fleetName}`);
                } catch (error) {
                    showMessage('error', 'Venator arrival failed');
                }
                setPendingVenators(prev => {
                    const arr = [...(prev[fleetId] || [])];
                    const idx = arr.findIndex(v => v.startTime === startTime);
                    if (idx !== -1) arr.splice(idx, 1);
                    if (arr.length === 0) { const { [fleetId]: _, ...rest } = prev; return rest; }
                    return { ...prev, [fleetId]: arr };
                });
                if (venatorTimersRef.current[fleetId]) {
                    venatorTimersRef.current[fleetId] = venatorTimersRef.current[fleetId].filter(id => id !== timerId);
                }
                loadData();
            }, duration + i * 100); // stagger arrivals so backend writes don't race

            if (!venatorTimersRef.current[fleetId]) venatorTimersRef.current[fleetId] = [];
            venatorTimersRef.current[fleetId].push(timerId);
        }

        showMessage('success', `${qty} venator${qty !== 1 ? 's' : ''} dispatched to ${fleetName} — arrives in ${label}`);
        // Optimistically reflect queued ships so pool count updates immediately
        setEditingFleet(prev => prev ? {
            ...prev,
            _queuedVenators: (prev._queuedVenators || 0) + qty
        } : prev);
    };

    // Remove one or more venators immediately instant API call
    const removeVenator = async (fleetId, qty = 1) => {
        const current = editingFleet?.composition?.venators || 0;
        if (current < qty) {
            showMessage('error', 'Cannot remove more venators than the fleet has');
            return;
        }
        const newCount = current - qty;
        setEditingFleet(prev => ({ ...prev, composition: { ...prev.composition, venators: newCount } }));
        try {
            const f = fleets[fleetId];
            await api.put(`/fleet/${fleetId}`, {
                fleetName: f.fleetName,
                commander: f.commander || '',
                battalions: f.battalions ? Object.values(f.battalions) : [],
                composition: { ...f.composition, venators: newCount },
                description: f.description || ''
            });
            showMessage('success', `${qty} venator${qty !== 1 ? 's' : ''} removed`);
            loadData();
        } catch (err) {
            showMessage('error', 'Failed to remove venators');
        }
    };

    // DEV/ADMIN: fast-forward all inbound venators for a fleet to arrive in 15s
    // Does NOT bypass the arrival logic just replaces the timers with a shorter duration.
    const devFastForwardVenators = (fleetId) => {
        const current = pendingVenators[fleetId] || [];
        if (current.length === 0) return;

        // Cancel existing timers for this fleet
        if (venatorTimersRef.current[fleetId]) {
            venatorTimersRef.current[fleetId].forEach(clearTimeout);
            venatorTimersRef.current[fleetId] = [];
        }

        const newDuration = 15000;
        const newEntries = current.map((_, i) => ({ startTime: Date.now() + i * 50, duration: newDuration }));
        setPendingVenators(prev => ({ ...prev, [fleetId]: newEntries }));

        newEntries.forEach((entry, i) => {
            const { startTime } = entry;
            const timerId = setTimeout(async () => {
                try {
                    const freshRes = await api.get('/fleet');
                    const freshFleet = freshRes.data.fleets[fleetId];
                    if (!freshFleet) return;
                    await api.put(`/fleet/${fleetId}`, {
                        fleetName: freshFleet.fleetName,
                        commander: freshFleet.commander || '',
                        battalions: freshFleet.battalions ? Object.values(freshFleet.battalions) : [],
                        composition: { ...freshFleet.composition, venators: (freshFleet.composition?.venators || 0) + 1 },
                        description: freshFleet.description || ''
                    });
                    showMessage('success', `Venator arrived at ${freshFleet.fleetName}`);
                } catch (error) {
                    showMessage('error', 'Venator arrival failed');
                }
                setPendingVenators(prev => {
                    const arr = [...(prev[fleetId] || [])];
                    const idx = arr.findIndex(v => v.startTime === startTime);
                    if (idx !== -1) arr.splice(idx, 1);
                    if (arr.length === 0) { const { [fleetId]: _, ...rest } = prev; return rest; }
                    return { ...prev, [fleetId]: arr };
                });
                if (venatorTimersRef.current[fleetId]) {
                    venatorTimersRef.current[fleetId] = venatorTimersRef.current[fleetId].filter(id => id !== timerId);
                }
                loadData();
            }, newDuration + i * 100);

            if (!venatorTimersRef.current[fleetId]) venatorTimersRef.current[fleetId] = [];
            venatorTimersRef.current[fleetId].push(timerId);
        });

        showMessage('success', `Fast-forwarding ${current.length} venator${current.length !== 1 ? 's' : ''} — arriving in 15s`);
    };

    if (loading) return <div className="ft-loading">LOADING FLEET DATA...</div>;

    return (
        <div className="ft-container">

            {/*  ASSET TRACKER  */}
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
                                    {(() => {
                                        const faction = getControllingFaction(sector);
                                        return faction
                                            ? <span className={`ft-ctrl-faction ${faction.cls}`}>{faction.name}</span>
                                            : <span className="ft-ctrl-none">Unclaimed</span>;
                                    })()}
                                    {sector.repControl > 0 && <span className="ft-ctrl-pct ft-ctrl-rep">REP {sector.repControl}%</span>}
                                    {sector.sepControl > 0 && <span className="ft-ctrl-pct ft-ctrl-sep">SEP {sector.sepControl}%</span>}
                                    {sector.mndControl > 0 && <span className="ft-ctrl-pct ft-ctrl-mnd">MND {sector.mndControl}%</span>}
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
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await api.post('/fleet/confirm-arrival', { fleetIds: [id] });
                                                    await loadData();
                                                } catch (err) {
                                                    showMessage('error', err.response?.data?.error || 'Arrival confirmation failed');
                                                }
                                            }}
                                            className="ft-btn-confirm"
                                        >CONFIRM ARRIVAL</button>
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

            {/*  ACTIVE BATTALION ASSIGNMENTS  */}
            {Object.keys(pendingAssignments).length > 0 && (
                <div className="ft-routes-section">
                    <div className="ft-section-header">
                        <span className="ft-hdr-diamond">✦</span> ACTIVE BATTALION ASSIGNMENTS
                    </div>
                    {Object.entries(pendingAssignments).map(([fleetId, pa]) => {
                        const pct = getAssignProgress(pa);
                        const barColor = getInstantBarColor(pct);
                        const countdown = getAssignCountdown(pa);
                        const assignedBats = pa.payload.battalions.filter(b => b && b !== 'Unassigned');
                        return (
                            <div key={fleetId} className="ft-route-entry">
                                <div className="ft-route-top">
                                    <span className="ft-route-name">{pa.fleetName || fleetId}</span>
                                    <span className="ft-route-path">
                                        Reinforcing → <span className="ft-route-dest">{assignedBats.join(', ') || '—'}</span>
                                    </span>
                                    <span className="ft-route-pct" style={{ color: barColor }}>{pct}%</span>
                                    <span className="ft-assign-countdown">{countdown} remaining</span>
                                </div>
                                <div className="ft-prog-wrap">
                                    <div className="ft-prog-bar" style={{ width: `${pct}%`, background: barColor }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/*  INCOMING VENATORS  */}
            {Object.keys(pendingVenators).length > 0 && (
                <div className="ft-routes-section">
                    <div className="ft-section-header">
                        <span className="ft-hdr-diamond">✦</span> INCOMING VENATORS
                    </div>
                    {Object.entries(pendingVenators).map(([fleetId, venators]) =>
                        venators.map((v, i) => {
                            const pct = getAssignProgress(v);
                            const countdown = getAssignCountdown(v);
                            return (
                                <div key={`${fleetId}-${i}`} className="ft-route-entry">
                                    <div className="ft-route-top">
                                        <span className="ft-route-name">{fleets[fleetId]?.fleetName || fleetId}</span>
                                        <span className="ft-route-path">+1 Venator inbound</span>
                                        <span className="ft-route-pct" style={{ color: '#2196f3' }}>{pct}%</span>
                                        <span className="ft-assign-countdown">{countdown} remaining</span>
                                    </div>
                                    <div className="ft-prog-wrap">
                                        <div className="ft-prog-bar" style={{ width: `${pct}%`, background: '#2196f3' }} />
                                    </div>
                                </div>
                            );
                        })
                    )}
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
                        <select className="ft-select" value={destination} onChange={(e) => {
                            const dest = e.target.value;
                            setDestination(dest);
                            if (dest && selectedFleets.length > 0) {
                                const fromPlanet = fleets[selectedFleets[0]]?.currentPlanet;
                                setTravelDays(calculateTravelDays(fromPlanet, dest));
                            }
                        }}>
                            <option value="">— SELECT DESTINATION —</option>
                            {planets.filter(p => planetAccess[p] !== false).map(planet => (
                                <option key={planet} value={planet}>{planet}</option>
                            ))}
                        </select>
                        <span className="ft-travel-badge">
                            TRAVEL TIME: {destination ? formatTravelTime(travelDays) : '—'}
                        </span>
                        {user?.role === 'admin' && (
                            <label className="ft-instant-label">
                                <input type="checkbox" checked={instantMove} onChange={(e) => setInstantMove(e.target.checked)} disabled={instantProgress !== null} />
                                INSTANT MOVE (ADMIN)
                            </label>
                        )}
                        <button onClick={moveFleet} className="ft-btn ft-btn-move" disabled={instantProgress !== null}>DISPATCH</button>
                        <button onClick={deselectAll} className="ft-btn ft-btn-cancel" disabled={instantProgress !== null}>CANCEL</button>
                    </div>
                    {instantProgress !== null && (
                        <div className="ft-instant-prog-wrap">
                            <div className="ft-instant-prog-label">
                                ADMIN DISPATCH IN PROGRESS — {instantProgress}%
                            </div>
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
                                    {pendingAssignments[id] ? (
                                        <span className="ft-row-reinforcing">
                                            ⟳ REINFORCING — {getAssignCountdown(pendingAssignments[id])}
                                        </span>
                                    ) : (() => {
                                        const v = fleet.composition?.venators || 0;
                                        const f = fleet.composition?.frigates || 0;
                                        const bats = fleet.battalions
                                            ? Object.values(fleet.battalions).filter(Boolean)
                                            : (fleet.battalion && fleet.battalion !== 'Unassigned' ? [fleet.battalion] : []);
                                        const parts = [];
                                        if (v > 0) parts.push(`${v}V`);
                                        if (f > 0) parts.push(`${f}F`);
                                        if (bats.length > 0) parts.push(bats.join(', '));
                                        return parts.length > 0
                                            ? <span className="ft-row-composition">{parts.join(' · ')}</span>
                                            : null;
                                    })()}
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
                                        onClick={() => {
                                            setEditTab('info');
                                            setVenatorQty(1);
                                            setEditingFleet({
                                                id, ...fleet,
                                                battalions: fleet.battalions
                                                    ? Object.values(fleet.battalions)
                                                    : (fleet.battalion ? [fleet.battalion] : [])
                                            });
                                        }}
                                        className="ft-btn-sm ft-bsm-edit"
                                        disabled={!!pendingAssignments[id]}
                                        title={pendingAssignments[id] ? 'Assignment in progress' : ''}
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
            {editingFleet && (() => {
                const isInTransit = !!fleets[editingFleet.id]?.travelingTo;
                const hasPending = !!pendingAssignments[editingFleet.id];
                const inboundVenators = pendingVenators[editingFleet.id] || [];
                const assignedBats = (editingFleet.battalions || []).filter(b => b && b !== 'Unassigned');
                const availableBats = getAvailableBattalions();
                return (
                    <div className="ft-modal">
                        <div className="ft-modal-content ft-modal-wide">

                            {/* Header */}
                            <div className="ft-modal-hdr">
                                <div className="ft-modal-title">◈ {editingFleet.fleetName || 'EDIT FLEET'}</div>
                                {isInTransit && (
                                    <div className="ft-modal-transit-warn">⚠ IN TRANSIT — asset changes disabled</div>
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

                            {/* ── FLEET INFO TAB ── */}
                            {editTab === 'info' && (
                                <>
                                    <input className="ft-input" type="text" placeholder="Fleet Name"
                                        value={editingFleet.fleetName}
                                        onChange={(e) => setEditingFleet({ ...editingFleet, fleetName: e.target.value })} />
                                    <input className="ft-input" type="text" placeholder="Commander"
                                        value={editingFleet.commander || ''}
                                        onChange={(e) => setEditingFleet({ ...editingFleet, commander: e.target.value })} />
                                    <textarea className="ft-textarea" placeholder="Fleet description (optional)" rows={3}
                                        value={editingFleet.description || ''}
                                        onChange={(e) => setEditingFleet({ ...editingFleet, description: e.target.value })} />
                                    <div className="ft-modal-actions">
                                        <button onClick={saveFleetInfo} className="ft-btn ft-btn-save">SAVE INFO</button>
                                        <button onClick={() => setEditingFleet(null)} className="ft-btn ft-btn-cancel">CLOSE</button>
                                    </div>
                                </>
                            )}

                            {/* ── MANAGE ASSETS TAB ── */}
                            {editTab === 'assets' && (
                                <>
                                    {hasPending && (
                                        <div className="ft-modal-pending-note">
                                            ⟳ Battalion assignment in progress — {getAssignCountdown(pendingAssignments[editingFleet.id])} remaining
                                        </div>
                                    )}

                                    <div className="ft-assets-grid">

                                        {/* ── LEFT COLUMN: Venators + Frigates ── */}
                                        <div className="ft-assets-left">

                                            {/* VENATORS */}
                                            <div className="ft-asset-block">
                                                <div className="ft-asset-block-title">
                                                    VENATORS
                                                    {(user?.role === 'admin' || process.env.NODE_ENV !== 'production') && inboundVenators.length > 0 && (
                                                        <button
                                                            className="ft-btn-dev-ff"
                                                            onClick={() => devFastForwardVenators(editingFleet.id)}
                                                            title="DEV: Fast-forward all inbound venators to arrive in 15 seconds"
                                                        >DEV: 15s</button>
                                                    )}
                                                </div>
                                                <div className="ft-venator-stat-row">
                                                    <span>Current: <strong>{editingFleet.composition?.venators || 0}</strong></span>
                                                    {inboundVenators.length > 0 && (
                                                        <span className="ft-venator-incoming">
                                                            +{inboundVenators.length} inbound
                                                        </span>
                                                    )}
                                                    <span className="ft-venator-pool">
                                                        Pool: {venatorStats.available} avail.
                                                    </span>
                                                </div>

                                                {/* Quantity stepper */}
                                                <div className="ft-qty-row">
                                                    <span className="ft-qty-label">QTY</span>
                                                    <button className="ft-qty-btn"
                                                        onClick={() => setVenatorQty(q => Math.max(1, q - 1))}>−</button>
                                                    <input
                                                        className="ft-input ft-qty-input"
                                                        type="number"
                                                        min="1"
                                                        value={venatorQty}
                                                        onChange={e => setVenatorQty(Math.max(1, parseInt(e.target.value) || 1))}
                                                    />
                                                    <button className="ft-qty-btn"
                                                        onClick={() => setVenatorQty(q => q + 1)}>+</button>
                                                </div>

                                                <div className="ft-venator-btns">
                                                    <button
                                                        onClick={() => addVenator(editingFleet.id, editingFleet.fleetName, venatorQty)}
                                                        className="ft-btn ft-btn-venator-add"
                                                        disabled={venatorQty > venatorStats.available}
                                                        title={instantMove ? `Add ${venatorQty} — arrives in 10s (admin)` : `Add ${venatorQty} — arrives in 14h each`}
                                                    >+ ADD {venatorQty} VENATOR{venatorQty !== 1 ? 'S' : ''} {instantMove ? '(10s)' : '(14h)'}</button>
                                                    <button
                                                        onClick={() => removeVenator(editingFleet.id, venatorQty)}
                                                        className="ft-btn ft-btn-venator-rem"
                                                        disabled={venatorQty > (editingFleet.composition?.venators || 0)}
                                                    >− REMOVE {venatorQty} VENATOR{venatorQty !== 1 ? 'S' : ''}</button>
                                                </div>

                                                {inboundVenators.map((v, i) => (
                                                    <div key={i} className="ft-inbound-venator">
                                                        <span>⟳ Venator inbound — {getAssignCountdown(v)}</span>
                                                        <div className="ft-inbound-bar-track">
                                                            <div className="ft-inbound-bar-fill" style={{ width: `${getAssignProgress(v)}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* FRIGATES */}
                                            <div className="ft-asset-block">
                                                <div className="ft-asset-block-title">FRIGATES</div>
                                                <div className="ft-frigate-row">
                                                    <span className="ft-venator-count">
                                                        Current: <strong>{editingFleet.composition?.frigates || 0}</strong>
                                                    </span>
                                                    <input className="ft-input ft-frigate-input" type="number" min="0" placeholder="Set"
                                                        value={editingFleet.composition?.frigates || ''}
                                                        onChange={(e) => setEditingFleet({ ...editingFleet, composition: { ...editingFleet.composition, frigates: parseInt(e.target.value) || 0 } })} />
                                                    <button className="ft-btn ft-btn-venator-add" onClick={async () => {
                                                        const f = fleets[editingFleet.id];
                                                        await api.put(`/fleet/${editingFleet.id}`, {
                                                            fleetName: f.fleetName, commander: f.commander || '',
                                                            battalions: f.battalions ? Object.values(f.battalions) : [],
                                                            composition: { ...f.composition, frigates: editingFleet.composition?.frigates || 0 },
                                                            description: f.description || ''
                                                        });
                                                        showMessage('success', 'Frigates updated'); loadData();
                                                    }}>SAVE</button>
                                                </div>
                                            </div>

                                        </div>{/* end ft-assets-left */}

                                        {/* ── RIGHT COLUMN: Battalions ── */}
                                        <div className="ft-assets-right">

                                            {/* ASSIGNED BATTALIONS */}
                                            <div className="ft-asset-block ft-asset-block-scroll">
                                                <div className="ft-asset-block-title">
                                                    ASSIGNED BATTALIONS{assignedBats.length > 0 ? ` (${assignedBats.length})` : ''}
                                                </div>
                                                <div className="ft-bat-scroll">
                                                    {assignedBats.length === 0 ? (
                                                        <div className="ft-bat-empty">No battalions assigned</div>
                                                    ) : assignedBats.map(bat => (
                                                        <div key={bat} className="ft-bat-manage-row">
                                                            <button
                                                                onClick={() => removeBattalion(bat)}
                                                                className="ft-btn-sm ft-btn-bat-full ft-bsm-del"
                                                                disabled={hasPending}
                                                                title={hasPending ? 'Assignment in progress' : ''}
                                                            >{bat} — REMOVE</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* AVAILABLE BATTALIONS */}
                                            <div className="ft-asset-block ft-asset-block-scroll">
                                                <div className="ft-asset-block-title">AVAILABLE BATTALIONS</div>
                                                <div className="ft-bat-scroll">
                                                    {availableBats.length === 0 ? (
                                                        <div className="ft-bat-empty">All battalions assigned</div>
                                                    ) : availableBats.map(({ bat, otherFleetId, otherFleetName }) => (
                                                        <div key={bat} className={`ft-bat-manage-row${otherFleetId ? ' ft-bat-conflict-row' : ''}`}>
                                                            <button
                                                                onClick={() => assignBattalion(bat, otherFleetId, otherFleetName)}
                                                                className={`ft-btn-sm ft-btn-bat-full ${otherFleetId ? 'ft-bsm-reassign' : 'ft-bsm-assign'}`}
                                                            >
                                                                {otherFleetId
                                                                    ? `${bat} — REASSIGN (in ${otherFleetName})`
                                                                    : `${bat} — ASSIGN`}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                        </div>{/* end ft-assets-right */}

                                    </div>{/* end ft-assets-grid */}

                                    <div className="ft-modal-actions">
                                        <button onClick={() => setEditingFleet(null)} className="ft-btn ft-btn-cancel">CLOSE</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

        </div>
    );
}

export default FleetTab;
