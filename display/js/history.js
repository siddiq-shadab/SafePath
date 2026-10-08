"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const BACKEND_URL = window.location.origin;

const VEHICLES_API =
  `${BACKEND_URL}/api/vehicles`;

const DEFAULT_MAP_CENTER = [
  18.445167,
  79.131954
];

const DEFAULT_MAP_ZOOM = 13;


/* =========================================================
   STATE
   ========================================================= */

const state = {
  vehicles: [],
  history: [],
  map: null,
  routeLine: null,
  startMarker: null,
  endMarker: null,
  routeMarkers: [],
  loading: false
};


/* =========================================================
   DOM
   ========================================================= */

const menuButton =
  document.getElementById("menuButton");

const drawerClose =
  document.getElementById("drawerClose");

const navigationDrawer =
  document.getElementById("navigationDrawer");

const navigationOverlay =
  document.getElementById("navigationOverlay");

const refreshButton =
  document.getElementById("refreshButton");

const connectionStatus =
  document.getElementById("connectionStatus");

const connectionText =
  document.getElementById("connectionText");

const vehicleSelect =
  document.getElementById("vehicleSelect");

const fromDate =
  document.getElementById("fromDate");

const toDate =
  document.getElementById("toDate");

const recordLimit =
  document.getElementById("recordLimit");

const loadHistoryButton =
  document.getElementById("loadHistoryButton");

const clearButton =
  document.getElementById("clearButton");

const historyError =
  document.getElementById("historyError");

const errorTitle =
  document.getElementById("errorTitle");

const errorText =
  document.getElementById("errorText");

const statVehicle =
  document.getElementById("statVehicle");

const statRecords =
  document.getElementById("statRecords");

const statFirstRecord =
  document.getElementById("statFirstRecord");

const statLastRecord =
  document.getElementById("statLastRecord");

const historyTablePanel =
  document.getElementById("historyTablePanel");

const historyTableBody =
  document.getElementById("historyTableBody");

const recordCountBadge =
  document.getElementById("recordCountBadge");

const routeStatus =
  document.getElementById("routeStatus");


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

  initializeNavigation();

  initializeMap();

  initializeEvents();

  await checkBackendConnection();

  await loadVehicles();
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
}


function openDrawer() {

  navigationDrawer.classList.add(
    "open"
  );

  navigationOverlay.classList.add(
    "open"
  );
}


function closeDrawer() {

  navigationDrawer.classList.remove(
    "open"
  );

  navigationOverlay.classList.remove(
    "open"
  );
}


/* =========================================================
   MAP
   ========================================================= */

function initializeMap() {

  if (
    typeof L === "undefined"
  ) {

    showError(
      "Map unavailable.",
      "Leaflet could not be loaded."
    );

    return;
  }


  state.map =
    L.map(
      "historyMap",
      {
        center:
          DEFAULT_MAP_CENTER,

        zoom:
          DEFAULT_MAP_ZOOM,

        zoomControl:
          true
      }
    );


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
}


/* =========================================================
   EVENTS
   ========================================================= */

function initializeEvents() {

  refreshButton.addEventListener(
    "click",
    async () => {

      await checkBackendConnection();

      await loadVehicles();

      if (
        vehicleSelect.value
      ) {

        await loadHistory();

      }

    }
  );


  loadHistoryButton.addEventListener(
    "click",
    loadHistory
  );


  clearButton.addEventListener(
    "click",
    clearHistory
  );


  vehicleSelect.addEventListener(
    "change",
    () => {

      clearHistoryDisplay();

    }
  );
}


/* =========================================================
   BACKEND CONNECTION
   ========================================================= */

async function checkBackendConnection() {

  setConnectionState(
    "checking",
    "Connecting..."
  );


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


    setConnectionState(
      "connected",
      "Connected"
    );


    return true;

  } catch (error) {

    console.error(
      "Backend connection failed:",
      error
    );


    setConnectionState(
      "disconnected",
      "Disconnected"
    );


    return false;
  }
}


function setConnectionState(
  stateName,
  text
) {

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
   LOAD VEHICLES
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
        `Vehicle request failed with HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {

      throw new Error(
        "Invalid vehicle response from backend."
      );

    }


    state.vehicles =
      data;


    populateVehicleSelect(
      data
    );


    hideError();

  } catch (error) {

    console.error(
      "Unable to load vehicles:",
      error
    );


    showError(
      "Unable to load vehicles.",
      error.message
    );
  }
}


/* =========================================================
   VEHICLE SELECT
   ========================================================= */

function populateVehicleSelect(
  vehicles
) {

  const currentValue =
    vehicleSelect.value;


  vehicleSelect.innerHTML =
    "";


  const placeholder =
    document.createElement(
      "option"
    );

  placeholder.value = "";

  placeholder.textContent =
    "Select vehicle";

  vehicleSelect.appendChild(
    placeholder
  );


  vehicles.forEach(
    (vehicle) => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        vehicle.vehicleId;

      option.textContent =
        vehicle.vehicleId;

      vehicleSelect.appendChild(
        option
      );

    }
  );


  if (
    currentValue &&
    vehicles.some(
      (vehicle) =>
        vehicle.vehicleId ===
        currentValue
    )
  ) {

    vehicleSelect.value =
      currentValue;

  }
}


/* =========================================================
   LOAD HISTORY
   ========================================================= */

async function loadHistory() {

  if (state.loading) {
    return;
  }


  const vehicleId =
    vehicleSelect.value;


  if (!vehicleId) {

    showError(
      "Select a vehicle.",
      "Choose a vehicle before loading history."
    );

    return;
  }


  const limit =
    Number(
      recordLimit.value
    );


  if (
    !Number.isInteger(limit) ||
    limit < 1
  ) {

    showError(
      "Invalid record limit.",
      "Choose a valid number of records."
    );

    return;
  }


  const from =
    getDateTimeValue(
      fromDate.value
    );


  const to =
    getDateTimeValue(
      toDate.value
    );


  if (
    from &&
    to &&
    new Date(from) > new Date(to)
  ) {

    showError(
      "Invalid date range.",
      "The From date must be earlier than the To date."
    );

    return;
  }


  state.loading =
    true;


  setLoadingState(
    true
  );


  hideError();


  try {

    const params =
      new URLSearchParams();


    params.set(
      "limit",
      String(limit)
    );


    if (from) {

      params.set(
        "from",
        from
      );

    }


    if (to) {

      params.set(
        "to",
        to
      );

    }


    const url =
      `${VEHICLES_API}/${encodeURIComponent(vehicleId)}/history?${params.toString()}`;


    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      let message =
        `HTTP ${response.status}`;

      try {

        const errorData =
          await response.json();

        if (
          errorData &&
          errorData.message
        ) {

          message =
            Array.isArray(
              errorData.message
            )
              ? errorData.message.join(
                  ", "
                )
              : errorData.message;
        }

      } catch {
        // Keep HTTP error.
      }


      throw new Error(
        message
      );
    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {

      throw new Error(
        "Invalid history response from backend."
      );

    }


    state.history =
      normalizeHistory(
        data
      );


    updateStatistics(
      vehicleId,
      state.history
    );


    renderHistoryTable(
      state.history
    );


    drawHistoricalRoute(
      state.history
    );


    historyTablePanel.classList.remove(
      "hidden"
    );


    if (
      state.history.length > 0
    ) {

      routeStatus.textContent =
        `${formatNumber(state.history.length)} records loaded`;

    } else {

      routeStatus.textContent =
        "No history found";

    }


    hideError();

  } catch (error) {

    console.error(
      "Unable to load history:",
      error
    );


    clearHistoryDisplay();


    showError(
      "Unable to load history.",
      error.message
    );

  } finally {

    state.loading =
      false;

    setLoadingState(
      false
    );
  }
}


/* =========================================================
   DATE HANDLING
   ========================================================= */

function getDateTimeValue(
  value
) {

  if (!value) {
    return null;
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;
  }


  return date.toISOString();
}


/* =========================================================
   NORMALIZE HISTORY
   ========================================================= */

function normalizeHistory(
  records
) {

  return records
    .map(
      (record) => {

        return {
          vehicleId:
            String(
              record.vehicleId ??
              ""
            ),

          vehicleType:
            String(
              record.vehicleType ??
              "NORMAL"
            ),

          latitude:
            Number(
              record.latitude
            ),

          longitude:
            Number(
              record.longitude
            ),

          speed:
            Number(
              record.speed
            ),

          heading:
            Number(
              record.heading
            ),

          accuracy:
            record.accuracy === null ||
            record.accuracy === undefined
              ? null
              : Number(
                  record.accuracy
                ),

          recordedAt:
            record.recordedAt
        };

      }
    )
    .filter(
      (record) =>
        Number.isFinite(
          record.latitude
        ) &&
        Number.isFinite(
          record.longitude
        ) &&
        record.recordedAt
    );
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics(
  vehicleId,
  records
) {

  statVehicle.textContent =
    vehicleId || "—";


  statRecords.textContent =
    formatNumber(
      records.length
    );


  if (
    records.length === 0
  ) {

    statFirstRecord.textContent =
      "—";

    statLastRecord.textContent =
      "—";

    return;
  }


  const sorted =
    [...records].sort(
      (a, b) =>
        new Date(
          a.recordedAt
        ) -
        new Date(
          b.recordedAt
        )
    );


  statFirstRecord.textContent =
    formatDateTime(
      sorted[0].recordedAt
    );


  statLastRecord.textContent =
    formatDateTime(
      sorted[
        sorted.length - 1
      ].recordedAt
    );
}


/* =========================================================
   HISTORY TABLE
   ========================================================= */

function renderHistoryTable(
  records
) {

  historyTableBody.innerHTML =
    "";


  if (
    records.length === 0
  ) {

    historyTableBody.innerHTML = `
      <tr>
        <td
          colspan="8"
          style="
            text-align:center;
            padding:40px;
            color:#64748b;
          "
        >
          No historical telemetry found for this vehicle.
        </td>
      </tr>
    `;

    recordCountBadge.textContent =
      "0 records";

    return;
  }


  const fragment =
    document.createDocumentFragment();


  records.forEach(
    (record) => {

      const row =
        document.createElement(
          "tr"
        );


      row.innerHTML = `
        <td class="vehicle-id-cell">
          ${escapeHtml(record.vehicleId)}
        </td>

        <td>
          <span class="vehicle-type-badge">
            ${escapeHtml(formatVehicleType(record.vehicleType))}
          </span>
        </td>

        <td>
          ${formatCoordinate(record.latitude)}
        </td>

        <td>
          ${formatCoordinate(record.longitude)}
        </td>

        <td>
          ${formatNumber(record.speed, 1)} km/h
        </td>

        <td>
          ${formatNumber(record.heading, 1)}°
        </td>

        <td>
          ${
            record.accuracy === null
              ? "—"
              : `${formatNumber(record.accuracy, 1)} m`
          }
        </td>

        <td>
          ${escapeHtml(formatDateTime(record.recordedAt))}
        </td>
      `;


      fragment.appendChild(
        row
      );

    }
  );


  historyTableBody.appendChild(
    fragment
  );


  recordCountBadge.textContent =
    `${formatNumber(records.length)} ${
      records.length === 1
        ? "record"
        : "records"
    }`;
}


/* =========================================================
   HISTORICAL ROUTE
   ========================================================= */

function drawHistoricalRoute(
  records
) {

  clearRoute();


  if (
    !state.map ||
    records.length === 0
  ) {

    return;
  }


  const sorted =
    [...records].sort(
      (a, b) =>
        new Date(
          a.recordedAt
        ) -
        new Date(
          b.recordedAt
        )
    );


  const points =
    sorted.map(
      (record) => [
        record.latitude,
        record.longitude
      ]
    );


  if (
    points.length === 1
  ) {

    state.map.setView(
      points[0],
      17
    );


    state.startMarker =
      L.circleMarker(
        points[0],
        {
          radius: 8,
          weight: 3
        }
      )
      .addTo(
        state.map
      )
      .bindPopup(
        createRoutePopup(
          sorted[0],
          "Recorded position"
        )
      );


    routeStatus.textContent =
      "1 record loaded";

    return;
  }


  state.routeLine =
    L.polyline(
      points,
      {
        weight: 5,
        opacity: 0.9
      }
    ).addTo(
      state.map
    );


  const start =
    sorted[0];

  const end =
    sorted[
      sorted.length - 1
    ];


  state.startMarker =
    L.circleMarker(
      [
        start.latitude,
        start.longitude
      ],
      {
        radius: 8,
        weight: 3
      }
    )
    .addTo(
      state.map
    )
    .bindPopup(
      createRoutePopup(
        start,
        "Start"
      )
    );


  state.endMarker =
    L.circleMarker(
      [
        end.latitude,
        end.longitude
      ],
      {
        radius: 8,
        weight: 3
      }
    )
    .addTo(
      state.map
    )
    .bindPopup(
      createRoutePopup(
        end,
        "Latest"
      )
    );


  const bounds =
    state.routeLine.getBounds();


  if (
    bounds.isValid()
  ) {

    state.map.fitBounds(
      bounds,
      {
        padding: [
          40,
          40
        ],
        maxZoom: 17
      }
    );

  }
}


function createRoutePopup(
  record,
  title
) {

  return `
    <div class="route-popup">

      <strong>
        ${escapeHtml(title)}
      </strong>

      <div class="route-popup-row">
        <span>Vehicle</span>
        <span>
          ${escapeHtml(record.vehicleId)}
        </span>
      </div>

      <div class="route-popup-row">
        <span>Speed</span>
        <span>
          ${formatNumber(record.speed, 1)} km/h
        </span>
      </div>

      <div class="route-popup-row">
        <span>Heading</span>
        <span>
          ${formatNumber(record.heading, 1)}°
        </span>
      </div>

      <div class="route-popup-row">
        <span>Accuracy</span>
        <span>
          ${
            record.accuracy === null
              ? "—"
              : `${formatNumber(record.accuracy, 1)} m`
          }
        </span>
      </div>

      <div class="route-popup-row">
        <span>Recorded</span>
        <span>
          ${escapeHtml(formatDateTime(record.recordedAt))}
        </span>
      </div>

    </div>
  `;
}


/* =========================================================
   CLEAR ROUTE
   ========================================================= */

function clearRoute() {

  if (
    state.routeLine &&
    state.map
  ) {

    state.map.removeLayer(
      state.routeLine
    );

  }


  if (
    state.startMarker &&
    state.map
  ) {

    state.map.removeLayer(
      state.startMarker
    );

  }


  if (
    state.endMarker &&
    state.map
  ) {

    state.map.removeLayer(
      state.endMarker
    );

  }


  state.routeLine =
    null;

  state.startMarker =
    null;

  state.endMarker =
    null;


  state.routeMarkers.forEach(
    (marker) => {

      if (state.map) {

        state.map.removeLayer(
          marker
        );

      }

    }
  );


  state.routeMarkers =
    [];
}


/* =========================================================
   CLEAR HISTORY
   ========================================================= */

function clearHistory() {

  clearHistoryDisplay();

  hideError();
}


function clearHistoryDisplay() {

  state.history =
    [];


  statVehicle.textContent =
    "—";

  statRecords.textContent =
    "0";

  statFirstRecord.textContent =
    "—";

  statLastRecord.textContent =
    "—";


  historyTableBody.innerHTML =
    "";


  historyTablePanel.classList.add(
    "hidden"
  );


  recordCountBadge.textContent =
    "0 records";


  routeStatus.textContent =
    "No history loaded";


  clearRoute();


  if (state.map) {

    state.map.setView(
      DEFAULT_MAP_CENTER,
      DEFAULT_MAP_ZOOM
    );

  }
}


/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function showError(
  title,
  message
) {

  errorTitle.textContent =
    title;


  errorText.textContent =
    message || "";


  historyError.classList.remove(
    "hidden"
  );
}


function hideError() {

  historyError.classList.add(
    "hidden"
  );

  errorTitle.textContent =
    "Unable to load history.";

  errorText.textContent =
    "";
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setLoadingState(
  loading
) {

  loadHistoryButton.disabled =
    loading;


  if (loading) {

    loadHistoryButton.textContent =
      "Loading...";

  } else {

    loadHistoryButton.textContent =
      "Load History";

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
    !Number.isFinite(number)
  ) {

    return "0";
  }


  return number.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits:
        decimals,

      maximumFractionDigits:
        decimals
    }
  );
}


function formatCoordinate(
  value
) {

  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {

    return "—";
  }


  return number.toFixed(
    6
  );
}


function formatDateTime(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";
  }


  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }
  );
}


function formatVehicleType(
  type
) {

  const normalized =
    String(
      type || ""
    )
      .trim()
      .toUpperCase();


  switch (normalized) {

    case "CAR":
    case "NORMAL":
      return "Car";

    case "VIP":
      return "VIP";

    case "POLICE":
      return "Police";

    case "FIRE_ENGINE":
    case "FIRE ENGINE":
      return "Fire Engine";

    case "AMBULANCE":
      return "Ambulance";

    default:
      return type || "Unknown";
  }
}


/* =========================================================
   HTML ESCAPING
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