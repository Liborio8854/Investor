# INVESTOR

Investiční dashboard (React + Vite + Supabase + Tailwind).

## Setup

```bash
npm install
cp .env.example .env
# doplň VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY
npm run dev
```

## Stránky

- `/dashboard` — hlavní přehled (implementováno)
- `/watchlist`, `/positions`, `/transactions`, `/rules` — placeholdery

## Auth

Po přihlášení přes Supabase Auth se ověří `inv_users.approved`. Noví uživatelé dostanou `role=viewer`, `approved=false` a čekají na schválení administrátorem.

## Deploy (Vercel)

Napoj repo a nastav env proměnné `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY`. `vercel.json` zajišťuje SPA rewrite.
