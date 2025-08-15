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
    const response = await fetch('/api/church-data');
    const data = await response.json();
    
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

    map.on('load', () => {
        console.log('🚀 Map loaded, creating icons IMMEDIATELY...');
        
        // CREATE ICONS IMMEDIATELY - FIRST THING!
        const iconConfig = [
            { name: 'pope-icon', color: '#ef5350', symbol: '♛' },
            { name: 'saint-icon', color: '#66bb6a', symbol: '✝' },
            { name: 'miracle-icon', color: '#42a5f5', symbol: '★' }
        ];
        
        iconConfig.forEach(config => {
            const size = 48;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            // Draw filled circle
            ctx.fillStyle = config.color;
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2 - 2, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw white border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw symbol
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.symbol, size/2, size/2);
            
            // Add to map IMMEDIATELY
            const imgData = ctx.getImageData(0, 0, size, size);
            map.addImage(config.name, imgData);
            console.log(`✅ CREATED ${config.name} with symbol ${config.symbol}`);
        });
        
        // IMMEDIATELY AFTER ICONS - CREATE LAYERS
        createAllLayers(data);
        
        // THEN TRY TO LOAD REAL IMAGES (background task)
        setTimeout(() => {
            ['popes.png', 'saints.png', 'miracles.png'].forEach((filename, index) => {
                const iconName = ['pope-icon', 'saint-icon', 'miracle-icon'][index];
                map.loadImage(filename, (err, img) => {
                    if (!err && img) {
                        if (map.hasImage(iconName)) {
                            map.removeImage(iconName);
                        }
                        map.addImage(iconName, img);
                        console.log(`🎨 Replaced ${iconName} with real PNG`);
                    } else {
                        console.log(`ℹ️ Using symbol for ${iconName} (PNG not found)`);
                        // Try backup icons from HTML if available
                        if (window.backupIcons && window.backupIcons[iconName]) {
                            const img = new Image();
                            img.onload = () => {
                                if (map.hasImage(iconName)) {
                                    map.removeImage(iconName);
                                }
                                map.addImage(iconName, img);
                                console.log(`🔄 Used backup ${iconName}`);
                            };
                            img.src = window.backupIcons[iconName];
                        }
                    }
                });
            });
        }, 100); // Small delay to ensure layers are created first
        
        // Initialize UI
        initializeUI();
    });
}

// STEP 2: Create all layers (icons are guaranteed to exist)
function createAllLayers(data) {
    console.log('🏗️ Creating layers with existing icons...');
    
    for (const [category, entries] of Object.entries(data)) {
        const geojson = {
            type: 'FeatureCollection',
            features: entries.map((item, i) => ({
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

        // Add source
        map.addSource(sourceId, {
            type: 'geojson',
            data: geojson,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 25
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
                    'step', ['get', 'point_count'],
                    10, 10, 12, 30, 14, 100, 16
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
            }
        });

        // Add count layer
        map.addLayer({
            id: countLayerId,
            type: 'symbol',
            source: sourceId,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['Noto Sans Regular'],
                'text-size': 12
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 1
            }
        });

        // Add individual points layer - ICONS EXIST!
        map.addLayer({
            id: unclusteredLayerId,
            type: 'symbol',
            source: sourceId,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': getCategoryIcon(category),
                'icon-size': 0.1,
                'icon-allow-overlap': true,
                'icon-anchor': 'bottom'
            }
        });

        // Add event handlers
        addEventHandlers(category, clusterLayerId, unclusteredLayerId, sourceId);
    }
    
    console.log('✅ All layers created successfully');
}

// STEP 4: Initialize UI elements
function initializeUI() {
    document.getElementById('toggle-popes').checked = true;
    document.getElementById('toggle-saints').checked = true;
    document.getElementById('toggle-miracles').checked = true;
    document.getElementById('legend-v2').style.display = 'block';
    console.log('✅ UI initialized');
}

// Add event handlers for clusters and points
function addEventHandlers(category, clusterLayerId, unclusteredLayerId, sourceId) {
    // Cluster click handler
    map.on('click', clusterLayerId, e => {
        const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
        if (!features.length) return;
        
        const currentZoom = map.getZoom();
        const coordinates = features[0].geometry.coordinates.slice();
        const targetZoom = Math.min(currentZoom + 5, 18);
        
        console.log(`🎯 Zooming from ${currentZoom} to ${targetZoom}`);
        
        map.flyTo({
            center: coordinates,
            zoom: targetZoom,
            duration: 1500
        });
    });

    // Point click handler
    map.on('click', unclusteredLayerId, e => {
        showPopupForCategory(category, e);
    });

    // Cursor handlers
    map.on('mouseenter', clusterLayerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', clusterLayerId, () => map.getCanvas().style.cursor = '');
    map.on('mouseenter', unclusteredLayerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', unclusteredLayerId, () => map.getCanvas().style.cursor = '');
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
            return ['step', ['get', 'point_count'],
                '#ffcdd2', 10, '#ef5350', 30, '#e53935', 100, '#c62828'];
        case 'saints':
            return ['step', ['get', 'point_count'],
                '#c8e6c9', 10, '#66bb6a', 30, '#4caf50', 100, '#2e7d32'];
        case 'miracles':
            return ['step', ['get', 'point_count'],
                '#bbdefb', 10, '#42a5f5', 30, '#2196f3', 100, '#1565c0'];
        default:
            return ['step', ['get', 'point_count'],
                '#eeeeee', 10, '#bdbdbd', 30, '#9e9e9e', 100, '#616161'];
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

// Show popup for category
function showPopupForCategory(category, e) {
    const props = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates;
    let html = '';
    
    if (category === 'popes') {
        const source = map.getSource(`${category}-source`);
        const allPopes = source._data.features;
        const sameLocationPopes = allPopes.filter(f =>
            Math.abs(f.geometry.coordinates[0] - coords[0]) < 0.00001 &&
            Math.abs(f.geometry.coordinates[1] - coords[1]) < 0.00001
        );

        if (sameLocationPopes.length <= 1) {
            const formatDate = (value) => {
                const date = new Date(value);
                return isNaN(date.getTime()) ? value : date.toDateString();
            };
            
            html = `<div class="pope-card">
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
            </div>`;
        } else {
            html = `<div class="carousel-container">
                <div id="pope-carousel-content" class="pope-card"></div>
                <div class="carousel-controls" style="text-align: center; margin-top: 10px;">
                    <button class="carousel-button left" onclick="prevPope('${category}')">&#10094;</button>
                    <span id="carousel-counter" style="margin: 0 10px; font-weight: bold; color: #003366;"></span>
                    <button class="carousel-button right" onclick="nextPope('${category}')">&#10095;</button>
                </div>
            </div>`;
            window.popeCarouselData = { index: 0, popes: sameLocationPopes };
        }

        new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
        if (sameLocationPopes.length > 1) updatePopeCarousel(category);
    }
    else if (category === 'saints') {
        const source = map.getSource(`${category}-source`);
        const allSaints = source._data.features;
        const sameLocationSaints = allSaints.filter(f =>
            Math.abs(f.geometry.coordinates[0] - coords[0]) < 0.00001 &&
            Math.abs(f.geometry.coordinates[1] - coords[1]) < 0.00001
        );
        
        const feastDateFormatted = props['Feast'] ? (() => {
            const [month, day] = props['Feast'].toString().split('.').map(Number);
            if (!month || !day) return '';
            const date = new Date(1970, month - 1, day);
            return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
        })() : '';

        const formatDate = (value) => {
            const date = new Date(value);
            return isNaN(date.getTime()) ? value : date.toDateString();
        };

        if (sameLocationSaints.length <= 1) {
            html = `<div class="pope-card">
                <div class="pope-card-header">${fE(props.Name)}</div>
                <div><strong>Born Date:</strong> ${props['Born2'] ? formatDate(props['Born']) : ''}</div>
                <div><strong>Born Location:</strong> ${fE(props['Born Location']) || ''}</div>
                <div><strong>Country:</strong> ${props['Country'] || ''}</div>
                <div><strong>Died Date:</strong> ${props['Died2'] ? formatDate(props['Died']) : ''}</div>
                <div><strong>Died Location:</strong> ${fE(props['Died Location']) || ''}</div>
                <div><strong>Feast Date:</strong> ${formatDate(feastDateFormatted)}</div>
                <div><strong>Beatified:</strong> ${props['Beatified'] ? formatDate(props['Beatified']) : ''}</div>
                <div><strong>Beatified Location:</strong> ${props['Beatified Location'] || ''}</div>
                <div><strong>Canonized:</strong> ${props['Canonised'] ? formatDate(props['Canonised']) : ''}</div>
                <div><strong>Bio:</strong> ${fE(props['Bio']) || ''}</div>
            </div>`;
        } else {
            html = `<div class="carousel-container">
                <div id="pope-carousel-content" class="pope-card"></div>
                <div class="carousel-controls" style="text-align: center; margin-top: 10px;">
                    <button class="carousel-button left" onclick="prevPope('${category}')">&#10094;</button>
                    <span id="carousel-counter" style="margin: 0 10px; font-weight: bold; color: #003366;"></span>
                    <button class="carousel-button right" onclick="nextPope('${category}')">&#10095;</button>
                </div>
            </div>`;
            window.popeCarouselData = { index: 0, popes: sameLocationSaints };
        }

        new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
        if (sameLocationSaints.length > 1) updatePopeCarousel(category);
    } 
    else if (category === 'miracles') {
        html = `<div class="pope-card">
            <div class="pope-card-header">Miracle Summary</div>
            <div><strong>Miracle:</strong> ${props.Summary || ''}</div>
            <div><strong>Location:</strong> ${props.Location || ''}</div>
            <div><strong>Date:</strong> ${props.Date ? new Date(props.Date).toDateString() : ''}</div>
            <div><strong>Details:</strong> ${props['Additional Details'] || ''}</div>
            <div><strong>Summaries:</strong> ${props['Summaries'] || ''}</div>
        </div>`;
        new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
    }
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
        fetchSaints()
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
        currentList.filter(item =>
            (item['Papal Name'] && item['Papal Name'].toLowerCase().includes(query)) ||
            (item['Actual Name'] && item['Actual Name'].toLowerCase().includes(query)) ||
            (item['Birth Place'] && item['Birth Place'].toLowerCase().includes(query)) ||
            (item.Country && item.Country.toLowerCase().includes(query))
        ).forEach((item, i) => {
            const li = document.createElement('li');
            li.classList.add('church-item');
            li.innerHTML = `
                <div class="church-title">${item["Papal Name"] || item.Name || `Item ${i + 1}`}</div>
                <div class="church-details">
                    <strong>Actual Name:</strong> ${item["Actual Name"] || ""}<br>
                    <strong>Country:</strong> ${item["Country"] || ""}
                </div>`;
            li.onclick = () => {
                if (item.Latitude && item.Longitude) {
                    toggleMenu();
                    map.flyTo({
                        center: [parseFloat(item.Longitude), parseFloat(item.Latitude)],
                        zoom: 22
                    });
                }
            };
            listContainer.appendChild(li);
        });
    } else if (currentCategory === "miracles") {
        currentList.filter(item =>
            (item.Summary && item.Summary.toLowerCase().includes(query)) ||
            (item.Country2 && item.Country2.toLowerCase().includes(query)) ||
            (item.Location && item.Location.toLowerCase().includes(query))
        ).forEach((item, i) => {
            const li = document.createElement('li');
            li.classList.add('church-item');
            li.innerHTML = `
                <div class="church-title">${item["Summary"] || item.Summary}</div>
                <div class="church-details">
                    <strong>Location:</strong> ${item["Location"] || ""}<br>
                    <strong>Country:</strong> ${item["Country2"] || ""}
                </div>`;
            li.onclick = () => {
                if (item.Latitude && item.Longitude) {
                    toggleMenu();
                    map.flyTo({
                        center: [parseFloat(item.Longitude), parseFloat(item.Latitude)],
                        zoom: 22
                    });
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
            </div>`;
        li.onclick = () => {
            if (saint.Latitude && saint.Longitude) {
                toggleMenu();
                map.flyTo({
                    center: [parseFloat(saint.Longitude), parseFloat(saint.Latitude)],
                    zoom: 22
                });
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
        container.innerHTML = `<div class="pope-card" style="height: 370px; overflow-y: auto;">
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
        </div>`;
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
        
        container.innerHTML = `<div class="pope-card" style="height: 370px; overflow-y: auto;">
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
        </div>`;
    }

    const counter = document.getElementById('carousel-counter');
    counter.textContent = `${data.index + 1} of ${data.popes.length}`;
}

function prevPope(x) {
    if (!window.popeCarouselData) return;
    window.popeCarouselData.index =
        (window.popeCarouselData.index - 1 + window.popeCarouselData.popes.length) %
        window.popeCarouselData.popes.length;
    updatePopeCarousel(x);
}

function nextPope(x) {
    if (!window.popeCarouselData) return;
    window.popeCarouselData.index =
        (window.popeCarouselData.index + 1) %
        window.popeCarouselData.popes.length;
    updatePopeCarousel(x);
}

// Fix encoding function
function fE(str) {
    try {
        const fixed = decodeURIComponent(escape(str));
        if (/[\u0080-\uFFFF]/.test(str) && !/[\u0080-\uFFFF]/.test(fixed)) {
            return str;
        }
        return fixed;
    } catch (e) {
        return str;
    }
}
