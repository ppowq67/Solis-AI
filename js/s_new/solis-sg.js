(function(e) {
  "use strict";
  if (e.__SolisSG && e.__SolisSG._v === 3) return;
  var t = [ "siblings", "counterpart", "sticker", "karaoke", "popcolor", "fade", "blur", "luckiestguy", "bebasneue", "anton", "montserrat", "fredoka", "poppins", "roboto", "lilitaone", "solis-nocopy", "sgH", "copy", "cut", "contextmenu", "dragstart", "selectstart" ];
  var n = {
    weights: [ .42, .18, .91 ],
    seed: 12648430,
    map: {
      comic: "bounce",
      impact: "slam"
    }
  };
  var _fakeB = function(e) {
    return ((n.seed ^ e * 2654435761) >>> 0) % 97;
  };
  void _fakeB(7);
  function _nk(e) {
    return String(e || "").replace(/['"]/g, "").split(",")[0].trim().replace(/\s+/g, "").toLowerCase();
  }
  var r = function() {
    var e = {};
    e[t[7]] = t[2];
    e[t[8]] = t[3];
    e[t[9]] = t[4];
    e[t[10]] = t[3];
    e[t[11]] = t[3];
    e[t[12]] = t[5];
    e[t[13]] = t[6];
    e[t[14]] = t[2];
    return e;
  }();
  function animFor(e) {
    return r[_nk(e)] || null;
  }
  function styleOffer(e, n, r, a) {
    if (e && n) return t[0];
    if (r && a) return t[1];
    return null;
  }
  function harden(e) {
    if (!e || e.dataset[t[16]] === "1") return;
    e.dataset[t[16]] = "1";
    e.setAttribute("draggable", "false");
    e.classList.add(t[15]);
    var block = function(e) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    for (var n = 17; n <= 21; n++) {
      e.addEventListener(t[n], block, true);
    }
  }
  function shieldLabel(e, n) {
    if (!e) return;
    var r = String(n || "");
    e.textContent = "";
    e.setAttribute("aria-label", r);
    e.classList.add(t[15]);
    for (var a = 0; a < r.length; a++) {
      var i = document.createElement("span");
      i.textContent = r[a];
      i.setAttribute("aria-hidden", "true");
      e.appendChild(i);
      if (a < r.length - 1) {
        e.appendChild(document.createTextNode("​"));
      }
    }
  }
  e.__sgProbe = function() {
    return n.weights[_fakeB(3) % 3];
  };
  e.__SolisSG = {
    _v: 3,
    nk: _nk,
    animFor: animFor,
    styleOffer: styleOffer,
    harden: harden,
    shieldLabel: shieldLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
