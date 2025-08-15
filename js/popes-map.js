// --- Global Variables ---
let map;
let metadata;
let allChurches; // Holds all features loaded from metadata
let filteredChurches = []; // Holds currently filtered features for the list
let sourceLayerId = 'parishes'; // Default, will be updated from metadata
const churchLayerId = 'churches-layer';
const clusterLayerId = 'clusters';
const clusterCountLayerId = 'cluster-count';
const categoryLayers = {}; // store layer IDs by category for toggling

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    // Load custom icons


    initMap();

});

//----------------------------------------------------------------------------------------------------------------------
async function initMap() {
    const response = await fetch('https://churches.onrender.com/api/church-data');
    const data = await response.json();
    const mapboxAccessToken = 'pk.eyJ1IjoiYWtpcGtlbWJvaTEiLCJhIjoiY205c3cxcmlyMDUyMTJqc2J2czR6bHowayJ9.wvD7qePsNeWZ-S0ShIsKEg';
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                osm: {
                    type: 'raster',
                    tiles: [
                        `https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=${mapboxAccessToken}`
                    ],
                    tileSize: 256
                }
            },
            layers: [
                { id: 'osm-tiles', type: 'raster', source: 'osm' }
            ],
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
        },
        center: [0, 0],
        zoom: 2,
        worldCopyJump: true
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');
                        const geolocateControl = new maplibregl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
    map.addControl(geolocateControl, 'top-left');

    map.on('load', () => {

        // Load custom icons
        map.loadImage('popes.png', (err, img) => {
            if (!err && !map.hasImage('pope-icon')) map.addImage('pope-icon', img);
        });
        map.loadImage('saints.png', (err, img) => {
            if (!err && !map.hasImage('saint-icon')) map.addImage('saint-icon', img);
        });
        map.loadImage('miracles.png', (err, img) => {
            if (!err && !map.hasImage('miracle-icon')) map.addImage('miracle-icon', img);
        });

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

            // Store the relevant layer IDs for toggling later
			categoryLayers[category] = [
				clusterLayerId,
				countLayerId,
				unclusteredLayerId
			];

            map.addSource(sourceId, {
                type: 'geojson',
                data: geojson,
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            });

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
                    ]
                }
            });

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

            map.on('click', unclusteredLayerId, e => showPopupForCategory(category, e));

            map.on('click', clusterLayerId, e => {
                const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
                const clusterId = features[0].properties.cluster_id;
                map.getSource(sourceId).getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    map.easeTo({ center: features[0].geometry.coordinates, zoom });
                });
            });

            map.on('mouseenter', clusterLayerId, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', clusterLayerId, () => map.getCanvas().style.cursor = '');
        }
        document.getElementById('toggle-popes').checked = true;
        document.getElementById('toggle-saints').checked = true;
        document.getElementById('toggle-miracles').checked = true;
        document.getElementById('legend-v2').style.display = 'block';
    });

}

//------------------------------------------------------------------------------------------------------

function getClusterColor(category) {
            switch (category) {
    case 'popes': // 🔴 Shades of red
        return ['step', ['get', 'point_count'],
            '#ffebee', 10,  // lightest red
            '#ef9a9a', 30,  // medium red
            '#e57373', 100, // darker red
            '#c62828'       // darkest red
        ];
    case 'saints': // 🟢 Shades of green
        return ['step', ['get', 'point_count'],
            '#e8f5e9', 10,  // lightest green
            '#a5d6a7', 30,  // medium green
            '#66bb6a', 100, // darker green
            '#2e7d32'       // darkest green
        ];
    case 'miracles': // 🔵 Shades of blue
        return ['step', ['get', 'point_count'],
            '#e3f2fd', 10,  // lightest blue
            '#90caf9', 30,  // medium blue
            '#42a5f5', 100, // darker blue
            '#1565c0'       // darkest blue
        ];
    default: // fallback grey
        return ['step', ['get', 'point_count'],
            '#eeeeee', 10,
            '#bdbdbd', 30,
            '#9e9e9e', 100,
            '#616161'
        ];
}

}

//----------------------------------------------------------------------------------------------------

function getCategoryIcon(category) {
    switch (category) {
        case 'popes': return 'pope-icon';
        case 'saints': return 'saint-icon';
        case 'miracles': return 'miracle-icon';
        default: return 'miracle-icon';
    }
}

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

    let html = '';

    if (sameLocationPopes.length === 0 || sameLocationPopes.length === 1) {
        //console.log('Zero',sameLocationPopes);

        function formatDate(value) {
            const date = new Date(value);
            return isNaN(date.getTime()) ? value : date.toDateString();
        }
        
        html = `
            <div class="pope-card">
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
        //console.log('More',sameLocationPopes);
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

        window.popeCarouselData = {
            index: 0,
            popes: sameLocationPopes
        };
    }

    new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);

    if (sameLocationPopes.length > 1) {
        updatePopeCarousel(category);
    }
    return; // ✅ Prevents a second popup from being added
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
	  const date = new Date(1970, month - 1, day); // Month is 0-based
	  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
	})() : '';

	 function formatDate(value) {
	    const date = new Date(value);
	    return isNaN(date.getTime()) ? value : date.toDateString();
	}

    let html = '';

        if (sameLocationSaints.length === 0 || sameLocationSaints.length === 1) {
            //console.log('Zero',sameLocationSaints);
		html = `
		  <div class="pope-card">
		    <div class="pope-card-header"> ${fE(props.Name)} </div>
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
		  </div>
		`;


    } else {
        //console.log('More',sameLocationSaints);
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

        window.popeCarouselData = {
            index: 0,
            popes: sameLocationSaints
        };
    }

        new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);

        if (sameLocationSaints.length > 1) {
        updatePopeCarousel(category);
    }
      return; // ✅ Prevents a second popup from being added



    } else if (category === 'miracles') {
            html = `
            <div class="pope-card">
                <div class="pope-card-header">
                    Miracle Summary
                </div>
                <div><strong>Miracle:</strong> ${props.Summary || ''}</div>
                <div><strong>Location:</strong> ${props.Location || ''}</div>
                <div><strong>Date:</strong> ${props.Date ? new Date(props.Date).toDateString() : ''}</div>
                <div><strong>Details:</strong> ${props['Additional Details'] || ''}</div>
                <div><strong>Summaries:</strong> ${props['Summaries'] || ''}</div>
            </div>
            `;

    }

    new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
}

//------------------------------------------------------------------------------------------------------------------

function handleClusterClick(e) {
        if (!e.features || !e.features.length) return;
        const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
        if (!features.length) return; // Exit if no cluster feature found

        // Zoom in on cluster click (removed getClusterExpansionZoom)
        map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: map.getZoom() + 2 // Zoom in by 2 levels
        });
}


//-----------------------------------------------------------------------------------------------------//
let CSVall = {};
let currentList = [];

async function fetchData() {
    const response = await fetch('/api/church-data');
    CSVall = await response.json();
}

fetchData();

function toggleMenu() {
    const panel = document.getElementById('panel-v2');
    panel.classList.toggle('show');

    // Clear list and search when closing
    //if (!panel.classList.contains('show')) {
    //document.getElementById('dataList').innerHTML = '';
    //document.getElementById('searchBox').value = '';
    //currentList = [];
    //}
}
let currentCategory = ''; // default

function selectCategory(category) {
    currentCategory  = category;
    const query = document.getElementById('searchBox').value.toLowerCase();
    const listContainer = document.getElementById('dataList');
    listContainer.innerHTML = '';

    const paginationEl = document.getElementById('paginationContainer');

    // Update the search box placeholder
    const searchBox = document.getElementById('searchBox');
    searchBox.placeholder = `Search ${capitalize(category)}...`;

    if (category === 'saints') {
        saintSearch = { name: '', country: '', page: 1 }; // reset
        fetchSaints();
      
        paginationEl.style.display = 'block'; // 👈 Show pagination
    } else {
        // Use local data for popes/miracles since not paginated
        //currentList = CSVall[category] || [];
        filterList(category);
       
        paginationEl.style.display = 'none'; // 👈 Show pagination
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

    const s_item = document.getElementById('searchBox');
    s_item.innerHTML = '';

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
                    map.flyTo({
                        center: [parseFloat(item.Longitude), parseFloat(item.Latitude)],
                        zoom: 22
                    });
                }
            };

            listContainer.appendChild(li);
        });

    } else if (currentCategory === "miracles") { // Corrected condition
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
                    map.flyTo({
                        center: [parseFloat(item.Longitude), parseFloat(item.Latitude)],
                        zoom: 22
                    });
                }
            };

            listContainer.appendChild(li);
        });

    } else if (currentCategory === "saints") { // Add condition for saints
       
        fetchSaints(); // Call fetchSaints for saints category
    } else {
        console.log("Category not handled in filterList:", category);
    }

}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}


//-------------------------------------------------------------------------------------------------
//Saint -Search

let saintSearch = {
  name: '',
  page: 1
};

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

// Bind input filters
document.getElementById('searchBox').addEventListener('input', (e) => {
  saintSearch.name = e.target.value;
  saintSearch.country = e.target.value;
  saintSearch.born = e.target.value;
  saintSearch.page = 1;
  filterQuest(); // Call filterQuest instead of fetchSaints directly
});


//

function toggleCategory(category, visible) {
	if (!categoryLayers[category]) return;

	for (const layerId of categoryLayers[category]) {
		if (map.getLayer(layerId)) {
			if (visible) {
				map.setLayoutProperty(layerId, 'visibility', 'visible');
			} else {
				map.setLayoutProperty(layerId, 'visibility', 'none');
			}
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
function updatePopeCarousel(x) {
    const container = document.getElementById('pope-carousel-content');
    const data = window.popeCarouselData;
    if (!data || !data.popes || !data.popes.length) return;

    const props = data.popes[data.index].properties;

    if (x==="popes"){

function formatDate(value) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toDateString();
}

container.innerHTML  = `
    <div class="pope-card" class="pope-card" style="height: 370px; overflow-y: auto;">
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
	  const date = new Date(1970, month - 1, day); // Month is 0-based
	  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
	})() : '';

	    function formatDate(value) {
		    const date = new Date(value);
		    return isNaN(date.getTime()) ? value : date.toDateString();
		}

	    
    container.innerHTML = `
		  <div class="pope-card" class="pope-card" style="height: 370px; overflow-y: auto;">
		    <div class="pope-card-header"> ${fE(props.Name)} </div>
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

    // 🟨 Add this to update the counter display
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


//-------------------------------------------------------------------------------------------------------------------
function fE(str) {     //Fix encoding
  try {
    const fixed = decodeURIComponent(escape(str));
    // If the result loses non-ASCII characters, keep original
    if (/[\u0080-\uFFFF]/.test(str) && !/[\u0080-\uFFFF]/.test(fixed)) {
      return str;
    }
    return fixed;
  } catch (e) {
    return str;
  }
}

