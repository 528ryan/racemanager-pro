/**
 * SimpleAuthService - Sistema de Autenticação Simplificado
 * Baseado em exemplos do Firebase e StackOverflow
 */
import { auth, googleProvider, db, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, deleteDoc, updateProfile } from '../firebase.js';

export class SimpleAuthService {
    constructor() {
        this.currentUser = null;
        this.isLoading = false;
        this.isGoogleSignInInProgress = false;
        this.uiListenersSetup = false;
        this.postFunctionalitySetup = false;
        this.isPublishing = false;
        this.lastPublishTime = null;
        
        // Setup global error handlers
        this.setupErrorHandlers();
        
        this.setupAuthListener();
        this.setupUIListeners();
        this.setupUrlListener();
        
        console.log('🔐 SimpleAuthService initialized');
    }

    /**
     * Setup global error handlers
     */
    setupErrorHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            
            // Suppress Firebase internal errors
            if (error && typeof error === 'object') {
                const errorMessage = error.message || '';
                const errorStack = error.stack || '';
                
                // Firebase internal assertion errors
                if (errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn('🔥 Firebase internal error (suppressed):', errorMessage.substring(0, 100) + '...');
                    event.preventDefault();
                    return;
                }
                
                // Firebase popup promise errors
                if (errorMessage.includes('Pending promise was never set') || 
                    errorMessage.includes('Promise was never set') ||
                    errorStack.includes('abstract_popup_redirect_operation')) {
                    console.warn('🔥 Firebase popup error (suppressed):', errorMessage);
                    event.preventDefault();
                    return;
                }
                
                // Firebase auth/firestore errors (handle gracefully)
                if (error.code && (error.code.includes('auth/') || error.code.includes('firestore/'))) {
                    console.warn('🔥 Firebase error handled gracefully:', error.code);
                    event.preventDefault();
                    return;
                }
                
                // Network errors for Firebase
                if (errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
                    errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                    errorMessage.includes('NetworkError')) {
                    console.warn('🌐 Network error (suppressed):', errorMessage);
                    event.preventDefault();
                    return;
                }
            }
            
            // Only log significant errors that need attention
            if (error && !this.isFirebaseInternalError(error)) {
                console.error('Unhandled promise rejection:', error);
            }
        });
        
        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            const message = event.message || '';
            const filename = event.filename || '';
            
            // Suppress Firebase internal errors
            if (message.includes('INTERNAL ASSERTION FAILED') ||
                message.includes('Pending promise was never set') ||
                filename.includes('firebase') ||
                filename.includes('firestore')) {
                console.warn('🔥 Firebase/Firestore error (suppressed):', message.substring(0, 100) + '...');
                event.preventDefault();
                return;
            }
        });
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
                this.showMainApp();
                console.log('🏠 Redirecting to main app');
            } else {
                // New user - needs profile setup
                console.log('👤 New user detected - showing profile setup');
                this.showProfileSetup(user);
            }
            
        } catch (error) {
            console.error('❌ Error handling signed in user:', error);
            this.showError('Error loading user profile');
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
     * Google Sign In
     * Baseado em: https://firebase.google.com/docs/auth/web/google-signin
     */
    async signInWithGoogle() {
        try {
            this.setLoading(true);
            console.log('🔄 Starting Google sign in...');
            
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
        // Prevent multiple setups
        if (this.postFunctionalitySetup) {
            console.log('⚠️ Post functionality already setup, skipping...');
            return;
        }
        this.postFunctionalitySetup = true;
        
        console.log('📝 Setting up post functionality...');
        
        // Create a unique handler that prevents multiple calls
        const publishHandler = (content) => {
            // Add timestamp to prevent rapid successive calls
            const now = Date.now();
            if (this.lastPublishTime && (now - this.lastPublishTime) < 1000) {
                console.log('⚠️ Publish call too soon after previous, ignoring...');
                return;
            }
            this.lastPublishTime = now;
            this.publishPost(content);
        };
        
        // Use event delegation to handle dynamically created elements
        document.addEventListener('input', (e) => {
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
        });
        
        // Use event delegation for button clicks
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'publish-post-btn') {
                e.preventDefault();
                e.stopPropagation();
                const postContent = document.getElementById('new-post-content');
                if (postContent && postContent.value.trim()) {
                    publishHandler(postContent.value);
                }
            }
        });
        
        // Handle enter key (Ctrl+Enter or Cmd+Enter to post)
        document.addEventListener('keydown', (e) => {
            if (e.target && e.target.id === 'new-post-content') {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    const publishBtn = document.getElementById('publish-post-btn');
                    if (publishBtn && !publishBtn.disabled) {
                        e.preventDefault();
                        publishHandler(e.target.value);
                    }
                }
            }
        });
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
        toast.className = `toast fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm ${
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
                    <div class="p-4 hover:bg-gray-700 border-b border-gray-700 last:border-b-0">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer" onclick="window.authService.showUserProfile('${user.uid}')">
                                ${initials}
                            </div>
                            <div class="flex-1 min-w-0 cursor-pointer" onclick="window.authService.showUserProfile('${user.uid}')">
                                <p class="text-white font-medium">${user.displayName || username}</p>
                                <p class="text-gray-400 text-sm">@${username}</p>
                            </div>
                            ${user.uid !== this.currentUser.uid ? `
                                <button 
                                    class="text-sm px-4 py-1 rounded-full transition-colors ${isFollowing ? 'bg-gray-600 hover:bg-red-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}"
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
            const { db, collection, query: firestoreQuery, where, getDocs, limit } = await import('../firebase.js');
            const usersRef = collection(db, 'users');
            
            // Search by display name or username (you can improve this with better search)
            const queryLower = query.toLowerCase();
            const usersSnapshot = await getDocs(usersRef);
            
            const matchingUsers = [];
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const displayName = (userData.displayName || '').toLowerCase();
                const username = (userData.username || '').toLowerCase();
                const email = (userData.email || '').toLowerCase();
                
                if (displayName.includes(queryLower) || 
                    username.includes(queryLower) || 
                    email.includes(queryLower)) {
                    matchingUsers.push({ uid: doc.id, ...userData });
                }
            });
            
            return matchingUsers.slice(0, 10); // Limit to 10 results
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
                if (userData.uid !== this.currentUser.uid) { // Don't suggest current user
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
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3 cursor-pointer" onclick="window.authService.showUserProfile('${user.uid}')">
                                <div class="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    ${initials}
                                </div>
                                <div>
                                    <p class="text-white font-medium">${user.displayName || username}</p>
                                    <p class="text-gray-400 text-sm">@${username}</p>
                                </div>
                            </div>
                            <button 
                                class="text-sm px-4 py-1 rounded-full transition-colors ${isFollowing ? 'bg-gray-600 hover:bg-red-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}"
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
        // Update profile avatar
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            const initials = this.getUserInitials(userData.displayName || userData.email);
            profileAvatar.textContent = initials;
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
        const actionsContainer = document.getElementById('profile-actions');
        if (!actionsContainer) return;
        
        if (isOwnProfile) {
            // Own profile - show edit button
            actionsContainer.innerHTML = `
                <button class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full transition-colors font-medium" data-action="edit-profile">
                    <i data-feather="edit-2" class="w-4 h-4 mr-2"></i>
                    Edit Profile
                </button>
                <button class="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full transition-colors font-medium" data-action="settings">
                    <i data-feather="settings" class="w-4 h-4 mr-2"></i>
                    Settings
                </button>
            `;
        } else {
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
        }
        
        // Refresh feather icons
        if (window.feather) feather.replace();
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
            await this.unfollowUser(userId);
        } else {
            await this.followUser(userId);
        }
        
        // Reload suggested users to update UI
        setTimeout(() => {
            this.loadSuggestedUsers();
        }, 500);
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
     * Load posts from Firebase for feed
     */
    async loadPostsFromFirebase() {
        try {
            const { db, collection, query, orderBy, getDocs, limit } = await import('../firebase.js');
            
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
            
            return posts;
        } catch (error) {
            console.error('❌ Error loading posts from Firebase:', error);
            return [];
        }
    }

    /**
     * Load and display feed from Firebase
     */
    async loadFeedFromFirebase() {
        const postsContainer = document.getElementById('posts-container');
        if (!postsContainer) return;
        
        // Prevent multiple simultaneous loads
        if (this.isLoadingFeed) {
            console.log('Feed already loading, skipping...');
            return;
        }
        this.isLoadingFeed = true;
        
        // Show loading state
        postsContainer.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 text-center">
                <div class="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p class="text-gray-400">Loading your racing feed...</p>
            </div>
        `;
        
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
            } else {
                console.log('User not found');
                this.showToast('User not found', 'error');
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            this.showToast('Failed to load user profile', 'error');
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            console.log('👋 Signing out user...');
            await signOut(auth);
            console.log('✅ User signed out successfully');
            // The onAuthStateChanged listener will handle showing login screen
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.handleAuthError(error);
        }
    }

    /**
     * Complete Profile Setup
     */
    async completeProfile(user, profileData) {
        try {
            this.setLoading(true);
            console.log('🔄 Completing profile for:', user.email);
            
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: profileData.displayName || user.displayName,
                username: profileData.username,
                photoURL: profileData.photoURL || user.photoURL,
                createdAt: new Date().toISOString(),
                profileCompleted: true
            };
            
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
     * Sign Out
     */
    async signOutUser() {
        try {
            await signOut(auth);
            console.log('👋 User signed out successfully');
        } catch (error) {
            console.error('❌ Sign out error:', error);
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
            
            // Pre-fill form with user data
            const emailField = document.getElementById('setup-email');
            const displayNameField = document.getElementById('setup-displayname');
            
            if (emailField) emailField.value = user.email;
            if (displayNameField && user.displayName) displayNameField.value = user.displayName;
        }
        
        // Refresh icons
        if (window.feather) feather.replace();
    }

    showMainApp() {
        console.log('🏠 Showing main application');
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
        }
        
        // Refresh icons after showing main app
        if (window.feather) feather.replace();
    }

    /**
     * Update user interface with current user data
     */
    updateUserInterface() {
        if (!this.currentUser) return;
        
        console.log('🔄 Updating user interface with:', this.currentUser);
        
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
            // Update profile page with current user data
            setTimeout(() => this.updateProfilePage(), 100);
        }
        
        // Refresh icons after content change
        if (window.feather) feather.replace();
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
                                            <div class="flex space-x-4">
                                                <button id="add-location-btn" class="flex items-center space-x-1 text-orange-400 hover:text-orange-300 transition-colors" onclick="window.authService.addLocation()">
                                                    <i data-feather="map-pin" class="w-5 h-5"></i>
                                                    <span class="text-sm">Add Location</span>
                                                </button>
                                                <span id="location-display" class="text-sm text-green-400 hidden">
                                                    <i data-feather="check-circle" class="w-4 h-4 mr-1"></i>
                                                    Location added
                                                </span>
                                            </div>
                                            <button id="publish-post-btn" class="racing-btn px-6 py-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" disabled>
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

    setLoading(loading) {
        this.isLoading = loading;
        
        // Show/hide loading states
        const buttons = document.querySelectorAll('.auth-btn');
        buttons.forEach(btn => {
            if (loading) {
                btn.disabled = true;
                btn.classList.add('opacity-50');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-50');
            }
        });
    }

    /**
     * Error Handling
     */
    handleAuthError(error) {
        let message = 'Authentication failed';
        let shouldShowToUser = true;
        
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                message = 'Sign in cancelled';
                shouldShowToUser = false; // User closed popup, no need to show error
                break;
            case 'auth/popup-blocked':
                message = 'Popup blocked by browser. Please allow popups for this site.';
                break;
            case 'auth/cancelled-popup-request':
                shouldShowToUser = false; // Normal cancellation, don't show error
                break;
            case 'auth/email-already-in-use':
                message = 'Email already in use';
                break;
            case 'auth/weak-password':
                message = 'Password is too weak (minimum 6 characters)';
                break;
            case 'auth/user-not-found':
                message = 'User not found';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address';
                break;
            case 'auth/network-request-failed':
                message = 'Network error. Please check your internet connection.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many failed attempts. Please try again later.';
                break;
            case 'firestore/unavailable':
                message = 'Service temporarily unavailable. Please try again.';
                break;
            case 'firestore/permission-denied':
                message = 'Access denied. Please sign in again.';
                break;
            default:
                // Don't show internal Firebase errors to user
                if (error.message && error.message.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn('Firebase internal error (suppressed):', error.message);
                    shouldShowToUser = false;
                } else {
                    console.error('Auth error details:', error);
                }
        }
        
        if (shouldShowToUser) {
            this.showError(message);
        }
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
     * Show Edit Profile Modal
     */
    showEditProfileModal() {
        const user = auth.currentUser;
        if (!user) return;

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
                        <button class="text-white hover:text-gray-200" data-action="close-modal">
                            <i data-feather="x" class="w-6 h-6"></i>
                        </button>
                    </div>
                </div>

                <!-- Form -->
                <form id="edit-profile-form" class="p-6">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                            <input 
                                type="text" 
                                id="edit-display-name"
                                value="${user.displayName || ''}"
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none text-white"
                                placeholder="Your display name"
                                maxlength="50"
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
                            ></textarea>
                            <div class="text-xs text-gray-400 mt-1">
                                <span id="bio-count">0</span>/160 characters
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Location</label>
                            <input 
                                type="text" 
                                id="edit-location"
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
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none text-white"
                                placeholder="https://yourwebsite.com"
                                maxlength="100"
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Favorite Racing Series</label>
                            <select 
                                id="edit-racing-series"
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none text-white"
                            >
                                <option value="">Select your favorite...</option>
                                <option value="f1">Formula 1</option>
                                <option value="indycar">IndyCar</option>
                                <option value="nascar">NASCAR</option>
                                <option value="stock-car">Stock Car Brasil</option>
                                <option value="wec">World Endurance Championship</option>
                                <option value="rally">Rally Championship</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <!-- Buttons -->
                    <div class="flex space-x-4 mt-6">
                        <button 
                            type="button" 
                            class="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                            data-action="close-modal"
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
        if (window.feather) feather.replace();

        // Load existing profile data
        this.loadProfileDataIntoForm();

        // Add event listeners
        this.bindEditProfileEvents();
    }

    /**
     * Load existing profile data into edit form
     */
    async loadProfileDataIntoForm() {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                document.getElementById('edit-bio').value = userData.bio || '';
                document.getElementById('edit-location').value = userData.location || '';
                document.getElementById('edit-website').value = userData.website || '';
                document.getElementById('edit-racing-series').value = userData.racingSeries || '';
                
                // Update bio counter
                this.updateBioCounter();
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
        }
    }

    /**
     * Bind edit profile modal events
     */
    bindEditProfileEvents() {
        const modal = document.getElementById('edit-profile-modal');
        if (!modal) return;

        // Bio character counter
        const bioInput = document.getElementById('edit-bio');
        bioInput.addEventListener('input', () => this.updateBioCounter());

        // Form submission
        const form = document.getElementById('edit-profile-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfileChanges();
        });

        // Close modal events
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-action="close-modal"]')) {
                modal.remove();
            }
        });
    }

    /**
     * Update bio character counter
     */
    updateBioCounter() {
        const bioInput = document.getElementById('edit-bio');
        const counter = document.getElementById('bio-count');
        if (bioInput && counter) {
            counter.textContent = bioInput.value.length;
        }
    }

    /**
     * Save profile changes
     */
    async saveProfileChanges() {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const displayName = document.getElementById('edit-display-name').value.trim();
            const bio = document.getElementById('edit-bio').value.trim();
            const location = document.getElementById('edit-location').value.trim();
            const website = document.getElementById('edit-website').value.trim();
            const racingSeries = document.getElementById('edit-racing-series').value;

            // Show loading state
            const submitBtn = document.querySelector('#edit-profile-form button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i data-feather="loader" class="w-4 h-4 mr-2 animate-spin"></i>Saving...';
            submitBtn.disabled = true;

            // Update Firebase Auth profile
            if (displayName && displayName !== user.displayName) {
                await updateProfile(user, { displayName });
            }

            // Update Firestore user document
            const updateData = {
                displayName,
                bio,
                location,
                website,
                racingSeries,
                updatedAt: new Date()
            };

            await updateDoc(doc(db, 'users', user.uid), updateData);

            // Update current user data
            this.currentUser = { ...this.currentUser, ...updateData };

            // Close modal
            const modal = document.getElementById('edit-profile-modal');
            if (modal) modal.remove();

            // Refresh profile page if currently viewing own profile
            if (window.location.hash === `#profile/${user.uid}`) {
                this.showUserProfile(user.uid);
            }

            console.log('Profile updated successfully');

        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Erro ao salvar perfil. Tente novamente.');
            
            // Restore button state
            const submitBtn = document.querySelector('#edit-profile-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Show Settings Modal
     */
    showSettingsModal() {
        const user = auth.currentUser;
        if (!user) return;

        // Remove existing modal if present
        const existingModal = document.getElementById('settings-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4';

        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg relative border border-gray-700">
                <!-- Header -->
                <div class="bg-gradient-to-r from-red-600 to-orange-500 p-6 rounded-t-lg">
                    <div class="flex items-center justify-between">
                        <h2 class="text-xl font-bold text-white flex items-center">
                            <i data-feather="settings" class="w-5 h-5 mr-2"></i>
                            Settings
                        </h2>
                        <button class="text-white hover:text-gray-200" data-action="close-modal">
                            <i data-feather="x" class="w-6 h-6"></i>
                        </button>
                    </div>
                </div>

                <!-- Settings Content -->
                <div class="p-6">
                    <!-- Account Section -->
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                            <i data-feather="user" class="w-4 h-4 mr-2 text-orange-400"></i>
                            Account
                        </h3>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                <div>
                                    <p class="text-white font-medium">Email</p>
                                    <p class="text-gray-400 text-sm">${user.email}</p>
                                </div>
                                <div class="text-green-400">
                                    <i data-feather="check-circle" class="w-5 h-5"></i>
                                </div>
                            </div>
                            <button class="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors" data-action="change-password">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-white font-medium">Change Password</p>
                                        <p class="text-gray-400 text-sm">Update your account password</p>
                                    </div>
                                    <i data-feather="chevron-right" class="w-5 h-5 text-gray-400"></i>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- Notifications system removed for simplification -->

                    <!-- Privacy Section -->
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                            <i data-feather="lock" class="w-4 h-4 mr-2 text-orange-400"></i>
                            Privacy
                        </h3>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                <div>
                                    <p class="text-white font-medium">Private Profile</p>
                                    <p class="text-gray-400 text-sm">Only followers can see your posts</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" class="sr-only peer" id="private-profile">
                                    <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>
                            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                <div>
                                    <p class="text-white font-medium">Show Location</p>
                                    <p class="text-gray-400 text-sm">Display location in your posts</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" class="sr-only peer" id="show-location" checked>
                                    <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Danger Zone -->
                    <div class="border-t border-gray-700 pt-6">
                        <h3 class="text-lg font-semibold text-red-400 mb-4 flex items-center">
                            <i data-feather="alert-triangle" class="w-4 h-4 mr-2"></i>
                            Danger Zone
                        </h3>
                        <div class="space-y-3">
                            <button class="w-full p-3 bg-red-600 hover:bg-red-700 rounded-lg text-left transition-colors" data-action="delete-account">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-white font-medium">Delete Account</p>
                                        <p class="text-red-200 text-sm">Permanently delete your account and all data</p>
                                    </div>
                                    <i data-feather="trash-2" class="w-5 h-5 text-white"></i>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex space-x-4 mt-6 pt-6 border-t border-gray-700">
                        <button 
                            type="button" 
                            class="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                            data-action="close-modal"
                        >
                            Close
                        </button>
                        <button 
                            type="button" 
                            class="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-lg transition-colors font-medium"
                            data-action="save-settings"
                        >
                            <i data-feather="save" class="w-4 h-4 mr-2"></i>
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        if (window.feather) feather.replace();

        // Load existing settings
        this.loadUserSettings();

        // Add event listeners
        this.bindSettingsEvents();
    }

    /**
     * Load user settings
     */
    async loadUserSettings() {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const settings = userData.settings || {};
                
                document.getElementById('follow-notifications').checked = settings.followNotifications !== false;
                document.getElementById('post-notifications').checked = settings.postNotifications !== false;
                document.getElementById('private-profile').checked = settings.privateProfile === true;
                document.getElementById('show-location').checked = settings.showLocation !== false;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Bind settings modal events
     */
    bindSettingsEvents() {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;

        // Close modal events
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-action="close-modal"]')) {
                modal.remove();
            }

            // Save settings
            if (e.target.closest('[data-action="save-settings"]')) {
                this.saveUserSettings();
            }

            // Change password
            if (e.target.closest('[data-action="change-password"]')) {
                alert('Change password functionality will be implemented soon!');
            }

            // Delete account
            if (e.target.closest('[data-action="delete-account"]')) {
                this.confirmDeleteAccount();
            }
        });
    }

    /**
     * Save user settings
     */
    async saveUserSettings() {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const settings = {
                followNotifications: document.getElementById('follow-notifications').checked,
                postNotifications: document.getElementById('post-notifications').checked,
                privateProfile: document.getElementById('private-profile').checked,
                showLocation: document.getElementById('show-location').checked
            };

            await updateDoc(doc(db, 'users', user.uid), { 
                settings,
                updatedAt: new Date()
            });

            // Close modal
            const modal = document.getElementById('settings-modal');
            if (modal) modal.remove();

            console.log('Settings saved successfully');

        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Erro ao salvar configurações. Tente novamente.');
        }
    }

    /**
     * Confirm account deletion
     */
    confirmDeleteAccount() {
        const confirmation = prompt('Type "DELETE" to confirm account deletion:');
        if (confirmation === 'DELETE') {
            alert('Account deletion functionality will be implemented soon!');
        }
    }

    /**
     * Toggle like on post
     */
    async toggleLike(postId, likeBtn) {
        try {
            const user = auth.currentUser;
            if (!user) return;

            // Show loading state
            const icon = likeBtn.querySelector('i');
            const originalIcon = icon.getAttribute('data-feather');
            icon.setAttribute('data-feather', 'loader');
            icon.classList.add('animate-spin');
            if (window.feather) feather.replace();

            // Check if already liked (simplified for now)
            const isLiked = likeBtn.classList.contains('liked');

            if (isLiked) {
                // Unlike
                likeBtn.classList.remove('liked', 'text-red-500');
                likeBtn.classList.add('text-gray-400');
                console.log('Unlike post:', postId);
            } else {
                // Like
                likeBtn.classList.add('liked', 'text-red-500');
                likeBtn.classList.remove('text-gray-400');
                console.log('Like post:', postId);
            }

            // Restore icon
            icon.setAttribute('data-feather', originalIcon);
            icon.classList.remove('animate-spin');
            if (window.feather) feather.replace();

        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }

    /**
     * Show comment modal
     */
    showCommentModal(postId) {
        console.log('Show comments for post:', postId);
        alert('Comment functionality will be implemented soon!');
    }

    /**
     * Update notification badge count
     */
    async updateNotificationBadge() {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        
        const user = auth.currentUser;
        if (!user) {
            badge.classList.add('hidden');
            return;
        }
        
        try {
            const { collection, query, where, getDocs } = await import('../firebase.js');
            
            const notificationsRef = collection(db, 'notifications');
            const unreadQuery = query(
                notificationsRef, 
                where('userId', '==', user.uid),
                where('read', '==', false)
            );
            const snapshot = await getDocs(unreadQuery);
            
            const unreadCount = snapshot.size;
            
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
            
        } catch (error) {
            console.error('Error counting unread notifications:', error);
            badge.classList.add('hidden');
        }
    }

    /**
     * Load notifications
     */
    async loadNotifications() {
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;

        const user = auth.currentUser;
        if (!user) return;

        try {
            // Show loading
            notificationsList.innerHTML = `
                <div class="p-4 text-center">
                    <div class="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p class="text-gray-400 text-sm">Loading notifications...</p>
                </div>
            `;

            const { db, collection, query, where, orderBy, getDocs, limit } = await import('../firebase.js');
            
            const notificationsRef = collection(db, 'notifications');
            const notificationsQuery = query(
                notificationsRef, 
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc'),
                limit(20)
            );
            const snapshot = await getDocs(notificationsQuery);

            if (snapshot.empty) {
                notificationsList.innerHTML = `
                    <div class="p-4 text-center text-gray-400">
                        <i data-feather="bell-off" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                        <p>No notifications yet</p>
                    </div>
                `;
                if (window.feather) feather.replace();
                return;
            }

            // Clear list
            notificationsList.innerHTML = '';

            snapshot.forEach(doc => {
                const notification = doc.data();
                const notificationElement = this.createNotificationElement(notification);
                notificationsList.appendChild(notificationElement);
            });

            if (window.feather) feather.replace();
            
            // Update notification badge after loading
            this.updateNotificationBadge();

        } catch (error) {
            console.error('Error loading notifications:', error);
            notificationsList.innerHTML = `
                <div class="p-4 text-center text-red-400">
                    <i data-feather="alert-circle" class="w-6 h-6 mx-auto mb-2"></i>
                    <p class="text-sm">Error loading notifications</p>
                </div>
            `;
            if (window.feather) feather.replace();
        }
    }

    /**
     * Create notification element
     */
    createNotificationElement(notification) {
        const notificationElement = document.createElement('div');
        notificationElement.className = `p-4 border-b border-gray-700 hover:bg-gray-700 transition-colors ${notification.read ? 'opacity-75' : 'bg-gray-750'}`;
        
        const timeAgo = this.getTimeAgo(notification.createdAt?.toDate?.()?.toISOString() || notification.createdAt);
        
        let icon = 'bell';
        let iconColor = 'text-orange-400';
        
        if (notification.type === 'follow') {
            icon = 'user-plus';
            iconColor = 'text-blue-400';
        } else if (notification.type === 'like') {
            icon = 'heart';
            iconColor = 'text-red-400';
        } else if (notification.type === 'comment') {
            icon = 'message-circle';
            iconColor = 'text-green-400';
        }

        notificationElement.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <i data-feather="${icon}" class="w-5 h-5 ${iconColor}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm">${notification.message}</p>
                    <p class="text-gray-400 text-xs mt-1">${timeAgo}</p>
                </div>
                ${!notification.read ? `
                    <div class="flex-shrink-0">
                        <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
                    </div>
                ` : ''}
            </div>
        `;

        return notificationElement;
    }

    /**
     * Create test notifications (for demonstration)
     */
    async createTestNotifications() {
        const user = auth.currentUser;
        if (!user) return;
        
        try {
            const { db, collection, addDoc } = await import('../firebase.js');
            
            const notificationsCollection = collection(db, 'notifications');
            
            const testNotifications = [
                {
                    userId: user.uid,
                    type: 'follow',
                    message: 'João Silva started following you',
                    read: false,
                    createdAt: new Date()
                },
                {
                    userId: user.uid,
                    type: 'like',
                    message: 'Maria Santos liked your post about F1',
                    read: false,
                    createdAt: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
                },
                {
                    userId: user.uid,
                    type: 'comment',
                    message: 'Pedro Costa commented on your racing update',
                    read: true,
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
                }
            ];
            
            for (const notification of testNotifications) {
                await addDoc(notificationsCollection, notification);
            }
            
            console.log('✅ Test notifications created');
            this.updateNotificationBadge();
            
        } catch (error) {
            console.error('Error creating test notifications:', error);
        }
    }

    /**
     * Delete post
     */
    async deletePost(postId, postElement) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            // Show confirmation
            if (!confirm('Tem certeza que deseja deletar este post?')) {
                return;
            }

            // Show loading state
            const deleteBtn = postElement.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                const originalText = deleteBtn.innerHTML;
                deleteBtn.innerHTML = '<i data-feather="loader" class="w-4 h-4 animate-spin"></i>';
                deleteBtn.disabled = true;
            }

            // Delete from Firebase
            await deleteDoc(doc(db, 'posts', postId));

            // Remove from DOM
            postElement.remove();

            console.log('Post deletado com sucesso');

        } catch (error) {
            console.error('Erro ao deletar post:', error);
            alert('Erro ao deletar o post. Tente novamente.');

            // Restore button state
            const deleteBtn = postElement.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                deleteBtn.innerHTML = '<i data-feather="trash-2" class="w-4 h-4"></i>';
                deleteBtn.disabled = false;
            }
        }
    }
}

// Create global instance
window.authService = new SimpleAuthService();