(function () {
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- stockage (IndexedDB, sur le téléphone) ---------- */
  var dbP = new Promise(function (ok, ko) {
    var r = indexedDB.open('badges_ministere', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('employes', { keyPath: 'id' }); r.result.createObjectStore('reglages'); };
    r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); };
  });
  function tx(store, mode, fn) {
    return dbP.then(function (db) {
      return new Promise(function (ok, ko) {
        var t = db.transaction(store, mode), s = t.objectStore(store), res = fn(s);
        t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : res); };
        t.onerror = function () { ko(t.error); };
      });
    });
  }
  var DB = {
    tous: function () { return tx('employes', 'readonly', function (s) { return s.getAll(); }); },
    mettre: function (e) { return tx('employes', 'readwrite', function (s) { s.put(e); }); },
    suppr: function (id) { return tx('employes', 'readwrite', function (s) { s.delete(id); }); },
    vider: function () { return tx('employes', 'readwrite', function (s) { s.clear(); }); },
    reglages: function () { return tx('reglages', 'readonly', function (s) { return s.get('r'); }); },
    sauverReglages: function (r) { return tx('reglages', 'readwrite', function (s) { s.put(r, 'r'); }); }
  };

  var R = { ministere: "MINISTÈRE DE L'ÉNERGIE", ville: 'NIAMEY', prefixe: 'ME-' + new Date().getFullYear() + '-', validite: 2, photo: true };
  var employes = [], coches = {}, courant = null;

  function auj() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function plusAns(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + Number(n || 1)); return d.toISOString().slice(0, 10); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function params() { return { ministere: R.ministere, ville: R.ville, photo: R.photo }; }

  function prochainNumero() {
    var max = 0;
    employes.forEach(function (e) {
      if ((e.numero || '').indexOf(R.prefixe) === 0) { var n = parseInt(e.numero.slice(R.prefixe.length), 10); if (n > max) max = n; }
    });
    return R.prefixe + String(max + 1).padStart(4, '0');
  }

  /* ---------- liste ---------- */
  function trier() { employes.sort(function (a, b) { return (a.numero || '').localeCompare(b.numero || ''); }); }
  function afficherListe() {
    var q = $('recherche').value.trim().toLowerCase();
    var l = employes.filter(function (e) { return !q || [e.nom, e.prenom, e.numero, e.fonction].join(' ').toLowerCase().indexOf(q) >= 0; });
    $('nb').textContent = employes.length ? '(' + employes.length + ')' : '';
    if (!employes.length) { $('liste').innerHTML = '<p class="vide-liste">Aucun employé pour l\'instant. Appuyez sur « + Nouvel employé ».</p>'; majCoches(); return; }
    $('liste').innerHTML = l.map(function (e) {
      return '<div class="emp"><input type="checkbox" data-c="' + e.id + '"' + (coches[e.id] ? ' checked' : '') + ' aria-label="Inclure dans l\'export">' +
        (e.photo ? '<img src="' + e.photo + '" alt="">' : '<div class="vide"></div>') +
        '<div class="info"><b>' + esc((e.nom || '').toUpperCase() + ' ' + (e.prenom || '')) + '</b><span>' + esc(e.numero) + ' · ' + esc(e.fonction) + '</span>' +
        '<div class="chips"><span class="chip' + (e.photo ? ' ok' : '') + '">' + (e.photo ? '✓ ' : '') + 'photo</span><span class="chip' + (e.signature ? ' ok' : '') + '">' + (e.signature ? '✓ ' : '') + 'signature</span></div></div>' +
        '<button data-e="' + e.id + '">Modifier</button></div>';
    }).join('') || '<p class="vide-liste">Aucun résultat.</p>';
    majCoches();
  }
  function majCoches() {
    var n = employes.filter(function (e) { return coches[e.id]; }).length;
    $('nbCoches').textContent = n + ' coché' + (n > 1 ? 's' : '') + ' sur ' + employes.length;
  }
  $('liste').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-e]'); if (b) ouvrir(employes.find(function (e) { return e.id === b.dataset.e; }));
  });
  $('liste').addEventListener('change', function (ev) {
    var c = ev.target.closest('input[data-c]'); if (c) { coches[c.dataset.c] = c.checked; majCoches(); }
  });
  $('recherche').addEventListener('input', afficherListe);
  $('toutCocher').onclick = function () { employes.forEach(function (e) { coches[e.id] = true; }); afficherListe(); };
  $('rienCocher').onclick = function () { coches = {}; afficherListe(); };

  /* ---------- fiche ---------- */
  function vue(fiche) {
    $('vueListe').classList.toggle('cache', fiche); $('vueFiche').classList.toggle('cache', !fiche); $('barreFiche').classList.toggle('cache', !fiche);
    window.scrollTo(0, 0);
  }
  function ouvrir(e) {
    var neuf = !e;
    courant = e ? JSON.parse(JSON.stringify(e)) : { id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), numero: prochainNumero(), delivrance: auj(), validite: plusAns(auj(), R.validite) };
    courant._neuf = neuf;
    $('titreFiche').textContent = neuf ? 'Nouvel employé' : 'Modifier la fiche';
    ['Nom', 'Prenom', 'Fonction', 'Numero', 'Delivrance', 'Validite', 'Badge'].forEach(function (k) { $('f' + k).value = courant[k.toLowerCase()] || ''; });
    $('btnSuppr').parentNode.classList.toggle('cache', neuf);
    photoSrc = null; $('cropBox').classList.add('cache');
    sigSrc = courant.signatureSource || null; sigRot = courant.sigRot || 0;
    $('sFinesse').value = courant.sigFinesse || 5; $('sForce').value = courant.sigForce || 115;
    afficherSignature(); $('sigMsg').textContent = '';
    vue(true); apercu();
  }
  function lireForm() {
    ['Nom', 'Prenom', 'Fonction', 'Numero', 'Delivrance', 'Validite', 'Badge'].forEach(function (k) { courant[k.toLowerCase()] = $('f' + k).value.trim(); });
  }
  ['fNom', 'fPrenom', 'fFonction', 'fNumero', 'fDelivrance', 'fValidite'].forEach(function (id) { $(id).addEventListener('input', function () { lireForm(); apercu(); }); });
  $('fDelivrance').addEventListener('change', function () { if ($('fDelivrance').value) { $('fValidite').value = plusAns($('fDelivrance').value, R.validite); lireForm(); apercu(); } });

  $('btnNouveau').onclick = function () { ouvrir(null); };
  $('btnAnnuler').onclick = function () { vue(false); };
  $('btnEnreg').onclick = async function () {
    lireForm();
    if (!courant.nom || !courant.prenom) { alerte('Indiquez au moins le nom et le prénom.'); return; }
    if (!courant.numero) { alerte('Indiquez le numéro de carte.'); return; }
    var double = employes.find(function (e) { return e.numero === courant.numero && e.id !== courant.id; });
    if (double) { alerte('Ce numéro de carte est déjà utilisé par ' + double.nom + ' ' + double.prenom + '.'); return; }
    if (photoSrc) courant.photo = exporterRecadrage();
    var e = Object.assign({}, courant); delete e._neuf;
    await DB.mettre(e);
    var i = employes.findIndex(function (x) { return x.id === e.id; });
    if (i >= 0) employes[i] = e; else { employes.push(e); coches[e.id] = true; }
    trier(); afficherListe(); vue(false);
  };
  $('btnSuppr').onclick = function () {
    $('dlgTxt').textContent = 'Supprimer ' + (courant.nom || '') + ' ' + (courant.prenom || '') + ' ? Cette action est définitive.';
    $('dlg').showModal();
  };
  $('dlgNon').onclick = function () { $('dlg').close(); };
  $('dlgOui').onclick = async function () {
    $('dlg').close(); await DB.suppr(courant.id);
    employes = employes.filter(function (e) { return e.id !== courant.id; }); delete coches[courant.id];
    afficherListe(); vue(false);
  };
  function alerte(t) { showToast(t); }
  function showToast(t) {
    var d = document.createElement('div'); d.textContent = t; d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:90px;background:#15171a;color:#fff;padding:14px 16px;border-radius:12px;z-index:20;font-size:15px;text-align:center';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3500);
  }

  /* ---------- photo : recadrage 3:4 ---------- */
  var photoSrc = null, photoIm = null, zoom = 1, offX = 0, offY = 0;
  function lireFichier(f) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(f); }); }
  async function chargerPhoto(f) {
    if (!f) return;
    photoSrc = await lireFichier(f);
    photoIm = new Image(); photoIm.onload = function () { zoom = 1; offX = 0; offY = 0; $('zoom').value = 1; $('cropBox').classList.remove('cache'); dessinerCrop(); };
    photoIm.src = photoSrc;
  }
  $('fPhoto').onchange = function () { chargerPhoto(this.files[0]); this.value = ''; };
  $('fPhotoGal').onchange = function () { chargerPhoto(this.files[0]); this.value = ''; };
  function geom(cw, ch) {
    var k = Math.max(cw / photoIm.width, ch / photoIm.height) * zoom;
    var w = photoIm.width * k, h = photoIm.height * k;
    offX = Math.min((w - cw) / 2, Math.max(-(w - cw) / 2, offX)); offY = Math.min((h - ch) / 2, Math.max(-(h - ch) / 2, offY));
    return { x: (cw - w) / 2 + offX, y: (ch - h) / 2 + offY, w: w, h: h };
  }
  function dessinerCrop() {
    var c = $('cropCv'), x = c.getContext('2d'), g = geom(c.width, c.height);
    x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height); x.drawImage(photoIm, g.x, g.y, g.w, g.h);
    courant.photo = exporterRecadrage(); apercu();
  }
  function exporterRecadrage() {
    var c = document.createElement('canvas'); c.width = 600; c.height = 800;
    var cv = $('cropCv'), g = geom(cv.width, cv.height), s = 600 / cv.width;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 800); x.drawImage(photoIm, g.x * s, g.y * s, g.w * s, g.h * s);
    return c.toDataURL('image/jpeg', 0.88);
  }
  $('zoom').oninput = function () { zoom = Number(this.value); dessinerCrop(); };
  (function () {
    var el = $('crop'), dep = null;
    el.addEventListener('pointerdown', function (e) { dep = { x: e.clientX, y: e.clientY, ox: offX, oy: offY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', function (e) {
      if (!dep || !photoIm) return; var k = $('cropCv').width / el.clientWidth;
      offX = dep.ox + (e.clientX - dep.x) * k; offY = dep.oy + (e.clientY - dep.y) * k; dessinerCrop();
    });
    el.addEventListener('pointerup', function () { dep = null; });
  })();

  /* ---------- signature ---------- */
  var sigSrc = null, sigRot = 0, sigTimer = null;
  async function chargerSig(f) {
    if (!f) return;
    sigSrc = await reduire(await lireFichier(f), 1600); sigRot = 0; traiterSig();
  }
  function reduire(src, max) {
    return new Promise(function (ok) {
      var im = new Image(); im.onload = function () {
        var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.9));
      }; im.src = src;
    });
  }
  async function traiterSig() {
    if (!sigSrc) return;
    $('sigMsg').className = 'msg'; $('sigMsg').textContent = 'Traitement de la signature…';
    await new Promise(function (r) { setTimeout(r, 30); });
    var res = await Signature.detourer(sigSrc, { finesse: Number($('sFinesse').value), force: Number($('sForce').value), rot: sigRot });
    if (res.erreur) { $('sigMsg').className = 'msg err'; $('sigMsg').textContent = res.erreur; return; }
    courant.signature = res.png; courant.signatureSource = sigSrc; courant.sigRot = sigRot;
    courant.sigFinesse = Number($('sFinesse').value); courant.sigForce = Number($('sForce').value);
    $('sigMsg').className = 'msg okm'; $('sigMsg').textContent = 'Signature détourée. Ajustez les réglages si des traits manquent ou si des taches restent.';
    afficherSignature(); apercu();
  }
  function afficherSignature() {
    $('sigApercu').innerHTML = courant && courant.signature ? '<img src="' + courant.signature + '" alt="Signature détourée">' : '<span class="astuce">Faites signer l\'employé au stylo noir sur une feuille blanche, puis photographiez la signature.</span>';
    $('sigReglages').classList.toggle('cache', !sigSrc);
  }
  $('fSig').onchange = function () { chargerSig(this.files[0]); this.value = ''; };
  $('fSigGal').onchange = function () { chargerSig(this.files[0]); this.value = ''; };
  ['sFinesse', 'sForce'].forEach(function (id) { $(id).oninput = function () { clearTimeout(sigTimer); sigTimer = setTimeout(traiterSig, 250); }; });
  $('sRot').onclick = function () { sigRot = (sigRot + 90) % 360; traiterSig(); };

  /* ---------- aperçu ---------- */
  var apTimer = null;
  function apercu() {
    clearTimeout(apTimer);
    apTimer = setTimeout(async function () {
      var p = params(), a = await Badge.recto(courant, p, 2), b = await Badge.verso(courant, p, 2);
      a.setAttribute('aria-label', 'Recto du badge'); b.setAttribute('aria-label', 'Verso du badge');
      $('apercu').replaceChildren(a, b);
    }, 120);
  }

  /* ---------- exports ---------- */
  function choisis() {
    var l = employes.filter(function (e) { return coches[e.id]; });
    if (!l.length) { $('msgExport').className = 'msg err'; $('msgExport').textContent = 'Cochez au moins un employé dans la liste.'; return null; }
    return l;
  }
  function nomFichier(base, ext) { return base + '_' + auj() + '.' + ext; }
  async function livrer(blob, nom) {
    var f = new File([blob], nom, { type: blob.type });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      $('msgExport').innerHTML = 'Fichier « ' + esc(nom) + ' » téléchargé. <button class="lien" id="btnPartager">Partager (WhatsApp, e-mail…)</button>';
      $('btnPartager').onclick = function () { navigator.share({ files: [f], title: nom }).catch(function () {}); };
    } else $('msgExport').textContent = 'Fichier « ' + nom + ' » téléchargé.';
    $('msgExport').className = 'msg okm';
  }
  async function enCours(btn, fn) {
    var t = btn.textContent; btn.disabled = true; btn.textContent = 'Préparation…';
    try { await fn(); } catch (e) { $('msgExport').className = 'msg err'; $('msgExport').textContent = 'Erreur : ' + e.message; }
    btn.disabled = false; btn.textContent = t;
  }
  $('expCartes').onclick = function () {
    var l = choisis(); if (!l) return;
    enCours(this, async function () {
      var doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54], compress: true }), p = params();
      for (var i = 0; i < l.length; i++) {
        if (i) doc.addPage([85.6, 54], 'landscape');
        doc.addImage((await Badge.recto(l[i], p)).toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 85.6, 54);
        doc.addPage([85.6, 54], 'landscape');
        doc.addImage((await Badge.verso(l[i], p)).toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 85.6, 54);
      }
      await livrer(doc.output('blob'), nomFichier('badges_impression', 'pdf'));
    });
  };
  $('expPlanche').onclick = function () {
    var l = choisis(); if (!l) return;
    enCours(this, async function () {
      var doc = new jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true }), p = params();
      var W = 85.6, H = 54, gx = 12, x0 = (210 - 2 * W - gx) / 2, y0 = 14, gy = 2.5, n = 0;
      for (var i = 0; i < l.length; i++) {
        if (n === 5) { doc.addPage(); n = 0; }
        var y = y0 + n * (H + gy);
        doc.addImage((await Badge.recto(l[i], p, 2)).toDataURL('image/jpeg', 0.9), 'JPEG', x0, y, W, H);
        doc.addImage((await Badge.verso(l[i], p, 2)).toDataURL('image/jpeg', 0.9), 'JPEG', x0 + W + gx, y, W, H);
        doc.setDrawColor(180); doc.setLineWidth(0.1); doc.rect(x0, y, W, H); doc.rect(x0 + W + gx, y, W, H);
        n++;
      }
      await livrer(doc.output('blob'), nomFichier('planche_controle', 'pdf'));
    });
  };
  $('expCsv').onclick = function () {
    var l = choisis(); if (!l) return;
    var lignes = [['N° carte', 'Nom', 'Prénom', 'Fonction', 'Délivrée le', 'Valable jusqu\'au', 'N° badge (lecteur)']].concat(l.map(function (e) {
      return [e.numero, (e.nom || '').toUpperCase(), e.prenom, e.fonction, Badge.dateFr(e.delivrance), Badge.dateFr(e.validite), e.badge || ''];
    }));
    var csv = '﻿' + lignes.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n');
    livrer(new Blob([csv], { type: 'text/csv;charset=utf-8' }), nomFichier('liste_badges', 'csv'));
  };

  /* ---------- sauvegarde ---------- */
  $('btnSauver').onclick = function () {
    var data = JSON.stringify({ app: 'badges_ministere', version: 1, date: new Date().toISOString(), reglages: R, employes: employes });
    livrer(new Blob([data], { type: 'application/json' }), nomFichier('sauvegarde_badges', 'json'));
  };
  $('fRestaurer').onchange = async function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    try {
      var d = JSON.parse(await f.text());
      if (d.app !== 'badges_ministere' || !Array.isArray(d.employes)) throw new Error('Ce fichier n\'est pas une sauvegarde de cette application.');
      var ajout = 0;
      for (var i = 0; i < d.employes.length; i++) { await DB.mettre(d.employes[i]); ajout++; }
      if (d.reglages) { R = Object.assign(R, d.reglages); await DB.sauverReglages(R); afficherReglages(); }
      employes = await DB.tous(); trier(); afficherListe();
      $('msgExport').className = 'msg okm'; $('msgExport').textContent = ajout + ' fiche(s) restaurée(s).';
    } catch (e) { $('msgExport').className = 'msg err'; $('msgExport').textContent = e.message; }
  };

  /* ---------- réglages ---------- */
  function afficherReglages() {
    $('rMinistere').value = R.ministere; $('rVille').value = R.ville; $('rPrefixe').value = R.prefixe; $('rValid').value = R.validite; $('rPhoto').checked = R.photo !== false;
    $('sousTitre').textContent = R.ministere;
  }
  ['rMinistere', 'rVille', 'rPrefixe', 'rValid', 'rPhoto'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      R.ministere = $('rMinistere').value.trim() || R.ministere; R.ville = $('rVille').value.trim() || R.ville;
      R.prefixe = $('rPrefixe').value.trim(); R.validite = Math.max(1, Number($('rValid').value) || 2); R.photo = $('rPhoto').checked;
      DB.sauverReglages(R); afficherReglages();
    });
  });

  /* ---------- démarrage ---------- */
  (async function () {
    try { var r = await DB.reglages(); if (r) R = Object.assign(R, r); } catch (e) {}
    afficherReglages();
    employes = await DB.tous(); trier();
    employes.forEach(function (e) { coches[e.id] = true; });
    afficherListe();
  })();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
