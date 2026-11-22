const sharp = require('sharp');
const { iconFor } = require('./platforms');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (platform, size = 22, color) => {
  const i = iconFor(platform);
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="${color || '#' + i.hex}" d="${i.path}"/></svg>`;
};
const PLATFORM_NAMES = {
  instagram: 'Instagram', tiktok: 'TikTok', snapchat: 'Snapchat', x: 'X', facebook: 'Facebook', linkedin: 'LinkedIn',
  youtube: 'YouTube', threads: 'Threads', telegram: 'Telegram', whatsapp: 'WhatsApp', phone: 'Call', email: 'Email',
  website: 'Website', location: 'Location', pinterest: 'Pinterest', github: 'GitHub', behance: 'Behance', custom: 'Link',
};
const PLATFORM_NAMES_AR = {
  instagram: 'انستقرام', tiktok: 'تيك توك', snapchat: 'سناب شات', x: 'إكس (تويتر)', facebook: 'فيسبوك', linkedin: 'لينكدإن',
  youtube: 'يوتيوب', threads: 'ثريدز', telegram: 'تيليجرام', whatsapp: 'واتساب', phone: 'اتصال', email: 'البريد الإلكتروني',
  website: 'الموقع الإلكتروني', location: 'الموقع على الخريطة', pinterest: 'بنترست', github: 'جيت هب', behance: 'بيهانس', custom: 'رابط',
};
// English + Arabic text for a button: custom text wins, otherwise the platform name
function labels(l) {
  const en = l.label || PLATFORM_NAMES[l.platform] || 'Link';
  const ar = l.label_ar || (l.label ? l.label : PLATFORM_NAMES_AR[l.platform] || 'رابط');
  return `<span class="lt" data-en="${esc(en)}" data-ar="${esc(ar)}">${esc(en)}</span>`;
}

function renderCard(c, { base, wallet = false }) {
  const color = c.theme_color || '#0f172a';
  const phone = c.phone || '';
  const waNum = phone.replace(/[^\d]/g, '');
  const initials = c.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const subtitle = [c.title, c.company].filter(Boolean).join(' · ');

  const links = (c.links || []).map((l) => {
    // Phone links open the same action sheet as the main phone button
    if (l.platform === 'phone') {
      return `<button class="link" data-phone="${esc(l.url.replace('tel:', ''))}">
        <span class="ic">${svg('phone')}</span>${labels(l)}<span class="ar">›</span></button>`;
    }
    return `<a class="link" href="${esc(base)}/go/${l.id}" ${/^https?:/.test(l.url) ? 'target="_blank" rel="noopener"' : ''}>
      <span class="ic">${svg(l.platform)}</span>${labels(l)}<span class="ar">›</span></a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.full_name)}</title>
<meta name="description" content="${esc(subtitle || c.bio || c.full_name)}">
<meta property="og:title" content="${esc(c.full_name)}">
<meta property="og:description" content="${esc(subtitle || c.bio || '')}">
${c.banner_url ? `<meta property="og:image" content="${esc(c.banner_url)}">` : ''}
<meta name="theme-color" content="${esc(color)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--c:${color};--bg:#f1f5f9;--card:#fff;--ink:#0f172a;--mute:#64748b;--line:#e2e8f0}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:Inter,Tajawal,system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh}
html[dir=rtl] body{font-family:Tajawal,Inter,system-ui,sans-serif}
.wrap{max-width:480px;margin:0 auto;background:var(--card);min-height:100vh;box-shadow:0 0 40px rgba(15,23,42,.06);padding-bottom:110px}
.banner{aspect-ratio:2/1;background:linear-gradient(135deg,var(--c),#334155);background-size:cover;background-position:center}
.head{text-align:center;padding:0 24px;margin-top:-56px;position:relative;z-index:1}
.avatar{width:112px;height:112px;border-radius:50%;border:5px solid #fff;background:var(--c);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;object-fit:cover;box-shadow:0 6px 20px rgba(15,23,42,.15)}
h1{font-size:24px;font-weight:700;margin-top:12px;letter-spacing:-.01em}
.sub{color:var(--mute);margin-top:4px;font-size:15px}
.bio{color:#334155;margin-top:12px;font-size:15px;line-height:1.55;white-space:pre-line}
.quick{display:flex;gap:10px;justify-content:center;margin:22px 24px 0}
.qb{flex:1;max-width:130px;border:0;border-radius:14px;padding:12px 8px;background:#f8fafc;border:1px solid var(--line);color:var(--ink);font:inherit;font-size:13px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;text-decoration:none}
.qb:active{transform:scale(.97)}
.links{padding:22px 20px 0;display:flex;flex-direction:column;gap:10px}
.link{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:#fff;border:1px solid var(--line);text-decoration:none;color:var(--ink);font:inherit;font-weight:600;font-size:15px;cursor:pointer;width:100%;text-align:start;transition:.15s}
.link:hover{border-color:var(--c);box-shadow:0 4px 14px rgba(15,23,42,.06)}
.link .ic{width:40px;height:40px;border-radius:12px;background:#f8fafc;display:flex;align-items:center;justify-content:center;flex:none}
.link .lt{flex:1}.link .ar{color:#94a3b8;font-size:22px}
html[dir=rtl] .link .ar{transform:scaleX(-1)}
.save{position:fixed;left:50%;transform:translateX(-50%);bottom:max(18px,env(safe-area-inset-bottom));width:calc(100% - 40px);max-width:440px;border:0;border-radius:16px;padding:16px;background:var(--c);color:#fff;font:inherit;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 10px 30px rgba(15,23,42,.25);cursor:pointer;text-decoration:none;z-index:5}
.lang{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.9);border:0;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
html[dir=rtl] .lang{right:auto;left:14px}
.top{position:relative}
.wallet{display:flex;justify-content:center;margin-top:18px}
.wallet[hidden]{display:none}
.wallet-btn{display:inline-flex;align-items:center;gap:10px;background:#000;color:#fff;text-decoration:none;border-radius:12px;padding:10px 18px;min-width:200px;justify-content:center}
.wallet-btn small{display:block;font-size:11px;line-height:1.1;opacity:.9}.wallet-btn b{display:block;font-size:18px;line-height:1.15;font-weight:600;letter-spacing:-.01em}
html[dir=rtl] .wallet-btn span{text-align:right}
.foot{text-align:center;color:#94a3b8;font-size:12px;margin-top:28px}
.foot a{color:inherit}
/* action sheet */
.sheet-bg{position:fixed;inset:0;background:rgba(15,23,42,.45);opacity:0;pointer-events:none;transition:.2s;z-index:10}
.sheet{position:fixed;left:50%;bottom:0;transform:translate(-50%,105%);width:100%;max-width:480px;background:#fff;border-radius:22px 22px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));transition:transform .25s cubic-bezier(.2,.8,.2,1);z-index:11}
.open .sheet-bg{opacity:1;pointer-events:auto}.open .sheet{transform:translate(-50%,0)}
.grab{width:40px;height:5px;border-radius:9px;background:#cbd5e1;margin:0 auto 14px}
.sheet h3{text-align:center;font-size:16px}.sheet .num{text-align:center;color:var(--mute);direction:ltr;margin:4px 0 16px}
.opt{display:flex;align-items:center;gap:14px;width:100%;padding:15px;border-radius:14px;border:1px solid var(--line);background:#fff;font:inherit;font-size:16px;font-weight:600;color:var(--ink);text-decoration:none;margin-bottom:10px;cursor:pointer}
.opt .ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center}
.cancel{width:100%;padding:14px;border:0;background:none;font:inherit;font-weight:600;color:var(--mute);cursor:pointer}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="banner" ${c.banner_url ? `style="background-image:url('${esc(c.banner_url)}')"` : ''}></div>
    <button class="lang" id="lang">عربي</button>
  </div>
  <div class="head">
    ${c.avatar_url ? `<img class="avatar" src="${esc(c.avatar_url)}" alt="">` : `<div class="avatar">${esc(initials)}</div>`}
    <h1>${esc(c.full_name)}</h1>
    ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
    ${c.bio ? `<p class="bio">${esc(c.bio)}</p>` : ''}
  </div>
  ${phone ? `<div class="quick">
    <button class="qb" data-phone="${esc(phone)}">${svg('phone', 22)}<span data-t="call">Call</span></button>
    <a class="qb" href="https://wa.me/${esc(waNum)}" target="_blank" rel="noopener">${svg('whatsapp', 22)}<span data-t="whatsapp">WhatsApp</span></a>
    <a class="qb" href="${esc(base)}/contact.vcf"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg><span data-t="save">Save</span></a>
  </div>` : ''}
  <div class="links">${links}</div>
  ${wallet ? `<div class="wallet" id="walletWrap" hidden>
    <a class="wallet-btn" href="${esc(base)}/wallet.pkpass">
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true"><rect x="1" y="1" width="24" height="18" rx="4" fill="#fff"/><rect x="1" y="5" width="24" height="4" fill="#34c759"/><rect x="1" y="9" width="24" height="4" fill="#ff9500"/><rect x="1" y="13" width="24" height="3" fill="#ff3b30"/></svg>
      <span><small data-t="addTo">Add to</small><b>Apple Wallet</b></span>
    </a>
  </div>` : ''}
  <div class="foot"><span data-t="powered">Powered by</span> <a href="https://teknulugy.com" target="_blank" rel="noopener">Teknulugy</a></div>
</div>

<a class="save" href="${esc(base)}/contact.vcf">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
  <span data-t="saveContact">Save Contact</span>
</a>

<div id="sheetRoot">
  <div class="sheet-bg" id="sheetBg"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="grab"></div>
    <h3 data-t="choose">How would you like to connect?</h3>
    <div class="num" id="sheetNum"></div>
    <a class="opt" id="optSave" href="${esc(base)}/contact.vcf"><span class="ic" style="background:#eef2ff"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></span><span data-t="saveContact">Save Contact</span></a>
    <a class="opt" id="optCall" href="#"><span class="ic" style="background:#dcfce7">${svg('phone', 22)}</span><span data-t="call">Call</span></a>
    <a class="opt" id="optWa" href="#" target="_blank" rel="noopener"><span class="ic" style="background:#dcfce7">${svg('whatsapp', 22)}</span><span data-t="wa">Message on WhatsApp</span></a>
    <button class="cancel" id="sheetCancel" data-t="cancel">Cancel</button>
  </div>
</div>

<script>
(function(){
  var T={en:{whatsapp:'WhatsApp',call:'Call',save:'Save',saveContact:'Save Contact',choose:'How would you like to connect?',wa:'Message on WhatsApp',cancel:'Cancel',powered:'Powered by',addTo:'Add to',lang:'عربي'},
         ar:{whatsapp:'واتساب',call:'اتصال',save:'حفظ',saveContact:'حفظ جهة الاتصال',choose:'كيف تحب التواصل؟',wa:'مراسلة على واتساب',cancel:'إلغاء',powered:'بواسطة',addTo:'أضف إلى',lang:'English'}};
  var lang=(localStorage.getItem('tc_lang')||(navigator.language||'en')).slice(0,2)==='ar'?'ar':'en';
  function apply(){document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.querySelectorAll('[data-t]').forEach(function(e){var k=e.getAttribute('data-t');if(T[lang][k])e.textContent=T[lang][k]});
    document.querySelectorAll('[data-en]').forEach(function(e){e.textContent=e.getAttribute('data-'+lang)||e.getAttribute('data-en')});
    document.getElementById('lang').textContent=T[lang].lang;}
  try{apply()}catch(e){}
  document.getElementById('lang').onclick=function(){lang=lang==='ar'?'en':'ar';try{localStorage.setItem('tc_lang',lang)}catch(e){}apply()};

  // Apple Wallet button only on Apple devices (iPhone, iPad, Mac Safari)
  var ww=document.getElementById('walletWrap');
  if(ww&&/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent))ww.hidden=false;

  var root=document.getElementById('sheetRoot');
  function open(num){var d=num.replace(/[^\\d]/g,'');
    document.getElementById('sheetNum').textContent=num;
    document.getElementById('optCall').href='tel:'+num;
    document.getElementById('optWa').href='https://wa.me/'+d;
    root.classList.add('open');}
  function close(){root.classList.remove('open')}
  document.querySelectorAll('[data-phone]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();open(b.getAttribute('data-phone'))})});
  document.getElementById('sheetBg').onclick=close;document.getElementById('sheetCancel').onclick=close;
  ${phone ? `// Popup on scan: ask how to connect as soon as the card opens
  if(!sessionStorage.getItem('tc_seen_${esc(c.slug)}')){try{sessionStorage.setItem('tc_seen_${esc(c.slug)}','1')}catch(e){}setTimeout(function(){open(${JSON.stringify(phone)})},600)}` : ''}
})();
</script>
</body>
</html>`;
}

function renderNotFound(domain, landing = false) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${landing ? 'Teknulugy Card' : 'Card not found'}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f1f5f9;color:#0f172a;text-align:center;padding:24px}
h1{font-size:22px}p{color:#64748b}</style></head><body><div>
<h1>${landing ? 'Teknulugy Smart Cards' : 'This card is not available'}</h1>
<p>${landing ? 'Tap an NFC card to view a profile.' : 'The link may be wrong or the card is disabled.'}</p>
<p><a href="https://teknulugy.com">teknulugy.com</a></p></div></body></html>`;
}

const vEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

async function buildVCard(c, url, avatarPath) {
  const parts = c.full_name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : '';
  const first = parts.join(' ');
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N;CHARSET=UTF-8:${vEsc(last)};${vEsc(first)};;;`,
    `FN;CHARSET=UTF-8:${vEsc(c.full_name)}`,
  ];
  if (c.company) lines.push(`ORG;CHARSET=UTF-8:${vEsc(c.company)}`);
  if (c.title) lines.push(`TITLE;CHARSET=UTF-8:${vEsc(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
  const emails = new Set([c.email, ...(c.links || []).filter((l) => l.platform === 'email').map((l) => l.url.replace('mailto:', ''))].filter(Boolean));
  emails.forEach((e) => lines.push(`EMAIL;TYPE=INTERNET:${vEsc(e)}`));
  (c.links || []).filter((l) => l.platform === 'phone').forEach((l) => {
    const n = l.url.replace('tel:', ''); if (n !== c.phone) lines.push(`TEL;TYPE=WORK:${n}`);
  });
  lines.push(`URL:${url}`);
  (c.links || []).filter((l) => /^https?:/.test(l.url)).forEach((l) => lines.push(`URL;TYPE=${l.platform}:${l.url}`));
  if (c.bio) lines.push(`NOTE;CHARSET=UTF-8:${vEsc(c.bio)}`);
  if (avatarPath) {
    try {
      const b64 = (await sharp(avatarPath).resize(256, 256).jpeg({ quality: 80 }).toBuffer()).toString('base64');
      lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${b64}`);
    } catch { /* ignore photo errors */ }
  }
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

module.exports = { renderCard, renderNotFound, buildVCard };
