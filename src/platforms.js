// Supported link platforms. `build` turns what the admin typed (username, number or full URL)
// into the final destination URL.
const icons = require('./icons.json');

const strip = (v) => String(v || '').trim();
const isUrl = (v) => /^https?:\/\//i.test(v);
const handle = (v) => strip(v).replace(/^@/, '').replace(/\/+$/, '');
const fromHandle = (base) => (v) => (isUrl(strip(v)) ? strip(v) : base + handle(v));

// Kuwait-friendly phone normalization: 8 local digits -> +965
function normalizePhone(v) {
  let p = strip(v).replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (/^\d{8}$/.test(p)) p = '+965' + p;
  if (!p.startsWith('+') && p.length > 8) p = '+' + p;
  return p;
}

const PLATFORMS = {
  instagram: { label: 'Instagram', placeholder: '@username or URL', build: fromHandle('https://instagram.com/') },
  tiktok: { label: 'TikTok', placeholder: '@username or URL', build: (v) => (isUrl(strip(v)) ? strip(v) : 'https://www.tiktok.com/@' + handle(v)) },
  snapchat: { label: 'Snapchat', placeholder: 'username or URL', build: fromHandle('https://www.snapchat.com/add/') },
  x: { label: 'X (Twitter)', placeholder: '@username or URL', build: fromHandle('https://x.com/') },
  facebook: { label: 'Facebook', placeholder: 'page name or URL', build: fromHandle('https://facebook.com/') },
  linkedin: { label: 'LinkedIn', placeholder: 'profile URL or username', build: fromHandle('https://www.linkedin.com/in/') },
  youtube: { label: 'YouTube', placeholder: '@channel or URL', build: (v) => (isUrl(strip(v)) ? strip(v) : 'https://youtube.com/@' + handle(v)) },
  threads: { label: 'Threads', placeholder: '@username or URL', build: (v) => (isUrl(strip(v)) ? strip(v) : 'https://www.threads.net/@' + handle(v)) },
  telegram: { label: 'Telegram', placeholder: 'username or URL', build: fromHandle('https://t.me/') },
  whatsapp: { label: 'WhatsApp', placeholder: 'phone number e.g. 9xxxxxxx', build: (v) => (isUrl(strip(v)) ? strip(v) : 'https://wa.me/' + normalizePhone(v).replace('+', '')) },
  phone: { label: 'Phone', placeholder: 'phone number', build: (v) => 'tel:' + normalizePhone(v) },
  email: { label: 'Email', placeholder: 'name@example.com', build: (v) => (strip(v).startsWith('mailto:') ? strip(v) : 'mailto:' + strip(v)) },
  website: { label: 'Website', placeholder: 'https://example.com', build: (v) => (isUrl(strip(v)) ? strip(v) : 'https://' + strip(v)) },
  location: { label: 'Location', placeholder: 'Google Maps link or address', build: (v) => (isUrl(strip(v)) ? strip(v) : 'https://maps.google.com/?q=' + encodeURIComponent(strip(v))) },
  pinterest: { label: 'Pinterest', placeholder: 'username or URL', build: fromHandle('https://pinterest.com/') },
  github: { label: 'GitHub', placeholder: 'username or URL', build: fromHandle('https://github.com/') },
  behance: { label: 'Behance', placeholder: 'username or URL', build: fromHandle('https://www.behance.net/') },
  custom: { label: 'Custom link', placeholder: 'https://…', build: (v) => (isUrl(strip(v)) ? strip(v) : 'https://' + strip(v)) },
};

function iconFor(platform) {
  return icons[platform] || icons[platform === 'custom' ? 'link' : 'link'];
}

function buildUrl(platform, value) {
  const p = PLATFORMS[platform] || PLATFORMS.custom;
  const url = p.build(value);
  // Only allow safe schemes
  if (!/^(https?:|tel:|mailto:)/i.test(url)) throw new Error('Invalid link');
  return url;
}

function publicList() {
  return Object.entries(PLATFORMS).map(([key, p]) => ({
    key, label: p.label, placeholder: p.placeholder, icon: iconFor(key),
  }));
}

module.exports = { PLATFORMS, buildUrl, iconFor, publicList, normalizePhone };
