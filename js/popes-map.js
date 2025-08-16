// --- Global Variables ---
let map;
let metadata;
let allChurches;
let filteredChurches = [];
let sourceLayerId = 'parishes';
const churchLayerId = 'churches-layer';
const clusterLayerId = 'clusters';
const clusterCountLayerId = 'cluster-count';
const categoryLayers = {};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
  initMap();
});

//----------------------------------------------------------------------------------------------------------------------
async function initMap() {
  console.log('🚀 Starting map initialization...');
  try {
    console.log('📡 Fetching church data from /api/church-data...');
    const response = await fetch('/api/church-data');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    console.log('✅ Data fetched successfully:', {
      categories: Object.keys(data),
      totalEntries: Object.values(data).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
      )
    });

    // Log sample entries for debugging
    Object.entries(data).forEach(([category, entries]) => {
      if (Array.isArray(entries) && entries.length > 0) {
        console.log(`📋 Sample ${category} entry:`, entries[0]);
      }
    });

    map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          osm_standard: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
            minzoom: 0,
            maxzoom: 19
          },
          carto_positron: {
            type: 'raster',
            tiles: [
              'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
              'https://cartodb-basemaps-b.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
              'https://cartodb-basemaps-c.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© CARTO © OpenStreetMap contributors',
            minzoom: 0,
            maxzoom: 18
          },
          carto_dark: {
            type: 'raster',
            tiles: [
              'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
              'https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
              'https://cartodb-basemaps-c.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© CARTO © OpenStreetMap contributors',
            minzoom: 0,
            maxzoom: 18
          },
          wikimedia: {
            type: 'raster',
            tiles: ['https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, Wikimedia maps',
            minzoom: 0,
            maxzoom: 18
          },
          stamen_terrain: {
            type: 'raster',
            tiles: [
              'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
              'https://stamen-tiles.b.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
              'https://stamen-tiles.c.ssl.fastly.net/terrain/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: 'Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap contributors',
            minzoom: 0,
            maxzoom: 18
          }
        },
        layers: [
          { id: 'base-tiles', type: 'raster', source: 'carto_dark' }
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
      },
      center: [0, 0],
      zoom: 2,
      worldCopyJump: true
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // Add geolocation control
    const geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.addControl(geolocateControl, 'top-left');

    // Add basemap switcher control
    addBasemapSwitcher();

    // Load icons and create layers
    map.on('load', () => {
      console.log('🗺️ Map loaded, starting icon and layer creation...');
      loadIconsInSequence(data);
    });
  } catch (error) {
    console.error('❌ Error initializing map:', error);
    document.getElementById('map').innerHTML = `
      <div style="padding: 20px; color: white; background: rgba(255,0,0,0.8); margin: 20px; border-radius: 8px;">
        <h3>Error Loading Map</h3>
        <p>Failed to load church data: ${error.message}</p>
        <p>Please check the console for more details.</p>
      </div>
    `;
  }
}

// Use only the reliable icon loading method
function loadIconsInSequence(data) {
  console.log('📸 Loading icons via reliable Image object method...');
  const iconConfigs = [
    { file: 'popes.png', name: 'pope-icon' },
    { file: 'saints.png', name: 'saint-icon' },
    { file: 'miracles.png', name: 'miracle-icon' }
  ];

  let loadedCount = 0;
  let successfullyLoaded = [];

  iconConfigs.forEach(config => {
    console.log(`📸 Loading ${config.name} via Image object...`);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      console.log(`✅ ${config.name} loaded successfully (${img.width}x${img.height})`);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (map.hasImage(config.name)) {
          map.removeImage(config.name);
        }
        map.addImage(config.name, imageData);
        console.log(`✅ ${config.name} added to map successfully`);

        successfullyLoaded.push(config.name);
        loadedCount++;
        if (loadedCount === iconConfigs.length) {
          console.log('🎯 All icons loaded successfully:', successfullyLoaded);
          createAllLayers(data);
          initializeUI();
        }
      } catch (e) {
        console.error(`❌ Error processing ${config.name}:`, e);
        loadedCount++;
        if (loadedCount === iconConfigs.length) {
          if (successfullyLoaded.length > 0) {
            createAllLayers(data);
            initializeUI();
          }
        }
      }
    };

    img.onerror = (e) => {
      console.error(`❌ Failed to load ${config.file}:`, e);
      img.src = '../' + config.file;
      img.onerror = () => {
        console.error(`❌ Also failed: ../${config.file}`);
        loadedCount++;
        if (loadedCount === iconConfigs.length) {
          if (successfullyLoaded.length > 0) {
            createAllLayers(data);
            initializeUI();
          } else {
            console.error('❌ No icons could be loaded. Check if PNG files exist.');
          }
        }
      };
    };

    img.src = config.file;
  });
}

// Create layers with exact same settings as working churches site
function createAllLayers(data) {
  console.log('🏗️ Creating layers with exact working settings...');

  for (const [category, entries] of Object.entries(data)) {
    console.log(`🔄 Processing ${category}: ${entries.length} entries`);

    const validEntries = entries.filter(item =>
      item.Longitude && item.Latitude &&
      !isNaN(parseFloat(item.Longitude)) &&
      !isNaN(parseFloat(item.Latitude))
    );
    console.log(`✅ Valid entries for ${category}: ${validEntries.length}/${entries.length}`);
    if (validEntries.length === 0) {
      console.warn(`⚠️ No valid coordinates found for ${category}`);
      continue;
    }

    const geojson = {
      type: 'FeatureCollection',
      features: validEntries.map((item, i) => ({
        type: 'Feature',
        id: `${category}-${i}`,
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(item.Longitude), parseFloat(item.Latitude)]
        },
        properties: { ...item, category }
      }))
    };

    const sourceId = `${category}-source`;
    const clusterLayerId = `${category}-clusters`;
    const countLayerId = `${category}-cluster-counts`;
    const unclusteredLayerId = `${category}-points`;

    categoryLayers[category] = [clusterLayerId, countLayerId, unclusteredLayerId];

    console.log(`🗂️ Adding source ${sourceId} with ${geojson.features.length} features`);

    // Add source with clustering
    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    // Add cluster layer
    map.addLayer({
      id: clusterLayerId,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': getClusterColor(category),
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          10,   10, 12,
          30,   14,
          100,  16
        ]
      }
    });

    // Add count (number) layer
    map.addLayer({
      id: countLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Regular'],
        'text-size': 12
      }
    });

    // Add individual points layer
    map.addLayer({
      id: unclusteredLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': getCategoryIcon(category),
        'icon-size': 0.07,
        'icon-allow-overlap': false,
        'icon-anchor': 'bottom'
      }
    });

    // Add event handlers
    addEventHandlers(category, clusterLayerId, countLayerId, unclusteredLayerId, sourceId);
  }

  console.log('✅ All layers created successfully!');
}

// Add event handlers for clusters and points
function addEventHandlers(category, clusterLayerId, countLayerId, unclusteredLayerId, sourceId) {
  // --- Cluster click handlers (circle & number) ---
  const handleClusterClick = (e) => {
    const feature = e.features && e.features[0];
    if (!feature) return;

    const clusterId = feature.properties.cluster_id;
    const coords = feature.geometry.coordinates;

    map.getSource(sourceId).getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) {
        console.error('Cluster expansion error:', err);
        return;
      }
      map.easeTo({ center: coords, zoom });
    });
  };

  // Bind to BOTH cluster circle and count text layers
  map.on('click', clusterLayerId, handleClusterClick);
  map.on('click', countLayerId, handleClusterClick);

  // Cursor handlers for clusters (circle & count)
  const setPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
  const unsetPointer = () => { map.getCanvas().style.cursor = ''; };

  map.on('mouseenter', clusterLayerId, setPointer);
  map.on('mouseleave', clusterLayerId, unsetPointer);
  map.on('mouseenter', countLayerId, setPointer);
  map.on('mouseleave', countLayerId, unsetPointer);

  // --- Individual point click handler ---
  map.on('click', unclusteredLayerId, e => {
    e.preventDefault();
    console.log('📍 Individual point clicked, showing popup...');
    if (!e.features || !e.features.length) {
      console.error('❌ No features found in point click');
      return;
    }

    const feature = e.features[0];
    const coordinates = feature.geometry.coordinates.slice();
    const properties = { ...feature.properties };

    console.log('📋 Stored feature data:', { coordinates, properties });

    const storedEvent = {
      features: [{
        geometry: { coordinates: coordinates },
        properties: properties
      }]
    };

    map.flyTo({
      center: coordinates,
      zoom: Math.max(map.getZoom(), 10),
      duration: 500,
      essential: true
    });

    setTimeout(() => {
      console.log('🎪 Showing popup with stored data...');
      showPopupForCategory(category, storedEvent);
    }, 550);
  });

  // Cursor handlers for points
  map.on('mouseenter', unclusteredLayerId, setPointer);
  map.on('mouseleave', unclusteredLayerId, unsetPointer);
}

// Initialize UI elements
function initializeUI() {
  document.getElementById('toggle-popes').checked = true;
  document.getElementById('toggle-saints').checked = true;
  document.getElementById('toggle-miracles').checked = true;
  document.getElementById('legend-v2').style.display = 'block';
  console.log('✅ UI initialized');
}

// Add basemap switcher
function addBasemapSwitcher() {
  const basemaps = {
    'Dark': 'carto_dark',
    'Light': 'carto_positron',
    'Street': 'osm_standard',
    'Terrain': 'stamen_terrain',
    'Wiki': 'wikimedia'
  };

  const switcher = document.createElement('div');
  switcher.className = 'maplibregl-ctrl maplibregl-ctrl-group';
  switcher.style.cssText = 'background: white; border-radius: 4px; box-shadow: 0 0 10px rgba(0,0,0,0.1);';

  const select = document.createElement('select');
  select.style.cssText = 'border: none; background: transparent; padding: 5px; font-size: 12px; cursor: pointer;';

  Object.entries(basemaps).forEach(([name, source]) => {
    const option = document.createElement('option');
    option.value = source;
    option.textContent = name;
    if (source === 'carto_dark') option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', (e) => {
    map.getLayer('base-tiles') && map.removeLayer('base-tiles');
    map.addLayer({ id: 'base-tiles', type: 'raster', source: e.target.value }, 'background');
  });

  switcher.appendChild(select);
  map.addControl({ onAdd: () => switcher, onRemove: () => {} }, 'top-right');
}

// Get cluster colors
function getClusterColor(category) {
  switch (category) {
    case 'popes':
      return ['step', ['get', 'point_count'], '#ffebee', 10, '#ef9a9a', 30, '#e57373', 100, '#c62828'];
    case 'saints':
      return ['step', ['get', 'point_count'], '#e8f5e9', 10, '#a5d6a7', 30, '#66bb6a', 100, '#2e7d32'];
    case 'miracles':
      return ['step', ['get', 'point_count'], '#e3f2fd', 10, '#90caf9', 30, '#42a5f5', 100, '#1565c0'];
    default:
      return ['step', ['get', 'point_count'], '#eeeeee', 10, '#bdbdbd', 30, '#9e9e9e', 100, '#616161'];
  }
}

// Get category icon name
function getCategoryIcon(category) {
  switch (category) {
    case 'popes': return 'pope-icon';
    case 'saints': return 'saint-icon';
    case 'miracles': return 'miracle-icon';
    default: return 'miracle-icon';
  }
}

// Show popup for category with better error handling
function showPopupForCategory(category, e) {
  console.log('🎪 showPopupForCategory called for:', category);
  if (!e || !e.features || !e.features.length) {
    console.error('❌ Invalid event object or no features found');
    return;
  }

  const feature = e.features[0];
  if (!feature || !feature.properties || !feature.geometry) {
    console.error('❌ Invalid feature structure');
    return;
  }

  const props = feature.properties;
  const coords = feature.geometry.coordinates;

  console.log('📋 Feature properties:', props);
  console.log('📍 Coordinates:', coords);

  let html = '';

  if (category === 'popes') {
    const source = map.getSource(`${category}-source`);
    if (!source || !source._data || !source._data.features) {
      console.error('❌ Invalid source data for popes');
      return;
    }

    const allPopes = source._data.features;
    const sameLocationPopes = allPopes.filter(f =>
      f.geometry && f.geometry.coordinates &&
      Math.abs(f.geometry.coordinates[0] - coords[0]) < 0.00001 &&
      Math.abs(f.geometry.coordinates[1] - coords[1]) < 0.00001
    );

    if (sameLocationPopes.length <= 1) {
      const formatDate = (value) => {
        if (!value) return '';
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toDateString();
      };

      html = `
        <div class="pope-card">
          <div class="pope-card-header">${props['Papal Name'] || 'Unknown Pope'}</div>
          <div><strong>Actual Name:</strong> ${props['Actual Name'] || 'N/A'}</div>
          <div><strong>Number:</strong> ${props['Pope Number'] || 'N/A'}</div>
          <div><strong>Birth Place:</strong> ${props['Birth Place'] || 'N/A'}</div>
          <div><strong>Country:</strong> ${props['Country'] || 'N/A'}</div>
          <div><strong>Birth Day:</strong> ${props['Birthday2'] ? formatDate(props['Birthday2']) : 'N/A'}</div>
          <div><strong>Elected Date:</strong> ${props['Elected Date2'] ? formatDate(props['Elected Date2']) : 'N/A'}</div>
          <div><strong>Election Age:</strong> ${props['Age at Election'] || 'N/A'}</div>
          <div><strong>Installed Date:</strong> ${props['Installed Date'] ? formatDate(props['Installed Date']) : 'N/A'}</div>
          <div><strong>Installation Age:</strong> ${props['Age at Installation'] || 'N/A'}</div>
          <div><strong>End of Reign:</strong> ${props['End of Reign Date'] ? formatDate(props['End of Reign Date']) : 'N/A'}</div>
          <div><strong>End of Reign Age:</strong> ${props['End of Reign Age'] || 'N/A'}</div>
          <div><strong>Length:</strong> ${props['Length'] || 'N/A'}</div>
          <div><strong>Century:</strong> ${props['Century'] || 'N/A'}</div>
        </div>
      `;
    } else {
      html = `
        <div class="carousel-container">
          <div id="pope-carousel-content" class="pope-card"></div>
          <div class="carousel-controls" style="text-align: center; margin-top: 10px;">
            <button class="carousel-button left" onclick="prevPope('${category}')">&#10094;</button>
            <span id="carousel-counter" style="margin: 0 10px; font-weight: bold; color: #003366;"></span>
            <button class="carousel-button right" onclick="nextPope('${category}')">&#10095;</button>
          </div>
        </div>
      `;
      window.popeCarouselData = { index: 0, popes: sameLocationPopes };
    }

    new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
    if (sameLocationPopes.length > 1) updatePopeCarousel(category);

  } else if (category === 'saints') {
    const source = map.getSource(`${category}-source`);
    if (!source || !source._data || !source._data.features) {
      console.error('❌ Invalid source data for saints');
      return;
    }

    const allSaints = source._data.features;
    const sameLocationSaints = allSaints.filter(f =>
      f.geometry && f.geometry.coordinates &&
      Math.abs(f.geometry.coordinates[0] - coords[0]) < 0.00001 &&
      Math.abs(f.geometry.coordinates[1] - coords[1]) < 0.00001
    );

    const feastDateFormatted = props['Feast'] ? (() => {
      try {
        const [month, day] = props['Feast'].toString().split('.').map(Number);
        if (!month || !day) return '';
        const date = new Date(1970, month - 1, day);
        return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
      } catch (e) {
        return props['Feast'];
      }
    })() : '';

    const formatDate = (value) => {
      if (!value) return '';
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date.toDateString();
    };

    if (sameLocationSaints.length <= 1) {
      html = `
        <div class="pope-card">
          <div class="pope-card-header">${fE(props.Name) || 'Unknown Saint'}</div>
          <div><strong>Born Date:</strong> ${props['Born2'] ? formatDate(props['Born']) : 'N/A'}</div>
          <div><strong>Born Location:</strong> ${fE(props['Born Location']) || 'N/A'}</div>
          <div><strong>Country:</strong> ${props['Country'] || 'N/A'}</div>
          <div><strong>Died Date:</strong> ${props['Died2'] ? formatDate(props['Died']) : 'N/A'}</div>
          <div><strong>Died Location:</strong> ${fE(props['Died Location']) || 'N/A'}</div>
          <div><strong>Feast Date:</strong> ${feastDateFormatted || 'N/A'}</div>
          <div><strong>Beatified:</strong> ${props['Beatified'] ? formatDate(props['Beatified']) : 'N/A'}</div>
          <div><strong>Beatified Location:</strong> ${props['Beatified Location'] || 'N/A'}</div>
          <div><strong>Canonized:</strong> ${props['Canonised'] ? formatDate(props['Canonised']) : 'N/A'}</div>
          <div><strong>Bio:</strong> ${fE(props['Bio']) || 'N/A'}</div>
        </div>
      `;
    } else {
      html = `
        <div class="carousel-container">
          <div id="pope-carousel-content" class="pope-card"></div>
          <div class="carousel-controls" style="text-align: center; margin-top: 10px;">
            <button class="carousel-button left" onclick="prevPope('${category}')">&#10094;</button>
            <span id="carousel-counter" style="margin: 0 10px; font-weight: bold; color: #003366;"></span>
            <button class="carousel-button right" onclick="nextPope('${category}')">&#10095;</button>
          </div>
        </div>
      `;
      window.popeCarouselData = { index: 0, popes: sameLocationSaints };
    }

    new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
    if (sameLocationSaints.length > 1) updatePopeCarousel(category);

  } else if (category === 'miracles') {
    html = `
      <div class="pope-card">
        <div class="pope-card-header">Miracle Summary</div>
        <div><strong>Miracle:</strong> ${props.Summary || 'N/A'}</div>
        <div><strong>Location:</strong> ${props.Location || 'N/A'}</div>
        <div><strong>Date:</strong> ${props.Date ? new Date(props.Date).toDateString() : 'N/A'}</div>
        <div><strong>Details:</strong> ${props['Additional Details'] || 'N/A'}</div>
        <div><strong>Summaries:</strong> ${props['Summaries'] || 'N/A'}</div>
      </div>
    `;
    new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
  } else {
    console.error('❌ Unknown category:', category);
    return;
  }

  console.log('✅ Popup created successfully for category:', category);
}

// Search and filtering functions
let CSVall = {};
let currentList = [];
let currentCategory = '';

async function fetchData() {
  const response = await fetch('/api/church-data');
  CSVall = await response.json();
}
fetchData();

function toggleMenu() {
  const panel = document.getElementById('panel-v2');
  panel.classList.toggle('show');
}

function selectCategory(category) {
  currentCategory = category;
  const listContainer = document.getElementById('dataList');
  listContainer.innerHTML = '';
  const paginationEl = document.getElementById('paginationContainer');
  const searchBox = document.getElementById('searchBox');
  searchBox.placeholder = `Search ${capitalize(category)}...`;

  if (category === 'saints') {
    saintSearch = { name: '', country: '', page: 1 };
    fetchSaints();
    paginationEl.style.display = 'block';
  } else {
    filterList(category);
    paginationEl.style.display = 'none';
  }
}

function filterQuest(){
  if (currentCategory === 'saints'){
    fetchSaints();
  } else {
    filterList(currentCategory);
  }
}

function filterList(category) {
  const query = document.getElementById('searchBox').value.toLowerCase();
  const listContainer = document.getElementById('dataList');
  listContainer.innerHTML = '';
  currentList = CSVall[category] || [];

  if (category === "popes"){
    currentList
      .filter(item =>
        (item['Papal Name'] && item['Papal Name'].toLowerCase().includes(query)) ||
        (item['Actual Name'] && item['Actual Name'].toLowerCase().includes(query)) ||
        (item['Birth Place'] && item['Birth Place'].toLowerCase().includes(query)) ||
        (item.Country && item.Country.toLowerCase().includes(query))
      )
      .forEach((item, i) => {
        const li = document.createElement('li');
        li.classList.add('church-item');
        li.innerHTML = `
          <div class="church-title">${item["Papal Name"] || item.Name || `Item ${i + 1}`}</div>
          <div class="church-details">
            <strong>Actual Name:</strong> ${item["Actual Name"] || ""}<br>
            <strong>Country:</strong> ${item["Country"] || ""}
          </div>
        `;
        li.onclick = () => {
          if (item.Latitude && item.Longitude) {
            toggleMenu();
            map.flyTo({ center: [parseFloat(item.Longitude), parseFloat(item.Latitude)], zoom: 22 });
          }
        };
        listContainer.appendChild(li);
      });
  } else if (currentCategory === "miracles") {
    currentList
      .filter(item =>
        (item.Summary && item.Summary.toLowerCase().includes(query)) ||
        (item.Country2 && item.Country2.toLowerCase().includes(query)) ||
        (item.Location && item.Location.toLowerCase().includes(query))
      )
      .forEach((item, i) => {
        const li = document.createElement('li');
        li.classList.add('church-item');
        li.innerHTML = `
          <div class="church-title">${item["Summary"] || item.Summary}</div>
          <div class="church-details">
            <strong>Location:</strong> ${item["Location"] || ""}<br>
            <strong>Country:</strong> ${item["Country2"] || ""}
          </div>
        `;
        li.onclick = () => {
          if (item.Latitude && item.Longitude) {
            toggleMenu();
            map.flyTo({ center: [parseFloat(item.Longitude), parseFloat(item.Latitude)], zoom: 22 });
          }
        };
        listContainer.appendChild(li);
      });
  } else if (currentCategory === "saints") {
    fetchSaints();
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Saints search with pagination
let saintSearch = { name: '', page: 1 };

async function fetchSaints() {
  const params = new URLSearchParams({
    name: saintSearch.name,
    country: saintSearch.country,
    born: saintSearch.born,
    page: saintSearch.page
  });
  const res = await fetch(`/filter-saints?${params}`);
  const json = await res.json();
  displaySaints(json.saints);
  updatePagination(json.pagination);
}

function displaySaints(saints) {
  const ul = document.getElementById('dataList');
  ul.innerHTML = '';
  saints.forEach(saint => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="church-title">${saint["Name"] || ""}</div>
      <div class="church-details">
        <strong>Country:</strong> ${saint["Country"] || ""} <br>
        <strong>Bio:</strong> ${saint["Bio"] || ""}
      </div>
    `;
    li.onclick = () => {
      if (saint.Latitude && saint.Longitude) {
        toggleMenu();
        map.flyTo({ center: [parseFloat(saint.Longitude), parseFloat(saint.Latitude)], zoom: 22 });
      }
    };
    ul.appendChild(li);
  });
}

function updatePagination(pagination) {
  document.getElementById('pageInfo').textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
  document.getElementById('paginationContainer').dataset.totalPages = pagination.totalPages;
}

function prevPage() {
  if (saintSearch.page > 1) {
    saintSearch.page--;
    fetchSaints();
  }
}

function nextPage() {
  const totalPages = parseInt(document.getElementById('paginationContainer').dataset.totalPages);
  if (saintSearch.page < totalPages) {
    saintSearch.page++;
    fetchSaints();
  }
}

// Search input binding
document.getElementById('searchBox').addEventListener('input', (e) => {
  saintSearch.name = e.target.value;
  saintSearch.country = e.target.value;
  saintSearch.born = e.target.value;
  saintSearch.page = 1;
  filterQuest();
});

// Toggle category visibility
function toggleCategory(category, visible) {
  if (!categoryLayers[category]) return;
  for (const layerId of categoryLayers[category]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

document.getElementById('toggle-popes').addEventListener('change', function(e) {
  toggleCategory('popes', e.target.checked);
});
document.getElementById('toggle-saints').addEventListener('change', function(e) {
  toggleCategory('saints', e.target.checked);
});
document.getElementById('toggle-miracles').addEventListener('change', function(e) {
  toggleCategory('miracles', e.target.checked);
});

// Carousel functions
function updatePopeCarousel(x) {
  const container = document.getElementById('pope-carousel-content');
  const data = window.popeCarouselData;
  if (!data || !data.popes || !data.popes.length) return;

  const props = data.popes[data.index].properties;

  if (x==="popes"){
    const formatDate = (value) => {
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date.toDateString();
    };
    container.innerHTML = `
      <div class="pope-card" style="height: 370px; overflow-y: auto;">
        <div class="pope-card-header">${props['Papal Name']}</div>
        <div><strong>Actual Name:</strong> ${props['Actual Name'] || ''}</div>
        <div><strong>Number:</strong> ${props['Pope Number'] || ''}</div>
        <div><strong>Birth Place:</strong> ${props['Birth Place'] || ''}</div>
        <div><strong>Country:</strong> ${props['Country'] || ''}</div>
        <div><strong>Birth Day:</strong> ${props['Birthday2'] ? formatDate(props['Birthday2']) : ''}</div>
        <div><strong>Elected Date:</strong> ${props['Elected Date2'] ? formatDate(props['Elected Date2']) : ''}</div>
        <div><strong>Election Age:</strong> ${props['Age at Election'] || ''}</div>
        <div><strong>Installed Date:</strong> ${props['Installed Date'] ? formatDate(props['Installed Date']) : ''}</div>
        <div><strong>Installation Age:</strong> ${props['Age at Installation'] || ''}</div>
        <div><strong>End of Reign:</strong> ${props['End of Reign Date'] ? formatDate(props['End of Reign Date']) : ''}</div>
        <div><strong>End of Reign Age:</strong> ${props['End of Reign Age'] || ''}</div>
        <div><strong>Length:</strong> ${props['Length'] || ''}</div>
        <div><strong>Century:</strong> ${props['Century'] || ''}</div>
      </div>
    `;
  } else {
    const feastDateFormatted1 = props['Feast'] ? (() => {
      const [month, day] = props['Feast'].toString().split('.').map(Number);
      if (!month || !day) return '';
      const date = new Date(1970, month - 1, day);
      return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
    })() : '';

    const formatDate = (value) => {
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date.toDateString();
    };

    container.innerHTML = `
      <div class="pope-card" style="height: 370px; overflow-y: auto;">
        <div class="pope-card-header">${fE(props.Name)}</div>
        <div><strong>Born Date:</strong> ${props['Born2'] ? formatDate(props['Born']) : ''}</div>
        <div><strong>Born Location:</strong> ${fE(props['Born Location']) || ''}</div>
        <div><strong>Country:</strong> ${props['Country'] || ''}</div>
        <div><strong>Died Date:</strong> ${props['Died2'] ? formatDate(props['Died']) : ''}</div>
        <div><strong>Died Location:</strong> ${fE(props['Died Location']) || ''}</div>
        <div><strong>Feast Date:</strong> ${formatDate(feastDateFormatted1)}</div>
        <div><strong>Beatified:</strong> ${props['Beatified'] ? formatDate(props['Beatified']) : ''}</div>
        <div><strong>Beatified Location:</strong> ${props['Beatified Location'] || ''}</div>
        <div><strong>Canonized:</strong> ${props['Canonised'] ? formatDate(props['Canonised']) : ''}</div>
        <div><strong>Bio:</strong> ${fE(props['Bio']) || ''}</div>
      </div>
    `;
  }

  const counter = document.getElementById('carousel-counter');
  counter.textContent = `${data.index + 1} of ${data.popes.length}`;
}

function prevPope(x) {
  if (!window.popeCarouselData) return;
  window.popeCarouselData.index = (window.popeCarouselData.index - 1 + window.popeCarouselData.popes.length) % window.popeCarouselData.popes.length;
  updatePopeCarousel(x);
}

function nextPope(x) {
  if (!window.popeCarouselData) return;
  window.popeCarouselData.index = (window.popeCarouselData.index + 1) % window.popeCarouselData.popes.length;
  updatePopeCarousel(x);
}

// Fix encoding function with better error handling
function fE(str) {
  if (!str || typeof str !== 'string') {
    return str || '';
  }
  try {
    const fixed = decodeURIComponent(escape(str));
    if (/[\u0080-\uFFFF]/.test(str) && !/[\u0080-\uFFFF]/.test(fixed)) {
      return str;
    }
    return fixed;
  } catch (e) {
    console.warn('Error in fE function:', e);
    return str;
  }
}
