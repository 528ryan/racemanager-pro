/**
 * ChampionshipService - Microserviço para gerenciamento de campeonatos
 */
import { EventBus } from '../core/EventBus.js';
import { StateManager } from '../core/StateManager.js';
import { serviceLocator } from '../core/ServiceLocator.js';

export class ChampionshipService {
    constructor() {
        this.eventBus = serviceLocator.get('EventBus');
        this.stateManager = serviceLocator.get('StateManager');
        this.firebaseService = null; // Will be injected
        
        this.unsubscribeCallbacks = [];
        this.init();
        
        console.log('🏆 ChampionshipService initialized');
    }

    init() {
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize state
        this.stateManager.setState('championships', {
            active: null,
            userChampionships: [],
            publicChampionships: [],
            isLoading: false,
            error: null
        });
    }

    setupEventListeners() {
        // Listen for championship-related events
        this.eventBus.on('championship:create', this.createChampionship.bind(this));
        this.eventBus.on('championship:join', this.joinChampionship.bind(this));
        this.eventBus.on('championship:leave', this.leaveChampionship.bind(this));
        this.eventBus.on('championship:select', this.selectChampionship.bind(this));
        this.eventBus.on('championship:update', this.updateChampionship.bind(this));
        this.eventBus.on('championship:delete', this.deleteChampionship.bind(this));
        this.eventBus.on('championship:loadPublic', this.loadPublicChampionships.bind(this));
        this.eventBus.on('user:authenticated', this.onUserAuthenticated.bind(this));
        this.eventBus.on('user:logout', this.onUserLogout.bind(this));
    }

    /**
     * Set Firebase service dependency
     */
    setFirebaseService(firebaseService) {
        this.firebaseService = firebaseService;
    }

    /**
     * Create new championship
     */
    async createChampionship(data) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('championships.isLoading', true);
            this.stateManager.setState('championships.error', null);

            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            const championshipData = {
                ...data,
                userId: user.uid,
                creatorName: user.displayName || user.email,
                participants: [user.uid],
                participantNames: [user.displayName || user.email],
                isActive: true,
                season: new Date().getFullYear()
            };

            const championshipId = await this.firebaseService.createChampionship(championshipData);
            
            console.log('Championship created successfully:', championshipId);
            this.eventBus.emit('championship:created', { id: championshipId, ...championshipData });
            
            // Load user championships to refresh the list
            await this.loadUserChampionships();

        } catch (error) {
            console.error('Error creating championship:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'create', error: error.message });
        } finally {
            this.stateManager.setState('championships.isLoading', false);
        }
    }

    /**
     * Join an existing championship
     */
    async joinChampionship(championshipId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('championships.isLoading', true);

            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            const championship = await this.firebaseService.getChampionship(championshipId);
            if (!championship) {
                throw new Error('Championship not found');
            }

            // Check if user is already a participant
            if (championship.participants && championship.participants.includes(user.uid)) {
                throw new Error('You are already a participant in this championship');
            }

            // Add user to championship
            const updatedParticipants = [...(championship.participants || []), user.uid];
            const updatedParticipantNames = [...(championship.participantNames || []), user.displayName || user.email];

            await this.firebaseService.updateChampionship(championshipId, {
                participants: updatedParticipants,
                participantNames: updatedParticipantNames
            });

            console.log('Successfully joined championship:', championshipId);
            this.eventBus.emit('championship:joined', { championshipId, userId: user.uid });
            
            // Refresh both user and public championships
            await this.loadUserChampionships();
            await this.loadPublicChampionships();

        } catch (error) {
            console.error('Error joining championship:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'join', error: error.message });
        } finally {
            this.stateManager.setState('championships.isLoading', false);
        }
    }

    /**
     * Leave a championship
     */
    async leaveChampionship(championshipId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('championships.isLoading', true);

            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            const championship = await this.firebaseService.getChampionship(championshipId);
            if (!championship) {
                throw new Error('Championship not found');
            }

            // Remove user from championship
            const updatedParticipants = (championship.participants || []).filter(id => id !== user.uid);
            const updatedParticipantNames = (championship.participantNames || []).filter(name => name !== (user.displayName || user.email));

            await this.firebaseService.updateChampionship(championshipId, {
                participants: updatedParticipants,
                participantNames: updatedParticipantNames
            });

            console.log('Successfully left championship:', championshipId);
            this.eventBus.emit('championship:left', { championshipId, userId: user.uid });
            
            // Refresh championships
            await this.loadUserChampionships();

        } catch (error) {
            console.error('Error leaving championship:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'leave', error: error.message });
        } finally {
            this.stateManager.setState('championships.isLoading', false);
        }
    }

    /**
     * Select active championship
     */
    async selectChampionship(championshipId) {
        try {
            if (!championshipId) {
                this.stateManager.setState('championships.active', null);
                this.eventBus.emit('championship:selected', null);
                return;
            }

            const championship = await this.firebaseService.getChampionship(championshipId);
            if (!championship) {
                throw new Error('Championship not found');
            }

            this.stateManager.setState('championships.active', championship);
            this.eventBus.emit('championship:selected', championship);
            
            console.log('Championship selected:', championship.name);

        } catch (error) {
            console.error('Error selecting championship:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'select', error: error.message });
        }
    }

    /**
     * Update championship
     */
    async updateChampionship(data) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('championships.isLoading', true);

            const { id, ...updates } = data;
            if (!id) {
                throw new Error('Championship ID is required');
            }

            await this.firebaseService.updateChampionship(id, updates);
            
            console.log('Championship updated successfully:', id);
            this.eventBus.emit('championship:updated', { id, updates });
            
            // Refresh championships
            await this.loadUserChampionships();
            
            // If this is the active championship, refresh it
            const activeChampionship = this.stateManager.getState('championships.active');
            if (activeChampionship && activeChampionship.id === id) {
                await this.selectChampionship(id);
            }

        } catch (error) {
            console.error('Error updating championship:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'update', error: error.message });
        } finally {
            this.stateManager.setState('championships.isLoading', false);
        }
    }

    /**
     * Delete championship
     */
    async deleteChampionship(championshipId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('championships.isLoading', true);

            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            const championship = await this.firebaseService.getChampionship(championshipId);
            if (!championship) {
                throw new Error('Championship not found');
            }

            // Check if user is the creator
            if (championship.userId !== user.uid) {
                throw new Error('Only the creator can delete this championship');
            }

            await this.firebaseService.deleteChampionship(championshipId);
            
            console.log('Championship deleted successfully:', championshipId);
            this.eventBus.emit('championship:deleted', championshipId);
            
            // If this was the active championship, clear it
            const activeChampionship = this.stateManager.getState('championships.active');
            if (activeChampionship && activeChampionship.id === championshipId) {
                this.stateManager.setState('championships.active', null);
            }
            
            // Refresh championships
            await this.loadUserChampionships();

        } catch (error) {
            console.error('Error deleting championship:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'delete', error: error.message });
        } finally {
            this.stateManager.setState('championships.isLoading', false);
        }
    }

    /**
     * Load user's championships
     */
    async loadUserChampionships() {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                this.stateManager.setState('championships.userChampionships', []);
                return;
            }

            // Set up real-time listener for user's championships
            const unsubscribe = this.firebaseService.onChampionshipsSnapshot(
                (championships) => {
                    // Filter championships where user is participant or creator
                    const userChampionships = championships.filter(championship => 
                        championship.userId === user.uid || 
                        (championship.participants && championship.participants.includes(user.uid))
                    );
                    
                    this.stateManager.setState('championships.userChampionships', userChampionships);
                    this.eventBus.emit('championships:userLoaded', userChampionships);
                },
                { userId: user.uid }
            );

            this.unsubscribeCallbacks.push(unsubscribe);

        } catch (error) {
            console.error('Error loading user championships:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'loadUser', error: error.message });
        }
    }

    /**
     * Load public championships
     */
    async loadPublicChampionships() {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('championships.isLoading', true);

            const championships = await this.firebaseService.getPublicChampionships();
            
            // Filter out championships user is already in
            const user = this.stateManager.getState('auth.user');
            const availableChampionships = user ? championships.filter(championship => 
                championship.userId !== user.uid && 
                (!championship.participants || !championship.participants.includes(user.uid))
            ) : championships;

            this.stateManager.setState('championships.publicChampionships', availableChampionships);
            this.eventBus.emit('championships:publicLoaded', availableChampionships);

        } catch (error) {
            console.error('Error loading public championships:', error);
            this.stateManager.setState('championships.error', error.message);
            this.eventBus.emit('championship:error', { type: 'loadPublic', error: error.message });
        } finally {
            this.stateManager.setState('championships.isLoading', false);
        }
    }

    /**
     * Calculate championship standings
     */
    calculateStandings(championship, results) {
        if (!championship || !championship.drivers || !results) {
            return [];
        }

        const standings = {};

        // Initialize standings for all drivers
        championship.drivers.forEach(driver => {
            standings[driver.id] = {
                id: driver.id,
                name: driver.name,
                team: driver.team,
                points: 0,
                wins: 0,
                podiums: 0,
                racesCompleted: 0
            };
        });

        // Calculate points from all races
        Object.values(results).forEach(raceResults => {
            Object.values(raceResults).forEach(result => {
                if (standings[result.driverId]) {
                    standings[result.driverId].points += result.points || 0;
                    standings[result.driverId].racesCompleted += 1;
                    
                    if (result.position === 1) standings[result.driverId].wins += 1;
                    if (result.position <= 3) standings[result.driverId].podiums += 1;
                }
            });
        });

        // Convert to array and sort by points
        return Object.values(standings).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.podiums - a.podiums;
        });
    }

    /**
     * Get championship statistics
     */
    getChampionshipStats(championship, results) {
        if (!championship || !results) {
            return {
                totalRaces: 0,
                completedRaces: 0,
                totalDrivers: 0,
                averageParticipation: 0
            };
        }

        const totalRaces = championship.races ? championship.races.length : 0;
        const completedRaces = Object.keys(results).length;
        const totalDrivers = championship.drivers ? championship.drivers.length : 0;
        
        let totalParticipations = 0;
        Object.values(results).forEach(raceResults => {
            totalParticipations += Object.keys(raceResults).length;
        });

        const averageParticipation = completedRaces > 0 ? 
            (totalParticipations / completedRaces) / totalDrivers * 100 : 0;

        return {
            totalRaces,
            completedRaces,
            totalDrivers,
            averageParticipation: Math.round(averageParticipation)
        };
    }

    /**
     * Handle user authentication
     */
    async onUserAuthenticated(userData) {
        console.log('ChampionshipService: User authenticated, loading championships');
        await this.loadUserChampionships();
    }

    /**
     * Handle user logout
     */
    onUserLogout() {
        console.log('ChampionshipService: User logged out, clearing championships');
        
        // Unsubscribe from all listeners
        this.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.unsubscribeCallbacks = [];

        // Clear state
        this.stateManager.setState('championships', {
            active: null,
            userChampionships: [],
            publicChampionships: [],
            isLoading: false,
            error: null
        });
    }

    /**
     * Get current active championship
     */
    getActiveChampionship() {
        return this.stateManager.getState('championships.active');
    }

    /**
     * Get user championships
     */
    getUserChampionships() {
        return this.stateManager.getState('championships.userChampionships') || [];
    }

    /**
     * Get public championships
     */
    getPublicChampionships() {
        return this.stateManager.getState('championships.publicChampionships') || [];
    }

    /**
     * Cleanup service
     */
    destroy() {
        // Unsubscribe from all listeners
        this.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.unsubscribeCallbacks = [];

        console.log('🏆 ChampionshipService destroyed');
    }
}
