/* Scalelist Universe Analytics — lightweight tracker ~2KB */
(function(){
  'use strict';

  // Skip admin/vault pages
  var p = location.pathname;
  if (/\/(su-admin|su-vault)/i.test(p)) return;

  var ENDPOINT = '/api/track';

  // ── Visitor ID (cookie, survives navigation) ───────────────────────────────
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, val, days) {
    var exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(val) + '; expires=' + exp + '; path=/; SameSite=Lax';
  }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  var VID = getCookie('_su_vid');
  if (!VID) { VID = uuid(); setCookie('_su_vid', VID, 365); }

  // ── Send event ─────────────────────────────────────────────────────────────
  function send(type, data) {
    var payload = JSON.stringify({
      visitorId: VID,
      type: type,
      page: location.pathname,
      data: data || {}
    });
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    }
  }

  // ── Pageview ───────────────────────────────────────────────────────────────
  send('pageview', { referrer: document.referrer });

  // ── Scroll depth ──────────────────────────────────────────────────────────
  var milestones = [25, 50, 75, 100], reached = {};
  function getScrollPct() {
    var el = document.documentElement;
    var scrolled = el.scrollTop || document.body.scrollTop;
    var total = el.scrollHeight - el.clientHeight;
    return total > 0 ? Math.round((scrolled / total) * 100) : 0;
  }
  window.addEventListener('scroll', function() {
    var pct = getScrollPct();
    for (var i = 0; i < milestones.length; i++) {
      var m = milestones[i];
      if (pct >= m && !reached[m]) {
        reached[m] = true;
        send('scroll', { depth: m });
      }
    }
  }, { passive: true });

  // ── Click tracking ─────────────────────────────────────────────────────────
  document.addEventListener('click', function(e) {
    var el = e.target;
    // Walk up max 3 levels to find meaningful element
    for (var i = 0; i < 3 && el && el !== document.body; i++) {
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'a' || tag === 'button' || el.getAttribute('data-chapter') ||
          el.getAttribute('data-character') || el.getAttribute('onclick')) {
        send('click', {
          tag:  tag,
          text: (el.innerText || el.title || '').trim().slice(0, 80),
          href: el.href || ''
        });
        return;
      }
      el = el.parentElement;
    }
  });

  // ── Ping every 10s ─────────────────────────────────────────────────────────
  setInterval(function() {
    send('ping', { depth: getScrollPct() });
  }, 10000);

  // ── Chapter opens ──────────────────────────────────────────────────────────
  // Hook elements with data-chapter attribute
  document.addEventListener('click', function(e) {
    var el = e.target.closest ? e.target.closest('[data-chapter]') : null;
    if (el) send('chapter', { chapter: el.getAttribute('data-chapter') });
  });

  // ── Audio events ───────────────────────────────────────────────────────────
  document.addEventListener('play', function(e) {
    if (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO') {
      send('audio', { action: 'play', track: e.target.src || e.target.currentSrc || '' });
    }
  }, true);
  document.addEventListener('pause', function(e) {
    if (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO') {
      send('audio', { action: 'pause', track: e.target.src || e.target.currentSrc || '' });
    }
  }, true);

  // ── Character modal opens ──────────────────────────────────────────────────
  // Watches for elements with data-character or modal-trigger class
  document.addEventListener('click', function(e) {
    var el = e.target.closest ? e.target.closest('[data-character], .modal-trigger, [data-modal]') : null;
    if (el) {
      send('modal', {
        target: el.getAttribute('data-character') || el.getAttribute('data-modal') || el.className
      });
    }
  });

})();
