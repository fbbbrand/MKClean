/*
 * Administration du carrousel — MK Clean
 *
 * Le site est statique (GitHub Pages) : il n'y a pas de serveur pour gérer des comptes.
 * Cette page modifie donc directement le dépôt GitHub via son API :
 *   - data/carousel.json        : la liste des photos (ordre, titre, légende)
 *   - images/carousel/*.jpg     : les photos ajoutées depuis cette page
 * Chaque « Publier » crée un seul commit ; GitHub Pages remet le site à jour en 1 à 2 minutes.
 *
 * Connexion : un jeton GitHub (limité à ce dépôt) est chiffré en AES-GCM avec une clé dérivée
 * du mot de passe (PBKDF2) et stocké dans ce navigateur. Sans le mot de passe, il est illisible.
 */
(function () {
  'use strict';

  var CONFIG = {
    owner: 'fbbbrand',
    repo: 'MKClean',
    dataPath: 'data/carousel.json',
    uploadDir: 'images/carousel/',
    maxSide: 1800,        // les photos sont redimensionnées avant envoi
    jpegQuality: 0.82,
    storageKey: 'mkclean-admin-v1'
  };
  var API = 'https://api.github.com';

  // ── État ─────────────────────────────────────
  var session = null;   // { token, branch }
  var slides = [];      // { src, title, caption, alt, isNew?, blob?, preview? }
  var originalSrcs = [];
  var dirty = false;

  var $ = function (id) { return document.getElementById(id); };

  // ── Vues ─────────────────────────────────────
  function show(view) {
    ['login', 'setup', 'editor'].forEach(function (v) { $('view-' + v).hidden = v !== view; });
    $('logout').hidden = view !== 'editor';
  }

  function setError(id, msg) {
    var n = $(id);
    n.textContent = msg || '';
    n.hidden = !msg;
  }

  function setStatus(msg, isError) {
    var n = $('status');
    n.textContent = msg || '';
    n.hidden = !msg;
    n.classList.toggle('is-error', !!isError);
  }

  // ── Stockage chiffré du jeton ────────────────
  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }

  function deriveKey(password, salt) {
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function saveVault(token, branch, password) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(password, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(token));
    }).then(function (ct) {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        salt: b64(salt), iv: b64(iv), ct: b64(ct), branch: branch
      }));
    });
  }

  function readVault() {
    try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)); } catch (e) { return null; }
  }

  function openVault(password) {
    var v = readVault();
    if (!v) return Promise.reject(new Error('Aucun accès configuré.'));
    return deriveKey(password, unb64(v.salt)).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.ct));
    }).then(function (pt) {
      return { token: dec.decode(pt), branch: v.branch || 'main' };
    }, function () {
      throw new Error('Mot de passe incorrect.');
    });
  }

  // ── API GitHub ───────────────────────────────
  function gh(method, path, body, token) {
    return fetch(API + path, {
      method: method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + (token || session.token),
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      if (r.ok) return r.status === 204 ? null : r.json();
      return r.json().catch(function () { return {}; }).then(function (j) {
        var err = new Error(j.message || ('Erreur GitHub ' + r.status));
        err.status = r.status;
        throw err;
      });
    });
  }

  function repoPath(p) { return '/repos/' + CONFIG.owner + '/' + CONFIG.repo + (p || ''); }

  function checkAccess(token, branch) {
    return gh('GET', repoPath(), null, token).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        throw new Error('Ce jeton peut lire le dépôt mais pas le modifier. Donnez-lui la permission « Contents : Read and write ».');
      }
      return gh('GET', repoPath('/branches/' + encodeURIComponent(branch)), null, token);
    }).catch(function (e) {
      if (e.status === 401) throw new Error('Jeton refusé par GitHub (expiré ou mal copié).');
      if (e.status === 404) throw new Error('Dépôt ou branche introuvable avec ce jeton. Vérifiez qu\'il donne accès à ' + CONFIG.owner + '/' + CONFIG.repo + ' et que la branche « ' + branch + ' » existe.');
      throw e;
    });
  }

  function decodeBase64Utf8(s) {
    return dec.decode(unb64(s.replace(/\n/g, '')));
  }

  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + CONFIG.owner + '/' + CONFIG.repo + '/' +
      encodeURIComponent(session.branch) + '/' + path;
  }

  // ── Chargement ───────────────────────────────
  function load() {
    setStatus('Chargement…');
    return gh('GET', repoPath('/contents/' + CONFIG.dataPath + '?ref=' + encodeURIComponent(session.branch)))
      .then(function (file) {
        var data = JSON.parse(decodeBase64Utf8(file.content));
        return Array.isArray(data.slides) ? data.slides : [];
      }, function (e) {
        if (e.status === 404) return [];
        throw e;
      })
      .then(function (list) {
        slides = list.map(function (s) {
          return { src: s.src, title: s.title || '', caption: s.caption || '', alt: s.alt || '' };
        });
        originalSrcs = slides.map(function (s) { return s.src; });
        setDirty(false);
        render();
        setStatus('');
        $('editor-info').textContent = 'Branche « ' + session.branch + ' » · ' + slides.length + ' photo(s)';
      })
      .catch(function (e) { setStatus('Impossible de charger le carrousel : ' + e.message, true); });
  }

  // ── Rendu de la liste ────────────────────────
  function render() {
    var list = $('slides');
    var tpl = $('slide-tpl');
    list.innerHTML = '';

    slides.forEach(function (s, i) {
      var li = tpl.content.firstElementChild.cloneNode(true);
      var img = li.querySelector('.admin-thumb');
      var title = li.querySelector('.f-title');
      var caption = li.querySelector('.f-caption');
      var uid = 's' + i;

      li.querySelector('.admin-badge').hidden = !s.isNew;
      if (s.preview) {
        img.src = s.preview;
      } else {
        // Photo déjà publiée : on la lit sur GitHub (à jour même si le site n'est pas encore reconstruit)
        img.src = rawUrl(s.src);
        img.onerror = function () { img.onerror = null; img.src = s.src; };
      }
      img.alt = s.title;

      title.id = uid + '-t'; title.previousElementSibling.htmlFor = title.id;
      caption.id = uid + '-c'; caption.previousElementSibling.htmlFor = caption.id;
      title.value = s.title;
      caption.value = s.caption;
      title.addEventListener('input', function () { s.title = title.value; setDirty(true); });
      caption.addEventListener('input', function () { s.caption = caption.value; setDirty(true); });

      var up = li.querySelector('.a-up');
      var down = li.querySelector('.a-down');
      up.disabled = i === 0;
      down.disabled = i === slides.length - 1;
      up.addEventListener('click', function () { move(i, -1); });
      down.addEventListener('click', function () { move(i, 1); });
      li.querySelector('.a-del').addEventListener('click', function () {
        if (!confirm('Retirer cette photo du carrousel ?')) return;
        var removed = slides.splice(i, 1)[0];
        if (removed.preview) URL.revokeObjectURL(removed.preview);
        setDirty(true);
        render();
      });

      list.appendChild(li);
    });
  }

  function move(i, delta) {
    var j = i + delta;
    if (j < 0 || j >= slides.length) return;
    var tmp = slides[i]; slides[i] = slides[j]; slides[j] = tmp;
    setDirty(true);
    render();
  }

  function setDirty(v) {
    dirty = v;
    $('publish').disabled = !v;
  }

  // ── Ajout de photos ──────────────────────────
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('« ' + file.name + ' » n\'a pas pu être lue. Essayez en JPEG ou PNG.')); };
      img.src = url;
    });
  }

  function resize(file) {
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      var scale = Math.min(1, CONFIG.maxSide / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Conversion impossible.')); }, 'image/jpeg', CONFIG.jpegQuality);
      });
    });
  }

  function slugify(name) {
    return name.replace(/\.[^.]+$/, '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'photo';
  }

  function prettyTitle(name) {
    var t = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    // Les noms d'appareil photo (IMG_1234, PXL_2026…) ne font pas de bons titres
    if (/^(img|dsc|pxl|photo|image|screenshot)?\s*\d/i.test(t)) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function addFiles(files) {
    files = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name); });
    if (!files.length) return;
    setStatus('Préparation de ' + files.length + ' photo(s)…');

    var today = new Date().toISOString().slice(0, 10);
    var errors = [];
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () {
        return resize(file).then(function (blob) {
          var rand = Math.random().toString(36).slice(2, 6);
          slides.unshift({
            src: CONFIG.uploadDir + today + '-' + slugify(file.name) + '-' + rand + '.jpg',
            title: prettyTitle(file.name),
            caption: '',
            alt: '',
            isNew: true,
            blob: blob,
            preview: URL.createObjectURL(blob)
          });
        }, function (e) { errors.push(e.message); });
      });
    });

    chain.then(function () {
      setDirty(true);
      render();
      if (errors.length) setStatus(errors.join(' '), true);
      else setStatus('Photo(s) ajoutée(s) en haut de la liste. Donnez-leur un titre, puis cliquez sur « Publier ».');
    });
  }

  // ── Publication (un seul commit) ─────────────
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function publish() {
    var missing = slides.filter(function (s) { return !s.title.trim(); });
    if (missing.length) {
      setStatus('Chaque photo a besoin d\'un titre (' + missing.length + ' manquant).', true);
      return;
    }

    var btn = $('publish');
    btn.disabled = true;
    setStatus('Publication en cours…');

    var branch = encodeURIComponent(session.branch);
    var headSha, baseTree;
    var newOnes = slides.filter(function (s) { return s.isNew; });

    // Photos ajoutées depuis l'admin qui ne sont plus utilisées : on les supprime du dépôt.
    // Les anciennes photos du site (hors images/carousel/) ne sont jamais supprimées.
    var keep = slides.map(function (s) { return s.src; });
    var toDelete = originalSrcs.filter(function (src) {
      return src.indexOf(CONFIG.uploadDir) === 0 && keep.indexOf(src) === -1;
    });

    gh('GET', repoPath('/git/ref/heads/' + branch))
      .then(function (ref) {
        headSha = ref.object.sha;
        return gh('GET', repoPath('/git/commits/' + headSha));
      })
      .then(function (commit) {
        baseTree = commit.tree.sha;
        // Envoi des images une par une
        var chain = Promise.resolve();
        newOnes.forEach(function (s, i) {
          chain = chain.then(function () {
            setStatus('Envoi de la photo ' + (i + 1) + ' sur ' + newOnes.length + '…');
            return blobToBase64(s.blob).then(function (content) {
              return gh('POST', repoPath('/git/blobs'), { content: content, encoding: 'base64' });
            }).then(function (res) { s.blobSha = res.sha; });
          });
        });
        return chain;
      })
      .then(function () {
        var json = JSON.stringify({
          slides: slides.map(function (s) {
            var o = { src: s.src, title: s.title.trim(), caption: s.caption.trim() };
            if (s.alt) o.alt = s.alt;
            return o;
          })
        }, null, 2) + '\n';

        var tree = [{ path: CONFIG.dataPath, mode: '100644', type: 'blob', content: json }];
        newOnes.forEach(function (s) { tree.push({ path: s.src, mode: '100644', type: 'blob', sha: s.blobSha }); });
        toDelete.forEach(function (p) { tree.push({ path: p, mode: '100644', type: 'blob', sha: null }); });

        return gh('POST', repoPath('/git/trees'), { base_tree: baseTree, tree: tree });
      })
      .then(function (tree) {
        var parts = [];
        if (newOnes.length) parts.push(newOnes.length + ' ajout(s)');
        if (toDelete.length) parts.push(toDelete.length + ' suppression(s)');
        var msg = 'Carrousel : ' + (parts.length ? parts.join(', ') : 'mise à jour des textes / de l\'ordre') + ' (admin)';
        return gh('POST', repoPath('/git/commits'), { message: msg, tree: tree.sha, parents: [headSha] });
      })
      .then(function (commit) {
        return gh('PATCH', repoPath('/git/refs/heads/' + branch), { sha: commit.sha });
      })
      .then(function () {
        newOnes.forEach(function (s) {
          s.isNew = false;
          delete s.blob; delete s.blobSha;
          // on garde l'aperçu local tant que la page est ouverte
        });
        originalSrcs = slides.map(function (s) { return s.src; });
        setDirty(false);
        render();
        $('editor-info').textContent = 'Branche « ' + session.branch + ' » · ' + slides.length + ' photo(s)';
        setStatus('Publié. Le site sera à jour d\'ici une à deux minutes.');
      })
      .catch(function (e) {
        btn.disabled = false;
        var hint = e.status === 422 ? ' Quelqu\'un a peut-être modifié le site en même temps : rechargez la page et recommencez.' : '';
        if (e.status === 401) hint = ' Le jeton a peut-être expiré : reconfigurez l\'accès.';
        setStatus('La publication a échoué : ' + e.message + '.' + hint, true);
      });
  }

  // ── Évènements ───────────────────────────────
  $('setup-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var token = $('setup-token').value.trim();
    var branch = $('setup-branch').value.trim() || 'main';
    var p1 = $('setup-password').value;
    var p2 = $('setup-password2').value;
    if (p1 !== p2) { setError('setup-error', 'Les deux mots de passe ne correspondent pas.'); return; }
    setError('setup-error', 'Vérification du jeton…');
    checkAccess(token, branch)
      .then(function () { return saveVault(token, branch, p1); })
      .then(function () {
        session = { token: token, branch: branch };
        $('setup-form').reset();
        setError('setup-error', '');
        show('editor');
        return load();
      })
      .catch(function (err) { setError('setup-error', err.message); });
  });

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    setError('login-error', '');
    openVault($('login-password').value)
      .then(function (s) {
        session = s;
        $('login-password').value = '';
        show('editor');
        return load();
      })
      .catch(function (err) { setError('login-error', err.message); });
  });

  $('reset-device').addEventListener('click', function () {
    if (!confirm('Effacer l\'accès enregistré sur cet appareil ? Il faudra saisir à nouveau un jeton GitHub.')) return;
    localStorage.removeItem(CONFIG.storageKey);
    show('setup');
  });

  $('logout').addEventListener('click', function () {
    if (dirty && !confirm('Des modifications ne sont pas publiées. Se déconnecter quand même ?')) return;
    session = null;
    slides = [];
    setDirty(false);
    $('slides').innerHTML = '';
    setStatus('');
    show('login');
  });

  $('file-input').addEventListener('change', function (e) {
    addFiles(e.target.files);
    e.target.value = '';
  });

  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
  });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });

  $('publish').addEventListener('click', publish);

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── Démarrage ────────────────────────────────
  if (!window.crypto || !crypto.subtle) {
    document.querySelector('.admin-main').innerHTML =
      '<p class="admin-card">Cette page doit être ouverte en HTTPS (ou sur localhost) dans un navigateur récent.</p>';
    return;
  }
  show(readVault() ? 'login' : 'setup');
})();
