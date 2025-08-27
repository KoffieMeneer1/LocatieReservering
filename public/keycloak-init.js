// public/keycloak-init.js
// Browser-compatible Keycloak initialization using the CDN bundle (keycloak.min.js)
// Matches the Keycloak client configuration (root/home/redirect URIs) you showed.
(() => {
  if (typeof Keycloak === 'undefined') {
    console.error('Keycloak adapter not found. Make sure https://unpkg.com/keycloak-js is loaded before this script.');
    return;
  }

  // Use path-based URL so we can test Keycloak proxied under /auth
  const keycloakBase = window.location.origin + '/auth';
  const kc = new Keycloak({
    url: keycloakBase,
    realm: 'ReserveringRealm',
    clientId: 'locatiereserveren-webapp'
  });

  // Expose globally so existing scripts (script.js) can use `keycloak.token` etc.
  window.keycloak = kc;

  (async () => {
    try {
      const authenticated = await kc.init({ onLoad: 'login-required' });
      if (!authenticated) {
        console.log('Keycloak: not authenticated, reloading to trigger login');
        window.location.reload();
        return;
      }

      console.log('Keycloak initialized, user:', kc.tokenParsed ? kc.tokenParsed.preferred_username : 'unknown');
      window.dispatchEvent(new Event('authenticated'));
    } catch (err) {
      console.error('Keycloak init failed:', err);
    }
  })();

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
