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
 * Routes to Copa do Mundo special layout when sectionStyle is 'copa'.
 * Returns a PNG buffer.
 */
export async function generateCategoryStory(
  category: CategoryData,
  logoUrl?: string
): Promise<Buffer> {
  if (category.sectionStyle === 'copa') {
    return generateCopaDoMundoStory(category, logoUrl);
  }
  return generateStandardStory(category, logoUrl);
}

/**
 * Copa do Mundo special story with gradient, trophy, flags, and bold styling.
 */
async function generateCopaDoMundoStory(
  category: CategoryData,
  logoUrl?: string
): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Warm gradient background (gold to cream)
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#FFF8E1');
  gradient.addColorStop(0.3, '#FFFDF5');
  gradient.addColorStop(1, '#FAF5EF');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Multicolor gradient stripe at top (Copa 2026 colors)
  const stripeGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
  stripeGrad.addColorStop(0, '#009B3A');
  stripeGrad.addColorStop(0.25, '#1E88E5');
  stripeGrad.addColorStop(0.5, '#D32F2F');
  stripeGrad.addColorStop(0.75, '#F9A825');
  stripeGrad.addColorStop(1, '#E87A2F');
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 0, WIDTH, 12);

  let y = 60;

  // Logo
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoSize = 120;
      ctx.drawImage(logoImg, (WIDTH - logoSize) / 2, y, logoSize, logoSize);
      y += logoSize + 20;
    } catch {
      y += 30;
    }
  } else {
    y += 30;
  }

  // Brand name
  ctx.font = '800 32px Montserrat';
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.fillText('A BRASA RE\u00daNE', WIDTH / 2, y);
  y += 50;

  // Trophy image
  try {
    const trophyImg = await loadImage(COPA_TROPHY_URL);
    const trophyH = 160;
    const trophyW = trophyH * (trophyImg.width / trophyImg.height);
    ctx.drawImage(trophyImg, (WIDTH - trophyW) / 2, y, trophyW, trophyH);
    y += trophyH + 25;
  } catch {
    y += 25;
  }

  // Copa do Mundo title
  ctx.font = '800 48px Montserrat';
  ctx.fillStyle = '#1A237E';
  ctx.textAlign = 'center';
  ctx.fillText('COPA DO MUNDO', WIDTH / 2, y);
  y += 18;

  // Multicolor divider
  const divGrad = ctx.createLinearGradient((WIDTH - 400) / 2, 0, (WIDTH + 400) / 2, 0);
  divGrad.addColorStop(0, '#009B3A');
  divGrad.addColorStop(0.25, '#1E88E5');
  divGrad.addColorStop(0.5, '#D32F2F');
  divGrad.addColorStop(0.75, '#F9A825');
  divGrad.addColorStop(1, '#E87A2F');
  ctx.fillStyle = divGrad;
  ctx.fillRect((WIDTH - 400) / 2, y, 400, 4);
  y += 50;

  // Items with flags
  const maxItems = Math.min(category.items.length, 12);
  const availableHeight = HEIGHT - y - 180;
  const itemHeight = Math.min(Math.floor(availableHeight / maxItems), 110);

  for (let i = 0; i < maxItems; i++) {
    const item = category.items[i];
    const itemY = y + (i * itemHeight);
    const cardH = itemHeight - 14;

    // White card background for each item
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.roundRect(60, itemY - 10, WIDTH - 120, cardH, 12);
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
          const flagW = 56;
          const flagH = 38;
          const flagY = itemY + (cardH - flagH) / 2 - 10;
          ctx.drawImage(flagImg, 85, flagY, flagW, flagH);
          flagOffset = flagW + 15;
        }
      } catch {
        // Skip flag if it can't be loaded
      }
    }

    // Item name
    ctx.font = '700 28px Montserrat';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    const nameText = item.name.toUpperCase();
    const maxNameWidth = WIDTH - 320 - flagOffset;
    let displayName = nameText;
    while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== nameText) displayName += '...';
    const textY = itemY + cardH / 2 - 5;
    ctx.fillText(displayName, 85 + flagOffset, textY);

    // Price
    if (item.price !== null) {
      ctx.font = '700 28px Montserrat';
      ctx.fillStyle = '#D32F2F'; // Red for Copa theme
      ctx.textAlign = 'right';
      const priceText = `R$ ${item.price.toFixed(2).replace('.', ',')}`;
      ctx.fillText(priceText, WIDTH - 85, textY);
      ctx.textAlign = 'left';
    }

    // Description
    if (item.description && itemHeight > 75) {
      ctx.font = '400 20px Montserrat';
      ctx.fillStyle = COLORS.textMuted;
      const descText = item.description.length > 50 ? item.description.slice(0, 47) + '...' : item.description;
      ctx.fillText(descText, 85 + flagOffset, textY + 28);
    }
  }

  // Footer with multicolor stripe
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, HEIGHT - 12, WIDTH, 12);

  const footerY = HEIGHT - 80;
  ctx.font = '500 22px Montserrat';
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

  // Items
  const maxItems = Math.min(category.items.length, 18); // Limit to avoid overflow
  const availableHeight = HEIGHT - y - 180; // Reserve space for footer
  const itemHeight = Math.min(Math.floor(availableHeight / maxItems), 90);

  ctx.textAlign = 'left';

  for (let i = 0; i < maxItems; i++) {
    const item = category.items[i];
    const itemY = y + (i * itemHeight);

    // Item name
    ctx.font = '600 30px Montserrat';
    ctx.fillStyle = textColor;
    const nameText = item.name.toUpperCase();
    const maxNameWidth = WIDTH - 320;
    let displayName = nameText;
    
    // Truncate if too long
    while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== nameText) displayName += '...';
    
    ctx.fillText(displayName, 80, itemY);

    // Price
    if (item.price !== null) {
      ctx.font = '700 30px Montserrat';
      ctx.fillStyle = COLORS.primary;
      ctx.textAlign = 'right';
      const priceText = `R$ ${item.price.toFixed(2).replace('.', ',')}`;
      ctx.fillText(priceText, WIDTH - 80, itemY);
      ctx.textAlign = 'left';
    }

    // Dotted line between name and price
    const nameWidth = ctx.measureText(displayName).width;
    const priceWidth = item.price !== null ? ctx.measureText(`R$ ${item.price.toFixed(2).replace('.', ',')}`).width : 0;
    const dotsStart = 80 + nameWidth + 15;
    const dotsEnd = WIDTH - 80 - priceWidth - 15;
    
    if (dotsEnd > dotsStart + 20) {
      ctx.fillStyle = isDark ? '#FFFFFF40' : '#4A372840';
      ctx.font = '400 24px Montserrat';
      let dotX = dotsStart;
      while (dotX < dotsEnd) {
        ctx.fillText('\u00b7', dotX, itemY);
        dotX += 12;
      }
    }

    // Description (if available and space allows)
    if (item.description && itemHeight > 55) {
      ctx.font = '400 20px Montserrat';
      ctx.fillStyle = mutedColor;
      const descText = item.description.length > 60 ? item.description.slice(0, 57) + '...' : item.description;
      ctx.fillText(descText, 80, itemY + 30);
    }
  }

  // If there are more items than shown
  if (category.items.length > maxItems) {
    const moreY = y + (maxItems * itemHeight) + 10;
    ctx.font = '400 22px Montserrat';
    ctx.fillStyle = mutedColor;
    ctx.textAlign = 'center';
    ctx.fillText(`+ ${category.items.length - maxItems} itens no card\u00e1pio completo`, WIDTH / 2, moreY);
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
