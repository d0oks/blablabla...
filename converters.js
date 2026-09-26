// converters.js — Boîte à outils unifiée : choisis un format source, un
// format cible, dépose un fichier. 100% côté navigateur, rien n'est envoyé.
(function () {

  function bytesToSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }
  function dirname(path) {
    var i = path.lastIndexOf('/');
    return i === -1 ? '' : path.substring(0, i);
  }
  function resolveZipPath(baseDir, relHref) {
    var base = 'https://z/' + (baseDir ? baseDir + '/' : '');
    var url = new URL(relHref.split('#')[0], base);
    return decodeURIComponent(url.pathname.replace(/^\//, ''));
  }
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function readFile(file, as) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = reject;
      if (as === 'text') reader.readAsText(file); else reader.readAsArrayBuffer(file);
    });
  }
  function readImageAsDataUrl(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () { resolve({ dataUrl: e.target.result, w: img.naturalWidth, h: img.naturalHeight }); };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  // Rend un bloc HTML en PDF paginé, via html2canvas + jsPDF (utilisé par Word→PDF et ePub→PDF)
  function htmlToPdfBlob(innerHtml) {
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed; left:-9999px; top:0; width:700px; padding:34px; background:#fff; font-family:Georgia,serif; font-size:14px; line-height:1.65; color:#111;';
    holder.innerHTML = innerHtml;
    holder.querySelectorAll('img').forEach(function (img) { img.style.maxWidth = '100%'; });
    document.body.appendChild(holder);
    return html2canvas(holder, { scale: 2, useCORS: true }).then(function (canvas) {
      document.body.removeChild(holder);
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: 'pt', format: 'a4' });
      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();
      var imgW = pageW;
      var imgH = (canvas.height * imgW) / canvas.width;
      var heightLeft = imgH, position = 0;
      var imgData = canvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      return doc.output('blob');
    });
  }

  // ===================================================================
  // Fonctions de conversion — chacune prend le(s) fichier(s) + options,
  // renvoie une Promise<{blob, filename}>
  // ===================================================================
  var converters = {

    'image→image': function (files, opts, onProgress) {
      var file = files[0];
      var format = opts.format || 'image/jpeg';
      var quality = (opts.quality || 85) / 100;
      onProgress('Conversion…');
      return readImageAsDataUrl(file).then(function (imgData) {
        var canvas = document.createElement('canvas');
        canvas.width = imgData.w; canvas.height = imgData.h;
        var ctx = canvas.getContext('2d');
        if (format === 'image/jpeg') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        var img = new Image(); img.src = imgData.dataUrl;
        return new Promise(function (resolve) {
          img.onload = function () {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(function (blob) {
              var ext = format === 'image/png' ? 'png' : (format === 'image/webp' ? 'webp' : 'jpg');
              resolve({ blob: blob, filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext });
            }, format, format === 'image/png' ? undefined : quality);
          };
        });
      });
    },

    'image→pdf': function (files, opts, onProgress) {
      onProgress('Assemblage de ' + files.length + ' image(s)…');
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      return Promise.all(files.map(readImageAsDataUrl)).then(function (images) {
        images.forEach(function (imgData, i) {
          if (i > 0) doc.addPage();
          var pageW = doc.internal.pageSize.getWidth();
          var pageH = doc.internal.pageSize.getHeight();
          var ratio = Math.min(pageW / imgData.w, pageH / imgData.h);
          var w = imgData.w * ratio, h = imgData.h * ratio;
          var x = (pageW - w) / 2, y = (pageH - h) / 2;
          var format = imgData.dataUrl.indexOf('image/png') !== -1 ? 'PNG' : 'JPEG';
          doc.addImage(imgData.dataUrl, format, x, y, w, h);
        });
        return { blob: doc.output('blob'), filename: 'images.pdf' };
      });
    },

    'pdf→image': function (files, opts, onProgress) {
      var file = files[0];
      onProgress('Lecture du PDF…');
      return readFile(file).then(function (buf) {
        return window.pdfjsLib.getDocument(new Uint8Array(buf)).promise.then(function (pdf) {
          var zip = new JSZip();
          var pagePromises = [];
          for (var p = 1; p <= pdf.numPages; p++) {
            pagePromises.push(pdf.getPage(p).then(function (page) {
              var viewport = page.getViewport({ scale: 2 });
              var canvas = document.createElement('canvas');
              canvas.width = viewport.width; canvas.height = viewport.height;
              var ctx = canvas.getContext('2d');
              return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
                return new Promise(function (resolve) {
                  canvas.toBlob(function (blob) {
                    zip.file('page-' + String(page.pageNumber).padStart(2, '0') + '.png', blob);
                    resolve();
                  }, 'image/png');
                });
              });
            }));
            onProgress('Rendu de la page ' + p + ' / ' + pdf.numPages + '…');
          }
          return Promise.all(pagePromises).then(function () {
            return zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
              return { blob: zipBlob, filename: file.name.replace(/\.pdf$/i, '') + '-pages.zip' };
            });
          });
        });
      });
    },

    'pdf→word': function (files, opts, onProgress) {
      var file = files[0];
      onProgress('Extraction du texte…');
      return readFile(file).then(function (buf) {
        return window.pdfjsLib.getDocument(new Uint8Array(buf)).promise.then(function (pdf) {
          var textPromises = [];
          for (var p = 1; p <= pdf.numPages; p++) {
            textPromises.push(pdf.getPage(p).then(function (page) {
              return page.getTextContent().then(function (content) {
                return content.items.map(function (it) { return it.str; }).join(' ');
              });
            }));
          }
          return Promise.all(textPromises).then(function (pages) {
            var paragraphsHtml = pages.map(function (pageText, i) {
              return '<p style="margin:0 0 12pt 0;">' + escapeHtml(pageText) + '</p>' +
                (i < pages.length - 1 ? '<br clear="all" style="page-break-before:always" />' : '');
            }).join('');
            var htmlDoc =
              '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
              '<head><meta charset="utf-8"><title>Document</title></head>' +
              '<body style="font-family:Calibri,Arial,sans-serif; font-size:11pt;">' + paragraphsHtml + '</body></html>';
            var blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword' });
            return { blob: blob, filename: file.name.replace(/\.pdf$/i, '') + '.doc' };
          });
        });
      });
    },

    'word→pdf': function (files, opts, onProgress) {
      var file = files[0];
      onProgress('Lecture du document…');
      return readFile(file).then(function (buf) {
        return window.mammoth.convertToHtml({ arrayBuffer: buf }).then(function (result) {
          onProgress('Mise en page…');
          return htmlToPdfBlob(result.value).then(function (blob) {
            return { blob: blob, filename: file.name.replace(/\.docx?$/i, '') + '.pdf' };
          });
        });
      });
    },

    'epub→pdf': function (files, opts, onProgress) {
      var file = files[0];
      onProgress('Ouverture de l\'ePub…');
      return readFile(file).then(function (buf) {
        return JSZip.loadAsync(buf).then(function (zip) {
          return zip.file('META-INF/container.xml').async('string').then(function (containerXml) {
            var containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
            var opfPath = containerDoc.querySelector('rootfile').getAttribute('full-path');
            var opfDir = dirname(opfPath);
            return zip.file(opfPath).async('string').then(function (opfXml) {
              var opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
              var manifest = {};
              opfDoc.querySelectorAll('manifest item').forEach(function (item) {
                manifest[item.getAttribute('id')] = { href: item.getAttribute('href') };
              });
              var spineHrefs = [];
              opfDoc.querySelectorAll('spine itemref').forEach(function (ref) {
                var idref = ref.getAttribute('idref');
                if (manifest[idref]) spineHrefs.push(resolveZipPath(opfDir, manifest[idref].href));
              });
              onProgress('Lecture de ' + spineHrefs.length + ' chapitre(s)…');
              var chapterPromises = spineHrefs.map(function (chapPath) {
                var chapDir = dirname(chapPath);
                return zip.file(chapPath).async('string').then(function (html) {
                  var doc = new DOMParser().parseFromString(html, 'text/html');
                  var imgs = Array.from(doc.querySelectorAll('img, image'));
                  var imgPromises = imgs.map(function (img) {
                    var srcAttr = img.tagName.toLowerCase() === 'image' ? 'href' : 'src';
                    var src = img.getAttribute(srcAttr) || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                    if (!src || src.indexOf('data:') === 0) return Promise.resolve();
                    var imgPath = resolveZipPath(chapDir, src);
                    var zf = zip.file(imgPath);
                    if (!zf) return Promise.resolve();
                    return zf.async('base64').then(function (b64) {
                      var ext = imgPath.split('.').pop().toLowerCase();
                      var mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : 'image/jpeg');
                      img.setAttribute(srcAttr, 'data:' + mime + ';base64,' + b64);
                    }).catch(function () {});
                  });
                  return Promise.all(imgPromises).then(function () { return doc.body ? doc.body.innerHTML : ''; });
                }).catch(function () { return ''; });
              });
              return Promise.all(chapterPromises).then(function (chapters) {
                var innerHtml = chapters.map(function (html, i) {
                  return '<div style="' + (i > 0 ? 'page-break-before:always;' : '') + '">' + html + '</div>';
                }).join('');
                onProgress('Mise en page…');
                return htmlToPdfBlob(innerHtml).then(function (blob) {
                  return { blob: blob, filename: file.name.replace(/\.epub$/i, '') + '.pdf' };
                });
              });
            });
          });
        });
      });
    }
  };

  // ===================================================================
  // UI unifiée : "je pars de" / "et je veux" + une seule zone de dépôt
  // ===================================================================
  var TARGETS_BY_SOURCE = {
    image: [{ v: 'image', t: 'Image (autre format)' }, { v: 'pdf', t: 'PDF' }],
    pdf: [{ v: 'image', t: 'Image (PNG, une par page)' }, { v: 'word', t: 'Word (.doc)' }],
    word: [{ v: 'pdf', t: 'PDF' }],
    epub: [{ v: 'pdf', t: 'PDF' }]
  };
  var ACCEPT_BY_SOURCE = { image: 'image/*', pdf: 'application/pdf', word: '.docx', epub: '.epub' };

  var sourceSel = document.getElementById('conv-source');
  var targetSel = document.getElementById('conv-target');
  var extraOptions = document.getElementById('conv-extra-options');
  var drop = document.getElementById('conv-drop-unified');
  var input = document.getElementById('conv-file-unified');
  var fileList = document.getElementById('conv-filelist-unified');
  var btn = document.getElementById('conv-btn-unified');
  var statusEl = document.getElementById('conv-status-unified');
  var downloadBox = document.getElementById('conv-download-unified');

  var selectedFiles = [];

  function populateTargets() {
    var opts = TARGETS_BY_SOURCE[sourceSel.value];
    targetSel.innerHTML = opts.map(function (o) { return '<option value="' + o.v + '">' + o.t + '</option>'; }).join('');
    updateExtraOptions();
    updateInputAttrs();
  }

  function updateExtraOptions() {
    var isImgToImg = sourceSel.value === 'image' && targetSel.value === 'image';
    if (isImgToImg) {
      extraOptions.innerHTML =
        '<div class="conv-options">' +
        '<label>Format : <select id="conv-out-format"><option value="image/jpeg" selected>JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>' +
        '<span class="conv-options" id="conv-quality-wrap"><label for="conv-quality">Qualité</label><input type="range" id="conv-quality" min="30" max="100" value="85"></span>' +
        '</div>';
      document.getElementById('conv-out-format').addEventListener('change', function () {
        document.getElementById('conv-quality-wrap').style.display = this.value === 'image/png' ? 'none' : 'flex';
      });
    } else {
      extraOptions.innerHTML = '';
    }
  }

  function updateInputAttrs() {
    input.setAttribute('accept', ACCEPT_BY_SOURCE[sourceSel.value]);
    input.multiple = (sourceSel.value === 'image' && targetSel.value === 'pdf');
    selectedFiles = [];
    renderFileList();
  }

  function renderFileList() {
    fileList.innerHTML = selectedFiles.map(function (f) {
      return '<div>' + f.name + '  ·  ' + bytesToSize(f.size) + '</div>';
    }).join('');
    btn.disabled = selectedFiles.length === 0;
  }

  sourceSel.addEventListener('change', populateTargets);
  targetSel.addEventListener('change', function () { updateExtraOptions(); updateInputAttrs(); });

  drop.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () {
    selectedFiles = input.multiple ? Array.from(input.files) : [input.files[0]];
    renderFileList();
  });
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.borderColor = 'var(--flag)'; });
  drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    drop.style.borderColor = '';
    var dropped = Array.from(e.dataTransfer.files);
    selectedFiles = input.multiple ? dropped : [dropped[0]];
    renderFileList();
  });

  btn.addEventListener('click', function () {
    if (!selectedFiles.length) return;
    var key = sourceSel.value + '→' + targetSel.value;
    var convertFn = converters[key];
    if (!convertFn) {
      statusEl.textContent = 'Cette combinaison n\'est pas encore prise en charge.';
      return;
    }
    var opts = {};
    if (key === 'image→image') {
      opts.format = document.getElementById('conv-out-format').value;
      opts.quality = parseInt(document.getElementById('conv-quality').value, 10);
    }
    btn.disabled = true;
    downloadBox.classList.remove('show');
    convertFn(selectedFiles, opts, function (msg) { statusEl.textContent = msg; })
      .then(function (result) {
        var url = URL.createObjectURL(result.blob);
        statusEl.textContent = 'Terminé';
        downloadBox.innerHTML = '<a href="' + url + '" download="' + result.filename + '">Télécharger ' + result.filename + '</a>';
        downloadBox.classList.add('show');
        btn.disabled = false;
      })
      .catch(function (err) {
        statusEl.textContent = 'Erreur pendant la conversion — vérifie le fichier.';
        console.error(err);
        btn.disabled = false;
      });
  });

  // Initialisation
  populateTargets();

})();
