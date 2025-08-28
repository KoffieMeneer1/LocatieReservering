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

  // Expose a minimal wrapper as `window.keycloak` so existing code can still call
  // window.keycloak.logout() and read tokenParsed, but the raw token value is
  // not stored as a plain property on window.
  const wrapper = {
    logout: (opts) => kc.logout(opts),
    // async method to obtain a fresh token when needed by the app
    getToken: async () => {
      try { await kc.updateToken(30).catch(() => {}); } catch (e) { /* ignore */ }
      return kc.token;
    },
    // expose parsed claims but do not expose the raw token as a property
    get tokenParsed() { return kc.tokenParsed; }
  };

  Object.defineProperty(window, 'keycloak', {
    value: wrapper,
    configurable: false,
    enumerable: false,
    writable: false
  });

  (async () => {
    try {
      // Initialize Keycloak
      const authenticated = await kc.init({ onLoad: 'login-required', pkceMethod: 'S256', redirectUri: window.location.origin + '/' });
      if (!authenticated) {
        // avoid logging token details
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
