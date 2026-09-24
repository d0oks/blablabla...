// detector.js — Onglets Texte / Photo / Vidéo du détecteur Blablabla
(function () {
  var tabBtns = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  function getKey(name) {
    try { return localStorage.getItem('blablabla_' + name) || ''; } catch (e) { return ''; }
  }
  function setKey(name, val) {
    try { localStorage.setItem('blablabla_' + name, val); } catch (e) {}
  }

  document.querySelectorAll('[data-drawer]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.getElementById('settings-' + btn.dataset.drawer).classList.toggle('show');
    });
  });
  document.querySelectorAll('[data-save]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var kind = btn.dataset.save;
      var val = document.getElementById('key-' + kind).value.trim();
      setKey(kind, val);
      document.getElementById('settings-' + kind).classList.remove('show');
      updateFileButtons();
    });
  });

  ['photo', 'video'].forEach(function (kind) {
    var existing = getKey(kind);
    if (existing) document.getElementById('key-' + kind).value = existing;
  });

  function updateFileButtons() {
    ['photo', 'video'].forEach(function (kind) {
      var hasFile = !!window['selected_' + kind];
      document.getElementById('btn-analyze-' + kind).disabled = !hasFile;
      var note = document.getElementById('note-' + kind);
      var hasKey = !!getKey(kind);
      note.innerHTML = hasKey
        ? 'Clé connectée — <button class="link" data-drawer="' + kind + '">modifier</button>'
        : 'Mode démo — <button class="link" data-drawer="' + kind + '">connecter une clé API</button>';
      note.querySelector('button').addEventListener('click', function () {
        document.getElementById('settings-' + kind).classList.toggle('show');
      });
    });
  }
  updateFileButtons();

  ['photo', 'video'].forEach(function (kind) {
    var drop = document.getElementById('drop-' + kind);
    var input = document.getElementById('file-' + kind);
    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) {
        window['selected_' + kind] = input.files[0];
        document.getElementById('preview-' + kind).textContent =
          input.files[0].name + '  (' + Math.round(input.files[0].size / 1024) + ' Ko)';
        updateFileButtons();
      }
    });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.borderColor = 'var(--ink-soft)'; });
    drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.style.borderColor = '';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        window['selected_' + kind] = e.dataTransfer.files[0];
        document.getElementById('preview-' + kind).textContent = e.dataTransfer.files[0].name;
        updateFileButtons();
      }
    });
  });

  var AI_PHRASES = [
    "en conclusion", "il est important de noter", "n'hésitez pas", "de plus",
    "par ailleurs", "en résumé", "en outre", "il convient de", "en tant que",
    "je suis convaincu", "passionné par", "fort de mon expérience"
  ];

  function analyzeText(text) {
    var sentences = text.split(/(?<=[.!?])\s+/).filter(function (s) { return s.trim().length > 3; });
    if (sentences.length < 3) return { tooShort: true };
    var lengths = sentences.map(function (s) { return s.trim().split(/\s+/).length; });
    var mean = lengths.reduce(function (a, b) { return a + b; }, 0) / lengths.length;
    var variance = lengths.reduce(function (a, b) { return a + Math.pow(b - mean, 2); }, 0) / lengths.length;
    var stdev = Math.sqrt(variance);
    var burstiness = stdev / mean;

    var lowerText = text.toLowerCase();
    var phraseHits = AI_PHRASES.filter(function (p) { return lowerText.indexOf(p) !== -1; }).length;

    var uniformityScore = Math.max(0, Math.min(100, (0.55 - burstiness) * 220));
    var phraseScore = Math.min(100, phraseHits * 14);
    var combined = Math.round(uniformityScore * 0.65 + phraseScore * 0.35);
    combined = Math.max(2, Math.min(98, combined));

    return {
      score: combined,
      burstiness: burstiness.toFixed(2),
      avgLen: mean.toFixed(1),
      phraseHits: phraseHits,
      sentenceCount: sentences.length
    };
  }

  function verdictFor(score) {
    if (score >= 65) return { label: 'SUSPECT — À REVÉRIFIER', cls: 'flag' };
    if (score >= 35) return { label: 'INDÉTERMINÉ', cls: 'uncertain' };
    return { label: 'PROBABLEMENT AUTHENTIQUE', cls: 'verified' };
  }

  document.getElementById('btn-analyze-text').addEventListener('click', function () {
    var text = document.getElementById('text-input').value;
    var box = document.getElementById('result-text');
    if (!text.trim()) {
      box.innerHTML = '<div class="disclaimer">Colle un texte d\'au moins quelques phrases pour lancer l\'analyse.</div>';
      box.classList.add('show');
      return;
    }
    var r = analyzeText(text);
    if (r.tooShort) {
      box.innerHTML = '<div class="disclaimer">Le texte est trop court pour une analyse fiable — ajoute au moins 3 phrases.</div>';
      box.classList.add('show');
      return;
    }
    var v = verdictFor(r.score);
    box.innerHTML =
      '<div class="result-head"><span class="serif" style="font-size:1.05rem;">Résultat de l\'analyse</span>' +
      '<span class="verdict-badge ' + v.cls + '">' + v.label + '</span></div>' +
      '<div class="score-bar-wrap"><div class="score-label"><span>Probabilité de génération IA</span><span class="mono">' + r.score + ' / 100</span></div>' +
      '<div class="score-track"><div class="score-fill" style="width:' + r.score + '%; background:' + (v.cls === 'flag' ? 'var(--flag)' : v.cls === 'verified' ? 'var(--verified)' : 'var(--uncertain)') + '"></div></div></div>' +
      '<div class="signals">' +
      '<div class="signal"><div class="sk">Uniformité des phrases</div><div class="sv">' + r.burstiness + ' (plus bas = plus uniforme)</div></div>' +
      '<div class="signal"><div class="sk">Longueur moyenne</div><div class="sv">' + r.avgLen + ' mots / phrase</div></div>' +
      '<div class="signal"><div class="sk">Tournures typées LLM</div><div class="sv">' + r.phraseHits + ' détectée(s)</div></div>' +
      '<div class="signal"><div class="sk">Phrases analysées</div><div class="sv">' + r.sentenceCount + '</div></div>' +
      '</div>' +
      '<div class="disclaimer">Heuristique locale légère — indicative, pas certifiée. Pour une précision de niveau production, branche une API comme GPTZero via le backend fourni (voir README).</div>';
    box.classList.add('show');
  });

  function runDemo(kind) {
    var box = document.getElementById('result-' + kind);
    var hasKey = !!getKey(kind);
    if (!hasKey) {
      var demoScore = kind === 'photo' ? 91 : 74;
      var v = verdictFor(demoScore);
      box.innerHTML =
        '<div class="result-head"><span class="serif" style="font-size:1.05rem;">Résultat — exemple de démonstration</span>' +
        '<span class="verdict-badge ' + v.cls + '">' + v.label + '</span></div>' +
        '<div class="score-bar-wrap"><div class="score-label"><span>Probabilité de génération IA</span><span class="mono">' + demoScore + ' / 100</span></div>' +
        '<div class="score-track"><div class="score-fill" style="width:' + demoScore + '%"></div></div></div>' +
        '<div class="disclaimer">Aucune clé API connectée : ceci est un exemple illustratif, pas une analyse réelle de ton fichier. Connecte une clé (Hive, Sightengine…) via le lien ci-dessus, ou déploie le backend fourni (voir README) pour activer une analyse en direct.</div>';
      box.classList.add('show');
      return;
    }
    box.innerHTML =
      '<div class="result-head"><span class="serif" style="font-size:1.05rem;">Clé enregistrée</span>' +
      '<span class="verdict-badge uncertain">BACKEND REQUIS</span></div>' +
      '<div class="disclaimer">Ta clé est enregistrée localement. Pour l\'utiliser réellement, il faut passer par le petit serveur relais fourni dans le dossier <code class="inline">backend/</code> — jamais d\'appel direct à l\'API depuis le navigateur, la clé serait visible publiquement.</div>';
    box.classList.add('show');
  }

  document.getElementById('btn-analyze-photo').addEventListener('click', function () { runDemo('photo'); });
  document.getElementById('btn-analyze-video').addEventListener('click', function () { runDemo('video'); });
})();
