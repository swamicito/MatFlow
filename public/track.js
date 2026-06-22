/*!
 * MatFlow UTM Tracker v1.0
 * https://mat-flow.net
 *
 * ── What this does ──────────────────────────────────────────────────────────
 *  1. Reads UTM parameters from the URL on every page load.
 *  2. Captures landing_page and referrer on first touch.
 *  3. Stores everything in localStorage + cookies (30-day TTL).
 *  4. Auto-populates hidden form fields so Webflow / Typeform / HTML forms
 *     can forward the attribution data to your backend.
 *  5. (Optional) POSTs lead data to MatFlow directly on form submission.
 *
 * ── Quick start ─────────────────────────────────────────────────────────────
 *  Paste this ONE line at the end of your <head> tag:
 *
 *    <script src="https://mat-flow.net/track.js"></script>
 *
 * ── With server-side capture ─────────────────────────────────────────────────
 *  Configure BEFORE the script tag:
 *
 *    <script>
 *      window.MatFlowConfig = {
 *        serverCapture: true,
 *        gymSlug: 'your-gym-slug',   // e.g. "method-bjj"
 *        apiKey:  'YOUR_API_KEY',    // set in MatFlow env as LEADS_API_SECRET
 *        // formSelector: '[data-lead-form]',  // optional — defaults to 'form'
 *      };
 *    </script>
 *    <script src="https://mat-flow.net/track.js"></script>
 *
 * ── Hidden field names to add in your Webflow / HTML form ───────────────────
 *  Add hidden inputs with these exact names (all are optional):
 *
 *    utm_source   utm_medium   utm_campaign   utm_term   utm_content
 *    landing_page   referrer
 *
 * ── Public API ───────────────────────────────────────────────────────────────
 *  window.MatFlowTracker.get()        → current attribution object or null
 *  window.MatFlowTracker.populate()   → re-populate fields (useful for SPAs)
 *  window.MatFlowTracker.clear()      → wipe stored data after a conversion
 */

(function (global) {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────

  var cfg          = global.MatFlowConfig || {};
  var STORAGE_KEY  = 'mf_utm';
  var COOKIE_PFX   = 'mf_';
  var TTL_MS       = 30 * 24 * 60 * 60 * 1000; // 30 days
  var UTM_KEYS     = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var ALL_KEYS     = UTM_KEYS.concat(['landing_page', 'referrer']);
  var API_ENDPOINT = cfg.apiEndpoint || 'https://mat-flow.net/api/leads';

  // ── Guard helpers ──────────────────────────────────────────────────────────

  /** Run fn(), return its result, or return null on any error. */
  function safeGet(fn) {
    try { return fn(); } catch (e) { return null; }
  }

  /** Run fn(), silently swallow any errors. */
  function safeRun(fn) {
    try { fn(); } catch (e) {}
  }

  // ── localStorage ───────────────────────────────────────────────────────────

  function lsRead() {
    return safeGet(function () {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (entry.expires_at && entry.expires_at < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return entry;
    });
  }

  function lsWrite(data) {
    safeRun(function () {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    });
  }

  function lsClear() {
    safeRun(function () { localStorage.removeItem(STORAGE_KEY); });
  }

  // ── Cookies ────────────────────────────────────────────────────────────────
  // Cookies provide a fallback when localStorage is blocked (Safari ITP,
  // cross-origin iFrames) and make the values readable server-side within
  // same-domain requests.

  function cookieWrite(name, value, expiresAt) {
    if (!value) return;
    safeRun(function () {
      document.cookie =
        COOKIE_PFX + name + '=' + encodeURIComponent(value) +
        '; expires=' + new Date(expiresAt).toUTCString() +
        '; path=/; SameSite=Lax';
    });
  }

  function cookieRead(name) {
    return safeGet(function () {
      var re = new RegExp('(?:^|; )' + COOKIE_PFX + name + '=([^;]*)');
      var m = document.cookie.match(re);
      return m ? decodeURIComponent(m[1]) : null;
    });
  }

  // ── Attribution capture ────────────────────────────────────────────────────

  /**
   * Reads UTM parameters from window.location.search.
   * Returns an object with any found keys, or null if none present.
   */
  function readUtmFromUrl() {
    var params = new URLSearchParams(global.location.search);
    var data = {};
    var found = false;

    UTM_KEYS.forEach(function (key) {
      var val = params.get(key);
      if (val && val.trim()) {
        data[key] = val.trim();
        found = true;
      }
    });

    return found ? data : null;
  }

  /**
   * Builds a fresh attribution entry and persists it to localStorage + cookies.
   * Always records the current URL as landing_page and document.referrer.
   */
  function captureAndStore(utmData) {
    var expiresAt = Date.now() + TTL_MS;
    var entry = { expires_at: expiresAt };

    UTM_KEYS.forEach(function (key) {
      entry[key] = (utmData && utmData[key]) || null;
    });
    entry.landing_page = global.location.href;
    entry.referrer     = document.referrer || null;

    lsWrite(entry);

    // Mirror each non-null value to a cookie as well.
    ALL_KEYS.forEach(function (key) {
      if (entry[key]) cookieWrite(key, entry[key], expiresAt);
    });

    return entry;
  }

  /**
   * Returns the most recent stored attribution.
   * Tries localStorage first, then falls back to reading individual cookies.
   */
  function loadAttribution() {
    var fromLs = lsRead();
    if (fromLs) return fromLs;

    // Cookie fallback — works even when localStorage is unavailable.
    var fromCookies = {};
    var found = false;
    ALL_KEYS.forEach(function (key) {
      var val = cookieRead(key);
      if (val) { fromCookies[key] = val; found = true; }
    });
    return found ? fromCookies : null;
  }

  // ── Hidden field population ────────────────────────────────────────────────

  /**
   * Finds every <input> whose `name` or `id` matches a UTM / attribution key
   * and sets its value. Both underscore (utm_source) and hyphen (utm-source)
   * variants are tried so the snippet works regardless of how the form was
   * built. Fields that already have a value are left untouched.
   */
  function populateFields(data) {
    if (!data) return;

    ALL_KEYS.forEach(function (key) {
      if (!data[key]) return;

      var selectors = [
        'input[name="' + key + '"]',
        'input[name="' + key.replace(/_/g, '-') + '"]',
        'input[id="'   + key + '"]',
      ].join(',');

      safeRun(function () {
        document.querySelectorAll(selectors).forEach(function (el) {
          // Only write if the field is currently empty (don't overwrite user input).
          if (!el.value) el.value = data[key];
        });
      });
    });
  }

  // ── Optional: server-side capture ─────────────────────────────────────────
  //
  // When serverCapture: true, the snippet intercepts form submissions and
  // fires-and-forgets a POST to /api/leads so the lead is recorded in MatFlow
  // even if the underlying form platform doesn't call a webhook.
  //
  // Security note: the api_key is visible in page source. Use a dedicated
  // write-only key (LEADS_API_SECRET) with a low-risk scope — an attacker can
  // only CREATE leads, not read or modify any data.

  function attachFormCapture(attribution) {
    if (!cfg.serverCapture || !cfg.gymSlug) return;

    var selector = cfg.formSelector || 'form';

    safeRun(function () {
      document.querySelectorAll(selector).forEach(function (form) {
        // Avoid attaching twice if populateFields is called again.
        if (form._mfAttached) return;
        form._mfAttached = true;

        form.addEventListener('submit', function () {
          safeRun(function () {
            var fd = new FormData(form);

            // Best-effort extraction of common lead field names.
            var payload = {
              gym_slug: cfg.gymSlug,
              api_key:  cfg.apiKey  || '',
              name:  fd.get('name')  || fd.get('full_name') || fd.get('Name')  || '',
              email: fd.get('email') || fd.get('Email') || '',
              phone: fd.get('phone') || fd.get('Phone') || fd.get('tel') || '',
              source: 'website',
            };

            // Merge stored attribution into the payload.
            if (attribution) {
              ALL_KEYS.forEach(function (key) {
                payload[key] = attribution[key] || null;
              });
            }

            // sendBeacon is preferred: it survives page unload without blocking.
            if (typeof navigator.sendBeacon === 'function') {
              navigator.sendBeacon(
                API_ENDPOINT,
                new Blob([JSON.stringify(payload)], { type: 'application/json' })
              );
            } else {
              // fetch with keepalive as fallback.
              fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
              }).catch(function () {});
            }
          });
        });
      });
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  function boot() {
    // 1. Check URL for fresh UTM params.
    //    If found → overwrite storage (last-touch model: a new ad campaign
    //    replaces the previous one; the fresh landing_page is also recorded).
    //    If not found → load whatever was stored on a previous page / visit.
    var freshUtm    = readUtmFromUrl();
    var attribution = freshUtm ? captureAndStore(freshUtm) : loadAttribution();

    // 2. Populate hidden fields already in the DOM.
    populateFields(attribution);

    // 3. Watch for fields injected after page load (Webflow pop-ups, SPAs).
    safeRun(function () {
      if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function () {
          populateFields(attribution);
          attachFormCapture(attribution);
        }).observe(document.body, { childList: true, subtree: true });
      }
    });

    // 4. Attach server-side capture to forms already in the DOM.
    attachFormCapture(attribution);

    // 5. Expose a minimal public API for custom integrations.
    global.MatFlowTracker = {
      /** Returns the current stored attribution object, or null. */
      get: loadAttribution,

      /**
       * Re-populate fields — call this after injecting a form dynamically,
       * e.g. after opening a Webflow modal or navigating in a SPA.
       */
      populate: function () { populateFields(loadAttribution()); },

      /**
       * Wipe stored attribution. Call this after you have confirmed a lead
       * was successfully created so the data isn't reused accidentally.
       */
      clear: lsClear,
    };
  }

  // Wait for the DOM to be interactive so form fields exist when we populate.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}(typeof window !== 'undefined' ? window : {}));
