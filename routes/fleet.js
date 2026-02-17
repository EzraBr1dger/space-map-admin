const express = require('express');
const { authenticateToken, requireAdmiralOrAdmin } = require('../middleware/auth');
const { FirebaseHelpers, db } = require('../config/firebase');

const router = express.Router();

// Get all venators (auto-generated based on Capital Ships count)
router.get('/', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const supplyData = await FirebaseHelpers.getSupplyData();
        const capitalShips = Math.floor(supplyData?.items?.['Capital Ships'] || 0);
        
        const venators = await FirebaseHelpers.getVenators();
        
        // Auto-generate venators to match capital ships count
        const generatedVenators = {};
        for (let i = 1; i <= capitalShips; i++) {
            const venatorId = `venator-${i}`;
            generatedVenators[venatorId] = venators[venatorId] || {
                customName: `Venator ${i}`,
                battalion: 'Unassigned',
                commander: '',
                currentPlanet: 'Coruscant',
                travelingTo: null,
                departureDate: null,
                arrivalDate: null,
                created: new Date().toISOString()
            };
        }
        
        res.json({ 
            venators: generatedVenators,
            totalCapitalShips: capitalShips
        });
    } catch (error) {
        console.error('Error fetching venators:', error);
        res.status(500).json({ error: 'Failed to fetch venators' });
    }
});

// Move venators (single or multiple)
router.post('/move', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { venatorIds, destination, travelDays, instantMove } = req.body;
        
        // Only admins can instant move
        if (instantMove && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can instant move' });
        }

        const result = await FirebaseHelpers.moveVenators(
            venatorIds, 
            destination, 
            travelDays, 
            instantMove || false
        );

        res.json({ 
            message: instantMove 
                ? `${venatorIds.length} venator(s) moved instantly to ${destination}`
                : `${venatorIds.length} venator(s) en route to ${destination} (${travelDays} days)`,
            result
        });
    } catch (error) {
        console.error('Error moving venators:', error);
        res.status(500).json({ error: error.message || 'Failed to move venators' });
    }
});

// Update venator details (name, battalion, commander only)
router.put('/:venatorId', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { venatorId } = req.params;
        const { customName, battalion, commander } = req.body;

        // Get existing venator data first
        const existingVenator = (await db().ref(`venators/${venatorId}`).once('value')).val();
        
        if (!existingVenator) {
            return res.status(404).json({ error: 'Venator not found' });
        }

        // Only update specific fields, preserve everything else
        const updateData = {
            ...existingVenator, // Keep all existing data
            customName,
            battalion,
            commander
        };

        await FirebaseHelpers.updateVenator(venatorId, updateData);

        res.json({ 
            message: 'Venator updated successfully'
        });
    } catch (error) {
        console.error('Error updating venator:', error);
        res.status(500).json({ error: 'Failed to update venator' });
    }
});

module.exports = router;