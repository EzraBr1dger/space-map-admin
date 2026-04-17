const express = require('express');
const { admin } = require('../config/firebase');

const router = express.Router();

router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = await admin.auth().verifyIdToken(token);
        const role = decoded.role || 'viewer';

        res.json({
            valid: true,
            user: {
                id: decoded.uid,
                email: decoded.email,
                role
            }
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.post('/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

module.exports = router;