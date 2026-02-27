const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { db } = require('../config/firebase');

const router = express.Router();

const getCISFleets = async () => {
    const snapshot = await db().ref('cisFleets').once('value');
    return snapshot.val() || {};
};

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const fleets = await getCISFleets();
        res.json({ fleets });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch CIS fleets' });
    }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { fleetName, commander, group, startingPlanet, composition, description } = req.body;
        const fleets = await getCISFleets();
        const fleetId = `cisfleet-${Object.keys(fleets).length + 1}`;

        const fleet = {
            fleetName,
            commander,
            group,
            description: description || '',
            currentPlanet: startingPlanet,
            travelingTo: null,
            arrivalDate: null,
            composition: {
                dreadnoughts: composition.dreadnoughts || 0,
                munificents: composition.munificents || 0,
                providences: composition.providences || 0
            },
            created: new Date().toISOString()
        };

        await db().ref(`cisFleets/${fleetId}`).set(fleet);
        res.json({ message: 'CIS Fleet created successfully', fleet });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create CIS fleet' });
    }
});

router.post('/move', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { fleetIds, destination, travelDays } = req.body;
        const now = new Date();
        const arrivalDate = new Date(now.getTime() + travelDays * 24 * 60 * 60 * 1000);

        const updates = {};
        for (const id of fleetIds) {
            const snapshot = await db().ref(`cisFleets/${id}`).once('value');
            const fleetData = snapshot.val();
            updates[`cisFleets/${id}`] = {
                ...fleetData,
                travelingTo: destination,
                departureDate: now.toISOString(),
                arrivalDate: arrivalDate.toISOString()
            };
        }

        await db().ref().update(updates);
        res.json({ message: `${fleetIds.length} fleet(s) en route to ${destination} (${travelDays} days)` });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to move CIS fleets' });
    }
});

router.put('/:fleetId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { fleetId } = req.params;
        const { fleetName, commander, group, composition, description } = req.body;

        const existing = (await db().ref(`cisFleets/${fleetId}`).once('value')).val();
        if (!existing) return res.status(404).json({ error: 'Fleet not found' });

        await db().ref(`cisFleets/${fleetId}`).update({
            ...existing,
            fleetName,
            commander,
            group,
            composition,
            description: description || ''
        });

        res.json({ message: 'Fleet updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update CIS fleet' });
    }
});

router.delete('/:fleetId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db().ref(`cisFleets/${req.params.fleetId}`).remove();
        res.json({ message: 'Fleet deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete CIS fleet' });
    }
});

module.exports = router;