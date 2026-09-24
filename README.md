# Blablabla — Backend de détection

Ce petit serveur reçoit les fichiers image/vidéo depuis le site, les transmet
à Hive Moderation (ou un autre fournisseur), et renvoie uniquement le score —
sans jamais exposer ta clé API au navigateur.

## 1. Obtenir une clé API

- **Hive Moderation** : https://thehive.ai — offre l'image, la vidéo et le texte
  sous une seule API. Compte pro nécessaire pour un usage en production.
- **Sightengine** : alternative moins chère, bon plan gratuit pour tester.
- **Sensity** : spécialisé deepfake vidéo, plus cher, plus précis sur ce point précis.

Commence par un compte d'essai chez un seul fournisseur (Hive couvre les trois
formats, c'est le plus simple pour démarrer).

## 2. Configurer en local

```bash
npm install
cp .env.example .env
# édite .env et colle ta clé HIVE_API_KEY
npm start
```

Le serveur tourne sur `http://localhost:3000`.

## 3. Déployer (Render — le plus simple pour démarrer)

1. Crée un compte sur render.com
2. "New Web Service" → connecte ce dossier (ou pousse-le sur un repo GitHub)
3. Build command : `npm install`
4. Start command : `npm start`
5. Dans "Environment", ajoute la variable `HIVE_API_KEY` avec ta vraie clé
6. Ajoute aussi `ALLOWED_ORIGIN` avec l'URL de ton site publié, pour que seul
   ton front puisse appeler ce serveur

Une fois déployé, tu obtiens une URL du type `https://blablabla-backend.onrender.com`.

## 4. Brancher le front dessus

Dans `index.html`, remplace la fonction `runDemo()` par un vrai appel :

```javascript
async function analyzeFile(kind, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('https://blablabla-backend.onrender.com/api/detect-' + kind, {
    method: 'POST',
    body: form
  });
  return res.json();
}
```

Attention : un fichier HTML publié tel quel sur claude.ai a une politique de
sécurité qui bloque les appels vers des domaines externes. Pour une vraie mise
en production, héberge ce front ailleurs (Vercel, Netlify, ou ton propre
hébergement) une fois le backend prêt — l'aperçu Claude reste idéal pour la
démonstration et la validation du design, pas pour la version finale en ligne.

## 5. Coûts à anticiper

Les fournisseurs facturent à l'appel (souvent entre 0,001€ et 0,01€ par
analyse selon le volume). Avant de fixer tes propres tarifs, teste le coût
réel sur un échantillon de 100 documents pour calculer ta marge.
