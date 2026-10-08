/* =========================================================
   SAFEPATH VEHICLES PAGE
   ========================================================= */

(function () {
  'use strict';


  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const BACKEND_URL = 'http://localhost:3000';

  const VEHICLES_API =
    `${BACKEND_URL}/api/vehicles`;

  const REFRESH_INTERVAL = 15000;

  /*
   * A vehicle is considered currently online only when:
   *
   * 1. currentOnline === true
   * 2. lastOnline is recent
   *
   * This prevents an old database record from remaining
   * visually Online forever.
   */
  const ONLINE_TIMEOUT_MS = 2 * 60 * 1000;


  /* =======================================================
     STATE
  ======================================================= */

  const vehicles = new Map();

  let refreshTimer = null;

  let isLoading = false;


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


  function initialize() {

    cacheElements();

    setupNavigation();

    setupRefreshButton();

    loadVehicles();

    connectSocket();

    startAutomaticRefresh();

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

    elements.refreshButton =
      document.getElementById(
        'refreshButton'
      );

    elements.connectionStatus =
      document.getElementById(
        'connectionStatus'
      );

    elements.connectionText =
      document.getElementById(
        'connectionText'
      );

    elements.totalVehicles =
      document.getElementById(
        'totalVehicles'
      );

    elements.onlineVehicles =
      document.getElementById(
        'onlineVehicles'
      );

    elements.offlineVehicles =
      document.getElementById(
        'offlineVehicles'
      );

    elements.lastUpdated =
      document.getElementById(
        'lastUpdated'
      );

    elements.loadingIndicator =
      document.getElementById(
        'loadingIndicator'
      );

    elements.errorMessage =
      document.getElementById(
        'errorMessage'
      );

    elements.errorText =
      document.getElementById(
        'errorText'
      );

    elements.emptyState =
      document.getElementById(
        'emptyState'
      );

    elements.vehiclesTable =
      document.getElementById(
        'vehiclesTable'
      );

    elements.vehiclesTableBody =
      document.getElementById(
        'vehiclesTableBody'
      );

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


    /*
     * Close the drawer before navigating to another page.
     */
    if (elements.navigationDrawer) {

      const drawerLinks =
        elements.navigationDrawer.querySelectorAll(
          'a'
        );

      drawerLinks.forEach(
        function (link) {

          link.addEventListener(
            'click',
            function () {

              closeDrawer();

            }
          );

        }
      );

    }


    /*
     * ESC closes the drawer.
     */
    document.addEventListener(
      'keydown',
      function (event) {

        if (event.key === 'Escape') {

          closeDrawer();

        }

      }
    );

  }


  function openDrawer() {

    if (!elements.navigationDrawer) {
      return;
    }

    elements.navigationDrawer.classList.add(
      'open'
    );

    if (elements.drawerOverlay) {

      elements.drawerOverlay.classList.add(
        'open'
      );

    }

    elements.navigationDrawer.setAttribute(
      'aria-hidden',
      'false'
    );

  }


  function closeDrawer() {

    if (!elements.navigationDrawer) {
      return;
    }

    elements.navigationDrawer.classList.remove(
      'open'
    );

    if (elements.drawerOverlay) {

      elements.drawerOverlay.classList.remove(
        'open'
      );

    }

    elements.navigationDrawer.setAttribute(
      'aria-hidden',
      'true'
    );

  }


  /* =======================================================
     REFRESH BUTTON
  ======================================================= */

  function setupRefreshButton() {

    if (!elements.refreshButton) {
      return;
    }

    elements.refreshButton.addEventListener(
      'click',
      async function () {

        await loadVehicles();

      }
    );

  }


  /* =======================================================
     REST
  ======================================================= */

  async function loadVehicles() {

    if (isLoading) {
      return;
    }

    isLoading = true;

    setLoading(true);

    clearError();


    try {

      const response =
        await fetch(
          VEHICLES_API,
          {
            method: 'GET',

            headers: {
              Accept: 'application/json'
            },

            cache: 'no-store'
          }
        );


      if (!response.ok) {

        throw new Error(
          `Backend returned HTTP ${response.status}`
        );

      }


      const data =
        await response.json();


      if (!Array.isArray(data)) {

        throw new Error(
          'Invalid vehicle response from backend.'
        );

      }


      vehicles.clear();


      data.forEach(
        function (vehicle) {

          if (
            !vehicle ||
            !vehicle.vehicleId
          ) {

            return;

          }


          vehicles.set(
            String(vehicle.vehicleId),
            normalizeVehicle(vehicle)
          );

        }
      );


      renderVehicles();

      setLastUpdated(
        new Date()
      );


    } catch (error) {

      console.error(
        '[SafePath Vehicles] REST error:',
        error
      );


      showError(
        error && error.message
          ? error.message
          : 'Unable to connect to SafePath backend.'
      );


      renderVehicles();


    } finally {

      isLoading = false;

      setLoading(false);

    }

  }


  /* =======================================================
     SOCKET.IO
  ======================================================= */

  function connectSocket() {

    if (
      typeof window.io !== 'function'
    ) {

      console.warn(
        '[SafePath Vehicles] Socket.IO client is not available.'
      );

      setConnectionStatus(
        'disconnected'
      );

      return;

    }


    try {

      const socket =
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
         CONNECTING
      ------------------------------------------------ */

      setConnectionStatus(
        'connecting'
      );


      /* -----------------------------------------------
         CONNECT
      ------------------------------------------------ */

      socket.on(
        'connect',
        function () {

          console.log(
            '[SafePath Vehicles] Socket.IO connected:',
            socket.id
          );

          setConnectionStatus(
            'connected'
          );

        }
      );


      /* -----------------------------------------------
         DISCONNECT
      ------------------------------------------------ */

      socket.on(
        'disconnect',
        function (reason) {

          console.warn(
            '[SafePath Vehicles] Socket.IO disconnected:',
            reason
          );

          setConnectionStatus(
            'disconnected'
          );

        }
      );


      /* -----------------------------------------------
         CONNECT ERROR
      ------------------------------------------------ */

      socket.on(
        'connect_error',
        function (error) {

          console.error(
            '[SafePath Vehicles] Socket.IO connection error:',
            error
          );

          setConnectionStatus(
            'disconnected'
          );

        }
      );


      /* -----------------------------------------------
         CONNECTION READY
      ------------------------------------------------ */

      socket.on(
        'connection:ready',
        function () {

          console.log(
            '[SafePath Vehicles] Backend connection ready.'
          );

        }
      );


      /* -----------------------------------------------
         FLEET SNAPSHOT
      ------------------------------------------------ */

      socket.on(
        'fleet:snapshot',
        function (payload) {

          console.log(
            '[SafePath Vehicles] Fleet snapshot:',
            payload
          );


          if (
            !payload ||
            !Array.isArray(
              payload.vehicles
            )
          ) {

            return;

          }


          payload.vehicles.forEach(
            function (vehicle) {

              if (
                !vehicle ||
                !vehicle.vehicleId
              ) {

                return;

              }


              vehicles.set(
                String(vehicle.vehicleId),
                normalizeVehicle(vehicle)
              );

            }
          );


          renderVehicles();

          setLastUpdated(
            new Date()
          );

        }
      );


      /* -----------------------------------------------
         FLEET TELEMETRY
      ------------------------------------------------ */

      socket.on(
        'fleet:telemetry',
        function (payload) {

          if (
            !payload ||
            !payload.vehicleId
          ) {

            return;

          }


          vehicles.set(
            String(payload.vehicleId),
            normalizeVehicle(payload)
          );


          renderVehicles();

          setLastUpdated(
            new Date()
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


          vehicles.set(
            String(payload.vehicleId),
            normalizeVehicle(payload)
          );


          renderVehicles();

          setLastUpdated(
            new Date()
          );

        }
      );


    } catch (error) {

      console.error(
        '[SafePath Vehicles] Socket.IO initialization error:',
        error
      );

      setConnectionStatus(
        'disconnected'
      );

    }

  }


  /* =======================================================
     NORMALIZATION
  ======================================================= */

  function normalizeVehicle(vehicle) {

    return {

      vehicleId:
        String(
          vehicle.vehicleId ?? ''
        ),

      vehicleType:
        normalizeVehicleType(
          vehicle.vehicleType
        ),

      latitude:
        toNumber(
          vehicle.latitude
        ),

      longitude:
        toNumber(
          vehicle.longitude
        ),

      speed:
        toNumber(
          vehicle.speed
        ),

      heading:
        toNumber(
          vehicle.heading
        ),

      accuracy:
        vehicle.accuracy === null ||
        vehicle.accuracy === undefined
          ? null
          : toNumber(
              vehicle.accuracy
            ),

      lastOnline:
        vehicle.lastOnline
          ? String(
              vehicle.lastOnline
            )
          : null,

      currentOnline:
        Boolean(
          vehicle.currentOnline
        )

    };

  }


  function normalizeVehicleType(
    vehicleType
  ) {

    if (
      vehicleType === null ||
      vehicleType === undefined ||
      String(vehicleType).trim() === ''
    ) {

      return 'Car';

    }


    const normalized =
      String(vehicleType)
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');


    const labels = {

      NORMAL: 'Car',

      CAR: 'Car',

      VIP: 'VIP',

      POLICE: 'Police',

      FIRE_ENGINE: 'Fire Engine',

      FIREENGINE: 'Fire Engine',

      AMBULANCE: 'Ambulance'

    };


    return (
      labels[normalized] ||
      formatVehicleType(normalized)
    );

  }


  function formatVehicleType(
    vehicleType
  ) {

    return String(vehicleType)
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


  function toNumber(value) {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;

  }


  /* =======================================================
     CURRENT ONLINE STATE
  ======================================================= */

  function isVehicleOnline(
    vehicle
  ) {

    if (
      !vehicle ||
      !vehicle.currentOnline
    ) {

      return false;

    }


    if (!vehicle.lastOnline) {

      return false;

    }


    const lastOnlineTime =
      new Date(
        vehicle.lastOnline
      ).getTime();


    if (
      !Number.isFinite(
        lastOnlineTime
      )
    ) {

      return false;

    }


    const age =
      Date.now() -
      lastOnlineTime;


    return (
      age >= 0 &&
      age <= ONLINE_TIMEOUT_MS
    );

  }


  /* =======================================================
     RENDER
  ======================================================= */

  function renderVehicles() {

    if (
      !elements.vehiclesTableBody
    ) {

      return;

    }


    const sortedVehicles =
      Array.from(
        vehicles.values()
      ).sort(
        function (a, b) {

          const aOnline =
            isVehicleOnline(a);

          const bOnline =
            isVehicleOnline(b);


          if (
            aOnline !== bOnline
          ) {

            return aOnline
              ? -1
              : 1;

          }


          return a.vehicleId.localeCompare(
            b.vehicleId
          );

        }
      );


    elements.vehiclesTableBody.innerHTML =
      '';


    if (
      sortedVehicles.length === 0
    ) {

      elements.vehiclesTable.style.display =
        'none';

      elements.emptyState.hidden =
        false;

    } else {

      elements.vehiclesTable.style.display =
        'table';

      elements.emptyState.hidden =
        true;


      sortedVehicles.forEach(
        function (vehicle) {

          const row =
            createVehicleRow(
              vehicle
            );


          elements.vehiclesTableBody.appendChild(
            row
          );

        }
      );

    }


    updateSummary(
      sortedVehicles
    );

  }


  /* =======================================================
     TABLE ROW
  ======================================================= */

  function createVehicleRow(
    vehicle
  ) {

    const row =
      document.createElement(
        'tr'
      );


    row.dataset.vehicleId =
      vehicle.vehicleId;


    row.addEventListener(
      'click',
      function () {

        openVehicleEvents(
          vehicle.vehicleId
        );

      }
    );


    row.innerHTML = `

      <td class="vehicle-id-cell">
        ${escapeHtml(vehicle.vehicleId)}
      </td>

      <td>
        <span class="vehicle-type-badge">
          ${escapeHtml(vehicle.vehicleType)}
        </span>
      </td>

      <td class="numeric-cell">
        ${formatCoordinate(vehicle.latitude)}
      </td>

      <td class="numeric-cell">
        ${formatCoordinate(vehicle.longitude)}
      </td>

      <td class="numeric-cell">
        ${formatSpeed(vehicle.speed)}
      </td>

      <td class="numeric-cell">
        ${formatHeading(vehicle.heading)}
      </td>

      <td class="numeric-cell">
        ${formatAccuracy(vehicle.accuracy)}
      </td>

      <td>
        ${formatDateTime(vehicle.lastOnline)}
      </td>

      <td>
        ${createStatusBadge(
          isVehicleOnline(vehicle)
        )}
      </td>

    `;


    return row;

  }


  /* =======================================================
     SUMMARY
  ======================================================= */

  function updateSummary(
    vehicleList
  ) {

    const total =
      vehicleList.length;


    const online =
      vehicleList.filter(
        function (vehicle) {

          return isVehicleOnline(
            vehicle
          );

        }
      ).length;


    const offline =
      total - online;


    elements.totalVehicles.textContent =
      String(total);


    elements.onlineVehicles.textContent =
      String(online);


    elements.offlineVehicles.textContent =
      String(offline);

  }


  /* =======================================================
     STATUS
  ======================================================= */

  function createStatusBadge(
    isOnline
  ) {

    const label =
      isOnline
        ? 'Online'
        : 'Offline';


    const className =
      isOnline
        ? 'online'
        : 'offline';


    return `
      <span class="status-badge ${className}">
        ${label}
      </span>
    `;

  }


  /* =======================================================
     FORMATTING
  ======================================================= */

  function formatCoordinate(
    value
  ) {

    if (
      !Number.isFinite(value)
    ) {

      return '—';

    }


    return value.toFixed(6);

  }


  function formatSpeed(
    value
  ) {

    if (
      !Number.isFinite(value)
    ) {

      return '—';

    }


    return `${value.toFixed(1)} km/h`;

  }


  function formatHeading(
    value
  ) {

    if (
      !Number.isFinite(value)
    ) {

      return '—';

    }


    return `${value.toFixed(1)}°`;

  }


  function formatAccuracy(
    value
  ) {

    if (
      value === null ||
      !Number.isFinite(value)
    ) {

      return '—';

    }


    return `${value.toFixed(1)} m`;

  }


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

      return escapeHtml(
        String(value)
      );

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

        timeZone: 'Asia/Kolkata'
      }
    );

  }


  /* =======================================================
     NAVIGATION TO EVENTS
  ======================================================= */

  function openVehicleEvents(
    vehicleId
  ) {

    const encodedVehicleId =
      encodeURIComponent(
        vehicleId
      );


    window.location.href =
      `./events.html?vehicleId=${encodedVehicleId}`;

  }


  /* =======================================================
     CONNECTION STATUS
  ======================================================= */

  function setConnectionStatus(
    state
  ) {

    if (
      !elements.connectionStatus ||
      !elements.connectionText
    ) {

      return;

    }


    elements.connectionStatus.classList.remove(
      'connected',
      'disconnected',
      'connecting'
    );


    if (
      state === 'connected'
    ) {

      elements.connectionStatus.classList.add(
        'connected'
      );

      elements.connectionText.textContent =
        'Connected';

      return;

    }


    if (
      state === 'connecting'
    ) {

      elements.connectionStatus.classList.add(
        'connecting'
      );

      elements.connectionText.textContent =
        'Connecting';

      return;

    }


    elements.connectionStatus.classList.add(
      'disconnected'
    );

    elements.connectionText.textContent =
      'Disconnected';

  }


  /* =======================================================
     LOADING
  ======================================================= */

  function setLoading(
    loading
  ) {

    if (
      elements.loadingIndicator
    ) {

      elements.loadingIndicator.classList.toggle(
        'visible',
        loading
      );

    }


    if (
      elements.refreshButton
    ) {

      elements.refreshButton.disabled =
        loading;

    }

  }


  /* =======================================================
     ERROR
  ======================================================= */

  function showError(
    message
  ) {

    if (
      !elements.errorMessage
    ) {

      return;

    }


    elements.errorText.textContent =
      message ||
      'Unknown error.';


    elements.errorMessage.hidden =
      false;

  }


  function clearError() {

    if (
      !elements.errorMessage
    ) {

      return;

    }


    elements.errorText.textContent =
      '';

    elements.errorMessage.hidden =
      true;

  }


  /* =======================================================
     LAST UPDATED
  ======================================================= */

  function setLastUpdated(
    date
  ) {

    if (
      !elements.lastUpdated
    ) {

      return;

    }


    if (
      !(date instanceof Date) ||
      Number.isNaN(
        date.getTime()
      )
    ) {

      elements.lastUpdated.textContent =
        '—';

      return;

    }


    elements.lastUpdated.textContent =
      date.toLocaleTimeString(
        'en-IN',
        {
          hour: '2-digit',

          minute: '2-digit',

          second: '2-digit',

          hour12: true,

          timeZone: 'Asia/Kolkata'
        }
      );

  }


  /* =======================================================
     AUTOMATIC REFRESH
  ======================================================= */

  function startAutomaticRefresh() {

    if (refreshTimer) {

      clearInterval(
        refreshTimer
      );

    }


    refreshTimer =
      setInterval(
        function () {

          loadVehicles();

        },
        REFRESH_INTERVAL
      );

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

})();