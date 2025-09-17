const express = require('express');
const router = express.Router();
const { FirebaseHelpers } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

// GET /api/announcements - Get all announcements
router.get('/', authenticateToken, async (req, res) => {
    try {
        const announcements = await FirebaseHelpers.getAnnouncements();
        res.json({
            success: true,
            announcements: announcements
        });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch announcements'
        });
    }
});

// GET /api/announcements/:id - Get specific announcement
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const announcements = await FirebaseHelpers.getAnnouncements();
        const announcement = announcements.find(a => a.id === req.params.id);
        
        if (!announcement) {
            return res.status(404).json({
                success: false,
                error: 'Announcement not found'
            });
        }

        res.json({
            success: true,
            announcement: announcement
        });
    } catch (error) {
        console.error('Error fetching announcement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch announcement'
        });
    }
});

// POST /api/announcements - Create new announcement
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { robloxImageId, announcementType, announcementText } = req.body;

        // Validation
        if (!robloxImageId || !announcementType || !announcementText) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: robloxImageId, announcementType, and announcementText are required'
            });
        }

        // Validate announcement type
        const validTypes = ['Success', 'News', 'Failure'];
        if (!validTypes.includes(announcementType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid announcement type. Must be Success, News, or Failure'
            });
        }

        // Validate Roblox Image ID (either numeric ID or rbxasset URL)
        const isNumericId = /^\d+$/.test(robloxImageId);
        const isRbxAsset = robloxImageId.startsWith('rbxasset://');
        
        if (!isNumericId && !isRbxAsset) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Roblox Image ID. Must be a numeric ID or start with rbxasset://'
            });
        }

        const announcementData = {
            robloxImageId: robloxImageId.trim(),
            announcementType,
            announcementText: announcementText.trim(),
            createdBy: req.user.username
        };

        const newAnnouncement = await FirebaseHelpers.createAnnouncement(announcementData);

        res.json({
            success: true,
            message: 'Announcement created successfully',
            announcement: newAnnouncement
        });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create announcement'
        });
    }
});

// PUT /api/announcements/:id - Update announcement
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { robloxImageId, announcementType, announcementText } = req.body;
        const announcementId = req.params.id;

        // Check if announcement exists
        const announcements = await FirebaseHelpers.getAnnouncements();
        const existingAnnouncement = announcements.find(a => a.id === announcementId);
        
        if (!existingAnnouncement) {
            return res.status(404).json({
                success: false,
                error: 'Announcement not found'
            });
        }

        // Validation
        if (!robloxImageId || !announcementType || !announcementText) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: robloxImageId, announcementType, and announcementText are required'
            });
        }

        // Validate announcement type
        const validTypes = ['Success', 'News', 'Failure'];
        if (!validTypes.includes(announcementType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid announcement type. Must be Success, News, or Failure'
            });
        }

        // Validate Roblox Image ID
        const isNumericId = /^\d+$/.test(robloxImageId);
        const isRbxAsset = robloxImageId.startsWith('rbxasset://');
        
        if (!isNumericId && !isRbxAsset) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Roblox Image ID. Must be a numeric ID or start with rbxasset://'
            });
        }

        const updateData = {
            robloxImageId: robloxImageId.trim(),
            announcementType,
            announcementText: announcementText.trim(),
            modifiedBy: req.user.username
        };

        await FirebaseHelpers.updateAnnouncement(announcementId, updateData);

        res.json({
            success: true,
            message: 'Announcement updated successfully'
        });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update announcement'
        });
    }
});

// DELETE /api/announcements/:id - Delete announcement
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const announcementId = req.params.id;

        // Check if announcement exists
        const announcements = await FirebaseHelpers.getAnnouncements();
        const existingAnnouncement = announcements.find(a => a.id === announcementId);
        
        if (!existingAnnouncement) {
            return res.status(404).json({
                success: false,
                error: 'Announcement not found'
            });
        }

        await FirebaseHelpers.deleteAnnouncement(announcementId);

        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete announcement'
        });
    }
});

// GET /api/announcements/public/latest - Public endpoint for Roblox to fetch latest announcements
// This doesn't require authentication so your Roblox game can access it
router.get('/public/latest', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10; // Default to 10 latest announcements
        const announcements = await FirebaseHelpers.getAnnouncements();
        
        // Return only the latest announcements (already sorted by timestamp)
        const latestAnnouncements = announcements.slice(0, limit);
        
        res.json({
            success: true,
            announcements: latestAnnouncements,
            count: latestAnnouncements.length
        });
    } catch (error) {
        console.error('Error fetching latest announcements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch announcements'
        });
    }
});

module.exports = router;