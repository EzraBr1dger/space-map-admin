import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './MapDataTab.css';

const SENATE_PROJECTS = {
    'Republic Shipyard Network': { cost: 5000000, description: '+10% starship production faction-wide' },
    'Grand Army Reinforcement Act': { cost: 7500000, description: 'Doubles Current Stocks' },
    'The Peace Accord of Naboo': { cost: 50000000, description: 'Might end the War Diplomatically' }
};

const BUILDING_TYPES = {
    'Planetary Defenses': { cost: 750000, days: 3, description: 'Physical Emplacements of Turbo lasers and defenses' },
    'Production Facility': { cost: 500000, days: 2, description: '+50 Production' },
    'Research Facility': { cost: 650000, days: 3, description: '+100 per week research to new technology (Total cap of 5000)' },
    'Trade Hub': { cost: 400000, days: 2, description: '+20% Credits' },
    'Civil Infrastructure': { cost: 250000, days: 1, description: 'Reduces planetary unrest (affects lore events)' }
};

function MapDataTab() {
    const [mapData, setMapData] = useState({ planets: {}, sectors: {} });
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [originalMapData, setOriginalMapData] = useState({});
    const [changedItems, setChangedItems] = useState(new Set());
    const [message, setMessage] = useState({ type: '', text: '' });
    const [senateProjects, setSenateProjects] = useState({});
    const [senateMessage, setSenateMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadMapData();
    }, []);

    const loadMapData = async () => {
        try {
            const { data } = await api.get('/mapdata');
            setMapData(data);
            setOriginalMapData(JSON.parse(JSON.stringify(data))); // Deep copy
            setSenateProjects(data.senateProjects || {});
        } catch (error) {
            console.error('Error loading map data:', error);
            showMessage('error', 'Failed to load map data');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const enterEditMode = () => {
        setEditMode(true);
        setOriginalMapData(JSON.parse(JSON.stringify(mapData)));
        setChangedItems(new Set());
        showMessage('success', 'Edit mode enabled. Make changes and click Save Changes.');
    };

    const cancelEdit = () => {
        setEditMode(false);
        setMapData(originalMapData);
        setChangedItems(new Set());
        showMessage('success', 'Edit mode cancelled. All changes discarded.');
    };

    const updatePlanet = (planetName, field, value) => {
        setMapData(prev => ({
            ...prev,
            planets: {
                ...prev.planets,
                [planetName]: {
                    ...prev.planets[planetName],
                    [field]: field === 'reputation' ? parseFloat(value) / 100 : value
                }
            }
        }));
        setChangedItems(prev => new Set([...prev, `planet-${planetName}`]));
    };

    const updateSector = (sectorName, field, value) => {
        setMapData(prev => ({
            ...prev,
            sectors: {
                ...prev.sectors,
                [sectorName]: {
                    ...prev.sectors[sectorName],
                    [field]: value
                }
            }
        }));
        setChangedItems(prev => new Set([...prev, `sector-${sectorName}`]));
    };

    const saveChanges = async () => {
        try {
            showMessage('success', 'Saving changes...');

            const savePromises = [];

            // Save changed planets
            Object.entries(mapData.planets).forEach(([planetName, planetData]) => {
                if (changedItems.has(`planet-${planetName}`)) {
                    savePromises.push(
                        api.put(`/mapdata/planet/${encodeURIComponent(planetName)}`, planetData)
                    );
                }
            });

            // Save changed sectors
            Object.entries(mapData.sectors).forEach(([sectorName, sectorData]) => {
                if (changedItems.has(`sector-${sectorName}`)) {
                    savePromises.push(
                        api.put(`/mapdata/sector/${encodeURIComponent(sectorName)}`, sectorData)
                    );
                }
            });

            if (savePromises.length === 0) {
                showMessage('error', 'No changes to save.');
                return;
            }

            await Promise.all(savePromises);

            showMessage('success', `Successfully updated ${savePromises.length} items! Changes will appear in Roblox within 60 seconds.`);
            setEditMode(false);
            setChangedItems(new Set());
            await loadMapData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to save changes');
        }
    };

    const addBuilding = async (planetName, buildingType) => {
        const building = BUILDING_TYPES[buildingType];
        if (!building) return;

        try {
            showMessage('success', `Starting construction of ${buildingType}...`);
            
            // UNCOMMENT THIS:
            const response = await api.post(`/mapdata/planet/${encodeURIComponent(planetName)}/building`, {
                buildingType,
                cost: building.cost,
                days: building.days
            });
            
            // Comment out or remove the local state update
            await loadMapData(); // Reload from server instead
            
            showMessage('success', response.data.message);
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to start building construction');
        }
    };

    const cancelBuilding = async (planetName) => {
        try {
            showMessage('success', 'Cancelling building construction...');
            
            // UNCOMMENT THIS:
            await api.delete(`/mapdata/planet/${encodeURIComponent(planetName)}/building`);
            
            await loadMapData(); // Reload from server
            
            showMessage('success', 'Building construction cancelled');
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to cancel building');
        }
    };

    const startSenateProject = async (projectName) => {
        const project = SENATE_PROJECTS[projectName];
        if (!project) return;

        try {
            const response = await api.post('/mapdata/senate-project', {
                projectName,
                cost: project.cost
            });
            setSenateMessage({ type: 'success', text: response.data.message });
            await loadMapData();
        } catch (error) {
            setSenateMessage({ type: 'error', text: error.response?.data?.error || 'Failed to start project' });
        }
        setTimeout(() => setSenateMessage({ type: '', text: '' }), 5000);
    };

    const cancelSenateProject = async (projectName) => {
        try {
            await api.delete(`/mapdata/senate-project/${encodeURIComponent(projectName)}`);
            setSenateMessage({ type: 'success', text: `${projectName} cancelled` });
            await loadMapData();
        } catch (error) {
            setSenateMessage({ type: 'error', text: error.response?.data?.error || 'Failed to cancel project' });
        }
        setTimeout(() => setSenateMessage({ type: '', text: '' }), 5000);
    };

    function PlanetCard({ name, planet, editMode, isChanged, onUpdate }) {
        const reputation = (planet.reputation || planet.efficiency || 1.0) * 100;
        const [selectedBuilding, setSelectedBuilding] = useState('');

        if (!editMode) {
            return (
                <div className={`planet-card faction-${planet.faction?.toLowerCase()}`}>
                    <div className="planet-name">{name}</div>
                    <div className="planet-info">
                        <div><strong>Faction:</strong> <span style={{ color: getFactionColor(planet.faction) }}>{planet.faction}</span></div>
                        <div><strong>Reputation:</strong> <span style={{ color: getReputationColor(reputation) }}>{Math.round(reputation)}%</span></div>
                        {planet.description && <div><strong>Description:</strong> {planet.description}</div>}
                        {planet.customFactionImage && <div><strong>Custom Icon:</strong> {planet.customFactionImage}</div>}
                        {planet.currentBuilding && (
                            <div className="current-building">
                                <strong>Building:</strong> {planet.currentBuilding.type}
                                <div className="building-details">
                                    Started: {new Date(planet.currentBuilding.startDate).toLocaleDateString()}
                                    <br />
                                    Completes: {new Date(planet.currentBuilding.completionDate).toLocaleDateString()}
                                    <br />
                                    Cost: {planet.currentBuilding.cost.toLocaleString()} credits
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className={`planet-card faction-${planet.faction?.toLowerCase()} ${isChanged ? 'changed' : ''}`}>
                <div className="planet-name">{name}</div>
                <div className="planet-edit">
                    <div className="form-group">
                        <label>Faction:</label>
                        <select value={planet.faction} onChange={(e) => onUpdate(name, 'faction', e.target.value)}>
                            <option value="Republic">Republic</option>
                            <option value="Separatists">Separatists</option>
                            <option value="Independent">Independent</option>
                            <option value="Mandalore">Mandalore</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Reputation (%):</label>
                        <input
                            type="number"
                            value={Math.round(reputation)}
                            onChange={(e) => onUpdate(name, 'reputation', e.target.value)}
                            min="0"
                            max="200"
                        />
                        <small>100% = normal, 80% = reduced, 120% = bonus</small>
                    </div>
                    <div className="form-group">
                        <label>Description:</label>
                        <textarea
                            value={planet.description || ''}
                            onChange={(e) => onUpdate(name, 'description', e.target.value)}
                            rows="3"
                        />
                    </div>
                    <div className="form-group">
                        <label>Custom Faction Image ID:</label>
                        <input
                            type="text"
                            value={planet.customFactionImage || ''}
                            onChange={(e) => onUpdate(name, 'customFactionImage', e.target.value)}
                            placeholder="rbxassetid://123456789"
                        />
                    </div>
                    
                    {/* Building Projects Section */}
                    <div className="form-group building-section">
                        <label>Building Projects:</label>
                        {planet.currentBuilding ? (
                            <div className="current-building-edit">
                                <div><strong>Current:</strong> {planet.currentBuilding.type}</div>
                                <div>Completes: {new Date(planet.currentBuilding.completionDate).toLocaleDateString()}</div>
                                <div>Cost: {planet.currentBuilding.cost.toLocaleString()} credits</div>
                                <button 
                                    onClick={() => cancelBuilding(name)} 
                                    className="btn-cancel-building"
                                    type="button"
                                >
                                    Cancel Building
                                </button>
                            </div>
                        ) : (
                            <div className="building-selector">
                                <select 
                                    value={selectedBuilding} 
                                    onChange={(e) => setSelectedBuilding(e.target.value)}
                                >
                                    <option value="">-- Select Building --</option>
                                    {Object.entries(BUILDING_TYPES).map(([type, info]) => (
                                        <option key={type} value={type}>
                                            {type} - {info.cost.toLocaleString()} credits - {info.days} days
                                        </option>
                                    ))}
                                </select>
                                {selectedBuilding && (
                                    <div className="building-info">
                                        <small>{BUILDING_TYPES[selectedBuilding].description}</small>
                                        <button 
                                            onClick={() => {
                                                addBuilding(name, selectedBuilding);
                                                setSelectedBuilding('');
                                            }} 
                                            className="btn-start-building"
                                            type="button"
                                        >
                                            Start Construction
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {isChanged && <div className="change-indicator">📝 Changes pending...</div>}
                </div>
            </div>
        );
    }

    const recalculateSectors = async () => {
        try {
            showMessage('success', 'Recalculating sector control...');
            const { data } = await api.post('/mapdata/recalculate-sectors');
            showMessage('success', data.message);
            await loadMapData();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to recalculate sectors');
        }
    };

    if (loading) return <div className="loading">Loading map data...</div>;

    const stats = calculateStats(mapData);

    return (
        <div className="mapdata-tab">
            <h3>Map Data Management</h3>

            <div className="mapdata-controls">
                <button onClick={loadMapData} className="btn-refresh">Refresh Map Data</button>
                <button onClick={recalculateSectors} className="btn-recalculate">Recalculate Sectors</button>
                {!editMode ? (
                    <button onClick={enterEditMode} className="btn-edit">Edit Mode</button>
                ) : (
                    <>
                        <button onClick={saveChanges} className="btn-save">Save Changes</button>
                        <button onClick={cancelEdit} className="btn-cancel">Cancel</button>
                    </>
                )}
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="map-summary">
                <StatsSummary title="Planet Overview" stats={stats.planets} />
                <StatsSummary title="Sector Control" stats={stats.sectors} />
                <StatsSummary title="Faction Balance" stats={stats.factions} />
            </div>

            {/* Senate Projects */}
            <div className="senate-section">
                <h4>Senate Projects</h4>
                <p className="senate-subtitle">Galaxy-wide initiatives funded by the Senate</p>

                {senateMessage.text && (
                    <div className={`message ${senateMessage.type}`}>{senateMessage.text}</div>
                )}

                <div className="senate-projects-grid">
                    {Object.entries(SENATE_PROJECTS).map(([name, info]) => {
                        const active = senateProjects[name];
                        return (
                            <div key={name} className={`senate-card ${active ? 'active' : ''}`}>
                                <div className="senate-card-header">
                                    <span className="senate-name">{name}</span>
                                    <span className="senate-cost">{info.cost.toLocaleString()} Credits</span>
                                </div>
                                <p className="senate-desc">{info.description}</p>
                                {active ? (
                                    <div className="senate-active">
                                        <span className="senate-status">✅ Active since {new Date(active.startDate).toLocaleDateString()}</span>
                                        <span className="senate-completion">Completes: {new Date(active.completionDate).toLocaleDateString()}</span>
                                        <button onClick={() => cancelSenateProject(name)} className="btn-cancel-building">Cancel Project</button>
                                    </div>
                                ) : (
                                    <button onClick={() => startSenateProject(name)} className="btn-start-building">Fund Project</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="map-data-grid">
                <div className="map-section">
                    <h4>Planet Map Data</h4>
                    <div className="planet-list">
                        {Object.entries(mapData.planets).map(([name, planet]) => (
                            <PlanetCard
                                key={name}
                                name={name}
                                planet={planet}
                                editMode={editMode}
                                isChanged={changedItems.has(`planet-${name}`)}
                                onUpdate={updatePlanet}
                            />
                        ))}
                    </div>
                </div>

                <div className="map-section">
                    <h4>Sector Data</h4>
                    <div className="sector-list">
                        {Object.entries(mapData.sectors).map(([name, sector]) => (
                            <SectorCard
                                key={name}
                                name={name}
                                sector={sector}
                                editMode={editMode}
                                isChanged={changedItems.has(`sector-${name}`)}
                                onUpdate={updateSector}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatsSummary({ title, stats }) {
    return (
        <div className="stats-summary">
            <h4>{title}</h4>
            {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="summary-item">
                    {key}: <strong>{value}</strong>
                </div>
            ))}
        </div>
    );
}


function SectorCard({ name, sector, editMode, isChanged, onUpdate }) {
    if (!editMode) {
        return (
            <div className="sector-card">
                <div className="sector-name">{name}</div>
                <div className="sector-info">
                    <div><strong>Controlled By:</strong> <span style={{ color: getFactionColor(sector.controlledBy) }}>{sector.controlledBy}</span></div>
                    <div><strong>State:</strong> {sector.state}</div>
                    <div><strong>Highlighted:</strong> {sector.highlighted ? 'Yes' : 'No'}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`sector-card ${isChanged ? 'changed' : ''}`}>
            <div className="sector-name">{name}</div>
            <div className="sector-edit">
                <div className="form-group">
                    <label>Controlled By:</label>
                    <select value={sector.controlledBy} onChange={(e) => onUpdate(name, 'controlledBy', e.target.value)}>
                        <option value="Republic">Republic</option>
                        <option value="Separatists">Separatists</option>
                        <option value="Independent">Independent</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>State:</label>
                    <select value={sector.state} onChange={(e) => onUpdate(name, 'state', e.target.value)}>
                        <option value="Peaceful">Peaceful</option>
                        <option value="Frontline">Frontline</option>
                        <option value="War">War</option>
                        <option value="Contested">Contested</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={sector.highlighted || false}
                            onChange={(e) => onUpdate(name, 'highlighted', e.target.checked)}
                        />
                        Highlighted
                    </label>
                </div>
                {isChanged && <div className="change-indicator">📝 Changes pending...</div>}
            </div>
        </div>
    );
}

function calculateStats(mapData) {
    const planets = mapData.planets || {};
    const sectors = mapData.sectors || {};

    const planetStats = {};
    const sectorStats = {};
    const factionStats = {};

    // Planet stats
    Object.values(planets).forEach(p => {
        const faction = p.faction || 'Unknown';
        planetStats[faction] = (planetStats[faction] || 0) + 1;
    });

    // Sector stats
    Object.values(sectors).forEach(s => {
        const controller = s.controlledBy || 'Unknown';
        sectorStats[controller] = (sectorStats[controller] || 0) + 1;
    });

    // Faction balance
    factionStats['Republic'] = `${planetStats.Republic || 0}P / ${sectorStats.Republic || 0}S`;
    factionStats['Separatists'] = `${planetStats.Separatists || 0}P / ${sectorStats.Separatists || 0}S`;

    return {
        planets: { 'Total Planets': Object.keys(planets).length, ...planetStats },
        sectors: { 'Total Sectors': Object.keys(sectors).length, ...sectorStats },
        factions: factionStats
    };
}

function getFactionColor(faction) {
    const colors = {
        'Republic': '#4fc3f7',
        'Separatists': '#f44336',
        'Mandalore': '#ff9800',
        'Independent': '#888',
        'Contested': '#ff9800'
    };
    return colors[faction] || '#888';
}

function getReputationColor(reputation) {
    if (reputation >= 100) return '#4caf50';
    if (reputation >= 80) return '#ff9800';
    return '#f44336';
}

export default MapDataTab;