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

### 2. Node 22 just for TekCard (other apps keep the system Node)
```bash
cd /opt
F=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep -o 'node-v22[^ ]*-linux-x64.tar.xz')
curl -fsSLO https://nodejs.org/dist/latest-v22.x/$F
tar xf $F && rm $F && mv ${F%.tar.xz} node22
/opt/node22/bin/node -v        # v22.x
node -v                        # system Node unchanged
```
Also needed: `nginx`, `git`, `build-essential`, and `pm2` (any Node version).

### 3. Code
```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/Eslamatef1992/tekcard-api.git
cd tekcard-api
cp .env.example .env
nano .env    # set JWT_SECRET (openssl rand -hex 32) and ADMIN_EMAIL / ADMIN_PASSWORD
./deploy.sh
pm2 startup  # only if never done on this server — run the command it prints
curl http://127.0.0.1:4000/api/health   # -> {"ok":true}
```

### 4. SSL (two certificates)
**Main names** (root, www, admin, back), via HTTP check, auto-renews with certbot:
```bash
mkdir -p /var/www/letsencrypt
# first enable only the port-80 block of deploy/nginx-teknulugycard.conf, then:
certbot certonly --webroot -w /var/www/letsencrypt \
  -d teknulugycard.com -d www.teknulugycard.com -d admin.teknulugycard.com -d back.teknulugycard.com \
  --cert-name teknulugycard.com
```
**Card subdomains** (`*.teknulugycard.com`), via lego v5 + Hostinger DNS API token in `/root/.secrets/hostinger-token`:
```bash
HOSTINGER_API_TOKEN_FILE=/root/.secrets/hostinger-token HOSTINGER_PROPAGATION_TIMEOUT=600 \
lego run --accept-tos --email you@example.com --dns hostinger \
  -d '*.teknulugycard.com' --cert.name wildcard-teknulugycard --path /etc/lego \
  --deploy-hook "systemctl reload nginx"
```
Re-running the same command weekly (cron) renews it when due.

### 5. Nginx
```bash
cp deploy/nginx-teknulugycard.conf /etc/nginx/sites-available/teknulugycard.conf
ln -sf /etc/nginx/sites-available/teknulugycard.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```
Uncomment the card-pages block once the wildcard certificate exists.

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

## Apple Wallet (optional)
Each card has an **Apple Wallet pass** switch in the admin. When on (and certificates are installed), the card page shows
**Add to Apple Wallet** on iPhone/iPad/Mac. The pass is generated on demand at `https://{name}.teknulugycard.com/wallet.pkpass`
(photo, name, title, company, phone, links on the back, QR code to the card).

### One-time certificate setup
**On developer.apple.com** (Certificates, Identifiers & Profiles):
1. Identifiers → **+** → **Pass Type IDs** → identifier `pass.com.teknulugy.tekcard`.
2. Open it → **Create Certificate**. For the CSR: Mac *Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority* → *Saved to disk*.
3. Download the `.cer`, double-click it, then in Keychain → *My Certificates* right-click **Pass Type ID: pass.com.teknulugy.tekcard** → *Export* → `Certificates.p12` with a password.
4. Download Apple WWDR G4: https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
5. Note your **Team ID** (Membership details).

**Upload from the Mac:**
```bash
ssh root@82.29.178.28 'mkdir -p /root/.secrets/tekcard-wallet && chmod 700 /root/.secrets/tekcard-wallet'
scp ~/Downloads/Certificates.p12 ~/Downloads/AppleWWDRCAG4.cer root@82.29.178.28:/root/.secrets/tekcard-wallet/
```

**Convert on the server** (asks for the .p12 password, then a new key passphrase):
```bash
cd /root/.secrets/tekcard-wallet
openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out signerCert.pem \
  || openssl pkcs12 -legacy -in Certificates.p12 -clcerts -nokeys -out signerCert.pem
openssl pkcs12 -in Certificates.p12 -nocerts -out signerKey.pem \
  || openssl pkcs12 -legacy -in Certificates.p12 -nocerts -out signerKey.pem
openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
chmod 600 *
```

**Add to `/var/www/tekcard-api/.env`**, then `pm2 restart tekcard-api --update-env`:
```
WALLET_PASS_TYPE_ID=pass.com.teknulugy.tekcard
WALLET_TEAM_ID=YOURTEAMID
WALLET_ORG_NAME=Teknulugy
WALLET_CERT_DIR=/root/.secrets/tekcard-wallet
WALLET_KEY_PASSPHRASE=the-key-passphrase-you-chose
```
The admin card page shows a warning while certificates are missing, and a **Download test pass** button once they work.
Passes already added to Wallet don't update automatically; re-adding gives the latest details.
