# Mettre à jour les photos du site

La page **https://www.mk-clean.fr/admin.html** permet d'ajouter, retirer, réordonner et légender
les photos du carrousel « Nos chantiers ». Pas besoin de toucher au code.

## Comment ça marche

Le site est hébergé gratuitement sur GitHub Pages : il n'y a pas de serveur, donc pas de base de comptes.
La page admin enregistre directement les changements dans ce dépôt GitHub :

- `data/carousel.json` : la liste des photos (ordre, titre, légende) ;
- `images/carousel/` : les photos envoyées depuis l'admin (redimensionnées automatiquement à 1800 px).

Chaque clic sur **Publier** crée un commit sur la branche choisie. Le site est à jour 1 à 2 minutes après.

## Première connexion sur un appareil (à faire une fois)

1. **Créer un jeton GitHub** (connecté au compte propriétaire du dépôt) :
   - GitHub → photo de profil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token** ;
   - *Token name* : `MK Clean admin` ; *Expiration* : 1 an (il faudra le renouveler) ;
   - *Repository access* : **Only select repositories** → `fbbbrand/MKClean` ;
   - *Permissions* → *Repository permissions* → **Contents : Read and write** (rien d'autre) ;
   - **Generate token**, puis copier le jeton (`github_pat_…`).
2. Ouvrir `admin.html`, coller le jeton, laisser la branche sur `main`, choisir un mot de passe.

Ensuite, sur cet appareil, seul le mot de passe est demandé. Le jeton est stocké **chiffré** dans le navigateur
(AES-GCM, clé dérivée du mot de passe) : sans le mot de passe, il est inutilisable.
Pour un autre appareil (téléphone, autre PC), refaire l'étape 2 avec le même jeton ou un nouveau.

## Utilisation

- **Ajouter des photos** (ou glisser-déposer) : elles arrivent en haut de la liste avec le badge « Nouvelle ».
  Chaque photo doit avoir un titre ; la légende est facultative.
- **↑ / ↓** : changer l'ordre d'affichage. **✕** : retirer la photo du carrousel.
- **Publier** : envoie tout en une fois.

Les photos retirées qui avaient été ajoutées via l'admin sont supprimées du dépôt. Les photos d'origine
du site (dossier `images/`) ne sont jamais supprimées, elles sont seulement retirées du carrousel.

## Sécurité

- N'importe qui peut ouvrir `admin.html`, mais sans jeton valide rien ne peut être modifié.
- Le jeton ne donne accès qu'à ce dépôt, et seulement à son contenu.
- Jeton perdu ou appareil volé : le révoquer sur GitHub (même page que la création), puis en créer un nouveau.
- Mot de passe oublié : « Reconfigurer cet appareil » sur la page de connexion, et recoller un jeton.

## Tester sans toucher au site en ligne

En local, depuis le dossier du dépôt :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000/ (le site) et http://localhost:8000/admin.html.
Pour que l'admin n'écrive pas sur le site en production, indiquer une **autre branche que `main`**
lors de la configuration (par exemple une branche de test créée sur GitHub). Pour revenir à `main` ensuite :
« Reconfigurer cet appareil ».
