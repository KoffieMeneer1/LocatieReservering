// public/keycloak-init.js
// Browser-compatible Keycloak initialization using the CDN bundle (keycloak.min.js)
// Matches the Keycloak client configuration (root/home/redirect URIs) you showed.
(() => {
  if (typeof Keycloak === 'undefined') {
    console.error('Keycloak adapter not found. Make sure https://unpkg.com/keycloak-js is loaded before this script.');
    return;
  }

  // Use the Keycloak subdomain (works in your environment)
  const keycloakBase = 'https://keycloak.locatiereserveren.quest';
  const kc = new Keycloak({
    url: keycloakBase,
    realm: 'ReserveringRealm',
    clientId: 'locatiereserveren-webapp'
  });

  // Expose globally so existing scripts (script.js) can use `keycloak.token` etc.
  window.keycloak = kc;

  (async () => {
    try {
      console.debug('Keycloak config:', { url: keycloakBase, realm: 'ReserveringRealm', clientId: 'locatiereserveren-webapp', redirectUri: window.location.origin + '/' });
      // Prefer PKCE for public/browser clients (helps with code->token exchange)
      // Also explicitly set redirectUri to ensure the code->token exchange uses the exact URI registered in the client settings
      const authenticated = await kc.init({ onLoad: 'login-required', pkceMethod: 'S256', redirectUri: window.location.origin + '/' });
      if (!authenticated) {
        console.log('Keycloak: not authenticated, reloading to trigger login');
        window.location.reload();
        return;
      }

      console.log('Keycloak initialized, user:', kc.tokenParsed ? kc.tokenParsed.preferred_username : 'unknown');
      window.dispatchEvent(new Event('authenticated'));
    } catch (err) {
      try {
        console.error('Keycloak init failed:', err, JSON.stringify(err));
      } catch (e) {
        console.error('Keycloak init failed (could not stringify):', err);
      }
    }
  })();

  // Extra listeners to surface auth/token errors in the console for easier debugging
  kc.onAuthError = function(errorData) { console.error('Keycloak onAuthError:', errorData); };
  kc.onAuthRefreshError = function() { console.error('Keycloak onAuthRefreshError — token refresh failed'); };
  kc.onAuthSuccess = function() { console.log('Keycloak onAuthSuccess'); };

  // Keep token fresh for SPA usage
  setInterval(async () => {
    try {
      const refreshed = await kc.updateToken(60);
      if (refreshed) console.log('Keycloak token refreshed');
    } catch (e) {
      console.error('Failed to refresh token', e);
      try { kc.logout(); } catch (_) {}
    }
  }, 30000);
})();
