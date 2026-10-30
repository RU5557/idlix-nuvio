const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const IDLIX = {
  id: 'idlix',
  name: 'Idlix',
  description: 'Idlix - Film & Series Indonesia HD',
  version: '1.0.0',
  author: 'CloudX-Nuvio',
  supportedTypes: ['movie', 'tv'],
  filename: 'providers/idlix.js',
  enabled: true,
  hasSettings: false,
  formats: ['m3u8', 'mp4'],
  logo: 'https://z2.idlixku.com/favicon.png',
  contentLanguage: ['id', 'en'],
  mainUrl: 'https://z2.idlixku.com',
  browser: null,

  async getBrowser() {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      } catch (e) {
        console.error('Browser launch failed:', e.message);
        throw e;
      }
    }
    return this.browser;
  },

  async search(query) {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
      
      await page.goto(`${this.mainUrl}/?s=${encodeURIComponent(query)}`, {
        waitUntil: 'networkidle2'
      });
      
      const results = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('[data-testid="movie-item"], .movie-card, [class*="movie"]').forEach(el => {
          const title = el.querySelector('h2, h3, [class*="title"]')?.textContent?.trim();
          const href = el.querySelector('a')?.href;
          const poster = el.querySelector('img')?.src;
          
          if (title && href) {
            items.push({
              id: href,
              title: title,
              image: poster,
              type: 'movie'
            });
          }
        });
        return items;
      });
      
      await page.close();
      return results;
    } catch (e) {
      console.error('Idlix search error:', e);
      return [];
    }
  },

  async getDetails(url) {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
      
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      const details = await page.evaluate(() => {
        return {
          title: document.querySelector('h1')?.textContent?.trim() || '',
          description: document.querySelector('[class*="description"], [class*="synopsis"]')?.textContent?.trim() || '',
          poster: document.querySelector('img[alt*="poster"], img[alt*="cover"]')?.src || '',
          year: document.querySelector('[class*="year"]')?.textContent?.match(/\d{4}/)?.at(0) || null,
          rating: document.querySelector('[class*="rating"]')?.textContent?.match(/[\d.]+/)?.at(0) || null,
          genres: Array.from(document.querySelectorAll('[class*="genre"] a, [class*="category"] a')).map(el => el.textContent?.trim()).filter(Boolean),
          actors: Array.from(document.querySelectorAll('[class*="actor"] a, [class*="cast"] a')).map(el => el.textContent?.trim()).filter(Boolean)
        };
      });
      
      await page.close();
      return details;
    } catch (e) {
      console.error('Idlix getDetails error:', e);
      return null;
    }
  },

  async getStreams(url) {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
      
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      const streams = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('[class*="server"], [class*="player"], iframe').forEach(el => {
          const src = el.src || el.getAttribute('data-src');
          const server = el.getAttribute('data-server') || el.className || 'unknown';
          if (src && !src.includes('about:blank')) {
            items.push({
              server: server,
              url: src,
              quality: 'HD'
            });
          }
        });
        return items;
      });
      
      await page.close();
      return streams;
    } catch (e) {
      console.error('Idlix getStreams error:', e);
      return [];
    }
  },

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
};

module.exports = IDLIX;
