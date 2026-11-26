# Wayle · Prospection

Outil de prospection de Wayle Production (vidéaste, Rouen), pensé comme un petit CRM : fiches prospects, pipeline, relances, messages générés avec Claude, offres et devis.
Interface en français, utilisable sur ordinateur et sur téléphone.

**État : étape (c).**
- (a) Connexion, fiches prospects, liste filtrable, ajout rapide avec détection de doublons, historique, barre de commande (Ctrl/Cmd + K).
- (b) « Aujourd'hui » (actions du jour, indicateurs, objectif du mois) et pipeline en colonnes (glisser-déposer, clavier, filtres).
- (c) Générateur de messages : modèles par canal, ton et catégorie, réécriture par Claude (3 variantes), « Copier et marquer comme envoyé » (historique, relance à J+3).

Les écrans Carte, Offres et Statistiques affichent « Pas encore construit » et seront ajoutés étape par étape.

## Essayer tout de suite (sans compte)

```bash
npm install --legacy-peer-deps
NEXT_PUBLIC_DEMO=1 npm run dev     # http://localhost:3000
```

Le mode démonstration charge 15 prospects fictifs de Rouen et garde vos modifications dans le navigateur. Rien n'est envoyé nulle part.

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

1. **Supabase** — créer un projet (région UE), puis exécuter dans l'éditeur SQL, dans cet ordre : `supabase/migrations/20261126000000_schema.sql`, puis `supabase/seed.sql` si vous voulez les 15 prospects fictifs (à supprimer ensuite, ils portent l'étiquette « démo »).
2. **Invitations** — dans l'éditeur SQL, *avant* d'inviter quiconque :
   `insert into team_invites (email) values ('vous@exemple.fr');` (en minuscules). Seules les adresses listées obtiennent un profil ; le prénom affiché est tiré de l'adresse et modifiable dans la table `profiles`.
   Puis, pour chaque personne, créer son compte dans Authentication → Users → *Add user* → *Create new user* (cocher *Auto Confirm User*, mot de passe aléatoire jamais utilisé). Le lien de connexion ne crée jamais de compte : sans cette étape, l'adresse est refusée (« n'est pas invitée »).
3. **Authentification** (Authentication → Providers → Email) : désactiver les inscriptions libres (« Allow new users to sign up »), laisser « Confirm email » actif. Dans *URL Configuration*, mettre l'adresse du site en *Site URL* et `https://votre-site/auth/callback` en *Redirect URLs*.
4. **Modèles d'e-mail** (Authentication → Email Templates), pour « Magic Link » et « Invite user » : remplacer le lien par
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink` (et `type=invite` pour l'invitation).
5. **Vercel** — importer le dépôt GitHub, ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API), déployer.
6. **Claude (facultatif, pour « Réécrire avec Claude »)** — créer une clé sur console.anthropic.com (API Keys), puis dans Vercel : Settings → Environment Variables → `ANTHROPIC_API_KEY` (cocher Production), et redéployer. La clé n'est jamais envoyée au navigateur : seul le serveur l'utilise, pour les comptes connectés. Sans clé, les modèles restent utilisables. `ANTHROPIC_MODEL` permet de changer de modèle (par défaut `claude-sonnet-5-5`). Chaque réécriture coûte quelques centimes au plus ; fixer une limite de dépense dans la console Anthropic.
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
