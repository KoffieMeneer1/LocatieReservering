
import Keycloak from 'keycloak-js';

interface ParsedToken {
    preferred_username?: string;
    [key: string]: any;
}

const keycloak = Keycloak({
    url: 'https://keycloak.locatiereserveren.quest',
    realm: 'ReserveringRealm',
    clientId: 'locatiereserveren-webapp'
});

(async () => {
    try {
        const authenticated = await keycloak.init({ onLoad: 'login-required' });
        if (!authenticated) {
            window.location.reload();
        } else {
            const parsed = keycloak.tokenParsed as ParsedToken;
            console.log("Ingelogd als:", parsed?.preferred_username ?? 'Onbekend');
            window.dispatchEvent(new Event('authenticated'));
        }
    } catch (error) {
        console.error("Keycloak init mislukt:", error);
    }
})();

setInterval(async () => {
    try {
        const refreshed = await keycloak.updateToken(60);
        if (refreshed) {
            console.log("Token vernieuwd");
        }
    } catch {
        console.error("Token verversen mislukt");
        keycloak.logout();
    }
}, 30000);

export default keycloak;