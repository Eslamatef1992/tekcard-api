# tekcard-api

Backend for **Teknulugy NFC smart cards** (Node.js + Express + SQLite).

It does three jobs:

| Host | What it serves |
|---|---|
| `back.teknulugycard.com/api/*` | REST API used by the admin dashboard |
| `{name}.teknulugycard.com` | Public card page opened when an NFC card is tapped |
| `{name}.teknulugycard.com/contact.vcf` | "Save contact" vCard download |
| `{name}.teknulugycard.com/go/{id}` | Tracked redirect for each social button |
| `teknulugycard.com/c/{name}` | Path fallback (works even before wildcard SSL is ready) |

Admin dashboard lives in the separate repo **tekcard-admin**.

## Features
- Admin login (JWT), change password
- Cards: name, job title, company, phone, email, bio, theme color, active/disabled
- Auto-generated link name from the person's name (`eslam.teknulugycard.com`) with live availability check
- Banner (1200×600) and photo/logo upload — auto-resized to WebP
- Social buttons: Instagram, TikTok, Snapchat, X, Facebook, LinkedIn, YouTube, Threads, Telegram, WhatsApp, Phone, Email, Website, Location, Pinterest, GitHub, Behance, Custom. Type a username or a full URL — the final link is built automatically.
- Phone tap → sheet asking **Save contact / Call / Message on WhatsApp** (also pops up automatically on first scan)
- vCard includes phone(s), email, company, title, website, socials and photo
- Arabic / English toggle (auto-detects the phone language, RTL support)
- Card opens + per-button click counters
- Kuwait numbers: `9xxxxxxx` is saved as `+9659xxxxxxx`

## Local development
```bash
cp .env.example .env      # set PUBLIC_API_URL=http://localhost:4000 for local
npm install
npm run dev               # http://localhost:4000
# card preview locally: http://localhost:4000/c/<name>
```

## Server setup (82.29.178.28) — first time only

### 1. DNS (at your domain registrar / DNS provider)
| Type | Name | Value |
|---|---|---|
| A | `@` | 82.29.178.28 |
| A | `*` | 82.29.178.28 |

The wildcard `*` record covers `admin.`, `back.` and every card subdomain.

### 2. Packages
```bash
apt update && apt install -y nginx git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
npm i -g pm2
```

### 3. Code
```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/Eslamatef1992/tekcard-api.git
cd tekcard-api
cp .env.example .env
nano .env    # set JWT_SECRET (openssl rand -hex 32) and ADMIN_EMAIL / ADMIN_PASSWORD
./deploy.sh
pm2 startup  # run the command it prints, so the API starts after reboot
curl http://127.0.0.1:4000/api/health   # -> {"ok":true}
```

### 4. Wildcard SSL (Let's Encrypt, DNS challenge)
Subdomain cards need a wildcard certificate, which Let's Encrypt only issues via a DNS TXT record.

**If DNS is on Cloudflare (recommended — renews automatically):**
```bash
apt install -y certbot python3-certbot-dns-cloudflare
mkdir -p /root/.secrets && echo "dns_cloudflare_api_token = YOUR_TOKEN" > /root/.secrets/cloudflare.ini
chmod 600 /root/.secrets/cloudflare.ini
certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d teknulugycard.com -d '*.teknulugycard.com'
```
(Cloudflare token needs *Zone → DNS → Edit*. Keep the `*` record as "DNS only" / grey cloud, or switch to Cloudflare proxy + Origin Certificate.)

**Any other DNS provider (manual — must be repeated every 90 days):**
```bash
apt install -y certbot
certbot certonly --manual --preferred-challenges dns -d teknulugycard.com -d '*.teknulugycard.com'
# certbot shows a TXT value -> add it as _acme-challenge.teknulugycard.com at your DNS, wait 1-2 min, press Enter
```

### 5. Nginx
```bash
cp deploy/nginx-teknulugycard.conf /etc/nginx/sites-available/teknulugycard.conf
ln -s /etc/nginx/sites-available/teknulugycard.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```
> If the server runs CyberPanel/OpenLiteSpeed on ports 80/443, Nginx can't bind those ports. In that case create the
> sites in CyberPanel instead and add a reverse-proxy rule to `127.0.0.1:4000` for `back.`, the root domain and the wildcard.

## Updating (every push)
```bash
cd /var/www/tekcard-api && ./deploy.sh
```

## Backups
Everything lives in two folders — back them up together:
```bash
tar czf tekcard-backup-$(date +%F).tgz -C /var/www/tekcard-api data uploads
```

## Writing the NFC card
In the admin, open a card → **Copy link** → in an NFC writer app (e.g. *NFC Tools*): *Write → Add a record → URL/URI* → paste `https://eslam.teknulugycard.com` → *Write* and tap the card. The same link is used for the downloadable QR code.

## API summary (all require `Authorization: Bearer <token>` except login/platforms)
```
POST   /api/auth/login              {email, password} -> {token}
POST   /api/auth/password           {current, next}
GET    /api/platforms
GET    /api/stats
GET    /api/slug-check?slug=&exclude=
GET    /api/cards?q=
POST   /api/cards                   {full_name, title, company, phone, email, bio, slug?, theme_color, is_active, links:[{platform, value, label}]}
GET    /api/cards/:id
PUT    /api/cards/:id
DELETE /api/cards/:id
POST   /api/cards/:id/banner        multipart field "image"
POST   /api/cards/:id/avatar        multipart field "image"
DELETE /api/cards/:id/banner|avatar
```
