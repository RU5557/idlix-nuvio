const axios = require('axios');

const IDLIX_API = {
  id: 'idlix',
  name: 'Idlix',
  description: 'Idlix - Film & Series Indonesia HD (API)',
  version: '2.0.0',
  author: 'CloudX-Nuvio',
  supportedTypes: ['movie', 'tv'],
  filename: 'providers/idlix.js',
  enabled: true,
  hasSettings: false,
  formats: ['m3u8', 'mp4'],
  logo: 'https://z2.idlixku.com/favicon.png',
  contentLanguage: ['id', 'en'],
  mainUrl: 'https://z2.idlixku.com',
  apiBase: 'https://z2.idlixku.com',

  async search(query) {
    try {
      const url = `${this.apiBase}/search?q=${encodeURIComponent(query)}`;
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'RSC': '1'
        }
      });

      // Parse RSC payload - look for movie/tv data
      const results = [];
      const titleMatches = data.match(/"title":"([^"]+)"/g) || [];
      const slugMatches = data.match(/"slug":"([^"]+)"/g) || [];
      const posterMatches = data.match(/"posterPath":"([^"]+)"/g) || [];
      const typeMatches = data.match(/"type":"(movie|tv)"/g) || [];

      const titles = titleMatches.map(m => m.match(/"title":"([^"]+)"/)[1]);
      const slugs = slugMatches.map(m => m.match(/"slug":"([^"]+)"/)[1]);
      const posters = posterMatches.map(m => m.match(/"posterPath":"([^"]+)"/)[1]);
      const types = typeMatches.map(m => m.match(/"type":"(movie|tv)"/)[1]);

      for (let i = 0; i < Math.min(titles.length, slugs.length); i++) {
        results.push({
          id: `${this.mainUrl}/${types[i] || 'movie'}/${slugs[i]}`,
          title: titles[i],
          image: posters[i] ? `https://image.tmdb.org/t/p/w500${posters[i]}` : null,
          type: types[i] || 'movie'
        });
      }

      return results.slice(0, 20);
    } catch (e) {
      console.error('Idlix search error:', e.message);
      return [];
    }
  },

  async getDetails(url) {
    try {
      const slug = url.split('/').pop();
      const type = url.includes('/tv/') ? 'tv' : 'movie';
      
      const apiUrl = `${this.apiBase}/${type}/${slug}`;
      const { data } = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'RSC': '1'
        }
      });

      // Try to parse as JSON first (if API returns JSON directly)
      let details = null;
      if (typeof data === 'object') {
        details = data;
      } else {
        // Parse RSC payload
        const titleMatch = data.match(/"title":"([^"]+)"/);
        const overviewMatch = data.match(/"overview":"([^"]+)"/);
        const posterMatch = data.match(/"posterPath":"([^"]+)"/);
        const yearMatch = data.match(/"firstAirDate":"(\d{4})/) || data.match(/"releaseDate":"(\d{4})/);

        details = {
          title: titleMatch ? titleMatch[1] : '',
          description: overviewMatch ? overviewMatch[1] : '',
          poster: posterMatch ? `https://image.tmdb.org/t/p/w500${posterMatch[1]}` : null,
          year: yearMatch ? parseInt(yearMatch[1]) : null
        };
      }

      return {
        id: url,
        title: details.title || '',
        image: details.posterPath ? `https://image.tmdb.org/t/p/w500${details.posterPath}` : details.poster,
        type: type,
        year: details.year || details.firstAirDate?.split('-')[0],
        description: details.overview || details.description || '',
        rating: details.voteAverage || null,
        genres: details.genres?.map(g => g.name) || [],
        episodes: details.defaultSeason?.episodes || []
      };
    } catch (e) {
      console.error('Idlix getDetails error:', e.message);
      return null;
    }
  },

  async getStreams(url) {
    try {
      // Idlix uses external embed servers
      // Need to fetch video page and extract embed URLs
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const streams = [];
      
      // Look for embed URLs in RSC or HTML
      const embedMatches = data.match(/https?:\/\/[^"'\s]+\.m3u8/g) || [];
      embedMatches.forEach(embedUrl => {
        streams.push({
          server: 'HLS',
          url: embedUrl,
          quality: 'HD'
        });
      });

      // If no streams found, return placeholder
      if (streams.length === 0) {
        streams.push({
          server: 'Idlix',
          url: url,
          quality: 'HD',
          note: 'Open in browser'
        });
      }

      return streams;
    } catch (e) {
      console.error('Idlix getStreams error:', e.message);
      return [];
    }
  }
};

module.exports = IDLIX_API;
