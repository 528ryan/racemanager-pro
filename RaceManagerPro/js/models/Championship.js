export class Championship {
    constructor(data = {}) {
        this.id = data.id || crypto.randomUUID();
        this.name = data.name || '';
        this.season = data.season || new Date().getFullYear();
        this.series = data.series || '';
        this.description = data.description || '';
        this.userId = data.userId || '';
        this.createdAt = data.createdAt || new Date();
        this.isPublic = data.isPublic || true;
        this.activityScore = data.activityScore || 0;
        this.drivers = data.drivers || [];
        this.teams = data.teams || [];
        this.races = data.races || [];
        this.settings = data.settings || {
            pointsSystem: {
                positions: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
                fastestLap: 1,
                sprintRace: {
                    enabled: false,
                    positions: [8, 7, 6, 5, 4, 3, 2, 1]
                }
            },
            teamChampionship: true,
            sprintRaces: false
        };
    }

    addDriver(driver) {
        if (!this.drivers.find(d => d.id === driver.id)) {
            this.drivers.push(driver);
        }
    }

    removeDriver(driverId) {
        this.drivers = this.drivers.filter(d => d.id !== driverId);
    }

    addTeam(team) {
        if (!this.teams.find(t => t.id === team.id)) {
            this.teams.push(team);
        }
    }

    removeTeam(teamId) {
        this.teams = this.teams.filter(t => t.id !== teamId);
    }

    addRace(race) {
        if (!this.races.find(r => r.id === race.id)) {
            this.races.push(race);
        }
    }

    removeRace(raceId) {
        this.races = this.races.filter(r => r.id !== raceId);
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    toFirestore() {
        return {
            id: this.id,
            name: this.name,
            season: this.season,
            series: this.series,
            description: this.description,
            userId: this.userId,
            createdAt: this.createdAt,
            drivers: this.drivers,
            teams: this.teams,
            races: this.races,
            settings: this.settings,
            isPublic: this.isPublic || true,
            activityScore: this.activityScore || 0
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        return new Championship({
            id: doc.id,
            ...data
        });
    }
}