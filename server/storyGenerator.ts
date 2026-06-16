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
 * Returns a PNG buffer.
 */
export async function generateCategoryStory(
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
        ctx.fillText('·', dotX, itemY);
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
    ctx.fillText(`+ ${category.items.length - maxItems} itens no cardápio completo`, WIDTH / 2, moreY);
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
  ctx.fillText('Rochdale — Osasco/SP', WIDTH / 2, footerY);
  
  ctx.font = '400 20px Montserrat';
  ctx.fillText('@abrasareune', WIDTH / 2, footerY + 35);

  // Diamond separator above footer
  ctx.font = '400 28px Montserrat';
  ctx.fillStyle = COLORS.primary;
  ctx.fillText('◆', WIDTH / 2, footerY - 40);

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
