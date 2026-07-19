const path = require('path');
const sharp = require('sharp');

const CARDS = [
  ['mountain_t2_mini_b.webp', '巡林獵手', '#a855f7'],
  ['ghost_t6_mini_b.webp', '星霧影侯', '#f59e0b'],
  ['exam_t2_boss.webp', '試煉大賢者', '#ef4444'],
  ['insect_t6_mini_b.webp', '神翼斥候', '#f59e0b'],
  ['treasure_t1_normal_b.webp', '木庫寶箱守衛', '#94a3b8'],
  ['temple_t4_boss.webp', '天穹龍皇', '#ef4444'],
];

const VIEWPORTS = [360, 390, 430];
const GAP = 8;
const PADDING = 12;
const HEADER = 58;
const CARD_FOOTER = 27;

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[character]);
}

async function renderViewport(width) {
  const cardWidth = Math.floor((width - PADDING * 2 - GAP * 2) / 3);
  const artHeight = Math.round(cardWidth * 4 / 3);
  const cardHeight = artHeight + CARD_FOOTER;
  const rows = 2;
  const height = HEADER + PADDING + rows * cardHeight + (rows - 1) * GAP + PADDING;
  const composites = [];

  for (let index = 0; index < CARDS.length; index += 1) {
    const [file, label, frame] = CARDS[index];
    const column = index % 3;
    const row = Math.floor(index / 3);
    const left = PADDING + column * (cardWidth + GAP);
    const top = HEADER + PADDING + row * (cardHeight + GAP);
    const art = await sharp(path.join(__dirname, file))
      .resize(cardWidth - 4, artHeight - 4, { fit: 'cover' })
      .png()
      .toBuffer();
    const cardSvg = Buffer.from(`
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="${cardWidth - 2}" height="${cardHeight - 2}" rx="11" fill="#111827" stroke="${frame}" stroke-width="2"/>
        <rect x="2" y="${artHeight - 2}" width="${cardWidth - 4}" height="${CARD_FOOTER}" fill="#020617" fill-opacity=".9"/>
        <text x="7" y="${artHeight + 15}" fill="#f8fafc" font-family="Arial, sans-serif" font-size="10" font-weight="700">${escapeXml(label)}</text>
      </svg>`);
    composites.push({ input: cardSvg, left, top });
    composites.push({ input: art, left: left + 2, top: top + 2 });
  }

  const header = Buffer.from(`
    <svg width="${width}" height="${HEADER}" xmlns="http://www.w3.org/2000/svg">
      <text x="${PADDING}" y="25" fill="#f8fafc" font-family="Arial, sans-serif" font-size="17" font-weight="700">C7 卡圖手機預覽</text>
      <text x="${PADDING}" y="45" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">${width}px · 三欄收藏小卡 · 實際 3:4 裁切</text>
    </svg>`);
  composites.unshift({ input: header, left: 0, top: 0 });

  await sharp({
    create: { width, height, channels: 4, background: '#08111f' },
  })
    .composite(composites)
    .png()
    .toFile(path.join(__dirname, `mobile-preview-${width}.png`));
}

Promise.all(VIEWPORTS.map(renderViewport)).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
