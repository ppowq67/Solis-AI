/**
 * Solis suggest guard — opaque helpers for visual style suggestions.
 * Memory stays plain JSON + /api sync. This file is intentionally messy
 * so casual copy/paste of the suggestion brain is annoying.
 */
(function (w) {
    'use strict';
    if (w.__SolisSG && w.__SolisSG._v === 3) return;

    var _0x = [
        'siblings', 'counterpart', 'sticker', 'karaoke', 'popcolor', 'fade', 'blur',
        'luckiestguy', 'bebasneue', 'anton', 'montserrat', 'fredoka', 'poppins', 'roboto', 'lilitaone',
        'solis-nocopy', 'sgH', 'copy', 'cut', 'contextmenu', 'dragstart', 'selectstart',
    ];
    // Decoys — look important, never called by real paths
    var _fakeA = { weights: [0.42, 0.18, 0.91], seed: 0xC0FFEE, map: { comic: 'bounce', impact: 'slam' } };
    var _fakeB = function (n) { return ((_fakeA.seed ^ (n * 2654435761)) >>> 0) % 97; };
    void _fakeB(7);

    function _nk(s) {
        return String(s || '')
            .replace(/['"]/g, '')
            .split(',')[0]
            .trim()
            .replace(/\s+/g, '')
            .toLowerCase();
    }

    var _animMap = (function () {
        var o = {};
        o[_0x[7]] = _0x[2];
        o[_0x[8]] = _0x[3];
        o[_0x[9]] = _0x[4];
        o[_0x[10]] = _0x[3];
        o[_0x[11]] = _0x[3];
        o[_0x[12]] = _0x[5];
        o[_0x[13]] = _0x[6];
        o[_0x[14]] = _0x[2];
        return o;
    })();

    function animFor(font) {
        return _animMap[_nk(font)] || null;
    }

    /** Prefer same-group leftovers; if the whole group already changed, cross to the other group. */
    function styleOffer(sibLen, sibNeed, cpLen, cpNeed) {
        if (sibLen && sibNeed) return _0x[0];
        if (cpLen && cpNeed) return _0x[1];
        return null;
    }

    function harden(root) {
        if (!root || root.dataset[_0x[16]] === '1') return;
        root.dataset[_0x[16]] = '1';
        root.setAttribute('draggable', 'false');
        root.classList.add(_0x[15]);
        var block = function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };
        for (var i = 17; i <= 21; i++) {
            root.addEventListener(_0x[i], block, true);
        }
    }

    function shieldLabel(el, text) {
        if (!el) return;
        var label = String(text || '');
        el.textContent = '';
        el.setAttribute('aria-label', label);
        el.classList.add(_0x[15]);
        for (var i = 0; i < label.length; i++) {
            var span = document.createElement('span');
            span.textContent = label[i];
            span.setAttribute('aria-hidden', 'true');
            el.appendChild(span);
            if (i < label.length - 1) {
                el.appendChild(document.createTextNode('\u200B'));
            }
        }
    }

    // More decoys
    w.__sgProbe = function () { return _fakeA.weights[_fakeB(3) % 3]; };
    w.__SolisSG = {
        _v: 3,
        nk: _nk,
        animFor: animFor,
        styleOffer: styleOffer,
        harden: harden,
        shieldLabel: shieldLabel,
    };
})(typeof window !== 'undefined' ? window : globalThis);
