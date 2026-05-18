/* VYRO ↔ Despia native bridge (iOS).
 * Exposes window.VyroNative with helpers for every native feature we use.
 * All calls are no-ops in a regular browser, so the same code is safe in web preview.
 *
 * Docs: https://setup.despia.com/mcp  (Despia Documentation)
 * Native runtime detected via the "despia" token in the user-agent.
 */
(function () {
  'use strict';

  var UA = (navigator.userAgent || '').toLowerCase();
  var isDespia = UA.indexOf('despia') !== -1;
  var isIOS = UA.indexOf('iphone') !== -1 || UA.indexOf('ipad') !== -1;
  var isDespiaIOS = isDespia && isIOS;

  /** Fire a despia:// scheme. Returns true if it actually fired. */
  function fire(url) {
    if (!isDespia) return false;
    try { window.location.href = url; return true; } catch (e) { return false; }
  }

  /** Await a despia call by polling a window.<key> set by the runtime. */
  function awaitKey(url, key, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise(function (resolve, reject) {
      if (!isDespia) return resolve(null);
      var before = window[key];
      fire(url);
      var t0 = Date.now();
      var iv = setInterval(function () {
        if (window[key] !== before) { clearInterval(iv); resolve(window[key]); }
        else if (Date.now() - t0 > timeoutMs) { clearInterval(iv); reject(new Error('timeout')); }
      }, 80);
    });
  }

  // ───────────────────────── Biometrics ─────────────────────────
  // Callbacks must be globals so the runtime can find them.
  var bioListeners = { success: [], failure: [], unavailable: [] };
  window.onBioAuthSuccess     = function ()        { bioListeners.success.forEach(function (f) { try { f(); } catch (_) {} }); };
  window.onBioAuthFailure     = function (c, m)    { bioListeners.failure.forEach(function (f) { try { f(c, m); } catch (_) {} }); };
  window.onBioAuthUnavailable = function ()        { bioListeners.unavailable.forEach(function (f) { try { f(); } catch (_) {} }); };

  function biometricsPrompt(onSuccess, onFailure, onUnavailable) {
    if (onSuccess)     bioListeners.success.push(onSuccess);
    if (onFailure)     bioListeners.failure.push(onFailure);
    if (onUnavailable) bioListeners.unavailable.push(onUnavailable);
    fire('bioauth://');
  }

  // ───────────────────────── Haptics ─────────────────────────
  var haptics = {
    light:   function () { fire('lighthaptic://');   },
    heavy:   function () { fire('heavyhaptic://');   },
    success: function () { fire('successhaptic://'); },
    warning: function () { fire('warninghaptic://'); },
    error:   function () { fire('errorhaptic://');   }
  };

  // ───────────────────────── HealthKit (iOS only) ─────────────────────────
  // Returns parsed JSON or null when not in Despia iOS.
  async function hkRead(identifier, days) {
    if (!isDespiaIOS) return null;
    var url = 'readhealthkit://' + identifier + (days != null ? '?days=' + days : '');
    var raw = await awaitKey(url, 'healthkitResponse', 15000).catch(function () { return null; });
    return raw;
  }
  function hkWrite(identifier, value) {
    if (!isDespiaIOS) return false;
    return fire('writehealthkit://' + identifier + '//' + value);
  }
  function hkObserve(types, frequency, server) {
    if (!isDespiaIOS) return false;
    var url = 'healthkit://observe?types=' + types.join(',')
            + '&frequency=' + (frequency || 'immediate')
            + '&server=' + encodeURIComponent(server);
    return fire(url);
  }
  function hkUnobserve(types) {
    if (!isDespiaIOS) return false;
    return fire('healthkit://unobserve?types=' + (types && types.length ? types.join(',') : 'all'));
  }
  var health = {
    read:        hkRead,
    write:       hkWrite,
    observe:     hkObserve,
    unobserve:   hkUnobserve,
    // Convenience pulls for Vyro views
    heartRate:   function (days) { return hkRead('HKQuantityTypeIdentifierHeartRate', days || 7); },
    hrv:         function (days) { return hkRead('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', days || 7); },
    restingHR:   function (days) { return hkRead('HKQuantityTypeIdentifierRestingHeartRate', days || 14); },
    steps:       function (days) { return hkRead('HKQuantityTypeIdentifierStepCount', days || 7); },
    sleep:       function (days) { return hkRead('HKCategoryTypeIdentifierSleepAnalysis', days || 7); },
    workouts:    function (days) { return hkRead('HKWorkoutTypeIdentifier', days || 14); },
    activeEnergy:function (days) { return hkRead('HKQuantityTypeIdentifierActiveEnergyBurned', days || 7); },
    vo2Max:      function (days) { return hkRead('HKQuantityTypeIdentifierVO2Max', days || 30); },
    distance:    function (days) { return hkRead('HKQuantityTypeIdentifierDistanceWalkingRunning', days || 7); }
  };

  // ───────────────────────── Bluetooth ─────────────────────────
  // Thin wrapper. Caller wires up window.onBleDevice / onBleConnect / onBleData / onBleEvent.
  var ble = {
    scan:        function (services, durationMs) {
      var q = 'duration=' + (durationMs || 10000);
      if (services && services.length) q = 'services=' + services.join(',') + '&' + q;
      return fire('bluetooth://scan?' + q);
    },
    stopScan:    function ()                       { return fire('bluetooth://stopscan'); },
    state:       function ()                       { return fire('bluetooth://state'); },
    connect:     function (id, opts) {
      opts = opts || {};
      var q = 'id=' + encodeURIComponent(id) + '&timeout=' + (opts.timeout || 10000);
      if (opts.autoConnect) q += '&auto_connect=true';
      if (opts.server)      q += '&server=' + encodeURIComponent(opts.server);
      return fire('bluetooth://connect?' + q);
    },
    disconnect:  function (id)                     { return fire('bluetooth://disconnect?id=' + encodeURIComponent(id)); },
    discover:    function (id)                     { return fire('bluetooth://discover?id=' + encodeURIComponent(id)); },
    read:        function (id, svc, chr)           { return fire('bluetooth://read?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr); },
    write:       function (id, svc, chr, value, withResponse) {
      return fire('bluetooth://write?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr
                + '&value=' + encodeURIComponent(value) + '&with_response=' + (withResponse ? 'true' : 'false'));
    },
    writeHex:    function (id, svc, chr, hex, withResponse) {
      return fire('bluetooth://write?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr
                + '&hex=' + encodeURIComponent(hex) + '&with_response=' + (withResponse ? 'true' : 'false'));
    },
    writeText:   function (id, svc, chr, text, withResponse) {
      return fire('bluetooth://write?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr
                + '&text=' + encodeURIComponent(text) + '&with_response=' + (withResponse ? 'true' : 'false'));
    },
    subscribe:   function (id, svc, chr, server) {
      var u = 'bluetooth://subscribe?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr;
      if (server) u += '&server=' + encodeURIComponent(server);
      return fire(u);
    },
    unsubscribe: function (id, svc, chr)           { return fire('bluetooth://unsubscribe?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr); },
    rssi:        function (id)                     { return fire('bluetooth://rssi?id=' + encodeURIComponent(id)); }
  };

  // ───────────────────────── Gyroscope ─────────────────────────
  var gyro = {
    start: function (threshold, onChange) {
      if (onChange) window.onGyroscopeChange = onChange;
      return fire('gyroscope://start?threshold=' + (threshold == null ? 0 : threshold));
    },
    stop:  function () { return fire('gyroscope://stop'); }
  };

  // ───────────────────────── GPS / Location ─────────────────────────
  var location = {
    start: function (opts, onChange) {
      opts = opts || {};
      if (onChange) window.onLocationChange = onChange;
      var qs = [];
      if (opts.buffer)   qs.push('buffer=' + opts.buffer);
      if (opts.movement) qs.push('movement=' + opts.movement);
      if (opts.server)   qs.push('server=' + encodeURIComponent(opts.server));
      return fire('location://' + (qs.length ? '?' + qs.join('&') : ''));
    },
    stop: function () { return fire('stoplocation://'); }
  };

  // ───────────────────────── Camera Roll ─────────────────────────
  function saveImage(url)  { return fire('savethisimage://?url=' + encodeURIComponent(url)); }

  // ───────────────────────── Share Dialog ─────────────────────────
  function share(message, url) {
    var u = 'shareapp://message?=' + encodeURIComponent(message || '');
    if (url) u += '&url=' + encodeURIComponent(url);
    return fire(u);
  }

  // ───────────────────────── Status Bar + Dark Mode ─────────────────────────
  function setStatusBar(color) {
    // 'white' for dark backgrounds, 'black' for light
    return fire('statusbartextcolor://' + (color === 'white' ? 'white' : 'black'));
  }
  function syncStatusBarToTheme() {
    try {
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setStatusBar(dark ? 'white' : 'black');
    } catch (e) {}
  }

  // ───────────────────────── Screen Brightness ─────────────────────────
  var brightness = {
    on:   function () { return fire('scanningmode://on');   }, // max brightness (good for on-court display)
    off:  function () { return fire('scanningmode://off');  },
    auto: function () { return fire('scanningmode://auto'); }
  };

  // ───────────────────────── Speech Recognition ─────────────────────────
  var speech = {
    start: function (opts) {
      opts = opts || {};
      var qs = [];
      if (opts.language)   qs.push('language=' + encodeURIComponent(opts.language));
      if (opts.interim)    qs.push('interim=true');
      if (opts.continuous) qs.push('continuous=true');
      if (opts.max)        qs.push('max=' + opts.max);
      if (opts.knownWords) qs.push('known_words=' + encodeURIComponent(opts.knownWords.join(',')));
      return fire('speechrecognition://start' + (qs.length ? '?' + qs.join('&') : ''));
    },
    stop:  function () { return fire('speechrecognition://stop'); },
    abort: function () { return fire('speechrecognition://abort'); }
  };

  // ───────────────────────── Storage Vault (biometric-bound, syncs across devices) ─────────────────────────
  var vault = {
    set: function (key, value, locked) {
      var u = 'setvault://?key=' + encodeURIComponent(key) + '&value=' + encodeURIComponent(value == null ? '' : value);
      if (locked) u += '&locked=true';
      return fire(u);
    },
    get: function (key) {
      if (!isDespia) return Promise.resolve(null);
      return awaitKey('readvault://?key=' + encodeURIComponent(key), 'vaultValue', 6000)
        .catch(function () { return null; });
    }
  };

  // ───────────────────────── Home Widgets ─────────────────────────
  function registerWidget(url, refreshMinutes) {
    return fire('widget://' + url + (refreshMinutes ? '?refresh=' + refreshMinutes : ''));
  }

  // ───────────────────────── Auto-wire on launch (iOS only) ─────────────────────────
  function autoInit() {
    if (!isDespia) return;
    // Match the iOS status bar to system theme; re-sync on change.
    syncStatusBarToTheme();
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', syncStatusBarToTheme);
      else if (mq.addListener) mq.addListener(syncStatusBarToTheme);
    } catch (e) {}
  }

  // ───────────────────────── Public API ─────────────────────────
  window.VyroNative = {
    isDespia: isDespia,
    isIOS: isIOS,
    isDespiaIOS: isDespiaIOS,
    fire: fire,
    awaitKey: awaitKey,
    biometrics: { prompt: biometricsPrompt },
    haptics: haptics,
    health: health,
    ble: ble,
    gyro: gyro,
    location: location,
    saveImage: saveImage,
    share: share,
    statusBar: { set: setStatusBar, syncToTheme: syncStatusBarToTheme },
    brightness: brightness,
    speech: speech,
    vault: vault,
    widget: { register: registerWidget }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
