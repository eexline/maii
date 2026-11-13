# AWG Operator (Vercel)

UI на Vercel, API на сервере бота. Браузер ходит только на Vercel; `/api/*` проксируется serverless-функцией.

## 1. Бот-сервер

В `.env` бота:

```env
OPERATOR_ENABLED=true
OPERATOR_HOST=0.0.0.0
OPERATOR_PORT=8080
OPERATOR_PASSWORD=...
OPERATOR_CORS_ORIGINS=https://YOUR-APP.vercel.app
```

Открой порт `8080` (или поставь nginx → `https://op-api.example.com`).

## 2. Vercel

```bash
cd operator-web
npx vercel
```

В Project → Settings → Environment Variables:

| Name | Value |
|------|--------|
| `OPERATOR_BACKEND_URL` | `http://SERVER_IP:8080` |

Redeploy после смены env.

## 3. Проверка

1. Открой `https://YOUR-APP.vercel.app`
2. Логин паролем оператора
3. В Network: `/api/queue` → 200 через Vercel proxy
