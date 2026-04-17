const { admin } = require('../config/firebase');

const authenticateToken = async (req, res, next) => {
    console.log('NODE_ENV:', process.env.NODE_ENV);

    if (process.env.NODE_ENV !== 'production') {
        console.warn('[DEV] Auth bypassed');
        req.user = { id: 'dev-admin', email: 'dev@admin.com', role: 'admin' };
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = {
            id: decoded.uid,
            email: decoded.email,
            role: decoded.role || 'viewer'
        };
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'owner')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requireAdmiral = (req, res, next) => {
    if (!req.user || req.user.role !== 'admiral') {
        return res.status(403).json({ error: 'Admiral access required' });
    }
    next();
};

const requireAdmiralOrAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admiral' && req.user.role !== 'admin' && req.user.role !== 'owner')) {
        return res.status(403).json({ error: 'Admiral or Admin access required' });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireAdmiral,
    requireAdmiralOrAdmin
};