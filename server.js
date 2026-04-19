import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const storeFile = path.join(__dirname, 'data', 'store.json');
const envFile = path.join(__dirname, '.env');

async function loadLocalEnv() {
  try {
    const raw = await fs.readFile(envFile, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }

      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // No local env file is fine for the demo build.
  }
}

await loadLocalEnv();

const baiduConfig = {
  appId: process.env.BAIDU_APP_ID || '',
  ak: process.env.BAIDU_AK || '',
  apiType: process.env.BAIDU_APP_TYPE || '服务端',
  ipWhitelist: process.env.BAIDU_IP_WHITELIST || '0.0.0.0/0'
};

const qweatherConfig = {
  appId: process.env.HEWEATHER_APP_ID || '',
  apiKey: process.env.HEWEATHER_API_KEY || '',
  credentialName: process.env.HEWEATHER_CREDENTIAL_NAME || 'haze-detection',
  developerId: process.env.HEWEATHER_DEVELOPER_ID || '',
  apiHost: process.env.HEWEATHER_API_HOST || 'devapi.qweather.com'
};

globalThis.__BAIDU_CONFIG__ = baiduConfig;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

async function ensureStore() {
  try {
    await fs.access(storeFile);
  } catch {
    await fs.mkdir(path.dirname(storeFile), { recursive: true });
    await fs.writeFile(
      storeFile,
      JSON.stringify({ locations: [], snapshots: [] }, null, 2),
      'utf8'
    );
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(storeFile, 'utf8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(storeFile), { recursive: true });
  await fs.writeFile(storeFile, JSON.stringify(store, null, 2), 'utf8');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatCity(address = {}, fallback = '未知城市') {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state ||
    address.suburb ||
    fallback
  );
}

function aqiLevel(aqi) {
  if (aqi <= 50) return { label: '优', color: '#2ecc71' };
  if (aqi <= 100) return { label: '良', color: '#f1c40f' };
  if (aqi <= 150) return { label: '轻度污染', color: '#e67e22' };
  return { label: '污染', color: '#e74c3c' };
}

function adviceForAqi(aqi, trend) {
  if (aqi > 150) return `空气污染较明显，建议减少外出并佩戴口罩。当前趋势${trend}。`;
  if (aqi > 100) return `敏感人群应减少长时间户外活动。当前趋势${trend}。`;
  if (aqi > 50) return `空气质量一般，出行建议适当关注防护。当前趋势${trend}。`;
  return `空气质量良好，适合通勤与户外出行。当前趋势${trend}。`;
}

function seededValue(seed, min, max) {
  const x = Math.sin(seed) * 10000;
  const fraction = x - Math.floor(x);
  return min + fraction * (max - min);
}

function fallbackOverview({ city, latitude = 0, longitude = 0, source = 'fallback' }) {
  const seed = Math.abs(latitude * 7.3 + longitude * 11.7 + new Date().getHours());
  const temperature = Math.round(seededValue(seed + 1, 16, 33));
  const humidity = Math.round(seededValue(seed + 2, 35, 85));
  const aqi = Math.round(seededValue(seed + 3, 25, 180));
  const windSpeed = Number(seededValue(seed + 4, 1.2, 8.5).toFixed(1));
  const pm25 = Math.round(seededValue(seed + 5, 8, 90));
  const pm10 = Math.round(seededValue(seed + 6, 18, 120));
  const labels = Array.from({ length: 8 }, (_, index) => `${index + 1}h`);
  const temperatureSeries = labels.map((_, index) => Math.round(temperature + Math.sin(seed + index) * 2 + index * 0.4));
  const humiditySeries = labels.map((_, index) => clamp(Math.round(humidity + Math.cos(seed + index) * 5 - index), 20, 100));
  const level = aqiLevel(aqi);
  const trend = aqi > 120 ? '上升' : aqi < 60 ? '下降' : '平稳';

  return {
    location: { city, latitude, longitude, source },
    weather: {
      temperature,
      feelsLike: temperature + 1,
      humidity,
      windSpeed,
      label: '本地模拟天气'
    },
    airQuality: {
      aqi,
      pm25,
      pm10,
      level: level.label,
      color: level.color
    },
    suggestion: adviceForAqi(aqi, trend),
    trend,
    timeline: {
      labels,
      temperature: temperatureSeries,
      humidity: humiditySeries
    }
  };
}

async function reverseGeocode(latitude, longitude) {
  if (!baiduConfig.ak) {
    throw new Error('baidu ak missing');
  }

  const url = new URL('https://api.map.baidu.com/reverse_geocoding/v3/');
  url.searchParams.set('ak', baiduConfig.ak);
  url.searchParams.set('output', 'json');
  url.searchParams.set('coordtype', 'wgs84ll');
  url.searchParams.set('location', `${latitude},${longitude}`);
  url.searchParams.set('extensions_poi', '0');

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('baidu reverse geocoding failed');
  }

  const data = await response.json();
  if (data.status !== 0) {
    throw new Error(data.message || 'baidu reverse geocoding failed');
  }

  const addressComponent = data.result?.addressComponent || {};
  const formattedAddress = data.result?.formatted_address || '';
  const city = addressComponent.city || addressComponent.province || formattedAddress || '定位城市';

  return {
    city,
    displayName: formattedAddress || city,
    location: data.result?.location || { lat: latitude, lng: longitude },
    addressComponent
  };
}

async function geocodeCity(city) {
  if (!baiduConfig.ak) {
    throw new Error('baidu ak missing');
  }

  const url = new URL('https://api.map.baidu.com/geocoding/v3/');
  url.searchParams.set('ak', baiduConfig.ak);
  url.searchParams.set('output', 'json');
  url.searchParams.set('ret_coordtype', 'wgs84ll');
  url.searchParams.set('address', city);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('baidu geocoding failed');
  }

  const data = await response.json();
  if (data.status !== 0) {
    throw new Error(data.message || 'baidu geocoding failed');
  }

  const location = data.result?.location;
  if (!location) {
    throw new Error('city not found');
  }

  return {
    city,
    latitude: location.lat,
    longitude: location.lng,
    confidence: data.result?.confidence ?? 0,
    precision: data.result?.precise ?? 0
  };
}

function buildTimeline(hourly) {
  const forecast = Array.isArray(hourly) ? hourly : [];
  const labels = forecast.slice(0, 8).map((item) => item.fxTime?.slice(11, 16) || '--');
  return {
    labels,
    temperature: forecast.slice(0, 8).map((item) => Number(item.temp ?? 0)),
    humidity: forecast.slice(0, 8).map((item) => Number(item.humidity ?? 0))
  };
}

async function fetchQWeather(urlPath, location) {
  if (!qweatherConfig.apiKey) {
    throw new Error('qweather api key missing');
  }

  const url = new URL(`https://${qweatherConfig.apiHost}${urlPath}`);
  url.searchParams.set('location', `${location.lng},${location.lat}`);
  url.searchParams.set('key', qweatherConfig.apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('qweather request failed');
  }

  const data = await response.json();
  if (String(data.code) !== '200') {
    throw new Error(data.code || 'qweather request failed');
  }

  return data;
}

async function fetchQWeatherAirQuality(latitude, longitude) {
  if (!qweatherConfig.apiKey) {
    throw new Error('qweather api key missing');
  }

  const lat = Number(latitude).toFixed(2);
  const lon = Number(longitude).toFixed(2);
  const url = new URL(`https://${qweatherConfig.apiHost}/airquality/v1/current/${lat}/${lon}`);
  url.searchParams.set('key', qweatherConfig.apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('qweather airquality request failed');
  }

  return response.json();
}

function parseAirQualityV1(data, fallbackAir) {
  const indexes = Array.isArray(data?.indexes) ? data.indexes : [];
  const pollutants = Array.isArray(data?.pollutants) ? data.pollutants : [];
  const preferredIndex =
    indexes.find((item) => item.code === 'cn-mee') ||
    indexes.find((item) => item.code === 'us-epa') ||
    indexes[0];

  const pm25 = pollutants.find((item) => item.code === 'pm2p5')?.concentration?.value;
  const pm10 = pollutants.find((item) => item.code === 'pm10')?.concentration?.value;

  const aqi = Math.round(Number(preferredIndex?.aqi ?? fallbackAir.aqi));
  return {
    aqi,
    level: aqiLevel(aqi).label,
    color: aqiLevel(aqi).color,
    pm25: Number(pm25 ?? fallbackAir.pm25),
    pm10: Number(pm10 ?? fallbackAir.pm10)
  };
}

async function fetchWeatherAndAqi(latitude, longitude, cityLabel) {
  const location = { lat: latitude, lng: longitude };
  const [nowData, hourlyData] = await Promise.all([
    fetchQWeather('/v7/weather/now', location),
    fetchQWeather('/v7/weather/24h', location)
  ]);
  const airData = await fetchQWeatherAirQuality(latitude, longitude).catch(() => null);

  const currentWeather = nowData.now || {};
  const timeline = buildTimeline(hourlyData.hourly || []);
  const airFallback = fallbackOverview({ city: cityLabel, latitude, longitude, source: 'qweather-air-fallback' }).airQuality;
  const parsedAir = airData ? parseAirQualityV1(airData, airFallback) : airFallback;
  const aqi = parsedAir.aqi;
  const level = aqiLevel(aqi);
  const recentTrend = aqi > 120 ? '上升' : aqi < 60 ? '下降' : '平稳';
  const sourceLabel = airData ? 'baidu-map + qweather' : 'baidu-map + qweather(weather-only)';

  return {
    location: {
      city: cityLabel,
      latitude,
      longitude,
      source: sourceLabel
    },
    weather: {
      temperature: Number(currentWeather.temp ?? 0),
      feelsLike: Number(currentWeather.feelsLike ?? currentWeather.temp ?? 0),
      humidity: Number(currentWeather.humidity ?? 0),
      windSpeed: Number(currentWeather.windSpeed ?? 0),
      weatherCode: currentWeather.icon ?? 0,
      label: currentWeather.text || '实时天气',
      windDir: currentWeather.windDir || '',
      windScale: currentWeather.windScale || ''
    },
    airQuality: {
      aqi,
      pm25: parsedAir.pm25,
      pm10: parsedAir.pm10,
      level: parsedAir.level || level.label,
      color: parsedAir.color || level.color
    },
    suggestion: adviceForAqi(aqi, recentTrend),
    trend: recentTrend,
    timeline
  };
}

async function getOverview({ city, latitude, longitude }) {
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const reverse = await reverseGeocode(latitude, longitude).catch(() => null);
    const label = city || reverse?.city || '定位城市';
    return fetchWeatherAndAqi(latitude, longitude, label).catch(() => fallbackOverview({ city: label, latitude, longitude, source: 'baidu-map + qweather (fallback)' }));
  }

  if (city) {
    try {
      const geocoded = await geocodeCity(city);
      const reverse = await reverseGeocode(geocoded.latitude, geocoded.longitude).catch(() => null);
      const label = reverse?.city || geocoded.city;
      return fetchWeatherAndAqi(geocoded.latitude, geocoded.longitude, label).catch(() => fallbackOverview({ city: label, latitude: geocoded.latitude, longitude: geocoded.longitude, source: 'baidu-map + qweather (fallback)' }));
    } catch {
      return fallbackOverview({ city, source: 'baidu-map + qweather (fallback)' });
    }
  }

  return fallbackOverview({ city: '未命名城市', source: 'baidu-map + qweather (fallback)' });
}

app.get('/api/health', (_, response) => {
  response.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post('/api/location', async (request, response) => {
  try {
    const latitude = Number(request.body.latitude);
    const longitude = Number(request.body.longitude);
    const cityHint = typeof request.body.city === 'string' ? request.body.city.trim() : '';

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return response.status(400).json({ message: 'latitude and longitude are required' });
    }

    const reverse = await reverseGeocode(latitude, longitude).catch(() => null);
    const location = {
      city: reverse?.city || cityHint || '定位城市',
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    };

    const store = await readStore();
    store.locations.unshift(location);
    store.locations = store.locations.slice(0, 50);
    await writeStore(store);

    response.json({ location });
  } catch (error) {
    response.status(500).json({ message: 'failed to save location', detail: error.message });
  }
});

app.get('/api/overview', async (request, response) => {
  try {
    const latitude = request.query.latitude === undefined ? NaN : Number(request.query.latitude);
    const longitude = request.query.longitude === undefined ? NaN : Number(request.query.longitude);
    const city = typeof request.query.city === 'string' ? request.query.city.trim() : '';
    const overview = await getOverview({ city, latitude, longitude });

    const snapshot = {
      city: overview.location.city,
      latitude: overview.location.latitude,
      longitude: overview.location.longitude,
      temperature: overview.weather.temperature,
      humidity: overview.weather.humidity,
      aqi: overview.airQuality.aqi,
      pm25: overview.airQuality.pm25,
      pm10: overview.airQuality.pm10,
      updatedAt: new Date().toISOString()
    };

    const store = await readStore();
    store.snapshots.unshift(snapshot);
    store.snapshots = store.snapshots.slice(0, 100);
    await writeStore(store);

    const recent = store.snapshots.filter((item) => item.city === overview.location.city).slice(0, 8).reverse();
    response.json({
      ...overview,
      storedSnapshot: snapshot,
      recentHistory: recent
    });
  } catch (error) {
    response.status(500).json({ message: 'failed to load overview', detail: error.message });
  }
});

app.get('/api/history', async (request, response) => {
  const city = typeof request.query.city === 'string' ? request.query.city.trim() : '';
  const store = await readStore();
  const history = city ? store.snapshots.filter((item) => item.city === city) : store.snapshots;
  response.json({ history: history.slice(0, 20) });
});

app.get('*', (_, response) => {
  response.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, async () => {
  await ensureStore();
  console.log(`HazeDetectionSystem is running at http://localhost:${port}`);
});
