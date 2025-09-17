const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, verifyToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Simple in-memory user store (replace with database in production)
const users = [
    {
        id: 1,
        username: 'LoreTeamCW:P',
        // Default password: 'password123' - CHANGE THIS!
        password: '$2a$10$iKPIV.wytj4HfAo9vjBpdOPvYXup.pTPyRa2UDkuXUUqtigbkT3w2',
        role: 'admin'
    }
];

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find user
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

        console.log(`✅ User ${username} logged in successfully`);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register route (for adding new users)
router.post('/register', authenticateToken, async (req, res) => {
    try {
        const { username, password, role = 'user' } = req.body;

        // Only admins can create new users
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Check if user already exists
        if (users.find(u => u.username === username)) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = {
            id: users.length + 1,
            username,
            password: hashedPassword,
            role
        };

        users.push(newUser);

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role
            }
        });

        console.log(`✅ New user ${username} created by ${req.user.username}`);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Verify token route
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
        }
    });
});

// Logout route (client-side handles token removal)
router.post('/logout', authenticateToken, (req, res) => {
    console.log(`✅ User ${req.user.username} logged out`);
    res.json({ message: 'Logout successful' });
});

// Change password route
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password required' });
        }

        // Find user
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;

        res.json({ message: 'Password changed successfully' });
        console.log(`✅ Password changed for user ${user.username}`);
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Password change failed' });
    }
});

module.exports = router;