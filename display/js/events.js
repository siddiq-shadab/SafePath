/* =========================================================
   SAFEPATH VEHICLE EVENTS PAGE
   ========================================================= */

(function () {
  'use strict';


  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const BACKEND_URL =
    'http://localhost:3000';

  const VEHICLES_API =
    `${BACKEND_URL}/api/vehicles`;

  const DEFAULT_CENTER = [
    18.445167,
    79.131954
  ];

  const DEFAULT_ZOOM = 15;


  /* =======================================================
     STATE
  ======================================================= */

  let vehicleId = null;

  let map = null;

  let vehicleMarker = null;

  let vehicleCircle = null;

  let socket = null;

  let currentVehicle = null;


  /* =======================================================
     DOM
  ======================================================= */

  const elements = {};


  /* =======================================================
     INITIALIZATION
  ======================================================= */

  document.addEventListener(
    'DOMContentLoaded',
    initialize
  );


  async function initialize() {

    cacheElements();

    setupNavigation();

    setupBackButton();

    vehicleId =
      getVehicleIdFromUrl();


    if (!vehicleId) {

      showError(
        'No vehicle ID was supplied in the URL.'
      );

      return;

    }


    elements.headerVehicleId.textContent =
      vehicleId;


    elements.vehicleId.textContent =
      vehicleId;


    initializeMap();

    await loadVehicle();

    connectSocket();

  }


  /* =======================================================
     DOM CACHE
  ======================================================= */

  function cacheElements() {

    elements.menuButton =
      document.getElementById(
        'menuButton'
      );

    elements.navigationDrawer =
      document.getElementById(
        'navigationDrawer'
      );

    elements.closeDrawerButton =
      document.getElementById(
        'closeDrawerButton'
      );

    elements.drawerOverlay =
      document.getElementById(
        'drawerOverlay'
      );

    elements.backButton =
      document.getElementById(
        'backButton'
      );

    elements.connectionStatus =
      document.getElementById(
        'connectionStatus'
      );

    elements.connectionText =
      document.getElementById(
        'connectionText'
      );

    elements.headerVehicleId =
      document.getElementById(
        'headerVehicleId'
      );

    elements.vehicleId =
      document.getElementById(
        'vehicleId'
      );

    elements.vehicleType =
      document.getElementById(
        'vehicleType'
      );

    elements.vehicleStatus =
      document.getElementById(
        'vehicleStatus'
      );

    elements.speed =
      document.getElementById(
        'speed'
      );

    elements.heading =
      document.getElementById(
        'heading'
      );

    elements.accuracy =
      document.getElementById(
        'accuracy'
      );

    elements.lastOnline =
      document.getElementById(
        'lastOnline'
      );

    elements.latitude =
      document.getElementById(
        'latitude'
      );

    elements.longitude =
      document.getElementById(
        'longitude'
      );

    elements.mapStatus =
      document.getElementById(
        'mapStatus'
      );

    elements.errorPanel =
      document.getElementById(
        'errorPanel'
      );

    elements.errorText =
      document.getElementById(
        'errorText'
      );

  }


  /* =======================================================
     URL
  ======================================================= */

  function getVehicleIdFromUrl() {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const value =
      params.get('vehicleId');


    if (!value) {
      return null;
    }

    return value.trim();

  }


  /* =======================================================
     NAVIGATION
  ======================================================= */

  function setupNavigation() {

    if (elements.menuButton) {

      elements.menuButton.addEventListener(
        'click',
        openDrawer
      );

    }

    if (elements.closeDrawerButton) {

      elements.closeDrawerButton.addEventListener(
        'click',
        closeDrawer
      );

    }

    if (elements.drawerOverlay) {

      elements.drawerOverlay.addEventListener(
        'click',
        closeDrawer
      );

    }

  }


  function openDrawer() {

    elements.navigationDrawer.classList.add(
      'open'
    );

    elements.drawerOverlay.classList.add(
      'open'
    );

    elements.navigationDrawer.setAttribute(
      'aria-hidden',
      'false'
    );

  }


  function closeDrawer() {

    elements.navigationDrawer.classList.remove(
      'open'
    );

    elements.drawerOverlay.classList.remove(
      'open'
    );

    elements.navigationDrawer.setAttribute(
      'aria-hidden',
      'true'
    );

  }


  function setupBackButton() {

    if (!elements.backButton) {
      return;
    }

    elements.backButton.addEventListener(
      'click',
      function () {

        window.location.href =
          './vehicles.html';

      }
    );

  }


  /* =======================================================
     MAP
  ======================================================= */

  function initializeMap() {

    if (
      typeof window.L === 'undefined'
    ) {

      showError(
        'Leaflet could not be loaded.'
      );

      return;

    }


    map =
      window.L.map(
        'vehicleMap',
        {
          zoomControl: true
        }
      );


    window.L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors',

        maxZoom: 19
      }
    ).addTo(map);


    map.setView(
      DEFAULT_CENTER,
      DEFAULT_ZOOM
    );

  }


  /* =======================================================
     REST
  ======================================================= */

  async function loadVehicle() {

    try {

      clearError();

      setMapStatus(
        'Loading vehicle...'
      );


      const response =
        await fetch(
          `${VEHICLES_API}/${encodeURIComponent(vehicleId)}/live`,
          {
            method: 'GET',

            headers: {
              Accept: 'application/json'
            },

            cache: 'no-store'
          }
        );


      if (!response.ok) {

        if (response.status === 404) {

          throw new Error(
            `Vehicle "${vehicleId}" was not found.`
          );

        }

        throw new Error(
          `Backend returned HTTP ${response.status}.`
        );

      }


      const data =
        await response.json();


      if (
        !data ||
        !data.vehicleId
      ) {

        throw new Error(
          'Invalid vehicle data received from backend.'
        );

      }


      updateVehicle(
        data
      );


    } catch (error) {

      console.error(
        '[SafePath Events] REST error:',
        error
      );


      showError(
        error && error.message
          ? error.message
          : 'Unable to load vehicle.'
      );

      setMapStatus(
        'Location unavailable'
      );

    }

  }


  /* =======================================================
     SOCKET.IO
  ======================================================= */

  function connectSocket() {

    if (
      typeof window.io !== 'function'
    ) {

      console.error(
        '[SafePath Events] Socket.IO client unavailable.'
      );

      setConnectionStatus(
        'disconnected'
      );

      return;

    }


    try {

      socket =
        window.io(
          `${BACKEND_URL}/vehicles`,
          {
            transports: [
              'websocket',
              'polling'
            ],

            reconnection: true,

            reconnectionAttempts:
              Infinity,

            reconnectionDelay:
              1000,

            reconnectionDelayMax:
              5000
          }
        );


      /* -----------------------------------------------
         CONNECT
      ------------------------------------------------ */

      socket.on(
        'connect',
        function () {

          console.log(
            '[SafePath Events] Socket.IO connected:',
            socket.id
          );


          setConnectionStatus(
            'connected'
          );


          subscribeToVehicle();

        }
      );


      /* -----------------------------------------------
         DISCONNECT
      ------------------------------------------------ */

      socket.on(
        'disconnect',
        function (reason) {

          console.warn(
            '[SafePath Events] Socket.IO disconnected:',
            reason
          );


          setConnectionStatus(
            'disconnected'
          );


          setMapStatus(
            'Live connection disconnected'
          );

        }
      );


      /* -----------------------------------------------
         CONNECTION ERROR
      ------------------------------------------------ */

      socket.on(
        'connect_error',
        function (error) {

          console.error(
            '[SafePath Events] Socket.IO error:',
            error
          );


          setConnectionStatus(
            'disconnected'
          );

        }
      );


      /* -----------------------------------------------
         READY
      ------------------------------------------------ */

      socket.on(
        'connection:ready',
        function () {

          console.log(
            '[SafePath Events] Backend connection ready.'
          );

        }
      );


      /* -----------------------------------------------
         VEHICLE TELEMETRY
      ------------------------------------------------ */

      socket.on(
        'vehicle:telemetry',
        function (payload) {

          if (
            !payload ||
            !payload.vehicleId
          ) {
            return;
          }


          if (
            String(payload.vehicleId) !==
            String(vehicleId)
          ) {

            return;

          }


          updateVehicle(
            payload
          );

        }
      );

    } catch (error) {

      console.error(
        '[SafePath Events] Socket initialization error:',
        error
      );


      setConnectionStatus(
        'disconnected'
      );

    }

  }


  /* =======================================================
     SUBSCRIBE
  ======================================================= */

  function subscribeToVehicle() {

    if (
      !socket ||
      !socket.connected ||
      !vehicleId
    ) {

      return;

    }


    console.log(
      '[SafePath Events] Subscribing to:',
      vehicleId
    );


    socket.emit(
      'vehicle:subscribe',
      {
        vehicleId
      }
    );

  }


  /* =======================================================
     VEHICLE UPDATE
  ======================================================= */

  function updateVehicle(
    payload
  ) {

    const vehicle =
      normalizeVehicle(
        payload
      );


    if (!vehicle) {
      return;
    }


    currentVehicle =
      vehicle;


    renderVehicle(
      vehicle
    );


    updateMap(
      vehicle
    );


    clearError();

  }


  function normalizeVehicle(
    payload
  ) {

    if (
      !payload ||
      !payload.vehicleId
    ) {

      return null;

    }


    return {

      vehicleId:
        String(
          payload.vehicleId
        ),

      vehicleType:
        normalizeVehicleType(
          payload.vehicleType
        ),

      latitude:
        toNumber(
          payload.latitude
        ),

      longitude:
        toNumber(
          payload.longitude
        ),

      speed:
        toNumber(
          payload.speed
        ),

      heading:
        toNumber(
          payload.heading
        ),

      accuracy:
        payload.accuracy === null ||
        payload.accuracy === undefined
          ? null
          : toNumber(
              payload.accuracy
            ),

      lastOnline:
        payload.lastOnline
          ? String(
              payload.lastOnline
            )
          : null,

      currentOnline:
        Boolean(
          payload.currentOnline
        )

    };

  }


  /* =======================================================
     TYPE
  ======================================================= */

  function normalizeVehicleType(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ''
    ) {

      return 'Car';

    }


    const normalized =
      String(value)
        .trim()
        .toUpperCase()
        .replace(
          /[\s-]+/g,
          '_'
        );


    const labels = {

      NORMAL:
        'Car',

      CAR:
        'Car',

      VIP:
        'VIP',

      POLICE:
        'Police',

      FIRE_ENGINE:
        'Fire Engine',

      FIREENGINE:
        'Fire Engine',

      AMBULANCE:
        'Ambulance'

    };


    return (
      labels[normalized] ||
      formatVehicleType(
        normalized
      )
    );

  }


  function formatVehicleType(
    value
  ) {

    return String(value)
      .toLowerCase()
      .split('_')
      .map(
        function (part) {

          if (!part) {
            return '';
          }

          return (
            part.charAt(0).toUpperCase() +
            part.slice(1)
          );

        }
      )
      .join(' ');

  }


  function toNumber(
    value
  ) {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;

  }


  /* =======================================================
     RENDER VEHICLE
  ======================================================= */

  function renderVehicle(
    vehicle
  ) {

    elements.headerVehicleId.textContent =
      vehicle.vehicleId;

    elements.vehicleId.textContent =
      vehicle.vehicleId;

    elements.vehicleType.textContent =
      vehicle.vehicleType;

    elements.speed.textContent =
      `${vehicle.speed.toFixed(1)} km/h`;

    elements.heading.textContent =
      `${vehicle.heading.toFixed(1)}°`;


    elements.accuracy.textContent =
      vehicle.accuracy === null
        ? '—'
        : `${vehicle.accuracy.toFixed(1)} m`;


    elements.latitude.textContent =
      vehicle.latitude.toFixed(6);

    elements.longitude.textContent =
      vehicle.longitude.toFixed(6);


    elements.lastOnline.textContent =
      formatDateTime(
        vehicle.lastOnline
      );


    updateVehicleStatus(
      vehicle.currentOnline
    );


    setMapStatus(
      vehicle.currentOnline
        ? 'Live location'
        : 'Vehicle offline'
    );

  }


  /* =======================================================
     STATUS
  ======================================================= */

  function updateVehicleStatus(
    online
  ) {

    elements.vehicleStatus.classList.remove(
      'online',
      'offline'
    );


    if (online) {

      elements.vehicleStatus.classList.add(
        'online'
      );

      elements.vehicleStatus.innerHTML = `
        <span class="status-dot"></span>
        Online
      `;

    } else {

      elements.vehicleStatus.classList.add(
        'offline'
      );

      elements.vehicleStatus.innerHTML = `
        <span class="status-dot"></span>
        Offline
      `;

    }

  }


  function setConnectionStatus(
    state
  ) {

    elements.connectionStatus.classList.remove(
      'connected',
      'disconnected'
    );


    if (state === 'connected') {

      elements.connectionStatus.classList.add(
        'connected'
      );

      elements.connectionText.textContent =
        'Connected';

    } else {

      elements.connectionStatus.classList.add(
        'disconnected'
      );

      elements.connectionText.textContent =
        'Disconnected';

    }

  }


  /* =======================================================
     MAP UPDATE
  ======================================================= */

  function updateMap(
    vehicle
  ) {

    if (!map) {
      return;
    }


    const latitude =
      vehicle.latitude;

    const longitude =
      vehicle.longitude;


    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude === 0 &&
      longitude === 0
    ) {

      setMapStatus(
        'Invalid vehicle location'
      );

      return;

    }


    const position =
      [
        latitude,
        longitude
      ];


    if (!vehicleMarker) {

      const markerIcon =
        window.L.divIcon(
          {
            className: '',

            html: `
              <div class="vehicle-marker">
                🚗
              </div>
            `,

            iconSize: [
              34,
              34
            ],

            iconAnchor: [
              17,
              17
            ],

            popupAnchor: [
              0,
              -17
            ]
          }
        );


      vehicleMarker =
        window.L.marker(
          position,
          {
            icon: markerIcon
          }
        ).addTo(map);


      vehicleMarker.bindPopup(
        createPopupContent(
          vehicle
        )
      );


      vehicleCircle =
        window.L.circle(
          position,
          {
            radius:
              vehicle.accuracy === null
                ? 10
                : Math.max(
                    vehicle.accuracy,
                    5
                  ),

            weight: 1,

            fillOpacity: 0.08
          }
        ).addTo(map);


      map.setView(
        position,
        DEFAULT_ZOOM
      );


    } else {

      vehicleMarker.setLatLng(
        position
      );


      vehicleMarker.setPopupContent(
        createPopupContent(
          vehicle
        )
      );


      if (vehicleCircle) {

        vehicleCircle.setLatLng(
          position
        );


        if (
          vehicle.accuracy !== null
        ) {

          vehicleCircle.setRadius(
            Math.max(
              vehicle.accuracy,
              5
            )
          );

        }

      }

    }

  }


  /* =======================================================
     POPUP
  ======================================================= */

  function createPopupContent(
    vehicle
  ) {

    return `
      <div class="vehicle-popup-title">
        ${escapeHtml(vehicle.vehicleId)}
      </div>

      <div class="vehicle-popup-row">
        <span>Type</span>
        <strong>
          ${escapeHtml(vehicle.vehicleType)}
        </strong>
      </div>

      <div class="vehicle-popup-row">
        <span>Speed</span>
        <strong>
          ${vehicle.speed.toFixed(1)} km/h
        </strong>
      </div>

      <div class="vehicle-popup-row">
        <span>Heading</span>
        <strong>
          ${vehicle.heading.toFixed(1)}°
        </strong>
      </div>

      <div class="vehicle-popup-row">
        <span>Status</span>
        <strong>
          ${vehicle.currentOnline ? 'Online' : 'Offline'}
        </strong>
      </div>

      <div class="vehicle-popup-row">
        <span>Latitude</span>
        <strong>
          ${vehicle.latitude.toFixed(6)}
        </strong>
      </div>

      <div class="vehicle-popup-row">
        <span>Longitude</span>
        <strong>
          ${vehicle.longitude.toFixed(6)}
        </strong>
      </div>
    `;

  }


  /* =======================================================
     MAP STATUS
  ======================================================= */

  function setMapStatus(
    message
  ) {

    if (
      elements.mapStatus
    ) {

      elements.mapStatus.textContent =
        message;

    }

  }


  /* =======================================================
     DATE
  ======================================================= */

  function formatDateTime(
    value
  ) {

    if (!value) {
      return '—';
    }


    const date =
      new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return String(value);

    }


    return date.toLocaleString(
      'en-IN',
      {
        year: 'numeric',

        month: '2-digit',

        day: '2-digit',

        hour: '2-digit',

        minute: '2-digit',

        second: '2-digit',

        hour12: true,

        timeZone:
          'Asia/Kolkata'
      }
    );

  }


  /* =======================================================
     ERROR
  ======================================================= */

  function showError(
    message
  ) {

    if (
      !elements.errorPanel
    ) {
      return;
    }


    elements.errorText.textContent =
      message || 'Unknown error.';


    elements.errorPanel.hidden =
      false;

  }


  function clearError() {

    if (
      !elements.errorPanel
    ) {
      return;
    }


    elements.errorText.textContent =
      '';

    elements.errorPanel.hidden =
      true;

  }


  /* =======================================================
     HTML ESCAPING
  ======================================================= */

  function escapeHtml(
    value
  ) {

    return String(value)
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&#039;'
      );

  }


  /* =======================================================
     CLEANUP
  ======================================================= */

  window.addEventListener(
    'beforeunload',
    function () {

      if (
        socket &&
        socket.connected &&
        vehicleId
      ) {

        socket.emit(
          'vehicle:unsubscribe',
          {
            vehicleId
          }
        );

      }

      if (socket) {
        socket.disconnect();
      }

    }
  );

})();