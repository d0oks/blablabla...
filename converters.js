// converters.js — Convertisseurs image / PDF / Word, 100% côté navigateur.
// Rien n'est envoyé à un serveur : tout se passe dans l'onglet du visiteur.
(function () {

  // ---- Converter tabs (single tool visible at a time, saves scroll on mobile) ----
  var convTabs = document.querySelectorAll('.conv-tab');
  var convPanels = document.querySelectorAll('.conv-panel');
  convTabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      convTabs.forEach(function (b) { b.classList.remove('active'); });
      convPanels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('conv-panel-' + btn.dataset.conv).classList.add('active');
    });
  });

  function bytesToSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  function setupDropZone(dropId, inputId, listId, opts) {
    var drop = document.getElementById(dropId);
    var input = document.getElementById(inputId);
    var list = document.getElementById(listId);
    var files = [];

    function render() {
      list.innerHTML = files.map(function (f) {
        return '<div>' + f.name + '  ·  ' + bytesToSize(f.size) + '</div>';
      }).join('');
      opts.onChange(files);
    }

    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      files = opts.multiple ? Array.from(input.files) : [input.files[0]];
      render();
    });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.borderColor = 'var(--ink-soft)'; });
    drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.style.borderColor = '';
      var dropped = Array.from(e.dataTransfer.files);
      files = opts.multiple ? dropped : [dropped[0]];
      render();
    });

    return { getFiles: function () { return files; } };
  }

  function showDownload(containerId, url, filename, label) {
    var box = document.getElementById(containerId);
    box.innerHTML = '<a href="' + url + '" download="' + filename + '">' + (label || ('Télécharger ' + filename)) + '</a>';
    box.classList.add('show');
  }

  function setStatus(id, text) {
    document.getElementById(id).textContent = text;
  }

  // -------------------------------------------------------------------
  // 1. Convertisseur d'image (PNG / JPG / WebP)
  // -------------------------------------------------------------------
  var imgZone = setupDropZone('drop-img-conv', 'file-img-conv', 'list-img-conv', {
    multiple: false,
    onChange: function (files) {
      document.getElementById('btn-img-conv').disabled = files.length === 0;
    }
  });

  document.getElementById('btn-img-conv').addEventListener('click', function () {
    var file = imgZone.getFiles()[0];
    if (!file) return;
    var format = document.getElementById('img-conv-format').value; // image/png, image/jpeg, image/webp
    var quality = parseInt(document.getElementById('img-conv-quality').value, 10) / 100;
    setStatus('status-img-conv', 'Conversion…');

    var img = new Image();
    var reader = new FileReader();
    reader.onload = function (e) {
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext('2d');
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (blob) {
          var ext = format === 'image/png' ? 'png' : (format === 'image/webp' ? 'webp' : 'jpg');
          var url = URL.createObjectURL(blob);
          var newName = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
          setStatus('status-img-conv', bytesToSize(file.size) + ' → ' + bytesToSize(blob.size));
          showDownload('download-img-conv', url, newName);
        }, format, format === 'image/png' ? undefined : quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('img-conv-format').addEventListener('change', function () {
    var isLossy = this.value !== 'image/png';
    document.getElementById('img-conv-quality-wrap').style.display = isLossy ? 'flex' : 'none';
  });

  // -------------------------------------------------------------------
  // 2. Images → PDF
  // -------------------------------------------------------------------
  var imgsToPdfZone = setupDropZone('drop-imgs2pdf', 'file-imgs2pdf', 'list-imgs2pdf', {
    multiple: true,
    onChange: function (files) {
      document.getElementById('btn-imgs2pdf').disabled = files.length === 0;
    }
  });

  document.getElementById('btn-imgs2pdf').addEventListener('click', function () {
    var files = imgsToPdfZone.getFiles();
    if (!files.length) return;
    setStatus('status-imgs2pdf', 'Assemblage de ' + files.length + ' image(s)…');

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF();
    var loaded = 0;

    function loadImage(file) {
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

    Promise.all(files.map(loadImage)).then(function (images) {
      images.forEach(function (imgData, i) {
        if (i > 0) doc.addPage();
        var pageW = doc.internal.pageSize.getWidth();
        var pageH = doc.internal.pageSize.getHeight();
        var ratio = Math.min(pageW / imgData.w, pageH / imgData.h);
        var w = imgData.w * ratio;
        var h = imgData.h * ratio;
        var x = (pageW - w) / 2;
        var y = (pageH - h) / 2;
        var format = imgData.dataUrl.indexOf('image/png') !== -1 ? 'PNG' : 'JPEG';
        doc.addImage(imgData.dataUrl, format, x, y, w, h);
      });
      var blob = doc.output('blob');
      var url = URL.createObjectURL(blob);
      setStatus('status-imgs2pdf', 'Terminé — ' + images.length + ' page(s)');
      showDownload('download-imgs2pdf', url, 'images.pdf');
    });
  });

  // -------------------------------------------------------------------
  // 3. PDF → Images (zip)
  // -------------------------------------------------------------------
  var pdf2imgsZone = setupDropZone('drop-pdf2imgs', 'file-pdf2imgs', 'list-pdf2imgs', {
    multiple: false,
    onChange: function (files) {
      document.getElementById('btn-pdf2imgs').disabled = files.length === 0;
    }
  });

  document.getElementById('btn-pdf2imgs').addEventListener('click', function () {
    var file = pdf2imgsZone.getFiles()[0];
    if (!file) return;
    setStatus('status-pdf2imgs', 'Lecture du PDF…');

    var reader = new FileReader();
    reader.onload = function (e) {
      var typedArray = new Uint8Array(e.target.result);
      window.pdfjsLib.getDocument(typedArray).promise.then(function (pdf) {
        var zip = new JSZip();
        var pagePromises = [];

        for (var p = 1; p <= pdf.numPages; p++) {
          pagePromises.push(
            pdf.getPage(p).then(function (page) {
              var viewport = page.getViewport({ scale: 2 });
              var canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              var ctx = canvas.getContext('2d');
              return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
                return new Promise(function (resolve) {
                  canvas.toBlob(function (blob) {
                    zip.file('page-' + String(page.pageNumber).padStart(2, '0') + '.png', blob);
                    resolve();
                  }, 'image/png');
                });
              });
            })
          );
          setStatus('status-pdf2imgs', 'Rendu de la page ' + p + ' / ' + pdf.numPages + '…');
        }

        Promise.all(pagePromises).then(function () {
          zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
            var url = URL.createObjectURL(zipBlob);
            setStatus('status-pdf2imgs', 'Terminé — ' + pdf.numPages + ' page(s)');
            showDownload('download-pdf2imgs', url, file.name.replace(/\.pdf$/i, '') + '-pages.zip');
          });
        });
      });
    };
    reader.readAsArrayBuffer(file);
  });

  // -------------------------------------------------------------------
  // 4. Word (.docx) → PDF
  // -------------------------------------------------------------------
  var word2pdfZone = setupDropZone('drop-word2pdf', 'file-word2pdf', 'list-word2pdf', {
    multiple: false,
    onChange: function (files) {
      document.getElementById('btn-word2pdf').disabled = files.length === 0;
    }
  });

  document.getElementById('btn-word2pdf').addEventListener('click', function () {
    var file = word2pdfZone.getFiles()[0];
    if (!file) return;
    setStatus('status-word2pdf', 'Lecture du document…');

    var reader = new FileReader();
    reader.onload = function (e) {
      window.mammoth.convertToHtml({ arrayBuffer: e.target.result }).then(function (result) {
        setStatus('status-word2pdf', 'Mise en page…');
        var holder = document.createElement('div');
        holder.style.cssText = 'position:fixed; left:-9999px; top:0; width:700px; padding:32px; background:#fff; font-family:Georgia,serif; font-size:14px; line-height:1.6; color:#111;';
        holder.innerHTML = result.value;
        document.body.appendChild(holder);

        html2canvas(holder, { scale: 2 }).then(function (canvas) {
          document.body.removeChild(holder);
          var jsPDF = window.jspdf.jsPDF;
          var doc = new jsPDF({ unit: 'pt', format: 'a4' });
          var pageW = doc.internal.pageSize.getWidth();
          var pageH = doc.internal.pageSize.getHeight();
          var imgW = pageW;
          var imgH = (canvas.height * imgW) / canvas.width;
          var heightLeft = imgH;
          var position = 0;
          var imgData = canvas.toDataURL('image/jpeg', 0.92);

          doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
          heightLeft -= pageH;
          while (heightLeft > 0) {
            position = heightLeft - imgH;
            doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
            heightLeft -= pageH;
          }

          var blob = doc.output('blob');
          var url = URL.createObjectURL(blob);
          setStatus('status-word2pdf', 'Terminé');
          showDownload('download-word2pdf', url, file.name.replace(/\.docx?$/i, '') + '.pdf');
        });
      }).catch(function (err) {
        setStatus('status-word2pdf', 'Erreur : fichier .docx illisible');
        console.error(err);
      });
    };
    reader.readAsArrayBuffer(file);
  });

  // -------------------------------------------------------------------
  // 5. PDF → Word (texte brut, mise en forme simplifiée)
  // -------------------------------------------------------------------
  var pdf2wordZone = setupDropZone('drop-pdf2word', 'file-pdf2word', 'list-pdf2word', {
    multiple: false,
    onChange: function (files) {
      document.getElementById('btn-pdf2word').disabled = files.length === 0;
    }
  });

  document.getElementById('btn-pdf2word').addEventListener('click', function () {
    var file = pdf2wordZone.getFiles()[0];
    if (!file) return;
    setStatus('status-pdf2word', 'Extraction du texte…');

    var reader = new FileReader();
    reader.onload = function (e) {
      var typedArray = new Uint8Array(e.target.result);
      window.pdfjsLib.getDocument(typedArray).promise.then(function (pdf) {
        var textPromises = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          textPromises.push(
            pdf.getPage(p).then(function (page) {
              return page.getTextContent().then(function (content) {
                return content.items.map(function (it) { return it.str; }).join(' ');
              });
            })
          );
        }
        Promise.all(textPromises).then(function (pages) {
          var paragraphsHtml = pages.map(function (pageText, i) {
            return '<p style="margin:0 0 12pt 0;">' + escapeHtml(pageText) + '</p>' +
              (i < pages.length - 1 ? '<br clear="all" style="page-break-before:always" />' : '');
          }).join('');

          // Fichier .doc lisible par Word via le format HTML-in-.doc — simple et robuste,
          // même s'il ne s'agit pas d'un vrai .docx (OOXML). Mise en forme non préservée.
          var htmlDoc =
            '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
            'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
            '<head><meta charset="utf-8"><title>Document</title></head>' +
            '<body style="font-family:Calibri,Arial,sans-serif; font-size:11pt;">' + paragraphsHtml + '</body></html>';

          var blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword' });
          var url = URL.createObjectURL(blob);
          setStatus('status-pdf2word', 'Terminé — ' + pdf.numPages + ' page(s), texte brut');
          showDownload('download-pdf2word', url, file.name.replace(/\.pdf$/i, '') + '.doc');
        });
      });
    };
    reader.readAsArrayBuffer(file);
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // -------------------------------------------------------------------
  // 6. ePub → PDF
  // -------------------------------------------------------------------
  var epub2pdfZone = setupDropZone('drop-epub2pdf', 'file-epub2pdf', 'list-epub2pdf', {
    multiple: false,
    onChange: function (files) {
      document.getElementById('btn-epub2pdf').disabled = files.length === 0;
    }
  });

  function resolveZipPath(baseDir, relHref) {
    var base = 'https://z/' + (baseDir ? baseDir + '/' : '');
    var url = new URL(relHref.split('#')[0], base);
    return decodeURIComponent(url.pathname.replace(/^\//, ''));
  }
  function dirname(path) {
    var i = path.lastIndexOf('/');
    return i === -1 ? '' : path.substring(0, i);
  }

  document.getElementById('btn-epub2pdf').addEventListener('click', function () {
    var file = epub2pdfZone.getFiles()[0];
    if (!file) return;
    setStatus('status-epub2pdf', 'Ouverture de l\'ePub…');

    var reader = new FileReader();
    reader.onload = function (e) {
      JSZip.loadAsync(e.target.result).then(function (zip) {

        // 1. container.xml → chemin du fichier .opf
        return zip.file('META-INF/container.xml').async('string').then(function (containerXml) {
          var containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
          var rootfile = containerDoc.querySelector('rootfile');
          var opfPath = rootfile.getAttribute('full-path');
          var opfDir = dirname(opfPath);

          // 2. le .opf → manifeste (id → href) + ordre de lecture (spine)
          return zip.file(opfPath).async('string').then(function (opfXml) {
            var opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
            var manifest = {};
            opfDoc.querySelectorAll('manifest item').forEach(function (item) {
              manifest[item.getAttribute('id')] = {
                href: item.getAttribute('href'),
                type: item.getAttribute('media-type')
              };
            });
            var spineHrefs = [];
            opfDoc.querySelectorAll('spine itemref').forEach(function (ref) {
              var idref = ref.getAttribute('idref');
              if (manifest[idref]) spineHrefs.push(resolveZipPath(opfDir, manifest[idref].href));
            });

            var titleEl = opfDoc.querySelector('metadata > *[*|creator], metadata title');
            var bookTitle = (opfDoc.querySelector('metadata title') || {}).textContent || file.name.replace(/\.epub$/i, '');

            setStatus('status-epub2pdf', 'Lecture de ' + spineHrefs.length + ' chapitre(s)…');

            // 3. charge chaque chapitre en HTML, en intégrant ses images en base64
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
                return Promise.all(imgPromises).then(function () {
                  return doc.body ? doc.body.innerHTML : '';
                });
              }).catch(function () { return ''; });
            });

            return Promise.all(chapterPromises).then(function (chapters) {
              return { chapters: chapters, title: bookTitle };
            });
          });
        });
      }).then(function (book) {
        setStatus('status-epub2pdf', 'Mise en page…');
        var holder = document.createElement('div');
        holder.style.cssText = 'position:fixed; left:-9999px; top:0; width:700px; padding:36px; background:#fff; font-family:Georgia,serif; font-size:14px; line-height:1.7; color:#111;';
        holder.innerHTML = book.chapters.map(function (html, i) {
          return '<div style="' + (i > 0 ? 'page-break-before:always;' : '') + '">' + html + '</div>';
        }).join('');
        holder.querySelectorAll('img').forEach(function (img) {
          img.style.maxWidth = '100%';
        });
        document.body.appendChild(holder);

        return html2canvas(holder, { scale: 2, useCORS: true }).then(function (canvas) {
          document.body.removeChild(holder);
          var jsPDF = window.jspdf.jsPDF;
          var doc = new jsPDF({ unit: 'pt', format: 'a4' });
          var pageW = doc.internal.pageSize.getWidth();
          var pageH = doc.internal.pageSize.getHeight();
          var imgW = pageW;
          var imgH = (canvas.height * imgW) / canvas.width;
          var heightLeft = imgH;
          var position = 0;
          var imgData = canvas.toDataURL('image/jpeg', 0.9);

          doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
          heightLeft -= pageH;
          while (heightLeft > 0) {
            position = heightLeft - imgH;
            doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
            heightLeft -= pageH;
          }

          var blob = doc.output('blob');
          var url = URL.createObjectURL(blob);
          setStatus('status-epub2pdf', 'Terminé — ' + book.chapters.length + ' chapitre(s)');
          showDownload('download-epub2pdf', url, file.name.replace(/\.epub$/i, '') + '.pdf');
        });
      }).catch(function (err) {
        setStatus('status-epub2pdf', 'Erreur : fichier .epub illisible ou non standard');
        console.error(err);
      });
    };
    reader.readAsArrayBuffer(file);
  });

})();
