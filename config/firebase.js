const admin = require('firebase-admin');

let db = null;

function initializeFirebase() {
    try {
        // Initialize Firebase Admin SDK
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };

        // Alternative: Use service account file if you prefer
        // const serviceAccount = require('../path/to/your/firebase-service-account.json');

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://globalammod-default-rtdb.firebaseio.com'
        });

        db = admin.database();
        console.log('✅ Firebase Admin initialized successfully');
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        process.exit(1);
    }
}

// Helper functions for your database structure
const FirebaseHelpers = {
    // Get all supply data
    async getSupplyData() {
        try {
            const snapshot = await db.ref('globalSupply').once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Error getting supply data:', error);
            throw error;
        }
    },

    // Update supply data
    async updateSupplyData(supplyData) {
        try {
            await db.ref('globalSupply').set(supplyData);
            console.log('✅ Supply data updated');
            return true;
        } catch (error) {
            console.error('Error updating supply data:', error);
            throw error;
        }
    },

    // Get all planetary data
    async getPlanetaryData() {
        try {
            const snapshot = await db.ref('planets').once('value');
            const data = snapshot.val();
            
            // Return just the planets part, not the whole structure
            if (data && data.planets) {
                return data.planets;
            }
            
            // Handle direct planet structure
            return data;
        } catch (error) {
            console.error('Error getting planetary data:', error);
            throw error;
        }
    },

    async getMapData() {
        try {
            const snapshot = await db.ref('mapData').once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Error getting map data:', error);
            return null;
        }
    },

    async updateMapData(data) {
        try {
            await db.ref('mapData').set(data);
            console.log('✅ Map data updated');
            return true;
        } catch (error) {
            console.error('Error updating map data:', error);
            return false;
        }
    },

    async calculateSectorControl() {
        // For now, return a simple success message
        // This would be implemented to sync with your Roblox server
        return {
            sectorsUpdated: 0,
            message: 'Sector control calculation not yet implemented'
        };
    },

    // Update planetary data
    async updatePlanetaryData(planetaryData) {
        try {
            await db.ref('mapData/planets').set(planetaryData);
            console.log('✅ Planetary data updated');
            return true;
        } catch (error) {
            console.error('Error updating planetary data:', error);
            throw error;
        }
    },

    // Update specific planet
    async updatePlanet(planetName, planetData) {
        try {
            // Write to the correct nested path
            await db.ref(`mapData/planets/${planetName}`).set(planetData);
            console.log(`✅ Planet ${planetName} updated`);
            return true;
        } catch (error) {
            console.error(`Error updating planet ${planetName}:`, error);
            throw error;
        }
    },

    // Get all announcements (sorted by date, newest first)
    async getAnnouncements() {
        try {
            const snapshot = await db.ref('announcements').once('value');
            const data = snapshot.val();
            
            if (!data) return [];
            
            // Convert to array and sort by timestamp (newest first)
            const announcements = Object.entries(data).map(([id, announcement]) => ({
                id,
                ...announcement
            })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return announcements;
        } catch (error) {
            console.error('Error getting announcements:', error);
            throw error;
        }
    },

    // Create new announcement
    async createAnnouncement(announcementData) {
        try {
            const announcementId = `announcement_${Date.now()}`;
            const announcement = {
                ...announcementData,
                timestamp: new Date().toISOString(),
                id: announcementId
            };
            
            await db.ref(`announcements/${announcementId}`).set(announcement);
            console.log(`✅ Announcement ${announcementId} created`);
            return announcement;
        } catch (error) {
            console.error('Error creating announcement:', error);
            throw error;
        }
    },

    // Update existing announcement
    async updateAnnouncement(announcementId, announcementData) {
        try {
            const updateData = {
                ...announcementData,
                lastModified: new Date().toISOString()
            };
            
            await db.ref(`announcements/${announcementId}`).update(updateData);
            console.log(`✅ Announcement ${announcementId} updated`);
            return true;
        } catch (error) {
            console.error(`Error updating announcement ${announcementId}:`, error);
            throw error;
        }
    },

    // Delete announcement
    async deleteAnnouncement(announcementId) {
        try {
            await db.ref(`announcements/${announcementId}`).remove();
            console.log(`✅ Announcement ${announcementId} deleted`);
            return true;
        } catch (error) {
            console.error(`Error deleting announcement ${announcementId}:`, error);
            throw error;
        }
    },

    // Get production cycles count
    async getProductionCycles() {
        try {
            const mapData = await this.getMapData();
            return mapData?.productionCycles || 0;
        } catch (error) {
            console.error('Error getting production cycles:', error);
            throw error;
        }
    },

    // Increment production cycles
    async incrementProductionCycles() {
        try {
            const mapData = await this.getMapData() || {};
            const currentCycles = mapData.productionCycles || 0;
            const newCycles = currentCycles + 1;
            
            mapData.productionCycles = newCycles;
            await this.updateMapData(mapData);
            
            console.log(`✅ Production cycles incremented to ${newCycles}`);
            return newCycles;
        } catch (error) {
            console.error('Error incrementing production cycles:', error);
            throw error;
        }
    },

    // Get faction stats
    async getFactionStats() {
        try {
            const snapshot = await db.ref('factionStats').once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Error getting faction stats:', error);
            throw error;
        }
    },

    // Calculate and update faction stats from current planetary data
    // Calculate and update faction stats from current planetary data
    async calculateFactionStats() {
        try {
            const mapData = await this.getMapData();
            const planets = mapData?.planets;
            
            const factionData = {
                Republic: {
                    activePlanets: 0,
                    weeklyProduction: {
                        "Ammo": 0,
                        "Capital Ships": 0,
                        "Starships": 0,
                        "Vehicles": 0,
                        "Food Rations": 0
                    }
                },
                Separatists: {
                    activePlanets: 0,
                    weeklyProduction: {
                        "Ammo": 0,
                        "Capital Ships": 0,
                        "Starships": 0,
                        "Vehicles": 0,
                        "Food Rations": 0
                    }
                }
            };

            if (planets) {
                for (const [planetName, planetData] of Object.entries(planets)) {
                    console.log(`Planet ${planetName}:`, {
                        faction: planetData?.faction,
                        status: planetData?.status,
                        hasWeeklyProduction: !!planetData?.weeklyProduction,
                        weeklyProduction: planetData?.weeklyProduction
                    });
                    
                    if (planetData && planetData.status === "Active") {
                        const faction = planetData.faction;
                        if (factionData[faction]) {
                            factionData[faction].activePlanets += 1;

                            if (planetData.weeklyProduction) {
                                for (const [resource, amount] of Object.entries(planetData.weeklyProduction)) {
                                    if (factionData[faction].weeklyProduction[resource] !== undefined) {
                                        console.log(`Adding ${amount} ${resource} to ${faction}`);
                                        factionData[faction].weeklyProduction[resource] += amount || 0;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            console.log('Final faction data:', factionData);
            
            // Save calculated stats
            await db.ref('factionStats').set(factionData);
            return factionData;
        } catch (error) {
            console.error('Error calculating faction stats:', error);
            throw error;
        }
    }
};

module.exports = {
    initializeFirebase,
    admin,
    db: () => db,
    FirebaseHelpers
};