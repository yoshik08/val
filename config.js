// auto-detect: localhost backend when running locally, render when hosted
(function () {
  var api = "https://val-api-e63c.onrender.com";
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) api = "http://localhost:10000";
  } catch (e) {}
  window.VAL_API = window.VAL_API || api;
})();
