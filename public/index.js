import './index.css';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import Rx from 'rx';
import 'rx-dom';

const QUAKE_URL = 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp'; // JSONP URL

const map = L.map('map').setView([33.858631, -118.279602], 7); // Initialize map centre and zoom level
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map); // Style to map

const table = document.getElementById('quakes_info');

// Create table row to append to quakes_info
function makeRow(props) {
  var row = document.createElement('tr');
  row.id = props.net + props.code;
  var date = new Date(props.time);
  var time = date.toString();
  [props.place, props.mag, time].forEach(function (text) {
    var cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
  });
  return row;
}

// Initialize observables and observers after DOM load
function initialize() {
  // Quakes observable
  const quakes = Rx.Observable
    .interval(5000)
    .flatMap(Rx.DOM.jsonpRequest({ // JSONP request every 5s
      url: QUAKE_URL,
      jsonpCallback: 'eqfeed_callback'
    }).retry(3)) // Retry 3 times if fail
    .flatMap(result => Rx.Observable.from(result.response.features))
    .distinct(quake => quake.properties.code)
    .share(); // Share to avoid data twice for 2 observers

  // Draw circle on map
  quakes.map(quake => {
    return {
      lat: quake.geometry.coordinates[1],
      lng: quake.geometry.coordinates[0],
      size: quake.properties.mag * 10000
    };
  }).subscribe(quake => L.circle([quake.lat, quake.lng], quake.size).addTo(map));

  // Add row to table
  quakes
    .pluck('properties')
    .map(makeRow)
    .bufferWithTime(500) // Gather values every 0.5s and yield
    .filter(rows => rows.length > 0) // ield only if there is data
    .map(rows => {
      var fragment = document.createDocumentFragment();
      rows.forEach(function (row) {
        fragment.appendChild(row);
      });
      return fragment;
    })
    .subscribe(fragment => table.appendChild(fragment));
}

// DOM load
Rx.DOM.ready().subscribe(initialize);
