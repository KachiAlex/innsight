// Firebase Functions entry point for Express app (updated for room activity logs)
process.env.FIREBASE_FUNCTIONS = 'true';

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  timeoutSeconds: 540,
  memory: '512MB',
});

// Define secrets with error handling for discovery phase
let jwtSecret, jwtRefreshSecret;
try {
  jwtSecret = defineSecret('JWT_SECRET');
  jwtRefreshSecret = defineSecret('JWT_REFRESH_SECRET');
} catch (e) {
  // During discovery, create placeholder secrets
  jwtSecret = { value: () => process.env.JWT_SECRET || '' };
  jwtRefreshSecret = { value: () => process.env.JWT_REFRESH_SECRET || '' };
}

// Cache the Express app instance
let cachedApp = null;

// Export as Firebase Function v2 with secrets
exports.api = onRequest(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: '512MB',
    secrets: [jwtSecret, jwtRefreshSecret],
  },
  (req, res) => {
    // Lazy load Express app only on first request
    if (!cachedApp) {
      try {
        // Set secrets as environment variables
        process.env.JWT_SECRET = jwtSecret.value();
        process.env.JWT_REFRESH_SECRET = jwtRefreshSecret.value();
        
        // Load the Express app
        const appModule = require('./dist/index.js');
        cachedApp = appModule.app;
      } catch (error) {
        console.error('Error loading Express app:', error);
        return res.status(500).json({ 
          error: 'Failed to initialize application',
          message: error.message 
        });
      }
    }
    
    // Delegate to Express app
    return cachedApp(req, res);
  }
);
