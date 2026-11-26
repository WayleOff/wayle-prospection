# Wayle · Prospection

Outil de prospection de Wayle Production (vidéaste, Rouen), pensé comme un petit CRM : fiches prospects, pipeline, relances, messages générés avec Claude, offres et devis.
Interface en français, utilisable sur ordinateur et sur téléphone.

**État : étape (f).**
- (a) Connexion, fiches prospects, liste filtrable, ajout rapide avec détection de doublons, historique, barre de commande (Ctrl/Cmd + K).
- (b) « Aujourd'hui » (actions du jour, indicateurs, objectif du mois) et pipeline en colonnes (glisser-déposer, clavier, filtres).
- (c) Générateur de messages : modèles par canal, ton et catégorie, réécriture par Claude (3 variantes), « Copier et marquer comme envoyé » (historique, relance à J+3).
- (d) Séquences de relance : suites d'étapes configurables (ex. J0 message → J+3 relance → J+7 visite ou appel → J+14 dernier message), programmées automatiquement dans « Aujourd'hui », arrêtées dès que le prospect répond.
- (e) Import CSV et export Notion (correspondance des colonnes, aperçu, doublons, annulation) et score automatique de 0 à 100 avec critères réglables.
- (f) Offres (catalogue) et devis : numérotation D-AAAA-NNN, lignes ponctuelles ou mensuelles, PDF A4, états brouillon / envoyé / accepté / refusé.

Les écrans Carte, Offres et Statistiques affichent « Pas encore construit » et seront ajoutés étape par étape.

## Essayer tout de suite (sans compte)

```bash
npm install --legacy-peer-deps
NEXT_PUBLIC_DEMO=1 npm run dev     # http://localhost:3000
```

Le mode démonstration charge 15 prospects fictifs de Rouen et garde vos modifications dans le navigateur. Rien n'est envoyé nulle part.

## Séquences de relance

- **Créer** : Messages → onglet *Séquences* → « Ajouter la séquence de départ » (J0, J+3, J+7, J+14), puis modifier à volonté (jours, action, libellé, canal, modèle de message par étape).
- **Lancer** : depuis le générateur de message (« Après l'envoi » : relance simple dans 3 jours ou lancer une séquence) ou depuis la fiche (bloc *Séquence de relance*).
- **Suivre** : la prochaine étape apparaît dans « Aujourd'hui » (« séquence 2/4 ») avec un bouton *Écrire* qui ouvre le générateur avec le bon canal et le bon modèle. *Fait* ou l'envoi d'un message passe à l'étape suivante (annulable). *Pas de réponse* repousse la même étape de 3 jours.
- **Arrêt automatique** : le prospect passe à partir de « Répondu », une réponse est notée dans l'historique, ou « Ne pas contacter » est coché. Arrêt manuel possible depuis la fiche.
- Une étape n'est jamais programmée dans le passé (au plus tôt demain). Envoyer un message libre pendant une étape « visite ou appel » ne fait pas avancer la séquence.

## Importer des prospects

Prospects → **Importer**.
- **Fichier CSV** (séparateur `;`, `,` ou tabulation ; accents Excel lus) ou **export Notion** (dans Notion : ••• de la base → Exporter → Format CSV ; l'archive `.zip` se dépose telle quelle).
- Les colonnes sont reconnues d'après leurs titres (français ou anglais) : nom, catégorie, Instagram, téléphone, e-mail, site, adresse, contact, date d'ouverture, notes, activité Instagram, indépendant, étiquettes. Chacune se corrige avant l'import.
- Les valeurs illisibles (e-mail invalide, date incompréhensible…) sont laissées vides et listées. Une catégorie ou une étiquette inconnue n'est pas créée : elle est ignorée (catégorie par défaut au choix).
- **Doublons** : même Instagram, même téléphone ou nom proche, contre la base *et* entre lignes du fichier. Ils sont ignorés par défaut ; une case permet d'en importer un quand même.
- L'import est un lot : « Annuler » dans la notification (8 s, ou Ctrl/Cmd + Z) archive toutes les fiches du lot. Les fiches importées ont la source « Import CSV » ou « Import Notion ».
- Limites : 8 Mo, 5 000 lignes par fichier.

## Offres et devis

- **Offres** (Offres → onglet Offres) : le catalogue (nom, description, prix, mensuel ou non). L'offre de départ est le reel d'essai à 90 €.
- **Mon entreprise** (Paramètres) : nom, adresse, SIRET, téléphone, e-mail, mention de TVA, durée de validité, conditions de paiement, acompte proposé par défaut, et le **logo** (PNG, JPEG, WebP ou SVG, réduit et converti en PNG dans le navigateur, imprimé en haut à gauche). Tout est imprimé sur le PDF. L'adresse et le SIRET sont obligatoires sur un devis ; la mention de TVA par défaut est celle de la franchise en base (art. 293 B du CGI) : à faire valider par un comptable.
- **Créer un devis** : depuis la fiche d'un prospect (section Devis) ou depuis Offres → Devis → Nouveau devis. On ajoute des offres du catalogue ou des lignes libres (quantité, prix unitaire, case « facturé chaque mois » ; un prix négatif sert de remise), une date de validité et des remarques. Le numéro est attribué à l'enregistrement.
- **PDF** : généré dans le navigateur (rien n'est envoyé), bouton PDF sur la fiche et dans la liste des devis.
- **États** : un brouillon se modifie ; un devis envoyé, accepté ou refusé se duplique. Chaque changement d'état est noté dans l'historique du prospect et se défait avec « Annuler ». **Accepté** met à jour le montant de la fiche (prestations ponctuelles + un mois des lignes mensuelles), donc le « CA signé » d'Aujourd'hui une fois le prospect passé à « Gagné ».
- **Acompte** : chaque devis a un pourcentage d'acompte (30 % par défaut, réglable dans Paramètres et sur chaque devis, 0 = aucun). Il porte sur les prestations ponctuelles, pas sur l'abonnement mensuel. Le PDF affiche « Acompte à la commande » et « Solde à la livraison » et le rappelle dans les conditions. L'outil ne crée pas la facture d'acompte : elle se fait dans Shine.

## Factures (import depuis Shine)

L'outil ne fabrique pas de factures : il importe celles de Shine pour voir ce qui est encaissé et ce qui reste à encaisser.

- Dans Shine : **Rapports → Rapport de ventes → Exporter → .csv**. Dans l'outil : Offres → onglet **Factures** → Importer des factures. Même principe que l'import de prospects : correspondance des colonnes devinée d'après les titres (modifiable), aperçu, puis import. Il faut au minimum le numéro de facture et un montant (TTC, ou HT + TVA). Les en-têtes exacts de l'export Shine ne sont pas documentés : en cas de colonne mal reconnue, on la corrige dans la liste déroulante.
- **Doublons** : un numéro déjà importé est ignoré, on peut donc réimporter un rapport plus récent sans crainte. L'import s'annule avec « Annuler » juste après.
- **Rattachement** : le nom du client est comparé (sans accents ni forme juridique : SARL, SAS…) à celui des prospects ; un seul prospect identique, et la facture lui est rattachée. Sinon « Associer à un prospect » à la main. Les factures d'un prospect apparaissent sur sa fiche.
- **Paiement** : « Payée le … » vient de la colonne date de paiement (ou d'une colonne statut) ; un clic sur l'état bascule payée / à encaisser. Un montant négatif est classé « Avoir » et vient en déduction du total facturé.
- Limite : seul le CSV est lu (pour un .xlsx : Enregistrer sous → CSV dans Excel).

## Score des prospects

Chaque fiche a un score de 0 à 100, recalculé automatiquement à chaque modification de la fiche (survol de « Score » : détail critère par critère). Critères de départ, réglables dans Paramètres → Score des prospects (activer, poids ; le total est ramené à 100) : ouverture récente (N mois réglable), Instagram faible ou inactif, établissement indépendant, catégorie prioritaire, joignable directement. Enregistrer les critères recalcule toutes les fiches.

## Raccourcis

| Touche | Action |
|---|---|
| `Ctrl/Cmd + K` | Barre de commande : chercher un prospect, aller à une page |
| `N` | Nouveau prospect |
| `/` | Aller à la recherche |
| `R` | Planifier une relance (fiche ouverte) |
| `M` | Générer un message (fiche ouverte) |
| `Ctrl/Cmd + Z` | Annuler la dernière action annulable |
| `Échap` | Fermer la fiche ou la fenêtre |

## Mise en service (vraies données)

1. **Supabase** — créer un projet (région UE), puis exécuter dans l'éditeur SQL, dans cet ordre : `supabase/migrations/20261126000000_schema.sql`, `supabase/migrations/20261127000000_sequences.sql` (séquences) `supabase/migrations/20261128000000_quotes.sql` (devis) et `supabase/migrations/20261129000000_invoices_deposits.sql` (acomptes et factures) — ces trois dernières sont à exécuter aussi sur un projet existant —, puis `supabase/seed.sql` si vous voulez les 15 prospects fictifs (à supprimer ensuite, ils portent l'étiquette « démo »).
2. **Invitations** — dans l'éditeur SQL, *avant* d'inviter quiconque :
   `insert into team_invites (email) values ('vous@exemple.fr');` (en minuscules). Seules les adresses listées obtiennent un profil ; le prénom affiché est tiré de l'adresse et modifiable dans la table `profiles`.
   Puis, pour chaque personne, créer son compte dans Authentication → Users → *Add user* → *Create new user* (cocher *Auto Confirm User*, mot de passe aléatoire jamais utilisé). Le lien de connexion ne crée jamais de compte : sans cette étape, l'adresse est refusée (« n'est pas invitée »).
3. **Authentification** (Authentication → Providers → Email) : désactiver les inscriptions libres (« Allow new users to sign up »), laisser « Confirm email » actif. Dans *URL Configuration*, mettre l'adresse du site en *Site URL* et `https://votre-site/auth/callback` en *Redirect URLs*.
4. **Modèles d'e-mail** (Authentication → Email Templates), pour « Magic Link » et « Invite user » : remplacer le lien par
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink` (et `type=invite` pour l'invitation).
5. **Vercel** — importer le dépôt GitHub, ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API), déployer.
6. **Claude (facultatif, pour « Réécrire avec Claude »)** : sans clé, « Brief pour Claude » copie la fiche et les consignes à coller dans l’application Claude (abonnement), puis « Coller la réponse de Claude » récupère les variantes. Avec clé : créer une clé sur console.anthropic.com (API Keys), puis dans Vercel : Settings → Environment Variables → `ANTHROPIC_API_KEY` (cocher Production), et redéployer. La clé n'est jamais envoyée au navigateur : seul le serveur l'utilise, pour les comptes connectés. Sans clé, les modèles restent utilisables. `ANTHROPIC_MODEL` permet de changer de modèle (par défaut `claude-sonnet-5-5`). Chaque réécriture coûte quelques centimes au plus ; fixer une limite de dépense dans la console Anthropic.
7. **Sauvegarde** — le plan gratuit de Supabase met le projet en pause après une semaine sans activité et n'inclut pas de sauvegardes téléchargeables : l'export CSV hebdomadaire (étape ultérieure) sert de filet de sécurité.

Les clés secrètes (service role, clé Anthropic) ne doivent jamais être dans le dépôt, ni dans une variable commençant par `NEXT_PUBLIC_`.

## Sécurité des données

- Chaque table est protégée par des règles *Row Level Security* : seuls les membres de l'équipe (`is_member()`) lisent et écrivent.
- Les e-mails d’invitation sont dans `team_invites`, illisible depuis le navigateur.
- Données de prospection B2B : informer la personne contactée et lui permettre de s'opposer facilement (case « Ne pas contacter » sur la fiche) ; ne pas conserver au-delà de 3 ans après le dernier contact.

## Développement

```bash
npm run dev         # serveur de développement
npm test            # tests de la logique (normalisation, doublons, saisie rapide, cohérence démo/SQL)
npm run typecheck   # TypeScript
npm run lint
npm run test:sql    # tests du schéma sur un Postgres local (nécessite PostgreSQL 16 installé)
```

Structure : `src/lib` (logique pure et accès aux données, `repo/` = Supabase ou démo), `src/components` (coque, fiche, ajout rapide, barre de commande), `src/app` (pages), `supabase/` (schéma, données de départ, tests SQL).

Pile : Next.js (App Router), React, TypeScript, Tailwind CSS, Supabase (Postgres, authentification par lien magique, RLS), Lucide.

## Ce qui n'a pas pu être testé ici

L'accès à Supabase (lecture/écriture, connexion par lien magique) n'a été que vérifié par le compilateur : le serveur Supabase ne peut pas tourner dans l'environnement de développement. Le schéma SQL, lui, est testé sur un vrai Postgres (droits, doublons, invitations). La première connexion réelle se fera donc avec votre projet Supabase.
