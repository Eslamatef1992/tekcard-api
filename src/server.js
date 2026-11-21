require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const { db, seedAdmin } = require('./db');
const { PLATFORMS, buildUrl, publicList, normalizePhone } = require('./platforms');
const { renderCard, renderNotFound, buildVCard } = require('./cardPage');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const BASE_DOMAIN = (process.env.BASE_DOMAIN || 'teknulugycard.com').toLowerCase();
const API_URL = process.env.PUBLIC_API_URL || `https://back.${BASE_DOMAIN}`;
const RESERVED = new Set(['admin', 'back', 'www', 'api', 'mail', 'ftp', 'cpanel', 'webmail', 'ns1', 'ns2', 'app', 'static', 'cdn']);
const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

seedAdmin();

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '1mb' }));

const allowed = (process.env.CORS_ORIGINS || `https://admin.${BASE_DOMAIN},http://localhost:5173`).split(',').map((s) => s.trim());
const corsMw = cors({ origin: (o, cb) => cb(null, !o || allowed.includes(o)) });

// ---------- helpers ----------
const cardUrl = (slug) => `https://${slug}.${BASE_DOMAIN}`;
const fileUrl = (f) => (f ? `${API_URL}/uploads/${f}` : '');

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
function validSlug(s) {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s) && !RESERVED.has(s);
}
function uniqueSlug(base, excludeId = 0) {
  let s = slugify(base);
  if (!s || RESERVED.has(s)) s = 'card-' + Math.random().toString(36).slice(2, 7);
  let candidate = s; let i = 2;
  while (db.prepare('SELECT id FROM cards WHERE slug = ? AND id != ?').get(candidate, excludeId)) candidate = `${s}-${i++}`;
  return candidate;
}

function serializeCard(c, withLinks = true) {
  const out = {
    ...c,
    is_active: !!c.is_active,
    banner_url: fileUrl(c.banner),
    avatar_url: fileUrl(c.avatar),
    public_url: cardUrl(c.slug),
  };
  if (withLinks) out.links = db.prepare('SELECT * FROM links WHERE card_id = ? ORDER BY sort_order, id').all(c.id);
  return out;
}

function saveLinks(cardId, links) {
  if (!Array.isArray(links)) return;
  const del = db.prepare('DELETE FROM links WHERE card_id = ?');
  const ins = db.prepare('INSERT INTO links (card_id, platform, label, label_ar, value, url, sort_order, clicks) VALUES (?,?,?,?,?,?,?,?)');
  const old = Object.fromEntries(db.prepare('SELECT id, clicks FROM links WHERE card_id = ?').all(cardId).map((l) => [l.id, l.clicks]));
  db.transaction(() => {
    del.run(cardId);
    links.forEach((l, i) => {
      const platform = PLATFORMS[l.platform] ? l.platform : 'custom';
      const value = String(l.value || '').trim();
      if (!value) return;
      ins.run(cardId, platform, String(l.label || '').trim(), String(l.label_ar || '').trim(), value, buildUrl(platform, value), i, old[l.id] || 0);
    });
  })();
}

const auth = (req, res, next) => {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  try { req.admin = jwt.verify(t, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Unauthorized' }); }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(null, /^image\/(jpe?g|png|webp|gif|heic|heif)$/i.test(f.mimetype)),
});

// ---------- host-based routing: {slug}.teknulugycard.com -> card page ----------
function slugFromHost(host) {
  host = String(host || '').split(':')[0].toLowerCase();
  if (!host.endsWith('.' + BASE_DOMAIN)) return null;
  const sub = host.slice(0, -(BASE_DOMAIN.length + 1));
  if (!sub || sub.includes('.') || RESERVED.has(sub)) return null;
  return sub;
}

function showCard(slug, req, res) {
  const card = db.prepare('SELECT * FROM cards WHERE slug = ? AND is_active = 1').get(slug);
  if (!card) return res.status(404).send(renderNotFound(BASE_DOMAIN));
  db.prepare('UPDATE cards SET views = views + 1 WHERE id = ?').run(card.id);
  const c = serializeCard(card);
  res.set('Cache-Control', 'no-store').send(renderCard(c, { base: `${req.protocol}://${req.get('host')}${req.baseCardPath || ''}` }));
}

app.use((req, res, next) => {
  const slug = slugFromHost(req.get('host'));
  if (!slug) return next();
  req.baseCardPath = '';
  if (req.path === '/' ) return showCard(slug, req, res);
  if (req.path === '/contact.vcf') return sendVcf(slug, res);
  const m = req.path.match(/^\/go\/(\d+)$/);
  if (m) return redirectLink(slug, m[1], res);
  return next();
});

async function sendVcf(slug, res) {
  const card = db.prepare('SELECT * FROM cards WHERE slug = ? AND is_active = 1').get(slug);
  if (!card) return res.status(404).end();
  const c = serializeCard(card);
  const body = await buildVCard(c, cardUrl(slug), card.avatar ? path.join(UPLOAD_DIR, card.avatar) : null);
  res.set('Content-Type', 'text/vcard; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${slug}.vcf"`);
  res.send(body);
}

function redirectLink(slug, linkId, res) {
  const link = db.prepare('SELECT l.* FROM links l JOIN cards c ON c.id = l.card_id WHERE l.id = ? AND c.slug = ?').get(linkId, slug);
  if (!link) return res.status(404).end();
  db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(link.id);
  res.redirect(302, link.url);
}

// Path-based fallback (works before wildcard DNS/SSL is ready): https://teknulugycard.com/eslam
app.get('/c/:slug', (req, res) => { req.baseCardPath = `/c/${req.params.slug}`; showCard(req.params.slug, req, res); });
app.get('/c/:slug/contact.vcf', (req, res) => sendVcf(req.params.slug, res));
app.get('/c/:slug/go/:id', (req, res) => redirectLink(req.params.slug, req.params.id, res));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

// ---------- API ----------
const api = express.Router();
api.use(corsMw);

api.get('/health', (req, res) => res.json({ ok: true }));

api.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!admin || !bcrypt.compareSync(String(password || ''), admin.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, admin: { id: admin.id, email: admin.email } });
});

api.get('/auth/me', auth, (req, res) => res.json({ admin: req.admin }));

api.post('/auth/password', auth, (req, res) => {
  const { current, next: nextPass } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!admin || !bcrypt.compareSync(String(current || ''), admin.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (String(nextPass || '').length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(nextPass, 10), admin.id);
  res.json({ ok: true });
});

api.get('/platforms', (req, res) => res.json({ platforms: publicList(), base_domain: BASE_DOMAIN }));

api.get('/stats', auth, (req, res) => {
  const s = db.prepare('SELECT COUNT(*) cards, COALESCE(SUM(views),0) views, SUM(is_active) active FROM cards').get();
  const clicks = db.prepare('SELECT COALESCE(SUM(clicks),0) c FROM links').get().c;
  res.json({ ...s, clicks });
});

api.get('/slug-check', auth, (req, res) => {
  const slug = slugify(req.query.slug);
  const exclude = Number(req.query.exclude || 0);
  const taken = !!db.prepare('SELECT id FROM cards WHERE slug = ? AND id != ?').get(slug, exclude);
  res.json({ slug, valid: validSlug(slug), available: validSlug(slug) && !taken, suggestion: uniqueSlug(slug || req.query.slug, exclude) });
});

api.get('/cards', auth, (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const rows = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM links WHERE card_id = c.id) link_count,
    (SELECT COALESCE(SUM(clicks),0) FROM links WHERE card_id = c.id) clicks
    FROM cards c WHERE full_name LIKE ? OR slug LIKE ? OR phone LIKE ? ORDER BY c.id DESC`).all(q, q, q);
  res.json({ cards: rows.map((c) => serializeCard(c, false)) });
});

api.get('/cards/:id', auth, (req, res) => {
  const c = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ card: serializeCard(c) });
});

function readCardBody(b) {
  return {
    full_name: String(b.full_name || '').trim(),
    title: String(b.title || '').trim(),
    company: String(b.company || '').trim(),
    bio: String(b.bio || '').trim().slice(0, 500),
    phone: b.phone ? normalizePhone(b.phone) : '',
    email: String(b.email || '').trim(),
    theme_color: /^#[0-9a-f]{6}$/i.test(b.theme_color || '') ? b.theme_color : '#0f172a',
    is_active: b.is_active === false ? 0 : 1,
  };
}

api.post('/cards', auth, (req, res) => {
  try {
    const d = readCardBody(req.body || {});
    if (!d.full_name) return res.status(400).json({ error: 'Name is required' });
    let slug = slugify(req.body.slug);
    if (slug) {
      if (!validSlug(slug)) return res.status(400).json({ error: 'Invalid link name (letters, numbers, dashes)' });
      if (db.prepare('SELECT id FROM cards WHERE slug = ?').get(slug)) return res.status(409).json({ error: 'This link name is already taken' });
    } else slug = uniqueSlug(d.full_name);
    const r = db.prepare(`INSERT INTO cards (slug, full_name, title, company, bio, phone, email, theme_color, is_active)
      VALUES (@slug,@full_name,@title,@company,@bio,@phone,@email,@theme_color,@is_active)`).run({ ...d, slug });
    saveLinks(r.lastInsertRowid, req.body.links);
    res.status(201).json({ card: serializeCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(r.lastInsertRowid)) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

api.put('/cards/:id', auth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const d = readCardBody(req.body || {});
    if (!d.full_name) return res.status(400).json({ error: 'Name is required' });
    let slug = req.body.slug ? slugify(req.body.slug) : existing.slug;
    if (!validSlug(slug)) return res.status(400).json({ error: 'Invalid link name (letters, numbers, dashes)' });
    if (db.prepare('SELECT id FROM cards WHERE slug = ? AND id != ?').get(slug, id)) return res.status(409).json({ error: 'This link name is already taken' });
    db.prepare(`UPDATE cards SET slug=@slug, full_name=@full_name, title=@title, company=@company, bio=@bio, phone=@phone,
      email=@email, theme_color=@theme_color, is_active=@is_active, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...d, slug, id });
    saveLinks(id, req.body.links);
    res.json({ card: serializeCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(id)) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

api.delete('/cards/:id', auth, (req, res) => {
  const c = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM cards WHERE id = ?').run(c.id);
  [c.banner, c.avatar].filter(Boolean).forEach((f) => fs.rm(path.join(UPLOAD_DIR, f), () => {}));
  res.json({ ok: true });
});

// Image uploads: kind = banner (1200x600 cover) | avatar (512x512)
api.post('/cards/:id/:kind', auth, upload.single('image'), async (req, res) => {
  if (!['banner', 'avatar'].includes(req.params.kind)) return res.status(404).json({ error: 'Not found' });
  try {
    const c = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'Please upload an image (jpg, png, webp)' });
    const kind = req.params.kind;
    const name = `${kind}-${c.id}-${Date.now()}.webp`;
    const img = sharp(req.file.buffer).rotate();
    if (kind === 'banner') await img.resize(1200, 600, { fit: 'cover' }).webp({ quality: 82 }).toFile(path.join(UPLOAD_DIR, name));
    else await img.resize(512, 512, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(UPLOAD_DIR, name));
    if (c[kind]) fs.rm(path.join(UPLOAD_DIR, c[kind]), () => {});
    db.prepare(`UPDATE cards SET ${kind} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(name, c.id);
    res.json({ card: serializeCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(c.id)) });
  } catch (e) { res.status(400).json({ error: 'Could not process image: ' + e.message }); }
});

api.delete('/cards/:id/:kind', auth, (req, res) => {
  if (!['banner', 'avatar'].includes(req.params.kind)) return res.status(404).json({ error: 'Not found' });
  const c = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const kind = req.params.kind;
  if (c[kind]) fs.rm(path.join(UPLOAD_DIR, c[kind]), () => {});
  db.prepare(`UPDATE cards SET ${kind} = '' WHERE id = ?`).run(c.id);
  res.json({ card: serializeCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(c.id)) });
});

app.use('/api', api);

// Root domain landing
app.get('/', (req, res) => res.send(renderNotFound(BASE_DOMAIN, true)));
app.use((req, res) => res.status(404).send(renderNotFound(BASE_DOMAIN)));

app.listen(PORT, '127.0.0.1', () => console.log(`teknulugycard backend on :${PORT} (base domain ${BASE_DOMAIN})`));
