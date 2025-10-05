/**
 * ChampionshipsPage.js - Página de campeonatos
 */

export default class ChampionshipsPage {
    constructor() {
        this.championships = [];
        this.activeView = 'current';
    }

    async render(params = {}, query = {}) {
        return `
            <div class="min-h-screen">
                <!-- Page Header -->
                <div class="glass-card rounded-lg p-6 mb-6">
                    <div class="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
                        <div>
                            <h1 class="text-3xl font-bold mb-2">Championships</h1>
                            <p class="text-gray-400">Follow your favorite racing championships and track standings</p>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="relative">
                                <input type="text" placeholder="Search championships..." class="bg-black/20 border border-gray-600 rounded-lg px-4 py-2 pl-10 w-64 focus:border-orange-500 focus:outline-none">
                                <i data-feather="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"></i>
                            </div>
                            <button class="racing-btn px-4 py-2">
                                <i data-feather="plus" class="w-4 h-4 mr-2"></i>
                                Join Championship
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Championship Categories -->
                <div class="mb-6">
                    <nav class="flex space-x-8 border-b border-gray-700">
                        <button class="championship-tab active py-3 px-1 border-b-2 border-orange-500 text-orange-500 font-medium" data-tab="current">
                            Current Season
                        </button>
                        <button class="championship-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="upcoming">
                            Upcoming
                        </button>
                        <button class="championship-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="past">
                            Past Seasons
                        </button>
                        <button class="championship-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="my">
                            My Championships
                        </button>
                    </nav>
                </div>

                <!-- Championship Grid -->
                <div id="championships-content">
                    ${this.renderCurrentChampionships()}
                </div>
            </div>
        `;
    }

    async init() {
        this.setupTabs();
        if (window.feather) feather.replace();
    }

    setupTabs() {
        document.querySelectorAll('.championship-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('.championship-tab').forEach(t => {
                    t.classList.remove('active', 'border-orange-500', 'text-orange-500');
                    t.classList.add('border-transparent', 'text-gray-400');
                });
                
                tab.classList.add('active', 'border-orange-500', 'text-orange-500');
                tab.classList.remove('border-transparent', 'text-gray-400');
                
                this.activeView = tab.dataset.tab;
                this.loadTabContent(this.activeView);
            });
        });
    }

    loadTabContent(tabName) {
        const content = document.getElementById('championships-content');
        
        switch (tabName) {
            case 'current':
                content.innerHTML = this.renderCurrentChampionships();
                break;
            case 'upcoming':
                content.innerHTML = this.renderUpcomingChampionships();
                break;
            case 'past':
                content.innerHTML = this.renderPastChampionships();
                break;
            case 'my':
                content.innerHTML = this.renderMyChampionships();
                break;
        }
        
        if (window.feather) feather.replace();
    }

    renderCurrentChampionships() {
        const championships = [
            {
                name: "Formula 1 World Championship",
                season: "2024",
                logo: "🏎️",
                status: "Active",
                nextRace: "Monaco GP",
                nextRaceDate: "May 26, 2024",
                leader: "Max Verstappen",
                rounds: "8/24",
                followers: "2.5M",
                category: "Formula 1"
            },
            {
                name: "GT World Challenge Europe",
                season: "2024",
                logo: "🏁",
                status: "Active",
                nextRace: "Spa-Francorchamps",
                nextRaceDate: "May 31, 2024",
                leader: "Ferrari #51",
                rounds: "3/10",
                followers: "456K",
                category: "GT Racing"
            },
            {
                name: "IndyCar Series",
                season: "2024",
                logo: "🚗",
                status: "Active",
                nextRace: "Indianapolis 500",
                nextRaceDate: "May 28, 2024",
                leader: "Alex Palou",
                rounds: "6/17",
                followers: "1.2M",
                category: "IndyCar"
            }
        ];

        return `
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                ${championships.map(championship => `
                    <div class="glass-card rounded-lg p-6 hover:bg-white/5 transition-all cursor-pointer" onclick="window.Router.navigate('/championships/${championship.name.replace(/\\s+/g, '-').toLowerCase()}')">
                        <!-- Championship Header -->
                        <div class="flex items-start space-x-4 mb-4">
                            <div class="text-4xl">${championship.logo}</div>
                            <div class="flex-1">
                                <h3 class="text-xl font-bold mb-1">${championship.name}</h3>
                                <div class="flex items-center space-x-2 text-sm text-gray-400">
                                    <span class="px-2 py-1 bg-green-600/20 text-green-400 rounded">${championship.status}</span>
                                    <span>${championship.season}</span>
                                    <span>•</span>
                                    <span>${championship.category}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Championship Stats -->
                        <div class="space-y-3 mb-4">
                            <div class="flex items-center justify-between">
                                <span class="text-gray-400">Current Leader:</span>
                                <span class="font-semibold">${championship.leader}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-400">Rounds:</span>
                                <span class="font-semibold">${championship.rounds}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-400">Followers:</span>
                                <span class="font-semibold">${championship.followers}</span>
                            </div>
                        </div>

                        <!-- Next Race -->
                        <div class="border-t border-gray-700 pt-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-400">Next Race:</span>
                                <span class="text-sm font-semibold">${championship.nextRace}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-gray-500">${championship.nextRaceDate}</span>
                                <button class="text-xs bg-orange-600 hover:bg-orange-700 px-2 py-1 rounded transition-colors">
                                    Set Reminder
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Quick Stats Section -->
            <div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="glass-card p-4 text-center">
                    <div class="text-2xl font-bold text-orange-400">3</div>
                    <div class="text-sm text-gray-400">Active Championships</div>
                </div>
                <div class="glass-card p-4 text-center">
                    <div class="text-2xl font-bold text-green-400">127</div>
                    <div class="text-sm text-gray-400">Total Races</div>
                </div>
                <div class="glass-card p-4 text-center">
                    <div class="text-2xl font-bold text-blue-400">15</div>
                    <div class="text-sm text-gray-400">This Weekend</div>
                </div>
                <div class="glass-card p-4 text-center">
                    <div class="text-2xl font-bold text-purple-400">4.2M</div>
                    <div class="text-sm text-gray-400">Total Fans</div>
                </div>
            </div>
        `;
    }

    renderUpcomingChampionships() {
        return `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="glass-card p-6 rounded-lg">
                    <div class="flex items-center space-x-4 mb-4">
                        <div class="text-3xl">🏆</div>
                        <div>
                            <h3 class="text-xl font-bold">World Endurance Championship</h3>
                            <p class="text-gray-400">Starts June 2024</p>
                        </div>
                    </div>
                    <p class="text-gray-300 mb-4">24 Hours of Le Mans, Silverstone, Spa-Francorchamps and more...</p>
                    <button class="racing-btn w-full">Get Notified</button>
                </div>
                
                <div class="glass-card p-6 rounded-lg">
                    <div class="flex items-center space-x-4 mb-4">
                        <div class="text-3xl">🏎️</div>
                        <div>
                            <h3 class="text-xl font-bold">Formula E Season 11</h3>
                            <p class="text-gray-400">Starts December 2024</p>
                        </div>
                    </div>
                    <p class="text-gray-300 mb-4">Electric racing returns with new cities and enhanced cars...</p>
                    <button class="racing-btn w-full">Get Notified</button>
                </div>
            </div>
        `;
    }

    renderPastChampionships() {
        return `
            <div class="space-y-4">
                ${Array.from({length: 5}, (_, i) => `
                    <div class="glass-card p-4 rounded-lg">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-4">
                                <div class="text-2xl">🏁</div>
                                <div>
                                    <h3 class="font-semibold">Championship ${2023 - i}</h3>
                                    <p class="text-sm text-gray-400">Season completed</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-semibold">Champion: Driver ${i + 1}</p>
                                <p class="text-sm text-gray-400">${24 - i} races</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderMyChampionships() {
        return `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">🏁</div>
                <h3 class="text-xl font-semibold mb-2">No Championships Joined Yet</h3>
                <p class="text-gray-400 mb-6">Join championships to track your favorite racing series</p>
                <button class="racing-btn px-6 py-3">
                    Browse Championships
                </button>
            </div>
        `;
    }
}