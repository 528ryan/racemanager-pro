/**
 * Environment Configuration Utility
 * Loads environment variables from .env file for client-side use
 */

class EnvironmentConfig {
    constructor() {
        this.config = {};
        this.loadConfig();
    }

    loadConfig() {
        try {
            // For client-side applications, use environment variables directly
            // In production, these should come from build-time environment variables
            this.loadFallbackConfig();
        } catch (error) {
            console.warn('Could not load environment config, using fallback:', error);
            this.loadFallbackConfig();
        }
    }

    parseEnvFile(envText) {
        const lines = envText.split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                    this.config[key.trim()] = value.trim();
                }
            }
        });
    }

    loadFallbackConfig() {
        // Fallback configuration - in production these should come from secure sources
        this.config = {
            FIREBASE_API_KEY: "AIzaSyBxKQQ7bhMKV_uWTj4TWtp4TLcAWzRZcv8",
            FIREBASE_AUTH_DOMAIN: "motorsport-pro-7d9cc.firebaseapp.com",
            FIREBASE_PROJECT_ID: "motorsport-pro-7d9cc",
            FIREBASE_STORAGE_BUCKET: "motorsport-pro-7d9cc.firebasestorage.app",
            FIREBASE_MESSAGING_SENDER_ID: "833342156887",
            FIREBASE_APP_ID: "1:833342156887:web:3a363df0152fb6ce253312",
            FIREBASE_MEASUREMENT_ID: "G-FGZ8P4QLYZ",
            APP_NAME: "RaceManager Pro",
            APP_VERSION: "2.0.0",
            ENVIRONMENT: "development"
        };
    }

    get(key) {
        return this.config[key];
    }

    getFirebaseConfig() {
        return {
            apiKey: this.get('FIREBASE_API_KEY'),
            authDomain: this.get('FIREBASE_AUTH_DOMAIN'),
            projectId: this.get('FIREBASE_PROJECT_ID'),
            storageBucket: this.get('FIREBASE_STORAGE_BUCKET'),
            messagingSenderId: this.get('FIREBASE_MESSAGING_SENDER_ID'),
            appId: this.get('FIREBASE_APP_ID'),
            measurementId: this.get('FIREBASE_MEASUREMENT_ID')
        };
    }

    isProduction() {
        return this.get('ENVIRONMENT') === 'production';
    }

    isDevelopment() {
        return this.get('ENVIRONMENT') === 'development';
    }
}

// Export singleton instance
const envConfig = new EnvironmentConfig();
export default envConfig;