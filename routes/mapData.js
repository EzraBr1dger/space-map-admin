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