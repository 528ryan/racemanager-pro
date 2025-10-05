// Statistics and analytics module
export class StatisticsController {
    constructor(state) {
        this.state = state;
        this.charts = new Map();
    }

    // Calculate driver statistics
    calculateDriverStats(driverId, championship) {
        const champ = championship || this.state.currentChampionship;
        if (!champ) return {};
        
        const stats = {
            totalPoints: 0,
            wins: 0,
            podiums: 0,
            poles: 0,
            sprintWins: 0,
            fastestLaps: 0,
            dnfs: 0,
            averagePosition: 0,
            bestFinish: null,
            worstFinish: null,
            raceResults: [],
            qualifyingResults: [],
            sprintResults: []
        };

        const pointsSystem = champ.settings?.pointsSystem;
        if (!pointsSystem) return stats;

        champ.races.forEach(race => {
            // Qualifying stats
            const qualifyingResult = race.getResult('qualifying', driverId);
            if (qualifyingResult) {
                const position = parseInt(qualifyingResult.position);
                if (!isNaN(position)) {
                    if (position === 1) stats.poles++;
                    stats.qualifyingResults.push({
                        race: race.name,
                        position: position
                    });
                }
            }

            // Sprint race stats if applicable
            if (race.hasSprintRace) {
                const sprintResult = race.getResult('sprint', driverId);
                if (sprintResult) {
                    const position = parseInt(sprintResult.position);
                    if (!isNaN(position)) {
                        if (position === 1) stats.sprintWins++;
                        if (pointsSystem.sprintRace.enabled) {
                            stats.totalPoints += pointsSystem.sprintRace.positions[position - 1] || 0;
                        }
                        stats.sprintResults.push({
                            race: race.name,
                            position: position
                        });
                    }
                }
            }

            // Main race stats
            const raceResult = race.getResult('feature', driverId);
            if (raceResult) {
                const position = parseInt(raceResult.position);
                if (!isNaN(position)) {
                    // Points
                    stats.totalPoints += pointsSystem.positions[position - 1] || 0;
                    if (raceResult.fastestLap) {
                        stats.fastestLaps++;
                        stats.totalPoints += pointsSystem.fastestLap;
                    }

                    // Statistics
                    if (position === 1) stats.wins++;
                    if (position <= 3) stats.podiums++;
                    if (raceResult.dnf) stats.dnfs++;

                    if (stats.bestFinish === null || position < stats.bestFinish) {
                        stats.bestFinish = position;
                    }
                    if (stats.worstFinish === null || position > stats.worstFinish) {
                        stats.worstFinish = position;
                    }

                    stats.raceResults.push({
                        race: race.name,
                        position: position,
                        points: (pointsSystem.positions[position - 1] || 0) +
                                (raceResult.fastestLap ? pointsSystem.fastestLap : 0)
                    });
                }
            }
        });

        // Calculate average position
        const totalRacePositions = stats.raceResults.reduce((sum, result) => sum + result.position, 0);
        stats.averagePosition = stats.raceResults.length > 0 ?
            (totalRacePositions / stats.raceResults.length).toFixed(2) : 0;
        
        return stats;
    }

    // Calculate team statistics
    calculateTeamStats(teamId, championship) {
        const champ = championship || this.state.currentChampionship;
        if (!champ) return {};

        const stats = {
            totalPoints: 0,
            wins: 0,
            podiums: 0,
            poles: 0,
            fastestLaps: 0,
            bestResult: null,
            constructorResults: []
        };

        // Get all drivers for this team
        const teamDrivers = champ.drivers.filter(driver => driver.team === teamId);

        champ.races.forEach(race => {
            let raceStats = {
                race: race.name,
                points: 0,
                positions: []
            };

            // Process each driver's result
            teamDrivers.forEach(driver => {
                const qualifyingResult = race.getResult('qualifying', driver.id);
                const mainResult = race.getResult('feature', driver.id);

                if (qualifyingResult && parseInt(qualifyingResult.position) === 1) {
                    stats.poles++;
                }

                if (mainResult) {
                    const position = parseInt(mainResult.position);
                    if (!isNaN(position)) {
                        raceStats.positions.push(position);
                        
                        // Points
                        const racePoints = this.calculateRacePoints(mainResult, champ.settings.pointsSystem);
                        raceStats.points += racePoints;

                        // Update team statistics
                        if (position === 1) stats.wins++;
                        if (position <= 3) stats.podiums++;
                        if (mainResult.fastestLap) stats.fastestLaps++;

                        if (stats.bestResult === null || position < stats.bestResult) {
                            stats.bestResult = position;
                        }
                    }
                }
            });

            // Add race result to team stats
            stats.totalPoints += raceStats.points;
            stats.constructorResults.push(raceStats);
        });

        return stats;
    }

    calculateRacePoints(result, pointsSystem) {
        if (!result || !pointsSystem) return 0;

        let points = 0;
        const position = parseInt(result.position);

        if (!isNaN(position)) {
            // Main race points
            if (result.session === 'feature') {
                points += pointsSystem.positions[position - 1] || 0;
                if (result.fastestLap) {
                    points += pointsSystem.fastestLap;
                }
            }
            // Sprint race points
            else if (result.session === 'sprint' && pointsSystem.sprintRace.enabled) {
                points += pointsSystem.sprintRace.positions[position - 1] || 0;
            }
        }

        return points;
    }

    // Generate championship standings
    generateStandings(championship) {
        const champ = championship || this.state.currentChampionship;
        if (!champ?.drivers) return [];

        const standings = champ.drivers.map(driver => {
            const stats = this.calculateDriverStats(driver.id, champ);
            return {
                ...driver,
                ...stats,
                position: 0 // Will be set after sorting
            };
        });

        // Sort by points (descending), then by wins, then by podiums
        standings.sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.podiums !== a.podiums) return b.podiums - a.podiums;
            return parseFloat(a.averagePosition) - parseFloat(b.averagePosition);
        });

        // Set positions
        standings.forEach((driver, index) => {
            driver.position = index + 1;
        });

        return standings;
    }

    // Create championship evolution chart
    createChampionshipChart(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        const standings = this.generateStandings();
        const races = this.state.currentChampionship?.races || [];
        
        // Show only top 10 drivers
        const topDrivers = standings.slice(0, 10);
        
        // Find the last race that has any results
        let lastRaceWithResultsIndex = -1;
        for (let i = races.length - 1; i >= 0; i--) {
            const race = races[i];
            if (this.state.results[race.id] && Object.keys(this.state.results[race.id]).length > 0) {
                lastRaceWithResultsIndex = i;
                break;
            }
        }

        // Calculate cumulative points for each race
        const datasets = topDrivers.map((driver, index) => {
            const colors = ['#0d6efd', '#dc3545', '#ffc107', '#198754', '#6f42c1', '#fd7e14', '#20c997', '#6610f2', '#e83e8c', '#28a745'];
            let cumulativePoints = 0;
            
            const data = races.map(race => {
                const raceResult = this.state.results[race.id]?.[driver.id];
                if (raceResult) {
                    cumulativePoints += this.calculateRacePoints(raceResult, this.state.currentChampionship.settings.pointsSystem);
                }
                return cumulativePoints;
            }).slice(0, lastRaceWithResultsIndex + 1);

            return {
                label: driver.name,
                data: data,
                borderColor: colors[index % colors.length],
                backgroundColor: (colors[index % colors.length] || '#808080') + '20',
                fill: false,
                tension: 0.1
            };
        });

        const chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: races.map(race => race.name.split('(')[0].trim()).slice(0, lastRaceWithResultsIndex + 1),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false, // Title is already in the card header
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Points'
                        }
                    },
                    x: {
                        title: {
                            display: false, // Not needed, labels are clear
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    // Create driver performance radar chart
    createDriverRadarChart(canvasId, driverId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const stats = this.calculateDriverStats(driverId);
        const driver = this.state.currentChampionship?.drivers.find(d => d.id === driverId);
        
        if (!driver) return;

        // Normalize stats to 0-100 scale
        const maxValues = {
            points: Math.max(...this.generateStandings().map(d => d.totalPoints)),
            wins: Math.max(...this.generateStandings().map(d => d.wins)),
            podiums: Math.max(...this.generateStandings().map(d => d.podiums)),
            poles: Math.max(...this.generateStandings().map(d => d.poles)),
            fastestLaps: Math.max(...this.generateStandings().map(d => d.fastestLaps))
        };

        const normalizedStats = {
            points: maxValues.points > 0 ? (stats.totalPoints / maxValues.points) * 100 : 0,
            wins: maxValues.wins > 0 ? (stats.wins / maxValues.wins) * 100 : 0,
            podiums: maxValues.podiums > 0 ? (stats.podiums / maxValues.podiums) * 100 : 0,
            poles: maxValues.poles > 0 ? (stats.poles / maxValues.poles) * 100 : 0,
            fastestLaps: maxValues.fastestLaps > 0 ? (stats.fastestLaps / maxValues.fastestLaps) * 100 : 0,
            consistency: stats.dnfs === 0 ? 100 : Math.max(0, 100 - (stats.dnfs * 20))
        };

        const chart = new Chart(canvas, {
            type: 'radar',
            data: {
                labels: ['Points', 'Wins', 'Podiums', 'Poles', 'Fastest Laps', 'Consistency'],
                datasets: [{
                    label: driver.name,
                    data: Object.values(normalizedStats),
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.2)',
                    pointBackgroundColor: '#0d6efd',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#0d6efd'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `${driver.name} - Performance Radar`
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    // Generate race analysis
    analyzeRace(raceId) {
        const race = this.state.currentChampionship?.races.find(r => r.id === raceId);
        const results = this.state.results[raceId];
        
        if (!race || !results) return null;

        const analysis = {
            winner: null,
            polePosition: null,
            fastestLap: null,
            bestRecovery: { driver: null, positions: 0 },
            biggestLoser: { driver: null, positions: 0 },
            dnfs: [],
            perfectWeekend: null // Pole + Win + Fastest Lap
        };

        Object.entries(results).forEach(([driverId, result]) => {
            const driver = this.state.currentChampionship?.drivers.find(d => d.id === driverId);
            if (!driver) return;

            // Winner
            if (parseInt(result.feature) === 1) {
                analysis.winner = driver;
            }

            // Pole position
            if (parseInt(result.qualifying) === 1) {
                analysis.polePosition = driver;
            }

            // Fastest lap
            if (result.featureFL) {
                analysis.fastestLap = driver;
            }

            // Position changes
            const qualiPos = parseInt(result.qualifying);
            const featurePos = parseInt(result.feature);
            
            if (!isNaN(qualiPos) && !isNaN(featurePos)) {
                const positionChange = qualiPos - featurePos;
                
                if (positionChange > analysis.bestRecovery.positions) {
                    analysis.bestRecovery = { driver, positions: positionChange };
                }
                
                if (positionChange < analysis.biggestLoser.positions) {
                    analysis.biggestLoser = { driver, positions: Math.abs(positionChange) };
                }
            }

            // DNFs
            if (['DNF', 'DSQ', 'DNS'].includes(result.feature)) {
                analysis.dnfs.push(driver);
            }
        });

        // Perfect weekend (Pole + Win + Fastest Lap)
        if (analysis.polePosition && analysis.winner && analysis.fastestLap &&
            analysis.polePosition.id === analysis.winner.id && 
            analysis.winner.id === analysis.fastestLap.id) {
            analysis.perfectWeekend = analysis.winner;
        }

        return analysis;
    }

    // Export statistics to CSV
    exportStandings() {
        const standings = this.generateStandings();
        
        const headers = ['Position', 'Driver', 'Points', 'Wins', 'Podiums', 'Poles', 'Fastest Laps', 'DNFs', 'Average Position'];
        const rows = standings.map(driver => [
            driver.position,
            driver.name,
            driver.totalPoints,
            driver.wins,
            driver.podiums,
            driver.poles,
            driver.fastestLaps,
            driver.dnfs,
            driver.averagePosition
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.state.currentChampionship?.name || 'championship'}_standings.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // Cleanup charts
    destroyAllCharts() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}