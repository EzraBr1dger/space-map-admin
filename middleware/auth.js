const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT tokens
const authenticateToken = (req, res, next) => {
    // DEV BYPASS only active when NODE_ENV is explicitly NOT 'production'.
    // Vercel always sets NODE_ENV=production, so this can never run in deployment.
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[DEV] Auth bypassed — attaching mock admin user to request');
        req.user = { id: 'dev-admin', username: 'DevAdmin', role: 'admin' };
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
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
    if (!req.user || (req.user.role !== 'admiral' && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Admiral or Admin access required' });
    }
    next();
};

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireAdmiral,
    requireAdmiralOrAdmin,
    generateToken,
    verifyToken,
    JWT_SECRET
};
