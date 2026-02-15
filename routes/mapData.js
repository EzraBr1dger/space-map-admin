// routes/mapData.js
const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { FirebaseHelpers } = require('../config/firebase');

const router = express.Router();

// Get all map data (planets and sectors)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const mapData = await FirebaseHelpers.getMapData();
        
        if (!mapData) {
            return res.json({ 
                planets: {},
                sectors: {},
                message: 'No map data found'
            });
        }

        res.json({ 
            planets: mapData.planets || {},
            sectors: mapData.sectors || {},
            lastUpdate: mapData.lastUpdate || null
        });
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({ error: 'Failed to fetch map data' });
    }
});

// Update planet map data
router.put('/planet/:planetName', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { planetName } = req.params;
        const planetMapData = req.body;

        // Validate required fields
        if (!planetMapData.faction) {
            return res.status(400).json({ 
                error: 'Planet must have faction' 
            });
        }

        // ✅ ADD THIS: Convert reputation to efficiency before saving
        if (planetMapData.reputation !== undefined) {
            planetMapData.efficiency = planetMapData.reputation;
            delete planetMapData.reputation; // Remove reputation field
        }

        const currentMapData = await FirebaseHelpers.getMapData() || { planets: {}, sectors: {} };
        
        // Update planet in map data
        currentMapData.planets[planetName] = {
            ...currentMapData.planets[planetName],
            ...planetMapData,
            lastModified: new Date().toISOString()
        };
        
        currentMapData.lastUpdate = new Date().toISOString();

        await FirebaseHelpers.updateMapData(currentMapData);

        res.json({ 
            message: `Planet ${planetName} map data updated successfully`,
            planet: currentMapData.planets[planetName]
        });

        console.log(`✅ Planet ${planetName} map data updated by ${req.user.username}`);
    } catch (error) {
        console.error(`Error updating planet map data ${req.params.planetName}:`, error);
        res.status(500).json({ error: 'Failed to update planet map data' });
    }
});

// Start building construction on a planet
router.post('/planet/:planetName/building', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { planetName } = req.params;
        const { buildingType, cost, days } = req.body;

        // Get current map data
        const mapData = await FirebaseHelpers.getMapData();
        const planet = mapData?.planets?.[planetName];

        if (!planet) {
            return res.status(404).json({ error: 'Planet not found' });
        }

        // Check if planet already has a building under construction
        if (planet.currentBuilding) {
            return res.status(400).json({ 
                error: `${planetName} already has ${planet.currentBuilding.type} under construction` 
            });
        }

        const faction = planet.faction;
        if (!faction || (faction !== 'Republic' && faction !== 'Separatists')) {
            return res.status(400).json({ 
                error: 'Only Republic and Separatist planets can construct buildings' 
            });
        }

        // Check if faction has enough credits (but don't deduct yet)
        const factionCredits = await FirebaseHelpers.getFactionCredits(faction);
        if (factionCredits < cost) {
            return res.status(400).json({ 
                error: `Insufficient credits. ${faction} has ${factionCredits.toLocaleString()}, needs ${cost.toLocaleString()}` 
            });
        }

        // Calculate completion date
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + days);

        const buildingData = {
            type: buildingType,
            startDate: new Date().toISOString(),
            completionDate: completionDate.toISOString(),
            cost: cost
        };

        // Deduct credits (currently just checks, doesn't deduct)
        await FirebaseHelpers.deductFactionCredits(faction, cost);

        // Add building to planet
        await FirebaseHelpers.addPlanetBuilding(planetName, buildingData);

        res.json({ 
            message: `${buildingType} construction started on ${planetName} (TESTING MODE - Credits not deducted)`,
            building: buildingData,
            faction: faction,
            creditsRemaining: factionCredits // Still showing original amount in testing
        });

        console.log(`✅ ${buildingType} started on ${planetName} by ${req.user.username}`);
    } catch (error) {
        console.error(`Error starting building on ${req.params.planetName}:`, error);
        res.status(500).json({ error: error.message || 'Failed to start building construction' });
    }
});

// Cancel building construction
router.delete('/planet/:planetName/building', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { planetName } = req.params;

        // Get current map data
        const mapData = await FirebaseHelpers.getMapData();
        const planet = mapData?.planets?.[planetName];

        if (!planet) {
            return res.status(404).json({ error: 'Planet not found' });
        }

        if (!planet.currentBuilding) {
            return res.status(400).json({ 
                error: `${planetName} has no building under construction` 
            });
        }

        // Cancel building
        await FirebaseHelpers.cancelPlanetBuilding(planetName);

        res.json({ 
            message: `Building construction cancelled on ${planetName}`,
            cancelledBuilding: planet.currentBuilding
        });

        console.log(`✅ Building cancelled on ${planetName} by ${req.user.username}`);
    } catch (error) {
        console.error(`Error cancelling building on ${req.params.planetName}:`, error);
        res.status(500).json({ error: 'Failed to cancel building construction' });
    }
});

// Update sector data
router.put('/sector/:sectorName', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { sectorName } = req.params;
        const sectorData = req.body;

        const currentMapData = await FirebaseHelpers.getMapData() || { planets: {}, sectors: {} };
        
        // Update sector in map data
        currentMapData.sectors[sectorName] = {
            ...currentMapData.sectors[sectorName],
            ...sectorData,
            lastModified: new Date().toISOString()
        };
        
        currentMapData.lastUpdate = new Date().toISOString();

        await FirebaseHelpers.updateMapData(currentMapData);

        res.json({ 
            message: `Sector ${sectorName} updated successfully`,
            sector: currentMapData.sectors[sectorName]
        });

        console.log(`✅ Sector ${sectorName} updated by ${req.user.username}`);
    } catch (error) {
        console.error(`Error updating sector ${req.params.sectorName}:`, error);
        res.status(500).json({ error: 'Failed to update sector' });
    }
});

// Recalculate sector control based on planets
router.post('/recalculate-sectors', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // This would trigger the sector control calculation
        // You'd need to implement this in your FirebaseHelpers
        const result = await FirebaseHelpers.calculateSectorControl();

        res.json({ 
            message: 'Sector control recalculated successfully',
            result,
            recalculatedBy: req.user.username
        });

        console.log(`✅ Sector control recalculated by ${req.user.username}`);
    } catch (error) {
        console.error('Error recalculating sector control:', error);
        res.status(500).json({ error: 'Failed to recalculate sector control' });
    }
});

module.exports = router;