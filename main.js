(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    const canvas = document.getElementById('heartCanvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');

    const PHRASE = 'iloveyou';
    const OUTLINE_PHRASE_COUNT = 160;
    const MAX_MARKERS = 248;
    const ARC_OVERLAP_PX = 4;
    const INTRO_STAGGER_MS = 2000;
    const POP_MS = 1000;

    const TRAIL = 'rgba(10, 7, 16, 0.175)';
    const SHADOW_TEXT = 'rgba(0, 0, 0, 0.32)';

    let W = window.innerWidth;
    let H = window.innerHeight;
    let cx = W / 2;
    let cy = H / 2;

    function syncCanvasSize() {
      W = window.innerWidth;
      H = window.innerHeight;
      cx = W / 2;
      cy = H / 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (typeof ctx.imageSmoothingQuality === 'string') {
        ctx.imageSmoothingQuality = 'high';
      }
    }
    syncCanvasSize();

    function heartPoint(t) {
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      return { x, y };
    }

    function fontSpec(size) {
      return '700 ' + size + 'px "JetBrains Mono", monospace';
    }

    function measurePhraseWidth(phrase, fontSize) {
      const p = document.createElement('canvas').getContext('2d');
      p.font = fontSpec(fontSize);
      return p.measureText(phrase).width;
    }

    function thinSameHorizontalBand(markers, phrase, fontSize) {
      const w = measurePhraseWidth(phrase, fontSize);
      const minCenterDx = Math.max(0, w - ARC_OVERLAP_PX);
      const bandDy = fontSize * 0.48;
      const out = [];
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        let ok = true;
        for (let j = 0; j < out.length; j++) {
          const o = out[j];
          if (Math.abs(m.ty - o.ty) >= bandDy) continue;
          if (Math.abs(m.tx - o.tx) < minCenterDx - 1e-6) {
            ok = false;
            break;
          }
        }
        if (ok) out.push(m);
      }
      return out;
    }

    function buildOutlineMarkers(scale, phrase) {
      const n = 720;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const p = heartPoint(t);
        pts.push({ x: cx + p.x * scale, y: cy + p.y * scale });
      }
      const segLen = [];
      let perimeter = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const L = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
        segLen.push(L);
        perimeter += L;
      }

      const count = Math.min(MAX_MARKERS, Math.max(64, OUTLINE_PHRASE_COUNT));
      const spacing = perimeter / count;

      let fontSize = 11;
      for (let fs = 44; fs >= 9; fs--) {
        const w = measurePhraseWidth(phrase, fs);
        if (w <= spacing + ARC_OVERLAP_PX) {
          fontSize = fs;
          break;
        }
      }
      fontSize = Math.min(fontSize + 2, 46);
      while (fontSize > 9 && measurePhraseWidth(phrase, fontSize) > spacing + ARC_OVERLAP_PX) {
        fontSize--;
      }

      const markers = [];
      for (let k = 0; ; k++) {
        const target = k * spacing;
        if (target > perimeter - 1e-6) break;
        let acc = 0;
        for (let i = 0; i < n; i++) {
          const L = segLen[i];
          if (acc + L >= target - 1e-9) {
            const u = L > 1e-12 ? (target - acc) / L : 0;
            const a = pts[i];
            const b = pts[(i + 1) % n];
            const tx = a.x + (b.x - a.x) * u;
            const ty = a.y + (b.y - a.y) * u;
            markers.push({ tx: tx, ty: ty, s: target / perimeter });
            break;
          }
          acc += L;
        }
      }
      return {
        markers: thinSameHorizontalBand(markers, phrase, fontSize),
        fontSize: fontSize,
      };
    }

    let scale = Math.min(W, H) / 40;
    let fontSize = 11;
    const labels = [];
    let introBaseMs = 0;

    function circDist01(a, b) {
      let d = Math.abs(a - b);
      return Math.min(d, 1 - d);
    }

    function smoothToneAt(s, timeMs) {
      const u = s - Math.floor(s);
      const t = timeMs * 0.000055;
      const travel = (timeMs * 0.00011) % 1;
      const uShift = (u - travel + 1) % 1;

      function seamSafeBlend(phase, baseU) {
        const a = 2 * Math.PI * baseU + phase + t;
        const c1 = Math.cos(a);
        const c2 = Math.cos(2 * a + 0.85);
        const c3 = Math.cos(3 * a - 1.15 + t * 0.35);
        return (c1 + 0.38 * c2 + 0.17 * c3) / 1.55;
      }

      const w0 = seamSafeBlend(0.15, uShift);
      const w1 = seamSafeBlend(1.05 + t * 0.2, uShift);
      const w2 = seamSafeBlend(-0.55 - t * 0.15, uShift);

      const rimW = 0.052;
      const rim = Math.exp(-Math.pow(circDist01(u, travel) / rimW, 2));
      const rimTail = Math.exp(-Math.pow(circDist01(u, (travel + 0.12) % 1) / (rimW * 1.35), 2)) * 0.45;

      const breathe = 0.5 + 0.5 * Math.sin(timeMs * 0.0024);

      let hueRaw = 312 + 22 * w0 + 10 * w1 + 5 * w2 + 3 * Math.sin(t * 1.1);
      hueRaw += 14 * rim + 6 * rimTail;
      const hue = ((hueRaw % 360) + 360) % 360;

      let sat = 58 + 12 * (0.5 + 0.5 * w1) + 8 * (0.5 + 0.5 * w2);
      sat += 22 * rim + 10 * rimTail;
      sat += 4 * breathe;

      let light = 66 + 8 * w0 + 5 * (0.5 + 0.5 * w1) - 4 * (0.5 + 0.5 * w2);
      light += 20 * rim + 9 * rimTail;
      light += 5 * breathe;

      return {
        hue: hue,
        sat: Math.min(96, Math.max(50, sat)),
        light: Math.min(92, Math.max(54, light)),
      };
    }

    function lerpHueShortest(from, to, t) {
      let d = to - from;
      d = ((((d + 180) % 360) + 360) % 360) - 180;
      return from + d * t;
    }

    function easeOutCubic(t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return 1 - Math.pow(1 - t, 3);
    }

    function Label(m, introBaseMs, orderIdx, orderTotal) {
      this.tx = m.tx;
      this.ty = m.ty;
      this.s = m.s;
      this.x = m.tx;
      this.y = m.ty;
      const span = orderTotal <= 1 ? 0 : INTRO_STAGGER_MS;
      const along = orderTotal <= 1 ? 0 : orderIdx / (orderTotal - 1);
      this.revealAt = introBaseMs + along * span;
      const t0 = smoothToneAt(m.s, Date.now());
      this.hue = t0.hue;
      this.sat = t0.sat;
      this.light = t0.light;
    }

    Label.prototype.update = function () {
      const now = Date.now();
      const target = smoothToneAt(this.s, now);
      const k = 0.085;
      this.hue = lerpHueShortest(this.hue, target.hue, k);
      this.hue = ((this.hue % 360) + 360) % 360;
      this.sat += (target.sat - this.sat) * k;
      this.light += (target.light - this.light) * k;
    };

    Label.prototype.draw = function () {
      const now = Date.now();
      if (now < this.revealAt) return;

      const raw = (now - this.revealAt) / POP_MS;
      const u = easeOutCubic(raw);
      if (u < 0.004) return;

      ctx.save();
      ctx.globalAlpha = u;
      const sc = 0.88 + 0.12 * u;
      ctx.translate(this.tx, this.ty);
      ctx.scale(sc, sc);
      ctx.translate(-this.tx, -this.ty);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = fontSpec(fontSize);
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = Math.max(0.5, fontSize * 0.03) + 'px';
      }

      const h = ((this.hue % 360) + 360) % 360;
      const fill =
        'hsl(' +
        h.toFixed(2) +
        ', ' +
        Math.min(100, Math.max(0, this.sat)).toFixed(2) +
        '%, ' +
        Math.min(100, Math.max(0, this.light)).toFixed(2) +
        '%)';

      ctx.fillStyle = SHADOW_TEXT;
      ctx.fillText(PHRASE, this.tx + 0.65, this.ty + 0.95);

      ctx.fillStyle = fill;
      ctx.fillText(PHRASE, this.tx, this.ty);
      ctx.restore();
    };

    function drawAmbientGlow() {
      const r = Math.max(W, H) * 0.48;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(120, 40, 90, 0.09)');
      g.addColorStop(0.45, 'rgba(30, 14, 40, 0.04)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    function initLayout() {
      scale = Math.min(W, H) / 40;
      const built = buildOutlineMarkers(scale, PHRASE);
      fontSize = built.fontSize;
      labels.length = 0;
      introBaseMs = Date.now();
      const markers = built.markers.slice().sort(function (a, b) {
        return a.s - b.s;
      });
      const n = markers.length;
      for (let i = 0; i < n; i++) {
        labels.push(new Label(markers[i], introBaseMs, i, n));
      }
    }

    function animate() {
      ctx.fillStyle = TRAIL;
      ctx.fillRect(0, 0, W, H);
      drawAmbientGlow();
      for (let i = 0; i < labels.length; i++) {
        labels[i].update();
        labels[i].draw();
      }
      requestAnimationFrame(animate);
    }

    function start() {
      initLayout();
      animate();
    }

    if (document.fonts && document.fonts.load) {
      document.fonts.load(fontSpec(18)).then(start).catch(start);
    } else {
      start();
    }

    window.addEventListener('resize', function () {
      syncCanvasSize();
      initLayout();
    });
  });
})();
