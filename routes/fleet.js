const express = require('express');
const { authenticateToken, requireAdmiralOrAdmin } = require('../middleware/auth');
const { FirebaseHelpers } = require('../config/firebase');

const router = express.Router();

// Get all venators
router.get('/', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const venators = await FirebaseHelpers.getVenators();
        res.json({ venators: venators || {} });
    } catch (error) {
        console.error('Error fetching venators:', error);
        res.status(500).json({ error: 'Failed to fetch venators' });
    }
});

// Add new venator
router.post('/', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { customName, battalion, commander, startingPlanet } = req.body;
        
        const venator = await FirebaseHelpers.addVenator({
            customName,
            battalion,
            commander,
            currentPlanet: startingPlanet,
            travelingTo: null,
            departureDate: null,
            arrivalDate: null,
            created: new Date().toISOString()
        });

        res.json({ 
            message: 'Venator created successfully',
            venator
        });
    } catch (error) {
        console.error('Error creating venator:', error);
        res.status(500).json({ error: 'Failed to create venator' });
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

// Update venator details
router.put('/:venatorId', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { venatorId } = req.params;
        const updateData = req.body;

        await FirebaseHelpers.updateVenator(venatorId, updateData);

        res.json({ 
            message: 'Venator updated successfully'
        });
    } catch (error) {
        console.error('Error updating venator:', error);
        res.status(500).json({ error: 'Failed to update venator' });
    }
});

// Delete venator
router.delete('/:venatorId', authenticateToken, requireAdmiralOrAdmin, async (req, res) => {
    try {
        const { venatorId } = req.params;

        await FirebaseHelpers.deleteVenator(venatorId);

        res.json({ 
            message: 'Venator deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting venator:', error);
        res.status(500).json({ error: 'Failed to delete venator' });
    }
});

module.exports = router;