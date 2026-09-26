// tools.js — Six petits outils indépendants, 100% côté navigateur.
(function () {

  // ---- Tab switcher for this section (namespaced to avoid clashing with
  // the detector's .tab-btn / data-tab logic) ----
  var toolTabs = document.querySelectorAll('.tool-tab-btn');
  var toolPanels = document.querySelectorAll('.tab-panel2');
  var toolTitles = {
    meme: 'Générateur de mèmes', noise: 'Générateur de bruit blanc', cv: 'CV & lettre de motivation',
    url: 'Téléchargeur de lien direct', gif: 'GIF depuis une vidéo', qr: 'Générateur de QR code'
  };
  var cardTitleEl = document.getElementById('tools-card-title');
  toolTabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      toolTabs.forEach(function (b) { b.classList.remove('active'); });
      toolPanels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('tool-panel-' + btn.dataset.tab2).classList.add('active');
      if (cardTitleEl) cardTitleEl.textContent = toolTitles[btn.dataset.tab2] || '';
    });
  });

  function setStatus(id, text) { document.getElementById(id).textContent = text; }
  function showDownload(id, url, filename, label) {
    var box = document.getElementById(id);
    box.innerHTML = '<a href="' + url + '" download="' + filename + '">' + (label || ('Télécharger ' + filename)) + '</a>';
    box.classList.add('show');
  }

  // ===================================================================
  // 1. Générateur de mèmes
  // ===================================================================
  (function () {
    var drop = document.getElementById('meme-drop');
    var input = document.getElementById('meme-file');
    var canvas = document.getElementById('meme-canvas');
    var ctx = canvas.getContext('2d');
    var btn = document.getElementById('meme-btn');
    var img = new Image();
    var loaded = false;

    function drawMeme() {
      if (!loaded) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      var top = document.getElementById('meme-top').value.toUpperCase();
      var bottom = document.getElementById('meme-bottom').value.toUpperCase();
      var fontSize = Math.max(24, Math.floor(canvas.width / 12));
      ctx.font = 'bold ' + fontSize + 'px Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = fontSize / 12;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#fff';
      if (top) {
        ctx.strokeText(top, canvas.width / 2, fontSize * 1.1);
        ctx.fillText(top, canvas.width / 2, fontSize * 1.1);
      }
      if (bottom) {
        ctx.strokeText(bottom, canvas.width / 2, canvas.height - fontSize * 0.4);
        ctx.fillText(bottom, canvas.width / 2, canvas.height - fontSize * 0.4);
      }
      canvas.style.display = 'block';
    }

    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { handleFile(input.files[0]); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.borderColor = 'var(--flag)'; });
    drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.style.borderColor = '';
      handleFile(e.dataTransfer.files[0]);
    });

    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        img.onload = function () { loaded = true; btn.disabled = false; drawMeme(); };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    document.getElementById('meme-top').addEventListener('input', drawMeme);
    document.getElementById('meme-bottom').addEventListener('input', drawMeme);

    btn.addEventListener('click', function () {
      drawMeme();
      canvas.toBlob(function (blob) {
        var url = URL.createObjectURL(blob);
        setStatus('meme-status', 'Prêt');
        showDownload('meme-download', url, 'meme.png');
      }, 'image/png');
    });
  })();

  // ===================================================================
  // 2. Générateur de bruit blanc
  // ===================================================================
  (function () {
    var audioCtx = null, sourceNode = null, gainNode = null, timerHandle = null;
    var btn = document.getElementById('noise-btn');
    var playing = false;

    function makeNoiseBuffer(ctx, type) {
      var bufferSize = ctx.sampleRate * 2;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      if (type === 'white') {
        for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      } else if (type === 'pink') {
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (var i = 0; i < bufferSize; i++) {
          var white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          var out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;
          data[i] = out * 0.11;
        }
      } else { // brown
        var lastOut = 0;
        for (var i = 0; i < bufferSize; i++) {
          var white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        }
      }
      return buffer;
    }

    function stopNoise() {
      if (sourceNode) { sourceNode.stop(); sourceNode.disconnect(); sourceNode = null; }
      if (timerHandle) { clearTimeout(timerHandle); timerHandle = null; }
      playing = false;
      btn.textContent = '▶ Lancer';
      setStatus('noise-status', '');
    }

    function startNoise() {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var type = document.getElementById('noise-type').value;
      var buffer = makeNoiseBuffer(audioCtx, type);
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.loop = true;
      gainNode = audioCtx.createGain();
      gainNode.gain.value = parseInt(document.getElementById('noise-volume').value, 10) / 100;
      sourceNode.connect(gainNode).connect(audioCtx.destination);
      sourceNode.start(0);
      playing = true;
      btn.textContent = '■ Arrêter';
      var timerSec = parseInt(document.getElementById('noise-timer').value, 10);
      if (timerSec > 0) {
        setStatus('noise-status', 'Arrêt automatique dans ' + Math.round(timerSec / 60) + ' min');
        timerHandle = setTimeout(stopNoise, timerSec * 1000);
      } else {
        setStatus('noise-status', 'En cours…');
      }
    }

    document.getElementById('noise-volume').addEventListener('input', function () {
      if (gainNode) gainNode.gain.value = parseInt(this.value, 10) / 100;
    });
    document.getElementById('noise-type').addEventListener('change', function () {
      if (playing) { stopNoise(); startNoise(); }
    });

    btn.addEventListener('click', function () {
      if (playing) stopNoise(); else startNoise();
    });
  })();

  // ===================================================================
  // 3. Créateur de CV & lettre
  // ===================================================================
  (function () {
    var typeSel = document.getElementById('cv-type');
    typeSel.addEventListener('change', function () {
      var isCv = this.value === 'cv';
      document.getElementById('cv-fields-cv').style.display = isCv ? 'block' : 'none';
      document.getElementById('cv-fields-lettre').style.display = isCv ? 'none' : 'block';
    });

    function buildCvPdf() {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: 'pt', format: 'a4' });
      var margin = 50, y = 60, pageW = doc.internal.pageSize.getWidth() - margin * 2;

      var name = document.getElementById('cv-name').value || 'Nom Prénom';
      var title = document.getElementById('cv-title').value;
      var contact = document.getElementById('cv-contact').value;
      var experience = document.getElementById('cv-experience').value.split('\n').filter(Boolean);
      var education = document.getElementById('cv-education').value.split('\n').filter(Boolean);
      var skills = document.getElementById('cv-skills').value;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
      doc.text(name, margin, y); y += 26;
      if (title) { doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(90, 83, 70); doc.text(title, margin, y); y += 18; }
      if (contact) { doc.setFontSize(10); doc.text(contact, margin, y); y += 24; }
      doc.setDrawColor(216, 207, 185); doc.line(margin, y, margin + pageW, y); y += 24;

      function section(heading, lines) {
        if (!lines.length) return;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(33, 29, 23);
        doc.text(heading.toUpperCase(), margin, y); y += 16;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
        lines.forEach(function (line) {
          var wrapped = doc.splitTextToSize(line, pageW);
          if (y + wrapped.length * 14 > 780) { doc.addPage(); y = 60; }
          doc.text(wrapped, margin, y);
          y += wrapped.length * 14 + 8;
        });
        y += 6;
      }
      section('Expérience', experience);
      section('Formation', education);
      if (skills.trim()) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
        doc.text('COMPÉTENCES', margin, y); y += 16;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
        var wrapped = doc.splitTextToSize(skills, pageW);
        doc.text(wrapped, margin, y);
      }
      return doc.output('blob');
    }

    function buildLettrePdf() {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: 'pt', format: 'a4' });
      var margin = 55, y = 60, pageW = doc.internal.pageSize.getWidth() - margin * 2;

      var name = document.getElementById('lettre-name').value || 'Nom Prénom';
      var dest = document.getElementById('lettre-dest').value;
      var objet = document.getElementById('lettre-objet').value;
      var body = document.getElementById('lettre-body').value;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(name, margin, y); y += 36;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      var today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(today, doc.internal.pageSize.getWidth() - margin, y, { align: 'right' }); y += 30;
      if (dest) { doc.text(dest, margin, y); y += 30; }
      if (objet) { doc.setFont('helvetica', 'bold'); doc.text('Objet : ' + objet, margin, y); y += 30; }
      doc.setFont('helvetica', 'normal');
      var wrapped = doc.splitTextToSize(body || '', pageW);
      wrapped.forEach(function (line) {
        if (y > 780) { doc.addPage(); y = 60; }
        doc.text(line, margin, y); y += 16;
      });
      return doc.output('blob');
    }

    document.getElementById('cv-btn').addEventListener('click', function () {
      setStatus('cv-status', 'Génération…');
      try {
        var isCv = typeSel.value === 'cv';
        var blob = isCv ? buildCvPdf() : buildLettrePdf();
        var url = URL.createObjectURL(blob);
        setStatus('cv-status', 'Terminé');
        showDownload('cv-download', url, isCv ? 'cv.pdf' : 'lettre-de-motivation.pdf');
      } catch (err) {
        setStatus('cv-status', 'Erreur pendant la génération.');
        console.error(err);
      }
    });
  })();

  // ===================================================================
  // 4. Téléchargeur de lien direct
  // ===================================================================
  (function () {
    document.getElementById('url-btn').addEventListener('click', function () {
      var url = document.getElementById('url-input').value.trim();
      if (!url) return;
      setStatus('url-status', 'Téléchargement…');
      document.getElementById('url-download').classList.remove('show');
      fetch(url).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.blob();
      }).then(function (blob) {
        var objUrl = URL.createObjectURL(blob);
        var filename = url.split('/').pop().split('?')[0] || 'fichier';
        setStatus('url-status', 'Terminé — ' + Math.round(blob.size / 1024) + ' Ko');
        showDownload('url-download', objUrl, filename);
      }).catch(function (err) {
        setStatus('url-status', 'Échec — ce serveur bloque probablement le téléchargement multi-domaine (CORS).');
        console.error(err);
      });
    });
  })();

  // ===================================================================
  // 5. GIF depuis une vidéo
  // ===================================================================
  (function () {
    var drop = document.getElementById('gif-drop');
    var input = document.getElementById('gif-file');
    var video = document.getElementById('gif-preview');
    var btn = document.getElementById('gif-btn');
    var currentFile = null;
    var gifWorkerBlobUrl = null;

    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { handleFile(input.files[0]); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.borderColor = 'var(--flag)'; });
    drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.style.borderColor = '';
      handleFile(e.dataTransfer.files[0]);
    });

    function handleFile(file) {
      if (!file) return;
      currentFile = file;
      video.src = URL.createObjectURL(file);
      video.style.display = 'block';
      video.onloadedmetadata = function () {
        var maxDur = Math.min(6, video.duration);
        document.getElementById('gif-duration').max = maxDur;
        if (parseFloat(document.getElementById('gif-duration').value) > maxDur) {
          document.getElementById('gif-duration').value = maxDur;
        }
        btn.disabled = false;
      };
    }

    function getGifWorkerUrl() {
      if (gifWorkerBlobUrl) return Promise.resolve(gifWorkerBlobUrl);
      return fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
        .then(function (r) { return r.text(); })
        .then(function (text) {
          gifWorkerBlobUrl = URL.createObjectURL(new Blob([text], { type: 'application/javascript' }));
          return gifWorkerBlobUrl;
        });
    }

    function seekTo(t) {
      return new Promise(function (resolve) {
        video.currentTime = t;
        video.onseeked = function () { resolve(); };
      });
    }

    btn.addEventListener('click', function () {
      if (!currentFile) return;
      var start = parseFloat(document.getElementById('gif-start').value) || 0;
      var duration = parseFloat(document.getElementById('gif-duration').value) || 3;
      var fps = parseInt(document.getElementById('gif-fps').value, 10);
      var frameCount = Math.round(duration * fps);
      btn.disabled = true;
      setStatus('gif-status', 'Préparation…');

      getGifWorkerUrl().then(function (workerUrl) {
        var canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth, 480);
        canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
        var ctx = canvas.getContext('2d');

        var gif = new GIF({ workers: 2, quality: 10, workerScript: workerUrl, width: canvas.width, height: canvas.height });

        gif.on('progress', function (p) { setStatus('gif-status', 'Encodage… ' + Math.round(p * 100) + '%'); });
        gif.on('finished', function (blob) {
          var url = URL.createObjectURL(blob);
          setStatus('gif-status', 'Terminé');
          showDownload('gif-download', url, currentFile.name.replace(/\.[^.]+$/, '') + '.gif');
          btn.disabled = false;
        });

        var i = 0;
        function nextFrame() {
          if (i >= frameCount) { setStatus('gif-status', 'Rendu du GIF…'); gif.render(); return; }
          var t = start + i / fps;
          seekTo(t).then(function () {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            gif.addFrame(ctx, { copy: true, delay: 1000 / fps });
            i++;
            setStatus('gif-status', 'Capture de l\'image ' + i + ' / ' + frameCount + '…');
            nextFrame();
          });
        }
        nextFrame();
      }).catch(function (err) {
        setStatus('gif-status', 'Erreur — impossible de charger l\'encodeur GIF (nécessite d\'être en ligne).');
        console.error(err);
        btn.disabled = false;
      });
    });
  })();

  // ===================================================================
  // 6. Générateur de QR code
  // ===================================================================
  (function () {
    var renderBox = document.getElementById('qr-render');
    document.getElementById('qr-btn').addEventListener('click', function () {
      var text = document.getElementById('qr-input').value.trim();
      if (!text) { setStatus('qr-status', 'Entre un texte ou un lien.'); return; }
      var size = parseInt(document.getElementById('qr-size').value, 10);
      renderBox.innerHTML = '';
      renderBox.style.display = 'block';
      new QRCode(renderBox, {
        text: text, width: size, height: size,
        colorDark: '#211D17', colorLight: '#F5F1E7'
      });
      setStatus('qr-status', 'Terminé');
      setTimeout(function () {
        var img = renderBox.querySelector('img') || renderBox.querySelector('canvas');
        var dataUrl = img.tagName === 'CANVAS' ? img.toDataURL('image/png') : img.src;
        showDownload('qr-download', dataUrl, 'qrcode.png');
      }, 60);
    });
  })();

})();
