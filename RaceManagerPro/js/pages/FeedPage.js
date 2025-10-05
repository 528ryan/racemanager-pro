/**
 * FeedPage.js - Página principal do feed social
 * Contém: posts, stories, live timing, achievements, predictions
 */

export default class FeedPage {
    constructor() {
        this.posts = [];
        this.stories = [];
        this.liveRaces = [];
        this.eventBus = window.eventBus;
        this.stateManager = window.stateManager;
    }

    async render(params = {}, query = {}) {
        return `
            <div class="min-h-screen">
                <!-- Stories Section -->
                <section class="mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-bold">Racing Stories</h2>
                        <button id="add-story-btn" class="text-orange-400 hover:text-orange-300 transition-colors">
                            <i data-feather="plus-circle" class="w-5 h-5"></i>
                        </button>
                    </div>
                    <div id="stories-container" class="flex space-x-4 overflow-x-auto pb-2">
                        <!-- Stories will be loaded here -->
                        <div class="flex-shrink-0 text-center">
                            <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mb-2 cursor-pointer hover:scale-105 transition-transform">
                                <i data-feather="plus" class="w-8 h-8 text-white"></i>
                            </div>
                            <span class="text-xs text-gray-400">Add Story</span>
                        </div>
                    </div>
                </section>

                <!-- Live Racing Section -->
                <section class="mb-6">
                    <div class="glass-card p-4 rounded-lg">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold flex items-center">
                                <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
                                Live Racing
                            </h3>
                            <span class="text-sm text-gray-400">2 races active</span>
                        </div>
                        <div id="live-races-container" class="space-y-3">
                            <!-- Live races will be loaded here -->
                        </div>
                    </div>
                </section>

                <!-- Main Feed Layout -->
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <!-- Left Sidebar - Quick Stats -->
                    <div class="lg:col-span-1 order-2 lg:order-1">
                        <!-- Quick Stats -->
                        <div class="glass-card p-4 rounded-lg mb-4">
                            <h4 class="font-semibold mb-3">Quick Stats</h4>
                            <div class="space-y-2">
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-400">Races Won</span>
                                    <span class="text-green-400 font-semibold">12</span>
                                </div>
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-400">Championships</span>
                                    <span class="text-orange-400 font-semibold">3</span>
                                </div>
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-400">Best Lap Time</span>
                                    <span class="text-blue-400 font-semibold">1:23.456</span>
                                </div>
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-400">Following</span>
                                    <span class="text-purple-400 font-semibold">156</span>
                                </div>
                            </div>
                        </div>

                        <!-- Weather Widget -->
                        <div class="glass-card p-4 rounded-lg mb-4">
                            <h4 class="font-semibold mb-3">Track Weather</h4>
                            <div id="weather-widget" class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2">
                                        <i data-feather="sun" class="w-5 h-5 text-yellow-400"></i>
                                        <span class="text-sm">Sunny</span>
                                    </div>
                                    <span class="text-lg font-bold">24°C</span>
                                </div>
                                <div class="text-xs text-gray-400">
                                    Wind: 12 km/h | Humidity: 65%
                                </div>
                                <div class="text-xs text-gray-400">
                                    Track Temp: 32°C | Grip: Excellent
                                </div>
                            </div>
                        </div>

                        <!-- Racing Mood -->
                        <div class="glass-card p-4 rounded-lg">
                            <h4 class="font-semibold mb-3">Racing Mood</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <button class="mood-btn p-2 rounded-lg bg-gray-800 hover:bg-orange-600 transition-colors text-center">
                                    <div class="text-2xl mb-1">🏁</div>
                                    <div class="text-xs">Racing</div>
                                </button>
                                <button class="mood-btn p-2 rounded-lg bg-gray-800 hover:bg-blue-600 transition-colors text-center">
                                    <div class="text-2xl mb-1">🏆</div>
                                    <div class="text-xs">Winning</div>
                                </button>
                                <button class="mood-btn p-2 rounded-lg bg-gray-800 hover:bg-green-600 transition-colors text-center">
                                    <div class="text-2xl mb-1">🔧</div>
                                    <div class="text-xs">Tuning</div>
                                </button>
                                <button class="mood-btn p-2 rounded-lg bg-gray-800 hover:bg-purple-600 transition-colors text-center">
                                    <div class="text-2xl mb-1">📊</div>
                                    <div class="text-xs">Analyzing</div>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Center Feed -->
                    <div class="lg:col-span-2 order-1 lg:order-2">
                        <!-- Create Post -->
                        <div class="glass-card p-4 rounded-lg mb-6">
                            <div class="flex items-start space-x-3">
                                <div id="user-avatar-post" class="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    U
                                </div>
                                <div class="flex-1">
                                    <textarea 
                                        id="post-content" 
                                        placeholder="Share your racing updates, achievements, or thoughts..."
                                        class="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-3 text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                        rows="3"
                                    ></textarea>
                                    
                                    <!-- Post Options -->
                                    <div class="flex items-center justify-between mt-3">
                                        <div class="flex items-center space-x-4">
                                            <button id="add-image-btn" class="flex items-center space-x-1 text-gray-400 hover:text-orange-400 transition-colors">
                                                <i data-feather="image" class="w-5 h-5"></i>
                                                <span class="text-sm">Photo</span>
                                            </button>
                                            <button id="add-result-btn" class="flex items-center space-x-1 text-gray-400 hover:text-green-400 transition-colors">
                                                <i data-feather="trophy" class="w-5 h-5"></i>
                                                <span class="text-sm">Result</span>
                                            </button>
                                            <button id="add-location-btn" class="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors">
                                                <i data-feather="map-pin" class="w-5 h-5"></i>
                                                <span class="text-sm">Track</span>
                                            </button>
                                            <button id="add-prediction-btn" class="flex items-center space-x-1 text-gray-400 hover:text-purple-400 transition-colors">
                                                <i data-feather="target" class="w-5 h-5"></i>
                                                <span class="text-sm">Predict</span>
                                            </button>
                                        </div>
                                        <button id="create-post-btn" class="racing-btn px-6 py-2">
                                            Post
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Feed Posts -->
                        <div id="social-feed" class="space-y-6">
                            <!-- Sample posts will be here -->
                            <div id="feed-loading" class="text-center py-12">
                                <div class="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p class="text-gray-400">Loading your racing feed...</p>
                            </div>
                        </div>
                        
                        <!-- Load More -->
                        <div class="text-center mt-8">
                            <button id="load-more-posts" class="px-8 py-3 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors">
                                Load More Posts
                            </button>
                        </div>
                    </div>

                    <!-- Right Sidebar -->
                    <div class="lg:col-span-1 order-3">
                        <!-- Race Predictions -->
                        <div class="glass-card p-4 rounded-lg mb-4">
                            <h4 class="font-semibold mb-3">Race Predictions</h4>
                            <div class="space-y-3">
                                <div class="bg-gray-800/50 rounded-lg p-3">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-sm font-medium">Monaco GP</span>
                                        <span class="text-xs text-gray-400">2h left</span>
                                    </div>
                                    <div class="text-xs text-gray-400 mb-2">Your prediction: Verstappen 1st</div>
                                    <div class="flex justify-between text-xs">
                                        <span>Confidence: 85%</span>
                                        <span class="text-green-400">+120 pts</span>
                                    </div>
                                </div>
                                <button class="w-full py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors text-sm">
                                    Make New Prediction
                                </button>
                            </div>
                        </div>

                        <!-- Trending Topics -->
                        <div class="glass-card p-4 rounded-lg mb-4">
                            <h4 class="font-semibold mb-3">Trending</h4>
                            <div class="space-y-3">
                                <div class="cursor-pointer hover:bg-gray-800/50 rounded p-2 -m-2 transition-colors">
                                    <div class="font-medium text-sm">#MonacoGP</div>
                                    <div class="text-xs text-gray-400">2.3k posts</div>
                                </div>
                                <div class="cursor-pointer hover:bg-gray-800/50 rounded p-2 -m-2 transition-colors">
                                    <div class="font-medium text-sm">#MaxVerstappen</div>
                                    <div class="text-xs text-gray-400">1.8k posts</div>
                                </div>
                                <div class="cursor-pointer hover:bg-gray-800/50 rounded p-2 -m-2 transition-colors">
                                    <div class="font-medium text-sm">#RacingSetup</div>
                                    <div class="text-xs text-gray-400">956 posts</div>
                                </div>
                                <div class="cursor-pointer hover:bg-gray-800/50 rounded p-2 -m-2 transition-colors">
                                    <div class="font-medium text-sm">#NewTrack</div>
                                    <div class="text-xs text-gray-400">634 posts</div>
                                </div>
                            </div>
                        </div>

                        <!-- Suggested Drivers -->
                        <div class="glass-card p-4 rounded-lg mb-4">
                            <h4 class="font-semibold mb-3">Suggested Drivers</h4>
                            <div class="space-y-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2">
                                        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                            LH
                                        </div>
                                        <div>
                                            <div class="text-sm font-medium">Lewis Hamilton</div>
                                            <div class="text-xs text-gray-400">7x Champion</div>
                                        </div>
                                    </div>
                                    <button class="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm transition-colors">
                                        Follow
                                    </button>
                                </div>
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2">
                                        <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                            MV
                                        </div>
                                        <div>
                                            <div class="text-sm font-medium">Max Verstappen</div>
                                            <div class="text-xs text-gray-400">Current Champion</div>
                                        </div>
                                    </div>
                                    <button class="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm transition-colors">
                                        Follow
                                    </button>
                                </div>
                            </div>
                            <button class="w-full mt-3 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors text-sm">
                                See All Suggestions
                            </button>
                        </div>

                        <!-- Racing Calendar -->
                        <div class="glass-card p-4 rounded-lg">
                            <h4 class="font-semibold mb-3">Upcoming Races</h4>
                            <div class="space-y-3">
                                <div class="border-l-4 border-orange-500 pl-3">
                                    <div class="font-medium text-sm">Monaco Grand Prix</div>
                                    <div class="text-xs text-gray-400">May 28, 2024 - 15:00</div>
                                </div>
                                <div class="border-l-4 border-red-500 pl-3">
                                    <div class="font-medium text-sm">Spanish Grand Prix</div>
                                    <div class="text-xs text-gray-400">Jun 4, 2024 - 15:00</div>
                                </div>
                                <div class="border-l-4 border-blue-500 pl-3">
                                    <div class="font-medium text-sm">Canadian Grand Prix</div>
                                    <div class="text-xs text-gray-400">Jun 11, 2024 - 20:00</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async init(params = {}, query = {}) {
        // Initialize feather icons
        if (window.feather) {
            feather.replace();
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadFeedData();
        await this.loadStories();
        await this.loadLiveRaces();
        
        console.log('🏠 Feed page initialized');
    }

    setupEventListeners() {
        // Create post
        const createPostBtn = document.getElementById('create-post-btn');
        const postContent = document.getElementById('post-content');
        
        if (createPostBtn && postContent) {
            createPostBtn.addEventListener('click', () => this.createPost());
        }

        // Post options
        document.getElementById('add-image-btn')?.addEventListener('click', () => this.addImage());
        document.getElementById('add-result-btn')?.addEventListener('click', () => this.addResult());
        document.getElementById('add-location-btn')?.addEventListener('click', () => this.addLocation());
        document.getElementById('add-prediction-btn')?.addEventListener('click', () => this.addPrediction());
        
        // Load more posts
        document.getElementById('load-more-posts')?.addEventListener('click', () => this.loadMorePosts());
        
        // Mood buttons
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setMood(btn));
        });

        // Add story
        document.getElementById('add-story-btn')?.addEventListener('click', () => this.createStory());

        // Enter key support for post content
        postContent?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.createPost();
            }
        });
    }

    async loadFeedData() {
        const feedContainer = document.getElementById('social-feed');
        const loadingEl = document.getElementById('feed-loading');
        
        try {
            // Simulate loading
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate sample posts
            const samplePosts = this.generateSamplePosts();
            
            if (loadingEl) loadingEl.style.display = 'none';
            
            feedContainer.innerHTML = samplePosts.map(post => this.renderPost(post)).join('');
            
            // Re-initialize feather icons
            if (window.feather) {
                feather.replace();
            }
            
            // Setup post interactions
            this.setupPostInteractions();
            
        } catch (error) {
            console.error('Error loading feed:', error);
            loadingEl.innerHTML = `
                <div class="text-center text-red-400">
                    <p>Failed to load feed. Please try again.</p>
                </div>
            `;
        }
    }

    generateSamplePosts() {
        return [
            {
                id: '1',
                type: 'achievement',
                author: 'SpeedDemon23',
                avatar: 'SD',
                timestamp: new Date(Date.now() - 1800000).toISOString(),
                content: 'Just broke my personal best at Silverstone! 🏁 New lap time: 1:23.456 - finally under 1:24!',
                achievement: {
                    title: 'Personal Best',
                    track: 'Silverstone Circuit',
                    time: '1:23.456',
                    improvement: '0.8s'
                },
                likes: 42,
                comments: 8,
                shares: 3,
                isLiked: false
            },
            {
                id: '2',
                type: 'prediction',
                author: 'RacingAnalyst',
                avatar: 'RA',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                content: 'Monaco GP predictions are looking spicy! 🔥 My analysis says Verstappen has 75% chance of pole position based on recent sector times.',
                prediction: {
                    race: 'Monaco Grand Prix',
                    driver: 'Max Verstappen',
                    position: 'Pole Position',
                    confidence: 75
                },
                likes: 28,
                comments: 15,
                shares: 7,
                isLiked: true
            },
            {
                id: '3',
                type: 'setup',
                author: 'TuningMaster',
                avatar: 'TM',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                content: 'Found the perfect setup for wet conditions at Spa! 🌧️ Sharing my configuration - try it out and let me know how it works for you!',
                setup: {
                    track: 'Spa-Francorchamps',
                    conditions: 'Wet',
                    downforce: 'High',
                    suspension: 'Soft'
                },
                likes: 67,
                comments: 23,
                shares: 31,
                isLiked: false
            },
            {
                id: '4',
                type: 'live_result',
                author: 'ProRacer44',
                avatar: 'PR',
                timestamp: new Date(Date.now() - 900000).toISOString(),
                content: 'What a race! Started P12 and fought my way to P3! 🏆 The overtake on Turn 7 was absolutely mental!',
                result: {
                    position: 3,
                    startPosition: 12,
                    championship: 'GT World Challenge',
                    points: 15
                },
                likes: 89,
                comments: 34,
                shares: 12,
                isLiked: true
            }
        ];
    }

    renderPost(post) {
        const timeAgo = this.getTimeAgo(post.timestamp);
        
        return `
            <article class="glass-card p-6 rounded-lg">
                <!-- Post Header -->
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            ${post.avatar}
                        </div>
                        <div>
                            <h4 class="font-semibold">${post.author}</h4>
                            <p class="text-sm text-gray-400">${timeAgo}</p>
                        </div>
                    </div>
                    <button class="text-gray-400 hover:text-white transition-colors">
                        <i data-feather="more-horizontal" class="w-5 h-5"></i>
                    </button>
                </div>
                
                <!-- Post Content -->
                <div class="mb-4">
                    <p class="text-gray-300 mb-3">${post.content}</p>
                    ${this.renderPostSpecialContent(post)}
                </div>
                
                <!-- Post Actions -->
                <div class="flex items-center justify-between pt-4 border-t border-gray-700">
                    <div class="flex items-center space-x-6">
                        <button class="like-btn flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors ${post.isLiked ? 'text-red-400' : ''}" data-post-id="${post.id}">
                            <i data-feather="heart" class="w-5 h-5 ${post.isLiked ? 'fill-current' : ''}"></i>
                            <span>${post.likes}</span>
                        </button>
                        <button class="comment-btn flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors" data-post-id="${post.id}">
                            <i data-feather="message-circle" class="w-5 h-5"></i>
                            <span>${post.comments}</span>
                        </button>
                        <button class="share-btn flex items-center space-x-2 text-gray-400 hover:text-green-400 transition-colors" data-post-id="${post.id}">
                            <i data-feather="share" class="w-5 h-5"></i>
                            <span>${post.shares}</span>
                        </button>
                    </div>
                    <button class="save-btn text-gray-400 hover:text-yellow-400 transition-colors" data-post-id="${post.id}">
                        <i data-feather="bookmark" class="w-5 h-5"></i>
                    </button>
                </div>
            </article>
        `;
    }

    renderPostSpecialContent(post) {
        switch (post.type) {
            case 'achievement':
                return `
                    <div class="bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30 rounded-lg p-4 mb-3">
                        <div class="flex items-center justify-between">
                            <div>
                                <h5 class="font-semibold text-green-400 mb-1">${post.achievement.title}</h5>
                                <p class="text-sm text-gray-300">${post.achievement.track}</p>
                                <p class="text-lg font-mono font-bold text-white">${post.achievement.time}</p>
                            </div>
                            <div class="text-right">
                                <div class="text-2xl mb-1">🏆</div>
                                <p class="text-sm text-green-400">Improved by ${post.achievement.improvement}</p>
                            </div>
                        </div>
                    </div>
                `;
            case 'prediction':
                return `
                    <div class="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg p-4 mb-3">
                        <div class="flex items-center justify-between">
                            <div>
                                <h5 class="font-semibold text-purple-400 mb-1">${post.prediction.race}</h5>
                                <p class="text-sm text-gray-300">${post.prediction.driver} - ${post.prediction.position}</p>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl mb-1">🎯</div>
                                <p class="text-sm text-purple-400">${post.prediction.confidence}% confidence</p>
                            </div>
                        </div>
                    </div>
                `;
            case 'setup':
                return `
                    <div class="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-lg p-4 mb-3">
                        <h5 class="font-semibold text-orange-400 mb-2">🔧 Setup Shared</h5>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div>Track: <span class="text-white">${post.setup.track}</span></div>
                            <div>Conditions: <span class="text-white">${post.setup.conditions}</span></div>
                            <div>Downforce: <span class="text-white">${post.setup.downforce}</span></div>
                            <div>Suspension: <span class="text-white">${post.setup.suspension}</span></div>
                        </div>
                    </div>
                `;
            case 'live_result':
                return `
                    <div class="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-lg p-4 mb-3">
                        <div class="flex items-center justify-between">
                            <div>
                                <h5 class="font-semibold text-yellow-400 mb-1">Race Result</h5>
                                <p class="text-sm text-gray-300">${post.result.championship}</p>
                                <p class="text-lg font-bold text-white">P${post.result.position} (Started P${post.result.startPosition})</p>
                            </div>
                            <div class="text-center">
                                <div class="text-3xl mb-1">🏁</div>
                                <p class="text-sm text-yellow-400">+${post.result.points} points</p>
                            </div>
                        </div>
                    </div>
                `;
            default:
                return '';
        }
    }

    setupPostInteractions() {
        // Like buttons
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleLike(btn);
            });
        });

        // Comment buttons
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openComments(btn.dataset.postId);
            });
        });

        // Share buttons
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.sharePost(btn.dataset.postId);
            });
        });

        // Save buttons
        document.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleSave(btn);
            });
        });
    }

    async loadStories() {
        // Sample stories
        const stories = [
            { id: '1', author: 'RaceWinner', avatar: 'RW', isViewed: false },
            { id: '2', author: 'FastLap', avatar: 'FL', isViewed: true },
            { id: '3', author: 'PitCrew', avatar: 'PC', isViewed: false }
        ];

        const container = document.getElementById('stories-container');
        if (!container) return;

        stories.forEach(story => {
            const storyEl = document.createElement('div');
            storyEl.className = 'flex-shrink-0 text-center cursor-pointer';
            storyEl.innerHTML = `
                <div class="relative">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-2 hover:scale-105 transition-transform ${story.isViewed ? 'opacity-50' : ''}">
                        <span class="text-white font-bold">${story.avatar}</span>
                    </div>
                    ${!story.isViewed ? '<div class="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full"></div>' : ''}
                </div>
                <span class="text-xs text-gray-400 block truncate w-16">${story.author}</span>
            `;
            container.appendChild(storyEl);
        });
    }

    async loadLiveRaces() {
        const container = document.getElementById('live-races-container');
        if (!container) return;

        const liveRaces = [
            {
                name: 'Monaco Grand Prix',
                lap: 45,
                totalLaps: 78,
                leader: 'Verstappen',
                viewers: 2847
            },
            {
                name: 'GT World Challenge',
                lap: 23,
                totalLaps: 60,
                leader: 'Hamilton',
                viewers: 1256
            }
        ];

        container.innerHTML = liveRaces.map(race => `
            <div class="bg-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-700/50 transition-colors">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-semibold text-sm">${race.name}</h4>
                    <span class="text-xs text-gray-400">${race.viewers} watching</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-300">Lap ${race.lap}/${race.totalLaps}</span>
                    <span class="text-orange-400">Leader: ${race.leader}</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div class="bg-orange-500 h-1.5 rounded-full" style="width: ${(race.lap / race.totalLaps) * 100}%"></div>
                </div>
            </div>
        `).join('');
    }

    // Event handlers
    async createPost() {
        const content = document.getElementById('post-content')?.value.trim();
        if (!content) {
            alert('Please write something to share!');
            return;
        }

        try {
            // Simulate post creation
            console.log('Creating post:', content);
            
            // Clear the textarea
            document.getElementById('post-content').value = '';
            
            // Show success message
            this.showToast('Post shared successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating post:', error);
            this.showToast('Failed to share post. Please try again.', 'error');
        }
    }

    addImage() {
        console.log('Add image functionality');
        this.showToast('Image upload coming soon!', 'info');
    }

    addResult() {
        console.log('Add result functionality');
        this.showToast('Race result sharing coming soon!', 'info');
    }

    addLocation() {
        console.log('Add location functionality');
        this.showToast('Track location sharing coming soon!', 'info');
    }

    addPrediction() {
        console.log('Add prediction functionality');
        this.showToast('Race predictions coming soon!', 'info');
    }

    loadMorePosts() {
        console.log('Load more posts');
        this.showToast('Loading more posts...', 'info');
    }

    setMood(btn) {
        // Remove active class from all mood buttons
        document.querySelectorAll('.mood-btn').forEach(b => {
            b.classList.remove('bg-orange-600');
            b.classList.add('bg-gray-800');
        });
        
        // Add active class to clicked button
        btn.classList.remove('bg-gray-800');
        btn.classList.add('bg-orange-600');
        
        console.log('Mood set:', btn.textContent.trim());
    }

    createStory() {
        console.log('Create story functionality');
        this.showToast('Story creation coming soon!', 'info');
    }

    toggleLike(btn) {
        const icon = btn.querySelector('i');
        const count = btn.querySelector('span');
        const isLiked = btn.classList.contains('text-red-400');
        
        if (isLiked) {
            btn.classList.remove('text-red-400');
            btn.classList.add('text-gray-400');
            icon.classList.remove('fill-current');
            count.textContent = parseInt(count.textContent) - 1;
        } else {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-red-400');
            icon.classList.add('fill-current');
            count.textContent = parseInt(count.textContent) + 1;
        }
    }

    openComments(postId) {
        console.log('Open comments for post:', postId);
        this.showToast('Comments system coming soon!', 'info');
    }

    sharePost(postId) {
        console.log('Share post:', postId);
        this.showToast('Post shared!', 'success');
    }

    toggleSave(btn) {
        const icon = btn.querySelector('i');
        const isSaved = btn.classList.contains('text-yellow-400');
        
        if (isSaved) {
            btn.classList.remove('text-yellow-400');
            btn.classList.add('text-gray-400');
            icon.classList.remove('fill-current');
        } else {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-yellow-400');
            icon.classList.add('fill-current');
        }
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInMs = now - time;
        const diffInMins = Math.floor(diffInMs / 60000);
        
        if (diffInMins < 1) return 'now';
        if (diffInMins < 60) return `${diffInMins}m`;
        if (diffInMins < 1440) return `${Math.floor(diffInMins / 60)}h`;
        return `${Math.floor(diffInMins / 1440)}d`;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };
        
        toast.classList.add(colors[type] || colors.info);
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        // Animate out and remove
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}