/**
 * AuthService - Microserviço de Autenticação
 * Gerencia todo o fluxo de autenticação da aplicação
 */
import { EventBus } from '../core/EventBus.js';
import { StateManager } from '../core/StateManager.js';
import { serviceLocator } from '../core/ServiceLocator.js';

export class AuthService {
    constructor() {
        this.eventBus = serviceLocator.get('EventBus');
        this.stateManager = serviceLocator.get('StateManager');
        this.firebaseService = null; // Will be injected
        this.authStateInitialized = false;
        this.isSignupInProgress = false; // Flag to prevent auto-login during signup
        
        this.initialize();
        this.setupUIListeners();
        
        console.log('🔐 AuthService initialized');
    }

    /**
     * Set Firebase service dependency
     */
    setFirebaseService(firebaseService) {
        this.firebaseService = firebaseService;
        this.startAuthStateListener();
    }

    /**
     * Inicializa o serviço de autenticação
     */
    initialize() {
        // Initialize auth state
        this.stateManager.setState('auth', {
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            authInitialized: false,
            profile: null
        });

        // Check persisted auth data
        this.checkPersistedAuth();
    }

    /**
     * Start Firebase auth state listener
     */
    startAuthStateListener() {
        if (!this.firebaseService) {
            console.warn('Firebase service not available yet');
            return;
        }

        try {
            // Setup Firebase Auth listener
            this.firebaseService.onAuthStateChanged(async (user) => {
                await this.handleAuthStateChange(user);
            });
            
            // Set timeout fallback
            this.setAuthTimeout();
            
            console.log('✅ AuthService Firebase listener initialized');
            this.eventBus.emit('auth:serviceInitialized');
            
        } catch (error) {
            console.error('❌ AuthService Firebase listener failed:', error);
            this.handleAuthError(error);
        }
    }

    /**
     * Handles Firebase auth state changes
     */
    async handleAuthStateChange(user) {
        console.log('🔄 Auth state changed:', user ? 'Logged in' : 'Logged out');
        
        if (!this.authStateInitialized) {
            this.authStateInitialized = true;
            this.stateManager.setState('auth.authInitialized', true);
        }

        if (user) {
            await this.handleUserLogin(user);
        } else {
            this.handleUserLogout();
        }
    }

    /**
     * Handles user login
     */
    async handleUserLogin(user) {
        // Skip login processing if signup is in progress
        if (this.isSignupInProgress) {
            console.log('🔄 Signup in progress - skipping auto-login');
            return;
        }
        
        // Check if this is a new signup in progress (temp user exists)
        const tempUser = localStorage.getItem('tempSignupUser');
        if (tempUser) {
            const tempData = JSON.parse(tempUser);
            if (tempData.uid === user.uid) {
                console.log('🔄 New signup in progress - waiting for profile completion');
                return; // Don't login yet, wait for profile setup completion
            }
        }

        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
        };

        // Load user profile to check if setup is complete
        const userProfile = await this.loadUserProfile(userData.uid);
        
        // If profile is not completed, redirect to setup
        if (!userProfile || !userProfile.profileCompleted) {
            console.log('👤 User profile incomplete - redirecting to setup');
            this.showProfileSetupScreen();
            return;
        }

        // Update state with complete profile data
        this.stateManager.batchUpdate({
            'auth.user': userProfile,
            'auth.isAuthenticated': true,
            'auth.isLoading': false
        });

        // Persist to localStorage
        localStorage.setItem('raceManagerProUser', JSON.stringify(userProfile));

        // Update UI with user data
        this.updateUserUI(userProfile);

        // Emit events
        this.eventBus.emit('auth:loginSuccess', userProfile);
        this.eventBus.emit('user:authenticated', userProfile);

        console.log('✅ User logged in:', userProfile.email);
    }

    /**
     * Handles user logout
     */
    handleUserLogout() {
        // Clear state
        this.stateManager.batchUpdate({
            'auth.user': null,
            'auth.isAuthenticated': false,
            'auth.isLoading': false,
            'championships.list': [],
            'championships.current': null,
            'social.posts': [],
            'social.following': [],
            'social.followers': [],
            'results': {}
        });

        // Clear persistence
        localStorage.removeItem('raceManagerProUser');

        // Emit event
        this.eventBus.emit('user:logout');

        console.log('✅ User logged out');
    }

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        try {
            this.stateManager.setState('auth.isLoading', true);
            this.eventBus.emit('auth.login.started', { method: 'google' });

            const result = await this.firebaseService.signInWithGoogle();
            
            // Check if this is a new user (first time Google login)
            const isNewUser = result.additionalUserInfo?.isNewUser || false;
            
            if (isNewUser) {
                // Set signup flag for new users
                this.isSignupInProgress = true;
                
                // Store temp user data for profile setup
                const tempUserData = {
                    uid: result.user.uid,
                    email: result.user.email,
                    displayName: result.user.displayName,
                    photoURL: result.user.photoURL,
                    signupMethod: 'google'
                };
                localStorage.setItem('tempSignupUser', JSON.stringify(tempUserData));
                console.log('✅ Google signup - tempSignupUser saved:', tempUserData);
                
                // Redirect to profile setup for username selection
                this.showProfileSetupScreen();
            }
            
            return result.user;

        } catch (error) {
            console.error('Google sign-in failed:', error);
            this.handleAuthError(error);
            throw error;
        } finally {
            this.stateManager.setState('auth.isLoading', false);
        }
    }

    /**
     * Check if input is email or username
     */
    isValidEmail(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input);
    }

    /**
     * Sign in with email/username and password
     */
    async signInWithEmail(emailOrUsername, password) {
        try {
            this.stateManager.setState('auth.isLoading', true);
            this.eventBus.emit('auth.login.started', { method: 'email' });

            let email = emailOrUsername.trim();
            
            // If input is not a valid email, try as username
            if (!this.isValidEmail(email)) {
                console.log('Input appears to be username, trying common domains...');
                
                // Try common domains for username
                const commonDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
                let loginSuccessful = false;
                
                for (const domain of commonDomains) {
                    try {
                        const testEmail = `${email}@${domain}`;
                        console.log('Trying login with:', testEmail);
                        const result = await this.firebaseService.signInWithEmail(testEmail, password);
                        console.log('✅ Login successful with:', testEmail);
                        return result.user;
                    } catch (domainError) {
                        console.log(`❌ Failed with ${domain}:`, domainError.code);
                        continue;
                    }
                }
                
                // If all domains failed, show helpful error
                const usernameError = new Error(`Username "${email}" not found. Try using your full email address instead.`);
                this.handleAuthError(usernameError);
                throw usernameError;
            } else {
                // Input is email, use directly
                console.log('Using email directly:', email);
                const result = await this.firebaseService.signInWithEmail(email, password);
                return result.user;
            }

        } catch (error) {
            console.error('Sign-in failed:', error);
            this.handleAuthError(error);
            throw error;
        } finally {
            this.stateManager.setState('auth.isLoading', false);
        }
    }

    /**
     * Sign up with email and password
     */
    async signUpWithEmail(email, password, profileData = {}) {
        try {
            this.stateManager.setState('auth.isLoading', true);
            this.eventBus.emit('auth.signup.started', { method: 'email' });
            
            // Set signup flag to prevent auto-login
            this.isSignupInProgress = true;

            const result = await this.firebaseService.signUpWithEmail(email, password);
            
            // Store temp user data for profile setup
            const tempUserData = {
                uid: result.user.uid,
                email: result.user.email,
                signupMethod: 'email'
            };
            localStorage.setItem('tempSignupUser', JSON.stringify(tempUserData));
            console.log('✅ Email signup - tempSignupUser saved:', tempUserData);
            
            // Redirect to profile setup
            this.showProfileSetupScreen();
            
            this.eventBus.emit('auth.signup.success', result.user);
            return result.user;

        } catch (error) {
            console.error('Email sign-up failed:', error);
            this.handleAuthError(error);
            this.isSignupInProgress = false; // Reset flag on error
            throw error;
        } finally {
            this.stateManager.setState('auth.isLoading', false);
        }
    }

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            this.stateManager.setState('auth.isLoading', true);
            this.eventBus.emit('auth.logout.started');

            await this.firebaseService.signOut();
            
            // User data will be cleared by onAuthStateChanged
            this.eventBus.emit('auth.logout.completed');

        } catch (error) {
            console.error('Sign-out failed:', error);
            this.handleAuthError(error);
            throw error;
        } finally {
            this.stateManager.setState('auth.isLoading', false);
        }
    }

    /**
     * Update UI with user data
     */
    updateUserUI(userData) {
        try {
            // Update user avatar
            const avatars = document.querySelectorAll('#user-avatar, #post-user-avatar');
            avatars.forEach(avatar => {
                if (avatar) {
                    avatar.src = userData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.displayName || userData.email)}&background=dc2626&color=fff`;
                    avatar.alt = userData.displayName || userData.email;
                }
            });

            // Update display name
            const displayNameElements = document.querySelectorAll('#user-display-name, #user-name');
            displayNameElements.forEach(element => {
                if (element) {
                    element.textContent = userData.displayName || userData.email.split('@')[0];
                }
            });

            // Update email
            const emailElements = document.querySelectorAll('#user-email');
            emailElements.forEach(element => {
                if (element) {
                    element.textContent = userData.email;
                }
            });

            console.log('✅ User UI updated');
        } catch (error) {
            console.error('Error updating user UI:', error);
        }
    }

    /**
     * Load user profile from Firestore
     */
    async loadUserProfile(userId) {
        try {
            const profile = await this.firebaseService.getUserProfile(userId);
            
            if (profile) {
                const currentUser = this.stateManager.getState('auth.user');
                const updatedUser = {
                    ...currentUser,
                    ...profile
                };
                
                this.stateManager.setState('auth.user', updatedUser);
                localStorage.setItem('raceManagerProUser', JSON.stringify(updatedUser));
                
                // Update UI with complete profile data
                this.updateUserUI(updatedUser);
            }

        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    /**
     * Create user profile in Firestore
     */
    async createUserProfile(userId, profileData) {
        try {
            await this.firebaseService.createUserProfile(userId, {
                uid: userId,
                following: [],
                followers: [],
                ...profileData
            });

        } catch (error) {
            console.error('Failed to create user profile:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(updates) {
        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) throw new Error('No authenticated user');

            await this.firebaseService.updateUserProfile(user.uid, updates);
            
            const updatedUser = { ...user, ...updates };
            this.stateManager.setState('auth.user', updatedUser);
            localStorage.setItem('raceManagerProUser', JSON.stringify(updatedUser));

            this.eventBus.emit('user.profile.updated', updatedUser);
            
        } catch (error) {
            console.error('Failed to update profile:', error);
            throw error;
        }
    }

    /**
     * Check for persisted authentication data
     */
    checkPersistedAuth() {
        const persistedUser = localStorage.getItem('raceManagerProUser');
        if (persistedUser) {
            try {
                const userData = JSON.parse(persistedUser);
                console.log('📱 Found persisted user data:', userData.email);
                
                // Set temporary state for immediate UI update
                this.stateManager.batchUpdate({
                    'auth.user': userData,
                    'auth.isAuthenticated': true,
                    'auth.authInitialized': true
                });

                this.eventBus.emit('auth.persisted.loaded', userData);

            } catch (error) {
                console.error('Failed to parse persisted user data:', error);
                localStorage.removeItem('raceManagerProUser');
            }
        }
    }

    /**
     * Set authentication timeout fallback
     */
    setAuthTimeout() {
        setTimeout(() => {
            if (!this.authStateInitialized) {
                console.warn('⚠️ Auth initialization timeout');
                
                this.stateManager.batchUpdate({
                    'auth.authInitialized': true,
                    'auth.user': null,
                    'auth.isAuthenticated': false,
                    'auth.isLoading': false
                });

                localStorage.removeItem('raceManagerProUser');
                this.eventBus.emit('auth.initialization.timeout');
            }
        }, 3000);
    }

    /**
     * Handle authentication errors
     */
    handleAuthError(error) {
        const errorData = {
            code: error.code || 'unknown',
            message: error.message || 'Authentication error',
            timestamp: Date.now()
        };

        this.stateManager.setState('auth.isLoading', false);
        this.eventBus.emit('auth.error', errorData);
        this.eventBus.emit('notification.error', {
            title: 'Authentication Error',
            message: errorData.message
        });
    }

    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        return this.stateManager.getState('auth.user');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.stateManager.getState('auth.isAuthenticated');
    }

    /**
     * Check if auth is initialized
     */
    isAuthInitialized() {
        return this.stateManager.getState('auth.authInitialized');
    }

    /**
     * Get loading state
     */
    isLoading() {
        return this.stateManager.getState('auth.isLoading');
    }

    /**
     * Setup UI event listeners
     */
    setupUIListeners() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.attachListeners());
        } else {
            this.attachListeners();
        }
    }

    /**
     * Attach event listeners to UI elements
     */
    attachListeners() {
        // Google login button
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', async () => {
                await this.signInWithGoogle();
            });
        }

        // Email login form
        const emailLoginForm = document.getElementById('email-login-form');
        if (emailLoginForm) {
            emailLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                await this.signInWithEmail(email, password);
            });
        }

        // Add Enter key support for login fields
        const emailField = document.getElementById('email');
        const passwordField = document.getElementById('password');
        
        if (emailField) {
            emailField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    passwordField ? passwordField.focus() : this.submitLogin();
                }
            });
        }
        
        if (passwordField) {
            passwordField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.submitLogin();
                }
            });
        }

        // Add Enter key support for signup fields
        const signupEmailField = document.getElementById('signup-email');
        const signupPasswordField = document.getElementById('signup-password');
        const signupConfirmPasswordField = document.getElementById('signup-confirm-password');
        
        if (signupEmailField) {
            signupEmailField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    signupPasswordField ? signupPasswordField.focus() : null;
                }
            });
        }
        
        if (signupPasswordField) {
            signupPasswordField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    signupConfirmPasswordField ? signupConfirmPasswordField.focus() : null;
                }
            });
        }
        
        if (signupConfirmPasswordField) {
            signupConfirmPasswordField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.submitSignup();
                }
            });
        }

        // Signup form
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;
                const confirmPassword = document.getElementById('signup-confirm-password').value;
                
                if (password !== confirmPassword) {
                    this.showError('Passwords do not match');
                    return;
                }
                
                await this.signUpWithEmail(email, password);
            });
        }

        // Logout buttons (multiple possible locations)
        const logoutBtn = document.getElementById('logout-btn');
        const logoutBtnMain = document.getElementById('logout-btn-main');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.signOut();
            });
        }
        
        if (logoutBtnMain) {
            logoutBtnMain.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.signOut();
            });
        }

        // Show signup/login toggles
        const showSignupBtn = document.getElementById('show-signup-btn');
        const showLoginBtn = document.getElementById('show-login-btn');
        
        if (showSignupBtn) {
            showSignupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSignupScreen();
            });
        }
        
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginScreen();
            });
        }

        // Main action buttons
        const createChampionshipBtn = document.getElementById('create-championship-btn');
        const joinChampionshipBtn = document.getElementById('join-championship-btn');  
        const findDriversBtn = document.getElementById('find-drivers-btn');

        if (createChampionshipBtn) {
            createChampionshipBtn.addEventListener('click', () => {
                this.eventBus.emit('championship:showCreateModal');
                console.log('Create championship clicked');
            });
        }

        if (joinChampionshipBtn) {
            joinChampionshipBtn.addEventListener('click', () => {
                this.eventBus.emit('championship:showJoinModal');
                console.log('Join championship clicked');
            });
        }

        if (findDriversBtn) {
            findDriversBtn.addEventListener('click', () => {
                this.eventBus.emit('social:showFindDrivers');
                console.log('Find drivers clicked');
            });
        }

        // Profile setup form
        const profileSetupForm = document.getElementById('profile-setup-form');
        if (profileSetupForm) {
            profileSetupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.completeProfileSetup();
            });
        }

        // Back to signup button (from profile setup)
        const backToSignupBtn = document.getElementById('back-to-signup-btn');
        if (backToSignupBtn) {
            backToSignupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSignupScreen();
            });
        }

        // Back to login button (from signup)
        const backToLoginBtn = document.getElementById('back-to-login-btn');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginScreen();
            });
        }
    }

    /**
     * Setup listeners specifically for signup screen
     */
    setupSignupListeners() {
        // Back to login button (from signup)
        const backToLoginBtn = document.getElementById('back-to-login-btn');
        if (backToLoginBtn) {
            // Remove existing listener
            backToLoginBtn.replaceWith(backToLoginBtn.cloneNode(true));
            const newBackToLoginBtn = document.getElementById('back-to-login-btn');
            newBackToLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔄 Back to login clicked');
                this.showLoginScreen();
            });
        }

        // Signup form
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            // Remove existing listener
            signupForm.replaceWith(signupForm.cloneNode(true));
            const newSignupForm = document.getElementById('signup-form');
            newSignupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('📝 Signup form submitted');
                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;
                const confirmPassword = document.getElementById('signup-confirm-password').value;
                
                if (password !== confirmPassword) {
                    this.showError('Passwords do not match');
                    return;
                }
                
                await this.signUpWithEmail(email, password);
            });
        }
    }

    /**
     * Setup listeners specifically for profile setup screen
     */
    setupProfileSetupListeners() {
        // Back to signup button (from profile setup)
        const backToSignupBtn = document.getElementById('back-to-signup-btn');
        if (backToSignupBtn) {
            // Remove existing listener
            backToSignupBtn.replaceWith(backToSignupBtn.cloneNode(true));
            const newBackToSignupBtn = document.getElementById('back-to-signup-btn');
            newBackToSignupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔄 Back to signup clicked');
                this.showSignupScreen();
            });
        }

        // Profile setup form
        const profileSetupForm = document.getElementById('profile-setup-form');
        if (profileSetupForm) {
            // Remove existing listener
            profileSetupForm.replaceWith(profileSetupForm.cloneNode(true));
            const newProfileSetupForm = document.getElementById('profile-setup-form');
            newProfileSetupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('✅ Profile setup form submitted');
                await this.completeProfileSetup();
            });
        }
    }

    /**
     * Submit login form
     */
    async submitLogin() {
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        
        if (email && password) {
            await this.signInWithEmail(email, password);
        }
    }

    /**
     * Submit signup form
     */
    async submitSignup() {
        const email = document.getElementById('signup-email')?.value;
        const password = document.getElementById('signup-password')?.value;
        const confirmPassword = document.getElementById('signup-confirm-password')?.value;
        
        if (email && password && confirmPassword) {
            if (password !== confirmPassword) {
                this.showError('Passwords do not match');
                return;
            }
            await this.signUpWithEmail(email, password);
        }
    }

    /**
     * Show signup screen
     */
    showSignupScreen() {
        const loginContainer = document.getElementById('login-container');
        const signupContainer = document.getElementById('signup-container');
        
        // Clear any temp data when going back to signup
        localStorage.removeItem('tempSignupUser');
        this.isSignupInProgress = false;
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (signupContainer) signupContainer.style.display = 'block';
        
        // Reconfigure listeners for signup screen
        this.setupSignupListeners();
        
        // Make sure Feather icons are rendered
        if (window.feather) feather.replace();
        
        console.log('📝 Showing signup screen');
    }

    /**
     * Show login screen
     */
    showLoginScreen() {
        const loginContainer = document.getElementById('login-container');
        const signupContainer = document.getElementById('signup-container');
        const profileSetupScreen = document.getElementById('profile-setup-screen');
        
        if (signupContainer) signupContainer.style.display = 'none';
        if (profileSetupScreen) profileSetupScreen.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'block';
        
        // Make sure Feather icons are rendered
        if (window.feather) feather.replace();
    }

    /**
     * Show profile setup screen
     */
    showProfileSetupScreen() {
        const loginContainer = document.getElementById('login-container');
        const signupContainer = document.getElementById('signup-container');
        const profileSetupScreen = document.getElementById('profile-setup-screen');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (signupContainer) signupContainer.style.display = 'none';
        if (profileSetupScreen) profileSetupScreen.style.display = 'flex';
        
        // Reconfigure listeners for profile setup screen
        this.setupProfileSetupListeners();
        
        // Make sure Feather icons are rendered
        if (window.feather) feather.replace();
    }

    /**
     * Complete profile setup
     */
    async completeProfileSetup() {
        try {
            const username = document.getElementById('setup-username')?.value;
            const displayName = document.getElementById('setup-displayname')?.value;
            const avatar = document.getElementById('setup-avatar')?.value;

            if (!username || !displayName) {
                this.showError('Username and Display Name are required');
                return;
            }

            // Get temp user data
            const tempUserData = JSON.parse(localStorage.getItem('tempSignupUser') || '{}');
            console.log('🔍 Debug - tempUserData:', tempUserData);
            
            if (!tempUserData.uid) {
                console.error('❌ No tempSignupUser found in localStorage');
                console.log('🔍 Available localStorage keys:', Object.keys(localStorage));
                this.showError('Session expired. Please sign up again.');
                return;
            }

            // Create complete user profile
            const profileData = {
                uid: tempUserData.uid,
                email: tempUserData.email,
                displayName: displayName,
                username: username.toLowerCase(),
                photoURL: avatar || tempUserData.photoURL || null,
                signupMethod: tempUserData.signupMethod,
                createdAt: new Date().toISOString(),
                following: [],
                followers: [],
                profileCompleted: true
            };

            await this.createUserProfile(tempUserData.uid, profileData);

            // Clear temp data and reset signup flag
            localStorage.removeItem('tempSignupUser');
            this.isSignupInProgress = false;

            // Persist authentication data for auto-login
            localStorage.setItem('authUser', JSON.stringify({
                uid: profileData.uid,
                email: profileData.email,
                displayName: profileData.displayName,
                username: profileData.username,
                photoURL: profileData.photoURL,
                profileCompleted: true
            }));

            // Update current user state and redirect to main app
            this.stateManager.batchUpdate({
                'auth.user': profileData,
                'auth.isAuthenticated': true,
                'auth.profileSetupComplete': true,
                'auth.isLoading': false,
                'auth.authInitialized': true
            });

            // Hide profile setup screen first
            const profileSetupScreen = document.getElementById('profile-setup-screen');
            if (profileSetupScreen) profileSetupScreen.style.display = 'none';

            this.eventBus.emit('auth:profileSetupComplete', profileData);
            this.eventBus.emit('user:authenticated', profileData);

            console.log('✅ Profile setup completed - User automatically logged in');

        } catch (error) {
            console.error('Profile setup failed:', error);
            this.handleAuthError(error);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('Auth Error:', message);
        
        // Create error notification
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
}
