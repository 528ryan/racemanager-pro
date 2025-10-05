export class Driver {
    constructor(data = {}) {
        this.id = data.id || crypto.randomUUID();
        this.name = data.name || '';
        this.number = data.number || null;
        this.team = data.team || null;
        this.nationality = data.nationality || '';
        this.avatar = data.avatar || '';
    }

    updateInfo(data) {
        Object.assign(this, {
            name: data.name || this.name,
            number: data.number || this.number,
            team: data.team || this.team,
            nationality: data.nationality || this.nationality,
            avatar: data.avatar || this.avatar
        });
    }
}