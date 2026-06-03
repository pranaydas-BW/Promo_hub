# Broadway Internal Tools Dashboard

## Structure
```
broadway-dashboard/
├── server.js          # Express backend
├── links.json         # Tool data (auto-managed via admin)
├── package.json
└── public/
    ├── index.html     # Team-facing dashboard
    └── admin.html     # Admin panel (secret URL)
```

## Local dev
```bash
npm install
npm start
# Visit http://localhost:3000
```

## Admin access
Go to: `https://your-domain.onrender.com/admin#broadway2024`

> Change `broadway2024` in `public/admin.html` (line with `const SECRET = ...`) to your own secret.

## Deploy to Render
1. Push this folder to a GitHub repo
2. On Render → New → Web Service
3. Build command: `npm install`
4. Start command: `node server.js`
5. Done — Render auto-redeploys on push

## Notes
- Links are stored in `links.json` on the server
- On Render's free tier, the disk resets on redeploy — if you want links to persist permanently, commit `links.json` to git after each update, or upgrade to a paid Render instance with a persistent disk
