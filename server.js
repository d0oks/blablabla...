// server.js — Backend relais pour Blablabla
//
// Rôle : garder les clés API secrètes côté serveur, et transmettre au front
// uniquement le résultat de l'analyse. Le front (index.html) ne doit jamais
// contenir de clé API en clair.
//
// Déploiement conseillé : Render, Railway ou Vercel (functions), plan gratuit
// suffisant pour démarrer.

const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Autorise uniquement ton domaine de front une fois en prod (remplace '*')
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

const HIVE_KEY = process.env.HIVE_API_KEY; // à définir dans les variables d'environnement, jamais dans le code

// ---------------------------------------------------------------------------
// POST /api/detect-image
// body: multipart/form-data avec un champ "file"
// ---------------------------------------------------------------------------
app.post('/api/detect-image', upload.single('file'), async (req, res) => {
  try {
    if (!HIVE_KEY) return res.status(500).json({ error: 'HIVE_API_KEY manquante côté serveur.' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    const form = new FormData();
    form.append('media', new Blob([req.file.buffer]), req.file.originalname);

    const hiveRes = await fetch('https://api.thehive.ai/api/v2/task/sync', {
      method: 'POST',
      headers: { 'Authorization': `Token ${HIVE_KEY}` },
      body: form
    });

    if (!hiveRes.ok) {
      const errText = await hiveRes.text();
      return res.status(hiveRes.status).json({ error: 'Erreur fournisseur', detail: errText });
    }

    const data = await hiveRes.json();

    // Adapte cette extraction au format réel de la réponse Hive.
    // Ici on renvoie une forme simplifiée et stable pour le front.
    const classes = data?.status?.[0]?.response?.output?.[0]?.classes || [];
    const aiClass = classes.find(c => /ai|synthetic|generated/i.test(c.class));
    const score = aiClass ? Math.round(aiClass.score * 100) : null;

    res.json({ score, raw: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', detail: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/detect-video
// Même principe — adapte l'endpoint fournisseur selon Hive / Sensity / autre.
// ---------------------------------------------------------------------------
app.post('/api/detect-video', upload.single('file'), async (req, res) => {
  try {
    if (!HIVE_KEY) return res.status(500).json({ error: 'HIVE_API_KEY manquante côté serveur.' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    const form = new FormData();
    form.append('media', new Blob([req.file.buffer]), req.file.originalname);

    const hiveRes = await fetch('https://api.thehive.ai/api/v2/task/sync', {
      method: 'POST',
      headers: { 'Authorization': `Token ${HIVE_KEY}` },
      body: form
    });

    if (!hiveRes.ok) {
      const errText = await hiveRes.text();
      return res.status(hiveRes.status).json({ error: 'Erreur fournisseur', detail: errText });
    }

    const data = await hiveRes.json();
    const classes = data?.status?.[0]?.response?.output?.[0]?.classes || [];
    const deepfakeClass = classes.find(c => /deepfake|synthetic|generated/i.test(c.class));
    const score = deepfakeClass ? Math.round(deepfakeClass.score * 100) : null;

    res.json({ score, raw: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', detail: String(err) });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Blablabla backend actif sur le port ${PORT}`));
