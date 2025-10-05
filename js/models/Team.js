export class Team {
    constructor(data = {}) {
        this.id = data.id || crypto.randomUUID();
        this.name = data.name || '';
        this.shortName = data.shortName || '';
        this.color = data.color || '#000000';
        this.logo = data.logo || '';
    }

    updateInfo(data) {
        Object.assign(this, {
            name: data.name || this.name,
            shortName: data.shortName || this.shortName,
            color: data.color || this.color,
            logo: data.logo || this.logo
        });
    }
}