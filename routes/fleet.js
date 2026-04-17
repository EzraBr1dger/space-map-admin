const express = require('express');
const { authenticateToken, requireAdmiralOrAdmin } = require('../middleware/auth');
const { FirebaseHelpers, db } = require('../config/firebase');

const router = express.Router();

// Get all fleets + available venator count
router.get('/', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const fleets = await FirebaseHelpers.getFleets();
        const venatorStats = await FirebaseHelpers.getAvailableVenators();
        
        res.json({ 
            fleets,
            venatorStats
        });
    } catch (error) {
        console.error('Error fetching fleets:', error);
        res.status(500).json({ error: 'Failed to fetch fleets' });
    }
});

// Add new fleet
router.post('/', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { fleetName, commander, battalions, startingPlanet, composition, description } = req.body;

        // DEV BYPASS skip venator availability check outside production.
        // In production, FirebaseHelpers.addFleet enforces availability normally.
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev) {
            console.warn('[DEV] Skipping venator resource check for fleet creation');
        }

        const fleetPayload = {
            fleetName,
            commander,
            battalions: battalions || [],
            description: description ?? '',
            currentPlanet: startingPlanet,
            travelingTo: null,
            departureDate: null,
            arrivalDate: null,
            composition: {
                venators: composition.venators || 0,
                frigates: composition.frigates || 0
            },
            created: new Date().toISOString()
        };

        let fleet;
        if (isDev) {
            // Write directly to Firebase, bypassing the venator validation in FirebaseHelpers
            const fleets = await FirebaseHelpers.getFleets();
            const nextId = Object.keys(fleets).length + 1;
            const fleetId = `fleet-${nextId}`;
            await db().ref(`fleets/${fleetId}`).set(fleetPayload);
            fleet = { id: fleetId, ...fleetPayload };
        } else {
            fleet = await FirebaseHelpers.addFleet(fleetPayload);
        }

        res.json({ message: 'Fleet created successfully', fleet });
    } catch (error) {
        console.error('Error creating fleet:', error);
        res.status(500).json({ error: error.message || 'Failed to create fleet' });
    }
});

// Move fleets
router.post('/move', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { fleetIds, destination, travelDays, instantMove } = req.body;
        
        if (instantMove && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can instant move' });
        }

        const result = await FirebaseHelpers.moveFleets(
            fleetIds, 
            destination, 
            travelDays, 
            instantMove || false
        );

        res.json({ 
            message: instantMove 
                ? `${fleetIds.length} fleet(s) moved instantly to ${destination}`
                : `${fleetIds.length} fleet(s) en route to ${destination} (${travelDays} days)`,
            result
        });
    } catch (error) {
        console.error('Error moving fleets:', error);
        res.status(500).json({ error: error.message || 'Failed to move fleets' });
    }
});

// Update fleet
router.put('/:fleetId', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { fleetId } = req.params;
        const { fleetName, commander, battalions, composition, description } = req.body;


        
        console.log('UPDATE FLEET BODY:', req.body);
        console.log('DESCRIPTION:', description);

        const existingFleet = (await db().ref(`fleets/${fleetId}`).once('value')).val();

        if (!existingFleet) {
            return res.status(404).json({ error: 'Fleet not found' });
        }

        const updateData = {
            ...existingFleet,
            fleetName,
            commander,
            battalions: battalions || [],
            composition,
            description: description ?? ''
        };

        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev) {
            // Bypass venator validation — write directly so 0-resource updates are allowed
            console.warn('[DEV] Skipping venator resource check for fleet update');
            await db().ref(`fleets/${fleetId}`).set({
                ...updateData,
                battalions: updateData.battalions && updateData.battalions.length > 0
                    ? updateData.battalions.reduce((acc, val, i) => { acc[i] = val; return acc; }, {})
                    : null
            });
        } else {
            await FirebaseHelpers.updateFleet(fleetId, updateData);
        }

        res.json({ 
            message: 'Fleet updated successfully'
        });
    } catch (error) {
        console.error('Error updating fleet:', error);
        res.status(500).json({ error: error.message || 'Failed to update fleet' });
    }
});

// Delete fleet
router.delete('/:fleetId', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { fleetId } = req.params;
        await FirebaseHelpers.deleteFleet(fleetId);

        res.json({ 
            message: 'Fleet deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting fleet:', error);
        res.status(500).json({ error: 'Failed to delete fleet' });
    }
});


module.exports = router;
