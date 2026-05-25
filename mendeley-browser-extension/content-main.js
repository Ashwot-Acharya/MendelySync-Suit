(function() {
  console.log('[Mendeley Syncer] Main-world script active. Fetch interceptor only.');

  // Hook window.fetch to capture real API tokens sent to api.mendeley.com
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    try {
      // Resolve request URL
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
      
      // ONLY capture tokens sent to api.mendeley.com (official documents REST API)
      if (typeof url === 'string' && url.includes('api.mendeley.com')) {
        let token = null;

        // Check options object (second argument)
        const options = args[1] || {};
        let headers = options.headers;
        if (headers) {
          if (headers instanceof Headers) {
            token = headers.get('Authorization') || headers.get('authorization');
          } else if (typeof headers === 'object') {
            token = headers['Authorization'] || headers['authorization'] || headers['Authorization '] || headers['authorization '];
          }
        }

        // Check Request object (first argument)
        if (!token && args[0] && typeof args[0] === 'object') {
          const req = args[0];
          if (req.headers) {
            if (req.headers instanceof Headers) {
              token = req.headers.get('Authorization') || req.headers.get('authorization');
            } else if (typeof req.headers === 'object') {
              token = req.headers['Authorization'] || req.headers['authorization'];
            }
          }
        }

        if (token && token.startsWith('Bearer ')) {
          console.log('[Mendeley Syncer] Intercepted genuine API Bearer token in fetch!');
          window.postMessage({
            type: 'MENDELEY_AUTH_TOKEN',
            token: token
          }, '*');
        }
      }
    } catch (e) {
      // Fail silently
    }
    return response;
  };
})();
