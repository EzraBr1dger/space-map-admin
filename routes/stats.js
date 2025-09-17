const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { FirebaseHelpers } = require('../config/firebase');

const router = express.Router();

// Get comprehensive dashboard stats
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        // Get all data in parallel for better performance
        const [mapData, supplies, factionStats, productionCycles] = await Promise.all([
            FirebaseHelpers.getMapData(),
            FirebaseHelpers.getSupplyData(),
            FirebaseHelpers.getFactionStats(),
            FirebaseHelpers.getProductionCycles()
        ]);

        const planets = mapData?.planets;
        // Calculate planet statistics
        const planetStats = {
            total: 0,
            active: 0,
            inactive: 0,
            contested: 0,
            republic: 0,
            separatists: 0
        };

        if (planets) {
            for (const planetData of Object.values(planets)) {
                if (planetData) {
                    planetStats.total++;
                    
                    if (planetData.status === 'Active') planetStats.active++;
                    else if (planetData.status === 'Inactive') planetStats.inactive++;
                    else if (planetData.status === 'Contested') planetStats.contested++;
                    
                    if (planetData.faction === 'Republic') planetStats.republic++;
                    else if (planetData.faction === 'Separatists') planetStats.separatists++;
                }
            }
        }

        // Calculate supply statistics
        const supplyStats = {
            totalSupply: supplies?.totalSupply || 0,
            itemCount: supplies?.items ? Object.keys(supplies.items).length : 0,
            items: supplies?.items || {}
        };

        // Calculate production statistics from faction stats
        const productionStats = {
            republic: factionStats?.Republic || {
                activePlanets: 0,
                weeklyProduction: {}
            },
            separatists: factionStats?.Separatists || {
                activePlanets: 0,
                weeklyProduction: {}
            },
            totalProduction: {}
        };

        // Calculate combined production totals
        const resources = ['Ammo', 'Capital Ships', 'Starships', 'Vehicles', 'Food Rations'];
        for (const resource of resources) {
            const republicProduction = productionStats.republic.weeklyProduction[resource] || 0;
            const separatistsProduction = productionStats.separatists.weeklyProduction[resource] || 0;
            productionStats.totalProduction[resource] = republicProduction + separatistsProduction;
        }

        res.json({
            planets: planetStats,
            supplies: supplyStats,
            production: productionStats,
            productionCycles: productionCycles || 0,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Get faction comparison stats
router.get('/factions', authenticateToken, async (req, res) => {
    try {
        const [planets, factionStats] = await Promise.all([
            FirebaseHelpers.getPlanetaryData(),
            FirebaseHelpers.getFactionStats()
        ]);

        // Calculate detailed faction comparison
        const comparison = {
            Republic: {
                planets: {
                    active: 0,
                    inactive: 0,
                    contested: 0,
                    total: 0
                },
                production: factionStats?.Republic?.totalProduction || {},
                activePlanets: factionStats?.Republic?.activePlanets || 0
            },
            Separatists: {
                planets: {
                    active: 0,
                    inactive: 0,
                    contested: 0,
                    total: 0
                },
                production: factionStats?.Separatists?.totalProduction || {},
                activePlanets: factionStats?.Separatists?.activePlanets || 0
            }
        };

        // Count planets by faction and status
        if (planets) {
            for (const planetData of Object.values(planets)) {
                if (planetData && comparison[planetData.faction]) {
                    comparison[planetData.faction].planets.total++;
                    
                    if (planetData.status === 'Active') {
                        comparison[planetData.faction].planets.active++;
                    } else if (planetData.status === 'Inactive') {
                        comparison[planetData.faction].planets.inactive++;
                    } else if (planetData.status === 'Contested') {
                        comparison[planetData.faction].planets.contested++;
                    }
                }
            }
        }

        // Calculate production advantages
        const productionComparison = {};
        const resources = ['Ammo', 'Capital Ships', 'Starships', 'Vehicles', 'Food Rations'];
        
        for (const resource of resources) {
            const republicProd = comparison.Republic.production[resource] || 0;
            const separatistsProd = comparison.Separatists.production[resource] || 0;
            
            productionComparison[resource] = {
                republic: republicProd,
                separatists: separatistsProd,
                total: republicProd + separatistsProd,
                advantage: republicProd > separatistsProd ? 'Republic' : separatistsProd > republicProd ? 'Separatists' : 'Tied',
                difference: Math.abs(republicProd - separatistsProd)
            };
        }

        res.json({
            factionComparison: comparison,
            productionComparison,
            summary: {
                republicPlanets: comparison.Republic.planets.total,
                separatistsPlanets: comparison.Separatists.planets.total,
                republicActive: comparison.Republic.planets.active,
                separatistsActive: comparison.Separatists.planets.active,
                totalPlanets: comparison.Republic.planets.total + comparison.Separatists.planets.total
            }
        });
    } catch (error) {
        console.error('Error fetching faction stats:', error);
        res.status(500).json({ error: 'Failed to fetch faction statistics' });
    }
});

// Get production cycles and increment
router.get('/production-cycles', authenticateToken, async (req, res) => {
    try {
        const cycles = await FirebaseHelpers.getProductionCycles();
        res.json({ 
            productionCycles: cycles,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching production cycles:', error);
        res.status(500).json({ error: 'Failed to fetch production cycles' });
    }
});

// Increment production cycles (admin only)
router.post('/production-cycles/increment', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const newCycles = await FirebaseHelpers.incrementProductionCycles();
        
        res.json({ 
            message: 'Production cycle incremented',
            productionCycles: newCycles,
            incrementedBy: req.user.username
        });

        console.log(`✅ Production cycle incremented to ${newCycles} by ${req.user.username}`);
    } catch (error) {
        console.error('Error incrementing production cycles:', error);
        res.status(500).json({ error: 'Failed to increment production cycles' });
    }
});

// Get historical data trends (mock data for now)
router.get('/trends', authenticateToken, async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        // For now, return mock trend data
        // In a real implementation, you'd store historical snapshots
        const trends = {
            supplies: [],
            planetCount: [],
            production: [],
            message: 'Historical trend tracking not yet implemented. This would require storing daily snapshots.'
        };

        res.json({
            trends,
            period: `${days} days`,
            note: 'Implement historical data storage to populate real trends'
        });
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(500).json({ error: 'Failed to fetch trend data' });
    }
});

// Recalculate all faction stats (admin only)
router.post('/recalculate', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const factionStats = await FirebaseHelpers.calculateFactionStats();
        
        res.json({ 
            message: 'Faction statistics recalculated successfully',
            factionStats,
            recalculatedBy: req.user.username
        });

        console.log(`✅ Faction stats recalculated by ${req.user.username}`);
    } catch (error) {
        console.error('Error recalculating faction stats:', error);
        res.status(500).json({ error: 'Failed to recalculate faction statistics' });
    }
});

// Get system health check
router.get('/health', authenticateToken, async (req, res) => {
    try {
        const healthCheck = {
            server: 'online',
            firebase: 'checking',
            dataIntegrity: 'checking',
            timestamp: new Date().toISOString()
        };

        // Test Firebase connection
        try {
            await FirebaseHelpers.getProductionCycles();
            healthCheck.firebase = 'online';
        } catch (error) {
            healthCheck.firebase = 'error';
            healthCheck.firebaseError = error.message;
        }

        // Basic data integrity check
        try {
            const [planets, supplies] = await Promise.all([
                FirebaseHelpers.getPlanetaryData(),
                FirebaseHelpers.getSupplyData()
            ]);

            const issues = [];
            
            if (!planets) issues.push('No planetary data found');
            if (!supplies) issues.push('No supply data found');
            
            if (issues.length === 0) {
                healthCheck.dataIntegrity = 'good';
            } else {
                healthCheck.dataIntegrity = 'issues';
                healthCheck.dataIssues = issues;
            }
        } catch (error) {
            healthCheck.dataIntegrity = 'error';
            healthCheck.dataError = error.message;
        }

        const status = (healthCheck.firebase === 'online' && healthCheck.dataIntegrity === 'good') ? 200 : 503;
        res.status(status).json(healthCheck);
    } catch (error) {
        console.error('Error performing health check:', error);
        res.status(500).json({ 
            server: 'error',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;