const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { FirebaseHelpers } = require('../config/firebase');

const router = express.Router();

// Get all supply data
router.get('/', authenticateToken, async (req, res) => {
    try {
        const supplyData = await FirebaseHelpers.getSupplyData();
        
        if (!supplyData) {
            return res.json({ 
                supplies: {},
                totalSupply: 0,
                message: 'No supply data found'
            });
        }

        res.json({ 
            supplies: supplyData.items || {},
            totalSupply: supplyData.totalSupply || 0,
            lastUpdated: supplyData.lastUpdated || null
        });
    } catch (error) {
        console.error('Error fetching supply data:', error);
        res.status(500).json({ error: 'Failed to fetch supply data' });
    }
});

// Update all supply data
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { items, totalSupply } = req.body;

        if (!items || typeof items !== 'object') {
            return res.status(400).json({ error: 'Items must be provided as an object' });
        }

        // Calculate total supply if not provided
        let calculatedTotal = totalSupply;
        if (typeof totalSupply !== 'number') {
            calculatedTotal = Object.values(items).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
        }

        const supplyData = {
            items,
            totalSupply: calculatedTotal,
            lastUpdated: new Date().toISOString()
        };

        await FirebaseHelpers.updateSupplyData(supplyData);

        res.json({ 
            message: 'Supply data updated successfully',
            supplies: supplyData
        });

        console.log(`✅ Supply data updated by ${req.user.username}`);
    } catch (error) {
        console.error('Error updating supply data:', error);
        res.status(500).json({ error: 'Failed to update supply data' });
    }
});

// Update specific supply item
router.put('/:itemName', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { itemName } = req.params;
        const { amount } = req.body;

        if (typeof amount !== 'number' || amount < 0) {
            return res.status(400).json({ error: 'Amount must be a non-negative number' });
        }

        // Get current supply data
        const currentSupply = await FirebaseHelpers.getSupplyData() || { items: {}, totalSupply: 0 };

        // Update the specific item
        const oldAmount = currentSupply.items[itemName] || 0;
        currentSupply.items[itemName] = amount;

        // Recalculate total supply
        const totalDifference = amount - oldAmount;
        currentSupply.totalSupply = (currentSupply.totalSupply || 0) + totalDifference;
        currentSupply.lastUpdated = new Date().toISOString();

        await FirebaseHelpers.updateSupplyData(currentSupply);

        res.json({ 
            message: `${itemName} supply updated successfully`,
            item: { name: itemName, amount },
            totalSupply: currentSupply.totalSupply
        });

        console.log(`✅ ${itemName} supply updated to ${amount} by ${req.user.username}`);
    } catch (error) {
        console.error(`Error updating ${req.params.itemName} supply:`, error);
        res.status(500).json({ error: 'Failed to update supply item' });
    }
});

// Add to specific supply item
router.patch('/:itemName/add', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { itemName } = req.params;
        const { amount } = req.body;

        if (typeof amount !== 'number') {
            return res.status(400).json({ error: 'Amount must be a number' });
        }

        // Get current supply data
        const currentSupply = await FirebaseHelpers.getSupplyData() || { items: {}, totalSupply: 0 };

        // Add to the specific item
        const currentAmount = currentSupply.items[itemName] || 0;
        const newAmount = Math.max(0, currentAmount + amount); // Don't allow negative values

        currentSupply.items[itemName] = newAmount;
        currentSupply.totalSupply = (currentSupply.totalSupply || 0) + amount;
        currentSupply.lastUpdated = new Date().toISOString();

        await FirebaseHelpers.updateSupplyData(currentSupply);

        res.json({ 
            message: `${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} ${itemName}`,
            item: { name: itemName, amount: newAmount, change: amount },
            totalSupply: currentSupply.totalSupply
        });

        console.log(`✅ ${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} ${itemName} by ${req.user.username}`);
    } catch (error) {
        console.error(`Error adding to ${req.params.itemName} supply:`, error);
        res.status(500).json({ error: 'Failed to add to supply item' });
    }
});

// Delete supply item
router.delete('/:itemName', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { itemName } = req.params;

        // Get current supply data
        const currentSupply = await FirebaseHelpers.getSupplyData() || { items: {}, totalSupply: 0 };

        if (!currentSupply.items[itemName]) {
            return res.status(404).json({ error: 'Supply item not found' });
        }

        // Remove from total supply
        const itemAmount = currentSupply.items[itemName];
        currentSupply.totalSupply = Math.max(0, (currentSupply.totalSupply || 0) - itemAmount);

        // Remove the item
        delete currentSupply.items[itemName];
        currentSupply.lastUpdated = new Date().toISOString();

        await FirebaseHelpers.updateSupplyData(currentSupply);

        res.json({ 
            message: `${itemName} removed from supply inventory`,
            removedAmount: itemAmount,
            totalSupply: currentSupply.totalSupply
        });

        console.log(`✅ ${itemName} removed from supplies by ${req.user.username}`);
    } catch (error) {
        console.error(`Error deleting ${req.params.itemName} supply:`, error);
        res.status(500).json({ error: 'Failed to delete supply item' });
    }
});

// Reset all supplies to zero
router.post('/reset', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const supplyData = {
            items: {
                "Ammo": 0,
                "Capital Ships": 0,
                "Starships": 0,
                "Vehicles": 0,
                "Food Rations": 0
            },
            totalSupply: 0,
            lastUpdated: new Date().toISOString()
        };

        await FirebaseHelpers.updateSupplyData(supplyData);

        res.json({ 
            message: 'All supplies reset to zero',
            supplies: supplyData
        });

        console.log(`⚠️ All supplies reset to zero by ${req.user.username}`);
    } catch (error) {
        console.error('Error resetting supplies:', error);
        res.status(500).json({ error: 'Failed to reset supplies' });
    }
});

// Get supply statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const supplyData = await FirebaseHelpers.getSupplyData();
        
        if (!supplyData || !supplyData.items) {
            return res.json({ 
                totalItems: 0,
                totalSupply: 0,
                itemCount: 0,
                averagePerItem: 0
            });
        }

        const items = Object.entries(supplyData.items);
        const totalItems = items.length;
        const totalSupply = supplyData.totalSupply || 0;
        const nonZeroItems = items.filter(([_, amount]) => amount > 0).length;
        const averagePerItem = totalItems > 0 ? totalSupply / totalItems : 0;

        // Find highest and lowest supply items
        const sortedItems = items.sort((a, b) => b[1] - a[1]);
        const highest = sortedItems[0] || null;
        const lowest = sortedItems[sortedItems.length - 1] || null;

        res.json({
            totalItems,
            totalSupply,
            itemCount: totalItems,
            nonZeroItems,
            averagePerItem: Math.round(averagePerItem * 100) / 100,
            highest: highest ? { name: highest[0], amount: highest[1] } : null,
            lowest: lowest ? { name: lowest[0], amount: lowest[1] } : null,
            lastUpdated: supplyData.lastUpdated
        });
    } catch (error) {
        console.error('Error getting supply stats:', error);
        res.status(500).json({ error: 'Failed to get supply statistics' });
    }
});

module.exports = router;