export class Race {
    constructor(data = {}) {
        this.id = data.id || crypto.randomUUID();
        this.name = data.name || '';
        this.round = data.round || 1;
        this.date = data.date || new Date().toISOString().split('T')[0];
        this.circuit = data.circuit || '';
        this.hasSprintRace = data.hasSprintRace || false;
        this.completed = data.completed || false;
        this.results = data.results || {
            qualifying: {},
            sprint: {},
            feature: {}
        };
    }

    updateInfo(data) {
        Object.assign(this, {
            name: data.name || this.name,
            round: data.round || this.round,
            date: data.date || this.date,
            circuit: data.circuit || this.circuit,
            hasSprintRace: data.hasSprintRace !== undefined ? data.hasSprintRace : this.hasSprintRace
        });
    }

    addResult(session, driverId, result) {
        if (!this.results[session]) {
            this.results[session] = {};
        }
        this.results[session][driverId] = result;
    }

    getResult(session, driverId) {
        return this.results[session]?.[driverId] || null;
    }

    markAsCompleted() {
        this.completed = true;
    }
}