/**
 * RaceManagerPro - Nova Arquitetura de Microserviços
 * Sistema escalável baseado em mensageria e injeção de dependências
 */
import { EventBus } from './core/EventBus.js';
import { StateManager } from './core/StateManager.js';
import { serviceLocator } from './core/ServiceLocator.js';
import { ComponentFactory } from './core/ComponentFactory.js';

// Services
import { SimpleAuthService } from './services/SimpleAuthService.js';
import { FirebaseService } from './services/FirebaseService.js';
import { ChampionshipService } from './services/ChampionshipService.js';
import { SocialService } from './services/SocialService.js';
import { NotificationService } from './services/NotificationService.js';

// Base Components (will be implemented as needed)

/**
 * Application Bootstrap Class
 */
class RaceManagerProApp {
    constructor() {
        this.isInitialized = false;
        this.services = {};
        this.components = {};
        this.unsubscribeCallbacks = [];
        
        console.log('🚀 RaceManagerPro Application Starting...');
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // 1. Initialize core infrastructure
            await this.initializeCore();
            
            // 2. Initialize services
            await this.initializeServices();
            
            // 3. Setup inter-service communication
            this.setupServiceDependencies();
            
            // 4. Initialize UI components
            await this.initializeComponents();
            
            // 5. Setup global event listeners
            this.setupGlobalListeners();
            
            // 6. Start the application
            this.start();
            
            this.isInitialized = true;
            console.log('✅ RaceManagerPro Application Initialized Successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize RaceManagerPro:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize core infrastructure
     */
    async initializeCore() {
        console.log('🔧 Initializing core infrastructure...');

        // Create core instances
        const eventBus = new EventBus();
        const stateManager = new StateManager();
        const componentFactory = new ComponentFactory();

        // Register in service locator
        serviceLocator.registerInstance('EventBus', eventBus);
        serviceLocator.registerInstance('StateManager', stateManager);
        serviceLocator.registerInstance('ComponentFactory', componentFactory);

        console.log('✅ Core infrastructure initialized');
    }

    /**
     * Initialize all microservices
     */
    async initializeServices() {
        console.log('🔧 Initializing microservices...');

        // Initialize services in dependency order
        const firebaseService = new FirebaseService();
        const authService = new SimpleAuthService();
        const championshipService = new ChampionshipService();
        const socialService = new SocialService();
        const notificationService = new NotificationService();

        // Register services in service locator
        serviceLocator.registerInstance('FirebaseService', firebaseService);
        serviceLocator.registerInstance('AuthService', authService);
        serviceLocator.registerInstance('ChampionshipService', championshipService);
        serviceLocator.registerInstance('SocialService', socialService);
        serviceLocator.registerInstance('NotificationService', notificationService);

        // Store references
        this.services = {
            firebase: firebaseService,
            auth: authService,
            championship: championshipService,
            social: socialService,
            notification: notificationService
        };

        console.log('✅ All microservices initialized');
    }

    /**
     * Setup dependencies between services
     */
    setupServiceDependencies() {
        console.log('🔗 Setting up service dependencies...');

        // Inject Firebase service into services that need it
        // Note: SimpleAuthService doesn't need setFirebaseService as it uses direct Firebase imports
        if (this.services.championship && typeof this.services.championship.setFirebaseService === 'function') {
            this.services.championship.setFirebaseService(this.services.firebase);
        }
        if (this.services.social && typeof this.services.social.setFirebaseService === 'function') {
            this.services.social.setFirebaseService(this.services.firebase);
        }
        if (this.services.notification && typeof this.services.notification.setFirebaseService === 'function') {
            this.services.notification.setFirebaseService(this.services.firebase);
        }

        console.log('✅ Service dependencies configured');
    }

    /**
     * Initialize UI components
     */
    async initializeComponents() {
        console.log('🔧 Initializing UI components...');
        
        // Component factory is ready for future components
        // Components will be registered when they are created
        
        console.log('✅ UI component factory configured');
    }

    /**
     * Setup global event listeners
     */
    setupGlobalListeners() {
        console.log('🔧 Setting up global listeners...');

        const eventBus = serviceLocator.get('EventBus');
        const stateManager = serviceLocator.get('StateManager');

        // Application state events
        eventBus.on('app:error', this.handleAppError.bind(this));
        eventBus.on('app:warning', this.handleAppWarning.bind(this));
        eventBus.on('app:info', this.handleAppInfo.bind(this));

        // User authentication state changes
        eventBus.on('user:authenticated', this.onUserAuthenticated.bind(this));
        eventBus.on('user:logout', this.onUserLogout.bind(this));

        // Navigation events
        eventBus.on('nav:goto', this.handleNavigation.bind(this));

        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Error handling
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            eventBus.emit('app:error', { 
                message: event.error.message, 
                stack: event.error.stack 
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            eventBus.emit('app:error', { 
                message: event.reason.message || event.reason, 
                type: 'promise_rejection' 
            });
        });

        console.log('✅ Global listeners configured');
    }

    /**
     * Start the application
     */
    start() {
        console.log('🚀 Starting RaceManager Pro application...');

        // Initialize global application state
        const stateManager = serviceLocator.get('StateManager');
        stateManager.setState('app', {
            isInitialized: true,
            currentView: 'loading',
            isLoading: false,
            error: null,
            startTime: new Date().toISOString()
        });



        // Check authentication state and show appropriate view
        this.checkAuthenticationAndStart();
        
        // Also check if user is already authenticated (timing issue fix)
        setTimeout(() => {
            const stateManager = serviceLocator.get('StateManager');
            const isAuthenticated = stateManager.getState('auth.isAuthenticated');
            const user = stateManager.getState('auth.user');
            
            console.log('🔍 Post-init auth check:', { isAuthenticated, user: !!user });
            
            if (isAuthenticated && user) {
                console.log('👤 User already authenticated, showing main view');
                this.showMainView();
            } else {
                console.log('🚪 No authenticated user, checking auth state...');
                // Check if Firebase is still initializing
                const authInitialized = stateManager.getState('auth.authInitialized');
                if (authInitialized) {
                    console.log('🔑 Auth initialized but no user - showing login');
                    this.showLoginView();
                }
            }
        }, 100);

        // Emit app started event
        const eventBus = serviceLocator.get('EventBus');
        eventBus.emit('app:started');

        // Wait for services to be ready
        this.waitForServicesReady();
        
        console.log('✅ RaceManager Pro application started');
    }

    /**
     * Wait for all services to be ready before showing UI
     */
    waitForServicesReady() {
        const eventBus = serviceLocator.get('EventBus');
        
        // Listen for auth service ready
        eventBus.on('auth:serviceInitialized', () => {
            console.log('🔐 Auth service ready, starting UI flow');
            this.checkAuthenticationAndStart();
        });
    }

    /**
     * Check authentication and show appropriate view
     */
    async checkAuthenticationAndStart() {
        try {
            console.log('🔍 Checking authentication state...');
            
            const stateManager = serviceLocator.get('StateManager');
            
            // Check if there's a persisted user
            const persistedUser = localStorage.getItem('raceManagerProUser');
            if (persistedUser) {
                try {
                    const userData = JSON.parse(persistedUser);
                    console.log('💾 Found persisted user:', userData.email);
                    
                    // Set auth state
                    stateManager.batchUpdate({
                        'auth.user': userData,
                        'auth.isAuthenticated': true,
                        'auth.authInitialized': true
                    });
                    
                    this.updateUserDataInUI(userData);
                    this.showMainView();
                    this.loadInitialData();
                    return;
                } catch (error) {
                    console.error('Error parsing persisted user:', error);
                    localStorage.removeItem('raceManagerProUser');
                }
            }
            
            // Wait for Firebase auth to initialize
            let attempts = 0;
            const maxAttempts = 30; // 3 seconds total
            
            const checkAuth = () => {
                const isAuthenticated = stateManager.getState('auth.isAuthenticated');
                const user = stateManager.getState('auth.user');
                const authInitialized = stateManager.getState('auth.authInitialized');
                
                if (authInitialized) {
                    if (isAuthenticated && user) {
                        console.log('👤 User authenticated via Firebase');
                        this.updateUserDataInUI(user);
                        this.showMainView();
                        this.loadInitialData();
                    } else {
                        console.log('🔑 No authenticated user - showing login');
                        this.showLoginView();
                    }
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkAuth, 100);
                } else {
                    console.warn('⏰ Auth initialization timeout - showing login');
                    this.showLoginView();
                }
            };
            
            checkAuth();
            
        } catch (error) {
            console.error('Error checking authentication:', error);
            this.showLoginView();
        }
    }



    /**
     * Show login view
     */
    showLoginView() {
        const stateManager = serviceLocator.get('StateManager');
        stateManager.setState('app.currentView', 'login');
        
        // Hide all screens
        this.hideElement('#loadingScreen');
        this.hideElement('#mainApp');
        
        // Show login screen
        this.showElement('#loginScreen');
        
        console.log('📝 Login view displayed');
    }



    /**
     * Show main application view
     */
    showMainView() {
        const stateManager = serviceLocator.get('StateManager');
        stateManager.setState('app.currentView', 'main');
        
        // Hide all auth screens
        this.hideElement('#loadingScreen');
        this.hideElement('#loginScreen');
        this.hideElement('#signupScreen');
        this.hideElement('#profile-setup-screen');
        
        // Show main app
        this.showElement('#mainApp');
        
        console.log('🏠 Main application view displayed - User logged in successfully');
    }

    /**
     * Handle user authentication
     */
    async onUserAuthenticated(userData) {
        console.log('👤 User authenticated:', userData.email);
        
        // Update UI with user data
        this.updateUserDataInUI(userData);
        
        // Show main application view
        this.showMainView();
        
        // Load initial data
        await this.loadInitialData();
    }

    /**
     * Update user data in the UI
     */
    updateUserDataInUI(userData) {
        try {
            // Get auth service to handle UI updates
            const authService = serviceLocator.get('AuthService');
            if (authService && authService.updateUserUI) {
                authService.updateUserUI(userData);
            }
        } catch (error) {
            console.error('Error updating user data in UI:', error);
        }
    }

    /**
     * Handle user logout
     */
    onUserLogout() {
        console.log('👋 User logged out');
        
        // Show login view
        this.showLoginView();
    }

    /**
     * Load initial application data
     */
    async loadInitialData() {
        try {
            console.log('📊 Loading initial application data...');
            
            const eventBus = serviceLocator.get('EventBus');
            
            // Load championships
            eventBus.emit('championship:loadPublic');
            
            // Load social feed
            eventBus.emit('social:loadFeed');
            
            console.log('✅ Initial data loading initiated');
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    /**
     * Handle navigation events
     */
    handleNavigation(destination) {
        console.log('🧭 Navigation to:', destination);
        
        const stateManager = serviceLocator.get('StateManager');
        stateManager.setState('app.currentView', destination);
        
        // Handle view switching logic here
        // This can be expanded to a more sophisticated routing system
    }

    /**
     * Handle application errors
     */
    handleAppError(errorData) {
        console.error('Application Error:', errorData);
        
        // You could implement error reporting, user notifications, etc.
        this.showErrorMessage(errorData.message || 'An unexpected error occurred');
    }

    /**
     * Handle application warnings
     */
    handleAppWarning(warningData) {
        console.warn('Application Warning:', warningData);
    }

    /**
     * Handle application info
     */
    handleAppInfo(infoData) {
        console.info('Application Info:', infoData);
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        console.error('Initialization Error:', error);
        
        // Show error message to user
        document.body.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #ff6b6b, #ee5a52);
                color: white;
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
                font-family: Arial, sans-serif;
            ">
                <h2>🚨 Application Error</h2>
                <p>Failed to initialize RaceManager Pro</p>
                <p style="font-size: 0.9em; opacity: 0.8;">${error.message}</p>
                <button onclick="location.reload()" style="
                    margin-top: 1rem;
                    padding: 0.5rem 1rem;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    border-radius: 4px;
                    color: white;
                    cursor: pointer;
                ">Reload Application</button>
            </div>
        `;
    }

    /**
     * Show error message to user
     */
    showErrorMessage(message) {
        // Simple error notification
        const errorEl = document.createElement('div');
        errorEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a52);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
        `;
        errorEl.textContent = message;
        
        document.body.appendChild(errorEl);
        
        setTimeout(() => {
            if (errorEl.parentNode) {
                errorEl.parentNode.removeChild(errorEl);
            }
        }, 5000);
    }

    /**
     * Utility: Hide element
     */
    hideElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
        }
    }

    /**
     * Utility: Show element
     */
    showElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'flex';
        }
    }

    /**
     * Get service instance
     */
    getService(serviceName) {
        return this.services[serviceName] || serviceLocator.get(`${serviceName}Service`);
    }

    /**
     * Get current application state
     */
    getAppState() {
        const stateManager = serviceLocator.get('StateManager');
        return stateManager.getState('app');
    }

    /**
     * Check if application is initialized
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Cleanup application resources
     */
    cleanup() {
        console.log('🧹 Cleaning up RaceManagerPro application...');

        try {
            // Cleanup services
            Object.values(this.services).forEach(service => {
                if (service && typeof service.destroy === 'function') {
                    service.destroy();
                }
            });

            // Cleanup event listeners
            this.unsubscribeCallbacks.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });

            // Clear service locator
            ServiceLocator.clear();

            console.log('✅ Application cleanup completed');

        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    /**
     * Restart application
     */
    async restart() {
        console.log('🔄 Restarting RaceManagerPro application...');
        
        this.cleanup();
        await this.init();
    }
}

// Create and export global app instance
const app = new RaceManagerProApp();

// Make app available globally for debugging
window.RaceManagerPro = app;

export default app;
