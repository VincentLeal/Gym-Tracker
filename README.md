# Gym Tracker — Push / Pull / Legs

App de suivi de séances pour 2 utilisateurs, Next.js 14 + Supabase.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (Postgres + Auth)
- **Tailwind CSS**
- **Vercel** (déploiement)
- PWA-ready (installable sur mobile)

---

## Setup en 5 étapes

### 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Va dans **SQL Editor** et colle le contenu de `supabase/schema.sql`
3. Exécute le script — ça crée les tables, les policies RLS, et le trigger de création de profil
4. Dans **Project Settings > API**, copie :
   - `Project URL`
   - `anon public key`

### 2. Variables d'environnement

Copie `.env.local.example` en `.env.local` :

```bash
cp .env.local.example .env.local
```

Remplis avec tes valeurs Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Install & run local

```bash
npm install
npm run dev
```

### 4. Créer les 2 comptes

Va sur `http://localhost:3000/login`, crée un compte pour toi, puis un pour ta femme.
Dans Supabase > Authentication > Users tu peux vérifier que les deux sont bien créés.

### 5. Déploiement Vercel

```bash
npm i -g vercel
vercel
```

Ou connecte le repo GitHub à Vercel et ajoute les variables d'env dans le dashboard Vercel.

---

## Utilisation

- Chaque utilisateur se connecte avec son compte
- Dashboard : stats globales + boutons pour démarrer une séance
- Séance : saisie poids / reps par série, cochage, note libre
- Enregistrement : sauvegardé en base, visible dans l'historique
- PWA : sur mobile, "Ajouter à l'écran d'accueil" dans le navigateur

---

## Structure

```
app/
  page.tsx              — redirect login/dashboard
  login/page.tsx        — auth
  dashboard/page.tsx    — accueil + historique
  session/[type]/       — tracker de séance (push/pull/legs)
lib/
  supabase.ts           — client Supabase
  program.ts            — définition des exercices
supabase/
  schema.sql            — tables + RLS + trigger
```
