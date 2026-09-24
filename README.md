# Blablabla

Outil gratuit pour les recruteurs : détecte les traces de génération par IA
dans un texte, une photo ou une vidéo de candidature, et convertit des
fichiers (image / PDF / Word) sans rien installer.

**Démo publiée par Claude :** garde le lien reçu dans la conversation pour
voir le rendu avant de déployer.

## Structure du dépôt

```
blablabla/
├── index.html           → page principale
├── 404.html              → page d'erreur GitHub Pages
├── favicon.svg            → icône de l'onglet
├── robots.txt              → indique aux moteurs de recherche quoi explorer
├── sitemap.xml              → plan du site pour l'indexation
├── css/
│   └── style.css        → tous les styles
├── js/
│   ├── detector.js       → onglets Texte / Photo / Vidéo
│   └── converters.js     → convertisseurs de fichiers
└── backend/              → serveur relais optionnel (voir plus bas)
    ├── server.js
    ├── package.json
    ├── .env.example
    └── README.md
```

**Avant de déployer**, remplace `TON-COMPTE` par ton vrai nom d'utilisateur
GitHub dans trois fichiers : `sitemap.xml`, `robots.txt`, et les balises
`<meta property="og:...">` / `<link rel="canonical">` en haut d'`index.html`.
Un rechercher-remplacer global sur `TON-COMPTE` suffit.

## Ce qui marche tout de suite, sans rien configurer

- **Détecteur de texte** : heuristique locale (uniformité des phrases,
  tournures typiques des LLM). Tourne entièrement dans le navigateur.
- **Tous les convertisseurs** : image ↔ format, images → PDF, PDF → images,
  Word → PDF, PDF → Word. Aucun serveur, aucune clé, aucune limite d'usage —
  tout se passe côté client via des librairies JS chargées depuis un CDN.

## Ce qui nécessite le backend (optionnel)

- **Détecteur photo et vidéo** : une vraie analyse (pas juste la démo)
  demande d'appeler une API comme Hive Moderation. Ça ne peut pas se faire
  en toute sécurité depuis une page statique (la clé serait visible par
  n'importe qui), donc il faut le petit serveur du dossier `backend/`.
  Voir `backend/README.md` pour le déployer en quelques minutes sur Render.

Sans backend, ces deux onglets restent utilisables en **mode démo**
(résultat d'exemple clairement annoncé comme tel).

## Déployer le site sur GitHub Pages (gratuit)

1. Crée un nouveau dépôt sur GitHub, par exemple `blablabla`
2. Pousse tout le contenu de ce dossier à la racine du dépôt :
   ```bash
   git init
   git add .
   git commit -m "Premier déploiement de Blablabla"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/blablabla.git
   git push -u origin main
   ```
3. Dans le dépôt GitHub : **Settings → Pages**
4. Source : **Deploy from a branch** → branche `main`, dossier `/ (root)`
5. Après une minute ou deux, le site est en ligne à :
   `https://TON-COMPTE.github.io/blablabla/`

Aucune étape de build n'est nécessaire — c'est du HTML/CSS/JS statique,
GitHub Pages le sert tel quel.

## Personnaliser

- **Couleurs et polices** : tout est dans `css/style.css`, sous `:root` en
  haut du fichier pour les couleurs.
- **Textes** : directement dans `index.html`.
- **Ajouter un logo/favicon** : place un fichier `favicon.ico` à la racine
  et ajoute `<link rel="icon" href="favicon.ico">` dans le `<head>`.

## Limites connues (honnêteté d'abord)

- Le détecteur de texte est une heuristique simple, pas un modèle entraîné :
  utile comme premier filtre, pas comme preuve.
- `Word → PDF` rend le document sous forme d'image dans le PDF (via capture
  d'écran) — le texte n'est donc pas sélectionnable dans le PDF généré.
- `PDF → Word` extrait le texte brut sans reconstruire la mise en page
  d'origine (colonnes, tableaux, styles perdus).
- Les gros fichiers (PDF de nombreuses pages, vidéos longues) peuvent être
  lents à traiter car tout tourne dans le navigateur du visiteur.

## Licence

Fais-en ce que tu veux — adapte, renomme, revends, héberge. Aucune
attribution requise.
