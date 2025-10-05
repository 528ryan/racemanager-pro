/**
 * ProfilePage.js - Página de perfil do usuário
 */

export default class ProfilePage {
    constructor() {
        this.user = null;
        this.stats = {};
    }

    async render(params = {}, query = {}) {
        const userId = params.userId || 'me';
        
        return `
            <div class="min-h-screen">
                <!-- Profile Header -->
                <div class="glass-card rounded-lg p-6 mb-6">
                    <div class="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
                        <div class="w-24 h-24 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                            U
                        </div>
                        <div class="flex-1">
                            <h1 class="text-3xl font-bold mb-2">User Name</h1>
                            <p class="text-gray-400 mb-3">Professional Racing Driver | 3x Championship Winner</p>
                            <div class="flex flex-wrap items-center gap-4 text-sm">
                                <span class="flex items-center space-x-1">
                                    <i data-feather="map-pin" class="w-4 h-4"></i>
                                    <span>Monaco</span>
                                </span>
                                <span class="flex items-center space-x-1">
                                    <i data-feather="calendar" class="w-4 h-4"></i>
                                    <span>Joined March 2023</span>
                                </span>
                                <span class="flex items-center space-x-1">
                                    <i data-feather="users" class="w-4 h-4"></i>
                                    <span>156 Following • 2.3k Followers</span>
                                </span>
                            </div>
                        </div>
                        <div class="flex space-x-3">
                            <button class="racing-btn px-4 py-2">
                                <i data-feather="edit-3" class="w-4 h-4 mr-2"></i>
                                Edit Profile
                            </button>
                            <button class="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors">
                                <i data-feather="share" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="glass-card p-4 text-center">
                        <div class="text-2xl font-bold text-green-400">47</div>
                        <div class="text-sm text-gray-400">Races Won</div>
                    </div>
                    <div class="glass-card p-4 text-center">
                        <div class="text-2xl font-bold text-orange-400">3</div>
                        <div class="text-sm text-gray-400">Championships</div>
                    </div>
                    <div class="glass-card p-4 text-center">
                        <div class="text-2xl font-bold text-blue-400">1:18.432</div>
                        <div class="text-sm text-gray-400">Best Lap Time</div>
                    </div>
                    <div class="glass-card p-4 text-center">
                        <div class="text-2xl font-bold text-purple-400">2,847</div>
                        <div class="text-sm text-gray-400">Career Points</div>
                    </div>
                </div>

                <!-- Tab Navigation -->
                <div class="mb-6">
                    <nav class="flex space-x-8 border-b border-gray-700">
                        <button class="profile-tab active py-3 px-1 border-b-2 border-orange-500 text-orange-500 font-medium" data-tab="posts">
                            Posts
                        </button>
                        <button class="profile-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="achievements">
                            Achievements
                        </button>
                        <button class="profile-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="races">
                            Race History
                        </button>
                        <button class="profile-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="following">
                            Following
                        </button>
                    </nav>
                </div>

                <!-- Tab Content -->
                <div id="profile-content">
                    <!-- Content will be loaded based on active tab -->
                </div>
            </div>
        `;
    }

    async init() {
        this.setupTabs();
        this.loadTabContent('posts');
        if (window.feather) feather.replace();
    }

    setupTabs() {
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('.profile-tab').forEach(t => {
                    t.classList.remove('active', 'border-orange-500', 'text-orange-500');
                    t.classList.add('border-transparent', 'text-gray-400');
                });
                
                tab.classList.add('active', 'border-orange-500', 'text-orange-500');
                tab.classList.remove('border-transparent', 'text-gray-400');
                
                this.loadTabContent(tab.dataset.tab);
            });
        });
    }

    loadTabContent(tabName) {
        const content = document.getElementById('profile-content');
        
        switch (tabName) {
            case 'posts':
                content.innerHTML = this.renderPosts();
                break;
            case 'achievements':
                content.innerHTML = this.renderAchievements();
                break;
            case 'races':
                content.innerHTML = this.renderRaceHistory();
                break;
            case 'following':
                content.innerHTML = this.renderFollowing();
                break;
        }
        
        if (window.feather) feather.replace();
    }

    renderPosts() {
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${Array.from({length: 6}, (_, i) => `
                    <div class="glass-card p-4 rounded-lg">
                        <p class="text-gray-300 mb-3">Sample post content ${i + 1}. This is a racing update from the user's profile.</p>
                        <div class="flex items-center justify-between text-sm text-gray-400">
                            <span>2 hours ago</span>
                            <div class="flex space-x-4">
                                <span>❤️ 23</span>
                                <span>💬 5</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAchievements() {
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="glass-card p-4 rounded-lg border-l-4 border-yellow-500">
                    <div class="flex items-center space-x-3 mb-3">
                        <div class="text-2xl">🏆</div>
                        <div>
                            <h3 class="font-semibold">Championship Winner</h3>
                            <p class="text-sm text-gray-400">GT World Challenge 2024</p>
                        </div>
                    </div>
                    <p class="text-xs text-yellow-400">Earned 3 months ago</p>
                </div>
                
                <div class="glass-card p-4 rounded-lg border-l-4 border-green-500">
                    <div class="flex items-center space-x-3 mb-3">
                        <div class="text-2xl">⚡</div>
                        <div>
                            <h3 class="font-semibold">Speed Demon</h3>
                            <p class="text-sm text-gray-400">Fastest Lap Record</p>
                        </div>
                    </div>
                    <p class="text-xs text-green-400">Earned 1 week ago</p>
                </div>
                
                <div class="glass-card p-4 rounded-lg border-l-4 border-blue-500">
                    <div class="flex items-center space-x-3 mb-3">
                        <div class="text-2xl">🎯</div>
                        <div>
                            <h3 class="font-semibold">Precision Master</h3>
                            <p class="text-sm text-gray-400">10 Consecutive Podiums</p>
                        </div>
                    </div>
                    <p class="text-xs text-blue-400">Earned 2 weeks ago</p>
                </div>
            </div>
        `;
    }

    renderRaceHistory() {
        return `
            <div class="space-y-4">
                ${Array.from({length: 8}, (_, i) => `
                    <div class="glass-card p-4 rounded-lg">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-4">
                                <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold">
                                    P${i + 1}
                                </div>
                                <div>
                                    <h3 class="font-semibold">Monaco Grand Prix</h3>
                                    <p class="text-sm text-gray-400">May 28, 2024</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-semibold text-green-400">+${25 - i * 2} pts</p>
                                <p class="text-sm text-gray-400">1:23.${400 + i}56</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderFollowing() {
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${Array.from({length: 6}, (_, i) => `
                    <div class="glass-card p-4 rounded-lg">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                                    U${i + 1}
                                </div>
                                <div>
                                    <h3 class="font-semibold">Driver ${i + 1}</h3>
                                    <p class="text-sm text-gray-400">Professional Racer</p>
                                </div>
                            </div>
                            <button class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors">
                                Unfollow
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}