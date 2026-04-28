# TaskFlow

Kanban tabanlı basit bir proje yönetim aracı. Next.js, Prisma ve PostgreSQL ile yazıldı.

## Stack

- Next.js 14 (App Router)
- NextAuth.js (credentials)
- Prisma + PostgreSQL
- dnd-kit
- Tailwind CSS

## Kurulum

```bash
npm install
```

`.env.local` dosyası oluştur:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

```bash
npm run db:push
npm run dev
```

## Deploy

Vercel + Neon (ya da Supabase) önerilir.

1. Neon'dan bir PostgreSQL DB oluştur
2. Vercel'a projeyi import et, env variable'ları ekle
3. `npx prisma db push` ile schema'yı DB'ye uygula

## Notlar

- Kart sıralaması fractional indexing ile tutuluyor, sayfa yenilemesinde korunuyor
- Sütunlar da sürüklenip yeniden sıralanabiliyor
- Touch desteği var (mobil)
