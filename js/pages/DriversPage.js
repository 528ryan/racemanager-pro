/**
 * DriversPage.js - Página de pilotos
 */

export default class DriversPage {
    constructor() {
        this.drivers = [];
        this.activeView = 'rankings';
    }

    async render(params = {}, query = {}) {
        return `
            <div class="min-h-screen">
                <!-- Page Header -->
                <div class="glass-card rounded-lg p-6 mb-6">
                    <div class="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
                        <div>
                            <h1 class="text-3xl font-bold mb-2">Drivers</h1>
                            <p class="text-gray-400">Driver profiles, statistics, and championship standings</p>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="relative">
                                <input type="text" placeholder="Search drivers..." class="bg-black/20 border border-gray-600 rounded-lg px-4 py-2 pl-10 w-64 focus:border-orange-500 focus:outline-none">
                                <i data-feather="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"></i>
                            </div>
                            <div class="flex items-center space-x-2">
                                <select class="bg-black/20 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
                                    <option value="all">All Series</option>
                                    <option value="f1">Formula 1</option>
                                    <option value="indycar">IndyCar</option>
                                    <option value="gt">GT Racing</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Driver Categories -->
                <div class="mb-6">
                    <nav class="flex space-x-8 border-b border-gray-700">
                        <button class="driver-tab py-3 px-1 border-b-2 border-orange-500 text-orange-500 font-medium" data-tab="rankings">
                            Rankings
                        </button>
                        <button class="driver-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="profiles">
                            Driver Profiles
                        </button>
                        <button class="driver-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="comparisons">
                            Compare
                        </button>
                        <button class="driver-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="rookies">
                            Rookies
                        </button>
                    </nav>
                </div>

                <!-- Driver Content -->
                <div id="drivers-content">
                    ${this.renderRankings()}
                </div>
            </div>
        `;
    }

    async init() {
        this.setupTabs();
        if (window.feather) feather.replace();
    }

    setupTabs() {
        document.querySelectorAll('.driver-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('.driver-tab').forEach(t => {
                    t.classList.remove('border-orange-500', 'text-orange-500');
                    t.classList.add('border-transparent', 'text-gray-400');
                });
                
                tab.classList.add('border-orange-500', 'text-orange-500');
                tab.classList.remove('border-transparent', 'text-gray-400');
                
                this.activeView = tab.dataset.tab;
                this.loadTabContent(this.activeView);
            });
        });
    }

    loadTabContent(tabName) {
        const content = document.getElementById('drivers-content');
        
        switch (tabName) {
            case 'rankings':
                content.innerHTML = this.renderRankings();
                break;
            case 'profiles':
                content.innerHTML = this.renderProfiles();
                break;
            case 'comparisons':
                content.innerHTML = this.renderComparisons();
                break;
            case 'rookies':
                content.innerHTML = this.renderRookies();
                break;
        }
        
        if (window.feather) feather.replace();
    }

    renderRankings() {
        const drivers = [
            {
                position: 1,
                name: "Max Verstappen",
                team: "Red Bull Racing",
                nationality: "🇳🇱",
                points: 169,
                wins: 5,
                podiums: 7,
                poles: 3,
                fastestLaps: 2,
                trend: "up"
            },
            {
                position: 2,
                name: "Lando Norris",
                team: "McLaren",
                nationality: "🇬🇧",
                points: 113,
                wins: 1,
                podiums: 4,
                poles: 1,
                fastestLaps: 3,
                trend: "up"
            },
            {
                position: 3,
                name: "Charles Leclerc",
                team: "Ferrari",
                nationality: "🇲🇨",
                points: 98,
                wins: 1,
                podiums: 3,
                poles: 2,
                fastestLaps: 1,
                trend: "down"
            },
            {
                position: 4,
                name: "Carlos Sainz Jr.",
                team: "Ferrari",
                nationality: "🇪🇸",
                points: 87,
                wins: 1,
                podiums: 2,
                poles: 0,
                fastestLaps: 0,
                trend: "same"
            },
            {
                position: 5,
                name: "Oscar Piastri",
                team: "McLaren",
                nationality: "🇦🇺",
                points: 71,
                wins: 0,
                podiums: 2,
                poles: 0,
                fastestLaps: 1,
                trend: "up"
            }
        ];

        return `
            <div class="space-y-4">
                <!-- Championship Leader Card -->
                <div class="glass-card rounded-lg p-6 border-l-4 border-yellow-500">
                    <div class="flex items-center space-x-6">
                        <div class="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                            1
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-2">
                                <h2 class="text-2xl font-bold">${drivers[0].name}</h2>
                                <span class="text-2xl">${drivers[0].nationality}</span>
                                <span class="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-semibold">Championship Leader</span>
                            </div>
                            <p class="text-gray-400 mb-3">${drivers[0].team}</p>
                            <div class="grid grid-cols-5 gap-4 text-center">
                                <div>
                                    <div class="text-2xl font-bold text-yellow-400">${drivers[0].points}</div>
                                    <div class="text-sm text-gray-400">Points</div>
                                </div>
                                <div>
                                    <div class="text-xl font-bold text-green-400">${drivers[0].wins}</div>
                                    <div class="text-sm text-gray-400">Wins</div>
                                </div>
                                <div>
                                    <div class="text-xl font-bold text-blue-400">${drivers[0].podiums}</div>
                                    <div class="text-sm text-gray-400">Podiums</div>
                                </div>
                                <div>
                                    <div class="text-xl font-bold text-purple-400">${drivers[0].poles}</div>
                                    <div class="text-sm text-gray-400">Poles</div>
                                </div>
                                <div>
                                    <div class="text-xl font-bold text-orange-400">${drivers[0].fastestLaps}</div>
                                    <div class="text-sm text-gray-400">Fastest</div>
                                </div>
                            </div>
                        </div>
                        <button class="racing-btn px-6 py-3">
                            View Profile
                        </button>
                    </div>
                </div>

                <!-- Driver Rankings Table -->
                <div class="glass-card rounded-lg overflow-hidden">
                    <div class="p-4 border-b border-gray-700">
                        <h3 class="text-xl font-bold">Championship Standings</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-800/50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Position</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Driver</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Team</th>
                                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Points</th>
                                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Wins</th>
                                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Podiums</th>
                                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Trend</th>
                                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-700">
                                ${drivers.map((driver, index) => `
                                    <tr class="hover:bg-gray-800/30 transition-colors">
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="flex items-center space-x-3">
                                                <span class="w-8 h-8 rounded-full ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-600'} flex items-center justify-center text-white font-bold text-sm">
                                                    ${driver.position}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="flex items-center space-x-3">
                                                <span class="text-2xl">${driver.nationality}</span>
                                                <div>
                                                    <div class="text-sm font-medium">${driver.name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${driver.team}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-center">
                                            <span class="text-lg font-bold text-yellow-400">${driver.points}</span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-center">
                                            <span class="text-green-400 font-semibold">${driver.wins}</span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-center">
                                            <span class="text-blue-400 font-semibold">${driver.podiums}</span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-center">
                                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                driver.trend === 'up' ? 'bg-green-600/20 text-green-400' :
                                                driver.trend === 'down' ? 'bg-red-600/20 text-red-400' :
                                                'bg-gray-600/20 text-gray-400'
                                            }">
                                                ${driver.trend === 'up' ? '↗' : driver.trend === 'down' ? '↘' : '→'}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-center">
                                            <button class="text-orange-400 hover:text-orange-300 text-sm font-medium">
                                                View Profile
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    renderProfiles() {
        const featuredDrivers = [
            {
                name: "Max Verstappen",
                team: "Red Bull Racing",
                nationality: "🇳🇱",
                age: 26,
                championships: 3,
                careerWins: 58,
                careerPodiums: 98,
                bio: "Three-time World Champion and Red Bull Racing's star driver."
            },
            {
                name: "Lewis Hamilton",
                team: "Mercedes",
                nationality: "🇬🇧",
                age: 39,
                championships: 7,
                careerWins: 103,
                careerPodiums: 197,
                bio: "Seven-time World Champion and motorsport legend."
            },
            {
                name: "Charles Leclerc",
                team: "Ferrari",
                nationality: "🇲🇨",
                age: 26,
                championships: 0,
                careerWins: 5,
                careerPodiums: 25,
                bio: "Ferrari's star driver aiming for his first championship."
            }
        ];

        return `
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                ${featuredDrivers.map(driver => `
                    <div class="glass-card rounded-lg p-6 hover:bg-white/5 transition-all cursor-pointer">
                        <!-- Driver Header -->
                        <div class="flex items-center space-x-4 mb-4">
                            <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                ${driver.name.charAt(0)}
                            </div>
                            <div>
                                <div class="flex items-center space-x-2">
                                    <h3 class="text-xl font-bold">${driver.name}</h3>
                                    <span class="text-xl">${driver.nationality}</span>
                                </div>
                                <p class="text-gray-400">${driver.team}</p>
                                <p class="text-sm text-gray-500">Age ${driver.age}</p>
                            </div>
                        </div>

                        <!-- Driver Bio -->
                        <p class="text-gray-300 mb-4 text-sm">${driver.bio}</p>

                        <!-- Career Stats -->
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-yellow-400">${driver.championships}</div>
                                <div class="text-xs text-gray-400">Championships</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-green-400">${driver.careerWins}</div>
                                <div class="text-xs text-gray-400">Career Wins</div>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex space-x-2">
                            <button class="flex-1 racing-btn py-2 text-sm">
                                Full Profile
                            </button>
                            <button class="px-3 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors">
                                <i data-feather="heart" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderComparisons() {
        return `
            <div class="space-y-6">
                <!-- Driver Comparison Tool -->
                <div class="glass-card rounded-lg p-6">
                    <h3 class="text-xl font-bold mb-4">Compare Drivers</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label class="block text-sm font-medium mb-2">Driver 1</label>
                            <select class="w-full bg-black/20 border border-gray-600 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none">
                                <option value="">Select Driver</option>
                                <option value="verstappen">Max Verstappen</option>
                                <option value="norris">Lando Norris</option>
                                <option value="leclerc">Charles Leclerc</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Driver 2</label>
                            <select class="w-full bg-black/20 border border-gray-600 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none">
                                <option value="">Select Driver</option>
                                <option value="verstappen">Max Verstappen</option>
                                <option value="norris">Lando Norris</option>
                                <option value="leclerc">Charles Leclerc</option>
                            </select>
                        </div>
                    </div>
                    
                    <button class="racing-btn px-6 py-2">
                        <i data-feather="bar-chart-2" class="w-4 h-4 mr-2"></i>
                        Compare
                    </button>
                </div>

                <!-- Sample Comparison Result -->
                <div class="glass-card rounded-lg p-6">
                    <h4 class="text-lg font-bold mb-4">Verstappen vs Norris - 2024 Season</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Driver 1 -->
                        <div class="space-y-4">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                                    MV
                                </div>
                                <div>
                                    <h5 class="font-semibold">Max Verstappen</h5>
                                    <p class="text-sm text-gray-400">Red Bull Racing</p>
                                </div>
                            </div>
                            
                            <div class="space-y-3">
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Points:</span>
                                    <span class="font-semibold text-yellow-400">169</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Wins:</span>
                                    <span class="font-semibold text-green-400">5</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Podiums:</span>
                                    <span class="font-semibold text-blue-400">7</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Avg Finish:</span>
                                    <span class="font-semibold">2.1</span>
                                </div>
                            </div>
                        </div>

                        <!-- Driver 2 -->
                        <div class="space-y-4">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                                    LN
                                </div>
                                <div>
                                    <h5 class="font-semibold">Lando Norris</h5>
                                    <p class="text-sm text-gray-400">McLaren</p>
                                </div>
                            </div>
                            
                            <div class="space-y-3">
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Points:</span>
                                    <span class="font-semibold text-yellow-400">113</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Wins:</span>
                                    <span class="font-semibold text-green-400">1</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Podiums:</span>
                                    <span class="font-semibold text-blue-400">4</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Avg Finish:</span>
                                    <span class="font-semibold">4.2</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRookies() {
        const rookies = [
            {
                name: "Oliver Bearman",
                team: "Ferrari (Reserve)",
                nationality: "🇬🇧",
                age: 19,
                races: 2,
                points: 7,
                bestFinish: "7th",
                potential: "High"
            },
            {
                name: "Franco Colapinto",
                team: "Williams",
                nationality: "🇦🇷",
                age: 21,
                races: 9,
                points: 5,
                bestFinish: "8th", 
                potential: "Very High"
            }
        ];

        return `
            <div class="space-y-6">
                <!-- Rookie Spotlight -->
                <div class="glass-card rounded-lg p-6 border-l-4 border-green-500">
                    <div class="flex items-center space-x-3 mb-4">
                        <div class="text-3xl">🌟</div>
                        <div>
                            <h3 class="text-xl font-bold">Rookie of the Year</h3>
                            <p class="text-gray-400">Outstanding newcomer performance</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${rookies.map(rookie => `
                            <div class="bg-gray-800/30 rounded-lg p-4">
                                <div class="flex items-center space-x-3 mb-3">
                                    <span class="text-xl">${rookie.nationality}</span>
                                    <div>
                                        <h4 class="font-semibold">${rookie.name}</h4>
                                        <p class="text-sm text-gray-400">${rookie.team}</p>
                                    </div>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="text-gray-400">Age:</span>
                                        <span class="ml-2 font-semibold">${rookie.age}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-400">Races:</span>
                                        <span class="ml-2 font-semibold">${rookie.races}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-400">Points:</span>
                                        <span class="ml-2 font-semibold text-yellow-400">${rookie.points}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-400">Best:</span>
                                        <span class="ml-2 font-semibold text-green-400">${rookie.bestFinish}</span>
                                    </div>
                                </div>
                                
                                <div class="mt-3">
                                    <span class="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs font-semibold">
                                        ${rookie.potential} Potential
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Development Program -->
                <div class="glass-card rounded-lg p-6">
                    <h3 class="text-xl font-bold mb-4">Young Driver Development</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="text-center p-4 bg-gray-800/30 rounded-lg">
                            <div class="text-3xl mb-2">🏎️</div>
                            <h4 class="font-semibold mb-1">F2 Champions</h4>
                            <p class="text-sm text-gray-400">Ready for F1 promotion</p>
                        </div>
                        <div class="text-center p-4 bg-gray-800/30 rounded-lg">
                            <div class="text-3xl mb-2">🎯</div>
                            <h4 class="font-semibold mb-1">Academy Drivers</h4>
                            <p class="text-sm text-gray-400">Future championship contenders</p>
                        </div>
                        <div class="text-center p-4 bg-gray-800/30 rounded-lg">
                            <div class="text-3xl mb-2">⚡</div>
                            <h4 class="font-semibold mb-1">Test Drivers</h4>
                            <p class="text-sm text-gray-400">Gaining valuable experience</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}