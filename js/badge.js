/* Dessin des badges (format carte CR80, 85,6 x 54 mm) sur un canvas à 300 dpi.
   Coordonnées en « unités maquette » : 324 x 204, comme le modèle validé. */
(function () {
  var BW = 324, BH = 204;
  var VERT = '#0b6b2c', ORANGE = '#e05206', VERT_DRAPEAU = '#0db02b', GRIS = '#5b6068', ENCRE = '#15171a';
  var POLICE = 'Arial, Helvetica, sans-serif';
  var cache = {};

  function img(src) {
    if (!src) return Promise.resolve(null);
    if (cache[src]) return cache[src];
    cache[src] = new Promise(function (ok) {
      var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src;
    });
    return cache[src];
  }

  function police(cx, taille, gras, italique) {
    cx.font = (italique ? 'italic ' : '') + (gras ? 'bold ' : '') + taille + 'px ' + POLICE;
  }
  function espace(cx, em, taille) { if ('letterSpacing' in cx) cx.letterSpacing = (em * taille) + 'px'; }

  /** texte réduit pour tenir dans maxW */
  function texte(cx, t, x, y, taille, maxW, opts) {
    opts = opts || {};
    var s = taille;
    police(cx, s, opts.gras, opts.italique); espace(cx, opts.esp || 0, s);
    while (s > 4 && cx.measureText(t).width > maxW) { s -= 0.25; police(cx, s, opts.gras, opts.italique); espace(cx, opts.esp || 0, s); }
    cx.fillStyle = opts.couleur || ENCRE; cx.textAlign = opts.align || 'left'; cx.textBaseline = 'middle';
    cx.fillText(t, x, y);
    espace(cx, 0, s);
  }

  function lignes(cx, t, x, y, maxW, taille, inter) {
    police(cx, taille, false, false); cx.fillStyle = ENCRE; cx.textAlign = 'left'; cx.textBaseline = 'top';
    var mots = t.split(' '), l = '', n = 0;
    for (var i = 0; i < mots.length; i++) {
      var essai = l ? l + ' ' + mots[i] : mots[i];
      if (cx.measureText(essai).width > maxW && l) { cx.fillText(l, x, y + n * inter); n++; l = mots[i]; } else l = essai;
    }
    if (l) { cx.fillText(l, x, y + n * inter); n++; }
    return y + n * inter;
  }

  function contenir(cx, im, x, y, w, h) {
    var k = Math.min(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k;
    cx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function couvrir(cx, im, x, y, w, h) {
    var k = Math.max(w / im.width, h / im.height), sw = w / k, sh = h / k;
    cx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h);
  }

  function drapeau(cx, y) {
    cx.fillStyle = ORANGE; cx.fillRect(0, y, BW / 3, 4);
    cx.fillStyle = '#fff'; cx.fillRect(BW / 3, y, BW / 3, 4);
    cx.fillStyle = VERT_DRAPEAU; cx.fillRect(2 * BW / 3, y, BW / 3 + 1, 4);
    cx.fillStyle = ORANGE; cx.beginPath(); cx.arc(BW / 2, y + 2, 2, 0, Math.PI * 2); cx.fill();
  }

  function qrCanvas(txt) {
    var q = qrcode(0, 'M'); q.addData(unescape(encodeURIComponent(txt))); q.make();
    var n = q.getModuleCount(), m = 1, s = 8, c = document.createElement('canvas');
    c.width = c.height = (n + 2 * m) * s;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + m) * s, (r + m) * s, s, s);
    return c;
  }

  function valeur(e, c) { return c.std ? (e[c.id] || '') : ((e.extra || {})[c.id] || ''); }
  function champs(p) { return p.champs || [{ id: 'fonction', libelle: 'Fonction', std: true }, { id: 'numero', libelle: 'Carte N°', std: true }]; }
  function texteQR(e, p) {
    var l = [p.ministere + ' - REPUBLIQUE DU NIGER', 'Carte N: ' + (e.numero || ''), ((e.nom || '').toUpperCase() + ' ' + (e.prenom || '')).trim()];
    champs(p).forEach(function (c) { if (c.id !== 'numero' && valeur(e, c)) l.push(c.libelle + ': ' + valeur(e, c)); });
    l.push('Valable jusqu\'au: ' + dateFr(e.validite));
    return l.join('\n');
  }

  function dateFr(d) { if (!d) return ''; var p = String(d).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }

  async function recto(e, p, echelle) {
    var k = echelle || (1011 / BW);
    var c = document.createElement('canvas'); c.width = Math.round(BW * k); c.height = Math.round(BH * k);
    var cx = c.getContext('2d'); cx.scale(k, k);
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, BW, BH);
    cx.save(); cx.globalAlpha = 0.07; cx.fillStyle = ORANGE; cx.beginPath(); cx.arc(287, 145, 75, 0, Math.PI * 2); cx.fill(); cx.restore();
    var arm = await img('img/armoiries.png');
    if (arm) { contenir(cx, arm, 9, 7, 56, 40); contenir(cx, arm, BW - 9 - 56, 7, 56, 40); }
    texte(cx, 'RÉPUBLIQUE DU NIGER', BW / 2, 17, 10, 180, { gras: true, align: 'center', esp: 0.06 });
    texte(cx, 'Fraternité – Travail – Progrès', BW / 2, 27, 6, 180, { italique: true, align: 'center', couleur: '#4a4f57' });
    texte(cx, p.ministere, BW / 2, 39, 8.5, 184, { gras: true, align: 'center', couleur: VERT, esp: 0.04 });
    drapeau(cx, 54);
    var xg = 12;
    if (p.photo !== false) {
      cx.fillStyle = '#f1f2f4'; cx.fillRect(12, 67, 62, 78);
      var ph = await img(e.photo);
      if (ph) couvrir(cx, ph, 12, 67, 62, 78);
      else texte(cx, 'PHOTO', 43, 106, 7, 60, { align: 'center', couleur: GRIS });
      cx.strokeStyle = '#b9bdc3'; cx.lineWidth = 0.6; cx.strokeRect(12, 67, 62, 78);
      xg = 84;
    }
    var maxW = 262 - xg - 6;
    var rangs = [['NOM', (e.nom || '').toUpperCase(), 10, ENCRE], ['PRÉNOM', e.prenom || '', 9.5, ENCRE]];
    champs(p).forEach(function (c) { rangs.push([c.libelle.toUpperCase(), valeur(e, c), c.id === 'numero' ? 9.5 : 8.5, c.id === 'numero' ? VERT : ENCRE]); });
    var pas = Math.min(19, 114 / rangs.length), k = pas / 19, y0 = 70 + (114 - pas * rangs.length) / 2 + 4 * k;
    rangs.forEach(function (ch, i) {
      var y = y0 + i * pas;
      texte(cx, ch[0], xg, y, Math.max(4.5, 6 * k), maxW, { gras: true, couleur: GRIS, esp: 0.08 });
      texte(cx, ch[1], xg, y + 9 * k, Math.max(5.5, ch[2] * k), maxW, { gras: true, couleur: ch[3] });
    });
    cx.imageSmoothingEnabled = false;
    cx.drawImage(qrCanvas(texteQR(e, p)), 262, 122, 50, 50);
    cx.imageSmoothingEnabled = true;
    texte(cx, 'Vérification', 287, 179, 6, 50, { align: 'center', couleur: GRIS });
    cx.fillStyle = VERT; cx.fillRect(0, 189, BW, 15);
    texte(cx, "CARTE PROFESSIONNELLE · BADGE D'ACCÈS", BW / 2, 196.5, 6.5, 300, { gras: true, align: 'center', couleur: '#fff', esp: 0.12 });
    return c;
  }

  async function verso(e, p, echelle) {
    var k = echelle || (1011 / BW);
    var c = document.createElement('canvas'); c.width = Math.round(BW * k); c.height = Math.round(BH * k);
    var cx = c.getContext('2d'); cx.scale(k, k);
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, BW, BH);
    cx.fillStyle = VERT; cx.fillRect(0, 0, BW, 15);
    texte(cx, p.ministere + ' · ' + p.ville, BW / 2, 7.5, 6.5, 300, { gras: true, align: 'center', couleur: '#fff', esp: 0.12 });
    var y = lignes(cx, 'Cette carte est strictement personnelle. Elle doit être portée de façon visible dans les locaux du Ministère et présentée à toute réquisition.', 14, 22, 296, 7, 9.5);
    y = lignes(cx, "En cas de perte, prévenir immédiatement le service du personnel. Toute personne qui trouve cette carte est priée de la remettre au Ministère.", 14, y + 4, 296, 7, 9.5);
    var y0 = Math.max(y + 6, 92);
    texte(cx, 'DÉLIVRÉE LE', 14, y0, 6, 70, { gras: true, couleur: GRIS, esp: 0.08 });
    texte(cx, dateFr(e.delivrance), 14, y0 + 9, 8, 70, { gras: true });
    texte(cx, "VALABLE JUSQU'AU", 90, y0, 6, 80, { gras: true, couleur: GRIS, esp: 0.08 });
    texte(cx, dateFr(e.validite), 90, y0 + 9, 8, 80, { gras: true });
    texte(cx, 'SIGNATURE DU TITULAIRE', 14, y0 + 22, 6, 150, { gras: true, couleur: GRIS, esp: 0.08 });
    var sig = await img(e.signature);
    var sy = y0 + 27, sh = 192 - sy;
    if (sig) contenir(cx, sig, 14, sy, 150, sh);
    cx.strokeStyle = '#8a8f96'; cx.lineWidth = 0.6;
    cx.beginPath(); cx.moveTo(14, 192); cx.lineTo(164, 192); cx.stroke();
    cx.strokeRect(180, y0 - 4, 130, 196 - y0);
    var A = p.autorite || {};
    texte(cx, A.titre || "Signature et cachet de l'autorité", 245, y0 + 3, A.titre ? 6.5 : 6, 124, { align: 'center', gras: !!A.titre, couleur: A.titre ? ENCRE : GRIS });
    var bas = A.nom ? 184 : 191, haut = y0 + 9;
    var cachet = await img(A.cachet), sa = await img(A.signature);
    if (cachet) { cx.save(); cx.globalAlpha = 0.85; contenir(cx, cachet, 196, haut, 98, bas - haut); cx.restore(); }
    if (sa) contenir(cx, sa, 186, haut + 4, 118, bas - haut - 6);
    if (A.nom) texte(cx, A.nom, 245, 188, 6.5, 124, { align: 'center', gras: true });
    drapeau(cx, 200);
    return c;
  }

  window.Badge = { recto: recto, verso: verso, BW: BW, BH: BH, dateFr: dateFr };
})();
