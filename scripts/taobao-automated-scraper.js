/**
 * 淘寶自動化爬蟲 (Taobao Playwright Automated Scraper)
 * 
 * 原理說明：
 * 1. 使用 Playwright 啟動真實 Chrome 瀏覽器 (可選擇看到畫面或背景執行)。
 * 2. 登入/載入 Session 後，進入店鋪首頁或商品列表頁。
 * 3. 自動搜尋/滾動，抓取所有商品連結。
 * 4. 逐一（一個一個點開或分頁開啟）進入商品詳情頁。
 * 5. 提取：商品名稱、高清主圖與輪播圖、價格、詳細規格（磅數/尺寸/顏色）、類別與說明。
 * 6. 輸出為格式完美的 JSON (`src/features/catalog/data/scraped_products.json`)。
 * 
 * 執行需求:
 * npx playwright install chromium
 * node scripts/taobao-automated-scraper.js --url "https://shop123456.taobao.com" --headful
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// 分類自動比對關鍵字
function detectCategory(title = '') {
  if (title.includes('弓柄') || title.includes('弓身')) return ['Recurve', 'Riser'];
  if (title.includes('弓片') || title.includes('弓臂')) return ['Recurve', 'Limbs'];
  if (title.includes('瞄准') || title.includes('瞄')) return ['Recurve', 'Sight'];
  if (title.includes('箭') || title.includes('箭杆')) return ['Arrows', 'Shaft'];
  if (title.includes('減震') || title.includes('平衡杆')) return ['Stabilizers', 'Rods'];
  if (title.includes('護胸') || title.includes('護臂') || title.includes('護指')) return ['Protective', 'Guard'];
  return ['Gear', 'Accessories'];
}

export async function runTaobaoScraper(shopUrl, options = { headful: true, maxProducts: 50 }) {
  console.log(`🚀 開始啟動 Playwright 瀏覽器...`);
  console.log(`🎯 目標店鋪網址: ${shopUrl}`);

  // 1. 啟動瀏覽器 (headful: true 可讓您在畫面上看到自動點擊過程)
  const browser = await chromium.launch({
    headless: !options.headful,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log(`🌐 正在前往店鋪網址...`);
    await page.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 如果遇到了驗證碼或需要登入，提示使用者在開啟的瀏覽器中操作
    console.log(`💡 提示：若出現淘寶登入或驗證碼，請直接在彈出的瀏覽器視窗中完成驗證。`);

    // 2. 等待商品清單載入，並收集商品 detail 網址
    await page.waitForTimeout(5000); // 給予頁面動態載入時間

    // 捲動頁面觸發 Lazyload
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight || totalHeight > 3000) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });

    // 抓取頁面上所有商品 detail 連結 (item.htm?id=xxx)
    const itemLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="item.htm"]'));
      const links = new Set();
      anchors.forEach(a => {
        let href = a.getAttribute('href');
        if (href) {
          if (href.startsWith('//')) href = 'https:' + href;
          links.add(href);
        }
      });
      return Array.from(links);
    });

    console.log(`📦 共找到 ${itemLinks.length} 個商品連結。準備開始逐個進入抓取詳細資料...`);

    const scrapedProducts = [];
    const limit = Math.min(itemLinks.length, options.maxProducts);

    // 3. 逐一進入每個商品頁面抓取精確資料
    for (let i = 0; i < limit; i++) {
      const link = itemLinks[i];
      console.log(`\n🔍 [${i + 1}/${limit}] 正在抓取商品: ${link}`);
      
      const itemPage = await context.newPage();
      try {
        await itemPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await itemPage.waitForTimeout(2000);

        // 提取商品頁詳細資料
        const productData = await itemPage.evaluate(() => {
          // 商品名稱
          const titleEl = document.querySelector('.tb-main-title, h3.item-title, .ItemHeader--title--..., h1');
          const title = titleEl ? titleEl.textContent.trim() : '';

          // 價格
          const priceEl = document.querySelector('.tb-rmb-num, .price-num, .PromoPrice--price--..., .tb-detail-price');
          const priceText = priceEl ? priceEl.textContent.replace(/[^\d.]/g, '') : '0';
          const price = parseFloat(priceText) || 0;

          // 高清圖片
          const imgEls = Array.from(document.querySelectorAll('#J_UlThumb img, .ItemGallery--thumbnail--... img, .tb-gallery img'));
          const images = imgEls.map(img => {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
            if (src.startsWith('//')) src = 'https:' + src;
            return src.replace(/_\d+x\d+\.jpg.*/, '').replace(/_\.webp.*/, '');
          }).filter(Boolean);

          const mainImage = images[0] || '';

          // 規格參數 (例如：磅數、長度、顏色)
          const specEls = Array.from(document.querySelectorAll('.attributes-list li, .ItemAttributes--attr--...'));
          const specifications = specEls.map(el => {
            const text = el.textContent.trim();
            const parts = text.split(':').map(p => p.trim());
            return { key: parts[0] || '屬性', value: parts[1] || text };
          });

          // 獲取淘寶 NID
          const nidMatch = window.location.href.match(/id=(\d+)/);
          const nid = nidMatch ? nidMatch[1] : String(Date.now());

          return {
            nid,
            title,
            price,
            mainImage,
            images,
            specifications
          };
        });

        if (productData.title && productData.price > 0) {
          const formattedProduct = {
            id: `tb-scraped-${productData.nid}`,
            sku: `THXS-${productData.nid}`,
            name: productData.title,
            brand: '太華玄聖',
            categoryPath: detectCategory(productData.title),
            baseCurrency: 'CNY',
            basePrice: productData.price,
            markupFactor: 1.0,
            mainImage: productData.mainImage || 'https://images.unsplash.com/photo-1511094498305-6548777a835b?auto=format&fit=crop&w=800&q=80',
            images: productData.images.length > 0 ? productData.images : [productData.mainImage],
            specifications: productData.specifications,
            tags: ['TaobaoAutoScraped'],
            inStock: true,
            source: 'Taobao Automated Crawler'
          };

          scrapedProducts.push(formattedProduct);
          console.log(`  ✅ 成功解析: ${productData.title} (RMB $${productData.price})`);
        } else {
          console.log(`  ⚠️ 跳過無效資料商品`);
        }
      } catch (err) {
        console.error(`  ❌ 抓取商品失敗 [${link}]:`, err.message);
      } finally {
        await itemPage.close();
      }

      // 隨機間隔 1~2 秒，避免請求過於頻繁
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    }

    // 4. 將抓取到的完整商品資料寫入 JSON
    const outputPath = path.resolve('src/features/catalog/data/scraped_products.json');
    fs.writeFileSync(outputPath, JSON.stringify(scrapedProducts, null, 2), 'utf-8');
    console.log(`\n🎉 抓取完成！共抓取 ${scrapedProducts.length} 件完整商品，已儲存至:\n${outputPath}`);

  } catch (error) {
    console.error('❌ 爬蟲執行過程發生錯誤:', error);
  } finally {
    await browser.close();
  }
}

// 命令列執行入口
if (process.argv[1].includes('taobao-automated-scraper')) {
  const shopUrl = process.argv[2] || 'https://shop.taobao.com';
  runTaobaoScraper(shopUrl, { headful: true, maxProducts: 20 });
}
