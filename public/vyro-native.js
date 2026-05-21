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
  // Talks to the Capacitor BluetoothLe plugin. The native plugin is registered
  // by the Capacitor runtime, but window.Capacitor.Plugins.BluetoothLe is only
  // auto-populated if the plugin's own JS ran. Since we don't bundle that JS,
  // we obtain the plugin proxy via Capacitor.registerPlugin('BluetoothLe'),
  // which works for any registered native plugin.
  //
  // Public API is unchanged — watch-test.html still calls window.VyroNative
  // .ble.scan / connect / write / subscribe / etc. and listens on
  // window.onBleDevice / onBleConnect / onBleData / onBleDiscovered.

  var BLE = null;
  var CAP_BLE_TIMEOUT_MS = 12000;
  var capScriptRequested = false;
  var scanListenerReady = null;

  function requestCapacitorScript() {
    if (capScriptRequested || document.querySelector('script[data-vyro-capacitor]')) return;
    capScriptRequested = true;
    try {
      var s = document.createElement('script');
      s.src = '/capacitor.js';
      s.async = true;
      s.setAttribute('data-vyro-capacitor', 'true');
      s.onerror = function () {};
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }

  function resolveBle() {
    if (BLE) return BLE;
    var Cap = window.Capacitor;
    if (!Cap) { requestCapacitorScript(); return null; }
    if (Cap.Plugins && Cap.Plugins.BluetoothLe) BLE = Cap.Plugins.BluetoothLe;
    else if (typeof Cap.registerPlugin === 'function') {
      try { BLE = Cap.registerPlugin('BluetoothLe'); } catch (e) { BLE = null; }
    }
    return BLE;
  }

  function hasCapBle() { return !!resolveBle(); }

  function waitForCapBle(timeoutMs) {
    timeoutMs = timeoutMs || CAP_BLE_TIMEOUT_MS;
    var now = resolveBle();
    if (now) return Promise.resolve(now);
    return new Promise(function (resolve) {
      requestCapacitorScript();
      var t0 = Date.now();
      var iv = setInterval(function () {
        var ble = resolveBle();
        if (ble || Date.now() - t0 > timeoutMs) {
          clearInterval(iv);
          resolve(ble || null);
        }
      }, 50);
    });
  }

  // base64 ↔ hex (Capacitor wires bytes as base64; VyroNative API uses hex).
  function b64ToBytes(b64) {
    try {
      var bin = atob(b64 || '');
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (e) { return new Uint8Array(); }
  }
  function bytesToHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      s += (h.length < 2 ? '0' + h : h);
    }
    return s;
  }
  function b64ToHex(b64) { return bytesToHex(b64ToBytes(b64)); }
  function hexToB64(hex) {
    var clean = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
    var bin = '';
    for (var i = 0; i < clean.length; i += 2) {
      bin += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
    }
    try { return btoa(bin); } catch (e) { return ''; }
  }
  function textToB64(text) {
    try { return btoa(unescape(encodeURIComponent(String(text == null ? '' : text)))); }
    catch (e) { return ''; }
  }
  function emit(name, payload) {
    var fn = window[name];
    if (typeof fn === 'function') {
      try { fn(payload); } catch (e) { /* user handler errored; don't crash bridge */ }
    }
  }

  function handleScanResult(r) {
    if (!r || !r.device) return;
    emit('onBleDevice', {
      id: r.device.deviceId,
      name: r.localName || r.device.name || undefined,
      rssi: typeof r.rssi === 'number' ? r.rssi : undefined,
      services: r.uuids
    });
  }

  // One-time wiring: scan events go through 'onScanResult'.
  // Per-device disconnect + per-characteristic notification listeners are
  // added inside connect()/subscribe() respectively, because Capacitor
  // namespaces them by id/uuid.
  function ensureScanListener() {
    if (scanListenerReady) return scanListenerReady;
    scanListenerReady = waitForCapBle().then(function (ble) {
      if (!ble || typeof ble.addListener !== 'function') return;
      return ble.addListener('onScanResult', handleScanResult).catch(function () {});
    });
    return scanListenerReady;
  }

  var bleInitPromise = null;
  function bleInit() {
    var immediate = resolveBle();
    if (!bleInitPromise) {
      bleInitPromise = (immediate ? Promise.resolve(immediate) : waitForCapBle(CAP_BLE_TIMEOUT_MS))
        .then(function (ble) {
          if (!ble) throw new Error('Capacitor BluetoothLe plugin is not available in this build yet');
          BLE = ble;
          return ensureScanListener().then(function () { return BLE.initialize({ androidNeverForLocation: true }); });
        })
        .then(function () { emit('onBleState', { state: 'on' }); return BLE; })
        .catch(function (err) {
          bleInitPromise = null;
          var msg = (err && err.message) || String(err);
          if (/unauthorized|denied|permission/i.test(msg)) emit('onBleState', { state: 'unauthorized' });
          else if (/off|disabled/i.test(msg)) emit('onBleState', { state: 'off' });
          else emit('onBleState', { state: 'unsupported' });
          // Re-throw so callers know init failed.
          throw err;
        });
    }
    return bleInitPromise;
  }

  function bleScanFinish(durationMs) {
    setTimeout(function () {
      BLE.stopLEScan().catch(function () {});
      emit('onBleScanEnd', {});
    }, durationMs || 10000);
  }

  // Legacy Despia path — kept as a no-op fallback for browser preview
  // (web Bluetooth in watch-test.html is handled by the page itself via
  // navigator.bluetooth.requestDevice; we just need these to not throw).
  function despiaFire(url) { return fire(url); }

  var capBle = {
    scan:        function (services, durationMs) {
      return bleInit().then(function () {
        var opts = { allowDuplicates: false };
        if (services && services.length) opts.services = services;
        return BLE.requestLEScan(opts);
      }).then(function () {
        bleScanFinish(durationMs);
      }).catch(function (err) {
        emit('onBleConnect', { id: '', state: 'failed', error: (err && err.message) || String(err) });
      });
    },
    stopScan:    function () {
      return BLE.stopLEScan().catch(function () {}).then(function () {
        emit('onBleScanEnd', {});
      });
    },
    state:       function () {
      return bleInit().then(function () {
        return BLE.isEnabled ? BLE.isEnabled() : { value: true };
      }).then(function (r) {
        var on = r && (r.value === true || r === true);
        emit('onBleState', { state: on ? 'on' : 'off' });
        return true;
      }).catch(function () { /* state already emitted from bleInit */ });
    },
    connect:     function (id, opts) {
      opts = opts || {};
      var timeout = opts.timeout || 10000;
      // Disconnect listener is keyed per-device.
      try {
        BLE.addListener('disconnected|' + id, function () {
          emit('onBleConnect', { id: id, state: 'disconnected' });
        });
      } catch (e) {}
      return BLE.connect({ deviceId: id, timeout: timeout }).then(function () {
        emit('onBleConnect', { id: id, state: 'connected' });
        // Auto-discover so onBleDiscovered fires without a separate call.
        return capBle.discover(id);
      }).catch(function (err) {
        emit('onBleConnect', { id: id, state: 'failed', error: (err && err.message) || String(err) });
      });
    },
    disconnect:  function (id) {
      return BLE.disconnect({ deviceId: id }).catch(function () {}).then(function () {
        emit('onBleConnect', { id: id, state: 'disconnected' });
      });
    },
    discover:    function (id) {
      return BLE.discoverServices({ deviceId: id }).catch(function () {}).then(function () {
        return BLE.getServices({ deviceId: id });
      }).then(function (r) {
        var services = (r && r.services) || [];
        emit('onBleDiscovered', {
          id: id,
          services: services.map(function (s) {
            return {
              uuid: s.uuid,
              characteristics: (s.characteristics || []).map(function (c) {
                var props = [];
                if (c.properties) {
                  for (var k in c.properties) {
                    if (Object.prototype.hasOwnProperty.call(c.properties, k) && c.properties[k]) props.push(k);
                  }
                }
                return { uuid: c.uuid, properties: props };
              })
            };
          })
        });
      }).catch(function (err) {
        // Discovery failed; surface via onBleEvent so callers can react.
        emit('onBleEvent', { type: 'discoverError', id: id, error: (err && err.message) || String(err) });
      });
    },
    read:        function (id, svc, chr) {
      return BLE.read({ deviceId: id, service: svc, characteristic: chr }).then(function (r) {
        emit('onBleData', { id: id, service: svc, characteristic: chr, value: b64ToHex(r && r.value) });
      }).catch(function (err) {
        emit('onBleEvent', { type: 'readError', id: id, service: svc, characteristic: chr, error: (err && err.message) || String(err) });
      });
    },
    write:       function (id, svc, chr, value, withResponse) {
      // Old API accepted a free-form `value`. If it parses cleanly as hex,
      // treat it as raw bytes; otherwise UTF-8 encode it.
      var s = String(value == null ? '' : value);
      var stripped = s.replace(/[^0-9a-fA-F]/g, '');
      var isHex = stripped.length > 0 && stripped.length % 2 === 0 && /^[0-9a-fA-F\s:,-]+$/.test(s);
      var b64 = isHex ? hexToB64(stripped) : textToB64(s);
      var method = withResponse === false ? 'writeWithoutResponse' : 'write';
      return BLE[method]({ deviceId: id, service: svc, characteristic: chr, value: b64 })
        .then(function () { emit('onBleWriteComplete', { id: id, service: svc, characteristic: chr, success: true }); })
        .catch(function (err) {
          emit('onBleWriteComplete', { id: id, service: svc, characteristic: chr, success: false, error: (err && err.message) || String(err) });
        });
    },
    writeHex:    function (id, svc, chr, hex, withResponse) {
      var b64 = hexToB64(hex);
      var method = withResponse === false ? 'writeWithoutResponse' : 'write';
      return BLE[method]({ deviceId: id, service: svc, characteristic: chr, value: b64 })
        .then(function () { emit('onBleWriteComplete', { id: id, service: svc, characteristic: chr, success: true }); })
        .catch(function (err) {
          emit('onBleWriteComplete', { id: id, service: svc, characteristic: chr, success: false, error: (err && err.message) || String(err) });
        });
    },
    writeText:   function (id, svc, chr, text, withResponse) {
      var b64 = textToB64(text);
      var method = withResponse === false ? 'writeWithoutResponse' : 'write';
      return BLE[method]({ deviceId: id, service: svc, characteristic: chr, value: b64 })
        .then(function () { emit('onBleWriteComplete', { id: id, service: svc, characteristic: chr, success: true }); })
        .catch(function (err) {
          emit('onBleWriteComplete', { id: id, service: svc, characteristic: chr, success: false, error: (err && err.message) || String(err) });
        });
    },
    subscribe:   function (id, svc, chr /*, server (unused under Capacitor) */) {
      var key = 'notification|' + id + '|' + svc + '|' + chr;
      try {
        BLE.addListener(key, function (r) {
          emit('onBleData', { id: id, service: svc, characteristic: chr, value: b64ToHex(r && r.value) });
        });
      } catch (e) {}
      return BLE.startNotifications({ deviceId: id, service: svc, characteristic: chr }).catch(function (err) {
        emit('onBleEvent', { type: 'subscribeError', id: id, service: svc, characteristic: chr, error: (err && err.message) || String(err) });
      });
    },
    unsubscribe: function (id, svc, chr) {
      return BLE.stopNotifications({ deviceId: id, service: svc, characteristic: chr }).catch(function () {});
    },
    rssi:        function (id) {
      return BLE.readRssi({ deviceId: id }).then(function (r) {
        emit('onBleEvent', { type: 'rssi', id: id, rssi: r && r.value });
      }).catch(function () {});
    }
  };

  var lazyCapBle = {};
  Object.keys(capBle).forEach(function (key) {
    lazyCapBle[key] = function () {
      var args = arguments;
      return bleInit().then(function () { return capBle[key].apply(capBle, args); });
    };
  });

  // Legacy stub — Despia URL-scheme path. Despia never handled bluetooth://
  // so these are no-ops; kept only so watch-test.html doesn't crash when
  // it runs in browser preview (its native-BLE branch silently fails and
  // the page falls back to navigator.bluetooth on its own).
  var despiaBle = {
    scan:        function (services, durationMs) {
      var q = 'duration=' + (durationMs || 10000);
      if (services && services.length) q = 'services=' + services.join(',') + '&' + q;
      return despiaFire('bluetooth://scan?' + q);
    },
    stopScan:    function () { return despiaFire('bluetooth://stopscan'); },
    state:       function () { return despiaFire('bluetooth://state'); },
    connect:     function (id, opts) {
      opts = opts || {};
      var q = 'id=' + encodeURIComponent(id) + '&timeout=' + (opts.timeout || 10000);
      if (opts.autoConnect) q += '&auto_connect=true';
      if (opts.server)      q += '&server=' + encodeURIComponent(opts.server);
      return despiaFire('bluetooth://connect?' + q);
    },
    disconnect:  function (id)             { return despiaFire('bluetooth://disconnect?id=' + encodeURIComponent(id)); },
    discover:    function (id)             { return despiaFire('bluetooth://discover?id=' + encodeURIComponent(id)); },
    read:        function (id, svc, chr)   { return despiaFire('bluetooth://read?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr); },
    write:       function (id, svc, chr, v, wr) { return despiaFire('bluetooth://write?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr + '&value=' + encodeURIComponent(v) + '&with_response=' + (wr ? 'true' : 'false')); },
    writeHex:    function (id, svc, chr, h, wr) { return despiaFire('bluetooth://write?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr + '&hex=' + encodeURIComponent(h) + '&with_response=' + (wr ? 'true' : 'false')); },
    writeText:   function (id, svc, chr, t, wr) { return despiaFire('bluetooth://write?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr + '&text=' + encodeURIComponent(t) + '&with_response=' + (wr ? 'true' : 'false')); },
    subscribe:   function (id, svc, chr, server) {
      var u = 'bluetooth://subscribe?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr;
      if (server) u += '&server=' + encodeURIComponent(server);
      return despiaFire(u);
    },
    unsubscribe: function (id, svc, chr) { return despiaFire('bluetooth://unsubscribe?id=' + encodeURIComponent(id) + '&service=' + svc + '&char=' + chr); },
    rssi:        function (id)           { return despiaFire('bluetooth://rssi?id=' + encodeURIComponent(id)); }
  };

  var ble = (window.Capacitor || isIOS) ? lazyCapBle : despiaBle;

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
    get isCapacitor() { return !!window.Capacitor; },
    get isNativeCapacitor() {
      var Cap = window.Capacitor;
      return !!(Cap && (typeof Cap.isNativePlatform !== 'function' || Cap.isNativePlatform()));
    },
    get hasCapacitorBle() { return hasCapBle(); },
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
