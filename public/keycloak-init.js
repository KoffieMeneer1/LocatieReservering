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
      // Initialize Keycloak without printing tokens/claims to console
      const authenticated = await kc.init({ onLoad: 'login-required', pkceMethod: 'S256', redirectUri: window.location.origin + '/' });
      if (!authenticated) {
        // Trigger login reload; avoid logging token details
        window.location.reload();
        return;
      }

      // Notify app that authentication completed
      window.dispatchEvent(new Event('authenticated'));
    } catch (err) {
      // Keep errors minimal to avoid leaking details in the browser console
      try { console.error('Keycloak initialization failed'); } catch (e) { /* ignore */ }
    }
  })();

  // Extra listeners to surface auth/token errors in the console for easier debugging
  kc.onAuthError = function() { /* auth error - suppressed in browser console */ };
  kc.onAuthRefreshError = function() { /* refresh error - suppressed */ };
  kc.onAuthSuccess = function() { /* success - suppressed */ };

  // Keep token fresh for SPA usage
  setInterval(async () => {
    try {
      // attempt silent refresh; do not log token contents
      await kc.updateToken(60).catch(() => { /* ignore refresh failures here */ });
    } catch (e) {
      try { kc.logout(); } catch (_) {}
    }
  }, 30000);
})();
