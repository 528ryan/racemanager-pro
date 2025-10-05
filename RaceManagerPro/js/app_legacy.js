import { StatisticsController } from './statistics.js';
import { SocialController } from './social.js';
import { Championship } from './models/Championship.js';
import { Driver } from './models/Driver.js';
import { Team } from './models/Team.js';
import { Race } from './models/Race.js';
import { db, auth, googleProvider, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, orderBy, signInWithPopup, signOut } from './firebase.js';

const App = {
    initialize: function() {
        this.state = {
            user: null,
            championships: [],
            currentChampionship: null,
            results: {}, // { raceId: { driverId: { ... } } }
            posts: [], // Social media posts
            isLoading: false,
            error: null,
            authInitialized: false // Track if Firebase Auth has been initialized
        };

        this.customPoints = null;
        this.statisticsController = new StatisticsController(this.state);
        this.socialController = new SocialController(this.state, this.statisticsController);
        this.setupModalSystem();
        this.init();
        return this;
    },

    // Sistema de modais moderno sem Bootstrap
    setupModalSystem() {
        this.modalSystem = {
            activeModal: null,
            
            show: (modalId) => {
                const modal = document.getElementById(modalId);
                if (!modal) return;
                
                // Adiciona classes de exibição
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                modal.style.display = 'flex';
                
                // Animação de entrada
                setTimeout(() => {
                    const content = modal.querySelector('.modal-dialog, .modal-content, [class*="modal"]');
                    if (content) {
                        content.style.transform = 'scale(1)';
                        content.style.opacity = '1';
                    }
                }, 10);
                
                this.activeModal = modalId;
                
                // ESC para fechar
                document.addEventListener('keydown', this.handleEscapeKey);
                
                // Clique no backdrop para fechar
                modal.addEventListener('click', this.handleBackdropClick);
            },
            
            hide: (modalId) => {
                const modal = document.getElementById(modalId || this.activeModal);
                if (!modal) return;
                
                const content = modal.querySelector('.modal-dialog, .modal-content, [class*="modal"]');
                if (content) {
                    content.style.transform = 'scale(0.95)';
                    content.style.opacity = '0';
                }
                
                setTimeout(() => {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                    modal.style.display = 'none';
                }, 150);
                
                this.activeModal = null;
                document.removeEventListener('keydown', this.handleEscapeKey);
            },
            
            handleEscapeKey: (e) => {
                if (e.key === 'Escape' && this.modalSystem.activeModal) {
                    this.modalSystem.hide();
                }
            },
            
            handleBackdropClick: (e) => {
                if (e.target === e.currentTarget) {
                    this.modalSystem.hide();
                }
            }
        };
        
        // Setup de botões de fechar
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-dismiss="modal"], .modal-close, .close')) {
                e.preventDefault();
                this.modalSystem.hide();
            }
        });
    },

    showModal(modalId) {
        this.modalSystem.show(modalId);
    },

    hideModal(modalId) {
        this.modalSystem.hide(modalId);
    },

    init: function() {
        console.log('Initializing App');
        try {
            this.bindEventListeners();
            this.loadState(); // Firebase vai chamar render() quando o estado mudar
            
            // Fallback: If auth takes too long, show login screen
            setTimeout(() => {
                if (!this.state.authInitialized) {
                    console.log('⚠️ Auth initialization timeout after 2s, forcing login screen');
                    this.state.authInitialized = true;
                    this.state.user = null; // Ensure no user state
                    localStorage.removeItem('raceManagerProUser'); // Clear any stale data
                    this.render();
                }
            }, 2000);
            
            // Even more aggressive fallback
            setTimeout(() => {
                if (!this.state.authInitialized) {
                    console.log('🚨 CRITICAL: Firebase completely failed, emergency fallback');
                    this.state.authInitialized = true;
                    this.state.user = null;
                    localStorage.removeItem('raceManagerProUser');
                    this.render();
                }
            }, 1000); // 1 second emergency fallback
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error("Error during app initialization:", error);
        }
    },



    loadState: async function() {
        try {
            console.log('🔥 Setting up Firebase Auth listener...');
            
            // Test if Firebase is available
            if (typeof auth === 'undefined') {
                throw new Error('Firebase auth is not available');
            }
            
            console.log('✅ Firebase auth object found:', auth);
            
            // Firebase Auth has persistence by default in web browsers
            
            // Temporarily disable localStorage check to debug Firebase issue
            // Will re-enable after Firebase is working
            console.log('📝 Skipping localStorage check for now to debug Firebase...');
            
            // Check if there's already a current user (for faster UI)
            if (auth.currentUser) {
                console.log('Current user found immediately:', auth.currentUser);
                this.state.authInitialized = true;
            }
            
            // Listen for auth state changes (this will override temporary state if needed)
            console.log('🎧 Setting up auth state listener...');
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                console.log('🔥 Firebase Auth state changed:', user ? 'User logged in' : 'User not logged in', user);
                
                // Mark auth as initialized on first call
                if (!this.state.authInitialized) {
                    this.state.authInitialized = true;
                    console.log('✅ Firebase Auth initialized for the first time');
                } else {
                    console.log('🔄 Firebase Auth state updated');
                }
                
                if (user) {
                    // Update user state with Firebase data (this is the authoritative source)
                    this.state.user = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL
                    };
                    // Persist user to localStorage for faster startup next time
                    localStorage.setItem('raceManagerProUser', JSON.stringify(this.state.user));
                    console.log('Firebase user authenticated, data updated:', this.state.user);
                    await this.loadUserData();
                } else {
                    console.log('No Firebase user, clearing all state');
                    this.state.user = null;
                    this.state.championships = [];
                    this.state.currentChampionship = null;
                    this.state.results = {};
                    // Clear persisted user data
                    localStorage.removeItem('raceManagerProUser');
                }
                // Auth is now initialized
                this.state.authInitialized = true;
                this.render();
            });

            // Load theme preference
            const theme = localStorage.getItem('raceManagerProTheme');
            if (theme) {
                document.documentElement.setAttribute('data-bs-theme', theme);
            }
            
            // Persisted user check was moved to the beginning of the function
        } catch (error) {
            console.error("🚨 Error loading Firebase state:", error);
            // Fallback to no auth state if Firebase fails
            this.state.authInitialized = true;
            this.state.user = null;
            localStorage.removeItem('raceManagerProUser');
            this.render();
        }
    },

    async loadUserData() {
        try {
            // Load user's additional data (following, followers, etc.)
            const userRef = doc(db, 'users', this.state.user.uid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // Update all user data from Firestore
                this.state.user.username = userData.username || this.state.user.username;
                this.state.user.displayName = userData.displayName || this.state.user.displayName;
                this.state.user.photoURL = userData.photoURL || this.state.user.photoURL;
                this.state.user.following = userData.following || [];
                this.state.user.followers = userData.followers || [];
            } else {
                // Create user document if it doesn't exist
                await setDoc(userRef, {
                    uid: this.state.user.uid,
                    email: this.state.user.email,
                    username: this.state.user.username || null,
                    displayName: this.state.user.displayName,
                    photoURL: this.state.user.photoURL,
                    following: [],
                    followers: [],
                    createdAt: new Date()
                });
                this.state.user.following = [];
                this.state.user.followers = [];
            }
            
            // Update counters in the UI
            this.updateFollowingCount();
            
            // Load all championships (user can participate in championships they didn't create)
            const championshipsQuery = query(
                collection(db, 'championships')
            );
            
            // Set up real-time listener for championships
            onSnapshot(championshipsQuery, (snapshot) => {
                this.state.championships = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data
                    };
                });
                
                console.log('📋 Loaded championships:', this.state.championships.length);

                // Update current championship if needed
                if (this.state.currentChampionship) {
                    this.state.currentChampionship = this.state.championships.find(
                        c => c.id === this.state.currentChampionship.id
                    ) || null;
                }

                this.render();
            });

            // Load user posts
            this.loadUserPosts();

            // Load race results
            if (this.state.currentChampionship) {
                const resultsQuery = query(
                    collection(db, 'results'),
                    where('championshipId', '==', this.state.currentChampionship.id)
                );

                onSnapshot(resultsQuery, (snapshot) => {
                    this.state.results = {};
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        if (!this.state.results[data.raceId]) {
                            this.state.results[data.raceId] = {};
                        }
                        this.state.results[data.raceId][data.driverId] = data;
                    });
                    this.render();
                });
            }
        } catch (error) {
            console.error("Error loading user data:", error);
        }
    },

    saveState: async function() {
        try {
            if (!this.state.user) return;

            // Save current championship
            if (this.state.currentChampionship) {
                await setDoc(
                    doc(db, 'championships', this.state.currentChampionship.id),
                    {
                        ...this.state.currentChampionship,
                        userId: this.state.user.uid,
                        lastUpdated: new Date().toISOString()
                    }
                );
            }

            // Save theme preference (keep this in localStorage)
            const theme = document.documentElement.getAttribute('data-bs-theme');
            localStorage.setItem('raceManagerProTheme', theme);
        } catch (error) {
            console.error('Error saving state:', error);
        }
    },

    // Championship Management
    createChampionship: async function(data) {
        try {
            if (!this.state.user) throw new Error('User must be logged in');

            const championship = new Championship(data);
            await setDoc(doc(db, 'championships', championship.id), {
                ...championship,
                userId: this.state.user.uid,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });

            this.state.currentChampionship = championship;
            return championship;
        } catch (error) {
            console.error('Error creating championship:', error);
            throw error;
        }
    },

    updateChampionship: function(id, data) {
        const championship = this.state.championships.find(c => c.id === id);
        if (championship) {
            Object.assign(championship, data);
            this.saveState();
            this.render();
        }
    },

    deleteChampionship: function(id) {
        this.state.championships = this.state.championships.filter(c => c.id !== id);
        if (this.state.currentChampionship?.id === id) {
            this.state.currentChampionship = null;
        }
        this.saveState();
        this.render();
    },

    // Driver Management
    addDriver: async function(data) {
        try {
            if (!this.state.currentChampionship) throw new Error('No championship selected');
            
            const driver = new Driver(data);
            const championship = this.state.currentChampionship;
            championship.drivers.push(driver);

            // Update championship in Firebase
            await updateDoc(doc(db, 'championships', championship.id), {
                drivers: championship.drivers,
                lastUpdated: new Date().toISOString()
            });

            return driver;
        } catch (error) {
            console.error('Error adding driver:', error);
            throw error;
        }
    },

    updateDriver: function(id, data) {
        if (this.state.currentChampionship) {
            const driver = this.state.currentChampionship.drivers.find(d => d.id === id);
            if (driver) {
                driver.updateInfo(data);
                this.saveState();
                this.render();
            }
        }
    },

    removeDriver: function(id) {
        if (this.state.currentChampionship) {
            this.state.currentChampionship.removeDriver(id);
            this.saveState();
            this.render();
        }
    },

    // Team Management
    addTeam: async function(data) {
        try {
            if (!this.state.currentChampionship) throw new Error('No championship selected');
            
            const team = new Team(data);
            const championship = this.state.currentChampionship;
            championship.teams.push(team);

            // Update championship in Firebase
            await updateDoc(doc(db, 'championships', championship.id), {
                teams: championship.teams,
                lastUpdated: new Date().toISOString()
            });

            return team;
        } catch (error) {
            console.error('Error adding team:', error);
            throw error;
        }
    },

    updateTeam: function(id, data) {
        if (this.state.currentChampionship) {
            const team = this.state.currentChampionship.teams.find(t => t.id === id);
            if (team) {
                team.updateInfo(data);
                this.saveState();
                this.render();
            }
        }
    },

    removeTeam: function(id) {
        if (this.state.currentChampionship) {
            this.state.currentChampionship.removeTeam(id);
            this.saveState();
            this.render();
        }
    },

    // Race Management
    addRace: function(data) {
        const race = new Race(data);
        if (this.state.currentChampionship) {
            this.state.currentChampionship.addRace(race);
            this.saveState();
            this.render();
        }
        return race;
    },

    updateRace: function(id, data) {
        if (this.state.currentChampionship) {
            const race = this.state.currentChampionship.races.find(r => r.id === id);
            if (race) {
                race.updateInfo(data);
                this.saveState();
                this.render();
            }
        }
    },

    removeRace: function(id) {
        if (this.state.currentChampionship) {
            this.state.currentChampionship.removeRace(id);
            this.saveState();
            this.render();
        }
    },

    // Results Management
    addRaceResult: async function(raceId, session, driverId, result) {
        try {
            if (!this.state.currentChampionship) throw new Error('No championship selected');
            if (!this.state.user) throw new Error('User must be logged in');

            const race = this.state.currentChampionship.races.find(r => r.id === raceId);
            if (!race) throw new Error('Race not found');

            const resultId = `${raceId}-${driverId}-${session}`;
            await setDoc(doc(db, 'results', resultId), {
                championshipId: this.state.currentChampionship.id,
                raceId,
                driverId,
                session,
                ...result,
                updatedAt: new Date().toISOString()
            });

            // Update race status if needed
            if (session === 'feature') {
                const allDriversHaveResults = this.state.currentChampionship.drivers.every(driver => {
                    return this.state.results[raceId]?.[driver.id]?.feature;
                });

                if (allDriversHaveResults) {
                    race.completed = true;
                    await this.updateChampionship(this.state.currentChampionship.id, {
                        races: this.state.currentChampionship.races
                    });
                }
            }

            this.statisticsController.updateCharts();
        } catch (error) {
            console.error('Error adding race result:', error);
            throw error;
        }
    },

    saveState() {
        try {
            const stateToSave = {
                user: this.state.user,
                championships: this.state.championships,
                results: this.state.results
            };
            localStorage.setItem('raceManagerProState', JSON.stringify(stateToSave));
        } catch (error) {
            console.error("Error saving state to localStorage:", error);
        }
    },

    bindEventListeners() {
        console.log('🎧 Binding event listeners...');
        
        try {
            // Login events
            const googleLoginBtn = document.getElementById('google-login-btn');
            const emailLoginForm = document.getElementById('email-login-form');
            const logoutBtn = document.getElementById('logout-btn');
            
            console.log('Found elements:', { googleLoginBtn, emailLoginForm, logoutBtn });
        
        googleLoginBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Google login button clicked');
            this.signInWithGoogle();
        });
        
        emailLoginForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            console.log('Email login form submitted');
            this.signInWithEmail();
        });
        
        // Sign up form
        document.getElementById('signup-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            console.log('Signup form submitted');
            this.signUpWithEmail();
        });
        
        // Navigation between login and signup
        document.getElementById('show-signup-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignUpScreen();
        });
        
        document.getElementById('show-login-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginScreenFromSignup();
        });

        // Profile setup form
        document.getElementById('profile-setup-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.completeProfileSetup();
        });

        // Back to signup button
        document.getElementById('back-to-signup-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('profile-setup-screen').style.display = 'none';
            document.getElementById('signup-screen').style.display = 'flex';
        });
        
        // Logout event
        logoutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Logout button clicked');
            this.signOut();
        });
        
        // Logout event for new button
        document.addEventListener('click', (e) => {
            if (e.target && (e.target.id === 'logout-btn' || e.target.closest('#logout-btn'))) {
                e.preventDefault();
                console.log('Logout button clicked via delegation');
                this.signOut();
            }
        });
        
        // Social media events
        document.getElementById('publish-post-btn')?.addEventListener('click', () => this.publishPost());
        document.getElementById('load-more-posts')?.addEventListener('click', () => this.loadMorePosts());
        document.getElementById('find-drivers-btn')?.addEventListener('click', () => this.showFindDriversModal());
        document.getElementById('join-championship-btn')?.addEventListener('click', () => this.showJoinChampionship());
        document.getElementById('add-race-result-btn')?.addEventListener('click', () => this.showAddRaceResult());
        
        // Modal events
        document.getElementById('close-championship-modal')?.addEventListener('click', () => this.hideModal('create-championship-modal'));
        document.getElementById('cancel-championship')?.addEventListener('click', () => this.hideModal('create-championship-modal'));
        document.getElementById('championship-form')?.addEventListener('submit', (e) => this.handleCreateChampionship(e));
        
        document.getElementById('close-drivers-modal')?.addEventListener('click', () => this.hideModal('find-drivers-modal'));
        document.getElementById('close-championship-modal')?.addEventListener('click', () => this.hideModal('join-championship-modal'));
        
        // Profile modal events
        document.getElementById('profile-btn')?.addEventListener('click', () => this.showUserProfile(this.state.user.uid));
        document.getElementById('close-profile-modal')?.addEventListener('click', () => this.hideModal('profile-modal'));
        document.getElementById('close-edit-profile-modal')?.addEventListener('click', () => this.hideModal('edit-profile-modal'));
        document.getElementById('cancel-edit-profile')?.addEventListener('click', () => this.hideModal('edit-profile-modal'));
        document.getElementById('edit-profile-form')?.addEventListener('submit', (e) => this.handleEditProfile(e));
        
        // Search drivers events
        document.getElementById('search-drivers-btn')?.addEventListener('click', () => {
            const searchInput = document.getElementById('driver-search');
            if (searchInput) {
                console.log('🔍 Search button clicked, term:', searchInput.value);
                this.performDriverSearch(searchInput.value.trim());
            }
        });
        
        // Enter key on search input
        document.addEventListener('keydown', (e) => {
            if (e.target && e.target.id === 'driver-search' && e.key === 'Enter') {
                e.preventDefault();
                console.log('🔍 Enter pressed, term:', e.target.value);
                this.performDriverSearch(e.target.value.trim());
            }
        });
        
        document.getElementById('close-race-modal')?.addEventListener('click', () => this.hideModal('join-race-modal'));

        document.getElementById('create-championship-btn')?.addEventListener('click', () => this.createNewChampionship());

        document.getElementById('import-championship-btn').addEventListener('click', () => this.importChampionship());
        document.getElementById('export-championship-btn').addEventListener('click', () => this.exportChampionship());

        document.getElementById('championship-search').addEventListener('keyup', (event) => this.filterChampionships(event));

        document.getElementById('sort-by-name').addEventListener('click', () => this.sortChampionships('name'));
        document.getElementById('sort-by-series').addEventListener('click', () => this.sortChampionships('series'));
        document.getElementById('sort-by-season').addEventListener('click', () => this.sortChampionships('season'));

        document.getElementById('championship-series').addEventListener('change', (event) => {
            const series = event.target.value;
            const customPointsBtnContainer = document.getElementById('custom-points-btn-container');
            if (series === 'custom') {
                customPointsBtnContainer.style.display = 'block';
            } else {
                customPointsBtnContainer.style.display = 'none';
            }
        });

        document.getElementById('define-points-btn').addEventListener('click', () => {
            this.showModal('custom-points-modal');
        });

        document.getElementById('save-custom-points-btn').addEventListener('click', () => this.saveCustomPoints());


        document.getElementById('championships-grid').addEventListener('click', (event) => {
            const card = event.target.closest('.championship-card');
            if (card) {
                this.selectChampionship(card.dataset.id);
            }
        });

        // Driver management events
        document.getElementById('add-driver-form').addEventListener('submit', (event) => this.addOrUpdateDriver(event));
        document.getElementById('cancel-edit-driver-btn').addEventListener('click', () => this.cancelEditDriver());

        const driversList = document.getElementById('drivers-list');
        driversList.addEventListener('click', (event) => {
            const editBtn = event.target.closest('.edit-driver-btn');
            if (editBtn) {
                this.editDriver(editBtn.dataset.driverId);
            }

            const deleteBtn = event.target.closest('.delete-driver-btn');
            if (deleteBtn) {
                this.deleteDriver(deleteBtn.dataset.driverId);
            }
        });

        // Race management events
        document.getElementById('save-race-btn').addEventListener('click', () => this.addRace());

        document.body.addEventListener('click', (event) => {
            if (event.target.id === 'manage-drivers-btn') {
                this.showManageDriversModal();
            }
            if (event.target.id === 'add-race-btn') {
                this.showAddRaceModal();
            }
            const raceHubBtn = event.target.closest('.race-hub-btn');
            if (raceHubBtn) {
                this.showRaceHubModal(raceHubBtn.dataset.raceId);
            }
            if (event.target.id === 'share-standings-btn') {
                this.socialController.shareStandings();
            }
            if (event.target.id === 'logout-btn') {
                this.logout();
            }

            if (event.target.id === 'settings-btn') {
                this.showSettingsModal();
            }
            if (event.target.id === 'social-hub-btn') {
                this.showSocialHubModal();
            }
        });

        const raceHubContent = document.getElementById('race-hub-content');
        raceHubContent.addEventListener('click', (event) => {
            if (event.target.id === 'save-race-results-btn') {
                const raceId = event.target.dataset.raceId;
                this.saveRaceResults(raceId);
            }
        });

        document.getElementById('copy-share-text-btn').addEventListener('click', () => {
            const textarea = document.getElementById('share-text');
            textarea.select();
            document.execCommand('copy');
        });

        // Clean up modal backdrops
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('hidden.bs.modal', () => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => backdrop.remove());
            });
        });

        const backToTopBtn = document.getElementById('back-to-top-btn');
        window.onscroll = () => {
            if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
                backToTopBtn.style.display = 'block';
            } else {
                backToTopBtn.style.display = 'none';
            }
        };

            backToTopBtn.addEventListener('click', () => {
                document.body.scrollTop = 0;
                document.documentElement.scrollTop = 0;
            });
        } catch (error) {
            console.error('🚨 Error binding event listeners:', error);
        }
    },

    signInWithGoogle: async function() {
        console.log('Starting Google sign in...');
        try {
            // Configure Google Provider
            googleProvider.setCustomParameters({
                prompt: 'select_account'
            });
            
            console.log('Opening popup for Google sign in...');
            const result = await signInWithPopup(auth, googleProvider);
            const { user } = result;
            
            this.state.user = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
            
            // Set auth as initialized
            this.state.authInitialized = true;
            
            // Show success message
            this.showToast(`Welcome back, ${user.displayName || user.email}!`, 'success');
            
            await this.loadUserData();
            this.render();
        } catch (error) {
            console.error('Error signing in with Google:', error);
            
            // Handle specific error cases
            let errorMessage = 'Login failed. Please try again.';
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                // Don't show error for cancelled popup - user intentionally cancelled
                console.log('Login cancelled by user');
                return;
            } else if (error.code === 'auth/popup-blocked') {
                errorMessage = 'Popup was blocked. Please enable popups for this site.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection.';
            }
            
            this.showToast(errorMessage, 'error');
        }
    },

    signInWithEmail: async function() {
        try {
            const emailOrUsername = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (!emailOrUsername || !password) {
                throw new Error('Please enter both email/username and password');
            }

            // Show loading
            this.showLoginLoading(true);

            let email = emailOrUsername;
            
            // Check if input is username (doesn't contain @)
            if (!emailOrUsername.includes('@')) {
                // Query Firestore to find email by username
                const usernameQuery = query(collection(db, 'users'), where('username', '==', emailOrUsername));
                const usernameSnapshot = await getDocs(usernameQuery);
                
                if (usernameSnapshot.empty) {
                    throw new Error('Username not found');
                }
                
                // Get the email from the user document
                email = usernameSnapshot.docs[0].data().email;
            }

            // Import signInWithEmailAndPassword from Firebase
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js');
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            this.state.user = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
            
            // Set auth as initialized
            this.state.authInitialized = true;
            
            this.showToast(`Welcome back, ${user.email}!`, 'success');
            await this.loadUserData();
            this.render();
        } catch (error) {
            console.error('Error signing in with email:', error);
            
            let errorMessage = 'Login failed. Please check your credentials.';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showToast(errorMessage, 'error');
        } finally {
            this.showLoginLoading(false);
        }
    },

    signOut: async function() {
        try {
            await signOut(auth);
            
            // Clear all state
            this.state.user = null;
            this.state.championships = [];
            this.state.currentChampionship = null;
            this.state.results = {};
            this.state.posts = [];
            
            // Clear localStorage
            localStorage.removeItem('raceManagerProUser');
            
            this.showToast('Logged out successfully', 'success');
            this.render();
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out. Please try again.', 'error');
        }
    },

    showLoginLoading: function(show) {
        const loadingElement = document.getElementById('login-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    },

    showSignUpScreen: function() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('signup-screen').style.display = 'flex';
    },

    showLoginScreenFromSignup: function() {
        document.getElementById('signup-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    },

    async signUpWithEmail() {
        try {
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;

            // Validation
            if (!email || !password) {
                throw new Error('Please fill in all fields');
            }

            if (!this.validatePassword(password)) {
                throw new Error('Password must be at least 6 characters with at least 1 number and 1 letter');
            }

            if (!this.validateEmail(email)) {
                throw new Error('Please enter a valid email address');
            }

            // Show loading
            this.showLoginLoading(true);

            // Import createUserWithEmailAndPassword from Firebase
            const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js');
            
            // Create user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Store temporary user data for profile setup
            this.tempUserData = {
                uid: user.uid,
                email: user.email
            };
            
            // Show profile setup screen
            this.showProfileSetupScreen();
        } catch (error) {
            console.error('Error creating account:', error);
            
            let errorMessage = 'Failed to create account. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email already exists.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please choose a stronger password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showToast(errorMessage, 'error');
        } finally {
            this.showLoginLoading(false);
        }
    },

    showProfileSetupScreen() {
        document.getElementById('signup-screen').style.display = 'none';
        document.getElementById('profile-setup-screen').style.display = 'flex';
        
        // Focus on username input
        setTimeout(() => {
            document.getElementById('setup-username').focus();
        }, 100);
    },

    async completeProfileSetup() {
        try {
            const username = document.getElementById('setup-username').value.trim();
            const displayName = document.getElementById('setup-displayname').value.trim();
            const avatarUrl = document.getElementById('setup-avatar').value.trim();

            // Validation
            if (!username || !displayName) {
                throw new Error('Username and display name are required');
            }

            if (username.length < 3) {
                throw new Error('Username must be at least 3 characters long');
            }

            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                throw new Error('Username can only contain letters, numbers, and underscores');
            }

            // Check if username is already taken
            const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
            const usernameSnapshot = await getDocs(usernameQuery);
            if (!usernameSnapshot.empty) {
                throw new Error('Username @' + username + ' is already taken. Please choose another one.');
            }

            // Show loading
            this.showLoginLoading(true);

            // Import updateProfile from Firebase
            const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js');
            
            // Get current user
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('Authentication session expired');
            }

            // Update profile with display name and avatar
            const profileData = { displayName };
            if (avatarUrl) {
                profileData.photoURL = avatarUrl;
            }
            
            await updateProfile(currentUser, profileData);

            // Create user document in Firestore
            await setDoc(doc(db, 'users', currentUser.uid), {
                uid: currentUser.uid,
                email: currentUser.email,
                username: username,
                displayName: displayName,
                photoURL: avatarUrl || null,
                following: [],
                followers: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Set user state
            this.state.user = {
                uid: currentUser.uid,
                email: currentUser.email,
                username: username,
                displayName: displayName,
                photoURL: avatarUrl || null
            };

            // Set auth as initialized
            this.state.authInitialized = true;
            
            await this.loadUserData();
            this.showToast('Account created successfully! Welcome to RaceManager Pro! 🏁', 'success');
            this.renderInterface();

        } catch (error) {
            console.error('Error completing profile setup:', error);
            this.showToast(error.message, 'error');
        } finally {
            this.showLoginLoading(false);
        }
    },

    validatePassword(password) {
        // At least 6 characters, 1 number, 1 letter
        const minLength = password.length >= 6;
        const hasNumber = /\d/.test(password);
        const hasLetter = /[a-zA-Z]/.test(password);
        return minLength && hasNumber && hasLetter;
    },

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },



    async login(event) {
        event.preventDefault();
        try {
            await this.signInWithGoogle();
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Please try again.');
        }
    },

    async register(event) {
        event.preventDefault();
        try {
            await this.signInWithGoogle();
        } catch (error) {
            console.error('Registration failed:', error);
            alert('Registration failed. Please try again.');
        }
    },

    logout() {
        this.signOut().catch(error => {
            console.error('Logout failed:', error);
            alert('Logout failed. Please try again.');
        });
    },

    showProfile() {
        document.getElementById('championship-selector').style.display = 'none';
        document.getElementById('championship-dashboard').style.display = 'none';
        this.renderProfile();
        document.getElementById('profile-section').style.display = 'block';
    },

    showSettingsModal() {
        const themeSelector = document.getElementById('theme-selector');
        const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
        themeSelector.value = currentTheme;

        themeSelector.addEventListener('change', (event) => {
            const newTheme = event.target.value;
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('raceManagerProTheme', newTheme);
        });

        this.showModal('settings-modal');
    },

    showSocialHubModal() {
        const content = document.getElementById('social-hub-content');
        content.innerHTML = this.socialController.generateActivityFeed();
        this.showModal('social-hub-modal');
    },

    renderProfile() {
        document.getElementById('profile-username').textContent = this.state.user.displayName;
    },

    render: function() {
        console.log('🎯 RENDER CALLED');
        console.log('📋 Current State:', {
            authInitialized: this.state.authInitialized,
            currentUser: !!this.state.user,
            uid: this.state.user?.uid,
            timestamp: new Date().toISOString()
        });
        
        // Show loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = this.state.isLoading ? 'block' : 'none';
        }

        // Show error/success messages
        if (this.state.error) {
            this.showToast(this.state.error, 'danger');
            this.state.error = null;
        }

        const loginScreen = document.getElementById('login-screen');
        const signupScreen = document.getElementById('signup-screen');
        const appContent = document.getElementById('app-content');
        const authLoadingScreen = document.getElementById('auth-loading-screen');
        
        console.log('🔍 DOM Elements found:', {
            loginScreen: !!loginScreen,
            signupScreen: !!signupScreen,
            appContent: !!appContent,
            authLoadingScreen: !!authLoadingScreen
        });

        // Wait for auth to be initialized before showing anything
        if (!this.state.authInitialized) {
            console.log('❌ Auth not initialized yet, showing loading...');
            if (authLoadingScreen) authLoadingScreen.style.display = 'flex';
            if (loginScreen) loginScreen.style.display = 'none';
            if (signupScreen) signupScreen.style.display = 'none';
            if (appContent) appContent.style.display = 'none';
            return;
        }
        
        // Hide loading screen once auth is initialized
        if (authLoadingScreen) authLoadingScreen.style.display = 'none';
        
        console.log('✅ Auth initialized, rendering based on user state:', !!this.state.user);

        if (this.state.user) {
            console.log('✅ User is authenticated, showing social platform');
            if (loginScreen) loginScreen.style.display = 'none';
            if (signupScreen) signupScreen.style.display = 'none';
            if (appContent) {
                appContent.classList.remove('hidden');
                appContent.style.display = 'block';
            }
            
            console.log('🚀 Calling renderUserNav and renderDashboard...');
            this.renderUserNav();
            this.renderDashboard();
            
            // Load suggested drivers with real data
            this.renderSuggestedDrivers();
            
            // Re-initialize Feather icons for the dashboard
            setTimeout(() => {
                console.log('🎨 Refreshing Feather icons...');
                feather.replace();
            }, 100);
        } else {
            console.log('❌ User not authenticated, showing login screen');
            if (loginScreen) loginScreen.style.display = 'flex';
            if (signupScreen) signupScreen.style.display = 'none';
            if (appContent) {
                appContent.classList.add('hidden');
                appContent.style.display = 'none';
            }
        }
        
        // Re-initialize feather icons after render
        setTimeout(() => {
            if (typeof window.refreshIcons === 'function') {
                window.refreshIcons();
            } else if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }, 100);
    },

    showCreateChampionshipModal: function() {
        const modal = document.getElementById('create-championship-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    hideCreateChampionshipModal: function() {
        const modal = document.getElementById('create-championship-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // Reset form
        const form = document.getElementById('championship-form');
        if (form) {
            form.reset();
        }
    },

    showJoinRaceModal: function() {
        this.showToast('Join Race feature coming soon!', 'info');
    },

    showFindDriversModal: function() {
        this.showModal('find-drivers-modal');
        
        // Clear previous search
        const searchInput = document.getElementById('driver-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Show initial empty state
        const container = document.getElementById('drivers-search-results');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-400">
                    <i data-feather="search" class="w-8 h-8 mx-auto mb-2"></i>
                    <p>Search for drivers to connect with</p>
                </div>
            `;
            setTimeout(() => feather.replace(), 100);
        }
    },

    async loadSuggestedDrivers() {
        try {
            // Get users from same championships that user hasn't followed yet
            const userRef = doc(db, 'users', this.state.user.uid);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data();
            const following = userData.following || [];
            
            // Get user's championships to find users from same championships
            const userChampionships = this.state.championships.filter(c => 
                c.drivers && c.drivers.some(d => d.uid === this.state.user.uid)
            );
            
            const suggestedUsers = new Set();
            
            // Find users from same championships
            for (const championship of userChampionships) {
                if (championship.drivers) {
                    championship.drivers.forEach(driver => {
                        if (driver.uid && 
                            driver.uid !== this.state.user.uid && 
                            !following.includes(driver.uid)) {
                            suggestedUsers.add(driver.uid);
                        }
                    });
                }
            }
            
            // Get user details for suggestions
            const suggestions = [];
            for (const userId of suggestedUsers) {
                try {
                    const suggUserRef = doc(db, 'users', userId);
                    const suggUserDoc = await getDoc(suggUserRef);
                    if (suggUserDoc.exists()) {
                        suggestions.push({
                            uid: userId,
                            ...suggUserDoc.data()
                        });
                    }
                } catch (error) {
                    console.log('Error loading suggested user:', userId);
                }
            }
            
            // If no suggestions from championships, get random users
            if (suggestions.length === 0) {
                const allUsersRef = collection(db, 'users');
                const allUsersSnapshot = await getDocs(allUsersRef);
                
                allUsersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    if (userData.uid && 
                        userData.uid !== this.state.user.uid && 
                        !following.includes(userData.uid)) {
                        suggestions.push({
                            uid: userData.uid,
                            ...userData
                        });
                    }
                });
            }
            
            this.renderSuggestedDrivers(suggestions.slice(0, 5)); // Show top 5 suggestions
        } catch (error) {
            console.error('Error loading suggested drivers:', error);
            document.getElementById('drivers-search-results').innerHTML = '<p class="text-gray-400 text-center py-4">Search for drivers by name or email</p>';
        }
    },

    renderSuggestedDrivers(suggestions) {
        const container = document.getElementById('drivers-search-results');
        
        if (suggestions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6">
                    <i data-feather="users" class="w-12 h-12 mx-auto mb-3 text-gray-500"></i>
                    <p class="text-gray-400 mb-3">No suggestions available</p>
                    <p class="text-sm text-gray-500">Join some championships to find drivers to follow!</p>
                </div>
            `;
            setTimeout(() => feather.replace(), 100);
            return;
        }

        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-sm font-medium text-gray-300 mb-3">Suggested for you</h4>
                <div class="space-y-3">
                    ${suggestions.map(driver => `
                        <div class="flex items-center justify-between p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                            <div class="flex items-center space-x-3">
                                <img src="${driver.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.displayName || 'User')}&background=dc2626&color=fff`}" alt="${driver.displayName}" class="w-10 h-10 rounded-full">
                                <div>
                                    <h4 class="font-semibold text-white text-sm">${driver.displayName || driver.username || 'Unknown User'}</h4>
                                    <p class="text-xs text-gray-400">${driver.email || ''}</p>
                                    <p class="text-xs text-gray-500">From your championships</p>
                                </div>
                            </div>
                            <button onclick="App.followUser('${driver.uid}')" class="racing-btn px-3 py-1 text-sm">
                                <i data-feather="user-plus" class="w-4 h-4 inline mr-1"></i>Follow
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="border-t border-gray-600 pt-4">
                <p class="text-sm text-gray-400 mb-2">Or search for specific drivers:</p>
            </div>
        `;

        // Refresh icons
        setTimeout(() => feather.replace(), 100);
    },

    async searchDrivers(searchTerm) {
        console.log('🚀 searchDrivers called with:', searchTerm);
        
        if (!searchTerm || searchTerm.length < 1) {
            console.log('� Empty search term, loading suggestions');
            this.loadSuggestedDrivers();
            return;
        }
        
        console.log('�🔥 Firebase db object:', db);
        console.log('🔥 collection function:', collection);
        console.log('🔥 getDocs function:', getDocs);

        // Show loading state
        const container = document.getElementById('drivers-search-results');
        if (!container) {
            console.error('❌ drivers-search-results container not found!');
            return;
        }
        
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
                <p class="text-gray-400 text-sm">Searching for "${searchTerm}"...</p>
            </div>
        `;

        try {
            console.log('📡 Starting Firebase query...');
            console.log('🔥 Current user state:', this.state.user);
            
            if (!this.state.user || !this.state.user.uid) {
                console.error('❌ No user logged in!');
                container.innerHTML = `<p class="text-red-400 text-center py-4">Please log in to search for drivers</p>`;
                return;
            }
            
            // Get all users and filter locally (simpler approach)
            const usersRef = collection(db, 'users');
            console.log('📡 Created users reference:', usersRef);
            
            const snapshot = await getDocs(usersRef);
            console.log('📡 Firebase query completed successfully');
            console.log('🔍 Total users in database:', snapshot.docs.length);
            
            const results = [];
            
            snapshot.forEach(doc => {
                const userData = doc.data();
                console.log('🔍 Checking user:', {
                    uid: userData.uid,
                    displayName: userData.displayName,
                    username: userData.username,
                    email: userData.email,
                    currentUser: this.state.user.uid
                });
                
                if (userData.uid && userData.uid !== this.state.user.uid) {
                    const displayName = (userData.displayName || '').toLowerCase().trim();
                    const username = (userData.username || '').toLowerCase().trim();
                    const email = (userData.email || '').toLowerCase().trim();
                    const searchLower = searchTerm.toLowerCase().trim();
                    

                    
                    // Search for exact match in name fields
                    const hasDisplayNameMatch = displayName === searchLower;
                    const hasUsernameMatch = username === searchLower;
                    const hasEmailMatch = email === searchLower;
                    
                    if (hasDisplayNameMatch || hasUsernameMatch || hasEmailMatch) {
                        console.log('✅ Match found:', userData.displayName || userData.username);
                        results.push({
                            id: doc.id,
                            ...userData
                        });
                    } else {
                        console.log('❌ No match for:', userData.displayName || userData.username);
                    }
                }
            });

            console.log('Search results:', results.length);
            this.renderSearchResults(results.slice(0, 10));
        } catch (error) {
            console.error('❌ ERROR in searchDrivers:', error);
            console.error('❌ Error details:', error.message, error.stack);
            const container = document.getElementById('drivers-search-results');
            if (container) {
                container.innerHTML = `<p class="text-red-400 text-center py-4">Error searching drivers: ${error.message}</p>`;
            }
        }
    },

    renderSearchResults(drivers) {
        console.log('🎯 renderSearchResults called with:', drivers.length, 'drivers');
        console.log('🎯 Driver data:', drivers);
        const container = document.getElementById('drivers-search-results');
        
        if (!container) {
            console.error('❌ drivers-search-results container not found!');
            return;
        }
        
        if (drivers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6">
                    <i data-feather="search" class="w-12 h-12 mx-auto mb-3 text-gray-500"></i>
                    <p class="text-gray-400">No users found</p>
                    <p class="text-sm text-gray-500">Try a different search term</p>
                </div>
            `;
            setTimeout(() => feather.replace(), 100);
            return;
        }

        container.innerHTML = `
            <div class="space-y-2">
                ${drivers.map(driver => {
                    // Check if already following
                    const isFollowing = this.state.user.following && this.state.user.following.includes(driver.uid);
                    
                    return `
                        <div class="flex items-center justify-between p-3 hover:bg-gray-700 rounded transition-colors cursor-pointer">
                            <div class="flex items-center space-x-3">
                                <img src="${driver.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.displayName || 'User')}&background=dc2626&color=fff`}" alt="${driver.displayName}" class="w-12 h-12 rounded-full ring-2 ring-gray-600">
                                <div>
                                    <h4 class="font-semibold text-white text-sm">${driver.displayName || driver.username || 'Unknown User'}</h4>
                                    <p class="text-xs text-gray-400">${driver.email || ''}</p>
                                    ${driver.bio ? `<p class="text-xs text-gray-500 mt-1">${driver.bio}</p>` : ''}
                                </div>
                            </div>
                            <button 
                                onclick="App.followUser('${driver.uid}')" 
                                class="${isFollowing ? 'bg-gray-600 text-gray-300' : 'racing-btn'} px-4 py-1 text-sm rounded-full transition-colors"
                                ${isFollowing ? 'disabled' : ''}
                            >
                                ${isFollowing ? 'Following' : 'Follow'}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Refresh icons
        setTimeout(() => feather.replace(), 100);
    },

    async performDriverSearch(searchTerm) {
        console.log('🔍 performDriverSearch called with:', `"${searchTerm}"`);
        
        const container = document.getElementById('drivers-search-results');
        if (!container) {
            console.error('❌ Container drivers-search-results not found!');
            return;
        }

        if (!searchTerm || searchTerm.length < 1) {
            console.log('Empty search term');
            container.innerHTML = `
                <div class="text-center py-4 text-gray-400">
                    <i data-feather="search" class="w-8 h-8 mx-auto mb-2"></i>
                    <p>Enter a name to search</p>
                </div>
            `;
            setTimeout(() => feather.replace(), 100);
            return;
        }

        // Show loading
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
                <p class="text-gray-400 text-sm">Searching for "${searchTerm}"...</p>
            </div>
        `;

        try {
            console.log('🔥 Starting Firebase query...');
            
            // Get all users
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            
            console.log('📊 Firebase query completed. Users found:', snapshot.docs.length);
            
            const results = [];
            const searchLower = searchTerm.toLowerCase().trim();
            
            snapshot.forEach(doc => {
                const userData = doc.data();
                
                // Skip current user
                if (userData.uid === this.state.user.uid) {
                    return;
                }
                
                console.log('👤 Checking user:', {
                    uid: userData.uid,
                    displayName: userData.displayName,
                    username: userData.username,
                    email: userData.email
                });
                
                const displayName = (userData.displayName || '').toLowerCase().trim();
                const username = (userData.username || '').toLowerCase().trim();
                
                console.log('🔍 Comparing:', {
                    searchTerm: `"${searchLower}"`,
                    displayName: `"${displayName}"`,
                    username: `"${username}"`,
                    displayMatch: displayName === searchLower,
                    usernameMatch: username === searchLower
                });
                
                if (displayName === searchLower || username === searchLower) {
                    console.log('✅ MATCH FOUND!', userData.displayName || userData.username);
                    results.push({
                        id: doc.id,
                        ...userData
                    });
                }
            });
            
            console.log('🎯 Final results:', results.length, results);
            this.renderSearchResults(results);
            
        } catch (error) {
            console.error('❌ Error in search:', error);
            container.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-red-400">Error: ${error.message}</p>
                </div>
            `;
        }
    },

    async followUser(userId) {
        console.log('🔄 Following user:', userId);
        
        // Find the button that was clicked
        const followButton = document.querySelector(`button[onclick="App.followUser('${userId}')"]`);
        
        if (followButton) {
            // Update button immediately to show loading state
            followButton.textContent = 'Following...';
            followButton.disabled = true;
            followButton.className = 'bg-gray-600 text-gray-300 px-4 py-1 text-sm rounded-full transition-colors';
        }
        
        try {
            // Update current user's following list
            const userRef = doc(db, 'users', this.state.user.uid);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data();
            const following = userData.following || [];
            
            if (following.includes(userId)) {
                console.log('Already following this user');
                return;
            }
            
            // Add to following list
            following.push(userId);
            await updateDoc(userRef, { following });
            
            // Update local state immediately
            if (!this.state.user.following) this.state.user.following = [];
            this.state.user.following.push(userId);
            
            // Update follower's followers list
            const followerRef = doc(db, 'users', userId);
            const followerDoc = await getDoc(followerRef);
            if (followerDoc.exists()) {
                const followerData = followerDoc.data();
                const followers = followerData.followers || [];
                
                if (!followers.includes(this.state.user.uid)) {
                    followers.push(this.state.user.uid);
                    await updateDoc(followerRef, { followers });
                }
            }
            
            // Update button to final state
            if (followButton) {
                followButton.textContent = 'Following';
                followButton.className = 'bg-gray-600 text-gray-300 px-4 py-1 text-sm rounded-full transition-colors';
                followButton.disabled = true;
            }
            
            // Update following count in profile if visible
            this.updateFollowingCount();
            
            this.showToast('User followed successfully!', 'success');
            
            console.log('✅ Successfully followed user');
            
        } catch (error) {
            console.error('❌ Error following user:', error);
            
            // Reset button on error
            if (followButton) {
                followButton.textContent = 'Follow';
                followButton.disabled = false;
                followButton.className = 'racing-btn px-4 py-1 text-sm rounded-full transition-colors';
            }
            
            this.showToast('Failed to follow user', 'error');
        }
    },

    updateFollowingCount() {
        // Update following count in user stats
        const followingCountElement = document.getElementById('user-following-count');
        if (followingCountElement && this.state.user.following) {
            followingCountElement.textContent = this.state.user.following.length;
            console.log('📊 Updated following count to:', this.state.user.following.length);
        }
        
        // Update followers count (this should be updated when someone follows the user)
        const followersCountElement = document.getElementById('user-followers-count');
        if (followersCountElement && this.state.user.followers) {
            followersCountElement.textContent = this.state.user.followers.length;
            console.log('📊 Updated followers count to:', this.state.user.followers.length);
        }
    },

    async showUserProfile(userId) {
        console.log('👤 Showing profile for user:', userId);
        console.log('👤 Available user data:', this.state.user);
        
        try {
            // Get user data
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                this.showToast('User not found', 'error');
                return;
            }
            
            const userData = userDoc.data();
            const isOwnProfile = userId === this.state.user.uid;
            
            // Get user's posts (simplified query to avoid index requirement)
            const postsQuery = query(
                collection(db, 'posts'),
                where('userId', '==', userId)
            );
            
            const postsSnapshot = await getDocs(postsQuery);
            let userPosts = postsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Sort posts by date manually
            userPosts.sort((a, b) => {
                const dateA = a.timestamp?.seconds ? new Date(a.timestamp.seconds * 1000) : new Date(a.timestamp);
                const dateB = b.timestamp?.seconds ? new Date(b.timestamp.seconds * 1000) : new Date(b.timestamp);
                return dateB - dateA;
            });
            
            // Render profile modal
            const profileContent = document.getElementById('profile-modal-content');
            if (!profileContent) {
                console.error('Profile modal content not found');
                this.showToast('Profile modal not found', 'error');
                return;
            }

            let postsHtml = '';
            try {
                if (userPosts.length > 0) {
                    console.log('📝 Rendering posts for profile:', userPosts.length);
                    postsHtml = userPosts.map(post => {
                        try {
                            return this.renderProfilePost(post, isOwnProfile);
                        } catch (postError) {
                            console.error('Error rendering post:', post.id, postError);
                            return `<div class="text-red-400 p-2">Error rendering post</div>`;
                        }
                    }).join('');
                } else {
                    postsHtml = '<div class="text-center py-8 text-gray-400">No posts yet</div>';
                }
            } catch (postsError) {
                console.error('Error processing posts:', postsError);
                postsHtml = '<div class="text-center py-8 text-red-400">Error loading posts</div>';
            }

            profileContent.innerHTML = `
                <div class="text-center mb-6">
                    <img src="${userData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.displayName || 'User')}&background=dc2626&color=fff`}" 
                         alt="${userData.displayName}" 
                         class="w-24 h-24 rounded-full mx-auto mb-4 ring-4 ring-red-500">
                    <h2 class="text-2xl font-bold text-white">${userData.displayName || userData.username || 'Unknown User'}</h2>
                    ${userData.bio ? `<p class="text-gray-400 mt-2">${userData.bio}</p>` : ''}
                    ${userData.location ? `<p class="text-gray-500 text-sm mt-1"><i data-feather="map-pin" class="w-4 h-4 inline mr-1"></i>${userData.location}</p>` : ''}
                    
                    <div class="flex justify-center gap-6 mt-4 text-sm">
                        <div class="text-center">
                            <div class="text-white font-bold">${userPosts.length}</div>
                            <div class="text-gray-400">Posts</div>
                        </div>
                        <div class="text-center">
                            <div class="text-white font-bold">${(userData.followers || []).length}</div>
                            <div class="text-gray-400">Followers</div>
                        </div>
                        <div class="text-center">
                            <div class="text-white font-bold">${(userData.following || []).length}</div>
                            <div class="text-gray-400">Following</div>
                        </div>
                    </div>
                    
                    ${isOwnProfile ? `
                        <button onclick="App.showEditProfile()" class="mt-4 racing-btn px-4 py-2 text-sm">
                            <i data-feather="edit-2" class="w-4 h-4 inline mr-1"></i>
                            Edit Profile
                        </button>
                    ` : `
                        <button onclick="App.followUser('${userId}')" 
                                class="${this.state.user.following && this.state.user.following.includes(userId) ? 'bg-gray-600 text-gray-300' : 'racing-btn'} mt-4 px-4 py-2 text-sm rounded-full transition-colors"
                                ${this.state.user.following && this.state.user.following.includes(userId) ? 'disabled' : ''}>
                            ${this.state.user.following && this.state.user.following.includes(userId) ? 'Following' : 'Follow'}
                        </button>
                    `}
                </div>
                
                <div class="border-t border-gray-700 pt-6">
                    <h3 class="text-lg font-semibold mb-4">Posts (${userPosts.length})</h3>
                    <div id="profile-posts" class="space-y-4">
                        ${postsHtml}
                    </div>
                </div>
            `;
            
            this.showModal('profile-modal');
            
            // Refresh icons
            setTimeout(() => feather.replace(), 100);
            
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showToast('Error loading profile', 'error');
        }
    },

    renderProfilePost(post, isOwnPost) {
        const timeAgo = this.getTimeAgo(post.timestamp);
        const isLiked = post.likedBy && post.likedBy.includes(this.state.user.uid);
        
        return `
            <div class="glass-card p-4">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center space-x-3">
                        <img src="${post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=dc2626&color=fff`}" alt="${post.author}" class="w-10 h-10 rounded-full ring-2 ring-gray-600">
                        <div>
                            <h4 class="font-semibold text-white text-sm">${post.author}</h4>
                            <p class="text-xs text-gray-400">${timeAgo}</p>
                        </div>
                    </div>
                    ${isOwnPost ? `
                        <button onclick="App.deletePost('${post.id}')" class="text-gray-400 hover:text-red-400 transition-colors">
                            <i data-feather="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                </div>
                
                <div class="mb-3">
                    <p class="text-white">${post.content}</p>
                    ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Post image" class="mt-2 rounded-lg max-w-full">` : ''}
                </div>
                
                <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center space-x-4">
                        <button onclick="App.toggleLike('${post.id}')" class="flex items-center space-x-1 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'} transition-colors">
                            <i data-feather="heart" class="w-4 h-4 ${isLiked ? 'fill-current' : ''}"></i>
                            <span>${post.likes || 0}</span>
                        </button>
                        <button onclick="App.toggleComments('${post.id}')" class="flex items-center space-x-1 text-gray-400 hover:text-blue-500 transition-colors">
                            <i data-feather="message-circle" class="w-4 h-4"></i>
                            <span>${post.comments ? post.comments.length : 0}</span>
                        </button>
                    </div>
                </div>
                
                <!-- Comments section -->
                <div id="comments-${post.id}" class="hidden mt-4 border-t border-gray-700 pt-3">
                    <div class="space-y-2 mb-3" id="comments-list-${post.id}">
                        ${post.comments ? post.comments.map(comment => `
                            <div class="flex items-start space-x-2 text-sm">
                                <img src="${comment.authorPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=dc2626&color=fff`}" alt="${comment.authorName}" class="w-6 h-6 rounded-full">
                                <div class="flex-1">
                                    <span class="font-semibold text-white">${comment.authorName}</span>
                                    <span class="text-gray-300 ml-2">${comment.content}</span>
                                    ${comment.authorId === this.state.user.uid ? `
                                        <button onclick="App.deleteComment('${post.id}', '${comment.id}')" class="ml-2 text-gray-500 hover:text-red-400 text-xs">
                                            <i data-feather="x" class="w-3 h-3"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('') : ''}
                    </div>
                    <div class="flex space-x-2">
                        <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." 
                               class="flex-1 px-3 py-1 bg-gray-800 border border-gray-600 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none">
                        <button onclick="App.addComment('${post.id}')" class="racing-btn px-3 py-1 text-xs">Post</button>
                    </div>
                </div>
            </div>
        `;
    },

    showEditProfile() {
        // Populate form with current user data
        document.getElementById('edit-display-name').value = this.state.user.displayName || '';
        document.getElementById('edit-bio').value = this.state.user.bio || '';
        document.getElementById('edit-location').value = this.state.user.location || '';
        
        this.hideModal('profile-modal');
        this.showModal('edit-profile-modal');
    },

    async handleEditProfile(event) {
        event.preventDefault();
        
        const displayName = document.getElementById('edit-display-name').value.trim();
        const bio = document.getElementById('edit-bio').value.trim();
        const location = document.getElementById('edit-location').value.trim();
        
        try {
            // Update user document
            const userRef = doc(db, 'users', this.state.user.uid);
            await updateDoc(userRef, {
                displayName,
                bio,
                location,
                updatedAt: new Date()
            });
            
            // Update local state
            this.state.user.displayName = displayName;
            this.state.user.bio = bio;
            this.state.user.location = location;
            
            this.hideModal('edit-profile-modal');
            this.showToast('Profile updated successfully!', 'success');
            
            // Update navigation display
            this.renderUserNav();
            
            // Refresh the profile if it's open
            this.showUserProfile(this.state.user.uid);
            
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showToast('Failed to update profile', 'error');
        }
    },

    loadMorePosts: function() {
        console.log('Loading more posts...');
        this.showToast('Loading more posts...', 'info');
        // TODO: Implement pagination for posts
    },

    // Modal management methods
    hideModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    showModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    // Championship creation methods
    createNewChampionship: function() {
        this.showModal('create-championship-modal');
    },

    handleCreateChampionship: async function(event) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            let maxDrivers = formData.get('maxDrivers');
            if (maxDrivers === 'custom') {
                maxDrivers = parseInt(formData.get('customMaxDrivers')) || 20;
            } else {
                maxDrivers = parseInt(maxDrivers) || 20;
            }
            
            const championshipData = {
                name: formData.get('name'),
                series: formData.get('series'),
                season: formData.get('season'),
                description: formData.get('description'),
                maxDrivers: maxDrivers,
                requireApproval: formData.get('requireApproval') === 'on',
                isPublic: formData.get('isPublic') === 'on',
                registrations: [], // Pending driver registrations
                rejectedUsers: [] // Users who were rejected
            };

            console.log('Creating championship:', championshipData);
            
            const championship = await this.createChampionship(championshipData);
            this.showToast(`Championship "${championship.name}" created successfully!`, 'success');
            this.hideModal('create-championship-modal');
            
            // Refresh the dashboard to show the new championship
            this.renderDashboard();
            
        } catch (error) {
            console.error('Error creating championship:', error);
            this.showToast('Failed to create championship. Please try again.', 'error');
        }
    },

    // Social features
    showFindDrivers: function() {
        this.showToast('Find Drivers feature coming soon!', 'info');
    },

    showJoinChampionship: function() {
        this.showModal('join-championship-modal');
        this.loadAvailableChampionships();
    },

    loadMorePosts: function() {
        console.log('Loading more posts...');
        this.showToast('Loading more posts...', 'info');
        // TODO: Implement pagination for posts
    },

    searchDrivers: function(searchTerm) {
        console.log('Searching drivers:', searchTerm);
        // TODO: Implement driver search
    },

    // Championship management
    importChampionship: function() {
        this.showToast('Import Championship feature coming soon!', 'info');
    },

    exportChampionship: function() {
        this.showToast('Export Championship feature coming soon!', 'info');
    },

    filterChampionships: function(event) {
        const searchTerm = event.target.value.toLowerCase();
        console.log('Filtering championships:', searchTerm);
        // TODO: Implement championship filtering
    },

    sortChampionships: function(field) {
        console.log('Sorting championships by:', field);
        // TODO: Implement championship sorting
    },

    selectChampionship: function(id) {
        console.log('Selecting championship:', id);
        const championship = this.state.championships.find(c => c.id === id);
        if (championship) {
            this.state.currentChampionship = championship;
            this.render();
        }
    },

    saveCustomPoints: function() {
        this.showToast('Custom points system saved!', 'success');
        // TODO: Implement custom points system
    },

    // Driver and race management
    addOrUpdateDriver: function(event) {
        event.preventDefault();
        console.log('Adding/updating driver');
        this.showToast('Use the championship creation to add drivers!', 'info');
    },

    async addDriverToChampionship(championshipId, driverData) {
        try {
            const championship = this.state.championships.find(c => c.id === championshipId);
            if (!championship) throw new Error('Championship not found');

            const newDriver = {
                id: Date.now().toString(),
                name: driverData.name,
                team: driverData.team || '',
                number: driverData.number || '',
                points: 0,
                wins: 0,
                podiums: 0
            };

            if (!championship.drivers) championship.drivers = [];
            championship.drivers.push(newDriver);

            // Update in Firebase
            await updateDoc(doc(db, 'championships', championshipId), {
                drivers: championship.drivers,
                lastUpdated: new Date().toISOString()
            });

            this.showToast(`Driver ${newDriver.name} added successfully!`, 'success');
            return newDriver;
            
        } catch (error) {
            console.error('Error adding driver:', error);
            this.showToast('Failed to add driver', 'error');
            throw error;
        }
    },

    async addRaceToChampionship(championshipId, raceData) {
        try {
            const championship = this.state.championships.find(c => c.id === championshipId);
            if (!championship) throw new Error('Championship not found');

            const newRace = {
                id: Date.now().toString(),
                name: raceData.name,
                track: raceData.track || '',
                date: raceData.date || new Date().toISOString(),
                status: 'scheduled', // scheduled, ongoing, completed
                results: []
            };

            if (!championship.races) championship.races = [];
            championship.races.push(newRace);

            // Update in Firebase
            await updateDoc(doc(db, 'championships', championshipId), {
                races: championship.races,
                lastUpdated: new Date().toISOString()
            });

            this.showToast(`Race "${newRace.name}" added successfully!`, 'success');
            return newRace;
            
        } catch (error) {
            console.error('Error adding race:', error);
            this.showToast('Failed to add race', 'error');
            throw error;
        }
    },

    showChampionshipDetails(championshipId) {
        const championship = this.state.championships.find(c => c.id === championshipId);
        if (!championship) return;

        // Create detailed championship view modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h2 class="text-2xl font-bold text-white">${championship.name}</h2>
                            <p class="text-gray-400">${championship.series} • ${championship.season}</p>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                            <i data-feather="x" class="w-6 h-6"></i>
                        </button>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Drivers Section -->
                        <div>
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-lg font-semibold">Drivers (${championship.drivers?.length || 0}/${championship.maxDrivers || 20})</h3>
                                <div class="flex space-x-2">
                                    ${championship.userId === this.state.user?.uid ? `
                                        <button onclick="App.showAddDriverModal('${championship.id}')" class="text-xs racing-btn px-3 py-1">
                                            Add Driver
                                        </button>
                                    ` : `
                                        <button onclick="App.requestToJoin('${championship.id}')" class="text-xs racing-btn px-3 py-1">
                                            ${championship.registrations?.find(r => r.userId === this.state.user?.uid) ? 'Pending...' : 'Request to Join'}
                                        </button>
                                    `}
                                </div>
                            </div>
                            
                            ${championship.userId === this.state.user?.uid && championship.registrations?.length > 0 ? `
                                <div class="mb-4 p-3 bg-yellow-900 border border-yellow-600 rounded">
                                    <h4 class="text-sm font-medium text-yellow-200 mb-2">Pending Registrations (${championship.registrations.length})</h4>
                                    <div class="space-y-2 max-h-32 overflow-y-auto">
                                        ${championship.registrations.map(reg => `
                                            <div class="flex justify-between items-center text-sm">
                                                <span class="text-yellow-100">${reg.driverName}</span>
                                                <div class="flex space-x-1">
                                                    <button onclick="App.approveRegistration('${championship.id}', '${reg.userId}')" class="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded">
                                                        Approve
                                                    </button>
                                                    <button onclick="App.rejectRegistration('${championship.id}', '${reg.userId}')" class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded">
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="space-y-2 max-h-64 overflow-y-auto">
                                ${championship.drivers ? championship.drivers.map(driver => `
                                    <div class="p-3 bg-gray-800 rounded border-l-4 border-red-500">
                                        <div class="flex justify-between items-center">
                                            <div>
                                                <p class="font-medium text-white">${driver.name}</p>
                                                <p class="text-sm text-gray-400">${driver.team || 'No Team'} ${driver.number ? `#${driver.number}` : ''}</p>
                                            </div>
                                            <div class="text-right">
                                                <p class="text-sm font-medium text-white">${driver.points || 0} pts</p>
                                                <p class="text-xs text-gray-400">${driver.wins || 0} wins</p>
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : '<p class="text-gray-400 text-center py-4">No drivers yet</p>'}
                            </div>
                        </div>

                        <!-- Races Section -->
                        <div>
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-lg font-semibold">Races (${championship.races?.length || 0})</h3>
                                ${championship.ownerId === this.state.user.uid ? `
                                    <button onclick="App.showAddRaceModal('${championship.id}')" class="text-xs racing-btn px-3 py-1">
                                        Add Race
                                    </button>
                                ` : ''}
                            </div>
                            
                            <div class="space-y-2 max-h-64 overflow-y-auto">
                                ${championship.races ? championship.races.map(race => `
                                    <div class="p-3 bg-gray-800 rounded border-l-4 ${race.status === 'completed' ? 'border-green-500' : race.status === 'ongoing' ? 'border-yellow-500' : 'border-blue-500'}">
                                        <div class="flex justify-between items-start">
                                            <div class="flex-1">
                                                <div class="flex items-center gap-2 mb-1">
                                                    <h4 class="font-medium text-white">${race.name}</h4>
                                                    <span class="text-xs px-2 py-1 rounded ${race.status === 'completed' ? 'bg-green-600' : race.status === 'ongoing' ? 'bg-yellow-600' : 'bg-gray-600'} text-white">
                                                        ${race.status || 'scheduled'}
                                                    </span>
                                                </div>
                                                <p class="text-sm text-gray-400 mb-1">
                                                    <i data-feather="map-pin" class="w-3 h-3 inline mr-1"></i>
                                                    ${race.track || 'Track TBD'}
                                                </p>
                                                <p class="text-xs text-gray-500">
                                                    <i data-feather="calendar" class="w-3 h-3 inline mr-1"></i>
                                                    ${race.date || 'Date TBD'}
                                                </p>
                                                ${race.participants ? `
                                                    <p class="text-xs text-gray-400 mt-1">
                                                        <i data-feather="users" class="w-3 h-3 inline mr-1"></i>
                                                        ${race.participants.length} participants
                                                    </p>
                                                ` : ''}
                                            </div>
                                            
                                            <div class="flex flex-col items-end gap-1 ml-3">
                                                ${championship.ownerId === this.state.user.uid ? `
                                                    <button onclick="App.manageRace('${championship.id}', '${race.id}')" class="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors">
                                                        <i data-feather="settings" class="w-3 h-3 inline mr-1"></i>
                                                        Manage
                                                    </button>
                                                ` : `
                                                    <button onclick="App.viewRaceDetails('${championship.id}', '${race.id}')" class="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-white transition-colors">
                                                        <i data-feather="eye" class="w-3 h-3 inline mr-1"></i>
                                                        View
                                                    </button>
                                                `}
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : '<p class="text-gray-400 text-center py-4">No races yet</p>'}
                            </div>
                        </div>
                    </div>

                    ${championship.description ? `
                        <div class="mt-6 pt-6 border-t border-gray-700">
                            <h4 class="font-medium mb-2">Description</h4>
                            <p class="text-gray-300">${championship.description}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => feather.replace(), 100);
    },

    showAddDriverModal(championshipId) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="glass-card p-6 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Add Driver</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                        <i data-feather="x" class="w-5 h-5"></i>
                    </button>
                </div>
                
                <form id="add-driver-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Driver Name *</label>
                        <input type="text" name="name" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="e.g., Lewis Hamilton" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Team</label>
                        <input type="text" name="team" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="e.g., Mercedes">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Car Number</label>
                        <input type="number" name="number" min="1" max="999" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="44">
                    </div>
                    
                    <div class="flex space-x-2">
                        <button type="button" onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" class="flex-1 racing-btn px-4 py-2">
                            Add Driver
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#add-driver-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                await this.addDriverToChampionship(championshipId, {
                    name: formData.get('name'),
                    team: formData.get('team'),
                    number: formData.get('number')
                });
                modal.remove();
            } catch (error) {
                // Error already handled in addDriverToChampionship
            }
        });
        
        setTimeout(() => feather.replace(), 100);
    },

    showAddRaceModal(championshipId) {
        // Store championship ID for form submission
        this.currentChampionshipId = championshipId;
        
        // Clear form and show modal
        document.getElementById('add-race-form').reset();
        this.showModal('add-race-modal');
        
        // Set up form handler once
        const form = document.getElementById('add-race-form');
        form.onsubmit = (e) => this.handleAddRace(e, championshipId);
    },

    async handleAddRace(event, championshipId) {
        event.preventDefault();
        
        const raceName = document.getElementById('race-name').value;
        const raceDate = document.getElementById('race-date').value;
        const raceLocation = document.getElementById('race-location').value;

        if (!raceName || !raceDate) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            await this.addRaceToChampionship(championshipId, {
                name: raceName,
                date: raceDate,
                location: raceLocation || '',
                status: 'upcoming'
            });

            // Hide modal and reset form
            this.hideModal('add-race-modal');
            document.getElementById('add-race-form').reset();
            
            // Refresh championship view
            this.loadChampionships();
            
            this.showToast('Race added successfully!', 'success');
        } catch (error) {
            console.error('Error adding race:', error);
            alert('Failed to add race. Please try again.');
        }
    },

    showToast: function(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            // Create container if it doesn't exist
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-20 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const colors = {
            success: 'bg-green-600',
            danger: 'bg-red-600',
            warning: 'bg-yellow-600',
            info: 'bg-blue-600'
        };
        
        toast.className = `${colors[type] || colors.info} text-white p-4 rounded-lg shadow-lg mb-2 transform translate-x-full transition-transform duration-300`;
        toast.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-300">
                    ×
                </button>
            </div>
        `;
        
        document.getElementById('toast-container').appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    },

    renderUserNav() {
        const userName = document.getElementById('user-name');
        if (this.state.user && userName) {
            const displayText = this.state.user.displayName || this.state.user.email;
            const usernameText = this.state.user.username ? ` @${this.state.user.username}` : '';
            userName.innerHTML = `${displayText}<span class="text-gray-400 text-sm ml-1">${usernameText}</span>`;
        }
    },

    renderDashboard() {
        console.log('Rendering dashboard...');
        
        // Quick test to see if main element exists
        const main = document.querySelector('main');
        console.log('Main element found:', !!main);
        
        try {
            this.renderUserProfile();
            this.renderSocialFeed();
            this.renderTrendingChampionships();
            this.renderSuggestedDrivers();
            this.renderActiveChampionships();
            console.log('Dashboard rendered successfully');
        } catch (error) {
            console.error('Error rendering dashboard:', error);
        }
    },

    renderChampionshipsList() {
        const championshipsList = document.getElementById('championships-list');
        if (!championshipsList) return;

        if (this.state.championships.length === 0) {
            championshipsList.innerHTML = '<p class="text-gray-400">No championships found</p>';
        } else {
            championshipsList.innerHTML = this.state.championships.map(championship => `
                <div class="mb-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors" 
                     onclick="App.selectChampionship('${championship.id}')">
                    <h5 class="text-sm font-semibold text-white">${championship.name}</h5>
                    <p class="text-xs text-gray-400">${championship.series || 'No series'} • ${championship.season || 'No season'}</p>
                </div>
            `).join('');
        }
    },

    renderRecentRaces() {
        const recentRaces = document.getElementById('recent-races');
        if (!recentRaces) return;
        
        // Placeholder for now
        recentRaces.innerHTML = '<p class="text-gray-400">No recent races</p>';
    },

    renderStats() {
        const statsOverview = document.getElementById('stats-overview');
        if (!statsOverview) return;
        
        // Placeholder for now
        statsOverview.innerHTML = `
            <div class="text-sm">
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Championships:</span>
                    <span class="text-white">${this.state.championships.length}</span>
                </div>
            </div>
        `;
    },

    renderChampionshipSelector() {
        const championshipsGrid = document.getElementById('championships-grid');
        championshipsGrid.innerHTML = '';

        // Add action buttons
        const actionButtons = document.createElement('div');
        actionButtons.className = 'row mb-4';
        actionButtons.innerHTML = `
            <div class="col-12 d-flex justify-content-between align-items-center">
                <div>
                    <button class="btn btn-primary me-2" id="create-championship-btn">
                        <i class="bi bi-plus-lg me-2"></i>Create Championship
                    </button>
                    <button class="btn btn-outline-primary me-2" id="import-championship-btn">
                        <i class="bi bi-upload me-2"></i>Import
                    </button>
                </div>
                <div class="d-flex align-items-center">
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" id="championship-search" placeholder="Search championships...">
                    </div>
                </div>
            </div>
        `;
        championshipsGrid.appendChild(actionButtons);

        // Championships grid
        const grid = document.getElementById('championships-grid');
        if (!grid) return;

        if (this.state.championships.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full">
                    <div class="text-center p-12 glass-effect rounded-xl">
                        <i data-feather="trophy" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                        <h3 class="text-2xl font-bold text-white mb-4">No Championships Yet</h3>
                        <p class="text-gray-400 mb-6">Create your first championship to get started!</p>
                        <button class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full smooth-transition create-championship-btn">
                            <i data-feather="plus" class="w-5 h-5 inline mr-2"></i>Create Championship
                        </button>
                    </div>
                </div>
            `;
        } else {
            grid.innerHTML = '';
            this.state.championships.forEach(champ => {
                const card = document.createElement('div');
                card.className = 'championship-card';
                const completedRaces = champ.races ? champ.races.filter(r => r.completed).length : 0;
                const totalRaces = champ.races ? champ.races.length : 0;
                const statusColor = completedRaces === totalRaces && totalRaces > 0 ? 'green' : completedRaces > 0 ? 'yellow' : 'gray';
                
                card.innerHTML = `
                    <div class="glass-effect rounded-xl overflow-hidden shadow-xl smooth-transition hover:shadow-2xl hover:-translate-y-2">
                        <div class="relative p-6">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="text-xl font-bold text-white mb-1">${champ.name}</h3>
                                    <p class="text-gray-400 text-sm">${champ.series || 'Custom'} - ${champ.season || new Date().getFullYear()}</p>
                                </div>
                                <div class="flex items-center space-x-1">
                                    <div class="w-3 h-3 bg-${statusColor}-500 rounded-full"></div>
                                </div>
                            </div>
                            
                            <div class="mb-4">
                                <div class="flex justify-between text-sm text-gray-400 mb-1">
                                    <span>Progress</span>
                                    <span>${completedRaces}/${totalRaces} Races</span>
                                </div>
                                <div class="w-full bg-gray-700 rounded-full h-2">
                                    <div class="bg-red-500 h-2 rounded-full" style="width: ${totalRaces > 0 ? (completedRaces / totalRaces) * 100 : 0}%"></div>
                                </div>
                            </div>
                            
                            <div class="flex space-x-2">
                                <button class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg smooth-transition view-championship-btn" data-id="${champ.id}">
                                    <i data-feather="eye" class="w-4 h-4 inline mr-1"></i>View
                                </button>
                                <button class="bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg smooth-transition delete-championship-btn" data-id="${champ.id}">
                                    <i data-feather="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        championshipsGrid.appendChild(grid);

        // Add event listeners
        grid.querySelectorAll('.view-championship-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.view-championship-btn').dataset.id;
                this.selectChampionship(id);
            });
        });

        grid.querySelectorAll('.delete-championship-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('.delete-championship-btn').dataset.id;
                if (confirm('Are you sure you want to delete this championship? This action cannot be undone.')) {
                    await this.deleteChampionship(id);
                }
            });
        });

        grid.querySelectorAll('.create-championship-btn').forEach(btn => {
            btn.addEventListener('click', () => this.showCreateChampionshipModal());
        });

        // Bind search functionality
        const searchInput = document.getElementById('championship-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterChampionships(e.target.value));
        }

        // Setup action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            switch (btn.dataset.action) {
                case 'create':
                    btn.addEventListener('click', () => this.showCreateChampionshipModal());
                    break;
                case 'import':
                    btn.addEventListener('click', () => this.importChampionship());
                    break;
                case 'export':
                    btn.addEventListener('click', () => this.exportChampionship());
                    break;
            }
            btn.style.display = 'block';
        });
    },

    importChampionship: async function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        
                        // Add the championship to Firestore
                        await this.db.collection('championships').add({
                            ...data,
                            userId: this.state.user.uid,
                            createdAt: new Date()
                        });
                        
                        // Show success message and reload
                        this.showToast('Championship imported successfully!', 'success');
                        await this.loadChampionships();
                    } catch (error) {
                        console.error('Error importing championship:', error);
                        this.showToast('Error importing championship', 'danger');
                    }
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    },

    async exportChampionship() {
        if (!this.state.selectedChampionship) {
            this.showToast('Please select a championship first', 'warning');
            return;
        }
        
        // Prepare the championship data for export
        const data = JSON.stringify(this.state.selectedChampionship, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.state.selectedChampionship.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    filterChampionships: function(searchTerm) {
        searchTerm = (searchTerm || '').toLowerCase().trim();
        const championshipsGrid = document.getElementById('championships-grid');
        if (!championshipsGrid) return;

        const cards = Array.from(championshipsGrid.getElementsByClassName('championship-card'));
        cards.forEach(card => {
            const title = card.querySelector('.card-title');
            const series = card.querySelector('.text-muted');
            if (!title || !series) return;

            const nameMatch = title.textContent.toLowerCase().includes(searchTerm);
            const seriesMatch = series.textContent.toLowerCase().includes(searchTerm);
            const colElement = card.closest('.col-md-4');
            
            if (colElement) {
                colElement.style.display = (nameMatch || seriesMatch) ? 'block' : 'none';
            }
        });
    },

    async importChampionship() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        
                        // Add the championship to Firestore
                        await this.db.collection('championships').add({
                            ...data,
                            userId: this.state.user.uid,
                            createdAt: new Date()
                        });
                        
                        // Show success message and reload
                        this.showToast('Championship imported successfully!', 'success');
                        await this.loadChampionships();
                    } catch (error) {
                        console.error('Error importing championship:', error);
                        this.showToast('Error importing championship', 'danger');
                    }
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    },

    async exportChampionship() {
        if (!this.state.selectedChampionship) {
            this.showToast('Please select a championship first', 'warning');
            return;
        }
        
        // Prepare the championship data for export
        const data = JSON.stringify(this.state.selectedChampionship, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.state.selectedChampionship.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Championship exported successfully!', 'success');
    },

    sortChampionships: function(sortBy) {
        this.state.championships.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -1;
            if (a[sortBy] > b[sortBy]) return 1;
            return 0;
        });
        this.renderChampionshipSelector();
    },

    showCreateChampionshipModal: function() {
        this.showModal('create-championship-modal');
    },

    createChampionship: async function() {
        try {
            if (!this.state.user) {
                alert('Please sign in to create a championship');
                return;
            }

            const name = document.getElementById('championship-name').value;
            const series = document.getElementById('championship-series').value;
            const season = document.getElementById('championship-season').value;
            const description = document.getElementById('championship-description').value;

            if (!name || !series || !season) {
                alert('Please fill in all required fields.');
                return;
            }

            let pointsSystem;
            if (series === 'custom') {
                pointsSystem = this.customPoints;
                if (!pointsSystem) {
                    alert('Please define a custom points system.');
                    return;
                }
            } else {
                pointsSystem = this.getPointsSystem(series);
            }

            const championshipId = `champ_${new Date().getTime()}`;
            const newChampionship = {
                id: championshipId,
                name,
                series,
                season,
                description,
                drivers: [],
                races: [],
                settings: {
                    pointsSystem
                },
                userId: this.state.user.uid,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            // Save to Firebase
            await setDoc(doc(db, 'championships', championshipId), newChampionship);

            this.hideModal('create-championship-modal');
            document.getElementById('create-championship-form').reset();
            this.customPoints = null;
        } catch (error) {
            console.error('Error creating championship:', error);
            alert('Failed to create championship. Please try again.');
        }
    },

    saveCustomPoints: function() {
        const featurePoints = document.getElementById('custom-feature-points').value.split(',').map(p => parseInt(p.trim()));
        const sprintPoints = document.getElementById('custom-sprint-points').value.split(',').map(p => parseInt(p.trim()));
        const polePoints = parseInt(document.getElementById('custom-pole-points').value);
        const fastestLapPoints = parseInt(document.getElementById('custom-fastest-lap-points').value);

        this.customPoints = {
            feature: featurePoints.filter(p => !isNaN(p)),
            sprint: sprintPoints.filter(p => !isNaN(p)),
            pole: isNaN(polePoints) ? 0 : polePoints,
            fastestLap: isNaN(fastestLapPoints) ? 0 : fastestLapPoints
        };

        this.hideModal('custom-points-modal');
    },

    selectChampionship: function(championshipId) {
        this.state.currentChampionship = this.state.championships.find(c => c.id === championshipId);
        this.renderChampionshipDashboard();
    },

    renderChampionshipDashboard: function() {
        document.getElementById('championship-selector').style.display = 'none';
        const dashboard = document.getElementById('championship-dashboard');
        dashboard.style.display = 'block';

        const champ = this.state.currentChampionship;
        if (!champ) return;

        dashboard.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="mb-1">${champ.name}</h2>
                    <p class="text-muted mb-0">${champ.series} - ${champ.season}</p>
                </div>
                <div>
                    <button class="btn btn-outline-primary" id="share-standings-btn"><i class="bi bi-share me-2"></i>Share</button>
                    <button class="btn btn-outline-secondary" id="back-to-selector-btn"><i class="bi bi-arrow-left me-2"></i>Back to Championships</button>
                </div>
            </div>

            <div class="row">
                <div class="col-lg-7">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0">Standings</h5>
                            <div>
                                <button class="btn btn-sm btn-primary" id="manage-drivers-btn"><i class="bi bi-people me-2"></i>Manage Drivers</button>
                                <button class="btn btn-sm btn-outline-primary" id="export-standings-btn"><i class="bi bi-download me-2"></i>Export CSV</button>
                            </div>
                        </div>
                        <div class="card-body" id="standings-container">
                            <div id="podium-container"></div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-5">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0">Races</h5>
                            <button class="btn btn-sm btn-primary" id="add-race-btn"><i class="bi bi-plus-lg me-2"></i>Add Race</button>
                        </div>
                        <div class="card-body" id="races-container"></div>
                    </div>
                </div>
            </div>

            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Championship Evolution</h5>
                        </div>
                        <div class="card-body" style="height: 300px;">
                            <canvas id="championship-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('back-to-selector-btn').addEventListener('click', () => this.showChampionshipSelector());
        document.getElementById('export-standings-btn').addEventListener('click', () => this.statisticsController.exportStandings());
        document.getElementById('manage-drivers-btn').addEventListener('click', () => this.showManageDriversModal());

        if (champ.drivers.length === 0) {
            document.getElementById('share-standings-btn').disabled = true;
            document.getElementById('export-standings-btn').disabled = true;
        }

        this.renderStandings();
        this.renderRaces();
        this.renderChampionshipChart();

        const standingsContainer = document.getElementById('standings-container');
        standingsContainer.addEventListener('click', (event) => {
            const row = event.target.closest('.driver-row');
            if (row) {
                this.showDriverStatsModal(row.dataset.driverId);
            }
        });
    },

    showManageDriversModal: function() {
        this.renderDriversList();
        this.showModal('manage-drivers-modal');
    },

    renderDriversList: function() {
        const container = document.getElementById('drivers-list');
        const drivers = this.state.currentChampionship?.drivers || [];

        if (drivers.length === 0) {
            container.innerHTML = '<div class="text-center p-3"><p class="text-muted">No drivers added yet.</p></div>';
            return;
        }

        container.innerHTML = `
            <ul class="list-group">
                ${drivers.map(driver => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${driver.name}</strong><br>
                            <small class="text-muted">${driver.team || 'No team'}</small>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary edit-driver-btn" data-driver-id="${driver.id}"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger delete-driver-btn" data-driver-id="${driver.id}"><i class="bi bi-trash"></i></button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    },

    addOrUpdateDriver: function(event) {
        event.preventDefault();
        const driverId = document.getElementById('driver-id').value;
        const driverName = document.getElementById('driver-name').value;
        const driverTeam = document.getElementById('driver-team').value;

        if (!driverName) {
            alert('Driver name is required.');
            return;
        }

        const champ = this.state.currentChampionship;
        if (!champ) return;

        if (driverId) {
            // Update existing driver
            const driver = champ.drivers.find(d => d.id === driverId);
            if (driver) {
                driver.name = driverName;
                driver.team = driverTeam;
            }
        } else {
            // Add new driver
            const newDriver = {
                id: `driver_${new Date().getTime()}`,
                name: driverName,
                team: driverTeam
            };
            champ.drivers.push(newDriver);
        }

        this.saveState();
        this.renderDriversList();
        this.renderStandings(); // Update standings in case of name change
        document.getElementById('add-driver-form').reset();
        document.getElementById('driver-id').value = '';
        document.getElementById('cancel-edit-driver-btn').style.display = 'none';

        this.hideModal('manage-drivers-modal');
    },

    editDriver(driverId) {
        const driver = this.state.currentChampionship?.drivers.find(d => d.id === driverId);
        if (driver) {
            document.getElementById('driver-id').value = driver.id;
            document.getElementById('driver-name').value = driver.name;
            document.getElementById('driver-team').value = driver.team;
            document.getElementById('cancel-edit-driver-btn').style.display = 'inline-block';
        }
    },

    deleteDriver(driverId) {
        const champ = this.state.currentChampionship;
        if (champ && confirm('Are you sure you want to delete this driver?')) {
            champ.drivers = champ.drivers.filter(d => d.id !== driverId);
            // Also remove results for this driver
            Object.keys(this.state.results).forEach(raceId => {
                if (this.state.results[raceId][driverId]) {
                    delete this.state.results[raceId][driverId];
                }
            });
            this.saveState();
            this.renderDriversList();
            this.renderStandings();
            this.renderChampionshipChart();
        }
    },

    cancelEditDriver() {
        document.getElementById('add-driver-form').reset();
        document.getElementById('driver-id').value = '';
        document.getElementById('cancel-edit-driver-btn').style.display = 'none';
    },

    // Legacy Bootstrap methods removed - using modern modal implementation

    renderRaceHub(raceId) {
        const container = document.getElementById('results-panel');
        const drivers = this.state.currentChampionship?.drivers || [];
        const results = this.state.results[raceId] || {};

        container.innerHTML = `
            <form id="race-results-form" class="p-3">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Driver</th>
                            <th>Qualifying</th>
                            <th>Sprint</th>
                            <th>Feature</th>
                            <th>Sprint FL</th>
                            <th>Feature FL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${drivers.map(driver => {
                            const result = results[driver.id] || {};
                            return `
                                <tr>
                                    <td>${driver.name}</td>
                                    <td><input type="text" class="form-control" data-driver-id="${driver.id}" data-result-type="qualifying" value="${result.qualifying || ''}"></td>
                                    <td><input type="text" class="form-control" data-driver-id="${driver.id}" data-result-type="sprint" value="${result.sprint || ''}"></td>
                                    <td><input type="text" class="form-control" data-driver-id="${driver.id}" data-result-type="feature" value="${result.feature || ''}"></td>
                                    <td><input type="checkbox" class="form-check-input" data-driver-id="${driver.id}" data-result-type="sprintFL" ${result.sprintFL ? 'checked' : ''}></td>
                                    <td><input type="checkbox" class="form-check-input" data-driver-id="${driver.id}" data-result-type="featureFL" ${result.featureFL ? 'checked' : ''}></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                <button type="button" class="btn btn-primary" id="save-race-results-btn" data-race-id="${raceId}">Save Results</button>
            </form>
        `;
    },

    renderRaceAnalysis(raceId) {
        const container = document.getElementById('analysis-panel');
        const analysis = this.statisticsController.analyzeRace(raceId);

        if (!analysis) {
            container.innerHTML = '<p class="text-muted p-3">No analysis available yet. Enter some results first.</p>';
            return;
        }

        container.innerHTML = `
            <div class="p-3">
                <div class="row">
                    <div class="col-md-6">
                        <ul class="list-group">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Winner
                                <span>${analysis.winner?.name || 'N/A'}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Pole Position
                                <span>${analysis.polePosition?.name || 'N/A'}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Fastest Lap
                                <span>${analysis.fastestLap?.name || 'N/A'}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Perfect Weekend
                                <span class="badge bg-success">${analysis.perfectWeekend?.name || 'N/A'}</span>
                            </li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <ul class="list-group">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Best Recovery
                                <span>${analysis.bestRecovery.driver?.name || 'N/A'} (+${analysis.bestRecovery.positions})</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Biggest Loser
                                <span>${analysis.biggestLoser.driver?.name || 'N/A'} (-${analysis.biggestLoser.positions})</span>
                            </li>
                            <li class="list-group-item">
                                DNFs
                                <ul class="list-unstyled mt-2">
                                    ${analysis.dnfs.map(d => `<li>${d.name}</li>`).join('') || '<li>None</li>'}
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    },

    async saveRaceResults(raceId) {
        try {
            const results = {};
            const inputs = document.querySelectorAll('#race-results-form input');

            // Collect results from form
            inputs.forEach(input => {
                const driverId = input.dataset.driverId;
                if (!driverId) return;

                if (!results[driverId]) {
                    results[driverId] = {};
                }

                const resultType = input.dataset.resultType;
                if (input.type === 'checkbox') {
                    results[driverId][resultType] = input.checked;
                } else {
                    results[driverId][resultType] = input.value;
                }
            });

            // Save each driver's result to Firebase
            const savePromises = Object.entries(results).map(async ([driverId, result]) => {
                const resultId = `${raceId}_${driverId}`;
                await setDoc(doc(db, 'results', resultId), {
                    championshipId: this.state.currentChampionship.id,
                    raceId,
                    driverId,
                    ...result,
                    updatedAt: new Date().toISOString()
                });
            });

            await Promise.all(savePromises);

            // Update race completion status if needed
            const race = this.state.currentChampionship.races.find(r => r.id === raceId);
            if (race) {
                const allDriversHaveResults = this.state.currentChampionship.drivers.every(driver => {
                    const driverResults = results[driver.id];
                    return driverResults && driverResults.feature; // Check if main race result exists
                });

                if (allDriversHaveResults && !race.completed) {
                    race.completed = true;
                    await updateDoc(doc(db, 'championships', this.state.currentChampionship.id), {
                        races: this.state.currentChampionship.races,
                        lastUpdated: new Date().toISOString()
                    });
                }
            }

            this.hideModal('race-hub-modal');

            this.renderStandings();
            this.renderChampionshipChart();
        } catch (error) {
            console.error('Error saving race results:', error);
            alert('Failed to save race results. Please try again.');
        }
    },

    showDriverStatsModal(driverId) {
        const driver = this.state.currentChampionship?.drivers.find(d => d.id === driverId);
        if (!driver) return;

        const stats = this.statisticsController.calculateDriverStats(driverId);

        const title = document.getElementById('driver-stats-title');
        const content = document.getElementById('driver-stats-content');

        title.textContent = `${driver.name} - Statistics`;
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <canvas id="driver-radar-chart"></canvas>
                </div>
                <div class="col-md-6">
                    <h5>Overall Stats</h5>
                    <ul class="list-group">
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Total Points
                            <span class="badge bg-primary rounded-pill">${stats.totalPoints}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Wins
                            <span class="badge bg-primary rounded-pill">${stats.wins}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Podiums
                            <span class="badge bg-primary rounded-pill">${stats.podiums}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Poles
                            <span class="badge bg-primary rounded-pill">${stats.poles}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Fastest Laps
                            <span class="badge bg-primary rounded-pill">${stats.fastestLaps}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            DNFs
                            <span class="badge bg-danger rounded-pill">${stats.dnfs}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Avg. Position
                            <span class="badge bg-secondary rounded-pill">${stats.averagePosition}</span>
                        </li>
                    </ul>
                </div>
            </div>
            <h5 class="mt-4">Race Results</h5>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Race</th>
                        <th>Qualifying</th>
                        <th>Sprint</th>
                        <th>Feature</th>
                        <th>Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.raceResults.map(res => `
                        <tr>
                            <td>${res.race}</td>
                            <td>${res.qualifying || '-'}</td>
                            <td>${res.sprint || '-'}</td>
                            <td>${res.feature || '-'}</td>
                            <td>${res.points}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        this.showModal('driver-stats-modal');

        // Use a timeout to ensure the canvas is visible before creating the chart
        setTimeout(() => {
            this.statisticsController.createDriverRadarChart('driver-radar-chart', driverId);
        }, 200);
    },

    showChampionshipSelector() {
        this.state.currentChampionship = null;
        this.statisticsController.destroyAllCharts();
        document.getElementById('championship-dashboard').style.display = 'none';
        document.getElementById('championship-selector').style.display = 'block';
        this.renderChampionshipSelector();
    },

    renderStandings() {
        const container = document.getElementById('standings-container');
        const standings = this.statisticsController.generateStandings();

        if (standings.length === 0) {
            container.innerHTML = '<p class="text-muted">No drivers in this championship yet.</p>';
            return;
        }

        const podiumContainer = document.getElementById('podium-container');
        const top3 = standings.slice(0, 3);
        podiumContainer.innerHTML = `
            <div class="podium">
                <div class="podium-step second">
                    <div class="podium-rank">2</div>
                    <div class="podium-driver">${top3[1]?.name || ''}</div>
                    <div class="podium-points">${top3[1]?.totalPoints || ''}</div>
                </div>
                <div class="podium-step first">
                    <div class="podium-rank">1</div>
                    <div class="podium-driver">${top3[0]?.name || ''}</div>
                    <div class="podium-points">${top3[0]?.totalPoints || ''}</div>
                </div>
                <div class="podium-step third">
                    <div class="podium-rank">3</div>
                    <div class="podium-driver">${top3[2]?.name || ''}</div>
                    <div class="podium-points">${top3[2]?.totalPoints || ''}</div>
                </div>
            </div>
        `;

        container.innerHTML += `
            <table class="table table-hover table-sm mt-3">
                <thead>
                    <tr>
                        <th scope="col">Pos</th>
                        <th scope="col">Driver</th>
                        <th scope="col">Points</th>
                        <th scope="col">Wins</th>
                    </tr>
                </thead>
                <tbody>
                    ${standings.map(driver => `
                        <tr class="driver-row" data-driver-id="${driver.id}">
                            <td>${driver.position}</td>
                            <td>${driver.name}</td>
                            <td>${driver.totalPoints}</td>
                            <td>${driver.wins}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderRaces() {
        const container = document.getElementById('races-container');
        const races = this.state.currentChampionship?.races || [];

        if (races.length === 0) {
            container.innerHTML = '<div class="text-center p-3"><p class="text-muted">No races scheduled yet.</p></div>';
            return;
        }

        container.innerHTML = `
            <ul class="list-group">
                ${races.map(race => {
                    const analysis = this.statisticsController.analyzeRace(race.id);
                    const winner = analysis?.winner;
                    return `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${race.name}</strong><br>
                                <small class="text-muted">${new Date(race.date).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <span class="badge bg-success me-2">${winner ? `Winner: ${winner.name}` : ''}</span>
                                <button class="btn btn-sm btn-outline-secondary race-hub-btn" data-race-id="${race.id}">Manage</button>
                            </div>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
    },

    renderChampionshipChart() {
        this.statisticsController.createChampionshipChart('championship-chart');
    },

    getPointsSystem(series) {
        // Pre-defined points systems
        const pointsSystems = {
            f1: {
                feature: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
                sprint: [8, 7, 6, 5, 4, 3, 2, 1],
                pole: 0,
                fastestLap: 1
            },
            f2: {
                feature: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
                sprint: [10, 8, 6, 5, 4, 3, 2, 1],
                pole: 2,
                fastestLap: 1
            },
            f3: {
                feature: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
                sprint: [12, 10, 8, 6, 5, 4, 3, 2, 1],
                pole: 2,
                fastestLap: 1
            },
            indycar: {
                feature: [50, 40, 35, 32, 30, 28, 26, 24, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5],
                sprint: [],
                pole: 1,
                fastestLap: 0
            },
            nascar: {
                feature: [40, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
                sprint: [],
                pole: 0,
                fastestLap: 0
            },
            // Add other series here
            default: {
                feature: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
                sprint: [],
                pole: 0,
                fastestLap: 0
            }
        };
        return pointsSystems[series] || pointsSystems.default;
    },

    selectChampionship(championshipId) {
        const championship = this.state.championships.find(c => c.id === championshipId);
        if (championship) {
            this.state.currentChampionship = championship;
            this.showToast(`Selected: ${championship.name}`, 'success');
            // Aqui você pode adicionar lógica para navegar para a página do championship
        }
    },

    // Social Media Functions
    renderUserProfile() {
        console.log('Rendering user profile...', this.state.user);
        if (!this.state.user) {
            console.log('No user found, skipping profile render');
            return;
        }
        
        const userAvatar = document.getElementById('user-avatar');
        const postUserAvatar = document.getElementById('post-user-avatar');
        const userDisplayName = document.getElementById('user-display-name');
        const userEmail = document.getElementById('user-email');
        
        console.log('Profile elements found:', { userAvatar, postUserAvatar, userDisplayName, userEmail });
        
        const avatarUrl = this.state.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.state.user.displayName || this.state.user.email)}&background=dc2626&color=fff`;
        
        if (userAvatar) userAvatar.src = avatarUrl;
        if (postUserAvatar) postUserAvatar.src = avatarUrl;
        if (userDisplayName) userDisplayName.textContent = this.state.user.displayName || 'Racing Driver';
        if (userEmail) userEmail.textContent = this.state.user.username ? `@${this.state.user.username}` : this.state.user.email;
        
        // Update user stats
        const userPostsCount = document.getElementById('user-posts-count');
        const userFollowersCount = document.getElementById('user-followers-count');
        const userFollowingCount = document.getElementById('user-following-count');
        
        if (userPostsCount) userPostsCount.textContent = this.state.posts ? this.state.posts.filter(p => p.userId === this.state.user.uid).length : 0;
        if (userFollowersCount) userFollowersCount.textContent = this.state.user.followers ? this.state.user.followers.length : 0;
        if (userFollowingCount) userFollowingCount.textContent = this.state.user.following ? this.state.user.following.length : 0;
        
        console.log('User profile rendered with stats');
    },

    renderSocialFeed() {
        console.log('Rendering social feed...');
        const feedContainer = document.getElementById('social-feed');
        if (!feedContainer) {
            console.log('Social feed container not found!');
            return;
        }
        
        // Load user's posts and posts from followed users
        if (!this.state.posts || this.state.posts.length === 0) {
            feedContainer.innerHTML = `
                <div class="glass-card p-8 text-center">
                    <i data-feather="edit" class="w-16 h-16 mx-auto mb-4 text-gray-500"></i>
                    <h3 class="text-lg font-semibold mb-2">Share Your Racing Journey!</h3>
                    <p class="text-gray-400 mb-4">Be the first to share your racing thoughts, results, or experiences with the community.</p>
                    <div class="space-y-2">
                        <button class="racing-btn px-6 py-2" onclick="document.getElementById('post-content').focus()">Create Your First Post</button>
                        <button class="border border-gray-600 px-6 py-2 rounded hover:bg-gray-800 transition-colors" onclick="App.showFindDrivers()">Find Drivers to Follow</button>
                    </div>
                </div>
            `;
        } else {
            // Render actual posts
            feedContainer.innerHTML = this.state.posts.map(post => this.renderPost(post)).join('');
        }
        
        // Re-initialize Feather icons for new content
        feather.replace();
    },

    async loadUserPosts() {
        try {
            // First get user's following list
            const userRef = doc(db, 'users', this.state.user.uid);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data();
            const following = userData.following || [];
            
            // Include user's own posts and posts from followed users
            const allowedUsers = [this.state.user.uid, ...following];
            
            // Load posts from Firebase, ordered by timestamp descending
            const postsQuery = query(
                collection(db, 'posts'),
                // Filter posts from followed users and own posts
                where('userId', 'in', allowedUsers.length > 0 ? allowedUsers : [this.state.user.uid])
            );
            
            onSnapshot(postsQuery, (snapshot) => {
                this.state.posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => {
                    const timeA = new Date(a.timestamp?.seconds ? a.timestamp.seconds * 1000 : a.timestamp);
                    const timeB = new Date(b.timestamp?.seconds ? b.timestamp.seconds * 1000 : b.timestamp);
                    return timeB - timeA; // Newest first
                });
                
                this.renderSocialFeed();
            });
        } catch (error) {
            console.error('Error loading posts:', error);
            // Fallback to show only user's own posts
            const postsQuery = query(
                collection(db, 'posts'),
                where('userId', '==', this.state.user.uid)
            );
            
            onSnapshot(postsQuery, (snapshot) => {
                this.state.posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => {
                    const timeA = new Date(a.timestamp?.seconds ? a.timestamp.seconds * 1000 : a.timestamp);
                    const timeB = new Date(b.timestamp?.seconds ? b.timestamp.seconds * 1000 : b.timestamp);
                    return timeB - timeA;
                });
                
                this.renderSocialFeed();
            });
        }
    },

    renderPost(post) {
        const avatarUrl = post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=dc2626&color=fff`;
        const timeAgo = this.getTimeAgo(post.timestamp);
        const isLiked = post.likedBy && post.likedBy.includes(this.state.user.uid);
        
        return `
            <div class="glass-card p-4">
                <div class="flex items-start space-x-3">
                    <button onclick="App.showUserProfile('${post.userId}')" class="flex-shrink-0">
                        <img class="w-10 h-10 rounded-full hover:ring-2 hover:ring-red-500 transition-all" src="${avatarUrl}" alt="${post.author}">
                    </button>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-2">
                                <button onclick="App.showUserProfile('${post.userId}')" class="font-semibold text-white hover:text-red-400 transition-colors">${post.author}</button>
                                <span class="text-sm text-gray-400">${timeAgo}</span>
                            </div>
                            ${post.userId === this.state.user.uid ? `
                                <button onclick="App.deletePost('${post.id}')" class="text-gray-400 hover:text-red-500 transition-colors">
                                    <i data-feather="trash-2" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                        <p class="text-gray-200 mb-3">${post.content}</p>
                        
                        <div class="flex items-center justify-between pt-3 border-t border-gray-700">
                            <div class="flex space-x-6">
                                <button onclick="App.toggleLike('${post.id}')" class="flex items-center space-x-1 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'} transition-colors">
                                    <i data-feather="heart" class="w-4 h-4 ${isLiked ? 'fill-current' : ''}"></i>
                                    <span class="text-sm">${post.likes || 0}</span>
                                </button>
                                <button onclick="App.toggleComments('${post.id}')" class="flex items-center space-x-1 text-gray-400 hover:text-blue-500 transition-colors">
                                    <i data-feather="message-circle" class="w-4 h-4"></i>
                                    <span class="text-sm">${post.comments ? post.comments.length : 0}</span>
                                </button>
                                <button class="flex items-center space-x-1 text-gray-400 hover:text-green-500 transition-colors">
                                    <i data-feather="share-2" class="w-4 h-4"></i>
                                    <span class="text-sm">${post.shares || 0}</span>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Comments Section -->
                        <div id="comments-${post.id}" class="mt-4 border-t border-gray-700 pt-4 hidden">
                            <div class="mb-3">
                                <div class="flex space-x-2">
                                    <img class="w-8 h-8 rounded-full" src="${this.state.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.state.user.displayName)}&background=dc2626&color=fff`}" alt="Your avatar">
                                    <div class="flex-1">
                                        <input type="text" id="comment-input-${post.id}" placeholder="Add a comment..." class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-red-500 focus:outline-none text-white text-sm">
                                    </div>
                                    <button onclick="App.addComment('${post.id}')" class="racing-btn px-3 py-1 text-sm">Post</button>
                                </div>
                            </div>
                            <div id="comments-list-${post.id}" class="space-y-2">
                                ${post.comments ? post.comments.map(comment => `
                                    <div class="flex items-start space-x-2 text-sm">
                                        <img src="${comment.authorPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=dc2626&color=fff`}" alt="${comment.authorName}" class="w-6 h-6 rounded-full">
                                        <div class="flex-1">
                                            <span class="font-semibold text-white">${comment.authorName}</span>
                                            <span class="text-gray-300 ml-2">${comment.content}</span>
                                            ${comment.authorId === this.state.user.uid ? `
                                                <button onclick="App.deleteComment('${post.id}', '${comment.id}')" class="ml-2 text-gray-500 hover:text-red-400 text-xs">
                                                    <i data-feather="x" class="w-3 h-3"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('') : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getTimeAgo(timestamp) {
        const now = new Date();
        const postTime = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
        const diff = now - postTime;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    },

    async toggleLike(postId) {
        try {
            const post = this.state.posts.find(p => p.id === postId);
            if (!post) return;
            
            const isLiked = post.likedBy && post.likedBy.includes(this.state.user.uid);
            
            if (isLiked) {
                // Unlike
                post.likedBy = post.likedBy.filter(uid => uid !== this.state.user.uid);
                post.likes = (post.likes || 1) - 1;
            } else {
                // Like
                if (!post.likedBy) post.likedBy = [];
                post.likedBy.push(this.state.user.uid);
                post.likes = (post.likes || 0) + 1;
            }
            
            // Update in Firebase
            await updateDoc(doc(db, 'posts', postId), {
                likes: post.likes,
                likedBy: post.likedBy
            });
            
            // Re-render feed
            this.renderSocialFeed();
        } catch (error) {
            console.error('Error toggling like:', error);
            this.showToast('Failed to update like', 'error');
        }
    },

    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) return;
        
        try {
            await deleteDoc(doc(db, 'posts', postId));
            this.state.posts = this.state.posts.filter(p => p.id !== postId);
            this.renderSocialFeed();
            this.showToast('Post deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showToast('Failed to delete post', 'error');
        }
    },

    toggleComments(postId) {
        const commentsSection = document.getElementById(`comments-${postId}`);
        if (commentsSection) {
            if (commentsSection.classList.contains('hidden')) {
                commentsSection.classList.remove('hidden');
            } else {
                commentsSection.classList.add('hidden');
            }
        }
    },

    async loadComments(postId) {
        try {
            const commentsQuery = query(
                collection(db, 'comments'),
                where('postId', '==', postId)
            );
            
            const snapshot = await getDocs(commentsQuery);
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => {
                const timeA = new Date(a.timestamp?.seconds ? a.timestamp.seconds * 1000 : a.timestamp);
                const timeB = new Date(b.timestamp?.seconds ? b.timestamp.seconds * 1000 : b.timestamp);
                return timeA - timeB; // Oldest first for comments
            });
            
            this.renderComments(postId, comments);
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    },

    renderComments(postId, comments) {
        const container = document.getElementById(`comments-list-${postId}`);
        
        if (comments.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-2">No comments yet</p>';
            return;
        }
        
        container.innerHTML = comments.map(comment => {
            const timeAgo = this.getTimeAgo(comment.timestamp);
            const avatarUrl = comment.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=dc2626&color=fff`;
            
            return `
                <div class="flex space-x-2 py-2">
                    <img class="w-6 h-6 rounded-full" src="${avatarUrl}" alt="${comment.author}">
                    <div class="flex-1">
                        <div class="bg-gray-700 rounded-lg px-3 py-2">
                            <div class="flex items-center space-x-2 mb-1">
                                <span class="font-semibold text-white text-sm">${comment.author}</span>
                                <span class="text-xs text-gray-400">${timeAgo}</span>
                            </div>
                            <p class="text-gray-200 text-sm">${comment.content}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    async addComment(postId) {
        const input = document.getElementById(`comment-input-${postId}`);
        const content = input.value.trim();
        
        if (!content) return;
        
        try {
            const commentData = {
                postId,
                content,
                author: this.state.user.displayName,
                authorAvatar: this.state.user.photoURL,
                userId: this.state.user.uid,
                timestamp: new Date()
            };
            
            const commentsRef = collection(db, 'comments');
            await setDoc(doc(commentsRef), commentData);
            
            // Update post comment count
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);
            const currentComments = postDoc.data().comments || 0;
            await updateDoc(postRef, { comments: currentComments + 1 });
            
            input.value = '';
            this.loadComments(postId); // Refresh comments
            
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showToast('Failed to add comment', 'error');
        }
    },

    renderTrendingChampionships() {
        const trendingContainer = document.getElementById('trending-championships');
        if (!trendingContainer) return;
        
        // This will load real championship activity data from Firebase in the future
        if (this.state.championships.length === 0) {
            trendingContainer.innerHTML = `
                <div class="text-center py-4">
                    <i data-feather="bar-chart-2" class="w-8 h-8 mx-auto mb-2 text-gray-500"></i>
                    <p class="text-sm text-gray-400 mb-3">No trending championships yet</p>
                    <button class="text-xs racing-btn px-4 py-2" onclick="App.createNewChampionship()">Create First Championship</button>
                </div>
            `;
        } else {
            // Show user's championships for now, in future will be sorted by activity/comments
            trendingContainer.innerHTML = this.state.championships.slice(0, 3).map(championship => `
                <div class="p-2 rounded hover:bg-gray-700 cursor-pointer trending-topic" onclick="App.showChampionshipDetails('${championship.id}')">
                    <p class="text-sm font-medium text-white">${championship.name}</p>
                    <div class="flex justify-between text-xs text-gray-400 mt-1">
                        <span>${championship.series || 'Custom'}</span>
                        <span>• ${championship.drivers?.length || 0} drivers</span>
                    </div>
                </div>
            `).join('');
        }
        
        // Re-initialize Feather icons
        feather.replace();
        
        // TODO: Load trending championships based on activity from Firebase
        // this.loadTrendingChampionships();
    },
    
    async loadTrendingChampionships() {
        // Future implementation to load championships sorted by activity/comments
        // const trendingQuery = query(
        //     collection(db, 'championships'),
        //     orderBy('activityScore', 'desc'),
        //     limit(5)
        // );
        // const snapshot = await getDocs(trendingQuery);
        // const trending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // this.renderTrendingList(trending);
    },

    async renderSuggestedDrivers() {
        const suggestedContainer = document.getElementById('suggested-drivers');
        if (!suggestedContainer) return;
        
        try {
            // Get real users from Firebase
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);
            
            const realDrivers = [];
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.uid && userData.uid !== this.state.user.uid) {
                    const isFollowing = this.state.user.following && this.state.user.following.includes(userData.uid);
                    if (!isFollowing) {
                        realDrivers.push({
                            uid: userData.uid,
                            name: userData.displayName || 'Unknown User',
                            username: userData.username || null,
                            email: userData.email,
                            photoURL: userData.photoURL
                        });
                    }
                }
            });
            
            // Show up to 3 suggested drivers
            const suggestedDrivers = realDrivers.slice(0, 3);
            
            if (suggestedDrivers.length === 0) {
                suggestedContainer.innerHTML = `
                    <div class="text-center py-4 text-gray-400">
                        <p class="text-sm">No new drivers to suggest</p>
                        <button onclick="App.showFindDriversModal()" class="text-xs mt-2 text-red-400 hover:text-red-300">Find Drivers</button>
                    </div>
                `;
                return;
            }
        
            suggestedContainer.innerHTML = suggestedDrivers.map(driver => `
                <div class="flex items-center justify-between p-2 rounded hover:bg-gray-700">
                    <div class="flex items-center space-x-3">
                        <img src="${driver.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name)}&background=dc2626&color=fff`}" 
                             alt="${driver.name}" class="w-8 h-8 rounded-full">
                        <div>
                            <p class="text-sm font-medium text-white">${driver.name}</p>
                            <p class="text-xs text-gray-400">${driver.username ? '@' + driver.username : driver.email || 'Racer'}</p>
                        </div>
                    </div>
                    <button class="text-xs px-3 py-1 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors" onclick="App.followUser('${driver.uid}')">
                        Follow
                    </button>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error loading suggested drivers:', error);
            suggestedContainer.innerHTML = `
                <div class="text-center py-4 text-gray-400">
                    <p class="text-sm">Unable to load suggestions</p>
                </div>
            `;
        }
        
        // Refresh icons after rendering
        setTimeout(() => feather.replace(), 100);
    },

    // Social interaction methods
    async toggleLike(postId) {
        try {
            const postRef = doc(db, 'posts', postId);
            const post = this.state.posts.find(p => p.id === postId);
            if (!post) return;

            const userId = this.state.user.uid;
            let likedBy = post.likedBy || [];
            let likes = post.likes || 0;

            if (likedBy.includes(userId)) {
                // Unlike
                likedBy = likedBy.filter(id => id !== userId);
                likes = Math.max(0, likes - 1);
            } else {
                // Like
                likedBy.push(userId);
                likes += 1;
            }

            await updateDoc(postRef, {
                likes,
                likedBy
            });

            // Update local state
            post.likes = likes;
            post.likedBy = likedBy;
            this.renderSocialFeed();
            
        } catch (error) {
            console.error('Error toggling like:', error);
            this.showToast('Failed to update like', 'error');
        }
    },

    toggleComments(postId) {
        const commentsSection = document.getElementById(`comments-${postId}`);
        if (commentsSection) {
            commentsSection.classList.toggle('hidden');
            if (!commentsSection.classList.contains('hidden')) {
                this.loadComments(postId);
            }
        }
    },

    async addComment(postId, content) {
        if (!content.trim()) return;
        
        try {
            const comment = {
                id: Date.now().toString(),
                postId,
                userId: this.state.user.uid,
                author: this.state.user.displayName || this.state.user.email,
                authorAvatar: this.state.user.photoURL,
                content: content.trim(),
                timestamp: new Date()
            };

            // Save comment to Firebase
            await setDoc(doc(db, 'comments', comment.id), comment);

            // Update post comment count
            const postRef = doc(db, 'posts', postId);
            const post = this.state.posts.find(p => p.id === postId);
            if (post) {
                const newCommentCount = (post.comments || 0) + 1;
                await updateDoc(postRef, { comments: newCommentCount });
                post.comments = newCommentCount;
            }

            this.loadComments(postId);
            this.showToast('Comment added! 💬', 'success');
            
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showToast('Failed to add comment', 'error');
        }
    },

    async loadComments(postId) {
        try {
            const commentsQuery = query(
                collection(db, 'comments'),
                where('postId', '==', postId)
            );
            
            const snapshot = await getDocs(commentsQuery);
            const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const commentsList = document.getElementById(`comments-list-${postId}`);
            if (commentsList && comments.length > 0) {
                commentsList.innerHTML = comments.map(comment => `
                    <div class="flex space-x-2 text-sm">
                        <img src="${comment.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=dc2626&color=fff`}" alt="${comment.author}" class="w-6 h-6 rounded-full">
                        <div>
                            <span class="font-medium text-white">${comment.author}</span>
                            <span class="text-gray-300 ml-2">${comment.content}</span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    },

    sharePost(postId) {
        const post = this.state.posts.find(p => p.id === postId);
        if (post) {
            if (navigator.share) {
                navigator.share({
                    title: `Post by ${post.author}`,
                    text: post.content,
                    url: window.location.href
                });
            } else {
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(`${post.content} - by ${post.author}`);
                this.showToast('Post copied to clipboard! 📋', 'success');
            }
        }
    },

    // Race result functionality
    showAddRaceResult() {
        // Check if user has any championships available
        if (!this.state.championships || this.state.championships.length === 0) {
            this.showToast('Please create or join a championship first to add race results', 'info');
            return;
        }

        // Get all available races from all championships
        let allRaces = [];
        this.state.championships.forEach(championship => {
            if (championship.races && championship.races.length > 0) {
                championship.races.forEach(race => {
                    allRaces.push({
                        ...race,
                        championshipName: championship.name,
                        championshipId: championship.id
                    });
                });
            }
        });

        if (allRaces.length === 0) {
            this.showToast('No races available. Create races in your championships first!', 'info');
            return;
        }

        // Create a simple race result modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="glass-card p-6 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Add Race Result</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                        <i data-feather="x" class="w-5 h-5"></i>
                    </button>
                </div>
                
                <form id="race-result-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Race</label>
                        <select name="raceId" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" required>
                            <option value="">Select a race...</option>
                            ${races.map(race => `<option value="${race.id}">${race.name}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Finishing Position</label>
                        <input type="number" name="position" min="1" max="50" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="1" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Points Earned</label>
                        <input type="number" name="points" min="0" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="25">
                    </div>
                    
                    <div class="flex space-x-2">
                        <button type="button" onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" class="flex-1 racing-btn px-4 py-2">
                            Add Result
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle form submission
        modal.querySelector('#race-result-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const raceId = formData.get('raceId');
            const position = formData.get('position');
            const points = formData.get('points');
            
            const race = races.find(r => r.id === raceId);
            if (race) {
                this.addRaceResultToPost({
                    raceId,
                    raceName: race.name,
                    position: parseInt(position),
                    points: parseInt(points) || 0
                });
            }
            
            modal.remove();
        });
        
        // Initialize feather icons
        setTimeout(() => feather.replace(), 100);
    },

    addRaceResultToPost(raceResult) {
        // Store the race result temporarily to be included in the next post
        this.pendingRaceResult = raceResult;
        
        // Update the post content area to show that a race result is attached
        const postContent = document.getElementById('post-content');
        if (postContent) {
            if (!postContent.value.includes('Race Result:')) {
                const resultText = `🏁 Race Result: P${raceResult.position} at ${raceResult.raceName} (${raceResult.points} pts)\n\n`;
                postContent.value = resultText + postContent.value;
            }
        }
        
        this.showToast(`Race result attached! Finish your post to share it. 🏆`, 'success');
    },
    
    async loadSuggestedUsers() {
        // Future implementation to load real users from Firebase
        // const usersQuery = query(collection(db, 'users'), limit(5));
        // const snapshot = await getDocs(usersQuery);
        // const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // this.renderSuggestedUsersList(users);
    },

    renderActiveChampionships() {
        const activeContainer = document.getElementById('active-championships');
        if (!activeContainer) return;
        
        if (this.state.championships.length === 0) {
            activeContainer.innerHTML = `
                <div class="text-center py-4">
                    <i data-feather="award" class="w-6 h-6 mx-auto mb-2 text-gray-500"></i>
                    <p class="text-sm text-gray-400 mb-3">No championships yet</p>
                    <button class="text-xs racing-btn px-3 py-1" onclick="App.createNewChampionship()">Create One</button>
                </div>
            `;
        } else {
            activeContainer.innerHTML = this.state.championships.slice(0, 3).map(championship => `
                <div class="p-2 rounded hover:bg-gray-700 cursor-pointer text-sm border-l-2 border-red-500" onclick="App.showChampionshipDetails('${championship.id}')">
                    <div class="flex justify-between items-center">
                        <p class="font-medium text-white">${championship.name}</p>
                        <span class="text-xs text-green-400">Active</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-400 mt-1">
                        <span>${championship.series || 'Custom'}</span>
                        <span>${championship.drivers ? championship.drivers.length : 0} drivers</span>
                    </div>
                </div>
            `).join('');
        }
        
        // Re-initialize Feather icons
        feather.replace();
    },

    async publishPost() {
        const content = document.getElementById('post-content').value.trim();
        if (!content) {
            this.showToast('Please enter some content for your post', 'error');
            return;
        }
        
        try {
            // Create post object
            const post = {
                id: Date.now().toString(),
                userId: this.state.user.uid,
                author: this.state.user.displayName || this.state.user.email,
                authorAvatar: this.state.user.photoURL,
                content,
                timestamp: new Date(),
                likes: 0,
                comments: 0,
                shares: 0,
                likedBy: [],
                isPublic: true
            };
            
            // Add championship context if current championship is selected
            if (this.state.currentChampionship) {
                post.championshipId = this.state.currentChampionship.id;
                post.championshipName = this.state.currentChampionship.name;
            }
            
            // Add race result if attached
            if (this.pendingRaceResult) {
                post.raceResult = this.pendingRaceResult;
                this.pendingRaceResult = null; // Clear after use
            }
            
            // Save to Firebase (posts collection)
            await setDoc(doc(db, 'posts', post.id), post);
            
            this.showToast('Post published successfully! 🏁', 'success');
            document.getElementById('post-content').value = '';
            
            // Don't add to local state - the Firebase listener will handle it automatically
            
        } catch (error) {
            console.error('Error publishing post:', error);
            this.showToast('Failed to publish post. Please try again.', 'error');
        }
    },

    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }
        
        try {
            // Delete from Firebase
            await deleteDoc(doc(db, 'posts', postId));
            
            // Remove from local state if it exists
            this.state.posts = this.state.posts.filter(post => post.id !== postId);
            
            this.showToast('Post deleted successfully', 'success');
            
            // Refresh posts display
            this.loadUserPosts();
            
            // If we're in profile modal, refresh it
            const profileModal = document.getElementById('profile-modal');
            if (!profileModal.classList.contains('hidden')) {
                this.showUserProfile(this.state.user.uid);
            }
            
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showToast('Failed to delete post', 'error');
        }
    },

    async addComment(postId) {
        const commentInput = document.getElementById(`comment-input-${postId}`);
        const content = commentInput.value.trim();
        
        if (!content) {
            this.showToast('Please enter a comment', 'error');
            return;
        }
        
        try {
            const comment = {
                id: Date.now().toString(),
                authorId: this.state.user.uid,
                authorName: this.state.user.displayName || this.state.user.email,
                authorPhoto: this.state.user.photoURL,
                content,
                createdAt: new Date()
            };
            
            // Get current post
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);
            
            if (postDoc.exists()) {
                const postData = postDoc.data();
                const comments = postData.comments || [];
                comments.push(comment);
                
                await updateDoc(postRef, { comments });
                
                // Clear input
                commentInput.value = '';
                
                // Refresh the entire posts to show updated comment count and new comment
                this.loadUserPosts();
                
                this.showToast('Comment added!', 'success');
            }
            
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showToast('Failed to add comment', 'error');
        }
    },

    async deleteComment(postId, commentId) {
        if (!confirm('Delete this comment?')) {
            return;
        }
        
        try {
            // Get current post
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);
            
            if (postDoc.exists()) {
                const postData = postDoc.data();
                const comments = (postData.comments || []).filter(c => c.id !== commentId);
                
                await updateDoc(postRef, { comments });
                
                // Refresh the entire posts to show updated comment count
                this.loadUserPosts();
                
                this.showToast('Comment deleted', 'success');
            }
            
        } catch (error) {
            console.error('Error deleting comment:', error);
            this.showToast('Failed to delete comment', 'error');
        }
    },



    loadMorePosts() {
        this.showToast('Loading more posts...', 'info');
        // Simulate loading more posts
        setTimeout(() => {
            this.showToast('More posts loaded!', 'success');
        }, 1500);
    },

    showFindDrivers() {
        this.showModal('find-drivers-modal');
        this.loadAvailableDrivers();
    },
    
    async loadAvailableDrivers() {
        const driversList = document.getElementById('drivers-list');
        if (!driversList) return;
        
        try {
            // In a real implementation, this would query Firebase for other users
            // For now, show a placeholder
            driversList.innerHTML = `
                <div class="text-center py-4 text-gray-400">
                    <i data-feather="users" class="w-8 h-8 mx-auto mb-2"></i>
                    <p class="mb-2">Feature under development</p>
                    <p class="text-sm">Soon you'll be able to search and connect with other drivers!</p>
                </div>
            `;
            feather.replace();
        } catch (error) {
            console.error('Error loading drivers:', error);
            this.showToast('Failed to load drivers', 'error');
        }
    },
    
    searchDrivers(searchTerm) {
        // TODO: Implement real-time search of Firebase users
        console.log('Searching for drivers:', searchTerm);
    },

    showJoinChampionship() {
        this.showModal('join-championship-modal');
        this.loadAvailableChampionships();
    },
    
    async loadAvailableChampionships() {
        const championshipsList = document.getElementById('available-championships');
        if (!championshipsList) return;
        
        try {
            if (!this.state.user) {
                championshipsList.innerHTML = `
                    <div class="text-center py-4 text-gray-400">
                        <i data-feather="user-x" class="w-8 h-8 mx-auto mb-2"></i>
                        <p>Please log in to join championships</p>
                    </div>
                `;
                return;
            }

            // Filter championships: exclude those created by user or where user is already a participant
            const availableChampionships = this.state.championships.filter(champ => {
                // Exclude if user is the creator
                if (champ.userId === this.state.user.uid) return false;
                
                // Exclude if user is already a participant
                const participants = champ.participants || [];
                if (participants.some(p => p.userId === this.state.user.uid)) return false;
                
                // Only show public championships
                return champ.isPublic !== false; // Default to public if not specified
            });
            
            if (availableChampionships.length === 0) {
                championshipsList.innerHTML = `
                    <div class="text-center py-4 text-gray-400">
                        <i data-feather="award" class="w-8 h-8 mx-auto mb-2"></i>
                        <p class="mb-2">No championships available to join</p>
                        <p class="text-sm">You're already participating in all available championships!</p>
                    </div>
                `;
            } else {
                championshipsList.innerHTML = availableChampionships.map(champ => `
                    <div class="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-red-500 cursor-pointer transition-colors">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-medium text-white">${champ.name}</h4>
                            <span class="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                                ${(champ.participants || []).length} participants
                            </span>
                        </div>
                        <div class="text-sm text-gray-400 space-y-1">
                            <p><i data-feather="calendar" class="w-3 h-3 inline mr-1"></i> ${champ.startDate || 'Not set'}</p>
                            <p><i data-feather="flag" class="w-3 h-3 inline mr-1"></i> ${(champ.races || []).length} races planned</p>
                            ${champ.description ? `<p class="text-xs mt-2">${champ.description}</p>` : ''}
                        </div>
                        <button class="w-full mt-3 racing-btn text-sm py-2" onclick="App.joinChampionship('${champ.id}')">
                            Join Championship
                        </button>
                    </div>
                `).join('');
            }
            
            // Re-initialize feather icons
            setTimeout(() => feather.replace(), 100);
            
        } catch (error) {
            console.error('Error loading available championships:', error);
            championshipsList.innerHTML = `
                <div class="text-center py-4 text-red-400">
                    <p>Error loading championships</p>
                </div>
            `;
        }
    },

    async joinChampionship(championshipId) {
        try {
            if (!this.state.user) {
                this.showToast('Please log in to join championships', 'error');
                return;
            }

            const championship = this.state.championships.find(c => c.id === championshipId);
            if (!championship) {
                this.showToast('Championship not found', 'error');
                return;
            }

            // Check if user is already a participant
            const participants = championship.participants || [];
            if (participants.some(p => p.userId === this.state.user.uid)) {
                this.showToast('You are already participating in this championship', 'warning');
                return;
            }

            // Add user as participant
            const newParticipant = {
                userId: this.state.user.uid,
                username: this.state.user.displayName || this.state.user.email,
                email: this.state.user.email,
                joinedAt: new Date().toISOString(),
                isDriver: true // User joins as a driver by default
            };

            championship.participants = [...participants, newParticipant];

            // Update championship in Firebase
            await updateDoc(doc(db, 'championships', championshipId), {
                participants: championship.participants,
                lastUpdated: new Date().toISOString()
            });

            this.showToast(`Successfully joined ${championship.name}!`, 'success');
            this.hideModal('join-championship-modal');
            
            // Refresh the available championships list
            this.loadAvailableChampionships();

        } catch (error) {
            console.error('Error joining championship:', error);
            this.showToast('Failed to join championship', 'error');
        }
    },

    async joinRace(raceId, championshipId) {
        try {
            // Check if user is already registered for this championship
            const championship = this.state.championships.find(c => c.id === championshipId);
            if (!championship) {
                this.showToast('Championship not found', 'error');
                return;
            }
            
            const isAlreadyRegistered = championship.drivers && 
                championship.drivers.some(d => d.uid === this.state.user.uid);
            
            if (!isAlreadyRegistered) {
                this.showToast('You need to register for this championship first', 'error');
                return;
            }
            
            // Here you can add logic to register for specific race
            this.showToast('Joined race successfully!', 'success');
            this.hideModal('join-race-modal');
            
        } catch (error) {
            console.error('Error joining race:', error);
            this.showToast('Failed to join race', 'error');
        }
    },

    async manageRace(championshipId, raceId) {
        try {
            const championship = this.state.championships.find(c => c.id === championshipId);
            if (!championship) {
                this.showToast('Championship not found', 'error');
                return;
            }

            if (championship.ownerId !== this.state.user.uid) {
                this.showToast('Only championship owner can manage races', 'error');
                return;
            }

            const race = championship.races?.find(r => r.id === raceId);
            if (!race) {
                this.showToast('Race not found', 'error');
                return;
            }

            // Show race management modal
            this.showRaceManagementModal(championshipId, race);

        } catch (error) {
            console.error('Error managing race:', error);
            this.showToast('Failed to manage race', 'error');
        }
    },

    async viewRaceDetails(championshipId, raceId) {
        try {
            const championship = this.state.championships.find(c => c.id === championshipId);
            if (!championship) {
                this.showToast('Championship not found', 'error');
                return;
            }

            const race = championship.races?.find(r => r.id === raceId);
            if (!race) {
                this.showToast('Race not found', 'error');
                return;
            }

            // Show race details modal (read-only)
            this.showRaceDetailsModal(championship, race);

        } catch (error) {
            console.error('Error viewing race details:', error);
            this.showToast('Failed to view race details', 'error');
        }
    },

    showRaceManagementModal(championshipId, race) {
        // Create and show race management modal
        this.showToast(`Managing race: ${race.name}`, 'info');
        // TODO: Implement full race management interface
        console.log('Race management for:', race);
    },

    showRaceDetailsModal(championship, race) {
        // Create and show race details modal (read-only)
        this.showToast(`Viewing race: ${race.name}`, 'info');
        // TODO: Implement race details view interface
        console.log('Race details:', race, 'in championship:', championship.name);
    },

    createNewChampionship() {
        this.showModal('create-championship-modal');
    },
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            // Re-initialize Feather icons
            feather.replace();
        }
    },
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    },
    
    async handleCreateChampionship(event) {
        event.preventDefault();
        
        const name = document.getElementById('championship-name').value.trim();
        const series = document.getElementById('championship-series').value;
        const season = document.getElementById('championship-season').value.trim();
        const description = document.getElementById('championship-description').value.trim();
        
        if (!name || !season) {
            this.showToast('Please fill in required fields', 'error');
            return;
        }
        
        try {
            // Get form data for new fields
            const maxDriversSelect = document.getElementById('max-drivers');
            const customMaxDrivers = document.getElementById('custom-max-drivers');
            const requireApproval = document.getElementById('require-approval');
            const isPublic = document.getElementById('is-public');
            
            let maxDrivers = maxDriversSelect?.value || '20';
            if (maxDrivers === 'custom') {
                maxDrivers = parseInt(customMaxDrivers?.value) || 20;
            } else {
                maxDrivers = parseInt(maxDrivers) || 20;
            }
            
            // Create championship object
            const championshipData = {
                name,
                series,
                season,
                description,
                userId: this.state.user.uid,
                createdAt: new Date(),
                drivers: [],
                teams: [],
                races: [],
                maxDrivers: maxDrivers,
                requireApproval: requireApproval?.checked || false,
                isPublic: isPublic?.checked !== false,
                registrations: [], // Pending driver registrations
                rejectedUsers: [], // Users who were rejected
                activityScore: 0,
                settings: {
                    pointsSystem: this.getDefaultPointsSystem(series),
                    allowCustomPoints: false,
                    teamChampionship: true,
                    sprintRaces: false
                }
            };
            
            const championship = new Championship(championshipData);
            
            // Save to Firebase
            await setDoc(doc(db, 'championships', championship.id), championship.toFirestore());
            
            this.showToast(`Championship "${name}" created successfully! 🏆`, 'success');
            this.hideModal('create-championship-modal');
            
            // Clear form
            document.getElementById('championship-form').reset();
            
            // The real-time listener will automatically update the UI
            
        } catch (error) {
            console.error('Error creating championship:', error);
            this.showToast('Failed to create championship. Please try again.', 'error');
        }
    },

    createNewChampionship() {
        this.showModal('create-championship-modal');
    },

    // Points system helper method
    getDefaultPointsSystem(series) {
        const pointsSystems = {
            'f1': [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], // F1 points system
            'f2': [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], // F2 points system
            'f3': [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], // F3 points system
            'indycar': [50, 40, 35, 32, 30, 28, 26, 24, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5], // IndyCar
            'nascar': [40, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], // NASCAR
            'custom': [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] // Default for custom
        };
        
        return pointsSystems[series] || pointsSystems['custom'];
    },

    // Race management helper methods
    updatePosition(driverId, newPosition) {
        const { race } = this.currentRaceContext;
        const result = race.results.find(r => r.driverId === driverId);
        if (result) {
            result.position = parseInt(newPosition);
        }
    },

    updateLapTime(driverId, lapTime) {
        const { race } = this.currentRaceContext;
        const result = race.results.find(r => r.driverId === driverId);
        if (result) {
            result.lapTime = lapTime;
        }
    },

    updateTotalTime(driverId, totalTime) {
        const { race } = this.currentRaceContext;
        const result = race.results.find(r => r.driverId === driverId);
        if (result) {
            result.totalTime = totalTime;
        }
    },

    updateStatus(driverId, status) {
        const { race } = this.currentRaceContext;
        const result = race.results.find(r => r.driverId === driverId);
        if (result) {
            result.status = status;
        }
    },

    calculatePoints(championshipId, raceId) {
        const { championship, race } = this.currentRaceContext;
        const pointsSystem = championship.settings?.pointsSystem || [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        
        // Sort by position
        const sortedResults = [...race.results].sort((a, b) => a.position - b.position);
        
        sortedResults.forEach((result, index) => {
            if (result.status === 'finished') {
                result.points = pointsSystem[index] || 0;
            } else {
                result.points = 0;
            }
        });
        
        this.showToast('Points calculated based on positions!', 'success');
        // Refresh the modal
        this.openRaceManagementModal(championship, race);
    },

    async startRace(championshipId, raceId) {
        const { championship, race } = this.currentRaceContext;
        race.status = 'ongoing';
        race.startTime = new Date();
        
        await this.saveRaceResults(championshipId, raceId);
        this.showToast('Race started! 🏁', 'success');
    },

    async finishRace(championshipId, raceId) {
        const { championship, race } = this.currentRaceContext;
        race.status = 'completed';
        race.endTime = new Date();
        
        // Auto-calculate points
        this.calculatePoints(championshipId, raceId);
        
        await this.saveRaceResults(championshipId, raceId);
        this.showToast('Race finished! Results saved. 🏆', 'success');
    },

    resetRace(championshipId, raceId) {
        const { championship, race } = this.currentRaceContext;
        
        // Reset all results
        race.results.forEach((result, index) => {
            result.position = index + 1;
            result.lapTime = '';
            result.totalTime = '';
            result.points = 0;
            result.status = 'running';
        });
        
        race.status = 'scheduled';
        
        this.showToast('Race reset to initial state', 'info');
        // Refresh the modal
        this.openRaceManagementModal(championship, race);
    },

    async publishRaceResults(championshipId, raceId) {
        const { championship, race } = this.currentRaceContext;
        
        // Create a post with race results
        const topFinishers = race.results
            .filter(r => r.status === 'finished')
            .sort((a, b) => a.position - b.position)
            .slice(0, 3);
        
        const resultText = `🏁 ${race.name} Results:\n\n` +
            topFinishers.map((result, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                return `${medals[index] || `P${result.position}`} ${result.driverName} (${result.team || 'No Team'}) - ${result.points} pts`;
            }).join('\n') +
            `\n\n#${championship.name.replace(/\s+/g, '')} #RaceResults`;
        
        // Set the post content
        const postContent = document.getElementById('post-content');
        if (postContent) {
            postContent.value = resultText;
        }
        
        // Close modal and focus on post area
        document.querySelector('.fixed.inset-0').remove();
        if (postContent) {
            postContent.focus();
        }
        
        this.showToast('Race results ready to publish! 📱', 'success');
    },

    // Driver registration system
    async requestToJoin(championshipId) {
        try {
            const championship = this.state.championships.find(c => c.id === championshipId);
            if (!championship) {
                this.showToast('Championship not found', 'error');
                return;
            }

            // Check if already registered or pending
            if (championship.drivers?.find(d => d.userId === this.state.user.uid)) {
                this.showToast('You are already in this championship!', 'info');
                return;
            }

            if (championship.registrations?.find(r => r.userId === this.state.user.uid)) {
                this.showToast('Your registration is already pending approval', 'info');
                return;
            }

            // Check if championship is full
            if ((championship.drivers?.length || 0) >= (championship.maxDrivers || 20)) {
                this.showToast('Championship is full!', 'error');
                return;
            }

            const registration = {
                userId: this.state.user.uid,
                driverName: this.state.user.displayName || this.state.user.email,
                email: this.state.user.email,
                requestedAt: new Date().toISOString()
            };

            if (!championship.registrations) championship.registrations = [];
            championship.registrations.push(registration);

            await updateDoc(doc(db, 'championships', championshipId), {
                registrations: championship.registrations
            });

            this.showToast('Registration request sent! Wait for approval. 📩', 'success');
            
        } catch (error) {
            console.error('Error requesting to join:', error);
            this.showToast('Failed to send registration request', 'error');
        }
    },

    async approveRegistration(championshipId, userId) {
        try {
            const championship = this.state.championships.find(c => c.id === championshipId);
            const registration = championship.registrations?.find(r => r.userId === userId);
            
            if (!registration) return;

            // Create driver object
            const newDriver = {
                id: Date.now().toString(),
                userId: userId,
                name: registration.driverName,
                email: registration.email,
                team: '',
                number: '',
                points: 0,
                wins: 0,
                podiums: 0,
                joinedAt: new Date().toISOString()
            };

            if (!championship.drivers) championship.drivers = [];
            championship.drivers.push(newDriver);
            
            // Remove from pending registrations
            championship.registrations = championship.registrations.filter(r => r.userId !== userId);

            await updateDoc(doc(db, 'championships', championshipId), {
                drivers: championship.drivers,
                registrations: championship.registrations
            });

            this.showToast(`${registration.driverName} approved! 🏁`, 'success');
            
            // Refresh modal if open
            const modal = document.querySelector('.glass-card .max-w-4xl');
            if (modal) {
                modal.closest('.fixed').remove();
                this.showChampionshipDetails(championshipId);
            }
            
        } catch (error) {
            console.error('Error approving registration:', error);
            this.showToast('Failed to approve registration', 'error');
        }
    },

    async rejectRegistration(championshipId, userId) {
        try {
            const championship = this.state.championships.find(c => c.id === championshipId);
            const registration = championship.registrations?.find(r => r.userId === userId);
            
            if (!registration) return;

            // Add to rejected list
            if (!championship.rejectedUsers) championship.rejectedUsers = [];
            championship.rejectedUsers.push({
                userId: userId,
                rejectedAt: new Date().toISOString()
            });
            
            // Remove from pending registrations
            championship.registrations = championship.registrations.filter(r => r.userId !== userId);

            await updateDoc(doc(db, 'championships', championshipId), {
                registrations: championship.registrations,
                rejectedUsers: championship.rejectedUsers
            });

            this.showToast(`${registration.driverName} registration rejected`, 'info');
            
            // Refresh modal if open
            const modal = document.querySelector('.glass-card .max-w-4xl');
            if (modal) {
                modal.closest('.fixed').remove();
                this.showChampionshipDetails(championshipId);
            }
            
        } catch (error) {
            console.error('Error rejecting registration:', error);
            this.showToast('Failed to reject registration', 'error');
        }
    },

    async saveRaceResults(championshipId, raceId) {
        try {
            const { championship, race } = this.currentRaceContext;
            
            // Update championship in Firebase
            await updateDoc(doc(db, 'championships', championshipId), {
                races: championship.races,
                lastUpdated: new Date().toISOString()
            });
            
            // Update driver points in championship
            race.results.forEach(result => {
                const driver = championship.drivers.find(d => d.id === result.driverId);
                if (driver && result.points > 0) {
                    driver.points = (driver.points || 0) + result.points;
                    if (result.position === 1) {
                        driver.wins = (driver.wins || 0) + 1;
                    }
                    if (result.position <= 3) {
                        driver.podiums = (driver.podiums || 0) + 1;
                    }
                }
            });
            
            // Update championship with new driver stats
            await updateDoc(doc(db, 'championships', championshipId), {
                drivers: championship.drivers,
                lastUpdated: new Date().toISOString()
            });
            
            this.showToast('Race results saved successfully! 💾', 'success');
            
        } catch (error) {
            console.error('Error saving race results:', error);
            this.showToast('Failed to save race results', 'error');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.App = Object.create(App).initialize();
    window.app = window.App; // Backward compatibility
});

export { App };