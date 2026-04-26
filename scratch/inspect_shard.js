const zlib = require('zlib');
const http = require('http');

const url = 'http://46.62.223.85:8888/usaw/10/131110.json.gz';

http.get(url, (res) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    zlib.gunzip(buffer, (err, decompressed) => {
      if (err) {
        console.error('Decompression failed:', err);
        return;
      }
      const data = JSON.parse(decompressed.toString());
      console.log('--- Shard Data for 131110 ---');
      console.log('Name:', data.athlete_name);
      console.log('Population Percentiles:', JSON.stringify(data.population_percentiles, null, 2));
      
      if (data.population_percentiles && data.population_percentiles.recent) {
        console.log('\n--- Recent Strategy Analysis ---');
        console.log('openingStrategyRaw:', data.population_percentiles.recent.openingStrategyRaw);
        console.log('jumpPercentageRaw:', data.population_percentiles.recent.jumpPercentageRaw);
      }
    });
  });
}).on('error', (err) => {
  console.error('Fetch failed:', err.message);
});
