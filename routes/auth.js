const express = require('express');
const { admin } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token provided' });

        const decoded = await admin.auth().verifyIdToken(token);
        const role = decoded.role || 'viewer';

        res.json({
            valid: true,
            user: { id: decoded.uid, email: decoded.email, role }
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.get('/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Owner access required' });
    }
    try {
        const listUsers = await admin.auth().listUsers();
        const users = listUsers.users.map(u => ({
            uid: u.uid,
            email: u.email,
            role: u.customClaims?.role || 'viewer'
        }));
        res.json({ users });
    } catch {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.post('/assign-role', authenticateToken, async (req, res) => {
    if (req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Owner access required' });
    }
    try {
        const { uid, role } = req.body;
        if (!['admin', 'admiral', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        await admin.auth().setCustomUserClaims(uid, { role });
        res.json({ message: 'Role assigned successfully' });
    } catch {
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

router.post('/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

module.exports = router;