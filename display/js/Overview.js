"use strict";

/* =========================================================
   SafePath - Overview
   Fleet Control Dashboard
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const BACKEND_URL =
  window.location.origin;

const VEHICLES_API =
  `${BACKEND_URL}/api/vehicles`;

const SOCKET_NAMESPACE =
  `${BACKEND_URL}/vehicles`;

const DEFAULT_CENTER = [
  18.445167,
  79.131954
];

const DEFAULT_ZOOM = 13;

/*
 * A vehicle is considered online only when:
 *
 * 1. Backend says currentOnline === true
 * 2. lastOnline exists
 * 3. lastOnline is not older than 2 minutes
 *
 * This is the same freshness rule used by vehicles.html.
 */
const ONLINE_TIMEOUT_MS =
  2 * 60 * 1000;


/* =========================================================
   STATE
   ========================================================= */

const state = {
  vehicles: [],
  socket: null,
  connected: false,
  map: null,
  markers: new Map()
};


/* =========================================================
   DOM
   ========================================================= */

const menuButton =
  document.getElementById(
    "menuButton"
  );

const drawerClose =
  document.getElementById(
    "drawerClose"
  );

const navigationDrawer =
  document.getElementById(
    "navigationDrawer"
  );

const navigationOverlay =
  document.getElementById(
    "navigationOverlay"
  );

const refreshButton =
  document.getElementById(
    "refreshButton"
  );

const connectionStatus =
  document.getElementById(
    "connectionStatus"
  );

const connectionText =
  document.getElementById(
    "connectionText"
  );

const totalVehicles =
  document.getElementById(
    "totalVehicles"
  );

const onlineVehicles =
  document.getElementById(
    "onlineVehicles"
  );

const offlineVehicles =
  document.getElementById(
    "offlineVehicles"
  );

const activeTypes =
  document.getElementById(
    "activeTypes"
  );

const carCount =
  document.getElementById(
    "carCount"
  );

const vipCount =
  document.getElementById(
    "vipCount"
  );

const policeCount =
  document.getElementById(
    "policeCount"
  );

const fireEngineCount =
  document.getElementById(
    "fireEngineCount"
  );

const ambulanceCount =
  document.getElementById(
    "ambulanceCount"
  );

const vehicleTableBody =
  document.getElementById(
    "vehicleTableBody"
  );

const vehicleEmpty =
  document.getElementById(
    "vehicleEmpty"
  );

const backendStatus =
  document.getElementById(
    "backendStatus"
  );

const socketStatus =
  document.getElementById(
    "socketStatus"
  );


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {
  initializeNavigation();

  initializeButtons();

  initializeMap();

  setConnectionState(
    "checking",
    "Connecting..."
  );

  await loadVehicles();

  initializeSocket();

  /*
   * Re-check online freshness periodically.
   *
   * This is important because a vehicle can become offline
   * without another telemetry message arriving.
   */
  window.setInterval(
    () => {
      renderDashboard();
    },
    15000
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function initializeNavigation() {
  if (menuButton) {
    menuButton.addEventListener(
      "click",
      openDrawer
    );
  }

  if (drawerClose) {
    drawerClose.addEventListener(
      "click",
      closeDrawer
    );
  }

  if (navigationOverlay) {
    navigationOverlay.addEventListener(
      "click",
      closeDrawer
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    }
  );

  /*
   * Close drawer after selecting a page.
   */
  document
    .querySelectorAll(
      ".drawer-navigation a"
    )
    .forEach(
      (link) => {
        link.addEventListener(
          "click",
          closeDrawer
        );
      }
    );
}


function openDrawer() {
  if (navigationDrawer) {
    navigationDrawer.classList.add(
      "open"
    );

    navigationDrawer.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  if (navigationOverlay) {
    navigationOverlay.classList.add(
      "open"
    );
  }
}


function closeDrawer() {
  if (navigationDrawer) {
    navigationDrawer.classList.remove(
      "open"
    );

    navigationDrawer.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  if (navigationOverlay) {
    navigationOverlay.classList.remove(
      "open"
    );
  }
}


/* =========================================================
   BUTTONS
   ========================================================= */

function initializeButtons() {
  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      refreshDashboard
    );
  }
}


async function refreshDashboard() {
  if (!refreshButton) {
    return;
  }

  refreshButton.disabled = true;

  refreshButton.textContent =
    "Refreshing...";

  try {
    await loadVehicles();

    reconnectSocket();
  } finally {
    refreshButton.disabled = false;

    refreshButton.textContent =
      "Refresh";
  }
}


/* =========================================================
   BACKEND
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

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const vehicles =
      await response.json();

    if (!Array.isArray(vehicles)) {
      throw new Error(
        "Invalid vehicle response."
      );
    }

    state.vehicles =
      vehicles.map(
        normalizeVehicle
      );

    if (backendStatus) {
      backendStatus.textContent =
        "Connected";

      backendStatus.className =
        "ok";
    }

    renderDashboard();

    setConnectionState(
      "connected",
      "Connected"
    );
  } catch (error) {
    console.error(
      "[SafePath Overview] Backend error:",
      error
    );

    if (backendStatus) {
      backendStatus.textContent =
        "Unavailable";

      backendStatus.className =
        "error";
    }

    setConnectionState(
      "disconnected",
      "Disconnected"
    );
  }
}


/* =========================================================
   SOCKET.IO
   ========================================================= */

function initializeSocket(
  forceReconnect = false
) {
  if (
    typeof window.io !==
    "function"
  ) {
    if (socketStatus) {
      socketStatus.textContent =
        "Unavailable";

      socketStatus.className =
        "error";
    }

    return;
  }

  if (
    state.socket &&
    forceReconnect
  ) {
    try {
      state.socket.disconnect();
    } catch {
      // Ignore.
    }

    state.socket = null;
  }

  if (state.socket) {
    return;
  }

  state.socket =
    window.io(
      SOCKET_NAMESPACE,
      {
        transports: [
          "websocket",
          "polling"
        ],

        reconnection: true,

        reconnectionAttempts:
          Infinity,

        reconnectionDelay:
          1000,

        timeout:
          10000
      }
    );

  state.socket.on(
    "connect",
    () => {
      state.connected = true;

      if (socketStatus) {
        socketStatus.textContent =
          "Connected";

        socketStatus.className =
          "ok";
      }

      setConnectionState(
        "connected",
        "Connected"
      );

      renderDashboard();
    }
  );

  state.socket.on(
    "disconnect",
    () => {
      state.connected = false;

      if (socketStatus) {
        socketStatus.textContent =
          "Disconnected";

        socketStatus.className =
          "error";
      }

      setConnectionState(
        "disconnected",
        "Disconnected"
      );
    }
  );

  state.socket.on(
    "connect_error",
    (error) => {
      console.error(
        "[SafePath Overview] Socket error:",
        error
      );

      if (socketStatus) {
        socketStatus.textContent =
          "Connection error";

        socketStatus.className =
          "error";
      }
    }
  );

  state.socket.on(
    "fleet:snapshot",
    handleFleetSnapshot
  );

  state.socket.on(
    "fleet:telemetry",
    handleFleetTelemetry
  );
}


function reconnectSocket() {
  if (state.socket) {
    try {
      state.socket.disconnect();
    } catch {
      // Ignore.
    }

    state.socket = null;
  }

  initializeSocket();
}


/* =========================================================
   FLEET SOCKET EVENTS
   ========================================================= */

function handleFleetSnapshot(
  payload
) {
  if (
    !payload ||
    !Array.isArray(
      payload.vehicles
    )
  ) {
    return;
  }

  state.vehicles =
    mergeVehicles(
      state.vehicles,
      payload.vehicles.map(
        normalizeVehicle
      )
    );

  renderDashboard();
}


function handleFleetTelemetry(
  payload
) {
  if (!payload) {
    return;
  }

  const incoming =
    payload.vehicle ??
    payload;

  if (
    !incoming ||
    !incoming.vehicleId
  ) {
    return;
  }

  upsertVehicle(
    normalizeVehicle(
      incoming
    )
  );

  renderDashboard();
}


/* =========================================================
   VEHICLE STATE
   ========================================================= */

function upsertVehicle(
  vehicle
) {
  const index =
    state.vehicles.findIndex(
      (item) =>
        item.vehicleId ===
        vehicle.vehicleId
    );

  if (index === -1) {
    state.vehicles.push(
      vehicle
    );
  } else {
    state.vehicles[index] = {
      ...state.vehicles[index],
      ...vehicle
    };
  }
}


function mergeVehicles(
  existing,
  incoming
) {
  const map =
    new Map();

  existing.forEach(
    (vehicle) => {
      map.set(
        vehicle.vehicleId,
        vehicle
      );
    }
  );

  incoming.forEach(
    (vehicle) => {
      const old =
        map.get(
          vehicle.vehicleId
        );

      map.set(
        vehicle.vehicleId,
        {
          ...old,
          ...vehicle
        }
      );
    }
  );

  return Array.from(
    map.values()
  );
}


/* =========================================================
   VEHICLE ONLINE/OFFLINE LOGIC
   ========================================================= */

/*
 * IMPORTANT:
 *
 * Do not use only:
 *
 * Boolean(vehicle.currentOnline)
 *
 * because the backend can still contain a previously
 * stored currentOnline=true value after telemetry becomes
 * stale.
 *
 * The vehicle is online only when the latest telemetry is
 * fresh.
 */
function isVehicleOnline(
  vehicle
) {
  if (!vehicle) {
    return false;
  }

  if (
    vehicle.currentOnline !== true
  ) {
    return false;
  }

  if (
    !vehicle.lastOnline
  ) {
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

  if (age < 0) {
    /*
     * Future timestamps are treated as
     * fresh rather than immediately offline.
     */
    return true;
  }

  return (
    age <=
    ONLINE_TIMEOUT_MS
  );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  renderSummary();

  renderTypeCounts();

  renderVehicleTable();

  renderMap();
}


/* =========================================================
   SUMMARY
   ========================================================= */

function renderSummary() {
  const total =
    state.vehicles.length;

  /*
   * Use the same online rule as vehicles.html.
   */
  const online =
    state.vehicles.filter(
      (vehicle) =>
        isVehicleOnline(
          vehicle
        )
    ).length;

  const offline =
    total - online;

  const types =
    new Set(
      state.vehicles.map(
        (vehicle) =>
          normalizeVehicleType(
            vehicle.vehicleType
          )
      )
    );

  if (totalVehicles) {
    totalVehicles.textContent =
      String(total);
  }

  if (onlineVehicles) {
    onlineVehicles.textContent =
      String(online);
  }

  if (offlineVehicles) {
    offlineVehicles.textContent =
      String(offline);
  }

  if (activeTypes) {
    activeTypes.textContent =
      String(types.size);
  }
}


/* =========================================================
   TYPE COUNTS
   ========================================================= */

function renderTypeCounts() {
  const counts = {
    CAR: 0,
    VIP: 0,
    POLICE: 0,
    FIRE_ENGINE: 0,
    AMBULANCE: 0
  };

  /*
   * Fleet type counts represent the complete fleet,
   * not only currently online vehicles.
   */
  state.vehicles.forEach(
    (vehicle) => {
      const type =
        normalizeVehicleType(
          vehicle.vehicleType
        );

      if (
        Object.prototype.hasOwnProperty.call(
          counts,
          type
        )
      ) {
        counts[type] += 1;
      }
    }
  );

  if (carCount) {
    carCount.textContent =
      String(counts.CAR);
  }

  if (vipCount) {
    vipCount.textContent =
      String(counts.VIP);
  }

  if (policeCount) {
    policeCount.textContent =
      String(counts.POLICE);
  }

  if (fireEngineCount) {
    fireEngineCount.textContent =
      String(counts.FIRE_ENGINE);
  }

  if (ambulanceCount) {
    ambulanceCount.textContent =
      String(counts.AMBULANCE);
  }
}


/* =========================================================
   VEHICLE TABLE
   ========================================================= */

function renderVehicleTable() {
  if (!vehicleTableBody) {
    return;
  }

  vehicleTableBody.innerHTML =
    "";

  if (
    state.vehicles.length === 0
  ) {
    if (vehicleEmpty) {
      vehicleEmpty.style.display =
        "flex";
    }

    return;
  }

  if (vehicleEmpty) {
    vehicleEmpty.style.display =
      "none";
  }

  const vehicles =
    [...state.vehicles]
      .sort(
        (a, b) => {
          const aTime =
            new Date(
              a.lastOnline || 0
            ).getTime();

          const bTime =
            new Date(
              b.lastOnline || 0
            ).getTime();

          return bTime - aTime;
        }
      )
      .slice(
        0,
        10
      );

  vehicles.forEach(
    (vehicle) => {
      const row =
        document.createElement(
          "tr"
        );

      /*
       * IMPORTANT:
       * Use freshness-aware status.
       */
      const status =
        isVehicleOnline(
          vehicle
        );

      row.innerHTML = `
        <td class="vehicle-id">
          ${escapeHtml(
            vehicle.vehicleId
          )}
        </td>

        <td>
          <span class="type-badge">
            ${escapeHtml(
              formatVehicleType(
                vehicle.vehicleType
              )
            )}
          </span>
        </td>

        <td>
          ${formatNumber(
            vehicle.speed,
            1
          )} km/h
        </td>

        <td>
          ${formatNumber(
            vehicle.heading,
            1
          )}°
        </td>

        <td>
          ${formatCoordinate(
            vehicle.latitude
          )},
          ${formatCoordinate(
            vehicle.longitude
          )}
        </td>

        <td>
          <span class="status-badge ${
            status
              ? "online"
              : "offline"
          }">
            <span></span>
            ${
              status
                ? "Online"
                : "Offline"
            }
          </span>
        </td>
      `;

      row.style.cursor =
        "pointer";

      row.addEventListener(
        "click",
        () => {
          window.location.href =
            `events.html?vehicleId=${encodeURIComponent(
              vehicle.vehicleId
            )}`;
        }
      );

      vehicleTableBody.appendChild(
        row
      );
    }
  );
}


/* =========================================================
   MAP
   ========================================================= */

function initializeMap() {
  if (
    typeof window.L ===
    "undefined"
  ) {
    return;
  }

  state.map =
    L.map(
      "overviewMap",
      {
        zoomControl: true
      }
    );

  /*
   * OpenStreetMap
   *
   * No API key.
   * No Google Maps.
   * No CARTO.
   * No OSRM.
   */
  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "&copy; OpenStreetMap contributors",

      maxZoom:
        19
    }
  ).addTo(
    state.map
  );

  state.map.setView(
    DEFAULT_CENTER,
    DEFAULT_ZOOM
  );
}


/* =========================================================
   MAP RENDERING
   ========================================================= */

function renderMap() {
  if (
    !state.map
  ) {
    return;
  }

  const activeIds =
    new Set();

  state.vehicles.forEach(
    (vehicle) => {
      const latitude =
        Number(
          vehicle.latitude
        );

      const longitude =
        Number(
          vehicle.longitude
        );

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
      ) {
        return;
      }

      /*
       * IMPORTANT:
       *
       * Only currently online vehicles are displayed
       * on the Overview live map.
       *
       * A stale vehicle must not remain visible as an
       * active live vehicle.
       */
      if (
        !isVehicleOnline(
          vehicle
        )
      ) {
        return;
      }

      const id =
        vehicle.vehicleId;

      activeIds.add(
        id
      );

      const position = [
        latitude,
        longitude
      ];

      let marker =
        state.markers.get(
          id
        );

      if (!marker) {
        const icon =
          L.divIcon(
            {
              className:
                "",

              html:
                `<div class="overview-marker">●</div>`,

              iconSize:
                [40, 40],

              iconAnchor:
                [20, 20],

              popupAnchor:
                [0, -20]
            }
          );

        marker =
          L.marker(
            position,
            {
              icon
            }
          ).addTo(
            state.map
          );

        state.markers.set(
          id,
          marker
        );
      } else {
        marker.setLatLng(
          position
        );
      }

      marker.bindPopup(
        createPopup(
          vehicle
        )
      );
    }
  );

  /*
   * Remove markers that are no longer active.
   *
   * This includes vehicles that became offline.
   */
  state.markers.forEach(
    (marker, id) => {
      if (
        !activeIds.has(
          id
        )
      ) {
        state.map.removeLayer(
          marker
        );

        state.markers.delete(
          id
        );
      }
    }
  );
}


/* =========================================================
   POPUP
   ========================================================= */

function createPopup(
  vehicle
) {
  const status =
    isVehicleOnline(
      vehicle
    );

  return `
    <div style="min-width:220px">

      <strong style="font-size:16px">
        ${escapeHtml(
          vehicle.vehicleId
        )}
      </strong>

      <hr>

      <div>
        Type:
        <strong>
          ${escapeHtml(
            formatVehicleType(
              vehicle.vehicleType
            )
          )}
        </strong>
      </div>

      <div>
        Speed:
        <strong>
          ${formatNumber(
            vehicle.speed,
            1
          )} km/h
        </strong>
      </div>

      <div>
        Heading:
        <strong>
          ${formatNumber(
            vehicle.heading,
            1
          )}°
        </strong>
      </div>

      <div>
        Accuracy:
        <strong>
          ${
            vehicle.accuracy === null ||
            vehicle.accuracy === undefined
              ? "—"
              : `${formatNumber(
                  vehicle.accuracy,
                  1
                )} m`
          }
        </strong>
      </div>

      <div>
        Status:
        <strong>
          ${
            status
              ? "Online"
              : "Offline"
          }
        </strong>
      </div>

    </div>
  `;
}


/* =========================================================
   CONNECTION
   ========================================================= */

function setConnectionState(
  stateName,
  text
) {
  if (
    !connectionStatus ||
    !connectionText
  ) {
    return;
  }

  connectionStatus.classList.remove(
    "connected",
    "disconnected",
    "checking"
  );

  connectionStatus.classList.add(
    stateName
  );

  connectionText.textContent =
    text;
}


/* =========================================================
   VEHICLE NORMALIZATION
   ========================================================= */

function normalizeVehicle(
  vehicle
) {
  if (!vehicle) {
    return {
      vehicleId: "",
      vehicleType: "NORMAL",
      latitude: null,
      longitude: null,
      speed: 0,
      heading: 0,
      accuracy: null,
      lastOnline: null,
      currentOnline: false
    };
  }

  return {
    ...vehicle,

    vehicleId:
      String(
        vehicle.vehicleId ??
        vehicle.vehicleIdentifier ??
        ""
      ).trim(),

    vehicleType:
      vehicle.vehicleType ??
      "NORMAL",

    latitude:
      Number(
        vehicle.latitude
      ),

    longitude:
      Number(
        vehicle.longitude
      ),

    speed:
      Number(
        vehicle.speed ?? 0
      ),

    heading:
      Number(
        vehicle.heading ?? 0
      ),

    accuracy:
      vehicle.accuracy === null ||
      vehicle.accuracy === undefined
        ? null
        : Number(
            vehicle.accuracy
          ),

    lastOnline:
      vehicle.lastOnline ??
      vehicle.timestamp ??
      null,

    currentOnline:
      vehicle.currentOnline === true
  };
}


/* =========================================================
   VEHICLE TYPE
   ========================================================= */

function normalizeVehicleType(
  type
) {
  const normalized =
    String(
      type || ""
    )
      .trim()
      .toUpperCase()
      .replaceAll(
        " ",
        "_"
      );

  switch (
    normalized
  ) {
    case "NORMAL":
    case "CAR":
      return "CAR";

    case "VIP":
      return "VIP";

    case "POLICE":
      return "POLICE";

    case "FIRE_ENGINE":
      return "FIRE_ENGINE";

    case "AMBULANCE":
      return "AMBULANCE";

    default:
      return "CAR";
  }
}


function formatVehicleType(
  type
) {
  switch (
    normalizeVehicleType(
      type
    )
  ) {
    case "CAR":
      return "Car";

    case "VIP":
      return "VIP";

    case "POLICE":
      return "Police";

    case "FIRE_ENGINE":
      return "Fire Engine";

    case "AMBULANCE":
      return "Ambulance";

    default:
      return "Car";
  }
}


/* =========================================================
   FORMATTERS
   ========================================================= */

function formatNumber(
  value,
  decimals = 0
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0";
  }

  return number.toFixed(
    decimals
  );
}


function formatCoordinate(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "—";
  }

  return number.toFixed(
    6
  );
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}