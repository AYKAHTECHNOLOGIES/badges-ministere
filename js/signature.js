/* Détourage automatique d'une photo de signature.
   Portage en JavaScript de spDetourer() (prytanee/includes/signature_prof.php) :
   fond estimé par blocs (corrige ombres et éclairage inégal), seuil d'Otsu borné,
   transparence progressive, suppression des poussières et des bords de feuille,
   couleur d'encre assombrie, recadrage avec marge. Tout se fait sur le téléphone. */
(function () {
  function lissage(a, b, x) {
    if (b <= a) return x >= b ? 1 : 0;
    var t = (x - a) / (b - a);
    if (t <= 0) return 0; if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  function chargerImage(src) {
    return new Promise(function (ok, ko) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { ko(new Error('Photo illisible.')); };
      im.src = src;
    });
  }

  /** opts: {finesse 1..9, force 80..160, rot 0|90|180|270}. Retourne {png: dataURL} ou {erreur}. */
  async function detourer(src, opts) {
    opts = opts || {};
    var finesse = Math.max(1, Math.min(9, opts.finesse || 5));
    var force = Math.max(80, Math.min(160, opts.force || 115));
    var rot = opts.rot || 0;
    var im = await chargerImage(src);
    var maxw = 1100;
    var k = Math.min(1, maxw / Math.max(im.naturalWidth, im.naturalHeight));
    var w0 = Math.max(1, Math.round(im.naturalWidth * k)), h0 = Math.max(1, Math.round(im.naturalHeight * k));
    var swap = rot === 90 || rot === 270;
    var W = swap ? h0 : w0, H = swap ? w0 : h0;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
    cx.translate(W / 2, H / 2); cx.rotate(rot * Math.PI / 180);
    cx.drawImage(im, -w0 / 2, -h0 / 2, w0, h0);
    var px = cx.getImageData(0, 0, W, H).data;
    var N = W * H, i, x, y;
    var L = new Float32Array(N);
    for (i = 0; i < N; i++) L[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

    // 2) fond par blocs : 85e centile, maximum 3x3, agrandi en douceur
    var bs = Math.max(20, Math.round(Math.min(W, H) / 22));
    var bw = Math.ceil(W / bs), bh = Math.ceil(H / bs);
    var bg = new Float32Array(bw * bh);
    for (var by = 0; by < bh; by++) for (var bx = 0; bx < bw; bx++) {
      var vals = [];
      var x1 = Math.min(W, (bx + 1) * bs), y1 = Math.min(H, (by + 1) * bs);
      for (y = by * bs; y < y1; y += 2) for (x = bx * bs; x < x1; x += 2) vals.push(L[y * W + x]);
      vals.sort(function (a, b) { return a - b; });
      bg[by * bw + bx] = vals.length ? vals[Math.floor((vals.length - 1) * 0.85)] : 255;
    }
    var sm = document.createElement('canvas'); sm.width = bw; sm.height = bh;
    var sx = sm.getContext('2d'); var sd = sx.createImageData(bw, bh);
    for (by = 0; by < bh; by++) for (bx = 0; bx < bw; bx++) {
      var m = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var yy = by + dy, xx = bx + dx;
        if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) m = Math.max(m, bg[yy * bw + xx]);
      }
      var j = (by * bw + bx) * 4, v = Math.round(Math.max(0, Math.min(255, m)));
      sd.data[j] = sd.data[j + 1] = sd.data[j + 2] = v; sd.data[j + 3] = 255;
    }
    sx.putImageData(sd, 0, 0);
    var big = document.createElement('canvas'); big.width = W; big.height = H;
    var gx = big.getContext('2d', { willReadFrequently: true });
    gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high';
    gx.drawImage(sm, 0, 0, W, H);
    var F = gx.getImageData(0, 0, W, H).data;

    // 3) noirceur normalisée
    var D = new Float32Array(N), hist = new Float64Array(256), papier = 0;
    for (i = 0; i < N; i++) {
      var f = Math.max(70, F[i * 4]);
      var d = 1 - L[i] / f; if (d < 0) d = 0; if (d > 1) d = 1;
      D[i] = d; hist[Math.round(d * 255)]++; papier += f;
    }
    papier /= N;
    if (papier < 80) return { erreur: "Photo trop sombre. Reprenez-la près d'une fenêtre, en pleine lumière, sur une feuille blanche." };

    // 4) seuil d'Otsu borné
    var sumAll = 0; for (i = 0; i < 256; i++) sumAll += i * hist[i];
    var wB = 0, sumB = 0, best = 0, tOtsu = 40;
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; var wF = N - wB; if (!wF) break;
      sumB += i * hist[i]; var mB = sumB / wB, mF = (sumAll - sumB) / wF;
      var vv = wB * wF * (mB - mF) * (mB - mF); if (vv > best) { best = vv; tOtsu = i; }
    }
    var t = Math.max(0.09, Math.min(0.32, (tOtsu / 255) * 0.65));
    t *= (1.5 - 0.125 * (finesse - 1));
    var lo = t * 0.7, hi = Math.min(0.9, t * 1.7);

    // 5) transparence
    var A = new Float32Array(N);
    for (i = 0; i < N; i++) A[i] = D[i] > lo ? lissage(lo, hi, D[i]) : 0;

    // 6) composants connexes : poussière, bords de feuille, ombres
    var comp = new Int32Array(N), aires = [0], touche = [false], bbox = [null], nc = 0;
    var pile = new Int32Array(N);
    for (var s = 0; s < N; s++) {
      if (A[s] <= 0.35 || comp[s]) continue;
      nc++; var top = 0; pile[top++] = s; comp[s] = nc;
      var aire = 0, bord = false, bx0 = W, by0 = H, bx1 = 0, by1 = 0;
      while (top) {
        var p = pile[--top]; aire++;
        x = p % W; y = (p - x) / W;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) bord = true;
        for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          xx = x + dx; yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          var q = yy * W + xx;
          if (A[q] > 0.35 && !comp[q]) { comp[q] = nc; pile[top++] = q; }
        }
      }
      aires.push(aire); touche.push(bord); bbox.push([bx0, by0, bx1, by1]);
    }
    if (nc === 0) return { erreur: 'Aucune signature détectée. Signez au stylo foncé sur une feuille blanche et rapprochez-vous.' };
    var bordier = [false], c;
    for (c = 1; c <= nc; c++) {
      var b = bbox[c], bw_ = b[2] - b[0] + 1, bh_ = b[3] - b[1] + 1;
      var traverse = (bw_ > 0.85 * W || bh_ > 0.85 * H) && (aires[c] / Math.max(1, bw_ * bh_)) < 0.25;
      bordier.push(touche[c] || traverse);
    }
    var principal = 0, maxAire = 0;
    for (c = 1; c <= nc; c++) if (!bordier[c] && aires[c] > maxAire) { maxAire = aires[c]; principal = c; }
    if (!principal) return { erreur: 'Aucune signature détectée au centre de la photo. Cadrez la signature au milieu de la feuille, sans les bords.' };
    var garde = new Uint8Array(nc + 1); garde[principal] = 1;
    var pb = bbox[principal];
    for (c = 1; c <= nc; c++) {
      if (c === principal) continue;
      var a = aires[c];
      if (a < Math.max(14, maxAire * 0.0012)) continue;
      if (bordier[c]) continue;
      if (a < maxAire * 0.2) {
        var ex = (a < maxAire * 0.01 ? 0.06 : 0.35) * Math.max(pb[2] - pb[0] + 1, pb[3] - pb[1] + 1);
        var ccx = (bbox[c][0] + bbox[c][2]) / 2, ccy = (bbox[c][1] + bbox[c][3]) / 2;
        if (ccx < pb[0] - ex || ccx > pb[2] + ex || ccy < pb[1] - ex || ccy > pb[3] + ex) continue;
      }
      garde[c] = 1;
    }
    var proche = new Uint8Array(N);
    for (i = 0; i < N; i++) {
      if (!comp[i] || !garde[comp[i]]) continue;
      x = i % W; y = (i - x) / W;
      for (dy = -3; dy <= 3; dy++) { yy = y + dy; if (yy < 0 || yy >= H) continue;
        for (dx = -3; dx <= 3; dx++) { xx = x + dx; if (xx >= 0 && xx < W) proche[yy * W + xx] = 1; } }
    }
    for (i = 0; i < N; i++) if (A[i] > 0 && !proche[i]) A[i] = 0;

    // 7) couleur de l'encre
    var sr = 0, sg = 0, sb = 0, cn = 0;
    for (i = 0; i < N && cn <= 20000; i++) if (comp[i] && garde[comp[i]] && A[i] >= 0.9) { sr += px[i * 4]; sg += px[i * 4 + 1]; sb += px[i * 4 + 2]; cn++; }
    if (cn < 10) for (i = 0; i < N && cn <= 20000; i++) if (comp[i] && garde[comp[i]]) { sr += px[i * 4]; sg += px[i * 4 + 1]; sb += px[i * 4 + 2]; cn++; }
    var ir = cn ? sr / cn : 20, ig = cn ? sg / cn : 20, ib = cn ? sb / cn : 40;
    var lum = 0.299 * ir + 0.587 * ig + 0.114 * ib, fct = lum > 55 ? 55 / lum : 1;
    ir = Math.round(ir * fct); ig = Math.round(ig * fct); ib = Math.round(ib * fct);
    var boost = force / 100, minx = W, miny = H, maxx = 0, maxy = 0, encre = 0;
    for (i = 0; i < N; i++) if (A[i] > 0) {
      A[i] = Math.min(1, A[i] * boost);
      if (A[i] > 0.2) { x = i % W; y = (i - x) / W; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; encre++; }
    }
    if (encre < 120) return { erreur: 'Signature trop faible ou introuvable. Signez plus appuyé, au stylo foncé, et rapprochez-vous.' };
    if (encre / N > 0.30) return { erreur: "Le fond n'est pas assez uniforme (feuille ombrée ou quadrillée). Reprenez la photo sur une feuille blanche, bien éclairée." };

    // 8) recadrage + marge, 700 px de large au plus
    var mw = maxx - minx + 1, mh = maxy - miny + 1, marge = Math.max(6, Math.round(Math.max(mw, mh) * 0.05));
    var X0 = Math.max(0, minx - marge), Y0 = Math.max(0, miny - marge), X1 = Math.min(W - 1, maxx + marge), Y1 = Math.min(H - 1, maxy + marge);
    var cw = X1 - X0 + 1, ch = Y1 - Y0 + 1;
    var out = document.createElement('canvas'); out.width = cw; out.height = ch;
    var ox = out.getContext('2d'); var od = ox.createImageData(cw, ch);
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      var o = (y * cw + x) * 4, al = A[(Y0 + y) * W + X0 + x];
      od.data[o] = ir; od.data[o + 1] = ig; od.data[o + 2] = ib; od.data[o + 3] = Math.round(al * 255);
    }
    ox.putImageData(od, 0, 0);
    if (cw > 700) {
      var n2 = document.createElement('canvas'); n2.width = 700; n2.height = Math.max(1, Math.round(ch * 700 / cw));
      var nx = n2.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(out, 0, 0, n2.width, n2.height); out = n2;
    }
    return { png: out.toDataURL('image/png'), info: { encre: encre, largeur: cw, hauteur: ch, papier: Math.round(papier) } };
  }

  window.Signature = { detourer: detourer };
})();
