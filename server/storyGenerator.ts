import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import path from 'path';
import { ENV } from './_core/env';

// Register fonts
const fontsDir = path.join(process.cwd(), 'server/fonts');
try {
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Montserrat-Variable.ttf'), 'Montserrat');
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Montserrat-Italic-Variable.ttf'), 'Montserrat Italic');
} catch (e) {
  console.warn('[StoryGenerator] Could not register fonts:', e);
}

// Story dimensions (Instagram Story: 1080x1920)
const WIDTH = 1080;
const HEIGHT = 1920;

// Color palette matching the cardápio
const COLORS = {
  background: '#FAF5EF',    // Cream
  darkBg: '#2C2C2C',        // Dark sections
  primary: '#E87A2F',       // Orange accent
  text: '#2C2C2C',          // Dark text
  textLight: '#4A3728',     // Brown text
  textMuted: '#4A3728AA',   // Muted brown
  white: '#FFFFFF',
  gold: '#D4A017',
};

// Copa do Mundo assets
const COPA_TROPHY_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/copa-trophy-detailed-DDvEwbgptcEhQ9w8RMJLJL.webp';

// Country flag mapping for Copa items
const COUNTRY_FLAGS: Record<string, string> = {
  'USA': 'flag-usa-pixel-perfect_ce6ab58f.png',
  'EUA': 'flag-usa-pixel-perfect_ce6ab58f.png',
  'MEXICO': 'flag-mexico-hq_c61e7666.png',
  'MÉXICO': 'flag-mexico-hq_c61e7666.png',
  'CANADA': 'flag-canada-hq_cda37091.png',
  'CANADÁ': 'flag-canada-hq_cda37091.png',
};

function getCountryFlagKey(itemName: string): string | null {
  const nameUpper = itemName.toUpperCase();
  for (const [country, flagPath] of Object.entries(COUNTRY_FLAGS)) {
    if (nameUpper.includes(country)) return flagPath;
  }
  return null;
}

async function resolveStorageUrl(key: string): Promise<string | undefined> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return undefined;
  try {
    const forgeUrl = new URL('v1/storage/presign/get', ENV.forgeApiUrl.replace(/\/+$/, '') + '/');
    forgeUrl.searchParams.set('path', key);
    const resp = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });
    if (!resp.ok) return undefined;
    const { url } = (await resp.json()) as { url: string };
    return url || undefined;
  } catch {
    return undefined;
  }
}

/** Wrap text to multiple lines within maxWidth, returns array of lines */
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

interface MenuItem {
  id: number;
  name: string;
  price: number | null;
  description: string | null;
}

interface CategoryData {
  name: string;
  displayName: string;
  items: MenuItem[];
  sectionStyle?: string;
}

/**
 * Generate a Story image (1080x1920) for a single category.
 * Routes to combined Burgers+Copa layout when sectionStyle is 'burgers_copa'.
 * Returns a PNG buffer.
 */
export async function generateCategoryStory(
  category: CategoryData,
  logoUrl?: string,
  copaItems?: MenuItem[]
): Promise<Buffer> {
  if (category.sectionStyle === 'burgers_copa') {
    return generateBurgersCopaStory(category, logoUrl, copaItems || []);
  }
  if (category.sectionStyle === 'copa') {
    return generateBurgersCopaStory({ ...category, items: [] }, logoUrl, category.items);
  }
  return generateStandardStory(category, logoUrl);
}

/**
 * Combined Burgers + Copa do Mundo story following the online cardápio layout.
 * Burgers section on top, diamond separator, then Copa do Mundo section with gradient/flags.
 */
async function generateBurgersCopaStory(
  category: CategoryData,
  logoUrl?: string,
  copaItems: MenuItem[] = []
): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Cream background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Top accent bar
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, 0, WIDTH, 8);

  let y = 60;

  // Logo (smaller for combined view)
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoSize = 90;
      ctx.drawImage(logoImg, (WIDTH - logoSize) / 2, y, logoSize, logoSize);
      y += logoSize + 12;
    } catch {
      y += 20;
    }
  } else {
    y += 20;
  }

  // Brand name
  ctx.font = '800 28px Montserrat';
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.fillText('A BRASA RE\u00daNE', WIDTH / 2, y);
  y += 35;

  const burgersItems = category.items;
  const totalItems = burgersItems.length + copaItems.length;

  // Calculate available space for items
  const headerSpace = y;
  const footerSpace = 100;
  const copaHeaderSpace = copaItems.length > 0 ? 70 : 0;
  const separatorSpace = copaItems.length > 0 ? 45 : 0;
  const burgersHeaderSpace = burgersItems.length > 0 ? 45 : 0;
  const availableForItems = HEIGHT - headerSpace - footerSpace - copaHeaderSpace - separatorSpace - burgersHeaderSpace;

  // Dynamic item height: ensure descriptions fit (min 80px per item with description)
  const itemHeight = Math.min(Math.max(Math.floor(availableForItems / Math.max(totalItems, 1)), 80), 130);

  // === BURGERS SECTION ===
  if (burgersItems.length > 0) {
    // Section title
    ctx.font = '800 36px Montserrat';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText('BURGERS', 80, y);

    // Orange line after title
    const titleW = ctx.measureText('BURGERS').width;
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80 + titleW + 15, y - 8);
    ctx.lineTo(WIDTH - 80, y - 8);
    ctx.stroke();
    y += 35;

    // Burger items
    for (let i = 0; i < burgersItems.length; i++) {
      const item = burgersItems[i];

      // Item name
      ctx.font = '600 26px Montserrat';
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'left';
      const nameText = item.name.toUpperCase();
      const maxNameWidth = WIDTH - 300;
      let displayName = nameText;
      while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== nameText) displayName += '...';
      ctx.fillText(displayName, 80, y);

      // Price
      if (item.price !== null) {
        ctx.font = '700 26px Montserrat';
        ctx.fillStyle = COLORS.primary;
        ctx.textAlign = 'right';
        ctx.fillText(`R$ ${item.price.toFixed(2).replace('.', ',')}`, WIDTH - 80, y);
        ctx.textAlign = 'left';
      }

      // Dotted line
      ctx.font = '600 26px Montserrat';
      const nw = ctx.measureText(displayName).width;
      ctx.font = '700 26px Montserrat';
      const pw = item.price !== null ? ctx.measureText(`R$ ${item.price.toFixed(2).replace('.', ',')}`).width : 0;
      const ds = 80 + nw + 10;
      const de = WIDTH - 80 - pw - 10;
      if (de > ds + 20) {
        ctx.fillStyle = '#4A372830';
        ctx.font = '400 20px Montserrat';
        let dx = ds;
        while (dx < de) { ctx.fillText('\u00b7', dx, y); dx += 10; }
      }

      // Description (full text with word wrap)
      if (item.description) {
        ctx.font = '400 18px Montserrat';
        ctx.fillStyle = COLORS.textMuted;
        const descLines = wrapText(ctx, item.description, WIDTH - 160);
        for (let l = 0; l < Math.min(descLines.length, 2); l++) {
          y += 22;
          ctx.fillText(descLines[l], 80, y);
        }
      }

      y += itemHeight - (item.description ? 15 : 0);
    }
  }

  // === DIAMOND SEPARATOR ===
  if (burgersItems.length > 0 && copaItems.length > 0) {
    y += 10;
    ctx.font = '400 24px Montserrat';
    ctx.fillStyle = COLORS.primary;
    ctx.textAlign = 'center';
    ctx.fillText('\u25c6', WIDTH / 2, y);
    y += 30;
  }

  // === COPA DO MUNDO SECTION ===
  if (copaItems.length > 0) {
    // Gradient background for Copa section
    const copaStartY = y - 15;
    const copaEndY = HEIGHT - footerSpace;
    const copaGrad = ctx.createLinearGradient(0, copaStartY, 0, copaEndY);
    copaGrad.addColorStop(0, '#FFF8E1');
    copaGrad.addColorStop(0.5, '#FFFDF5');
    copaGrad.addColorStop(1, '#FAF5EF');
    ctx.fillStyle = copaGrad;
    ctx.fillRect(0, copaStartY, WIDTH, copaEndY - copaStartY);

    // Multicolor stripe
    const stripeGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
    stripeGrad.addColorStop(0, '#009B3A');
    stripeGrad.addColorStop(0.25, '#1E88E5');
    stripeGrad.addColorStop(0.5, '#D32F2F');
    stripeGrad.addColorStop(0.75, '#F9A825');
    stripeGrad.addColorStop(1, '#E87A2F');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, copaStartY, WIDTH, 5);
    y += 10;

    // Copa header: trophy + title
    let trophyW = 0;
    try {
      const trophyImg = await loadImage(COPA_TROPHY_URL);
      const trophyH = 50;
      trophyW = trophyH * (trophyImg.width / trophyImg.height);
      ctx.drawImage(trophyImg, 80, y - 15, trophyW, trophyH);
    } catch { /* skip */ }

    ctx.font = '800 32px Montserrat';
    ctx.fillStyle = '#1A237E';
    ctx.textAlign = 'left';
    ctx.fillText('COPA DO MUNDO', 80 + trophyW + 12, y + 15);

    // Multicolor line after title
    const copaTitle = ctx.measureText('COPA DO MUNDO').width;
    const lineStart = 80 + trophyW + 12 + copaTitle + 15;
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(lineStart, y + 8, WIDTH - 80 - lineStart, 3);
    y += 55;

    // Copa items with flags and cards
    for (let i = 0; i < copaItems.length; i++) {
      const item = copaItems[i];

      // White card background
      const cardH = itemHeight - 8;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.roundRect(60, y - 5, WIDTH - 120, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,55,40,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Flag
      const flagKey = getCountryFlagKey(item.name);
      let flagOffset = 0;
      if (flagKey) {
        try {
          const flagUrl = await resolveStorageUrl(flagKey);
          if (flagUrl) {
            const flagImg = await loadImage(flagUrl);
            const flagW = 48;
            const flagH = 32;
            ctx.drawImage(flagImg, 80, y + (cardH - flagH) / 2 - 5, flagW, flagH);
            flagOffset = flagW + 12;
          }
        } catch { /* skip */ }
      }

      // Item name
      ctx.font = '700 24px Montserrat';
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'left';
      const nameText = item.name.toUpperCase();
      const maxNameWidth = WIDTH - 300 - flagOffset;
      let displayName = nameText;
      while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== nameText) displayName += '...';
      const nameY = y + 20;
      ctx.fillText(displayName, 80 + flagOffset, nameY);

      // Price
      if (item.price !== null) {
        ctx.font = '700 24px Montserrat';
        ctx.fillStyle = COLORS.primary;
        ctx.textAlign = 'right';
        ctx.fillText(`R$ ${item.price.toFixed(2).replace('.', ',')}`, WIDTH - 80, nameY);
        ctx.textAlign = 'left';
      }

      // Description (full with wrap)
      if (item.description) {
        ctx.font = '400 17px Montserrat';
        ctx.fillStyle = COLORS.textMuted;
        const descLines = wrapText(ctx, item.description, WIDTH - 160 - flagOffset);
        for (let l = 0; l < Math.min(descLines.length, 2); l++) {
          ctx.fillText(descLines[l], 80 + flagOffset, nameY + 22 + (l * 19));
        }
      }

      y += cardH + 8;
    }
  }

  // Footer
  const footerY = HEIGHT - 80;
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);

  ctx.font = '400 22px Montserrat';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'center';
  ctx.fillText('Rochdale \u2014 Osasco/SP', WIDTH / 2, footerY);
  ctx.font = '400 20px Montserrat';
  ctx.fillText('@abrasareune', WIDTH / 2, footerY + 35);

  return canvas.toBuffer('image/png');
}

/**
 * Standard story layout for non-Copa categories.
 */
async function generateStandardStory(
  category: CategoryData,
  logoUrl?: string
): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const isDark = category.sectionStyle === 'dark' || category.name === 'PARA COMPARTILHAR';
  const bgColor = isDark ? COLORS.darkBg : COLORS.background;
  const textColor = isDark ? COLORS.white : COLORS.text;
  const mutedColor = isDark ? '#FFFFFFAA' : COLORS.textMuted;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Top accent bar
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, 0, WIDTH, 8);

  let y = 80;

  // Logo
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoSize = 140;
      const logoX = (WIDTH - logoSize) / 2;
      ctx.drawImage(logoImg, logoX, y, logoSize, logoSize);
      y += logoSize + 30;
    } catch (e) {
      console.warn('[StoryGenerator] Could not load logo:', e);
      y += 40;
    }
  } else {
    y += 40;
  }

  // Brand name
  ctx.font = '800 36px Montserrat';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText('A BRASA RE\u00daNE', WIDTH / 2, y);
  y += 20;

  // Subtitle
  ctx.font = '500 22px Montserrat';
  ctx.fillStyle = mutedColor;
  ctx.fillText('Bar & Hamburgueria', WIDTH / 2, y);
  y += 60;

  // Category title with orange line
  const titleText = category.displayName.toUpperCase();
  ctx.font = '800 42px Montserrat';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(titleText, WIDTH / 2, y);
  y += 20;

  // Orange divider line
  const titleWidth = ctx.measureText(titleText).width;
  const lineWidth = Math.min(titleWidth + 60, WIDTH - 160);
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo((WIDTH - lineWidth) / 2, y);
  ctx.lineTo((WIDTH + lineWidth) / 2, y);
  ctx.stroke();
  y += 50;

  // Items - calculate height dynamically to fit descriptions
  const maxItems = Math.min(category.items.length, 16);
  const availableHeight = HEIGHT - y - 180;
  const itemHeight = Math.min(Math.floor(availableHeight / maxItems), 95);

  ctx.textAlign = 'left';

  for (let i = 0; i < maxItems; i++) {
    const item = category.items[i];

    // Item name
    ctx.font = '600 28px Montserrat';
    ctx.fillStyle = textColor;
    const nameText = item.name.toUpperCase();
    const maxNameWidth = WIDTH - 300;
    let displayName = nameText;
    while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== nameText) displayName += '...';
    ctx.fillText(displayName, 80, y);

    // Price
    if (item.price !== null) {
      ctx.font = '700 28px Montserrat';
      ctx.fillStyle = COLORS.primary;
      ctx.textAlign = 'right';
      const priceText = `R$ ${item.price.toFixed(2).replace('.', ',')}`;
      ctx.fillText(priceText, WIDTH - 80, y);
      ctx.textAlign = 'left';
    }

    // Dotted line between name and price
    ctx.font = '600 28px Montserrat';
    const nameWidth = ctx.measureText(displayName).width;
    ctx.font = '700 28px Montserrat';
    const priceWidth = item.price !== null ? ctx.measureText(`R$ ${item.price.toFixed(2).replace('.', ',')}`).width : 0;
    const dotsStart = 80 + nameWidth + 12;
    const dotsEnd = WIDTH - 80 - priceWidth - 12;

    if (dotsEnd > dotsStart + 20) {
      ctx.fillStyle = isDark ? '#FFFFFF40' : '#4A372840';
      ctx.font = '400 22px Montserrat';
      let dotX = dotsStart;
      while (dotX < dotsEnd) {
        ctx.fillText('\u00b7', dotX, y);
        dotX += 10;
      }
    }

    // Description with word wrap (show full text)
    if (item.description && itemHeight > 50) {
      ctx.font = '400 18px Montserrat';
      ctx.fillStyle = mutedColor;
      const descLines = wrapText(ctx, item.description, WIDTH - 160);
      for (let l = 0; l < Math.min(descLines.length, 2); l++) {
        y += 22;
        ctx.fillText(descLines[l], 80, y);
      }
    }

    y += itemHeight - (item.description ? 20 : 0);
  }

  // If there are more items than shown
  if (category.items.length > maxItems) {
    ctx.font = '400 22px Montserrat';
    ctx.fillStyle = mutedColor;
    ctx.textAlign = 'center';
    ctx.fillText(`+ ${category.items.length - maxItems} itens no card\u00e1pio completo`, WIDTH / 2, y + 10);
  }

  // Footer
  const footerY = HEIGHT - 100;

  // Bottom accent bar
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);

  // Footer text
  ctx.font = '400 22px Montserrat';
  ctx.fillStyle = mutedColor;
  ctx.textAlign = 'center';
  ctx.fillText('Rochdale \u2014 Osasco/SP', WIDTH / 2, footerY);

  ctx.font = '400 20px Montserrat';
  ctx.fillText('@abrasareune', WIDTH / 2, footerY + 35);

  // Diamond separator above footer
  ctx.font = '400 28px Montserrat';
  ctx.fillStyle = COLORS.primary;
  ctx.fillText('\u25c6', WIDTH / 2, footerY - 40);

  return canvas.toBuffer('image/png');
}

/**
 * Resolve the logo URL to a fetchable URL for the server.
 */
export async function resolveLogoUrl(): Promise<string | undefined> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return undefined;

  try {
    const forgeUrl = new URL(
      'v1/storage/presign/get',
      ENV.forgeApiUrl.replace(/\/+$/, '') + '/',
    );
    forgeUrl.searchParams.set('path', 'logo-abrasa-circle_54a46a8b.png');
    const resp = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });
    if (!resp.ok) return undefined;
    const { url } = (await resp.json()) as { url: string };
    return url || undefined;
  } catch {
    return undefined;
  }
}
