const $ = (selector) => document.querySelector(selector);

const state = {
  location: null,
  overview: null,
  clockTimer: null
};

// For Android USB debugging, use adb reverse with this local address.
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000';

const runtime = {
  isNativeApp: Boolean(window.Capacitor?.isNativePlatform?.()),
  geolocationPlugin: window.Capacitor?.Plugins?.Geolocation || null,
  apiBaseUrl: resolveApiBaseUrl()
};

const els = {
  cityName: $('#city-name'),
  cityMeta: $('#city-meta'),
  clock: $('#clock'),
  sourceLabel: $('#source-label'),
  temperature: $('#temperature'),
  feelsLike: $('#feels-like'),
  humidity: $('#humidity'),
  windSpeed: $('#wind-speed'),
  aqiValue: $('#aqi-value'),
  aqiLevel: $('#aqi-level'),
  advice: $('#advice'),
  trendPill: $('#trend-pill'),
  chart: $('#chart'),
  toast: $('#toast'),
  cityForm: $('#city-form'),
  cityInput: $('#city-input'),
  chartNote: $('#chart-note')
};

function resolveApiBaseUrl() {
  const native = Boolean(window.Capacitor?.isNativePlatform?.());
  const query = new URLSearchParams(window.location.search);
  const queryBase = query.get('apiBase');
  const savedBase = window.localStorage.getItem('haze.apiBaseUrl');
  const base = (queryBase || (native ? DEFAULT_API_BASE_URL : '') || savedBase || DEFAULT_API_BASE_URL || '').trim();
  if (!base) {
    return '';
  }
  const normalized = base.replace(/\/+$/, '');
  window.localStorage.setItem('haze.apiBaseUrl', normalized);
  return normalized;
}

function withApiBase(path) {
  if (!runtime.apiBaseUrl) {
    return path;
  }
  return `${runtime.apiBaseUrl}${path}`;
}

function isValidOverviewPayload(payload) {
  return Boolean(
    payload &&
      payload.location &&
      typeof payload.location.city === 'string' &&
      payload.weather &&
      payload.airQuality &&
      payload.timeline &&
      Array.isArray(payload.timeline.labels)
  );
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function startClock() {
  const tick = () => {
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  tick();
  window.clearInterval(state.clockTimer);
  state.clockTimer = window.setInterval(tick, 1000);
}

function aqiClass(aqi) {
  if (aqi <= 50) return 'var(--accent-2)';
  if (aqi <= 100) return '#f1c40f';
  if (aqi <= 150) return '#e67e22';
  return '#ff6b6b';
}

function setBasicInfo(overview) {
  state.overview = overview;
  els.cityName.textContent = overview.location.city;
  els.cityMeta.textContent = `纬度 ${overview.location.latitude.toFixed(3)}，经度 ${overview.location.longitude.toFixed(3)}`;
  els.sourceLabel.textContent = `数据来源：${overview.location.source}`;
  els.temperature.textContent = `${Math.round(overview.weather.temperature)}°C`;
  els.feelsLike.textContent = `${Math.round(overview.weather.feelsLike)}°C`;
  els.humidity.textContent = `${Math.round(overview.weather.humidity)}%`;
  els.windSpeed.textContent = `${Number(overview.weather.windSpeed).toFixed(1)} m/s`;
  els.aqiValue.textContent = overview.airQuality.aqi;
  els.aqiLevel.textContent = overview.airQuality.level;
  els.aqiValue.style.color = aqiClass(overview.airQuality.aqi);
  els.advice.textContent = overview.suggestion;
  els.trendPill.textContent = `趋势：${overview.trend}`;
  els.chartNote.textContent = `${overview.timeline.labels.length} 个时间点`;
}

function buildSvgLine(values, width, height, margin, color) {
  const usableWidth = width - margin.left - margin.right;
  const usableHeight = height - margin.top - margin.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = margin.left + (usableWidth * index) / Math.max(values.length - 1, 1);
    const y = margin.top + usableHeight - ((value - min) / range) * usableHeight;
    return `${x},${y}`;
  });

  return {
    polyline: `<polyline fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}" />`,
    dots: values
      .map((value, index) => {
        const x = margin.left + (usableWidth * index) / Math.max(values.length - 1, 1);
        const y = margin.top + usableHeight - ((value - min) / range) * usableHeight;
        return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" />`;
      })
      .join('')
  };
}

function renderChart(overview) {
  const { labels, temperature, humidity } = overview.timeline;
  const width = 920;
  const height = 320;
  const margin = { top: 24, right: 24, bottom: 56, left: 48 };
  const allValues = [...temperature, ...humidity];
  const min = Math.min(...allValues) - 2;
  const max = Math.max(...allValues) + 2;
  const usableWidth = width - margin.left - margin.right;
  const usableHeight = height - margin.top - margin.bottom;
  const gridLines = 4;

  const grid = Array.from({ length: gridLines + 1 }, (_, index) => {
    const y = margin.top + (usableHeight * index) / gridLines;
    const value = Math.round(max - ((max - min) * index) / gridLines);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(255,255,255,0.08)" />
      <text x="12" y="${y + 5}" fill="rgba(245,248,255,0.68)" font-size="12">${value}</text>
    `;
  }).join('');

  const labelsMarkup = labels
    .map((label, index) => {
      const x = margin.left + (usableWidth * index) / Math.max(labels.length - 1, 1);
      return `<text x="${x}" y="${height - 18}" text-anchor="middle" fill="rgba(245,248,255,0.68)" font-size="12">${label}</text>`;
    })
    .join('');

  const tempLine = buildSvgLine(temperature, width, height, margin, '#6ed6ff');
  const humidityLine = buildSvgLine(humidity, width, height, margin, '#7cf0b6');

  els.chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="温度和湿度趋势图">
      <defs>
        <linearGradient id="tempFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(110, 214, 255, 0.24)" />
          <stop offset="100%" stop-color="rgba(110, 214, 255, 0)" />
        </linearGradient>
        <linearGradient id="humidFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(124, 240, 182, 0.24)" />
          <stop offset="100%" stop-color="rgba(124, 240, 182, 0)" />
        </linearGradient>
      </defs>
      ${grid}
      ${tempLine.polyline}
      ${humidityLine.polyline}
      ${tempLine.dots}
      ${humidityLine.dots}
      ${labelsMarkup}
      <g transform="translate(${width - 190}, 18)">
        <rect width="170" height="58" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <circle cx="18" cy="20" r="5" fill="#6ed6ff" />
        <text x="32" y="24" fill="#f5f8ff" font-size="12">温度</text>
        <circle cx="18" cy="40" r="5" fill="#7cf0b6" />
        <text x="32" y="44" fill="#f5f8ff" font-size="12">湿度</text>
      </g>
    </svg>
  `;
}

async function fetchJson(url, options) {
  const requestUrl = withApiBase(url);
  let response;
  try {
    response = await fetch(requestUrl, options);
  } catch (error) {
    throw new Error(`网络请求失败：${requestUrl}（${error.message}）`);
  }
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    throw new Error(data.message || `请求失败：${response.status} ${requestUrl}`);
  }
  return data;
}

async function getDevicePosition() {
  if (runtime.isNativeApp && runtime.geolocationPlugin) {
    const permission = await runtime.geolocationPlugin.checkPermissions();
    if (permission.location !== 'granted') {
      await runtime.geolocationPlugin.requestPermissions();
    }
    return runtime.geolocationPlugin.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000
    });
  }

  if (!navigator.geolocation) {
    throw new Error('geolocation not supported');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

async function loadOverview(params) {
  if (runtime.isNativeApp && !runtime.apiBaseUrl) {
    throw new Error('App 未配置后端地址，请在 URL 参数中设置 apiBase。');
  }

  const query = new URLSearchParams(params);
  const overview = await fetchJson(`/api/overview?${query.toString()}`);
  if (!isValidOverviewPayload(overview)) {
    throw new Error('未获取到有效天气数据，请检查后端地址和服务状态。');
  }
  setBasicInfo(overview);
  renderChart(overview);
  showToast(`已更新 ${overview.location.city}`);
}

async function loadFromGeolocation() {
  try {
    const position = await getDevicePosition();
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    state.location = { latitude, longitude };

    try {
      const location = await fetchJson('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude })
      });
      state.location.city = location.location.city;
      await loadOverview({ latitude, longitude });
    } catch (error) {
      showToast(`定位更新失败：${error.message}`);
    }
  } catch {
    const message = runtime.isNativeApp ? '请在系统设置中打开定位权限。' : '定位已拒绝，请手动输入城市。';
    showToast(message);
  }
}

els.cityForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const city = els.cityInput.value.trim();
  if (!city) {
    showToast('请输入城市名称。');
    return;
  }

  try {
    await loadOverview({ city });
  } catch (error) {
    showToast(`查询失败：${error.message}`);
  }
});

async function bootstrap() {
  startClock();
  if (runtime.isNativeApp) {
    const base = runtime.apiBaseUrl || '(未配置)';
    showToast(`App 接口地址：${base}`);
  }
  try {
    await loadFromGeolocation();
  } catch (error) {
    showToast(`初始化失败：${error.message}`);
  }

  if (!state.overview) {
    try {
      await loadOverview({ city: '北京' });
    } catch (error) {
      showToast(`默认城市加载失败：${error.message}`);
    }
  }
}

bootstrap();
