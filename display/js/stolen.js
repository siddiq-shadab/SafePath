/* =========================================================
   SAFE PATH - STOLEN VEHICLE MONITORING
   ========================================================= */

(() => {
  "use strict";


  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const BACKEND_URL = window.location.origin;

  const VEHICLES_API =
    `${BACKEND_URL}/api/vehicles`;

  const SOCKET_NAMESPACE =
    `${BACKEND_URL}/vehicles`;

  const STORAGE_KEY =
    "safepath.stolenVehicles";

  /*
   * A vehicle is considered online only when:
   *
   * 1. currentOnline === true
   * 2. lastOnline exists
   * 3. lastOnline is not older than 2 minutes
   *
   * This matches the freshness logic used by the
   * SafePath display pages.
   */

  const ONLINE_TIMEOUT_MS =
    2 * 60 * 1000;


  /* =========================================================
     STATE
     ========================================================= */

  const state = {

    stolenVehicleIds: new Set(),

    vehicles: new Map(),

    selectedVehicleId: null,

    monitoredVehicleId: null,

    map: null,

    marker: null,

    socket: null,

    socketConnected: false,

    pendingDeleteVehicleId: null,

    lastAlertVehicleId: null,

    alertShownForOnlineState: new Set(),

    reconnectTimer: null

  };


  /* =========================================================
     DOM
     ========================================================= */

  const menuButton =
    document.getElementById(
      "menuButton"
    );

  const closeMenuButton =
    document.getElementById(
      "closeMenuButton"
    );

  const navigationOverlay =
    document.getElementById(
      "navigationOverlay"
    );

  const connectionStatus =
    document.getElementById(
      "connectionStatus"
    );

  const connectionDot =
    document.getElementById(
      "connectionDot"
    );

  const connectionText =
    document.getElementById(
      "connectionText"
    );

  const vehicleIdInput =
    document.getElementById(
      "vehicleIdInput"
    );

  const searchButton =
    document.getElementById(
      "searchButton"
    );

  const searchMessage =
    document.getElementById(
      "searchMessage"
    );

  const vehicleDetailsBody =
    document.getElementById(
      "vehicleDetailsBody"
    );

  const currentVehicleBadge =
    document.getElementById(
      "currentVehicleBadge"
    );

  const notificationButton =
    document.getElementById(
      "notificationButton"
    );

  const monitoringDescription =
    document.getElementById(
      "monitoringDescription"
    );

  const stolenVehiclesBody =
    document.getElementById(
      "stolenVehiclesBody"
    );

  const stolenVehicleCount =
    document.getElementById(
      "stolenVehicleCount"
    );

  const mapSection =
    document.getElementById(
      "mapSection"
    );

  const mapVehicleDescription =
    document.getElementById(
      "mapVehicleDescription"
    );

  const onlineAlertOverlay =
    document.getElementById(
      "onlineAlertOverlay"
    );

  const closeOnlineAlertButton =
    document.getElementById(
      "closeOnlineAlertButton"
    );

  const closeAlertButton =
    document.getElementById(
      "closeAlertButton"
    );

  const traceVehicleButton =
    document.getElementById(
      "traceVehicleButton"
    );

  const alertVehicleId =
    document.getElementById(
      "alertVehicleId"
    );

  const alertVehicleType =
    document.getElementById(
      "alertVehicleType"
    );

  const alertLatitude =
    document.getElementById(
      "alertLatitude"
    );

  const alertLongitude =
    document.getElementById(
      "alertLongitude"
    );

  const alertSpeed =
    document.getElementById(
      "alertSpeed"
    );

  const alertHeading =
    document.getElementById(
      "alertHeading"
    );

  const alertAccuracy =
    document.getElementById(
      "alertAccuracy"
    );

  const alertLastOnline =
    document.getElementById(
      "alertLastOnline"
    );

  const deleteModalOverlay =
    document.getElementById(
      "deleteModalOverlay"
    );

  const deleteVehicleId =
    document.getElementById(
      "deleteVehicleId"
    );

  const closeDeleteModalButton =
    document.getElementById(
      "closeDeleteModalButton"
    );

  const cancelDeleteButton =
    document.getElementById(
      "cancelDeleteButton"
    );

  const confirmDeleteButton =
    document.getElementById(
      "confirmDeleteButton"
    );

  const toast =
    document.getElementById(
      "toast"
    );

  const toastTitle =
    document.getElementById(
      "toastTitle"
    );

  const toastMessage =
    document.getElementById(
      "toastMessage"
    );


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    loadStolenVehicles();

    initializeNavigation();

    initializeMap();

    initializeEvents();

    updateConnectionStatus(
      false,
      "Connecting..."
    );

    renderAll();

    await loadVehicles();

    initializeSocket();

    startRefreshTimer();

  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function initializeNavigation() {

    menuButton.addEventListener(
      "click",
      () => {

        navigationOverlay.classList.add(
          "open"
        );

      }
    );


    closeMenuButton.addEventListener(
      "click",
      () => {

        navigationOverlay.classList.remove(
          "open"
        );

      }
    );


    navigationOverlay.addEventListener(
      "click",
      (event) => {

        if (
          event.target ===
          navigationOverlay
        ) {

          navigationOverlay.classList.remove(
            "open"
          );

        }

      }
    );

  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function initializeEvents() {

    searchButton.addEventListener(
      "click",
      searchVehicle
    );


    vehicleIdInput.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Enter"
        ) {

          event.preventDefault();

          searchVehicle();

        }

      }
    );


    notificationButton.addEventListener(
      "click",
      toggleMonitoring
    );


    closeOnlineAlertButton.addEventListener(
      "click",
      closeOnlineAlert
    );


    closeAlertButton.addEventListener(
      "click",
      closeOnlineAlert
    );


    traceVehicleButton.addEventListener(
      "click",
      () => {

        const vehicleId =
          state.lastAlertVehicleId;

        if (!vehicleId) {
          return;
        }

        closeOnlineAlert();

        traceVehicle(
          vehicleId
        );

      }
    );


    closeDeleteModalButton.addEventListener(
      "click",
      closeDeleteModal
    );


    cancelDeleteButton.addEventListener(
      "click",
      closeDeleteModal
    );


    confirmDeleteButton.addEventListener(
      "click",
      confirmDelete
    );


    onlineAlertOverlay.addEventListener(
      "click",
      (event) => {

        if (
          event.target ===
          onlineAlertOverlay
        ) {

          closeOnlineAlert();

        }

      }
    );


    deleteModalOverlay.addEventListener(
      "click",
      (event) => {

        if (
          event.target ===
          deleteModalOverlay
        ) {

          closeDeleteModal();

        }

      }
    );


    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key !== "Escape"
        ) {
          return;
        }


        if (
          onlineAlertOverlay.classList.contains(
            "open"
          )
        ) {

          closeOnlineAlert();

        }


        if (
          deleteModalOverlay.classList.contains(
            "open"
          )
        ) {

          closeDeleteModal();

        }


        navigationOverlay.classList.remove(
          "open"
        );

      }
    );

  }


  /* =========================================================
     LOCAL STORAGE
     ========================================================= */

  function loadStolenVehicles() {

    try {

      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );


      if (!raw) {

        state.stolenVehicleIds =
          new Set();

        return;

      }


      const parsed =
        JSON.parse(raw);


      if (
        !Array.isArray(parsed)
      ) {

        state.stolenVehicleIds =
          new Set();

        return;

      }


      state.stolenVehicleIds =
        new Set(
          parsed
            .map(normalizeVehicleId)
            .filter(Boolean)
        );

    } catch (error) {

      console.error(
        "[Stolen] localStorage read failed:",
        error
      );

      state.stolenVehicleIds =
        new Set();

    }

  }


  function saveStolenVehicles() {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          Array.from(
            state.stolenVehicleIds
          )
        )
      );

    } catch (error) {

      console.error(
        "[Stolen] localStorage save failed:",
        error
      );

    }

  }


  /* =========================================================
     SEARCH VEHICLE
     ========================================================= */

  async function searchVehicle() {

    const vehicleId =
      normalizeVehicleId(
        vehicleIdInput.value
      );


    if (!vehicleId) {

      setSearchMessage(
        "Enter a Vehicle ID.",
        "error"
      );

      vehicleIdInput.focus();

      return;

    }


    setSearchMessage(
      "Searching SafePath backend...",
      ""
    );


    try {

      const vehicle =
        await fetchVehicle(
          vehicleId
        );


      if (!vehicle) {

        setSearchMessage(
          `Vehicle ${vehicleId} was not found in the SafePath backend.`,
          "error"
        );

        return;

      }


      state.vehicles.set(
        vehicleId,
        normalizeVehicle(
          vehicle
        )
      );


      state.selectedVehicleId =
        vehicleId;


      state.stolenVehicleIds.add(
        vehicleId
      );


      saveStolenVehicles();


      setSearchMessage(
        `${vehicleId} has been added to the stolen vehicle monitoring list.`,
        "success"
      );


      renderAll();

    } catch (error) {

      console.error(
        "[Stolen] search failed:",
        error
      );


      setSearchMessage(
        "Unable to contact the SafePath backend.",
        "error"
      );

    }

  }


  /* =========================================================
     FETCH VEHICLE
     ========================================================= */

  async function fetchVehicle(
    vehicleId
  ) {

    const response =
      await fetch(
        `${VEHICLES_API}/${encodeURIComponent(
          vehicleId
        )}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (
      response.status === 404
    ) {

      return null;

    }


    if (
      !response.ok
    ) {

      throw new Error(
        `Vehicle request failed: ${response.status}`
      );

    }


    const data =
      await response.json();


    return normalizeVehicle(
      data
    );

  }


  /* =========================================================
     LOAD ALL VEHICLES
     ========================================================= */

  async function loadVehicles() {

    try {

      const response =
        await fetch(
          VEHICLES_API,
          {
            method: "GET",
            cache: "no-store"
          }
        );


      if (
        !response.ok
      ) {

        throw new Error(
          `Vehicle list request failed: ${response.status}`
        );

      }


      const data =
        await response.json();


      const vehicles =
        Array.isArray(data)
          ? data
          : Array.isArray(
              data.vehicles
            )
            ? data.vehicles
            : [];


      vehicles.forEach(
        (vehicle) => {

          const normalized =
            normalizeVehicle(
              vehicle
            );


          if (
            normalized.vehicleId
          ) {

            state.vehicles.set(
              normalized.vehicleId,
              normalized
            );

          }

        }
      );


      /*
       * Check whether any watched vehicle is already online.
       *
       * This is important when the page is opened after the
       * vehicle has already connected to the backend.
       */

      state.stolenVehicleIds.forEach(
        (vehicleId) => {

          const vehicle =
            state.vehicles.get(
              vehicleId
            );


          if (
            vehicle &&
            isVehicleOnline(
              vehicle
            )
          ) {

            maybeShowOnlineAlert(
              vehicle
            );

          }

        }
      );


      renderAll();

    } catch (error) {

      console.error(
        "[Stolen] initial vehicle load failed:",
        error
      );

      /*
       * The Socket.IO connection can still provide live
       * fleet telemetry.
       */

    }

  }


  /* =========================================================
     SOCKET.IO
     ========================================================= */

  function initializeSocket() {

    if (
      typeof io !== "function"
    ) {

      console.error(
        "[Stolen] Socket.IO client is not available."
      );

      updateConnectionStatus(
        false,
        "Socket.IO unavailable"
      );

      return;

    }


    try {

      state.socket =
        io(
          SOCKET_NAMESPACE,
          {
            transports: [
              "websocket",
              "polling"
            ],

            reconnection: true,

            reconnectionAttempts: Infinity,

            reconnectionDelay: 1000,

            reconnectionDelayMax: 5000
          }
        );


      state.socket.on(
        "connect",
        () => {

          state.socketConnected =
            true;


          updateConnectionStatus(
            true,
            "System Connected"
          );


          /*
           * Ask for a fresh fleet snapshot after every
           * connection/reconnection.
           */

          requestFleetSnapshot();

        }
      );


      state.socket.on(
        "disconnect",
        (reason) => {

          state.socketConnected =
            false;


          updateConnectionStatus(
            false,
            "Backend Disconnected"
          );


          console.warn(
            "[Stolen] Socket disconnected:",
            reason
          );

        }
      );


      state.socket.on(
        "connect_error",
        (error) => {

          state.socketConnected =
            false;


          updateConnectionStatus(
            false,
            "Backend Connection Error"
          );


          console.error(
            "[Stolen] Socket connection error:",
            error
          );

        }
      );


      state.socket.on(
        "connection:ready",
        (data) => {

          console.log(
            "[Stolen] Socket connection ready:",
            data
          );

        }
      );


      state.socket.on(
        "fleet:snapshot",
        (payload) => {

          handleFleetSnapshot(
            payload
          );

        }
      );


      state.socket.on(
        "fleet:telemetry",
        (payload) => {

          handleFleetTelemetry(
            payload
          );

        }
      );


      state.socket.on(
        "vehicle:telemetry",
        (payload) => {

          handleVehicleTelemetry(
            payload
          );

        }
      );


      state.socket.on(
        "vehicle:removed",
        (payload) => {

          handleVehicleRemoved(
            payload
          );

        }
      );

    } catch (error) {

      console.error(
        "[Stolen] Socket initialization failed:",
        error
      );

    }

  }


  function requestFleetSnapshot() {

    /*
     * The current SafePath gateway automatically sends
     * fleet:snapshot on connection.
     *
     * This function intentionally does not emit an invented
     * command because the backend does not currently define
     * a client-side snapshot request event.
     */

  }


  /* =========================================================
     FLEET SNAPSHOT
     ========================================================= */

  function handleFleetSnapshot(
    payload
  ) {

    if (!payload) {
      return;
    }


    const vehicles =
      Array.isArray(
        payload
      )
        ? payload
        : Array.isArray(
            payload.vehicles
          )
          ? payload.vehicles
          : [];


    vehicles.forEach(
      (vehicle) => {

        updateVehicle(
          vehicle
        );

      }
    );


    renderAll();

  }


  /* =========================================================
     FLEET TELEMETRY
     ========================================================= */

  function handleFleetTelemetry(
    payload
  ) {

    const vehicle =
      extractVehicleFromPayload(
        payload
      );


    if (!vehicle) {
      return;
    }


    updateVehicle(
      vehicle
    );

  }


  /* =========================================================
     VEHICLE TELEMETRY
     ========================================================= */

  function handleVehicleTelemetry(
    payload
  ) {

    const vehicle =
      extractVehicleFromPayload(
        payload
      );


    if (!vehicle) {
      return;
    }


    updateVehicle(
      vehicle
    );

  }


  /* =========================================================
     VEHICLE REMOVED
     ========================================================= */

  function handleVehicleRemoved(
    payload
  ) {

    const vehicleId =
      normalizeVehicleId(
        payload?.vehicleId ||
        payload?.id ||
        payload
      );


    if (!vehicleId) {
      return;
    }


    const existing =
      state.vehicles.get(
        vehicleId
      );


    if (existing) {

      existing.currentOnline =
        false;

      existing.lastOnline =
        existing.lastOnline ||
        null;

      state.vehicles.set(
        vehicleId,
        existing
      );

    }


    if (
      state.monitoredVehicleId ===
      vehicleId
    ) {

      updateMonitoringDescription();

    }


    renderAll();

  }


  /* =========================================================
     UPDATE VEHICLE
     ========================================================= */

  function updateVehicle(
    vehicle
  ) {

    const normalized =
      normalizeVehicle(
        vehicle
      );


    if (
      !normalized.vehicleId
    ) {

      return;

    }


    const previous =
      state.vehicles.get(
        normalized.vehicleId
      );


    state.vehicles.set(
      normalized.vehicleId,
      normalized
    );


    /*
     * Only trigger the stolen vehicle alert when the state
     * changes into online.
     */

    const wasOnline =
      previous
        ? isVehicleOnline(
            previous
          )
        : false;


    const isOnline =
      isVehicleOnline(
        normalized
      );


    if (
      state.stolenVehicleIds.has(
        normalized.vehicleId
      )
    ) {

      if (
        isOnline &&
        !wasOnline
      ) {

        maybeShowOnlineAlert(
          normalized
        );

      }

    }


    /*
     * If the vehicle was selected, refresh its details.
     */

    if (
      state.selectedVehicleId ===
      normalized.vehicleId
    ) {

      renderCurrentVehicle();

    }


    /*
     * If the vehicle is being traced, move the marker.
     */

    if (
      state.monitoredVehicleId ===
      normalized.vehicleId &&
      state.marker
    ) {

      updateMapMarker(
        normalized
      );

    }


    renderStolenVehicles();

  }


  /* =========================================================
     NORMALIZE VEHICLE
     ========================================================= */

  function normalizeVehicle(
    vehicle
  ) {

    if (!vehicle) {

      return {
        vehicleId: "",
        vehicleType: "UNKNOWN",
        latitude: null,
        longitude: null,
        speed: 0,
        heading: 0,
        accuracy: null,
        lastOnline: null,
        currentOnline: false
      };

    }


    const vehicleId =
      normalizeVehicleId(
        vehicle.vehicleId ||
        vehicle.vehicleIdentifier ||
        vehicle.id
      );


    const latitude =
      toNumber(
        vehicle.latitude
      );


    const longitude =
      toNumber(
        vehicle.longitude
      );


    const speed =
      toNumber(
        vehicle.speed
      );


    const heading =
      toNumber(
        vehicle.heading
      );


    const accuracy =
      toNumberOrNull(
        vehicle.accuracy
      );


    return {

      vehicleId,

      vehicleType:
        vehicle.vehicleType ||
        "UNKNOWN",

      latitude,

      longitude,

      speed,

      heading,

      accuracy,

      lastOnline:
        vehicle.lastOnline ||
        vehicle.timestamp ||
        vehicle.recordedAt ||
        null,

      currentOnline:
        vehicle.currentOnline === true

    };

  }


  function extractVehicleFromPayload(
    payload
  ) {

    if (!payload) {
      return null;
    }


    if (
      payload.vehicle
    ) {

      return payload.vehicle;

    }


    if (
      payload.data?.vehicle
    ) {

      return payload.data.vehicle;

    }


    if (
      payload.vehicleId ||
      payload.vehicleIdentifier
    ) {

      return payload;

    }


    return null;

  }


  /* =========================================================
     ONLINE STATE
     ========================================================= */

  function isVehicleOnline(
    vehicle
  ) {

    if (
      !vehicle ||
      vehicle.currentOnline !== true
    ) {

      return false;

    }


    if (
      !vehicle.lastOnline
    ) {

      return false;

    }


    const lastOnline =
      new Date(
        vehicle.lastOnline
      ).getTime();


    if (
      !Number.isFinite(
        lastOnline
      )
    ) {

      return false;

    }


    const age =
      Date.now() -
      lastOnline;


    return (
      age >= 0 &&
      age <= ONLINE_TIMEOUT_MS
    );

  }


  /* =========================================================
     ONLINE ALERT
     ========================================================= */

  function maybeShowOnlineAlert(
    vehicle
  ) {

    if (
      !vehicle ||
      !vehicle.vehicleId
    ) {

      return;

    }


    if (
      !isVehicleOnline(
        vehicle
      )
    ) {

      return;

    }


    /*
     * Prevent duplicate popups from repeated telemetry.
     *
     * The flag is cleared when the vehicle becomes offline.
     */

    if (
      state.alertShownForOnlineState.has(
        vehicle.vehicleId
      )
    ) {

      return;

    }


    state.alertShownForOnlineState.add(
      vehicle.vehicleId
    );


    state.lastAlertVehicleId =
      vehicle.vehicleId;


    populateOnlineAlert(
      vehicle
    );


    onlineAlertOverlay.classList.add(
      "open"
    );

    onlineAlertOverlay.setAttribute(
      "aria-hidden",
      "false"
    );


    playAlertSound();

  }


  function populateOnlineAlert(
    vehicle
  ) {

    alertVehicleId.textContent =
      vehicle.vehicleId ||
      "—";


    alertVehicleType.textContent =
      vehicle.vehicleType ||
      "—";


    alertLatitude.textContent =
      formatCoordinate(
        vehicle.latitude
      );


    alertLongitude.textContent =
      formatCoordinate(
        vehicle.longitude
      );


    alertSpeed.textContent =
      formatSpeed(
        vehicle.speed
      );


    alertHeading.textContent =
      formatHeading(
        vehicle.heading
      );


    alertAccuracy.textContent =
      formatAccuracy(
        vehicle.accuracy
      );


    alertLastOnline.textContent =
      formatDateTime(
        vehicle.lastOnline
      );

  }


  function closeOnlineAlert() {

    onlineAlertOverlay.classList.remove(
      "open"
    );

    onlineAlertOverlay.setAttribute(
      "aria-hidden",
      "true"
    );

  }


  /* =========================================================
     TRACE VEHICLE
     ========================================================= */

  function traceVehicle(
    vehicleId
  ) {

    const normalizedId =
      normalizeVehicleId(
        vehicleId
      );


    if (!normalizedId) {
      return;
    }


    const vehicle =
      state.vehicles.get(
        normalizedId
      );


    if (!vehicle) {

      showToast(
        "Vehicle Unavailable",
        "No current telemetry is available for this vehicle."
      );

      return;

    }


    state.selectedVehicleId =
      normalizedId;


    state.monitoredVehicleId =
      normalizedId;


    renderAll();


    if (
      !hasValidCoordinates(
        vehicle
      )
    ) {

      showToast(
        "Location Unavailable",
        "The vehicle does not currently have valid latitude and longitude data."
      );

      return;

    }


    mapSection.classList.remove(
      "hidden"
    );


    mapVehicleDescription.textContent =
      `Tracing ${vehicle.vehicleId} in real time.`;


    updateMapMarker(
      vehicle,
      true
    );


    setTimeout(
      () => {

        if (
          state.map
        ) {

          state.map.invalidateSize();

          centerMapOnVehicle(
            vehicle
          );

        }

      },
      150
    );

  }


  /* =========================================================
     MAP
     ========================================================= */

  function initializeMap() {

    if (
      typeof L === "undefined"
    ) {

      console.error(
        "[Stolen] Leaflet is unavailable."
      );

      return;

    }


    state.map =
      L.map(
        "stolenVehicleMap",
        {
          zoomControl: true,
          attributionControl: true
        }
      );


    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          "&copy; OpenStreetMap contributors",

        maxZoom: 19
      }
    ).addTo(
      state.map
    );


    state.map.setView(
      [
        18.445167,
        79.131954
      ],
      13
    );

  }


  function updateMapMarker(
    vehicle,
    center = false
  ) {

    if (
      !state.map ||
      !hasValidCoordinates(
        vehicle
      )
    ) {

      return;

    }


    const position = [
      vehicle.latitude,
      vehicle.longitude
    ];


    if (
      !state.marker
    ) {

      state.marker =
        L.marker(
          position
        ).addTo(
          state.map
        );

    } else {

      state.marker.setLatLng(
        position
      );

    }


    state.marker.bindPopup(
      buildMapPopup(
        vehicle
      )
    );


    if (center) {

      state.map.setView(
        position,
        Math.max(
          state.map.getZoom(),
          16
        ),
        {
          animate: true
        }
      );

    }

  }


  function centerMapOnVehicle(
    vehicle
  ) {

    if (
      !state.map ||
      !hasValidCoordinates(
        vehicle
      )
    ) {

      return;

    }


    state.map.setView(
      [
        vehicle.latitude,
        vehicle.longitude
      ],
      17,
      {
        animate: true
      }
    );


    if (
      state.marker
    ) {

      state.marker.openPopup();

    }

  }


  function buildMapPopup(
    vehicle
  ) {

    return `

      <div class="vehicle-map-popup">

        <div class="vehicle-map-popup-title">
          🚨 ${escapeHtml(
            vehicle.vehicleId
          )}
        </div>

        <div class="vehicle-map-popup-row">
          <span>Type</span>
          <strong>
            ${escapeHtml(
              vehicle.vehicleType
            )}
          </strong>
        </div>

        <div class="vehicle-map-popup-row">
          <span>Speed</span>
          <strong>
            ${escapeHtml(
              formatSpeed(
                vehicle.speed
              )
            )}
          </strong>
        </div>

        <div class="vehicle-map-popup-row">
          <span>Heading</span>
          <strong>
            ${escapeHtml(
              formatHeading(
                vehicle.heading
              )
            )}
          </strong>
        </div>

        <div class="vehicle-map-popup-row">
          <span>Latitude</span>
          <strong>
            ${escapeHtml(
              formatCoordinate(
                vehicle.latitude
              )
            )}
          </strong>
        </div>

        <div class="vehicle-map-popup-row">
          <span>Longitude</span>
          <strong>
            ${escapeHtml(
              formatCoordinate(
                vehicle.longitude
              )
            )}
          </strong>
        </div>

      </div>

    `;

  }


  /* =========================================================
     CURRENT VEHICLE
     ========================================================= */

  function renderCurrentVehicle() {

    const vehicle =
      state.selectedVehicleId
        ? state.vehicles.get(
            state.selectedVehicleId
          )
        : null;


    if (!vehicle) {

      currentVehicleBadge.textContent =
        "No Vehicle Selected";

      currentVehicleBadge.className =
        "vehicle-state-badge unknown";


      vehicleDetailsBody.innerHTML = `

        <tr>

          <td
            colspan="9"
            class="empty-cell"
          >
            Search for a stolen vehicle to view details.
          </td>

        </tr>

      `;


      notificationButton.disabled =
        true;


      monitoringDescription.textContent =
        "Search and select a stolen vehicle to enable online monitoring.";

      return;

    }


    const online =
      isVehicleOnline(
        vehicle
      );


    currentVehicleBadge.textContent =
      online
        ? "ONLINE"
        : "OFFLINE";


    currentVehicleBadge.className =
      online
        ? "vehicle-state-badge online"
        : "vehicle-state-badge offline";


    vehicleDetailsBody.innerHTML = `

      <tr>

        <td class="vehicle-id-cell">
          ${escapeHtml(
            vehicle.vehicleId
          )}
        </td>

        <td>
          ${escapeHtml(
            vehicle.vehicleType
          )}
        </td>

        <td class="location-cell">
          ${escapeHtml(
            formatCoordinate(
              vehicle.latitude
            )
          )}
        </td>

        <td class="location-cell">
          ${escapeHtml(
            formatCoordinate(
              vehicle.longitude
            )
          )}
        </td>

        <td>
          ${escapeHtml(
            formatSpeed(
              vehicle.speed
            )
          )}
        </td>

        <td>
          ${escapeHtml(
            formatHeading(
              vehicle.heading
            )
          )}
        </td>

        <td>
          ${escapeHtml(
            formatAccuracy(
              vehicle.accuracy
            )
          )}
        </td>

        <td>
          ${escapeHtml(
            formatDateTime(
              vehicle.lastOnline
            )
          )}
        </td>

        <td>

          <span
            class="status-badge ${
              online
                ? "online"
                : "offline"
            }"
          >
            ${
              online
                ? "Online"
                : "Offline"
            }
          </span>

        </td>

      </tr>

    `;


    const isMonitored =
      state.monitoredVehicleId ===
      vehicle.vehicleId;


    notificationButton.disabled =
      false;


    notificationButton.textContent =
      isMonitored
        ? "🔔 Monitoring Enabled"
        : "🔔 Notify Me When Vehicle Comes Online";


    monitoringDescription.textContent =
      isMonitored
        ? `SafePath is monitoring ${vehicle.vehicleId}. A popup will open when the vehicle comes online.`
        : `Enable monitoring for ${vehicle.vehicleId} to receive an alert when it comes online.`;

  }


  /* =========================================================
     STOLEN VEHICLES LIST
     ========================================================= */

  function renderStolenVehicles() {

    const vehicleIds =
      Array.from(
        state.stolenVehicleIds
      );


    stolenVehicleCount.textContent =
      `${vehicleIds.length} ${
        vehicleIds.length === 1
          ? "Vehicle"
          : "Vehicles"
      }`;


    if (
      vehicleIds.length === 0
    ) {

      stolenVehiclesBody.innerHTML = `

        <tr>

          <td
            colspan="11"
            class="empty-cell"
          >
            No stolen vehicles have been added.
          </td>

        </tr>

      `;

      return;

    }


    stolenVehiclesBody.innerHTML =
      "";


    vehicleIds.forEach(
      (vehicleId) => {

        const vehicle =
          state.vehicles.get(
            vehicleId
          ) ||
          createUnknownVehicle(
            vehicleId
          );


        const online =
          isVehicleOnline(
            vehicle
          );


        const monitored =
          state.monitoredVehicleId ===
          vehicleId;


        const row =
          document.createElement(
            "tr"
          );


        row.innerHTML = `

          <td class="vehicle-id-cell">
            ${escapeHtml(
              vehicle.vehicleId
            )}
          </td>

          <td>
            ${escapeHtml(
              vehicle.vehicleType
            )}
          </td>

          <td class="location-cell">
            ${escapeHtml(
              formatCoordinate(
                vehicle.latitude
              )
            )}
          </td>

          <td class="location-cell">
            ${escapeHtml(
              formatCoordinate(
                vehicle.longitude
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              formatSpeed(
                vehicle.speed
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              formatHeading(
                vehicle.heading
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              formatAccuracy(
                vehicle.accuracy
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              formatDateTime(
                vehicle.lastOnline
              )
            )}
          </td>

          <td>

            <span
              class="status-badge ${
                online
                  ? "online"
                  : "offline"
              }"
            >
              ${
                online
                  ? "Online"
                  : "Offline"
              }
            </span>

          </td>

          <td>

            <span
              class="monitoring-badge ${
                monitored
                  ? ""
                  : "not-monitoring"
              }"
            >
              ${
                monitored
                  ? "Monitoring"
                  : "Not Monitoring"
              }
            </span>

          </td>

          <td>

            <div class="row-actions">

              <button
                type="button"
                class="trace-row-button"
                data-action="trace"
                data-vehicle-id="${escapeHtml(
                  vehicle.vehicleId
                )}"
              >
                Trace
              </button>

              <button
                type="button"
                class="delete-row-button"
                data-action="delete"
                data-vehicle-id="${escapeHtml(
                  vehicle.vehicleId
                )}"
              >
                Delete
              </button>

            </div>

          </td>

        `;


        stolenVehiclesBody.appendChild(
          row
        );

      }
    );


    stolenVehiclesBody
      .querySelectorAll(
        "[data-action='trace']"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () => {

              traceVehicle(
                button.dataset.vehicleId
              );

            }
          );

        }
      );


    stolenVehiclesBody
      .querySelectorAll(
        "[data-action='delete']"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () => {

              openDeleteModal(
                button.dataset.vehicleId
              );

            }
          );

        }
      );

  }


  /* =========================================================
     MONITORING
     ========================================================= */

  function toggleMonitoring() {

    const vehicleId =
      state.selectedVehicleId;


    if (!vehicleId) {

      return;

    }


    if (
      state.monitoredVehicleId ===
      vehicleId
    ) {

      state.monitoredVehicleId =
        null;


      showToast(
        "Monitoring Disabled",
        `${vehicleId} is no longer being monitored for online alerts.`
      );

    } else {

      state.monitoredVehicleId =
        vehicleId;


      /*
       * If the vehicle is already online when monitoring is
       * enabled, immediately show its current location.
       */

      const vehicle =
        state.vehicles.get(
          vehicleId
        );


      if (
        vehicle &&
        isVehicleOnline(
          vehicle
        )
      ) {

        state.alertShownForOnlineState.delete(
          vehicleId
        );


        maybeShowOnlineAlert(
          vehicle
        );

      } else {

        showToast(
          "Monitoring Enabled",
          `${vehicleId} will trigger an alert when it comes online.`
        );

      }

    }


    renderCurrentVehicle();

    renderStolenVehicles();

  }


  /* =========================================================
     DELETE
     ========================================================= */

  function openDeleteModal(
    vehicleId
  ) {

    const normalizedId =
      normalizeVehicleId(
        vehicleId
      );


    if (!normalizedId) {
      return;
    }


    state.pendingDeleteVehicleId =
      normalizedId;


    deleteVehicleId.textContent =
      normalizedId;


    deleteModalOverlay.classList.add(
      "open"
    );

    deleteModalOverlay.setAttribute(
      "aria-hidden",
      "false"
    );

  }


  function closeDeleteModal() {

    deleteModalOverlay.classList.remove(
      "open"
    );

    deleteModalOverlay.setAttribute(
      "aria-hidden",
      "true"
    );


    state.pendingDeleteVehicleId =
      null;

  }


  function confirmDelete() {

    const vehicleId =
      state.pendingDeleteVehicleId;


    if (!vehicleId) {

      closeDeleteModal();

      return;

    }


    state.stolenVehicleIds.delete(
      vehicleId
    );


    saveStolenVehicles();


    if (
      state.monitoredVehicleId ===
      vehicleId
    ) {

      state.monitoredVehicleId =
        null;

    }


    if (
      state.selectedVehicleId ===
      vehicleId
    ) {

      state.selectedVehicleId =
        null;

    }


    state.alertShownForOnlineState.delete(
      vehicleId
    );


    closeDeleteModal();


    renderAll();


    showToast(
      "Vehicle Deleted",
      `${vehicleId} was removed from the stolen vehicle monitoring list.`
    );

  }


  /* =========================================================
     RENDER ALL
     ========================================================= */

  function renderAll() {

    renderCurrentVehicle();

    renderStolenVehicles();

    updateMonitoringDescription();

  }


  function updateMonitoringDescription() {

    const vehicleId =
      state.monitoredVehicleId;


    if (!vehicleId) {

      return;

    }


    monitoringDescription.textContent =
      `SafePath is monitoring ${vehicleId}. A popup will open when the vehicle comes online.`;

  }


  /* =========================================================
     REFRESH / FRESHNESS
     ========================================================= */

  function startRefreshTimer() {

    setInterval(
      () => {

        /*
         * Re-evaluate stale online vehicles every 15 seconds.
         */

        state.vehicles.forEach(
          (vehicle) => {

            const online =
              isVehicleOnline(
                vehicle
              );


            if (
              !online
            ) {

              state.alertShownForOnlineState.delete(
                vehicle.vehicleId
              );

            }

          }
        );


        renderCurrentVehicle();

        renderStolenVehicles();

      },
      15000
    );

  }


  /* =========================================================
     CONNECTION STATUS
     ========================================================= */

  function updateConnectionStatus(
    connected,
    text
  ) {

    connectionText.textContent =
      text;


    connectionStatus.classList.toggle(
      "online",
      connected
    );


    connectionStatus.classList.toggle(
      "offline",
      !connected
    );

  }


  /* =========================================================
     TOAST
     ========================================================= */

  let toastTimer = null;


  function showToast(
    title,
    message
  ) {

    toastTitle.textContent =
      title;


    toastMessage.textContent =
      message;


    toast.classList.add(
      "show"
    );


    clearTimeout(
      toastTimer
    );


    toastTimer =
      setTimeout(
        () => {

          toast.classList.remove(
            "show"
          );

        },
        4000
      );

  }


  /* =========================================================
     ALERT SOUND
     ========================================================= */

  function playAlertSound() {

    /*
     * Browser autoplay restrictions may prevent audio unless
     * the operator has previously interacted with the page.
     *
     * The popup itself is always displayed regardless.
     */

    try {

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;


      if (!AudioContext) {
        return;
      }


      const context =
        new AudioContext();


      const oscillator =
        context.createOscillator();


      const gain =
        context.createGain();


      oscillator.type =
        "sine";


      oscillator.frequency.value =
        880;


      gain.gain.value =
        0.08;


      oscillator.connect(
        gain
      );


      gain.connect(
        context.destination
      );


      oscillator.start();


      oscillator.stop(
        context.currentTime +
        0.25
      );


      oscillator.onended =
        () => {

          context.close();

        };

    } catch (error) {

      console.debug(
        "[Stolen] alert sound unavailable:",
        error
      );

    }

  }


  /* =========================================================
     HELPERS
     ========================================================= */

  function normalizeVehicleId(
    value
  ) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }


    return String(
      value
    )
      .trim()
      .toUpperCase();

  }


  function toNumber(
    value
  ) {

    const number =
      Number(
        value
      );


    return Number.isFinite(
      number
    )
      ? number
      : null;

  }


  function toNumberOrNull(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return null;

    }


    return toNumber(
      value
    );

  }


  function hasValidCoordinates(
    vehicle
  ) {

    return (
      vehicle &&
      Number.isFinite(
        vehicle.latitude
      ) &&
      Number.isFinite(
        vehicle.longitude
      ) &&
      vehicle.latitude >= -90 &&
      vehicle.latitude <= 90 &&
      vehicle.longitude >= -180 &&
      vehicle.longitude <= 180
    );

  }


  function createUnknownVehicle(
    vehicleId
  ) {

    return {

      vehicleId,

      vehicleType:
        "UNKNOWN",

      latitude:
        null,

      longitude:
        null,

      speed:
        0,

      heading:
        0,

      accuracy:
        null,

      lastOnline:
        null,

      currentOnline:
        false

    };

  }


  function formatCoordinate(
    value
  ) {

    if (
      !Number.isFinite(
        value
      )
    ) {

      return "—";

    }


    return Number(
      value
    ).toFixed(6);

  }


  function formatSpeed(
    value
  ) {

    if (
      !Number.isFinite(
        value
      )
    ) {

      return "—";

    }


    return `${Number(
      value
    ).toFixed(1)} km/h`;

  }


  function formatHeading(
    value
  ) {

    if (
      !Number.isFinite(
        value
      )
    ) {

      return "—";

    }


    return `${Math.round(
      value
    )}°`;

  }


  function formatAccuracy(
    value
  ) {

    if (
      !Number.isFinite(
        value
      )
    ) {

      return "—";

    }


    return `${Number(
      value
    ).toFixed(1)} m`;

  }


  function formatDateTime(
    value
  ) {

    if (!value) {

      return "—";

    }


    const date =
      new Date(
        value
      );


    if (
      !Number.isFinite(
        date.getTime()
      )
    ) {

      return "—";

    }


    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    );

  }


  function setSearchMessage(
    message,
    type
  ) {

    searchMessage.textContent =
      message;


    searchMessage.className =
      "search-message";


    if (type) {

      searchMessage.classList.add(
        type
      );

    }

  }


  function escapeHtml(
    value
  ) {

    return String(
      value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }

})();