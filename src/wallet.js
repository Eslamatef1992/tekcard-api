// Apple Wallet (.pkpass) generation for TekCard cards.
// Certificates are read from WALLET_CERT_DIR (see README "Apple Wallet"):
//   signerCert.pem  – Pass Type ID certificate
//   signerKey.pem   – its private key
//   wwdr.pem        – Apple WWDR intermediate (G4)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PKPass } = require('passkit-generator');

const CERT_DIR = process.env.WALLET_CERT_DIR || '/root/.secrets/tekcard-wallet';
const PASS_TYPE_ID = process.env.WALLET_PASS_TYPE_ID || '';
const TEAM_ID = process.env.WALLET_TEAM_ID || '';
const ORG_NAME = process.env.WALLET_ORG_NAME || 'Teknulugy';

let certs = null;
let certError = '';

function loadCerts() {
  if (certs) return certs;
  try {
    if (!PASS_TYPE_ID || !TEAM_ID) throw new Error('WALLET_PASS_TYPE_ID / WALLET_TEAM_ID not set in .env');
    const read = (f) => fs.readFileSync(path.join(CERT_DIR, f));
    certs = {
      wwdr: read('wwdr.pem'),
      signerCert: read('signerCert.pem'),
      signerKey: read('signerKey.pem'),
      signerKeyPassphrase: process.env.WALLET_KEY_PASSPHRASE || undefined,
    };
    certError = '';
    return certs;
  } catch (e) {
    certError = e.code === 'ENOENT' ? `Missing certificate file: ${e.path}` : e.message;
    return null;
  }
}

function walletStatus() {
  const ok = !!loadCerts();
  return { configured: ok, error: ok ? '' : certError, pass_type_id: PASS_TYPE_ID };
}

// "#0f172a" -> "rgb(15, 23, 42)"
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = parseInt(m ? m[1] : '0f172a', 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function initialsSvg(text, color, size) {
  const t = String(text || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" rx="${size * 0.22}" fill="${color}"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
      font-weight="700" font-size="${size * 0.42}" fill="#fff">${t.replace(/[<&>]/g, '')}</text></svg>`);
}

async function png(input, w, h) {
  return sharp(input).resize(w, h, { fit: 'cover' }).png().toBuffer();
}

/**
 * @param {object} c       serialized card (with links)
 * @param {string} cardUrl public URL of the card
 * @param {string} uploadDir folder with avatar/banner files
 */
async function buildPass(c, cardUrl, uploadDir) {
  const certificates = loadCerts();
  if (!certificates) throw new Error(certError || 'Apple Wallet is not configured');

  const color = /^#[0-9a-f]{6}$/i.test(c.theme_color) ? c.theme_color : '#0f172a';
  const avatarFile = c.avatar ? path.join(uploadDir, c.avatar) : null;
  const iconSrc = avatarFile && fs.existsSync(avatarFile) ? avatarFile : initialsSvg(c.full_name, color, 180);

  const files = {
    'icon.png': await png(iconSrc, 29, 29),
    'icon@2x.png': await png(iconSrc, 58, 58),
    'icon@3x.png': await png(iconSrc, 87, 87),
    'thumbnail.png': await png(iconSrc, 90, 90),
    'thumbnail@2x.png': await png(iconSrc, 180, 180),
  };

  const backFields = [];
  if (c.phone) backFields.push({ key: 'back_phone', label: 'Phone', value: c.phone, dataDetectorTypes: ['PKDataDetectorTypePhoneNumber'] });
  if (c.email) backFields.push({ key: 'back_email', label: 'Email', value: c.email });
  (c.links || []).filter((l) => /^https?:/.test(l.url)).slice(0, 12).forEach((l, i) => {
    backFields.push({ key: `link${i}`, label: l.label || l.platform.replace(/^\w/, (x) => x.toUpperCase()), value: l.url, dataDetectorTypes: ['PKDataDetectorTypeLink'] });
  });
  backFields.push({ key: 'card', label: 'Digital card', value: cardUrl, dataDetectorTypes: ['PKDataDetectorTypeLink'] });
  if (c.bio) backFields.push({ key: 'bio', label: 'About', value: c.bio });

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    teamIdentifier: TEAM_ID,
    organizationName: ORG_NAME,
    serialNumber: `tekcard-${c.id}`,
    description: `${c.full_name} – digital business card`,
    logoText: c.company || ORG_NAME,
    backgroundColor: rgb(color),
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(203, 213, 225)',
    sharingProhibited: false,
    generic: {
      primaryFields: [{ key: 'name', label: c.title ? c.title.toUpperCase() : 'NAME', value: c.full_name }],
      secondaryFields: [
        ...(c.company ? [{ key: 'company', label: 'COMPANY', value: c.company }] : []),
        ...(c.phone ? [{ key: 'phone', label: 'PHONE', value: c.phone }] : []),
      ],
      auxiliaryFields: c.email ? [{ key: 'email', label: 'EMAIL', value: c.email }] : [],
      backFields,
    },
    barcodes: [{ format: 'PKBarcodeFormatQR', message: cardUrl, messageEncoding: 'iso-8859-1', altText: cardUrl.replace(/^https:\/\//, '') }],
  };

  const pass = new PKPass({ ...files, 'pass.json': Buffer.from(JSON.stringify(passJson)) }, certificates);
  return pass.getAsBuffer();
}

module.exports = { buildPass, walletStatus };
