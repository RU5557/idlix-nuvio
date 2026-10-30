const axios = require('axios');
const cheerio = require('cheerio');

const IDLIX = {
  id: 'idlix',
  name: 'Idlix',
  description: 'Stream Film & Series Indonesia HD',
  version: '1.0.0',
  author: 'Nuvio',
  supportedTypes: ['movie', 'tv'],
  filename: 'providers/idlix.js',
  enabled: true,
  hasSettings: false,
  formats: ['m3u8', 'mp4'],
  logo: 'https://z2.idlixku.com/favicon.png',
  contentLanguage: ['id', 'en'],
  mainUrl: 'https://z2.idlixku.com',

  async search(query) {
    try {
      const url = `${this.mainUrl}/?s=${encodeURIComponent(query)}`;
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(data);
      const results = [];
      
      $('[data-type="movie"], [data-type="tv"]').each((i, el) => {
        const $el = $(el);
        const title = $el.find('h3').text().trim();
        const href = $el.find('a').attr('href');
        const poster = $el.find('img').attr('src');
        const type = $el.attr('data-type') || 'movie';
        
        if (title && href) {
          results.push({
            id: href,
            title: title,
            image: poster,
            type: type
          });
        }
      });
      
      return results;
    } catch (error) {
      console.error('Idlix search error:', error);
      return [];
    }
  },

  async getDetails(url) {
    try {
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(data);
      
      return {
        title: $('h1').text().trim(),
        description: $('[data-testid="description"]').text().trim(),
        poster: $('[data-testid="poster"]').attr('src'),
        year: parseInt($('[data-testid="year"]').text()),
        rating: $('[data-testid="rating"]').text().trim(),
        duration: $('[data-testid="duration"]').text().trim(),
        genres: $('[data-testid="genres"] a').map((i, el) => $(el).text()).get(),
        cast: $('[data-testid="cast"] a').map((i, el) => $(el).text()).get()
      };
    } catch (error) {
      console.error('Idlix getDetails error:', error);
      return null;
    }
  },

  async getStreams(url) {
    try {
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(data);
      const streams = [];
      
      $('[data-server]').each((i, el) => {
        const $el = $(el);
        const server = $el.attr('data-server');
        const embedUrl = $el.attr('data-embed');
        
        if (embedUrl) {
          streams.push({
            server: server,
            url: embedUrl,
            quality: 'HD'
          });
        }
      });
      
      return streams;
    } catch (error) {
      console.error('Idlix getStreams error:', error);
      return [];
    }
  }
};

module.exports = IDLIX;
