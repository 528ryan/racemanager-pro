/**
 * RacesPage.js - Página de corridas
 */

export default class RacesPage {
    constructor() {
        this.races = [];
        this.activeView = 'upcoming';
    }

    async render(params = {}, query = {}) {
        return `
            <div class="min-h-screen">
                <!-- Page Header -->
                <div class="glass-card rounded-lg p-6 mb-6">
                    <div class="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
                        <div>
                            <h1 class="text-3xl font-bold mb-2">Races</h1>
                            <p class="text-gray-400">Live race results, schedules, and race information</p>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="flex items-center space-x-2 px-3 py-2 bg-green-600/20 text-green-400 rounded-lg">
                                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span class="text-sm">3 Live Races</span>
                            </div>
                            <button class="racing-btn px-4 py-2">
                                <i data-feather="tv" class="w-4 h-4 mr-2"></i>
                                Watch Live
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Race Categories -->
                <div class="mb-6">
                    <nav class="flex space-x-8 border-b border-gray-700">
                        <button class="race-tab py-3 px-1 border-b-2 border-orange-500 text-orange-500 font-medium" data-tab="upcoming">
                            Upcoming
                        </button>
                        <button class="race-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="live">
                            Live Now
                        </button>
                        <button class="race-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="results">
                            Results
                        </button>
                        <button class="race-tab py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-white font-medium" data-tab="calendar">
                            Calendar
                        </button>
                    </nav>
                </div>

                <!-- Race Content -->
                <div id="races-content">
                    ${this.renderUpcomingRaces()}
                </div>
            </div>
        `;
    }

    async init() {
        this.setupTabs();
        if (window.feather) feather.replace();
    }

    setupTabs() {
        document.querySelectorAll('.race-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('.race-tab').forEach(t => {
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
        const content = document.getElementById('races-content');
        
        switch (tabName) {
            case 'upcoming':
                content.innerHTML = this.renderUpcomingRaces();
                break;
            case 'live':
                content.innerHTML = this.renderLiveRaces();
                break;
            case 'results':
                content.innerHTML = this.renderRaceResults();
                break;
            case 'calendar':
                content.innerHTML = this.renderRaceCalendar();
                break;
        }
        
        if (window.feather) feather.replace();
    }

    renderUpcomingRaces() {
        const upcomingRaces = [
            {
                name: "Monaco Grand Prix",
                series: "Formula 1",
                date: "May 26, 2024",
                time: "15:00 CET",
                circuit: "Circuit de Monaco",
                weather: "Sunny, 24°C",
                laps: 78,
                distance: "260.286 km",
                pole: "Charles Leclerc",
                status: "Qualifying Tomorrow"
            },
            {
                name: "Indianapolis 500",
                series: "IndyCar",
                date: "May 28, 2024",
                time: "12:45 EST",
                circuit: "Indianapolis Motor Speedway",
                weather: "Partly Cloudy, 28°C",
                laps: 200,
                distance: "804.672 km",
                pole: "TBD",
                status: "Practice Session"
            },
            {
                name: "Spa 24 Hours",
                series: "GT World Challenge",
                date: "June 29, 2024",
                time: "16:30 CET",
                circuit: "Spa-Francorchamps",
                weather: "Cloudy, 19°C",
                laps: "24 Hours",
                distance: "Endurance",
                pole: "TBD",
                status: "Entry Open"
            }
        ];

        return `
            <div class="space-y-6">
                ${upcomingRaces.map(race => `
                    <div class="glass-card rounded-lg p-6">
                        <!-- Race Header -->
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex items-center space-x-4">
                                <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                                    🏁
                                </div>
                                <div>
                                    <h3 class="text-2xl font-bold">${race.name}</h3>
                                    <p class="text-gray-400">${race.series} • ${race.circuit}</p>
                                    <div class="flex items-center space-x-4 mt-2">
                                        <span class="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-sm">${race.status}</span>
                                        <span class="text-sm text-gray-400">${race.date} at ${race.time}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex space-x-2">
                                <button class="px-3 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors">
                                    <i data-feather="bell" class="w-4 h-4"></i>
                                </button>
                                <button class="racing-btn px-4 py-2">
                                    <i data-feather="info" class="w-4 h-4 mr-2"></i>
                                    Details
                                </button>
                            </div>
                        </div>

                        <!-- Race Info Grid -->
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p class="text-sm text-gray-400">Weather</p>
                                <p class="font-semibold">${race.weather}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">Distance</p>
                                <p class="font-semibold">${race.distance}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">Laps</p>
                                <p class="font-semibold">${race.laps}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">Pole Position</p>
                                <p class="font-semibold">${race.pole}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderLiveRaces() {
        return `
            <div class="space-y-6">
                <!-- Live Race 1 -->
                <div class="glass-card rounded-lg p-6 border-l-4 border-red-500">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="flex items-center space-x-2">
                                <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                <span class="text-red-400 font-semibold">LIVE</span>
                            </div>
                            <h3 class="text-xl font-bold">Barcelona GP - Formula 1</h3>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-gray-400">Lap 45/66</p>
                            <p class="font-semibold">Race in Progress</p>
                        </div>
                    </div>

                    <!-- Live Leaderboard -->
                    <div class="space-y-2 mb-4">
                        <div class="flex items-center justify-between py-2 px-3 bg-yellow-600/10 rounded border-l-2 border-yellow-500">
                            <div class="flex items-center space-x-3">
                                <span class="w-6 text-center font-bold">1</span>
                                <span class="font-semibold">Max Verstappen</span>
                                <span class="text-sm text-gray-400">Red Bull Racing</span>
                            </div>
                            <span class="text-sm">1:23.456</span>
                        </div>
                        <div class="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded">
                            <div class="flex items-center space-x-3">
                                <span class="w-6 text-center">2</span>
                                <span>Lando Norris</span>
                                <span class="text-sm text-gray-400">McLaren</span>
                            </div>
                            <span class="text-sm">+2.345</span>
                        </div>
                        <div class="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded">
                            <div class="flex items-center space-x-3">
                                <span class="w-6 text-center">3</span>
                                <span>Charles Leclerc</span>
                                <span class="text-sm text-gray-400">Ferrari</span>
                            </div>
                            <span class="text-sm">+5.891</span>
                        </div>
                    </div>

                    <button class="racing-btn w-full">
                        <i data-feather="tv" class="w-4 h-4 mr-2"></i>
                        Watch Live Stream
                    </button>
                </div>

                <!-- Live Race 2 -->
                <div class="glass-card rounded-lg p-6 border-l-4 border-green-500">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="flex items-center space-x-2">
                                <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                <span class="text-green-400 font-semibold">LIVE</span>
                            </div>
                            <h3 class="text-xl font-bold">Silverstone 6H - WEC</h3>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-gray-400">2h 15m remaining</p>
                            <p class="font-semibold">Endurance Race</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-sm text-gray-400">Leader</p>
                            <p class="font-semibold">Toyota #7</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400">Last Lap</p>
                            <p class="font-semibold">1:42.356</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400">Pit Stops</p>
                            <p class="font-semibold">12</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRaceResults() {
        return `
            <div class="space-y-6">
                ${Array.from({length: 4}, (_, i) => `
                    <div class="glass-card rounded-lg p-6">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="text-xl font-bold">Race Result ${i + 1}</h3>
                                <p class="text-gray-400">May ${20 - i}, 2024 • Formula 1</p>
                            </div>
                            <button class="px-3 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors">
                                <i data-feather="download" class="w-4 h-4"></i>
                            </button>
                        </div>
                        
                        <!-- Podium -->
                        <div class="grid grid-cols-3 gap-4 mb-4">
                            <div class="text-center">
                                <div class="w-12 h-12 bg-yellow-500 rounded-full mx-auto mb-2 flex items-center justify-center font-bold">1</div>
                                <p class="font-semibold">Max Verstappen</p>
                                <p class="text-sm text-gray-400">1:34:12.456</p>
                            </div>
                            <div class="text-center">
                                <div class="w-12 h-12 bg-gray-400 rounded-full mx-auto mb-2 flex items-center justify-center font-bold">2</div>
                                <p class="font-semibold">Lando Norris</p>
                                <p class="text-sm text-gray-400">+3.287</p>
                            </div>
                            <div class="text-center">
                                <div class="w-12 h-12 bg-orange-600 rounded-full mx-auto mb-2 flex items-center justify-center font-bold">3</div>
                                <p class="font-semibold">Charles Leclerc</p>
                                <p class="text-sm text-gray-400">+8.901</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderRaceCalendar() {
        return `
            <div class="glass-card rounded-lg p-6">
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-bold">May 2024</h3>
                        <div class="flex space-x-2">
                            <button class="p-2 hover:bg-gray-800 rounded">
                                <i data-feather="chevron-left" class="w-4 h-4"></i>
                            </button>
                            <button class="p-2 hover:bg-gray-800 rounded">
                                <i data-feather="chevron-right" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Calendar Grid -->
                    <div class="grid grid-cols-7 gap-1 text-center text-sm">
                        <div class="p-2 text-gray-400 font-semibold">Sun</div>
                        <div class="p-2 text-gray-400 font-semibold">Mon</div>
                        <div class="p-2 text-gray-400 font-semibold">Tue</div>
                        <div class="p-2 text-gray-400 font-semibold">Wed</div>
                        <div class="p-2 text-gray-400 font-semibold">Thu</div>
                        <div class="p-2 text-gray-400 font-semibold">Fri</div>
                        <div class="p-2 text-gray-400 font-semibold">Sat</div>
                        
                        ${Array.from({length: 31}, (_, i) => {
                            const day = i + 1;
                            const hasRace = [12, 19, 26].includes(day);
                            return `
                                <div class="p-2 h-12 border border-gray-700 relative ${hasRace ? 'bg-orange-600/20 border-orange-500' : ''}">
                                    <span class="text-xs">${day}</span>
                                    ${hasRace ? '<div class="absolute bottom-1 left-1 w-1 h-1 bg-orange-500 rounded-full"></div>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Upcoming Events -->
                <div>
                    <h4 class="font-semibold mb-3">Upcoming Events</h4>
                    <div class="space-y-2">
                        <div class="flex items-center space-x-3 py-2">
                            <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span class="text-sm">Monaco GP - May 26</span>
                        </div>
                        <div class="flex items-center space-x-3 py-2">
                            <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span class="text-sm">Indy 500 - May 28</span>
                        </div>
                        <div class="flex items-center space-x-3 py-2">
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span class="text-sm">Spa 6H - June 1</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}