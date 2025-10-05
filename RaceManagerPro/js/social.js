export class SocialController {
    constructor(state, statisticsController) {
        this.state = state;
        this.statisticsController = statisticsController;
    }

    shareStandings() {
        const champ = this.state.currentChampionship;
        if (!champ) return;

        const standings = this.statisticsController.generateStandings();
        if (standings.length === 0) {
            alert('No standings to share yet.');
            return;
        }

        let shareText = `🏆 ${champ.name} Standings 🏆\n\n`;
        standings.forEach(driver => {
            shareText += `${driver.position}. ${driver.name} - ${driver.totalPoints} pts\n`;
        });

        if (navigator.share) {
            navigator.share({
                title: `${champ.name} Standings`,
                text: shareText,
            })
            .catch(console.error);
        } else {
            // Fallback for browsers that don't support navigator.share
            const modal = new bootstrap.Modal(document.getElementById('share-modal'));
            const textarea = document.getElementById('share-text');
            textarea.value = shareText;
            modal.show();
        }
    }
}