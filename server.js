require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const supplyRoutes = require('./routes/supplies');
const statsRoutes = require('./routes/stats');
const announcementRoutes = require('./routes/announcements');
const mapDataRoutes = require('./routes/mapData');


// Import Firebase config
const { initializeFirebase } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase
initializeFirebase();

// Security middleware
//app.use(helmet({
//    contentSecurityPolicy: {
//        directives: {
//            defaultSrc: ["'self'"],
//            scriptSrc: ["'self'", "'unsafe-inline'"],
//            scriptSrcAttr: ["'unsafe-inline'"],
//            styleSrc: ["'self'", "'unsafe-inline'"],
//            imgSrc: ["'self'", "data:", "https:"],
//        },
//    },
//}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : 'http://localhost:3001',  // React dev server runs on 3001
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (for your frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/supplies', supplyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/mapdata', mapDataRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Error handling middleware (MUST come before catch-all routes)
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`🚀 Space Map Admin Panel server running on port ${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    console.log(`🔥 Firebase connected and ready`);
});