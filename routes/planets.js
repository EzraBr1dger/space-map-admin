const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { FirebaseHelpers } = require('../config/firebase');

const router = express.Router();

// Get all planets
router.get('/', authenticateToken, async (req, res) => {
    try {
        const mapData = await FirebaseHelpers.getMapData();
        
        if (!mapData || !mapData.planets) {
            return res.json({ planets: {}, message: 'No planetary data found' });
        }

        res.json({ 
            planets: mapData.planets,
            count: Object.keys(mapData.planets).length
        });
    } catch (error) {
        console.error('Error fetching planets:', error);
        res.status(500).json({ error: 'Failed to fetch planetary data' });
    }
});

// Get specific planet
router.get('/:planetName', authenticateToken, async (req, res) => {
    try {
        const { planetName } = req.params;
        const mapData = await FirebaseHelpers.getMapData();
        
        if (!mapData || !mapData.planets || !mapData.planets[planetName]) {
            return res.status(404).json({ error: 'Planet not found' });
        }

        res.json({ 
            planet: mapData.planets[planetName],
            name: planetName
        });
    } catch (error) {
        console.error(`Error fetching planet ${req.params.planetName}:`, error);
        res.status(500).json({ error: 'Failed to fetch planet data' });
    }
});

// Update specific planet
router.put('/:planetName', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { planetName } = req.params;
        const planetData = req.body;

        // Validate required fields
        if (!planetData.faction || !planetData.status) {
            return res.status(400).json({ 
                error: 'Planet must have faction and status' 
            });
        }

        // Validate faction (updated to include more factions)
        if (!['Republic', 'CIS', 'Seperatists', 'Mandalore', 'Independent'].includes(planetData.faction)) {
            return res.status(400).json({ 
                error: 'Faction must be Republic, CIS, Seperatists, Mandalore, or Independent' 
            });
        }

        // Validate status
        if (!['Active', 'Inactive', 'Contested'].includes(planetData.status)) {
            return res.status(400).json({ 
                error: 'Status must be Active, Inactive, or Contested' 
            });
        }

        // Get current map data
        const mapData = await FirebaseHelpers.getMapData();
        
        // Initialize planets object if it doesn't exist
        if (!mapData.planets) {
            mapData.planets = {};
        }

        // Update the specific planet
        mapData.planets[planetName] = planetData;

        // Save back to Firebase
        await FirebaseHelpers.updateMapData(mapData);

        // Recalculate faction stats after planet update
        await FirebaseHelpers.calculateFactionStats();

        res.json({ 
            message: `Planet ${planetName} updated successfully`,
            planet: planetData
        });

        console.log(`✅ Planet ${planetName} updated by ${req.user.username}`);
    } catch (error) {
        console.error(`Error updating planet ${req.params.planetName}:`, error);
        res.status(500).json({ error: 'Failed to update planet' });
    }
});

// Create new planet
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { planetName, ...planetData } = req.body;

        if (!planetName) {
            return res.status(400).json({ error: 'Planet name is required' });
        }

        // Validate required fields
        if (!planetData.faction || !planetData.status) {
            return res.status(400).json({ 
                error: 'Planet must have faction and status' 
            });
        }

        // Get current map data
        const mapData = await FirebaseHelpers.getMapData();
        
        // Initialize planets object if it doesn't exist
        if (!mapData.planets) {
            mapData.planets = {};
        }

        // Check if planet already exists
        if (mapData.planets[planetName]) {
            return res.status(409).json({ error: 'Planet already exists' });
        }

        // Set default structure if not provided
        const newPlanetData = {
            faction: planetData.faction,
            status: planetData.status,
            sector: planetData.sector || 'Unknown',
            productionOutput: planetData.productionOutput || 0,
            description: planetData.description || '',
            customFactionImage: planetData.customFactionImage || '',
            monthlyProduction: planetData.monthlyProduction || {
                "Ammo": 0,
                "Capital Ships": 0,
                "Starships": 0,
                "Vehicles": 0,
                "Food Rations": 0
            },
            ...planetData
        };

        // Add the new planet
        mapData.planets[planetName] = newPlanetData;

        // Save back to Firebase
        await FirebaseHelpers.updateMapData(mapData);

        // Recalculate faction stats
        await FirebaseHelpers.calculateFactionStats();

        res.status(201).json({ 
            message: `Planet ${planetName} created successfully`,
            planet: newPlanetData
        });

        console.log(`✅ New planet ${planetName} created by ${req.user.username}`);
    } catch (error) {
        console.error('Error creating planet:', error);
        res.status(500).json({ error: 'Failed to create planet' });
    }
});

// Delete planet
router.delete('/:planetName', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { planetName } = req.params;

        // Get current map data
        const mapData = await FirebaseHelpers.getMapData();
        
        if (!mapData || !mapData.planets || !mapData.planets[planetName]) {
            return res.status(404).json({ error: 'Planet not found' });
        }

        // Remove planet from the data
        delete mapData.planets[planetName];

        // Update Firebase with the new data
        await FirebaseHelpers.updateMapData(mapData);

        // Recalculate faction stats
        await FirebaseHelpers.calculateFactionStats();

        res.json({ 
            message: `Planet ${planetName} deleted successfully`
        });

        console.log(`✅ Planet ${planetName} deleted by ${req.user.username}`);
    } catch (error) {
        console.error(`Error deleting planet ${req.params.planetName}:`, error);
        res.status(500).json({ error: 'Failed to delete planet' });
    }
});

// Bulk update planets
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { planets } = req.body;

        if (!planets || typeof planets !== 'object') {
            return res.status(400).json({ error: 'Planets data must be an object' });
        }

        // Get current map data
        const mapData = await FirebaseHelpers.getMapData();
        
        // Update the planets section
        mapData.planets = planets;

        // Save back to Firebase
        await FirebaseHelpers.updateMapData(mapData);

        // Recalculate faction stats
        await FirebaseHelpers.calculateFactionStats();

        res.json({ 
            message: 'All planets updated successfully',
            count: Object.keys(planets).length
        });

        console.log(`✅ Bulk planet update completed by ${req.user.username}`);
    } catch (error) {
        console.error('Error bulk updating planets:', error);
        res.status(500).json({ error: 'Failed to bulk update planets' });
    }
});

// Get planets by faction
router.get('/faction/:factionName', authenticateToken, async (req, res) => {
    try {
        const { factionName } = req.params;
        const mapData = await FirebaseHelpers.getMapData();

        if (!mapData || !mapData.planets) {
            return res.json({ planets: {}, count: 0 });
        }

        const factionPlanets = {};
        for (const [planetName, planetData] of Object.entries(mapData.planets)) {
            if (planetData && planetData.faction === factionName) {
                factionPlanets[planetName] = planetData;
            }
        }

        res.json({ 
            planets: factionPlanets,
            faction: factionName,
            count: Object.keys(factionPlanets).length
        });
    } catch (error) {
        console.error(`Error fetching ${req.params.factionName} planets:`, error);
        res.status(500).json({ error: 'Failed to fetch faction planets' });
    }
});

// Initialize planets from Roblox workspace (admin only)
router.post('/initialize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // This endpoint would work with your Roblox server to initialize planets
        // You'd call this after deleting Firebase data to rebuild from workspace
        
        res.json({ 
            message: 'Planet initialization endpoint ready - call from Roblox server'
        });

        console.log(`✅ Planet initialization requested by ${req.user.username}`);
    } catch (error) {
        console.error('Error initializing planets:', error);
        res.status(500).json({ error: 'Failed to initialize planets' });
    }
});

module.exports = router;