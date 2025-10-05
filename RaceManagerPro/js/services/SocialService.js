/**
 * SocialService - Microserviço para funcionalidades sociais
 */
import { EventBus } from '../core/EventBus.js';
import { StateManager } from '../core/StateManager.js';
import { serviceLocator } from '../core/ServiceLocator.js';

export class SocialService {
    constructor() {
        this.eventBus = serviceLocator.get('EventBus');
        this.stateManager = serviceLocator.get('StateManager');
        this.firebaseService = null; // Will be injected
        
        this.unsubscribeCallbacks = [];
        this.init();
        
        console.log('🤝 SocialService initialized');
    }

    init() {
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize state
        this.stateManager.setState('social', {
            posts: [],
            userPosts: [],
            following: [],
            followers: [],
            isLoading: false,
            error: null,
            notifications: []
        });
    }

    setupEventListeners() {
        // Listen for social-related events
        this.eventBus.on('social:createPost', this.createPost.bind(this));
        this.eventBus.on('social:deletePost', this.deletePost.bind(this));
        this.eventBus.on('social:likePost', this.likePost.bind(this));
        this.eventBus.on('social:commentOnPost', this.commentOnPost.bind(this));
        this.eventBus.on('social:followUser', this.followUser.bind(this));
        this.eventBus.on('social:unfollowUser', this.unfollowUser.bind(this));
        this.eventBus.on('social:loadFeed', this.loadFeed.bind(this));
        this.eventBus.on('social:loadUserPosts', this.loadUserPosts.bind(this));
        this.eventBus.on('social:shareResult', this.shareResult.bind(this));
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
     * Create a new post
     */
    async createPost(postData) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('social.isLoading', true);
            this.stateManager.setState('social.error', null);

            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            const post = {
                ...postData,
                userId: user.uid,
                userName: user.displayName || user.email,
                userAvatar: user.photoURL || '',
                likes: [],
                comments: [],
                likeCount: 0,
                commentCount: 0,
                isPublic: postData.isPublic !== false // Default to public
            };

            const postId = await this.firebaseService.createPost(post);
            
            console.log('Post created successfully:', postId);
            this.eventBus.emit('social:postCreated', { id: postId, ...post });
            
        } catch (error) {
            console.error('Error creating post:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'createPost', error: error.message });
        } finally {
            this.stateManager.setState('social.isLoading', false);
        }
    }

    /**
     * Delete a post
     */
    async deletePost(postId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('social.isLoading', true);

            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Get post to check ownership
            const post = await this.firebaseService.getDocument('posts', postId);
            if (!post) {
                throw new Error('Post not found');
            }

            if (post.userId !== user.uid) {
                throw new Error('You can only delete your own posts');
            }

            await this.firebaseService.deletePost(postId);
            
            console.log('Post deleted successfully:', postId);
            this.eventBus.emit('social:postDeleted', postId);
            
        } catch (error) {
            console.error('Error deleting post:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'deletePost', error: error.message });
        } finally {
            this.stateManager.setState('social.isLoading', false);
        }
    }

    /**
     * Like/unlike a post
     */
    async likePost({ postId, isLiked }) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Get current post data
            const post = await this.firebaseService.getDocument('posts', postId);
            if (!post) {
                throw new Error('Post not found');
            }

            const currentLikes = post.likes || [];
            let updatedLikes;

            if (isLiked) {
                // Remove like
                updatedLikes = currentLikes.filter(userId => userId !== user.uid);
            } else {
                // Add like
                updatedLikes = [...currentLikes, user.uid];
            }

            await this.firebaseService.updatePost(postId, {
                likes: updatedLikes,
                likeCount: updatedLikes.length
            });

            console.log(`Post ${isLiked ? 'unliked' : 'liked'}:`, postId);
            this.eventBus.emit('social:postLiked', { postId, userId: user.uid, isLiked: !isLiked });

            // Create notification for post owner (if not self-like)
            if (post.userId !== user.uid && !isLiked) {
                await this.createNotification({
                    userId: post.userId,
                    type: 'like',
                    fromUserId: user.uid,
                    fromUserName: user.displayName || user.email,
                    postId: postId,
                    message: `${user.displayName || user.email} liked your post`
                });
            }
            
        } catch (error) {
            console.error('Error liking post:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'likePost', error: error.message });
        }
    }

    /**
     * Comment on a post
     */
    async commentOnPost({ postId, comment }) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Get current post data
            const post = await this.firebaseService.getDocument('posts', postId);
            if (!post) {
                throw new Error('Post not found');
            }

            const newComment = {
                id: Date.now().toString(),
                userId: user.uid,
                userName: user.displayName || user.email,
                userAvatar: user.photoURL || '',
                text: comment,
                createdAt: new Date().toISOString()
            };

            const currentComments = post.comments || [];
            const updatedComments = [...currentComments, newComment];

            await this.firebaseService.updatePost(postId, {
                comments: updatedComments,
                commentCount: updatedComments.length
            });

            console.log('Comment added to post:', postId);
            this.eventBus.emit('social:commentAdded', { postId, comment: newComment });

            // Create notification for post owner (if not self-comment)
            if (post.userId !== user.uid) {
                await this.createNotification({
                    userId: post.userId,
                    type: 'comment',
                    fromUserId: user.uid,
                    fromUserName: user.displayName || user.email,
                    postId: postId,
                    message: `${user.displayName || user.email} commented on your post`
                });
            }
            
        } catch (error) {
            console.error('Error commenting on post:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'commentOnPost', error: error.message });
        }
    }

    /**
     * Follow a user
     */
    async followUser(targetUserId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            if (targetUserId === user.uid) {
                throw new Error('Cannot follow yourself');
            }

            // Update current user's following list
            const currentUserProfile = await this.firebaseService.getUserProfile(user.uid);
            const currentFollowing = currentUserProfile?.following || [];
            
            if (currentFollowing.includes(targetUserId)) {
                throw new Error('Already following this user');
            }

            const updatedFollowing = [...currentFollowing, targetUserId];

            await this.firebaseService.updateUserProfile(user.uid, {
                following: updatedFollowing
            });

            // Update target user's followers list
            const targetUserProfile = await this.firebaseService.getUserProfile(targetUserId);
            const currentFollowers = targetUserProfile?.followers || [];
            const updatedFollowers = [...currentFollowers, user.uid];

            await this.firebaseService.updateUserProfile(targetUserId, {
                followers: updatedFollowers
            });

            console.log('Successfully followed user:', targetUserId);
            this.eventBus.emit('social:userFollowed', { targetUserId, followerId: user.uid });

            // Update local state
            this.stateManager.setState('social.following', updatedFollowing);

            // Create notification for target user
            await this.createNotification({
                userId: targetUserId,
                type: 'follow',
                fromUserId: user.uid,
                fromUserName: user.displayName || user.email,
                message: `${user.displayName || user.email} started following you`
            });
            
        } catch (error) {
            console.error('Error following user:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'followUser', error: error.message });
        }
    }

    /**
     * Unfollow a user
     */
    async unfollowUser(targetUserId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Update current user's following list
            const currentUserProfile = await this.firebaseService.getUserProfile(user.uid);
            const currentFollowing = currentUserProfile?.following || [];
            const updatedFollowing = currentFollowing.filter(id => id !== targetUserId);

            await this.firebaseService.updateUserProfile(user.uid, {
                following: updatedFollowing
            });

            // Update target user's followers list
            const targetUserProfile = await this.firebaseService.getUserProfile(targetUserId);
            const currentFollowers = targetUserProfile?.followers || [];
            const updatedFollowers = currentFollowers.filter(id => id !== user.uid);

            await this.firebaseService.updateUserProfile(targetUserId, {
                followers: updatedFollowers
            });

            console.log('Successfully unfollowed user:', targetUserId);
            this.eventBus.emit('social:userUnfollowed', { targetUserId, followerId: user.uid });

            // Update local state
            this.stateManager.setState('social.following', updatedFollowing);
            
        } catch (error) {
            console.error('Error unfollowing user:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'unfollowUser', error: error.message });
        }
    }

    /**
     * Load social feed (posts from followed users and public posts)
     */
    async loadFeed() {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            this.stateManager.setState('social.isLoading', true);

            const user = this.stateManager.getState('auth.user');
            const following = this.stateManager.getState('social.following') || [];

            // Set up real-time listener for posts
            const unsubscribe = this.firebaseService.onPostsSnapshot(
                (posts) => {
                    // Filter posts: own posts, followed users' posts, and public posts
                    const feedPosts = posts.filter(post => {
                        return post.userId === (user?.uid) || 
                               following.includes(post.userId) || 
                               post.isPublic;
                    });

                    this.stateManager.setState('social.posts', feedPosts);
                    this.eventBus.emit('social:feedLoaded', feedPosts);
                }
            );

            this.unsubscribeCallbacks.push(unsubscribe);

        } catch (error) {
            console.error('Error loading social feed:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'loadFeed', error: error.message });
        } finally {
            this.stateManager.setState('social.isLoading', false);
        }
    }

    /**
     * Load user's own posts
     */
    async loadUserPosts() {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                this.stateManager.setState('social.userPosts', []);
                return;
            }

            // Set up real-time listener for user's posts
            const unsubscribe = this.firebaseService.onPostsSnapshot(
                (posts) => {
                    this.stateManager.setState('social.userPosts', posts);
                    this.eventBus.emit('social:userPostsLoaded', posts);
                },
                { userId: user.uid }
            );

            this.unsubscribeCallbacks.push(unsubscribe);

        } catch (error) {
            console.error('Error loading user posts:', error);
            this.stateManager.setState('social.error', error.message);
            this.eventBus.emit('social:error', { type: 'loadUserPosts', error: error.message });
        }
    }

    /**
     * Share race result as a post
     */
    async shareResult(resultData) {
        const { championship, race, position, points, time } = resultData;

        const postContent = `🏁 Race Result!\n\n` +
            `Championship: ${championship.name}\n` +
            `Race: ${race.name}\n` +
            `Position: ${position}\n` +
            `Points: ${points}\n` +
            (time ? `Time: ${time}\n` : '') +
            `\n#RaceManagerPro #Racing`;

        await this.createPost({
            type: 'result',
            content: postContent,
            resultData: resultData,
            isPublic: true
        });
    }

    /**
     * Create notification
     */
    async createNotification(notificationData) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            await this.firebaseService.createDocument('notifications', {
                ...notificationData,
                isRead: false
            });

            console.log('Notification created for user:', notificationData.userId);
            
        } catch (error) {
            console.error('Error creating notification:', error);
        }
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
            const user = this.stateManager.getState('auth.user');
            if (!user) {
                return;
            }

            const notifications = await this.firebaseService.queryCollection(
                'notifications',
                [{ field: 'userId', operator: '==', value: user.uid }],
                'createdAt',
                'desc'
            );

            this.stateManager.setState('social.notifications', notifications);
            this.eventBus.emit('social:notificationsLoaded', notifications);

        } catch (error) {
            console.error('Error loading notifications:', error);
            this.eventBus.emit('social:error', { type: 'loadNotifications', error: error.message });
        }
    }

    /**
     * Mark notification as read
     */
    async markNotificationAsRead(notificationId) {
        if (!this.firebaseService) {
            console.error('FirebaseService not available');
            return;
        }

        try {
            await this.firebaseService.updateDocument('notifications', notificationId, {
                isRead: true,
                readAt: new Date().toISOString()
            });

            console.log('Notification marked as read:', notificationId);
            
            // Refresh notifications
            await this.loadNotifications();

        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    /**
     * Get social stats for user
     */
    getSocialStats() {
        const posts = this.stateManager.getState('social.userPosts') || [];
        const following = this.stateManager.getState('social.following') || [];
        const followers = this.stateManager.getState('social.followers') || [];

        const totalLikes = posts.reduce((sum, post) => sum + (post.likeCount || 0), 0);
        const totalComments = posts.reduce((sum, post) => sum + (post.commentCount || 0), 0);

        return {
            postsCount: posts.length,
            followingCount: following.length,
            followersCount: followers.length,
            totalLikes,
            totalComments
        };
    }

    /**
     * Handle user authentication
     */
    async onUserAuthenticated(userData) {
        console.log('SocialService: User authenticated, loading social data');
        
        // Load user's following/followers
        const userProfile = await this.firebaseService.getUserProfile(userData.uid);
        if (userProfile) {
            this.stateManager.setState('social.following', userProfile.following || []);
            this.stateManager.setState('social.followers', userProfile.followers || []);
        }

        // Load feed and user posts
        await this.loadFeed();
        await this.loadUserPosts();
        await this.loadNotifications();
    }

    /**
     * Handle user logout
     */
    onUserLogout() {
        console.log('SocialService: User logged out, clearing social data');
        
        // Unsubscribe from all listeners
        this.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.unsubscribeCallbacks = [];

        // Clear state
        this.stateManager.setState('social', {
            posts: [],
            userPosts: [],
            following: [],
            followers: [],
            isLoading: false,
            error: null,
            notifications: []
        });
    }

    /**
     * Get posts from feed
     */
    getFeedPosts() {
        return this.stateManager.getState('social.posts') || [];
    }

    /**
     * Get user's posts
     */
    getUserPosts() {
        return this.stateManager.getState('social.userPosts') || [];
    }

    /**
     * Get notifications
     */
    getNotifications() {
        return this.stateManager.getState('social.notifications') || [];
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

        console.log('🤝 SocialService destroyed');
    }
}
