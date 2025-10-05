/**
 * SimpleAuthService - Sistema de Autenticação Simplificado
 * Baseado em exemplos do Firebase e StackOverflow
 */
import { auth, googleProvider, db, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, deleteDoc, updateProfile, setPersistence, browserLocalPersistence } from '../firebase.js';

export class SimpleAuthService {
    constructor() {
        this.currentUser = null;
        this.isLoading = false;
        this.isGoogleSignInInProgress = false;
        this.uiListenersSetup = false;
        this.postFunctionalitySetup = false;
        this.isPublishing = false;
        this.lastPublishTime = null;
        this.currentPage = null;
        this.feedUpdateTimeout = null;
        this.mainAppInitialized = false;
        this.postEventListeners = [];
        this.lastPublishedContent = null;
        
        // Setup global error handlers
        this.setupErrorHandlers();
        
        // Setup Firebase Auth persistence
        this.setupPersistence();
        
        this.setupAuthListener();
        this.setupUIListeners();
        this.setupUrlListener();
        
        console.log('🔐 SimpleAuthService initialized');
    }

    /**
     * Setup Firebase Auth persistence to maintain login across sessions
     */
    async setupPersistence() {
        try {
            await setPersistence(auth, browserLocalPersistence);
            console.log('✅ Firebase Auth persistence configured (browserLocalPersistence)');
        } catch (error) {
            console.error('❌ Error setting up Firebase Auth persistence:', error);
            // Don't throw error - app can still work without persistence
        }
    }

    /**
     * Setup global error handlers
     */
    setupErrorHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            
            // Suppress Firebase internal errors completely
            if (error && typeof error === 'object') {
                const errorMessage = error.message || '';
                const errorStack = error.stack || '';
                
                // Firebase internal assertion errors
                if (errorMessage.includes('INTERNAL ASSERTION FAILED') ||
                    errorMessage.includes('Expected a class definition') ||
                    errorMessage.includes('Pending promise was never set')) {
                    // Completely suppress - no logging
                    event.preventDefault();
                    return false;
                }
                
                // Firebase popup and redirect operation errors
                if (errorStack.includes('abstract_popup_redirect_operation') ||
                    errorStack.includes('firebase/auth') ||
                    errorStack.includes('firebaseError') ||
                    errorMessage.includes('popup_closed_by_user')) {
                    event.preventDefault();
                    return false;
                }
                
                // Network errors for Firebase
                if (errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
                    errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                    errorMessage.includes('NetworkError')) {
                    event.preventDefault();
                    return false;
                }
                
                // Class definition errors
                if (errorMessage.includes('class definition') ||
                    errorMessage.includes('promise_rejection')) {
                    event.preventDefault();
                    return false;
                }
            }
            
            // Only log non-Firebase errors
            if (error && !this.isFirebaseInternalError(error)) {
                console.error('Unhandled error:', error);
            }
        });
        
        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            const message = event.message || '';
            const filename = event.filename || '';
            const source = event.source || '';
            
            // Completely suppress Firebase-related errors
            if (message.includes('INTERNAL ASSERTION FAILED') ||
                message.includes('Expected a class definition') ||
                message.includes('Pending promise was never set') ||
                filename.includes('firebase') ||
                filename.includes('firestore') ||
                source.includes('firebase')) {
                event.preventDefault();
                return false;
            }
        });

        // Override console.error temporarily for Firebase errors
        const originalConsoleError = console.error;
        console.error = function(...args) {
            const errorString = args.join(' ');
            
            // Suppress Firebase internal errors in console
            if (errorString.includes('INTERNAL ASSERTION FAILED') ||
                errorString.includes('Expected a class definition') ||
                errorString.includes('Firebase') ||
                errorString.includes('auth/') ||
                errorString.includes('@firebase')) {
                return; // Don't log Firebase errors
            }
            
            // Log other errors normally
            originalConsoleError.apply(console, args);
        };
    }
    
    /**
     * Check if error is a Firebase internal error that should be suppressed
     */
    isFirebaseInternalError(error) {
        if (!error) return false;
        
        const message = error.message || '';
        const stack = error.stack || '';
        
        return message.includes('INTERNAL ASSERTION FAILED') ||
               message.includes('Pending promise was never set') ||
               message.includes('Firebase internal error') ||
               stack.includes('firebase') ||
               stack.includes('firestore') ||
               stack.includes('@firebase');
    }

    /**
     * Setup UI Event Listeners
     */
    setupUIListeners() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindEvents());
        } else {
            this.bindEvents();
        }
    }

    bindEvents() {
        // Prevent multiple binds
        if (this.uiListenersSetup) {
            console.log('⚠️ UI Listeners already setup, skipping...');
            return;
        }
        this.uiListenersSetup = true;
        
        console.log('🔗 Binding auth events...');
        
        // Google login button
        const googleBtn = document.getElementById('google-login-btn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                console.log('🔵 Google login clicked');
                this.signInWithGoogle();
            });
        }

        // Show signup button
        const showSignupBtn = document.getElementById('show-signup-btn');
        if (showSignupBtn) {
            showSignupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('📝 Show signup clicked');
                this.showSignup();
            });
        }

        // Show login button
        const showLoginBtn = document.getElementById('show-login-btn');
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔑 Show login clicked');
                this.showLogin();
            });
        }

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const emailOrUsername = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                console.log('🔑 Login form submitted:', emailOrUsername);
                this.signInWithEmailOrUsername(emailOrUsername, password);
            });
        }

        // Signup form
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;
                const confirmPassword = document.getElementById('signup-confirm-password').value;
                
                if (password !== confirmPassword) {
                    this.showError('Passwords do not match');
                    return;
                }
                
                console.log('📝 Signup form submitted:', email);
                this.signUpWithEmail(email, password);
            });
        }

        // Profile setup form
        const profileForm = document.getElementById('profile-setup-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('setup-username').value;
                const displayName = document.getElementById('setup-displayname').value;
                const photoURL = document.getElementById('setup-avatar').value;
                
                if (!username || !displayName) {
                    this.showError('Username and display name are required');
                    return;
                }
                
                console.log('👤 Profile setup submitted:', username);
                this.completeProfile(auth.currentUser, {
                    username,
                    displayName,
                    photoURL
                });
            });
        }

        // Back buttons
        const backToLoginBtn = document.getElementById('back-to-login-btn');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('⬅️ Back to login clicked');
                this.showLogin();
            });
        }

        const backToSignupBtn = document.getElementById('back-to-signup-btn');
        if (backToSignupBtn) {
            backToSignupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('⬅️ Back to signup clicked');
                this.showSignup();
            });
        }

        // Logout button (will be added when mainApp is shown)
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logout-btn' || e.target.closest('#logout-btn')) {
                e.preventDefault();
                console.log('👋 Logout clicked');
                this.logout();
            }
            
            // Mobile menu toggle
            if (e.target.id === 'mobile-menu-btn' || e.target.closest('#mobile-menu-btn')) {
                e.preventDefault();
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu) {
                    mobileMenu.classList.toggle('hidden');
                }
            }
            
            // User dropdown toggle
            if (e.target.id === 'user-avatar' || e.target.closest('#user-avatar')) {
                e.preventDefault();
                const dropdown = document.getElementById('user-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('hidden');
                }
            }

            // Notifications system removed for simplification
            
            if (!e.target.closest('#user-avatar') && !e.target.closest('#user-dropdown')) {
                const userDropdown = document.getElementById('user-dropdown');
                if (userDropdown && !userDropdown.classList.contains('hidden')) {
                    userDropdown.classList.add('hidden');
                }
            }

            // Delete post button
            if (e.target.closest('[data-action="delete"]')) {
                e.preventDefault();
                const deleteBtn = e.target.closest('[data-action="delete"]');
                const postElement = deleteBtn.closest('.post-item');
                const postId = postElement.getAttribute('data-post-id');
                
                if (postId && postElement) {
                    this.deletePost(postId, postElement);
                }
            }

            // Edit Profile button
            if (e.target.closest('[data-action="edit-profile"]')) {
                e.preventDefault();
                this.showEditProfileModal();
            }

            // Settings button
            if (e.target.closest('[data-action="settings"]')) {
                e.preventDefault();
                this.showSettingsModal();
            }

            // Like button
            if (e.target.closest('[data-action="like"]')) {
                e.preventDefault();
                const likeBtn = e.target.closest('[data-action="like"]');
                const postElement = likeBtn.closest('.post-item');
                const postId = postElement.getAttribute('data-post-id');
                
                if (postId) {
                    this.toggleLike(postId, likeBtn);
                }
            }

            // Comment button
            if (e.target.closest('[data-action="comment"]')) {
                e.preventDefault();
                const commentBtn = e.target.closest('[data-action="comment"]');
                const postElement = commentBtn.closest('.post-item');
                const postId = postElement.getAttribute('data-post-id');
                
                if (postId) {
                    this.showCommentModal(postId);
                }
            }
        });

        // Initial screen setup
        setTimeout(() => {
            if (!auth.currentUser) {
                this.showLogin();
            }
        }, 1000);
    }

    /**
     * Setup URL listener for routing
     */
    setupUrlListener() {
        // Listen for browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.handleUrlChange();
        });

        // Listen for initial page load
        window.addEventListener('DOMContentLoaded', () => {
            this.handleUrlChange();
        });
    }

    /**
     * Handle URL changes for routing
     */
    handleUrlChange() {
        if (!this.currentUser) return; // Only handle routing if user is logged in

        const hash = window.location.hash.replace('#', '');
        const parts = hash.split('/');
        const pageName = parts[0] || 'feed';
        const param = parts[1];

        console.log('🔗 URL changed:', pageName, param);

        if (pageName === 'profile' && param) {
            this.showUserProfile(param);
        } else if (['feed', 'championships', 'races', 'drivers'].includes(pageName)) {
            this.showPage(pageName, false); // Don't update URL again
        } else {
            // Default to feed for unknown pages
            this.showPage('feed', false);
        }
    }

    /**
     * Setup Firebase Auth State Listener
     * With browserLocalPersistence, this will automatically restore user sessions
     * across browser sessions and page reloads.
     * Baseado em: https://firebase.google.com/docs/auth/web/start
     */
    setupAuthListener() {
        try {
            onAuthStateChanged(auth, async (user) => {
                console.log('🔄 Auth state changed:', user ? 'User logged in' : 'User logged out');
                
                try {
                    if (user) {
                        // User is signed in
                        await this.handleUserSignedIn(user);
                    } else {
                        // User is signed out
                        this.handleUserSignedOut();
                    }
                } catch (error) {
                    console.error('❌ Error in auth state handler:', error);
                    // Don't throw error, just log and continue
                    if (user) {
                        // Still try to show main app even if there's an error
                        this.currentUser = user;
                        this.showMainApp();
                    } else {
                        this.showLogin();
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error setting up auth listener:', error);
            // Fallback to showing login
            setTimeout(() => this.showLogin(), 1000);
        }
    }

    /**
     * Handle user signed in
     */
    async handleUserSignedIn(user) {
        try {
            console.log('✅ User signed in:', user.email);
            
            // Check if user profile exists
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
                // User profile exists - login complete
                const userData = userDoc.data();
                this.currentUser = userData;
                this.setupRealTimeListeners();
                this.showMainApp();
                this.setLoading(false); // Clear loading state
                console.log('🏠 Redirecting to main app');
            } else {
                // New user - needs profile setup
                console.log('👤 New user detected - showing profile setup');
                this.showProfileSetup(user);
                this.setLoading(false); // Clear loading state
            }
            
        } catch (error) {
            console.error('❌ Error handling signed in user:', error);
            this.showError('Error loading user profile');
            this.setLoading(false); // Clear loading state on error
        }
    }

    /**
     * Handle user signed out
     */
    handleUserSignedOut() {
        console.log('👋 User signed out');
        this.currentUser = null;
        this.showLogin();
    }

    /**
     * Setup real-time listeners for social updates
     */
    async setupRealTimeListeners() {
        try {
            if (!this.currentUser) return;
            
            // Clean up existing listeners first
            this.cleanupRealTimeListeners();
            
            const { onSnapshot, doc, collection, query, where, orderBy } = await import('../firebase.js');
            
            // Listen for changes to current user's profile
            this.userProfileUnsubscribe = onSnapshot(doc(db, 'users', this.currentUser.uid), (doc) => {
                if (doc.exists()) {
                    const updatedUser = doc.data();
                    console.log('🔄 User profile updated in real-time:', updatedUser.displayName);
                    
                    // Update current user data
                    this.currentUser = updatedUser;
                    
                    // Update UI elements
                    this.updateUserInterface();
                    
                    // Update suggested users if display name changed
                    this.loadSuggestedUsers();
                }
            });
            
            // Listen for new posts from followed users
            if (this.currentUser.following && this.currentUser.following.length > 0) {
                const followingList = [...this.currentUser.following, this.currentUser.uid];
                
                // Due to Firebase 'in' query limit of 10, we'll listen to the first 10 followed users
                const userIds = followingList.slice(0, 10);
                
                const postsQuery = query(
                    collection(db, 'posts'),
                    where('author.uid', 'in', userIds),
                    orderBy('createdAt', 'desc')
                );
                
                this.postsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
                    let hasChanges = false;
                    
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            console.log('🔄 New post detected in real-time');
                            hasChanges = true;
                        } else if (change.type === 'modified') {
                            console.log('🔄 Post updated in real-time');
                            hasChanges = true;
                        } else if (change.type === 'removed') {
                            console.log('🔄 Post deleted in real-time');
                            hasChanges = true;
                        }
                    });
                    
                    // Debounce feed updates to avoid excessive calls
                    if (hasChanges) {
                        clearTimeout(this.feedUpdateTimeout);
                        this.feedUpdateTimeout = setTimeout(() => {
                            console.log('🔄 Refreshing feed due to real-time changes');
                            this.refreshFeedUI();
                        }, 1000); // 1 second debounce
                    }
                });
            }
            
            console.log('✅ Real-time listeners setup complete');
            
        } catch (error) {
            console.error('❌ Error setting up real-time listeners:', error);
        }
    }
    
    /**
     * Refresh the feed UI and related components
     */
    async refreshFeedUI() {
        try {
            // Only refresh if we're on the feed page
            if (this.currentPage === 'feed') {
                console.log('🔄 Refreshing feed UI components');
                
                // Reload the feed with subtle loading
                await this.loadFeedFromFirebase(false);
                
                // Update suggested users
                await this.loadSuggestedUsers();
                
                // Update any other UI components that might need refreshing
                this.updateUserInterface();
                
                // Refresh feather icons
                if (window.feather) {
                    feather.replace();
                }
            }
        } catch (error) {
            console.error('❌ Error refreshing feed UI:', error);
        }
    }

    /**
     * Cleanup real-time listeners
     */
    cleanupRealTimeListeners() {
        if (this.userProfileUnsubscribe) {
            this.userProfileUnsubscribe();
            this.userProfileUnsubscribe = null;
        }
        if (this.postsUnsubscribe) {
            this.postsUnsubscribe();
            this.postsUnsubscribe = null;
        }
        if (this.viewedUserUnsubscribe) {
            this.viewedUserUnsubscribe();
            this.viewedUserUnsubscribe = null;
        }
        if (this.feedUpdateTimeout) {
            clearTimeout(this.feedUpdateTimeout);
            this.feedUpdateTimeout = null;
        }
        console.log('🧹 Real-time listeners cleaned up');
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            console.log('👋 Signing out user...');
            this.cleanupRealTimeListeners();
            await signOut(auth);
            console.log('✅ User signed out successfully');
            // The onAuthStateChanged listener will handle showing login screen
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.showToast('Error signing out. Please try again.', 'error');
        }
    }

    /**
     * Google Sign In
     * Baseado em: https://firebase.google.com/docs/auth/web/google-signin
     */
    async signInWithGoogle() {
        try {
            this.setLoading(true);
            console.log('🔄 Starting Google sign in...');
            
            // Ensure persistence is configured before sign in
            await this.setupPersistence();
            
            // Prevent multiple simultaneous attempts
            if (this.isGoogleSignInInProgress) {
                console.log('Google sign in already in progress...');
                return;
            }
            this.isGoogleSignInInProgress = true;
            
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            console.log('✅ Google sign in successful:', user.email);
            
            // Extract photo from Google profile and update user profile
            if (user.photoURL) {
                console.log('📸 Setting profile photo from Google:', user.photoURL);
                try {
                    await updateProfile(user, {
                        photoURL: user.photoURL
                    });
                } catch (photoError) {
                    console.warn('⚠️ Could not update photo URL:', photoError);
                }
            }
            
            // The onAuthStateChanged listener will handle the rest
            
        } catch (error) {
            console.error('❌ Google sign in error:', error);
            
            // Handle specific popup errors
            if (error.code === 'auth/popup-blocked') {
                this.showToast('Popup foi bloqueado. Por favor, permita popups para este site.', 'error');
            } else if (error.code === 'auth/popup-closed-by-user') {
                console.log('User closed popup - this is normal, not an error');
                // Don't show error for user-initiated popup closure
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log('Popup request cancelled - this is normal');
                // Don't show error for cancelled requests
            } else {
                this.handleAuthError(error);
            }
        } finally {
            this.setLoading(false);
            this.isGoogleSignInInProgress = false;
        }
    }

    /**
     * Email Sign Up
     */
    async signUpWithEmail(email, password) {
        try {
            this.setLoading(true);
            console.log('🔄 Creating account with email:', email);
            
            // Ensure persistence is configured before sign up
            await this.setupPersistence();
            
            const result = await createUserWithEmailAndPassword(auth, email, password);
            console.log('✅ Email account created:', result.user.email);
            
            // The onAuthStateChanged listener will handle the rest
            
        } catch (error) {
            console.error('❌ Email sign up error:', error);
            this.handleAuthError(error);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Sign In with Email or Username
     */
    async signInWithEmailOrUsername(emailOrUsername, password) {
        try {
            this.setLoading(true);
            console.log('🔄 Signing in with:', emailOrUsername);
            
            // Ensure persistence is configured before sign in
            await this.setupPersistence();
            
            // Detectar se é email ou username
            const isEmail = this.isValidEmail(emailOrUsername);
            
            if (isEmail) {
                // Login direto com email
                const result = await signInWithEmailAndPassword(auth, emailOrUsername, password);
                console.log('✅ Email sign in successful:', result.user.email);
            } else {
                // Buscar o email pelo username no Firestore
                const email = await this.getEmailByUsername(emailOrUsername);
                if (!email) {
                    throw new Error('Username não encontrado');
                }
                
                const result = await signInWithEmailAndPassword(auth, email, password);
                console.log('✅ Username sign in successful:', result.user.email);
            }
            
            // The onAuthStateChanged listener will handle the rest
            
        } catch (error) {
            console.error('❌ Sign in error:', error);
            this.handleAuthError(error);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Verificar se é um email válido
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Buscar email pelo username no Firestore
     */
    async getEmailByUsername(username) {
        try {
            const { collection, query, where, getDocs } = await import('../firebase.js');
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', username));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                return null;
            }
            
            const userData = querySnapshot.docs[0].data();
            return userData.email;
        } catch (error) {
            console.error('❌ Error fetching user by username:', error);
            return null;
        }
    }

    /**
     * Setup post functionality (like Twitter)
     */
    setupPostFunctionality() {
        // FORÇA limpeza completa - removendo qualquer listener anterior
        console.log('🧹 FORCE cleaning ALL post-related event listeners');
        
        // Clone document to remove ALL event listeners (nuclear option)
        const oldDocument = document;
        
        // Remove specific listeners if we have references
        if (this.postEventListeners) {
            this.postEventListeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
        }
        
        // Reset all flags and trackers
        this.postFunctionalitySetup = false;
        this.postEventListeners = [];
        this.currentPublisherId = null;
        
        // Prevent multiple setups with a more aggressive check
        if (window.postSetupComplete) {
            console.log('⚠️ Post functionality already setup globally, skipping...');
            return;
        }
        window.postSetupComplete = true;
        
        console.log('📝 Setting up post functionality with SINGLE global listener...');
        
        // Store reference to this instance for the global handler
        const authServiceInstance = this;
        
        // Use a SINGLE global event handler that checks if it should process
        window.globalPostHandler = function(e) {
            if (e.target && e.target.id === 'publish-post-btn') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Stop other listeners
                
                console.log('🖱️ Global publish handler triggered');
                
                const postContent = document.getElementById('new-post-content');
                if (postContent && postContent.value.trim()) {
                    const content = postContent.value.trim();
                    
                    // Prevent rapid successive calls
                    const now = Date.now();
                    if (authServiceInstance.lastPublishTime && (now - authServiceInstance.lastPublishTime) < 3000) {
                        console.log('⚠️ Too soon after previous publish, ignoring...');
                        return;
                    }
                    
                    // Prevent same content
                    if (authServiceInstance.lastPublishedContent === content) {
                        console.log('⚠️ Duplicate content detected, ignoring...');
                        return;
                    }
                    
                    authServiceInstance.lastPublishTime = now;
                    console.log('📤 Publishing via global handler:', content.substring(0, 50) + '...');
                    authServiceInstance.publishPost(content);
                }
            }
        };
        
        // Remove any existing global handlers
        if (window.globalPostHandler) {
            document.removeEventListener('click', window.globalPostHandler);
            document.removeEventListener('input', window.globalInputHandler);
        }
        
        // Input handler for enabling/disabling publish button
        window.globalInputHandler = (e) => {
            if (e.target && e.target.id === 'new-post-content') {
                const postContent = e.target;
                const publishBtn = document.getElementById('publish-post-btn');
                
                if (publishBtn) {
                    const hasContent = postContent.value.trim().length > 0;
                    publishBtn.disabled = !hasContent;
                    publishBtn.classList.toggle('opacity-50', !hasContent);
                    publishBtn.classList.toggle('cursor-not-allowed', !hasContent);
                }
            }
        };
        
        // Add ONLY the global handlers (no duplicates possible)
        document.addEventListener('click', window.globalPostHandler, { capture: true });
        document.addEventListener('input', window.globalInputHandler);
        
        console.log('✅ Single global post handler setup complete');
    }

    /**
     * Check network connectivity
     */
    async checkConnectivity() {
        if (!navigator.onLine) {
            this.showToast('No internet connection. Please check your network.', 'error');
            return false;
        }
        return true;
    }

    /**
     * Publish a new post
     */
    async publishPost(content) {
        console.log('📤 publishPost called with content:', content.substring(0, 50) + '...');
        console.log('📤 isPublishing flag:', this.isPublishing);
        console.log('📤 lastPublishedContent:', this.lastPublishedContent);
        
        // Prevent duplicate posts with same content
        if (this.lastPublishedContent === content.trim()) {
            console.log('⚠️ Duplicate content detected, ignoring...');
            return;
        }
        
        if (!content.trim() || !this.currentUser) return;
        
        // Check connectivity first
        if (!await this.checkConnectivity()) {
            return;
        }
        
        // Prevent multiple simultaneous publishes
        if (this.isPublishing) {
            console.log('⚠️ Post already being published, skipping...');
            return;
        }
        this.isPublishing = true;
        
        try {
            const postData = {
                content: content.trim(),
                author: {
                    uid: this.currentUser.uid,
                    displayName: this.currentUser.displayName || this.currentUser.username,
                    email: this.currentUser.email
                },
                timestamp: new Date().toISOString(),
                likes: 0,
                comments: 0,
                shares: 0
            };

            // Add location if available
            if (this.currentPostLocation) {
                postData.location = this.currentPostLocation;
            }
            
            // Save to Firebase and get the document ID
            const postId = await this.savePostToFirebase(postData);
            postData.id = postId;
            
            console.log('📝 Publishing post:', postData);
            
            // Only add to UI if we are on the feed page and not already loading feed
            const currentPage = window.location.hash.split('/')[0].replace('#', '') || 'feed';
            if (currentPage === 'feed' && !this.isLoadingFeed) {
                this.addPostToFeed(postData, true);
            }
            
            // Clear the input and location
            const postContent = document.getElementById('new-post-content');
            if (postContent) {
                postContent.value = '';
                postContent.dispatchEvent(new Event('input')); // Trigger the input event to disable button
            }
            
            // Clear location after posting (silently)
            this.removeLocation('silent');
            
            this.showToast('Post published successfully!', 'success');
            
            // Store the published content to prevent immediate duplicates
            this.lastPublishedContent = content.trim();
            
            // Clear the stored content after 5 seconds to allow re-posting same content later
            setTimeout(() => {
                this.lastPublishedContent = null;
            }, 5000);
            
        } catch (error) {
            console.error('❌ Error publishing post:', error);
            this.showToast('Failed to publish post', 'error');
        } finally {
            this.isPublishing = false;
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm ${
            type === 'success' ? 'bg-green-500' :
            type === 'error' ? 'bg-red-500' :
            type === 'warning' ? 'bg-yellow-500' :
            'bg-blue-500'
        } text-white`;
        
        toast.innerHTML = `
            <div class="flex items-center space-x-2">
                <i data-feather="${
                    type === 'success' ? 'check-circle' :
                    type === 'error' ? 'x-circle' :
                    type === 'warning' ? 'alert-triangle' :
                    'info'
                }" class="w-5 h-5"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Replace feather icons
        if (window.feather) feather.replace();
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }    /**
     * Add post to feed UI
     */
    addPostToFeed(postData, prepend = true) {
        const postsContainer = document.getElementById('posts-container');
        if (!postsContainer) {
            console.warn('⚠️ Posts container not found');
            return;
        }
        
        // Initialize loadedPostIds if not exists
        if (!this.loadedPostIds) {
            this.loadedPostIds = new Set();
            console.log('📋 Initialized loadedPostIds Set');
        }
        
        console.log('📝 Adding post to feed:', {
            id: postData.id,
            content: postData.content?.substring(0, 50) + '...',
            prepend: prepend,
            currentLoadedPosts: this.loadedPostIds.size
        });
        
        // Check for duplicate
        if (postData.id && this.loadedPostIds.has(postData.id)) {
            console.warn(`⚠️ Post ${postData.id} already exists in feed, skipping...`);
            return;
        }
        
        // Additional check: see if element already exists in DOM
        if (postData.id && postsContainer.querySelector(`[data-post-id="${postData.id}"]`)) {
            console.warn(`⚠️ Post ${postData.id} already exists in DOM, skipping...`);
            return;
        }
        
        // Remove welcome message if it exists
        const welcomeMsg = postsContainer.querySelector('.text-center');
        if (welcomeMsg) welcomeMsg.remove();
        
        const postElement = this.createPostElement(postData);
        
        // Track this post
        if (postData.id) {
            this.loadedPostIds.add(postData.id);
        }
        
        // Insert based on prepend parameter
        if (prepend) {
            postsContainer.insertBefore(postElement, postsContainer.firstChild);
        } else {
            postsContainer.appendChild(postElement);
        }
        
        // Refresh feather icons
        if (window.feather) feather.replace();
    }

    /**
     * Get time ago string
     */
    getTimeAgo(dateString) {
        if (!dateString) return 'now';
        
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'now';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        
        return date.toLocaleDateString();
    }

    /**
     * Setup search functionality
     */
    setupSearchFunctionality() {
        const searchBtn = document.getElementById('search-btn');
        const searchModal = document.getElementById('search-modal');
        const closeSearch = document.getElementById('close-search');
        const searchInput = document.getElementById('search-input');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                searchModal.classList.remove('hidden');
                searchInput.focus();
            });
        }
        
        if (closeSearch) {
            closeSearch.addEventListener('click', () => {
                searchModal.classList.add('hidden');
                searchInput.value = '';
                this.clearSearchResults();
            });
        }
        
        // Close modal when clicking outside
        if (searchModal) {
            searchModal.addEventListener('click', (e) => {
                if (e.target === searchModal) {
                    searchModal.classList.add('hidden');
                    searchInput.value = '';
                    this.clearSearchResults();
                }
            });
        }
        
        // Search input handling
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length === 0) {
                    this.clearSearchResults();
                    return;
                }
                
                searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 300); // Debounce search
            });
        }
    }

    /**
     * Perform search
     */
    async performSearch(query) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        
        // Show loading
        resultsContainer.innerHTML = `
            <div class="p-6 text-center">
                <div class="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p class="text-gray-400">Searching...</p>
            </div>
        `;
        
        try {
            // Search users (you can expand this to search posts too)
            const users = await this.searchUsers(query);
            
            if (users.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="p-6 text-center text-gray-400">
                        <i data-feather="search" class="w-12 h-12 mx-auto mb-4 opacity-50"></i>
                        <p>No users found for "${query}"</p>
                    </div>
                `;
                if (window.feather) feather.replace();
                return;
            }
            
            const searchResultsHtml = users.map(user => {
                const initials = this.getUserInitials(user.displayName || user.email);
                const username = user.username || user.email.split('@')[0];
                const isFollowing = this.isFollowing(user.uid);
                
                return `
                    <div class="p-4 hover:bg-gray-700 border-b border-gray-700 last:border-b-0 h-20 min-h-[80px]">
                        <div class="flex items-center space-x-3 h-full">
                            <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer flex-shrink-0" onclick="window.authService.showUserProfile('${user.uid}')">
                                ${initials}
                            </div>
                            <div class="flex-1 min-w-0 cursor-pointer overflow-hidden" onclick="window.authService.showUserProfile('${user.uid}')">
                                <p class="text-white font-medium truncate max-w-[200px]" title="${user.displayName || username}">${user.displayName || username}</p>
                                <p class="text-gray-400 text-sm truncate max-w-[200px]" title="@${username}">@${username}</p>
                            </div>
                            ${user.uid !== this.currentUser.uid ? `
                                <button 
                                    class="text-xs px-3 py-1 rounded-full transition-colors flex-shrink-0 w-20 text-center ${isFollowing ? 'bg-gray-600 hover:bg-red-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}"
                                    onclick="event.stopPropagation(); window.authService.toggleFollow('${user.uid}')"
                                >
                                    ${isFollowing ? 'Unfollow' : 'Follow'}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            resultsContainer.innerHTML = searchResultsHtml;
            if (window.feather) feather.replace();
            
        } catch (error) {
            console.error('❌ Search error:', error);
            resultsContainer.innerHTML = `
                <div class="p-6 text-center text-red-400">
                    <i data-feather="alert-circle" class="w-12 h-12 mx-auto mb-4"></i>
                    <p>Error searching users</p>
                </div>
            `;
            if (window.feather) feather.replace();
        }
    }

    /**
     * Search users in Firebase
     */
    async searchUsers(query) {
        try {
            if (!query || query.trim().length < 2) {
                return []; // Require at least 2 characters
            }
            
            const { collection, getDocs, orderBy, startAt, endAt, query: firestoreQuery } = await import('../firebase.js');
            const usersRef = collection(db, 'users');
            
            const queryLower = query.toLowerCase().trim();
            const matchingUsers = [];
            
            // Search by exact matches and starting with the query
            try {
                // Get all users and filter client-side for better search control
                const usersSnapshot = await getDocs(usersRef);
                
                usersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    const displayName = (userData.displayName || '').toLowerCase();
                    const username = (userData.username || '').toLowerCase();
                    
                    // Prioritize exact matches and "starts with" matches
                    const displayNameMatch = displayName === queryLower || displayName.startsWith(queryLower);
                    const usernameMatch = username === queryLower || username.startsWith(queryLower);
                    
                    // Only include if it's an exact match or starts with the query
                    if (displayNameMatch || usernameMatch) {
                        // Don't include the current user in search results
                        if (this.currentUser && userData.uid !== this.currentUser.uid) {
                            matchingUsers.push({ uid: doc.id, ...userData });
                        }
                    }
                });
                
                // Sort by relevance (exact matches first, then starts with)
                matchingUsers.sort((a, b) => {
                    const aDisplayName = (a.displayName || '').toLowerCase();
                    const aUsername = (a.username || '').toLowerCase();
                    const bDisplayName = (b.displayName || '').toLowerCase();
                    const bUsername = (b.username || '').toLowerCase();
                    
                    // Exact matches get highest priority
                    const aExact = aDisplayName === queryLower || aUsername === queryLower;
                    const bExact = bDisplayName === queryLower || bUsername === queryLower;
                    
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    
                    // Then sort alphabetically
                    return aDisplayName.localeCompare(bDisplayName);
                });
                
            } catch (firestoreError) {
                console.error('Firestore query error:', firestoreError);
            }
            
            return matchingUsers.slice(0, 8); // Limit to 8 results for better UX
        } catch (error) {
            console.error('❌ Error searching users:', error);
            return [];
        }
    }

    /**
     * Clear search results
     */
    clearSearchResults() {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="p-6 text-center text-gray-400">
                    <i data-feather="search" class="w-12 h-12 mx-auto mb-4 opacity-50"></i>
                    <p>Start typing to search...</p>
                </div>
            `;
            if (window.feather) feather.replace();
        }
    }

    /**
     * Load suggested users (real users from Firebase)
     */
    async loadSuggestedUsers() {
        try {
            const { db, collection, getDocs, query, where, limit } = await import('../firebase.js');
            const usersRef = collection(db, 'users');
            
            // Get some recent users (you can improve this with better algorithm)
            const usersSnapshot = await getDocs(query(usersRef, limit(5)));
            const users = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                // Only suggest users that are not already followed and not the current user
                if (userData.uid !== this.currentUser.uid && !this.isFollowing(userData.uid)) {
                    users.push({ uid: doc.id, ...userData });
                }
            });
            
            const container = document.getElementById('suggested-users-container');
            if (container && users.length > 0) {
                const usersHtml = users.map(user => {
                    const initials = this.getUserInitials(user.displayName || user.email);
                    const username = user.username || user.email.split('@')[0];
                    
                    const isFollowing = this.isFollowing(user.uid);
                    
                    return `
                        <div class="flex items-center justify-between h-12 min-h-[48px]">
                            <div class="flex items-center space-x-3 cursor-pointer flex-1 min-w-0 overflow-hidden" onclick="window.authService.showUserProfile('${user.uid}')">
                                <div class="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    ${initials}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-white font-medium truncate max-w-[120px]" title="${user.displayName || username}">${user.displayName || username}</p>
                                    <p class="text-gray-400 text-sm truncate max-w-[120px]" title="@${username}">@${username}</p>
                                </div>
                            </div>
                            <button 
                                class="text-xs px-3 py-1 rounded-full transition-colors flex-shrink-0 w-20 text-center ${isFollowing ? 'bg-gray-600 hover:bg-red-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}"
                                onclick="window.authService.toggleFollow('${user.uid}')"
                            >
                                ${isFollowing ? 'Unfollow' : 'Follow'}
                            </button>
                        </div>
                    `;
                }).join('');
                
                container.innerHTML = usersHtml;
            } else if (container) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <p class="text-gray-400 text-sm">No users to suggest yet</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ Error loading suggested users:', error);
        }
    }

    /**
     * Update profile page with user data
     */
    updateProfilePage() {
        if (!this.currentUser) return;
        this.updateProfilePageWithUserData(this.currentUser, this.currentUser.uid, true);
    }

    /**
     * Setup profile tabs functionality
     */
    setupProfileTabs(userId = null) {
        // Store current profile userId for tab navigation
        this.currentProfileUserId = userId || this.currentUser?.uid;
        const tabs = document.querySelectorAll('.profile-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => {
                    t.classList.remove('active', 'bg-orange-500', 'text-white');
                    t.classList.add('text-gray-400', 'hover:text-white', 'hover:bg-gray-700');
                });
                
                // Add active class to clicked tab
                tab.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-gray-700');
                tab.classList.add('active', 'bg-orange-500', 'text-white');
                
                // Update content based on tab
                const tabType = tab.getAttribute('data-tab');
                this.updateProfileContent(tabType, this.currentProfileUserId);
            });
        });
        
        // Set initial active tab
        const firstTab = document.querySelector('.profile-tab[data-tab="posts"]');
        if (firstTab) {
            firstTab.classList.add('bg-orange-500', 'text-white');
            firstTab.classList.remove('text-gray-400');
        }
    }

    /**
     * Update profile page with specific user data
     */
    updateProfilePageWithUserData(userData, userId, isOwnProfile = false) {
        console.log('👤 updateProfilePageWithUserData called:', {
            userData,
            userId,
            isOwnProfile,
            currentUser: this.currentUser
        });
        
        // Update profile avatar
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            const initials = this.getUserInitials(userData.displayName || userData.email);
            profileAvatar.textContent = initials;
            console.log('✅ Updated profile avatar:', initials);
        } else {
            console.log('❌ profile-avatar element not found');
        }
        
        // Update profile name
        const profileName = document.getElementById('profile-name');
        if (profileName) {
            profileName.textContent = userData.displayName || userData.username || 'User';
        }
        
        // Update profile username
        const profileUsername = document.getElementById('profile-username');
        if (profileUsername) {
            const username = userData.username || userData.email?.split('@')[0] || 'user';
            profileUsername.textContent = `@${username}`;
        }
        
        // Update profile bio if exists
        const profileBio = document.getElementById('profile-bio');
        if (profileBio && userData.bio) {
            profileBio.textContent = userData.bio;
            profileBio.style.display = 'block';
        } else if (profileBio) {
            profileBio.style.display = 'none';
        }
        
        // Update location if exists
        const profileLocation = document.getElementById('profile-location');
        if (profileLocation && userData.location) {
            profileLocation.textContent = userData.location;
            profileLocation.parentElement.style.display = 'flex';
        } else if (profileLocation) {
            profileLocation.parentElement.style.display = 'none';
        }
        
        // Update website if exists
        const profileWebsite = document.getElementById('profile-website');
        if (profileWebsite && userData.website) {
            profileWebsite.textContent = userData.website;
            profileWebsite.href = userData.website.startsWith('http') ? userData.website : `https://${userData.website}`;
            profileWebsite.parentElement.style.display = 'flex';
        } else if (profileWebsite) {
            profileWebsite.parentElement.style.display = 'none';
        }
        
        // Update joined date
        const profileJoined = document.getElementById('profile-joined');
        if (profileJoined && userData.createdAt) {
            const joinedDate = new Date(userData.createdAt);
            const options = { year: 'numeric', month: 'long' };
            profileJoined.textContent = `Joined ${joinedDate.toLocaleDateString('en-US', options)}`;
        } else if (profileJoined) {
            // Default joined date if not available
            profileJoined.textContent = 'Racing since 2024';
        }
        
        // Update follower counts if available
        const followersCount = document.getElementById('followers-count');
        const followingCount = document.getElementById('following-count');
        const postsCount = document.getElementById('posts-count');
        
        if (followersCount) {
            followersCount.textContent = userData.followersCount || 0;
        }
        
        if (followingCount) {
            followingCount.textContent = userData.followingCount || 0;
        }
        
        if (postsCount) {
            postsCount.textContent = userData.postsCount || 0;
        }
        
        // Update action buttons based on profile ownership
        this.updateProfileActionButtons(userId, isOwnProfile);
        
        // Setup profile tabs with userId
        this.setupProfileTabs(userId);
        
        // Load user posts for the posts tab
        const contentContainer = document.getElementById('profile-content');
        if (contentContainer) {
            this.loadUserPosts(userId, contentContainer);
        }
    }

    /**
     * Update profile action buttons
     */
    updateProfileActionButtons(userId, isOwnProfile) {
        console.log('🔘 updateProfileActionButtons called:', { userId, isOwnProfile });
        
        const actionsContainer = document.getElementById('profile-actions');
        if (!actionsContainer) {
            console.log('❌ profile-actions container not found');
            return;
        }
        
        console.log('✅ profile-actions container found');
        
        if (isOwnProfile) {
            console.log('🔘 Setting up own profile buttons');
            // Own profile - show edit button
            actionsContainer.innerHTML = `
                <button class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full transition-colors font-medium" data-action="edit-profile">
                    <i data-feather="edit-2" class="w-4 h-4 mr-2"></i>
                    Edit Profile
                </button>
                <button class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors font-medium border border-gray-600" data-action="settings">
                    <i data-feather="settings" class="w-4 h-4 mr-2"></i>
                    Settings
                </button>
            `;
            console.log('✅ Own profile buttons set');
        } else {
            console.log('🔘 Setting up other user profile buttons');
            // Other user's profile - show follow/unfollow button
            const isFollowing = this.isFollowing(userId);
            actionsContainer.innerHTML = `
                <button 
                    class="px-6 py-2 rounded-full transition-colors font-medium ${isFollowing ? 'bg-gray-600 hover:bg-red-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}"
                    onclick="window.authService.toggleFollow('${userId}')"
                >
                    <i data-feather="${isFollowing ? 'user-minus' : 'user-plus'}" class="w-4 h-4 mr-2"></i>
                    ${isFollowing ? 'Unfollow' : 'Follow'}
                </button>
                <button class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full transition-colors font-medium">
                    <i data-feather="message-circle" class="w-4 h-4 mr-2"></i>
                    Message
                </button>
            `;
            console.log('✅ Other user profile buttons set');
        }
        
        // Refresh feather icons
        if (window.feather) feather.replace();
        console.log('✅ Profile action buttons updated successfully');
    }

    /**
     * Follow a user
     */
    async followUser(userId) {
        if (!this.currentUser || userId === this.currentUser.uid) return;
        
        try {
            const { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } = await import('../firebase.js');
            
            // Add to current user's following list
            const currentUserRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(currentUserRef, {
                following: arrayUnion(userId),
                followingCount: (this.currentUser.followingCount || 0) + 1
            });
            
            // Add to target user's followers list
            const targetUserRef = doc(db, 'users', userId);
            const targetUserDoc = await getDoc(targetUserRef);
            const targetUserData = targetUserDoc.data();
            
            await updateDoc(targetUserRef, {
                followers: arrayUnion(this.currentUser.uid),
                followersCount: (targetUserData.followersCount || 0) + 1
            });
            
            // Update current user data
            this.currentUser.following = this.currentUser.following || [];
            this.currentUser.following.push(userId);
            this.currentUser.followingCount = (this.currentUser.followingCount || 0) + 1;
            
            console.log(`✅ Started following user ${userId}`);
            this.showToast('You are now following this user', 'success');
            
            return true;
        } catch (error) {
            console.error('❌ Error following user:', error);
            this.showToast('Failed to follow user', 'error');
            return false;
        }
    }

    /**
     * Unfollow a user
     */
    async unfollowUser(userId) {
        if (!this.currentUser || userId === this.currentUser.uid) return;
        
        try {
            const { doc, updateDoc, arrayRemove } = await import('../firebase.js');
            
            // Remove from current user's following list
            const currentUserRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(currentUserRef, {
                following: arrayRemove(userId),
                followingCount: Math.max(0, (this.currentUser.followingCount || 1) - 1)
            });
            
            // Remove from target user's followers list
            const targetUserRef = doc(db, 'users', userId);
            await updateDoc(targetUserRef, {
                followers: arrayRemove(this.currentUser.uid),
                followersCount: Math.max(0, (this.currentUser.followersCount || 1) - 1)
            });
            
            // Update current user data
            if (this.currentUser.following) {
                const index = this.currentUser.following.indexOf(userId);
                if (index > -1) {
                    this.currentUser.following.splice(index, 1);
                    this.currentUser.followingCount = Math.max(0, (this.currentUser.followingCount || 1) - 1);
                }
            }
            
            console.log(`✅ Unfollowed user ${userId}`);
            this.showToast('You unfollowed this user', 'info');
            
            return true;
        } catch (error) {
            console.error('❌ Error unfollowing user:', error);
            this.showToast('Failed to unfollow user', 'error');
            return false;
        }
    }





    /**
     * Check if current user is following another user
     */
    isFollowing(userId) {
        if (!this.currentUser || !this.currentUser.following) return false;
        return this.currentUser.following.includes(userId);
    }

    /**
     * Toggle follow/unfollow for a user
     */
    async toggleFollow(userId) {
        if (!this.currentUser || userId === this.currentUser.uid) return;
        
        const isCurrentlyFollowing = this.isFollowing(userId);
        
        if (isCurrentlyFollowing) {
            const success = await this.unfollowUser(userId);
            if (success) {
                // Update UI immediately
                this.updateFollowButtonsInUI(userId, false);
                
                // Reload feed and suggested users after unfollowing
                await this.refreshFeedUI();
                this.setupRealTimeListeners(); // Re-setup listeners with updated following list
            }
        } else {
            const success = await this.followUser(userId);
            if (success) {
                // Update UI immediately
                this.updateFollowButtonsInUI(userId, true);
                
                // Reload feed and suggested users after following
                await this.refreshFeedUI();
                this.setupRealTimeListeners(); // Re-setup listeners with updated following list
            }
        }
    }

    /**
     * Update all follow buttons in the UI for a specific user
     */
    updateFollowButtonsInUI(userId, isFollowing) {
        // Find all follow buttons for this user
        const followButtons = document.querySelectorAll(`button[onclick*="toggleFollow('${userId}')"]`);
        
        followButtons.forEach(button => {
            if (isFollowing) {
                button.textContent = 'Unfollow';
                button.className = button.className.replace('bg-orange-500', 'bg-gray-600')
                                                   .replace('hover:bg-orange-600', 'hover:bg-red-600');
            } else {
                button.textContent = 'Follow';
                button.className = button.className.replace('bg-gray-600', 'bg-orange-500')
                                                   .replace('hover:bg-red-600', 'hover:bg-orange-600');
            }
        });
        
        console.log(`🔄 Updated ${followButtons.length} follow buttons for user ${userId}`);
    }

    /**
     * Add location to post using geolocation
     */
    async addLocation() {
        if (!navigator.geolocation) {
            this.showToast('Geolocation not supported by your browser', 'error');
            return;
        }

        const addLocationBtn = document.getElementById('add-location-btn');
        const locationDisplay = document.getElementById('location-display');

        // Show loading state
        if (addLocationBtn) {
            addLocationBtn.innerHTML = `
                <div class="animate-spin w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full mr-2"></div>
                <span class="text-sm">Getting location...</span>
            `;
            addLocationBtn.disabled = true;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes cache
                });
            });

            const { latitude, longitude } = position.coords;
            
            // Try to get address from coordinates using reverse geocoding
            let locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            
            try {
                // Using a free reverse geocoding service
                const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.locality) {
                        locationName = `${data.locality}, ${data.principalSubdivision || data.countryName}`;
                    } else if (data && data.city) {
                        locationName = `${data.city}, ${data.principalSubdivision || data.countryName}`;
                    } else if (data && data.countryName) {
                        locationName = `${data.principalSubdivision || 'Unknown'}, ${data.countryName}`;
                    }
                } else {
                    // Fallback to a simpler description
                    locationName = `Lat: ${latitude.toFixed(3)}, Lng: ${longitude.toFixed(3)}`;
                }
            } catch (geocodeError) {
                console.log('Geocoding failed, using simplified coordinates');
                locationName = `📍 ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
            }

            // Store location for the current post
            this.currentPostLocation = {
                latitude,
                longitude,
                name: locationName,
                timestamp: new Date().toISOString()
            };

            // Update UI
            if (addLocationBtn) {
                addLocationBtn.style.display = 'none';
            }
            
            if (locationDisplay) {
                locationDisplay.innerHTML = `
                    <i data-feather="map-pin" class="w-4 h-4 mr-1"></i>
                    <span class="text-sm">${locationName}</span>
                    <button onclick="window.authService.removeLocation()" class="ml-2 text-red-400 hover:text-red-300">
                        <i data-feather="x" class="w-3 h-3"></i>
                    </button>
                `;
                locationDisplay.classList.remove('hidden');
                if (window.feather) feather.replace();
            }

            this.showToast('Location added successfully', 'success');

        } catch (error) {
            console.error('Error getting location:', error);
            
            let message = 'Failed to get location';
            if (error.code === 1) {
                message = 'Location access denied';
            } else if (error.code === 2) {
                message = 'Location unavailable';
            } else if (error.code === 3) {
                message = 'Location request timeout';
            }
            
            this.showToast(message, 'error');

            // Reset button
            if (addLocationBtn) {
                addLocationBtn.innerHTML = `
                    <i data-feather="map-pin" class="w-5 h-5"></i>
                    <span class="text-sm">Add Location</span>
                `;
                addLocationBtn.disabled = false;
                if (window.feather) feather.replace();
            }
        }
    }

    /**
     * Remove location from current post
     */
    removeLocation() {
        this.currentPostLocation = null;
        
        const addLocationBtn = document.getElementById('add-location-btn');
        const locationDisplay = document.getElementById('location-display');
        
        if (addLocationBtn) {
            addLocationBtn.innerHTML = `
                <i data-feather="map-pin" class="w-5 h-5"></i>
                <span class="text-sm">Add Location</span>
            `;
            addLocationBtn.style.display = 'flex';
            addLocationBtn.disabled = false;
            if (window.feather) feather.replace();
        }
        
        if (locationDisplay) {
            locationDisplay.classList.add('hidden');
        }
        
        // Only show toast if manually removing (not after posting)
        if (arguments[0] !== 'silent') {
            this.showToast('Location removed', 'info');
        }
    }

    /**
     * Save post to Firebase
     */
    async savePostToFirebase(postData) {
        try {
            const { db, collection, addDoc } = await import('../firebase.js');
            const postsCollection = collection(db, 'posts');
            
            const firebasePostData = {
                ...postData,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const docRef = await addDoc(postsCollection, firebasePostData);
            console.log('✅ Post saved to Firebase with ID:', docRef.id);
            
            // Add the ID to the local post data
            postData.id = docRef.id;
            
            return docRef.id;
        } catch (error) {
            console.error('❌ Error saving post to Firebase:', error);
            this.showToast('Failed to save post', 'error');
            throw error;
        }
    }

    /**
     * Load posts from Firebase for feed (only from followed users)
     */
    async loadPostsFromFirebase() {
        try {
            if (!this.currentUser) {
                console.log('No current user, cannot load feed');
                return [];
            }

            const { db, collection, query, orderBy, getDocs, limit, where } = await import('../firebase.js');
            
            // Get list of users that the current user follows
            const followingList = this.currentUser.following || [];
            console.log('🔄 User is following:', followingList.length, 'users:', followingList);
            console.log('🔄 Current user data:', this.currentUser);
            
            // If not following anyone, show all recent posts to discover new users
            if (followingList.length === 0) {
                console.log('User is not following anyone, showing all recent posts for discovery');
                const postsRef = collection(db, 'posts');
                const postsQuery = query(postsRef, orderBy('createdAt', 'desc'), limit(20));
                const snapshot = await getDocs(postsQuery);
                
                const posts = [];
                snapshot.forEach(doc => {
                    const postData = doc.data();
                    posts.push({
                        id: doc.id,
                        ...postData,
                        timestamp: postData.createdAt?.toDate?.()?.toISOString() || postData.timestamp
                    });
                });
                
                console.log(`✅ Loaded ${posts.length} discovery posts`);
                return posts;
            }
            
            // Query posts only from followed users (including own posts)
            const userIds = [...followingList, this.currentUser.uid]; // Include own posts
            
            const postsRef = collection(db, 'posts');
            const postsQuery = query(
                postsRef, 
                where('author.uid', 'in', userIds.slice(0, 10)), // Firebase 'in' limit is 10
                orderBy('createdAt', 'desc'), 
                limit(20)
            );
            
            const snapshot = await getDocs(postsQuery);
            
            const posts = [];
            snapshot.forEach(doc => {
                const postData = doc.data();
                posts.push({
                    id: doc.id,
                    ...postData,
                    timestamp: postData.createdAt?.toDate?.()?.toISOString() || postData.timestamp
                });
            });
            
            // If following more than 10 users, make additional queries (Firebase limitation)
            if (userIds.length > 10) {
                for (let i = 10; i < userIds.length; i += 10) {
                    const batch = userIds.slice(i, i + 10);
                    const batchQuery = query(
                        postsRef,
                        where('author.uid', 'in', batch),
                        orderBy('createdAt', 'desc'),
                        limit(20)
                    );
                    
                    const batchSnapshot = await getDocs(batchQuery);
                    batchSnapshot.forEach(doc => {
                        const postData = doc.data();
                        posts.push({
                            id: doc.id,
                            ...postData,
                            timestamp: postData.createdAt?.toDate?.()?.toISOString() || postData.timestamp
                        });
                    });
                }
                
                // Re-sort all posts by date
                posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }
            
            console.log(`✅ Loaded ${posts.length} posts from followed users`);
            return posts;
            
        } catch (error) {
            console.error('❌ Error loading posts from Firebase:', error);
            return [];
        }
    }

    /**
     * Load and display feed from Firebase
     */
    async loadFeedFromFirebase(showFullLoading = true) {
        const postsContainer = document.getElementById('posts-container');
        if (!postsContainer) return;
        
        // Prevent multiple simultaneous loads
        if (this.isLoadingFeed) {
            console.log('Feed already loading, skipping...');
            return;
        }
        this.isLoadingFeed = true;
        
        // Show loading state - full loading or subtle indicator
        if (showFullLoading) {
            postsContainer.innerHTML = `
                <div class="bg-gray-800 rounded-lg p-6 text-center">
                    <div class="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p class="text-gray-400">Loading your racing feed...</p>
                </div>
            `;
        } else {
            // Add a subtle loading indicator at the top
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'feed-updating';
            loadingIndicator.className = 'bg-orange-500/20 border border-orange-500/50 rounded-lg p-2 mb-4 text-center';
            loadingIndicator.innerHTML = `
                <div class="flex items-center justify-center space-x-2">
                    <div class="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                    <span class="text-orange-400 text-sm">Updating feed...</span>
                </div>
            `;
            
            // Remove existing indicator if present
            const existingIndicator = document.getElementById('feed-updating');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            postsContainer.insertBefore(loadingIndicator, postsContainer.firstChild);
        }
        
        try {
            const posts = await this.loadPostsFromFirebase();
            
            if (posts.length === 0) {
                postsContainer.innerHTML = `
                    <div class="bg-gray-800 rounded-lg p-6 text-center">
                        <i data-feather="activity" class="w-12 h-12 mx-auto mb-4 text-gray-500"></i>
                        <p class="text-gray-400">No posts yet. Be the first to share your racing experience!</p>
                    </div>
                `;
                if (window.feather) feather.replace();
                return;
            }
            
            // Clear container completely
            postsContainer.innerHTML = '';
            
            // Initialize fresh set to prevent duplicates
            this.loadedPostIds = new Set();
            console.log(`🔄 Loading ${posts.length} posts from Firebase...`);
            
            // Add each post using the unified addPostToFeed function
            posts.forEach((post, index) => {
                console.log(`📝 Processing post ${index + 1}/${posts.length}:`, post.id);
                this.addPostToFeed(post, false); // Don't prepend, just add in order
            });
            
            console.log(`✅ Successfully loaded ${this.loadedPostIds.size} unique posts to feed`);
            
        } catch (error) {
            console.error('❌ Error loading feed:', error);
            postsContainer.innerHTML = `
                <div class="bg-gray-800 rounded-lg p-6 text-center">
                    <i data-feather="alert-circle" class="w-12 h-12 mx-auto mb-4 text-red-500"></i>
                    <p class="text-red-400">Failed to load feed. Please try again.</p>
                </div>
            `;
            if (window.feather) feather.replace();
        } finally {
            this.isLoadingFeed = false;
            
            // Remove subtle loading indicator if it exists
            const loadingIndicator = document.getElementById('feed-updating');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
    }

    /**
     * Update profile content based on selected tab
     */
    updateProfileContent(tabType, userId = null) {
        const contentContainer = document.getElementById('profile-content');
        if (!contentContainer) return;
        
        // Use current user ID if not provided
        const targetUserId = userId || this.currentUser?.uid;
        if (!targetUserId) {
            console.error('No user ID available for loading profile content');
            return;
        }
        
        switch (tabType) {
            case 'posts':
                // Load user posts
                this.loadUserPosts(targetUserId, contentContainer);
                break;
            case 'championships':
                contentContainer.innerHTML = `
                    <div class="bg-gray-800 rounded-lg p-6 text-center">
                        <i data-feather="award" class="w-12 h-12 mx-auto mb-4 text-gray-500"></i>
                        <p class="text-gray-400">Championships you've joined will appear here</p>
                    </div>
                `;
                break;
            case 'media':
                contentContainer.innerHTML = `
                    <div class="bg-gray-800 rounded-lg p-6 text-center">
                        <i data-feather="image" class="w-12 h-12 mx-auto mb-4 text-gray-500"></i>
                        <p class="text-gray-400">Photos and videos you've shared</p>
                    </div>
                `;
                break;

        }
        
        if (window.feather) feather.replace();
    }

    /**
     * Load user posts for profile
     */
    async loadUserPosts(userId, container) {
        if (!container) return;
        
        // Show loading
        container.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 text-center">
                <div class="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p class="text-gray-400">Loading posts...</p>
            </div>
        `;
        
        try {
            const { collection, query, where, orderBy, getDocs } = await import('../firebase.js');
            
            const postsRef = collection(db, 'posts');
            // Use simpler query without composite index requirement
            const userPostsQuery = query(
                postsRef, 
                where('author.uid', '==', userId)
            );
            const snapshot = await getDocs(userPostsQuery);
            
            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="bg-gray-800 rounded-lg p-6 text-center">
                        <i data-feather="message-square" class="w-12 h-12 mx-auto mb-4 text-gray-500"></i>
                        <p class="text-gray-400">No posts yet</p>
                    </div>
                `;
                if (window.feather) feather.replace();
                return;
            }
            
            // Clear container
            container.innerHTML = '';
            
            // Convert to array and sort by date (client-side sorting)
            const posts = [];
            snapshot.forEach(doc => {
                const postData = doc.data();
                const post = {
                    id: doc.id,
                    ...postData,
                    timestamp: postData.createdAt?.toDate?.()?.toISOString() || postData.timestamp,
                    sortDate: postData.createdAt?.toDate?.() || new Date(postData.timestamp || 0)
                };
                posts.push(post);
            });
            
            // Sort posts by date (newest first)
            posts.sort((a, b) => b.sortDate - a.sortDate);
            
            // Add each post
            posts.forEach(post => {
                const postElement = this.createPostElement(post);
                container.appendChild(postElement);
            });
            
            if (window.feather) feather.replace();
            
        } catch (error) {
            console.error('Error loading user posts:', error);
            container.innerHTML = `
                <div class="bg-gray-800 rounded-lg p-6 text-center">
                    <i data-feather="alert-circle" class="w-12 h-12 mx-auto mb-4 text-red-500"></i>
                    <p class="text-gray-400">Error loading posts</p>
                </div>
            `;
            if (window.feather) feather.replace();
        }
    }

    /**
     * Create post element (extracted from addPostToFeed)
     */
    createPostElement(postData) {
        const postElement = document.createElement('div');
        postElement.className = 'bg-gray-800 rounded-lg p-6 mb-4 border-l-4 border-orange-500 post-item';
        postElement.setAttribute('data-post-id', postData.id);
        
        const initials = this.getUserInitials(postData.author.displayName || postData.author.email);
        const timeAgo = this.getTimeAgo(postData.timestamp || postData.createdAt);
        
        postElement.innerHTML = `
            <div class="flex space-x-4">
                <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 cursor-pointer" onclick="window.authService.showUserProfile('${postData.author.uid}')">
                    ${initials}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2 mb-2">
                        <h3 class="font-bold text-white cursor-pointer hover:text-orange-400 transition-colors" onclick="window.authService.showUserProfile('${postData.author.uid}')">${postData.author.displayName}</h3>
                        <span class="text-gray-400 text-sm">@${postData.author.email.split('@')[0]}</span>
                        <span class="text-gray-400 text-sm">·</span>
                        <span class="text-gray-400 text-sm">${timeAgo}</span>
                    </div>
                    <p class="text-white whitespace-pre-wrap mb-3">${postData.content}</p>
                    ${postData.location ? `
                        <div class="flex items-center space-x-2 mb-3 p-2 bg-gray-700 rounded-lg">
                            <i data-feather="map-pin" class="w-4 h-4 text-orange-400"></i>
                            <span class="text-sm text-gray-300">${postData.location.name}</span>
                        </div>
                    ` : ''}
                    <div class="flex items-center justify-between pt-3 border-t border-gray-700">
                        <div class="flex items-center space-x-6">
                            <button class="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors group" data-action="comment">
                                <i data-feather="message-circle" class="w-5 h-5 group-hover:scale-110 transition-transform"></i>
                                <span class="text-sm">Comment</span>
                            </button>
                            <button class="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors group" data-action="like">
                                <i data-feather="heart" class="w-5 h-5 group-hover:scale-110 transition-transform"></i>
                                <span class="text-sm">Like</span>
                            </button>
                        </div>
                        ${postData.author.uid === this.currentUser?.uid ? `
                            <button class="text-gray-400 hover:text-red-400 transition-colors group" data-action="delete">
                                <i data-feather="trash-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        return postElement;
    }

    /**
     * Show user profile
     */
    async showUserProfile(userId) {
        console.log('👤 showUserProfile called with userId:', userId);
        console.log('👤 Current user ID:', this.currentUser?.uid);
        
        // Close search modal if open
        const searchModal = document.getElementById('search-modal');
        if (searchModal) {
            searchModal.classList.add('hidden');
        }
        
        try {
            // Update URL to include user ID
            const newUrl = `#profile/${userId}`;
            if (window.location.hash !== newUrl) {
                window.history.pushState(null, null, newUrl);
            }
            
            // If it's the current user, show their own profile
            if (userId === this.currentUser?.uid) {
                this.showPage('profile', false); // Don't update URL again
                return;
            }
            
            // Load the specific user's data
            const { doc, getDoc } = await import('../firebase.js');
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Navigate to profile page and load user data
                this.showPage('profile', false); // Don't update URL again
                
                // Update the profile page with this user's data
                setTimeout(() => {
                    this.updateProfilePageWithUserData(userData, userId, false);
                }, 100);
                
                // Setup real-time listener for this specific user's profile
                this.setupViewedUserListener(userId);
                
            } else {
                console.log('User not found');
                this.showToast('User not found', 'error');
            }
        } catch (error) {
            console.error(' Error showing user profile:', error);
            this.showToast('Error loading user profile', 'error');
        }
    }

    /**
     * Setup real-time listener for a user profile being viewed
     */
    async setupViewedUserListener(userId) {
        try {
            // Clean up any existing viewed user listener
            if (this.viewedUserUnsubscribe) {
                this.viewedUserUnsubscribe();
                this.viewedUserUnsubscribe = null;
            }
            
            const { onSnapshot, doc } = await import('../firebase.js');
            
            // Listen for changes to the viewed user's profile
            this.viewedUserUnsubscribe = onSnapshot(doc(db, 'users', userId), (doc) => {
                if (doc.exists()) {
                    const updatedUser = doc.data();
                    console.log('🔄 Viewed user profile updated in real-time:', updatedUser.displayName);
                    
                    // Update the profile page with the new data
                    this.updateProfilePageWithUserData(updatedUser, userId, false);
                }
            });
            
            console.log('✅ Real-time listener setup for viewed user:', userId);
            
        } catch (error) {
            console.error('❌ Error setting up viewed user listener:', error);
        }
    }



    /**
     * UI Helper Functions
     */
    showLogin() {
        this.hideAll();
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.style.display = 'flex';
    }

    showSignup() {
        const loginContainer = document.getElementById('login-container');
        const signupContainer = document.getElementById('signup-container');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (signupContainer) signupContainer.style.display = 'block';
        
        // Refresh icons
        if (window.feather) feather.replace();
    }

    showProfileSetup(user) {
        this.hideAll();
        const profileSetupScreen = document.getElementById('profile-setup-screen');
        if (profileSetupScreen) {
            profileSetupScreen.style.display = 'flex';
            
            // Check if user signed up with Google or email
            const isGoogleUser = user && user.providerData && user.providerData.some(provider => provider.providerId === 'google.com');
            
            // Handle email field visibility
            const emailContainer = document.querySelector('#setup-email').closest('div');
            const emailInput = document.getElementById('setup-email');
            
            if (isGoogleUser) {
                // Show email field for Google users and pre-fill it
                if (emailContainer) emailContainer.style.display = 'block';
                if (emailInput && user.email) emailInput.value = user.email;
            } else {
                // Hide email field for email signup users
                if (emailContainer) emailContainer.style.display = 'none';
            }
            
            // Pre-fill with Google data if available
            if (user && user.displayName) {
                const displayNameInput = document.getElementById('setup-displayname');
                if (displayNameInput) displayNameInput.value = user.displayName;
            }
            if (user && user.photoURL) {
                const avatarInput = document.getElementById('setup-avatar');
                if (avatarInput) avatarInput.value = user.photoURL;
            }
        }
        
        // Refresh icons
        if (window.feather) feather.replace();
    }

    showMainApp() {
        console.log('🏠 Showing main application');
        
        // Prevent multiple initializations
        if (this.mainAppInitialized) {
            console.log('⚠️ Main app already initialized, just showing...');
            this.hideAll();
            const mainApp = document.getElementById('mainApp');
            if (mainApp) {
                mainApp.style.display = 'block';
                this.showPage('feed', false); // Don't reinitialize everything
            }
            return;
        }
        
        this.hideAll();
        
        const mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.style.display = 'block';
            console.log('✅ Main app displayed');
            
            // Update user info in the UI
            this.updateUserInterface();
            
            // Setup navigation listeners for SPA behavior
            this.setupNavigationListeners();
            
            // Setup post functionality
            this.setupPostFunctionality();
            
            // Setup search functionality
            this.setupSearchFunctionality();
            
            // Show default page (feed)
            this.showPage('feed');
            
            // Mark as initialized
            this.mainAppInitialized = true;
        }
        
        // Refresh icons after showing main app
        if (window.feather) feather.replace();
    }

    /**
     * Update user interface with current user data
     */
    updateUserInterface() {
        if (!this.currentUser) return;
        
        console.log('🔄 Updating user interface with:', this.currentUser.displayName || this.currentUser.email);
        
        // Update user avatar in header
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            const initials = this.getUserInitials(this.currentUser.displayName || this.currentUser.email);
            userAvatar.textContent = initials;
        }
        
        // Update user name in header
        const userName = document.getElementById('user-name');
        if (userName) {
            userName.textContent = this.currentUser.displayName || this.currentUser.username || 'User';
        }
        
        // Update feed user avatar
        const feedUserAvatar = document.getElementById('feed-user-avatar');
        if (feedUserAvatar) {
            const initials = this.getUserInitials(this.currentUser.displayName || this.currentUser.email);
            feedUserAvatar.textContent = initials;
        }
        
        // Update all elements that show user display name
        const displayNameElements = document.querySelectorAll('[data-user-displayname]');
        displayNameElements.forEach(element => {
            element.textContent = this.currentUser.displayName || this.currentUser.username || 'User';
        });
        
        // Update all elements that show user initials
        const initialsElements = document.querySelectorAll('[data-user-initials]');
        const initials = this.getUserInitials(this.currentUser.displayName || this.currentUser.email);
        initialsElements.forEach(element => {
            element.textContent = initials;
        });
        
        // Update profile statistics if visible
        const followingCount = document.getElementById('following-count');
        const followersCount = document.getElementById('followers-count');
        
        if (followingCount && this.currentUser.followingCount !== undefined) {
            followingCount.textContent = this.currentUser.followingCount || 0;
        }
        
        if (followersCount && this.currentUser.followersCount !== undefined) {
            followersCount.textContent = this.currentUser.followersCount || 0;
        }
    }

    hideAll() {
        const screens = [
            'loadingScreen',
            'loginScreen', 
            'profile-setup-screen',
            'mainApp'
        ];
        
        screens.forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) screen.style.display = 'none';
        });
    }

    showError(message) {
        console.error('🔴 Auth Error:', message);
        
        // Remove existing error
        const existingError = document.querySelector('.auth-error');
        if (existingError) existingError.remove();
        
        // Create new error element
        const errorEl = document.createElement('div');
        errorEl.className = 'auth-error fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm';
        errorEl.textContent = message;
        
        document.body.appendChild(errorEl);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorEl.parentNode) {
                errorEl.remove();
            }
        }, 5000);
    }

    setLoading(loading) {
        this.isLoading = loading;
        console.log('🔄 Setting loading state:', loading);
        
        // Show/hide loading states
        const buttons = document.querySelectorAll('.auth-btn');
        buttons.forEach(btn => {
            if (loading) {
                // Store original text if not already stored
                if (!btn.dataset.originalText) {
                    btn.dataset.originalText = btn.textContent;
                }
                btn.disabled = true;
                btn.textContent = 'Loading...';
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = false;
                // Restore original text based on button type
                if (btn.id === 'google-btn') {
                    btn.textContent = 'Continue with Google';
                } else if (btn.id === 'login-btn') {
                    btn.textContent = 'Login';
                } else if (btn.id === 'signup-btn') {
                    btn.textContent = 'Create Account';
                } else {
                    btn.textContent = btn.dataset.originalText || 'Submit';
                }
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    /**
     * Get user initials from name or email
     */
    getUserInitials(name) {
        if (!name) return 'U';
        
        // If it's an email, get the part before @
        if (name.includes('@')) {
            name = name.split('@')[0];
        }
        
        // Split by space and get initials
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else {
            return parts[0].substring(0, 2).toUpperCase();
        }
    }

    /**
     * Setup navigation listeners for SPA behavior
     */
    setupNavigationListeners() {
        const navLinks = document.querySelectorAll('[data-nav-item]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-nav-item');
                this.showPage(page);
            });
        });
    }

    /**
     * Show specific page within the main app
     */
    showPage(pageName, updateUrl = true) {
        console.log('📄 Showing page:', pageName);
        
        // Clean up viewed user listener when navigating away from profile pages
        if (pageName !== 'profile' && this.viewedUserUnsubscribe) {
            console.log('🧹 Cleaning up viewed user listener on navigation');
            this.viewedUserUnsubscribe();
            this.viewedUserUnsubscribe = null;
        }
        
        const appContainer = document.getElementById('app-container');
        if (!appContainer) return;

        // Prevent reloading the same page unnecessarily
        if (this.currentPage === pageName && !updateUrl) {
            console.log('⚠️ Same page already loaded, skipping reload...');
            return;
        }
        this.currentPage = pageName;

        // Update URL without refreshing page
        if (updateUrl) {
            const newUrl = `#${pageName}`;
            if (window.location.hash !== newUrl) {
                window.history.pushState(null, null, newUrl);
            }
        }

        // Generate page content
        let pageContent = this.getPageContent(pageName);
        appContainer.innerHTML = pageContent;

        // Update active nav link
        const navLinks = document.querySelectorAll('[data-nav-item]');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-nav-item') === pageName) {
                link.classList.add('active');
            }
        });
        
        // Page-specific initialization
        if (pageName === 'feed') {
            // Load suggested users and posts from Firebase
            setTimeout(() => {
                this.loadSuggestedUsers();
                this.loadFeedFromFirebase();
            }, 500);
        } else if (pageName === 'profile') {
            // Only update profile page if we're not already handling a specific user profile
            const hash = window.location.hash.replace('#', '');
            const parts = hash.split('/');
            const hasUserParam = parts[1]; // Check if URL has /userId
            
            if (!hasUserParam) {
                // Only for own profile without specific user ID
                setTimeout(() => this.updateProfilePage(), 100);
            }
        }
        
        // Refresh icons after content change
        if (window.feather) feather.replace();
    }

    /**
     * Complete Profile Setup
     */
    async completeProfile(user, profileData) {
        try {
            this.setLoading(true);
            console.log('🔄 Completing profile for:', user.email);
            
            // Validate username
            const username = profileData.username.trim();
            if (!this.validateUsername(username)) {
                this.showError('Username can only contain letters, numbers, and underscores. No spaces or special characters allowed.');
                return;
            }
            
            // Check if username already exists
            if (await this.isUsernameTaken(username)) {
                this.showError('Username is already taken. Please choose another one.');
                return;
            }
            
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: profileData.displayName || user.displayName,
                username: username,
                photoURL: profileData.photoURL || user.photoURL,
                createdAt: new Date().toISOString(),
                profileCompleted: true,
                followersCount: 0,
                followingCount: 0
            };
            
            const { setDoc } = await import('../firebase.js');
            await setDoc(doc(db, 'users', user.uid), userData);
            console.log('✅ Profile created successfully');
            
            this.currentUser = userData;
            this.showMainApp();
            
        } catch (error) {
            console.error('❌ Profile creation error:', error);
            this.showError('Failed to create profile');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Validate username format
     */
    validateUsername(username) {
        // Only allow letters, numbers, and underscores
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        return username.length >= 3 && username.length <= 20 && usernameRegex.test(username);
    }

    /**
     * Check if username is already taken
     */
    async isUsernameTaken(username) {
        try {
            const { collection, query, where, getDocs } = await import('../firebase.js');
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', username));
            const querySnapshot = await getDocs(q);
            
            return !querySnapshot.empty;
        } catch (error) {
            console.error('Error checking username:', error);
            return false; // Allow if we can't check
        }
    }

    /**
     * Toggle like on a post
     */
    async toggleLike(postId, likeBtn) {
        try {
            if (!this.currentUser || !postId) return;
            
            console.log('❤️ Toggling like for post:', postId);
            
            const { doc, updateDoc, arrayUnion, arrayRemove, getDoc } = await import('../firebase.js');
            const postRef = doc(db, 'posts', postId);
            
            // Get current post data
            const postSnap = await getDoc(postRef);
            if (!postSnap.exists()) {
                console.error('Post not found');
                return;
            }
            
            const postData = postSnap.data();
            const likedBy = postData.likedBy || [];
            const isLiked = likedBy.includes(this.currentUser.uid);
            
            // Update Firebase
            if (isLiked) {
                // Remove like
                await updateDoc(postRef, {
                    likedBy: arrayRemove(this.currentUser.uid),
                    likes: Math.max(0, (postData.likes || 0) - 1)
                });
                
                // Update UI
                likeBtn.classList.remove('liked');
                likeBtn.style.color = '';
                const likeCount = likeBtn.querySelector('.like-count');
                if (likeCount) {
                    const newCount = Math.max(0, parseInt(likeCount.textContent) - 1);
                    likeCount.textContent = newCount;
                }
            } else {
                // Add like
                await updateDoc(postRef, {
                    likedBy: arrayUnion(this.currentUser.uid),
                    likes: (postData.likes || 0) + 1
                });
                
                // Update UI
                likeBtn.classList.add('liked');
                likeBtn.style.color = '#ef4444';
                const likeCount = likeBtn.querySelector('.like-count');
                if (likeCount) {
                    const newCount = parseInt(likeCount.textContent) + 1;
                    likeCount.textContent = newCount;
                }
            }
            
        } catch (error) {
            console.error('Error toggling like:', error);
            this.showToast('Error updating like', 'error');
        }
    }

    /**
     * Show comment modal for a post
     */
    async showCommentModal(postId) {
        try {
            console.log('💬 Showing comment modal for post:', postId);
            
            // Remove existing modal
            const existingModal = document.getElementById('comment-modal');
            if (existingModal) existingModal.remove();
            
            // Get post data and comments
            const { doc, getDoc, collection, query, orderBy, getDocs } = await import('../firebase.js');
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);
            
            if (!postSnap.exists()) {
                this.showToast('Post not found', 'error');
                return;
            }
            
            const postData = postSnap.data();
            
            // Get comments
            const commentsRef = collection(db, 'posts', postId, 'comments');
            const commentsQuery = query(commentsRef, orderBy('timestamp', 'desc'));
            const commentsSnap = await getDocs(commentsQuery);
            
            let commentsHtml = '';
            commentsSnap.forEach(doc => {
                const comment = doc.data();
                const initials = this.getUserInitials(comment.author.displayName || comment.author.email);
                commentsHtml += `
                    <div class="flex space-x-3 p-3 border-b border-gray-700 last:border-b-0">
                        <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            ${initials}
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center space-x-2">
                                <span class="font-semibold text-white">${comment.author.displayName || comment.author.username || 'User'}</span>
                                <span class="text-gray-400 text-sm">${this.getTimeAgo(comment.timestamp)}</span>
                            </div>
                            <p class="text-gray-300 mt-1">${comment.content}</p>
                        </div>
                    </div>
                `;
            });
            
            if (!commentsHtml) {
                commentsHtml = `
                    <div class="text-center py-8 text-gray-400">
                        <i data-feather="message-square" class="w-12 h-12 mx-auto mb-2"></i>
                        <p>No comments yet. Be the first to comment!</p>
                    </div>
                `;
            }
            
            const modal = document.createElement('div');
            modal.id = 'comment-modal';
            modal.className = 'fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4';
            
            modal.innerHTML = `
                <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700">
                    <!-- Header -->
                    <div class="flex items-center justify-between p-4 border-b border-gray-700">
                        <h3 class="text-xl font-bold text-white">Comments</h3>
                        <button onclick="document.getElementById('comment-modal').remove()" class="text-gray-400 hover:text-white">
                            <i data-feather="x" class="w-6 h-6"></i>
                        </button>
                    </div>
                    
                    <!-- Comments List -->
                    <div class="flex-1 overflow-y-auto max-h-96">
                        ${commentsHtml}
                    </div>
                    
                    <!-- Add Comment -->
                    <div class="p-4 border-t border-gray-700">
                        <div class="flex space-x-3">
                            <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                ${this.getUserInitials(this.currentUser.displayName || this.currentUser.email)}
                            </div>
                            <div class="flex-1">
                                <textarea
                                    id="new-comment-content"
                                    placeholder="Add a comment..."
                                    class="w-full bg-gray-700 text-white rounded-lg p-3 resize-none border-none outline-none"
                                    rows="2"
                                ></textarea>
                                <div class="flex justify-end mt-2">
                                    <button onclick="window.authService.addComment('${postId}')" class="racing-btn px-4 py-2 text-sm" id="add-comment-btn" disabled>
                                        <i data-feather="send" class="w-4 h-4 mr-1"></i>
                                        Comment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Enable/disable comment button based on content
            const textarea = document.getElementById('new-comment-content');
            const commentBtn = document.getElementById('add-comment-btn');
            
            textarea.addEventListener('input', () => {
                commentBtn.disabled = !textarea.value.trim();
            });
            
            // Refresh feather icons
            if (window.feather) feather.replace();
            
        } catch (error) {
            console.error('Error showing comment modal:', error);
            this.showToast('Error loading comments', 'error');
        }
    }

    /**
     * Add a comment to a post
     */
    async addComment(postId) {
        try {
            const textarea = document.getElementById('new-comment-content');
            const content = textarea.value.trim();
            
            if (!content || !this.currentUser) return;
            
            console.log('💬 Adding comment to post:', postId);
            
            const { db, doc, collection, addDoc, updateDoc, increment } = await import('../firebase.js');
            
            const commentData = {
                content: content,
                author: {
                    uid: this.currentUser.uid,
                    displayName: this.currentUser.displayName || this.currentUser.username,
                    email: this.currentUser.email
                },
                timestamp: new Date().toISOString()
            };
            
            // Add comment to subcollection
            const commentsRef = collection(db, 'posts', postId, 'comments');
            await addDoc(commentsRef, commentData);
            
            // Update post comment count
            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, {
                comments: increment(1)
            });
            
            // Clear textarea
            textarea.value = '';
            
            // Refresh modal
            document.getElementById('comment-modal').remove();
            this.showCommentModal(postId);
            
            this.showToast('Comment added!', 'success');
            
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showToast('Error adding comment', 'error');
        }
    }

    /**
     * Delete a post
     */
    async deletePost(postId, postElement) {
        try {
            if (!postId || !this.currentUser) return;
            
            console.log('🗑️ Deleting post:', postId);
            
            // No confirmation needed - direct deletion
            
            // First verify the user owns this post
            const { doc, getDoc, deleteDoc, collection, getDocs } = await import('../firebase.js');
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);
            
            if (!postSnap.exists()) {
                this.showToast('Post not found', 'error');
                return;
            }
            
            const postData = postSnap.data();
            
            // Check if current user is the author
            if (postData.author.uid !== this.currentUser.uid) {
                this.showToast('You can only delete your own posts', 'error');
                return;
            }
            
            // Delete all comments first
            try {
                const commentsRef = collection(db, 'posts', postId, 'comments');
                const commentsSnap = await getDocs(commentsRef);
                
                const deletePromises = commentsSnap.docs.map(commentDoc => 
                    deleteDoc(commentDoc.ref)
                );
                
                await Promise.all(deletePromises);
                console.log('✅ Comments deleted');
            } catch (commentsError) {
                console.warn('Error deleting comments:', commentsError);
                // Continue with post deletion even if comments fail
            }
            
            // Delete the post from Firebase
            await deleteDoc(postRef);
            console.log('✅ Post deleted from Firebase');
            
            // Remove from DOM
            if (postElement && postElement.parentNode) {
                postElement.remove();
            }
            
            this.showToast('Post deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showToast('Error deleting post', 'error');
        }
    }

    /**
     * Show edit profile modal
     */
    showEditProfileModal() {
        if (!this.currentUser) return;

        // Remove existing modal if present
        const existingModal = document.getElementById('edit-profile-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'edit-profile-modal';
        modal.className = 'fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4';

        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md relative border border-gray-700">
                <!-- Header -->
                <div class="bg-gradient-to-r from-red-600 to-orange-500 p-6 rounded-t-lg">
                    <div class="flex items-center justify-between">
                        <h2 class="text-xl font-bold text-white flex items-center">
                            <i data-feather="edit-2" class="w-5 h-5 mr-2"></i>
                            Edit Profile
                        </h2>
                        <button onclick="document.getElementById('edit-profile-modal').remove()" class="text-white hover:text-gray-200">
                            <i data-feather="x" class="w-6 h-6"></i>
                        </button>
                    </div>
                </div>

                <!-- Form -->
                <form id="edit-profile-form" class="p-6" onsubmit="window.authService.saveProfileChanges(event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                            <input 
                                type="text" 
                                id="edit-display-name"
                                value="${this.currentUser.displayName || ''}"
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none text-white"
                                placeholder="Your display name"
                                maxlength="50"
                                required
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                            <textarea 
                                id="edit-bio"
                                rows="3"
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none text-white resize-none"
                                placeholder="Tell us about your racing passion..."
                                maxlength="160"
                            >${this.currentUser.bio || ''}</textarea>
                            <div class="text-xs text-gray-400 mt-1">
                                <span id="bio-count">${(this.currentUser.bio || '').length}</span>/160 characters
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Location</label>
                            <input 
                                type="text" 
                                id="edit-location"
                                value="${this.currentUser.location || ''}"
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none text-white"
                                placeholder="São Paulo, Brazil"
                                maxlength="50"
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Website</label>
                            <input 
                                type="url" 
                                id="edit-website"
                                value="${this.currentUser.website || ''}"
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none text-white"
                                placeholder="https://yourwebsite.com"
                                maxlength="100"
                            />
                        </div>
                    </div>

                    <!-- Buttons -->
                    <div class="flex space-x-4 mt-6">
                        <button 
                            type="button" 
                            onclick="document.getElementById('edit-profile-modal').remove()"
                            class="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            class="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-lg transition-colors font-medium"
                        >
                            <i data-feather="save" class="w-4 h-4 mr-2"></i>
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Add character count listener for bio
        document.getElementById('edit-bio').addEventListener('input', (e) => {
            document.getElementById('bio-count').textContent = e.target.value.length;
        });

        if (window.feather) feather.replace();
    }

    /**
     * Save profile changes
     */
    async saveProfileChanges(event) {
        event.preventDefault();
        
        try {
            const displayName = document.getElementById('edit-display-name').value.trim();
            const bio = document.getElementById('edit-bio').value.trim();
            const location = document.getElementById('edit-location').value.trim();
            const website = document.getElementById('edit-website').value.trim();
            
            if (!displayName) {
                this.showToast('Display name is required', 'error');
                return;
            }
            
            const { updateDoc } = await import('../firebase.js');
            const userRef = doc(db, 'users', this.currentUser.uid);
            
            const updateData = {
                displayName: displayName,
                bio: bio,
                location: location,
                website: website
            };
            
            await updateDoc(userRef, updateData);
            
            // Update current user data
            this.currentUser = { ...this.currentUser, ...updateData };
            
            // Update UI
            this.updateUserInterface();
            
            // Close modal
            document.getElementById('edit-profile-modal').remove();
            
            this.showToast('Profile updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showToast('Error updating profile', 'error');
        }
    }

    /**
     * Show settings modal
     */
    showSettingsModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('settings-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4';

        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md relative border border-gray-700">
                <!-- Header -->
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-lg">
                    <div class="flex items-center justify-between">
                        <h2 class="text-xl font-bold text-white flex items-center">
                            <i data-feather="settings" class="w-5 h-5 mr-2"></i>
                            Settings
                        </h2>
                        <button onclick="document.getElementById('settings-modal').remove()" class="text-white hover:text-gray-200">
                            <i data-feather="x" class="w-6 h-6"></i>
                        </button>
                    </div>
                </div>

                <!-- Settings List -->
                <div class="p-6">
                    <div class="space-y-4">
                        <!-- Account Settings -->
                        <div class="border-b border-gray-700 pb-4">
                            <h3 class="text-lg font-semibold text-white mb-3">Account</h3>
                            <div class="space-y-3">
                                <button onclick="window.authService.showEditProfileModal(); document.getElementById('settings-modal').remove();" class="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left">
                                    <div class="flex items-center">
                                        <i data-feather="user" class="w-5 h-5 mr-3 text-orange-400"></i>
                                        <span class="text-white">Edit Profile</span>
                                    </div>
                                    <i data-feather="chevron-right" class="w-4 h-4 text-gray-400"></i>
                                </button>
                                
                                <button onclick="window.authService.changePassword()" class="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left">
                                    <div class="flex items-center">
                                        <i data-feather="lock" class="w-5 h-5 mr-3 text-blue-400"></i>
                                        <span class="text-white">Change Password</span>
                                    </div>
                                    <i data-feather="chevron-right" class="w-4 h-4 text-gray-400"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Privacy Settings -->
                        <div class="border-b border-gray-700 pb-4">
                            <h3 class="text-lg font-semibold text-white mb-3">Privacy</h3>
                            <div class="space-y-3">
                                <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                    <div class="flex items-center">
                                        <i data-feather="eye" class="w-5 h-5 mr-3 text-green-400"></i>
                                        <span class="text-white">Public Profile</span>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" class="sr-only peer" checked>
                                        <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Danger Zone -->
                        <div>
                            <h3 class="text-lg font-semibold text-red-400 mb-3">Danger Zone</h3>
                            <button onclick="window.authService.confirmDeleteAccount()" class="w-full flex items-center justify-between p-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg transition-colors text-left">
                                <div class="flex items-center">
                                    <i data-feather="trash-2" class="w-5 h-5 mr-3 text-red-400"></i>
                                    <span class="text-red-400">Delete Account</span>
                                </div>
                                <i data-feather="chevron-right" class="w-4 h-4 text-red-400"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Sign Out Button -->
                    <div class="mt-6 pt-6 border-t border-gray-700">
                        <button onclick="window.authService.logout(); document.getElementById('settings-modal').remove();" class="w-full flex items-center justify-center p-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium">
                            <i data-feather="log-out" class="w-5 h-5 mr-2"></i>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        if (window.feather) feather.replace();
    }

    /**
     * Change password functionality
     */
    changePassword() {
        alert('Password change functionality will be implemented. For now, you can reset your password via email on the login screen.');
    }

    /**
     * Confirm account deletion
     */
    confirmDeleteAccount() {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            if (confirm('This will permanently delete all your data, posts, and followers. Are you absolutely sure?')) {
                this.deleteAccount();
            }
        }
    }

    /**
     * Delete user account
     */
    async deleteAccount() {
        try {
            // Implementation for account deletion would go here
            alert('Account deletion functionality will be implemented in a future update.');
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showToast('Error deleting account', 'error');
        }
    }

    /**
     * Get content for specific page
     */
    getPageContent(pageName) {
        switch (pageName) {
            case 'feed':
                return `
                    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <!-- Main Feed Column -->
                        <div class="lg:col-span-3 space-y-6">
                            <!-- Create Post Box (Always Visible) -->
                            <div class="bg-gray-800 rounded-lg p-6">
                                <div class="flex space-x-4">
                                    <div id="feed-user-avatar" class="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                                        U
                                    </div>
                                    <div class="flex-1">
                                        <textarea
                                            id="new-post-content"
                                            placeholder="What's happening in the racing world?"
                                            class="w-full bg-transparent text-white placeholder-gray-400 resize-none text-xl border-none outline-none"
                                            rows="3"
                                        ></textarea>
                                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                                            <div class="text-sm text-gray-400">
                                                Share your racing thoughts with the community
                                            </div>
                                            <button id="publish-post-btn" class="racing-btn px-6 py-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                                <i data-feather="send" class="w-4 h-4 mr-2"></i>
                                                Post
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Posts Feed -->
                            <div id="posts-container">
                                <div class="bg-gray-800 rounded-lg p-6 text-center">
                                    <i data-feather="activity" class="w-12 h-12 mx-auto mb-4 text-gray-500"></i>
                                    <p class="text-gray-400">Welcome to RaceManager Pro! Share your racing experiences.</p>
                                </div>
                            </div>
                        </div>

                        <!-- Sidebar -->
                        <div class="lg:col-span-1 space-y-6">
                            <!-- Suggested Users -->
                            <div class="bg-gray-800 rounded-lg p-6">
                                <h3 class="text-xl font-bold text-white mb-4">Suggested Users</h3>
                                <div id="suggested-users-container" class="space-y-4">
                                    <div class="text-center py-4">
                                        <div class="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        <p class="text-gray-400 text-sm">Loading users...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 'championships':
                return `
                    <div class="space-y-6">
                        <div class="flex items-center justify-between">
                            <h1 class="text-3xl font-bold text-white">Championships</h1>
                            <button id="create-championship-btn" class="racing-btn px-4 py-2">
                                <i data-feather="plus" class="w-4 h-4 mr-2"></i>
                                Create Championship
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="championships-grid">
                            <div class="bg-gray-800 rounded-lg p-6 text-center border-2 border-dashed border-gray-600 hover:border-orange-500 transition-colors cursor-pointer" id="create-championship-card">
                                <i data-feather="plus-circle" class="w-16 h-16 mx-auto mb-4 text-gray-500"></i>
                                <h3 class="text-lg font-semibold text-white mb-2">Create Championship</h3>
                                <p class="text-gray-400 text-sm">Start your own racing championship and invite drivers to compete</p>
                            </div>
                        </div>

                        <!-- Sample Championship Card -->
                        <div class="hidden" id="championship-template">
                            <div class="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors">
                                <div class="p-6">
                                    <div class="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 class="text-xl font-bold text-white">Championship Name</h3>
                                            <p class="text-gray-400">Created by Creator Name</p>
                                        </div>
                                        <span class="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Active</span>
                                    </div>
                                    <p class="text-gray-300 mb-4">Championship description...</p>
                                    <div class="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p class="text-2xl font-bold text-orange-400">12</p>
                                            <p class="text-gray-400 text-sm">Drivers</p>
                                        </div>
                                        <div>
                                            <p class="text-2xl font-bold text-blue-400">8</p>
                                            <p class="text-gray-400 text-sm">Races</p>
                                        </div>
                                        <div>
                                            <p class="text-2xl font-bold text-green-400">85%</p>
                                            <p class="text-gray-400 text-sm">Complete</p>
                                        </div>
                                    </div>
                                    <div class="mt-4 pt-4 border-t border-gray-700 flex justify-between">
                                        <button class="text-orange-400 hover:text-orange-300">
                                            <i data-feather="eye" class="w-4 h-4 mr-1"></i>
                                            View
                                        </button>
                                        <button class="text-blue-400 hover:text-blue-300">
                                            <i data-feather="users" class="w-4 h-4 mr-1"></i>
                                            Join
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 'profile':
                return `
                    <div class="max-w-5xl mx-auto space-y-6">
                        <!-- Racing Profile Header -->
                        <div class="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-orange-500/20">
                            <!-- Racing Cover with Checkered Pattern -->
                            <div class="h-40 relative overflow-hidden">
                                <div class="absolute inset-0 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600"></div>
                                <div class="absolute inset-0 opacity-20">
                                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                        <defs>
                                            <pattern id="checkers" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                                <rect x="0" y="0" width="10" height="10" fill="#000"/>
                                                <rect x="10" y="10" width="10" height="10" fill="#000"/>
                                            </pattern>
                                        </defs>
                                        <rect width="100%" height="100%" fill="url(#checkers)"/>
                                    </svg>
                                </div>
                                <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-800/80 to-transparent"></div>
                            </div>
                            
                            <!-- Profile Info -->
                            <div class="p-6 -mt-6 relative">
                                <div class="flex flex-col lg:flex-row items-start lg:items-end space-y-4 lg:space-y-0 lg:space-x-6">
                                    <!-- Racing Avatar -->
                                    <div class="relative">
                                        <div id="profile-avatar" class="w-24 h-24 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-3xl border-4 border-gray-700 shadow-xl">
                                            🏁
                                        </div>
                                    </div>
                                    
                                    <!-- Racing Stats & Info -->
                                    <div class="flex-1 min-w-0">
                                        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <h1 id="profile-name" class="text-3xl font-bold text-white mb-1">Loading...</h1>
                                                <p id="profile-username" class="text-orange-400 font-medium">@loading</p>
                                                <p id="profile-bio" class="text-gray-300 mt-2" style="display: none;"></p>
                                            </div>
                                            
                                            <!-- Action Buttons -->
                                            <div id="profile-actions" class="flex space-x-3 mt-4 sm:mt-0">
                                                <!-- Will be populated dynamically -->
                                            </div>
                                        </div>
                                        
                                        <!-- Racing Stats Grid -->
                                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 p-4 bg-gray-900/50 rounded-lg">
                                            <div class="text-center">
                                                <div class="text-2xl font-bold text-orange-400" id="following-count">0</div>
                                                <div class="text-sm text-gray-400">Following</div>
                                            </div>
                                            <div class="text-center">
                                                <div class="text-2xl font-bold text-blue-400" id="followers-count">0</div>
                                                <div class="text-sm text-gray-400">Followers</div>
                                            </div>
                                            <div class="text-center">
                                                <div class="text-2xl font-bold text-green-400" id="posts-count">0</div>
                                                <div class="text-sm text-gray-400">Posts</div>
                                            </div>
                                            <div class="text-center">
                                                <div class="text-2xl font-bold text-red-400">0</div>
                                                <div class="text-sm text-gray-400">Races</div>
                                            </div>
                                        </div>
                                        
                                        <!-- Profile Details -->
                                        <div class="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-400">
                                            <span><i data-feather="calendar" class="w-4 h-4 inline mr-1"></i><span id="profile-joined">Loading...</span></span>
                                            <div class="flex items-center" style="display: none;">
                                                <i data-feather="map-pin" class="w-4 h-4 mr-1"></i>
                                                <span id="profile-location"></span>
                                            </div>
                                            <div class="flex items-center" style="display: none;">
                                                <i data-feather="link" class="w-4 h-4 mr-1"></i>
                                                <a id="profile-website" href="" target="_blank" class="text-orange-400 hover:text-orange-300"></a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Racing Navigation Tabs -->
                        <div class="bg-gray-800 rounded-lg p-1 border border-gray-700">
                            <nav class="flex space-x-1">
                                <button class="profile-tab active flex-1 py-3 px-4 text-center rounded-lg transition-colors font-medium" data-tab="posts">
                                    <i data-feather="message-square" class="w-4 h-4 mr-2"></i>
                                    Posts & Updates
                                </button>
                                <button class="profile-tab flex-1 py-3 px-4 text-center rounded-lg transition-colors font-medium" data-tab="championships">
                                    <i data-feather="award" class="w-4 h-4 mr-2"></i>
                                    Championships
                                </button>
                                <button class="profile-tab flex-1 py-3 px-4 text-center rounded-lg transition-colors font-medium" data-tab="activity">
                                    <i data-feather="activity" class="w-4 h-4 mr-2"></i>
                                    Racing Activity
                                </button>
                            </nav>
                        </div>

                        <!-- Profile Content -->
                        <div id="profile-content" class="space-y-6">
                            <div class="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                                <div class="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <i data-feather="flag" class="w-8 h-8 text-orange-400"></i>
                                </div>
                                <h3 class="text-xl font-bold text-white mb-2">Ready to Race!</h3>
                                <p class="text-gray-400">Share your racing experiences, achievements, and connect with the racing community.</p>
                            </div>
                        </div>
                    </div>
                `;
            default:
                return `
                    <div class="text-center py-20">
                        <div class="text-red-400 mb-4">
                            <i data-feather="alert-circle" class="w-12 h-12 mx-auto mb-4"></i>
                            <h2 class="text-2xl font-bold mb-2">Page Not Found</h2>
                            <p class="text-gray-400">The requested page could not be found.</p>
                        </div>
                        <button onclick="window.authService.showPage('feed')" class="racing-btn mt-4">
                            <i data-feather="home" class="w-4 h-4 mr-2"></i>
                            Back to Feed
                        </button>
                    </div>
                `;
        }
    }
}

// Initialize the service and make it globally available
window.authService = new SimpleAuthService();
