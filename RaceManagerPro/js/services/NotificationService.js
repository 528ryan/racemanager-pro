/**
 * NotificationService - Microserviço para gerenciamento de notificações
 */
import { EventBus } from '../core/EventBus.js';
import { StateManager } from '../core/StateManager.js';
import { serviceLocator } from '../core/ServiceLocator.js';

export class NotificationService {
    constructor() {
        this.eventBus = serviceLocator.get('EventBus');
        this.stateManager = serviceLocator.get('StateManager');
        this.firebaseService = null; // Will be injected
        
        this.unsubscribeCallbacks = [];
        this.notificationQueue = [];
        this.isProcessingQueue = false;
        
        this.init();
        
        console.log('🔔 NotificationService initialized');
    }

    init() {
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize state
        this.stateManager.setState('notifications', {
            items: [],
            unreadCount: 0,
            isLoading: false,
            error: null,
            settings: {
                enableBrowser: true,
                enableInApp: true,
                enableSound: true,
                enableEmail: false
            }
        });

        // Request browser notification permission if supported
        this.requestBrowserNotificationPermission();
    }

    setupEventListeners() {
        // Listen for notification-related events
        this.eventBus.on('notification:create', this.createNotification.bind(this));
        this.eventBus.on('notification:markAsRead', this.markAsRead.bind(this));
        this.eventBus.on('notification:markAllAsRead', this.markAllAsRead.bind(this));
        this.eventBus.on('notification:delete', this.deleteNotification.bind(this));
        this.eventBus.on('notification:updateSettings', this.updateSettings.bind(this));
        
        // Listen for events that should trigger notifications
        this.eventBus.on('championship:joined', this.onChampionshipJoined.bind(this));
        this.eventBus.on('championship:raceStarted', this.onRaceStarted.bind(this));
        this.eventBus.on('championship:raceFinished', this.onRaceFinished.bind(this));
        this.eventBus.on('social:postLiked', this.onPostLiked.bind(this));
        this.eventBus.on('social:commentAdded', this.onCommentAdded.bind(this));
        this.eventBus.on('social:userFollowed', this.onUserFollowed.bind(this));
        
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
     * Request browser notification permission
     */
    async requestBrowserNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                console.log('Browser notification permission:', permission);
                
                this.stateManager.setState('notifications.settings.enableBrowser', permission === 'granted');
                
            } catch (error) {
                console.warn('Error requesting notification permission:', error);
            }
        }
    }

    /**
     * Create a new notification
     */
    async createNotification(notificationData) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            const settings = this.stateManager.getState('notifications.settings');
            
            const notification = {
                ...notificationData,
                id: notificationData.id || Date.now().toString(),
                isRead: false,
                createdAt: new Date().toISOString()
            };

            // Save to Firebase if user is authenticated
            if (user && notificationData.userId === user.uid) {
                await this.firebaseService.createDocument('notifications', notification);
            }

            // Show in-app notification if enabled
            if (settings.enableInApp) {
                this.showInAppNotification(notification);
            }

            // Show browser notification if enabled and user is the target
            if (settings.enableBrowser && user && notificationData.userId === user.uid) {
                this.showBrowserNotification(notification);
            }

            // Play sound if enabled
            if (settings.enableSound && user && notificationData.userId === user.uid) {
                this.playNotificationSound();
            }

            console.log('Notification created:', notification.id);
            this.eventBus.emit('notification:created', notification);

        } catch (error) {
            console.error('Error creating notification:', error);
            this.stateManager.setState('notifications.error', error.message);
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            await this.firebaseService.updateDocument('notifications', notificationId, {
                isRead: true,
                readAt: new Date().toISOString()
            });

            // Update local state
            const notifications = this.stateManager.getState('notifications.items') || [];
            const updatedNotifications = notifications.map(notification => 
                notification.id === notificationId 
                    ? { ...notification, isRead: true, readAt: new Date().toISOString() }
                    : notification
            );

            this.stateManager.setState('notifications.items', updatedNotifications);
            this.updateUnreadCount(updatedNotifications);

            console.log('Notification marked as read:', notificationId);
            this.eventBus.emit('notification:read', notificationId);

        } catch (error) {
            console.error('Error marking notification as read:', error);
            this.stateManager.setState('notifications.error', error.message);
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            const notifications = this.stateManager.getState('notifications.items') || [];
            const unreadNotifications = notifications.filter(n => !n.isRead);

            // Update all unread notifications in Firebase
            const updatePromises = unreadNotifications.map(notification =>
                this.firebaseService.updateDocument('notifications', notification.id, {
                    isRead: true,
                    readAt: new Date().toISOString()
                })
            );

            await Promise.all(updatePromises);

            // Update local state
            const updatedNotifications = notifications.map(notification => ({
                ...notification,
                isRead: true,
                readAt: notification.readAt || new Date().toISOString()
            }));

            this.stateManager.setState('notifications.items', updatedNotifications);
            this.stateManager.setState('notifications.unreadCount', 0);

            console.log('All notifications marked as read');
            this.eventBus.emit('notifications:allRead');

        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            this.stateManager.setState('notifications.error', error.message);
        }
    }

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            await this.firebaseService.deleteDocument('notifications', notificationId);

            // Update local state
            const notifications = this.stateManager.getState('notifications.items') || [];
            const updatedNotifications = notifications.filter(n => n.id !== notificationId);

            this.stateManager.setState('notifications.items', updatedNotifications);
            this.updateUnreadCount(updatedNotifications);

            console.log('Notification deleted:', notificationId);
            this.eventBus.emit('notification:deleted', notificationId);

        } catch (error) {
            console.error('Error deleting notification:', error);
            this.stateManager.setState('notifications.error', error.message);
        }
    }

    /**
     * Update notification settings
     */
    updateSettings(newSettings) {
        const currentSettings = this.stateManager.getState('notifications.settings');
        const updatedSettings = { ...currentSettings, ...newSettings };

        this.stateManager.setState('notifications.settings', updatedSettings);

        // Save to localStorage
        localStorage.setItem('notificationSettings', JSON.stringify(updatedSettings));

        console.log('Notification settings updated:', updatedSettings);
        this.eventBus.emit('notifications:settingsUpdated', updatedSettings);
    }

    /**
     * Load user's notifications
     */
    async loadNotifications() {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('notifications.isLoading', true);

            const user = this.stateManager.getState('auth.user');
            if (!user) {
                this.stateManager.setState('notifications.items', []);
                this.stateManager.setState('notifications.unreadCount', 0);
                return;
            }

            // Set up real-time listener for notifications
            const unsubscribe = this.firebaseService.onCollectionSnapshot(
                'notifications',
                (notifications) => {
                    this.stateManager.setState('notifications.items', notifications);
                    this.updateUnreadCount(notifications);
                    this.eventBus.emit('notifications:loaded', notifications);
                },
                [{ field: 'userId', operator: '==', value: user.uid }],
                'createdAt',
                'desc'
            );

            this.unsubscribeCallbacks.push(unsubscribe);

        } catch (error) {
            console.error('Error loading notifications:', error);
            this.stateManager.setState('notifications.error', error.message);
        } finally {
            this.stateManager.setState('notifications.isLoading', false);
        }
    }

    /**
     * Update unread count
     */
    updateUnreadCount(notifications) {
        const unreadCount = notifications.filter(n => !n.isRead).length;
        this.stateManager.setState('notifications.unreadCount', unreadCount);
        
        // Update page title with unread count
        this.updatePageTitle(unreadCount);
    }

    /**
     * Update page title with unread count
     */
    updatePageTitle(unreadCount) {
        const baseTitle = 'RaceManager Pro';
        document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
    }

    /**
     * Show in-app notification
     */
    showInAppNotification(notification) {
        // Create a temporary notification element
        const notificationEl = document.createElement('div');
        notificationEl.className = 'in-app-notification';
        notificationEl.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">🔔</div>
                <div class="notification-text">
                    <div class="notification-title">${notification.title || 'Notification'}</div>
                    <div class="notification-message">${notification.message}</div>
                </div>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add styles
        notificationEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        // Add to document
        document.body.appendChild(notificationEl);

        // Animate in
        setTimeout(() => {
            notificationEl.style.transform = 'translateX(0)';
        }, 100);

        // Handle close button
        const closeBtn = notificationEl.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeInAppNotification(notificationEl);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            this.removeInAppNotification(notificationEl);
        }, 5000);
    }

    /**
     * Remove in-app notification
     */
    removeInAppNotification(notificationEl) {
        if (notificationEl && notificationEl.parentNode) {
            notificationEl.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notificationEl.parentNode) {
                    notificationEl.parentNode.removeChild(notificationEl);
                }
            }, 300);
        }
    }

    /**
     * Show browser notification
     */
    showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const browserNotification = new Notification(
                    notification.title || 'RaceManager Pro',
                    {
                        body: notification.message,
                        icon: '/favicon.ico',
                        tag: notification.id,
                        requireInteraction: false
                    }
                );

                // Auto close after 5 seconds
                setTimeout(() => {
                    browserNotification.close();
                }, 5000);

                // Handle click to focus the app
                browserNotification.addEventListener('click', () => {
                    window.focus();
                    browserNotification.close();
                });

            } catch (error) {
                console.warn('Error showing browser notification:', error);
            }
        }
    }

    /**
     * Play notification sound
     */
    playNotificationSound() {
        try {
            // Create a simple notification sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);

        } catch (error) {
            console.warn('Error playing notification sound:', error);
        }
    }

    // Event handlers for automatic notifications

    /**
     * Handle championship joined event
     */
    async onChampionshipJoined({ championshipId, userId }) {
        // Notify championship creator about new participant
        const championship = await this.firebaseService.getChampionship(championshipId);
        if (championship && championship.userId !== userId) {
            const user = await this.firebaseService.getUserProfile(userId);
            
            await this.createNotification({
                userId: championship.userId,
                type: 'championship_join',
                title: 'New Participant',
                message: `${user?.displayName || 'Someone'} joined your championship "${championship.name}"`,
                championshipId,
                fromUserId: userId
            });
        }
    }

    /**
     * Handle race started event
     */
    async onRaceStarted({ championship, race }) {
        if (!championship.participants) return;

        // Notify all participants about race start
        const notifications = championship.participants.map(participantId => ({
            userId: participantId,
            type: 'race_start',
            title: 'Race Started!',
            message: `Race "${race.name}" has started in championship "${championship.name}"`,
            championshipId: championship.id,
            raceId: race.id
        }));

        // Create notifications in batch
        await Promise.all(notifications.map(notification => 
            this.createNotification(notification)
        ));
    }

    /**
     * Handle race finished event
     */
    async onRaceFinished({ championship, race, results }) {
        if (!championship.participants) return;

        // Notify participants about race completion
        const notifications = championship.participants.map(participantId => {
            const result = results[participantId];
            const message = result 
                ? `Race "${race.name}" finished! You placed ${result.position} with ${result.points} points.`
                : `Race "${race.name}" has finished in championship "${championship.name}"`;

            return {
                userId: participantId,
                type: 'race_finish',
                title: 'Race Finished',
                message,
                championshipId: championship.id,
                raceId: race.id
            };
        });

        // Create notifications in batch
        await Promise.all(notifications.map(notification => 
            this.createNotification(notification)
        ));
    }

    /**
     * Handle post liked event
     */
    async onPostLiked({ postId, userId, isLiked }) {
        if (!isLiked) return; // Only notify on new likes, not unlikes

        const post = await this.firebaseService.getDocument('posts', postId);
        if (post && post.userId !== userId) {
            const user = await this.firebaseService.getUserProfile(userId);
            
            await this.createNotification({
                userId: post.userId,
                type: 'post_like',
                title: 'Post Liked',
                message: `${user?.displayName || 'Someone'} liked your post`,
                postId,
                fromUserId: userId
            });
        }
    }

    /**
     * Handle comment added event
     */
    async onCommentAdded({ postId, comment }) {
        const post = await this.firebaseService.getDocument('posts', postId);
        if (post && post.userId !== comment.userId) {
            await this.createNotification({
                userId: post.userId,
                type: 'post_comment',
                title: 'New Comment',
                message: `${comment.userName} commented on your post: "${comment.text.substring(0, 50)}..."`,
                postId,
                fromUserId: comment.userId
            });
        }
    }

    /**
     * Handle user followed event
     */
    async onUserFollowed({ targetUserId, followerId }) {
        const follower = await this.firebaseService.getUserProfile(followerId);
        
        await this.createNotification({
            userId: targetUserId,
            type: 'user_follow',
            title: 'New Follower',
            message: `${follower?.displayName || 'Someone'} started following you`,
            fromUserId: followerId
        });
    }

    /**
     * Handle user authentication
     */
    async onUserAuthenticated(userData) {
        console.log('NotificationService: User authenticated, loading notifications');
        
        // Load notification settings from localStorage
        const savedSettings = localStorage.getItem('notificationSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                this.stateManager.setState('notifications.settings', { 
                    ...this.stateManager.getState('notifications.settings'), 
                    ...settings 
                });
            } catch (error) {
                console.warn('Error parsing saved notification settings:', error);
            }
        }

        await this.loadNotifications();
    }

    /**
     * Handle user logout
     */
    onUserLogout() {
        console.log('NotificationService: User logged out, clearing notifications');
        
        // Unsubscribe from all listeners
        this.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.unsubscribeCallbacks = [];

        // Clear state
        this.stateManager.setState('notifications', {
            items: [],
            unreadCount: 0,
            isLoading: false,
            error: null,
            settings: this.stateManager.getState('notifications.settings') // Keep settings
        });

        // Reset page title
        document.title = 'MotorSport Pro';
    }

    /**
     * Get notifications
     */
    getNotifications() {
        return this.stateManager.getState('notifications.items') || [];
    }

    /**
     * Get unread count
     */
    getUnreadCount() {
        return this.stateManager.getState('notifications.unreadCount') || 0;
    }

    /**
     * Get notification settings
     */
    getSettings() {
        return this.stateManager.getState('notifications.settings');
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

        // Remove all in-app notifications
        const inAppNotifications = document.querySelectorAll('.in-app-notification');
        inAppNotifications.forEach(notification => {
            this.removeInAppNotification(notification);
        });

        // Reset page title
        document.title = 'MotorSport Pro';

        console.log('🔔 NotificationService destroyed');
    }
}
