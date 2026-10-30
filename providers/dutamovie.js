const axios = require('axios');
const cheerio = require('cheerio');

const DUTAMOVIE = {
  id: 'dutamovie',
  name: 'Dutamovie',
  description: 'Dutamovie - Film & Serial TV Indonesia',
  version: '1.0.0',
  author: 'CloudX',
  supportedTypes: ['movie', 'tv'],
  filename: 'providers/dutamovie.js',
  enabled: true,
  hasSettings: false,
  formats: ['mp4', 'mkv', 'm3u8'],
  logo: 'https://offshorebankservices.com/favicon.ico',
  contentLanguage: ['id'],
  mainUrl: 'https://offshorebankservices.com',
  mainUrlJson: 'https://raw.githubusercontent.com/Asm0d3usX/CloudX/builds/Website.json',
  directUrl: null,

  async loadMainUrlIfNeeded() {
    if (this.directUrl) return;
    try {
      const { data } = await axios.get(this.mainUrlJson);
      const json = JSON.parse(data);
      const arr = json.dutamovie;
      if (arr && arr.length > 0 && arr[0]) {
        const newUrl = arr[0].replace(/\/$/, '');
        if (newUrl) {
          this.mainUrl = newUrl;
          this.directUrl = newUrl;
        }
      }
    } catch (e) {
      console.error('loadMainUrlIfNeeded error:', e);
    }
  },

  getImageAttr($el) {
    const dataSrc = $el.attr('data-src');
    if (dataSrc) return dataSrc;
    const dataLazySrc = $el.attr('data-lazy-src');
    if (dataLazySrc) return dataLazySrc;
    const srcset = $el.attr('srcset');
    if (srcset) return srcset.split(' ')[0];
    return $el.attr('src');
  },

  fixImageQuality(url) {
    if (!url) return null;
    return url.replace(/-\d+x\d*(?=\.\w+$)/, '');
  },

  async search(query) {
    await this.loadMainUrlIfNeeded();
    try {
      const url = `${this.mainUrl}/?s=${encodeURIComponent(query)}&post_type[]=post&post_type[]=tv`;
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(data);
      const results = [];

      $('article.item-infinite').each((i, el) => {
        const $el = $(el);
        const $title = $el.find('h2.entry-title > a');
        const title = $title.text().trim();
        const href = $title.attr('href') || $el.find('a').attr('href');
        if (!title || !href) return;

        const $img = $el.find('a > img');
        let poster = this.getImageAttr($img);
        poster = this.fixImageQuality(poster);

        const quality = $el.find('div.gmr-qual, div.gmr-quality-item > a').text().trim().replace(/-/g, '');
        const ratingText = $el.find('div.gmr-rating-item').text().trim();
        const rating = parseFloat(ratingText) || null;

        const epMatch = title.match(/Episode\s?(\d+)/i);
        const episodeNum = epMatch ? parseInt(epMatch[1]) : null;

        if (!quality) {
          results.push({
            id: href,
            title: title,
            image: poster,
            type: 'tv',
            episode: episodeNum
          });
        } else {
          results.push({
            id: href,
            title: title,
            image: poster,
            type: 'movie',
            quality: quality,
            rating: rating
          });
        }
      });

      return results;
    } catch (e) {
      console.error('Dutamovie search error:', e);
      return [];
    }
  },

  async getDetails(url) {
    await this.loadMainUrlIfNeeded();
    try {
      const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = resp.data;
      const finalUrl = resp.request?.res?.responseUrl || url;
      this.directUrl = new URL(finalUrl).origin;

      const $ = cheerio.load(html);

      let title = $('h1.entry-title').text().trim()
        .replace(/Season.*$/i, '')
        .replace(/Episode.*$/i, '')
        .trim();

      const $posterImg = $('figure.pull-left > img');
      let poster = this.getImageAttr($posterImg);
      poster = this.fixImageQuality(poster);

      const tags = [];
      $('div.gmr-moviedata a').each((i, el) => {
        tags.push($(el).text().trim());
      });

      const yearText = $('div.gmr-moviedata strong:contains(Year:) > a').text().trim();
      const year = parseInt(yearText) || null;

      const tvType = url.includes('/tv/') ? 'tv' : 'movie';

      const description = $('div[itemprop=description] > p').first().text().trim();
      const trailer = $('ul.gmr-player-nav li a.gmr-trailer-popup').attr('href');
      const ratingText = $('div.gmr-meta-rating span[itemprop=ratingValue]').text().trim();
      const rating = parseFloat(ratingText) || null;

      const actors = [];
      $('div.gmr-moviedata').last().find('span[itemprop=actors] a').each((i, el) => {
        actors.push($(el).text().trim());
      });

      const durationText = $('div.gmr-moviedata span[property=duration]').text().trim();
      const duration = durationText.replace(/\D/g, '') ? parseInt(durationText.replace(/\D/g, '')) : null;

      const episodes = [];
      if (tvType === 'tv') {
        $('div.vid-episodes a, div.gmr-listseries a').each((i, el) => {
          const $el = $(el);
          const epHref = $el.attr('href');
          if (!epHref) return;
          let rawTitle = $el.attr('title') || $el.text();
          if (!rawTitle.trim()) rawTitle = $el.text();
          rawTitle = rawTitle.replace(/^Permalink to\s*/i, '').trim();
          const epMatch = rawTitle.match(/Episode\s*(\d+)/i);
          const epNum = epMatch ? parseInt(epMatch[1]) : null;
          const epName = epNum ? `Episode ${epNum}` : rawTitle;
          if (epNum) {
            episodes.push({
              id: epHref,
              title: epName,
              episode: epNum,
              image: poster
            });
          }
        });
      }

      return {
        id: url,
        title: title,
        image: poster,
        type: tvType,
        year: year,
        description: description,
        tags: tags,
        rating: rating,
        actors: actors,
        duration: duration,
        trailer: trailer,
        episodes: episodes
      };
    } catch (e) {
      console.error('Dutamovie getDetails error:', e);
      return null;
    }
  },

  async getStreams(url) {
    await this.loadMainUrlIfNeeded();
    try {
      const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const $ = cheerio.load(data);
      const streams = [];

      const muviId = $('div#muvipro_player_content_id').attr('data-id');

      if (!muviId) {
        const tabLinks = $('ul.muvipro-player-tabs li a').toArray();
        for (const tab of tabLinks) {
          const tabHref = $(tab).attr('href');
          if (!tabHref) continue;
          const tabUrl = tabHref.startsWith('http') ? tabHref : `${this.directUrl}${tabHref.startsWith('/') ? '' : '/'}${tabHref}`;
          try {
            const tabResp = await axios.get(tabUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const tab$ = cheerio.load(tabResp.data);
            const iframeSrc = tab$('div.gmr-embed-responsive iframe').attr('data-litespeed-src') || tab$('div.gmr-embed-responsive iframe').attr('src');
            if (iframeSrc) {
              streams.push({
                server: 'tab',
                url: iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc,
                quality: 'HD'
              });
            }
          } catch (e) {
            console.error('tab fetch error:', e);
          }
        }
      } else {
        const tabContent = $('div.tab-content-ajax').toArray();
        for (const tabEl of tabContent) {
          const tabId = $(tabEl).attr('id');
          if (!tabId) continue;
          try {
            const ajaxUrl = `${this.directUrl}/wp-admin/admin-ajax.php`;
            const ajaxResp = await axios.post(ajaxUrl, `action=muvipro_player_content&tab=${encodeURIComponent(tabId)}&post_id=${encodeURIComponent(muviId)}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
            const ajax$ = cheerio.load(ajaxResp.data);
            const iframeSrc = ajax$('iframe').attr('src');
            if (iframeSrc) {
              streams.push({
                server: 'server',
                url: iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc,
                quality: 'HD'
              });
            }
          } catch (e) {
            console.error('ajax fetch error:', e);
          }
        }
      }

      $('ul.gmr-download-list li a').each((i, el) => {
        const dlUrl = $(el).attr('href');
        if (dlUrl && dlUrl.trim()) {
          streams.push({
            server: 'download',
            url: dlUrl,
            quality: 'download'
          });
        }
      });

      return streams;
    } catch (e) {
      console.error('Dutamovie getStreams error:', e);
      return [];
    }
  }
};

module.exports = DUTAMOVIE;
