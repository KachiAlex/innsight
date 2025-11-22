// Firebase Functions entry point for Express app
// Set environment variable to prevent Express server from starting
process.env.FIREBASE_FUNCTIONS = 'true';

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// Define secrets
const jwtSecret = defineSecret('JWT_SECRET');
const jwtRefreshSecret = defineSecret('JWT_REFRESH_SECRET');

// Initialize Firebase Admin (if needed)
try {
  admin.initializeApp();
} catch (e) {
  // Already initialized
}

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  timeoutSeconds: 540,
  memory: '512MB',
});

// Export as Firebase Function v2 with secrets
exports.api = onRequest(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: '512MB',
    secrets: [jwtSecret, jwtRefreshSecret],
  },
  (req, res) => {
    // Set secrets as environment variables for the Express app
    // This must be done before importing the app
    process.env.JWT_SECRET = jwtSecret.value();
    process.env.JWT_REFRESH_SECRET = jwtRefreshSecret.value();
    
    // Import the compiled Express app dynamically to ensure secrets are set first
    // Note: This requires the backend to be built first (npm run build)
    const { app } = require('./dist/index.js');
    return app(req, res);
  }
);
