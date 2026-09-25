# Blablabla

Outil gratuit pour les recruteurs : détecte les traces de génération par IA
dans un texte, une photo ou une vidéo de candidature, et convertit des
fichiers (image / PDF / Word) sans rien installer.

## Fichiers (tous à la racine, aucun sous-dossier)

```
index.html      → page principale
style.css        → tous les styles
detector.js       → onglets Texte / Photo / Vidéo
converters.js      → convertisseurs de fichiers
favicon.svg          → icône de l'onglet
robots.txt             → indique aux moteurs de recherche quoi explorer
sitemap.xml              → plan du site pour l'indexation
404.html                   → page d'erreur GitHub Pages
```

Tout est à plat exprès, pour que l'upload sur GitHub via l'interface web
(sans dossiers) fonctionne sans souci.

## Ce qui marche tout de suite, sans rien configurer

- **Détecteur de texte** : heuristique locale, tourne dans le navigateur.
- **Tous les convertisseurs** : image ↔ format, images → PDF, PDF → images,
  Word → PDF, PDF → Word. Aucun serveur, aucune clé, gratuit et privé.

## Ce qui reste en mode démo

Le détecteur **photo** et **vidéo** affiche un résultat d'exemple tant
qu'aucune vraie API de détection (Hive, Sightengine…) n'est branchée
derrière — ça demande un petit serveur relais, qui est une étape plus
avancée et n'est pas nécessaire pour que le reste du site fonctionne.

## Déployer sur GitHub Pages (gratuit)

1. Crée un nouveau dépôt sur GitHub, par exemple `blablabla`
2. **Add file → Upload files**, puis fais glisser tous les fichiers de ce
   dossier (ou sélectionne-les tous et glisse-les d'un coup — ça marche même
   sans pouvoir glisser un dossier entier, puisqu'il n'y en a pas ici)
3. Commit
4. **Settings → Pages** → Source : **Deploy from a branch** → branche
   `main`, dossier `/ (root)`
5. Le site est en ligne après une minute ou deux, à :
   `https://TON-COMPTE.github.io/blablabla/`

## Avant de déployer

Remplace `TON-COMPTE` par ton vrai nom d'utilisateur GitHub dans
`sitemap.xml`, `robots.txt`, et les balises `<meta>` / `<link rel="canonical">`
en haut d'`index.html`.

## Limites connues

- Le détecteur de texte est une heuristique simple, pas un modèle entraîné :
  utile comme premier filtre, pas comme preuve.
- `Word → PDF` rend le document sous forme d'image — le texte n'est pas
  sélectionnable dans le PDF généré.
- `PDF → Word` extrait le texte brut sans reconstruire la mise en page.
- Les gros fichiers peuvent être lents à traiter, tout tourne dans le
  navigateur du visiteur.
