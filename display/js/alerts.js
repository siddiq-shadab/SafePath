/*
=========================================================
   SAFEPATH - ALERTS

   D:\Sec\safe_path_nodejs\display\js\alerts.js

   Flow:

   Flutter SOS
        ↓
   NestJS POST /api/emergency/sos
        ↓
   EmergencyGateway
        ↓
   Socket.IO namespace /emergency
        ↓
   This page

   IMPORTANT:
   This file uses the SINGLE #alertMap element that already
   exists in alerts.html.

   It does NOT create another Live Location panel.
=========================================================
*/

(() => {
  'use strict';

  /* =======================================================
     CONFIGURATION
  ======================================================== */

  const BACKEND_URL = window.location.origin;

  const EMERGENCY_NAMESPACE =
    `${BACKEND_URL}/emergency`;

  const VEHICLES_ENDPOINT =
    `${BACKEND_URL}/api/vehicles`;

  const ONLINE_TIMEOUT_MS =
    2 * 60 * 1000;

  const DEFAULT_MAP_CENTER = [
    18.445167,
    79.131954,
  ];

  const DEFAULT_MAP_ZOOM = 14;


  /* =======================================================
     STATE
  ======================================================== */

  const state = {
    socket: null,

    backendConnected: false,

    socketConnected: false,

    alerts: new Map(),

    map: null,

    vehicleMarker: null,

    activeVehicleId: null,

    refreshInProgress: false,
  };


  /* =======================================================
     DOM
  ======================================================== */

  const dom = {};


  /* =======================================================
     INITIALIZATION
  ======================================================== */

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      cacheDom();

      initializeNavigation();

      initializeMap();

      initializeButtons();

      updateSummary();

      updateEngineStatus();

      connectEmergencySocket();

      checkBackend();
    },
  );


  /* =======================================================
     DOM CACHE
  ======================================================== */

  function cacheDom() {
    dom.navigationOverlay =
      document.getElementById(
        'navigationOverlay',
      );

    dom.navigationDrawer =
      document.getElementById(
        'navigationDrawer',
      );

    dom.drawerClose =
      document.getElementById(
        'drawerClose',
      );

    dom.menuButton =
      document.getElementById(
        'menuButton',
      );

    dom.connectionStatus =
      document.getElementById(
        'connectionStatus',
      );

    dom.connectionText =
      document.getElementById(
        'connectionText',
      );

    dom.refreshButton =
      document.getElementById(
        'refreshButton',
      );

    dom.totalAlerts =
      document.getElementById(
        'totalAlerts',
      );

    dom.criticalAlerts =
      document.getElementById(
        'criticalAlerts',
      );

    dom.warningAlerts =
      document.getElementById(
        'warningAlerts',
      );

    dom.infoAlerts =
      document.getElementById(
        'infoAlerts',
      );

    dom.engineIndicator =
      document.getElementById(
        'engineIndicator',
      );

    dom.engineDescription =
      document.getElementById(
        'engineDescription',
      );

    dom.engineState =
      document.getElementById(
        'engineState',
      );

    dom.alertCountBadge =
      document.getElementById(
        'alertCountBadge',
      );

    dom.alertError =
      document.getElementById(
        'alertError',
      );

    dom.errorTitle =
      document.getElementById(
        'errorTitle',
      );

    dom.errorText =
      document.getElementById(
        'errorText',
      );

    dom.emptyAlertState =
      document.getElementById(
        'emptyAlertState',
      );

    dom.alertList =
      document.getElementById(
        'alertList',
      );

    dom.backendState =
      document.getElementById(
        'backendState',
      );

    dom.socketState =
      document.getElementById(
        'socketState',
      );

    dom.alertApiState =
      document.getElementById(
        'alertApiState',
      );

    dom.alertDatabaseState =
      document.getElementById(
        'alertDatabaseState',
      );

    /*
      IMPORTANT:
      This is the existing map from alerts.html.

      We DO NOT create another map element.
    */

    dom.alertMapPanel =
      document.getElementById(
        'alertMapPanel',
      );

    dom.alertMap =
      document.getElementById(
        'alertMap',
      );

    dom.alertMapDescription =
      document.getElementById(
        'alertMapDescription',
      );
  }


  /* =======================================================
     NAVIGATION
  ======================================================== */

  function initializeNavigation() {
    if (dom.menuButton) {
      dom.menuButton.addEventListener(
        'click',
        openNavigation,
      );
    }

    if (dom.drawerClose) {
      dom.drawerClose.addEventListener(
        'click',
        closeNavigation,
      );
    }

    if (dom.navigationOverlay) {
      dom.navigationOverlay.addEventListener(
        'click',
        closeNavigation,
      );
    }

    document
      .querySelectorAll(
        '.drawer-navigation a',
      )
      .forEach((link) => {
        link.addEventListener(
          'click',
          closeNavigation,
        );
      });

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          closeNavigation();

          closeAlertModal();
        }
      },
    );
  }


  function openNavigation() {
    if (!dom.navigationDrawer) {
      return;
    }

    dom.navigationDrawer.classList.add(
      'open',
    );

    if (dom.navigationOverlay) {
      dom.navigationOverlay.classList.add(
        'open',
      );
    }

    dom.navigationDrawer.setAttribute(
      'aria-hidden',
      'false',
    );

    if (dom.menuButton) {
      dom.menuButton.setAttribute(
        'aria-expanded',
        'true',
      );
    }
  }


  function closeNavigation() {
    if (!dom.navigationDrawer) {
      return;
    }

    dom.navigationDrawer.classList.remove(
      'open',
    );

    if (dom.navigationOverlay) {
      dom.navigationOverlay.classList.remove(
        'open',
      );
    }

    dom.navigationDrawer.setAttribute(
      'aria-hidden',
      'true',
    );

    if (dom.menuButton) {
      dom.menuButton.setAttribute(
        'aria-expanded',
        'false',
      );
    }
  }


  /* =======================================================
     BUTTONS
  ======================================================== */

  function initializeButtons() {
    if (dom.refreshButton) {
      dom.refreshButton.addEventListener(
        'click',
        refreshPage,
      );
    }
  }


  async function refreshPage() {
    if (state.refreshInProgress) {
      return;
    }

    state.refreshInProgress = true;

    if (dom.refreshButton) {
      dom.refreshButton.disabled = true;

      dom.refreshButton.textContent =
        'Refreshing...';
    }

    try {
      await checkBackend();

      updateSummary();

      updateEngineStatus();

      renderAlerts();

      /*
        If a vehicle is currently selected,
        refresh its map position.
      */
      if (
        state.activeVehicleId
      ) {
        const activeAlert =
          findAlertForVehicle(
            state.activeVehicleId,
          );

        if (activeAlert) {
          showAlertVehicleOnMap(
            activeAlert,
          );
        }
      }
    } finally {
      state.refreshInProgress = false;

      if (dom.refreshButton) {
        dom.refreshButton.disabled = false;

        dom.refreshButton.textContent =
          'Refresh';
      }
    }
  }


  /* =======================================================
     BACKEND STATUS
  ======================================================== */

  async function checkBackend() {
    setConnectionChecking();

    try {
      const response =
        await fetch(
          VEHICLES_ENDPOINT,
          {
            method: 'GET',
            cache: 'no-store',
          },
        );

      if (!response.ok) {
        throw new Error(
          `Backend returned HTTP ${response.status}.`,
        );
      }

      state.backendConnected = true;

      setBackendStatus(
        'Connected',
        'connected',
      );

      setConnectionStatus();

      return true;
    } catch (error) {
      state.backendConnected = false;

      setBackendStatus(
        'Disconnected',
        'error',
      );

      setConnectionStatus();

      showError(
        'Backend connection failed.',
        error instanceof Error
          ? error.message
          : String(error),
      );

      return false;
    }
  }


  function setConnectionChecking() {
    if (!dom.connectionStatus) {
      return;
    }

    dom.connectionStatus.classList.remove(
      'connected',
      'disconnected',
    );

    dom.connectionStatus.classList.add(
      'checking',
    );

    if (dom.connectionText) {
      dom.connectionText.textContent =
        'Connecting...';
    }
  }


  function setConnectionStatus() {
    if (!dom.connectionStatus) {
      return;
    }

    dom.connectionStatus.classList.remove(
      'checking',
      'connected',
      'disconnected',
    );

    if (
      state.backendConnected ||
      state.socketConnected
    ) {
      dom.connectionStatus.classList.add(
        'connected',
      );

      if (dom.connectionText) {
        dom.connectionText.textContent =
          'Connected';
      }
    } else {
      dom.connectionStatus.classList.add(
        'disconnected',
      );

      if (dom.connectionText) {
        dom.connectionText.textContent =
          'Disconnected';
      }
    }
  }


  function setBackendStatus(
    text,
    className,
  ) {
    if (!dom.backendState) {
      return;
    }

    dom.backendState.textContent =
      text;

    dom.backendState.classList.remove(
      'connected',
      'error',
      'not-configured',
    );

    if (className) {
      dom.backendState.classList.add(
        className,
      );
    }
  }


  /* =======================================================
     SOCKET.IO - EMERGENCY CHANNEL
  ======================================================== */

  function connectEmergencySocket() {
    if (
      typeof window.io !==
      'function'
    ) {
      setSocketStatus(
        'Connection error',
        'error',
      );

      return;
    }

    try {
      state.socket =
        window.io(
          EMERGENCY_NAMESPACE,
          {
            transports: [
              'websocket',
              'polling',
            ],

            reconnection: true,

            reconnectionAttempts:
              Infinity,

            reconnectionDelay:
              1000,

            timeout: 5000,
          },
        );

      state.socket.on(
        'connect',
        () => {
          state.socketConnected =
            true;

          setSocketStatus(
            'Connected',
            'connected',
          );

          setConnectionStatus();
        },
      );


      state.socket.on(
        'disconnect',
        () => {
          state.socketConnected =
            false;

          setSocketStatus(
            'Connection error',
            'error',
          );

          setConnectionStatus();
        },
      );


      state.socket.on(
        'connect_error',
        (error) => {
          state.socketConnected =
            false;

          setSocketStatus(
            'Connection error',
            'error',
          );

          setConnectionStatus();

          console.error(
            'SafePath emergency Socket.IO connection error:',
            error,
          );
        },
      );


      state.socket.on(
        'emergency:connection:ready',
        () => {
          state.socketConnected =
            true;

          setSocketStatus(
            'Connected',
            'connected',
          );

          setConnectionStatus();
        },
      );


      state.socket.on(
        'emergency:sos',
        (payload) => {
          handleIncomingEmergency(
            payload,
          );
        },
      );
    } catch (error) {
      state.socketConnected =
        false;

      setSocketStatus(
        'Connection error',
        'error',
      );

      setConnectionStatus();

      console.error(
        'SafePath emergency Socket.IO error:',
        error,
      );
    }
  }


  function setSocketStatus(
    text,
    className,
  ) {
    if (!dom.socketState) {
      return;
    }

    dom.socketState.textContent =
      text;

    dom.socketState.classList.remove(
      'connected',
      'error',
      'not-configured',
    );

    if (className) {
      dom.socketState.classList.add(
        className,
      );
    }
  }


  /* =======================================================
     INCOMING SOS
  ======================================================== */

  function handleIncomingEmergency(
    payload,
  ) {
    const emergency =
      normalizeEmergencyPayload(
        payload,
      );

    if (!emergency) {
      showError(
        'Invalid emergency alert.',
        'The received emergency payload is incomplete.',
      );

      return;
    }

    const alertId =
      createAlertId(
        emergency,
      );

    state.alerts.set(
      alertId,
      {
        id: alertId,

        type: 'WARNING',

        message:
          'An Accident has been reported at',

        emergency,

        receivedAt:
          new Date().toISOString(),
      },
    );

    renderAlerts();

    updateSummary();

    updateEngineStatus();

    /*
      SOS immediately opens the emergency popup.
    */
    openAlertModal(
      state.alerts.get(
        alertId,
      ),
    );
  }


  function normalizeEmergencyPayload(
    payload,
  ) {
    if (
      !payload ||
      typeof payload !==
        'object'
    ) {
      return null;
    }

    const source =
      payload.emergency &&
      typeof payload.emergency ===
        'object'
        ? payload.emergency
        : payload;

    const vehicleId =
      cleanValue(
        source.vehicleId,
      );

    const vehicleType =
      cleanValue(
        source.vehicleType,
      );

    const latitude =
      toNumber(
        source.latitude,
      );

    const longitude =
      toNumber(
        source.longitude,
      );

    const speed =
      toNumber(
        source.speed,
      );

    const heading =
      toNumber(
        source.heading,
      );

    const accuracy =
      source.accuracy === null ||
      source.accuracy === undefined ||
      source.accuracy === ''
        ? null
        : toNumber(
            source.accuracy,
          );

    const lastOnline =
      cleanValue(
        source.lastOnline,
      );

    const currentOnline =
      toBoolean(
        source.currentOnline,
      );

    if (
      !vehicleId ||
      !vehicleType ||
      latitude === null ||
      longitude === null ||
      speed === null ||
      heading === null ||
      !lastOnline
    ) {
      return null;
    }

    return {
      vehicleId,

      vehicleType,

      latitude,

      longitude,

      speed,

      heading,

      accuracy,

      lastOnline,

      currentOnline,

      reportedAt:
        cleanValue(
          source.reportedAt,
        ) ||
        new Date().toISOString(),
    };
  }


  function cleanValue(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    return String(value).trim();
  }


  function toNumber(value) {
    const number =
      Number(value);

    return Number.isFinite(
      number,
    )
      ? number
      : null;
  }


  function toBoolean(value) {
    if (value === true) {
      return true;
    }

    if (value === false) {
      return false;
    }

    return (
      String(value).toLowerCase() ===
      'true'
    );
  }


  function createAlertId(
    emergency,
  ) {
    return [
      emergency.vehicleId,

      emergency.reportedAt,

      emergency.latitude,

      emergency.longitude,
    ].join('::');
  }


  /* =======================================================
     SUMMARY
  ======================================================== */

  function updateSummary() {
    const total =
      state.alerts.size;

    let critical = 0;

    let warning = 0;

    let information = 0;

    state.alerts.forEach(
      (alert) => {
        if (
          alert.type ===
          'CRITICAL'
        ) {
          critical += 1;
        } else if (
          alert.type ===
          'WARNING'
        ) {
          warning += 1;
        } else if (
          alert.type ===
          'INFORMATION'
        ) {
          information += 1;
        }
      },
    );

    if (dom.totalAlerts) {
      dom.totalAlerts.textContent =
        String(total);
    }

    if (dom.criticalAlerts) {
      dom.criticalAlerts.textContent =
        String(critical);
    }

    if (dom.warningAlerts) {
      dom.warningAlerts.textContent =
        String(warning);
    }

    if (dom.infoAlerts) {
      dom.infoAlerts.textContent =
        String(information);
    }

    if (dom.alertCountBadge) {
      dom.alertCountBadge.textContent =
        `${total} ${
          total === 1
            ? 'alert'
            : 'alerts'
        }`;
    }
  }


  /* =======================================================
     ALERT ENGINE
  ======================================================== */

  function updateEngineStatus() {
    const active =
      state.alerts.size > 0;

    if (dom.engineIndicator) {
      dom.engineIndicator.classList.toggle(
        'active',
        active,
      );

      dom.engineIndicator.classList.toggle(
        'inactive',
        !active,
      );
    }

    if (dom.engineState) {
      dom.engineState.textContent =
        active
          ? 'Active'
          : 'Not Active';

      dom.engineState.classList.toggle(
        'active',
        active,
      );

      dom.engineState.classList.toggle(
        'inactive',
        !active,
      );
    }

    if (dom.engineDescription) {
      dom.engineDescription.textContent =
        active
          ? `${state.alerts.size} active warning alert${
              state.alerts.size === 1
                ? ''
                : 's'
            } received.`
          : 'No alert engine is currently active.';
    }
  }


  /* =======================================================
     ALERT LIST
  ======================================================== */

  function renderAlerts() {
    clearError();

    const alerts =
      Array.from(
        state.alerts.values(),
      ).sort(
        (a, b) =>
          new Date(
            b.receivedAt,
          ).getTime() -
          new Date(
            a.receivedAt,
          ).getTime(),
      );

    if (alerts.length === 0) {
      if (dom.emptyAlertState) {
        dom.emptyAlertState.style.display =
          'block';
      }

      if (dom.alertList) {
        dom.alertList.classList.add(
          'hidden',
        );

        dom.alertList.innerHTML =
          '';
      }

      return;
    }

    if (dom.emptyAlertState) {
      dom.emptyAlertState.style.display =
        'none';
    }

    if (dom.alertList) {
      dom.alertList.classList.remove(
        'hidden',
      );

      dom.alertList.innerHTML =
        alerts
          .map(
            renderAlertCard,
          )
          .join('');

      attachAlertCardEvents();
    }
  }


  function renderAlertCard(
    alert,
  ) {
    const data =
      alert.emergency;

    return `
      <article
        class="alert-card"
        data-alert-id="${escapeAttribute(
          alert.id,
        )}"
      >

        <div class="alert-card-header">

          <div class="alert-card-title">

            <span class="alert-type-badge">
              WARNING
            </span>

            <strong>
              Emergency
            </strong>

          </div>

          <span class="alert-time">
            ${escapeHtml(
              formatDateTime(
                alert.receivedAt,
              ),
            )}
          </span>

        </div>


        <div class="alert-card-body">

          <p class="alert-message">
            An Accident has been reported at
          </p>


          <div class="alert-data-grid">

            ${renderDataItem(
              'Vehicle ID',
              data.vehicleId,
            )}

            ${renderDataItem(
              'Vehicle Type',
              data.vehicleType,
            )}

            ${renderDataItem(
              'Latitude',
              formatCoordinate(
                data.latitude,
              ),
            )}

            ${renderDataItem(
              'Longitude',
              formatCoordinate(
                data.longitude,
              ),
            )}

            ${renderDataItem(
              'Speed',
              `${formatNumber(
                data.speed,
              )} km/h`,
            )}

            ${renderDataItem(
              'Heading',
              `${formatNumber(
                data.heading,
              )}°`,
            )}

            ${renderDataItem(
              'Accuracy',
              data.accuracy === null
                ? '—'
                : `${formatNumber(
                    data.accuracy,
                  )} m`,
            )}

            ${renderDataItem(
              'Last Online',
              formatDateTime(
                data.lastOnline,
              ),
            )}

            ${renderDataItem(
              'Current Online',
              data.currentOnline
                ? 'true'
                : 'false',
            )}

          </div>

        </div>


        <div class="alert-card-actions">

          <button
            type="button"
            class="active-alert-button"
            data-action="active-alert"
            data-alert-id="${escapeAttribute(
              alert.id,
            )}"
          >
            Active Alert
          </button>


          <button
            type="button"
            class="dismiss-alert-button"
            data-action="dismiss-alert"
            data-alert-id="${escapeAttribute(
              alert.id,
            )}"
          >
            Close Alert
          </button>

        </div>

      </article>
    `;
  }


  function renderDataItem(
    label,
    value,
  ) {
    return `
      <div class="alert-data-item">

        <span class="alert-data-label">
          ${escapeHtml(label)}
        </span>

        <span class="alert-data-value">
          ${escapeHtml(
            String(value),
          )}
        </span>

      </div>
    `;
  }


  function attachAlertCardEvents() {
    document
      .querySelectorAll(
        '[data-action="active-alert"]',
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              const alertId =
                button.dataset
                  .alertId;

              const alert =
                state.alerts.get(
                  alertId,
                );

              if (alert) {
                showAlertVehicleOnMap(
                  alert,
                );
              }
            },
          );
        },
      );


    document
      .querySelectorAll(
        '[data-action="dismiss-alert"]',
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              const alertId =
                button.dataset
                  .alertId;

              dismissAlert(
                alertId,
              );
            },
          );
        },
      );
  }


  function dismissAlert(
    alertId,
  ) {
    if (!alertId) {
      return;
    }

    const alert =
      state.alerts.get(
        alertId,
      );

    state.alerts.delete(
      alertId,
    );

    if (
      alert &&
      state.activeVehicleId ===
        alert.emergency.vehicleId
    ) {
      const stillExists =
        hasAlertForVehicle(
          state.activeVehicleId,
        );

      if (!stillExists) {
        state.activeVehicleId =
          null;

        removeVehicleMarker();

        hideAlertMap();
      }
    }

    renderAlerts();

    updateSummary();

    updateEngineStatus();
  }


  function hasAlertForVehicle(
    vehicleId,
  ) {
    for (
      const alert of
        state.alerts.values()
    ) {
      if (
        alert.emergency
          .vehicleId ===
        vehicleId
      ) {
        return true;
      }
    }

    return false;
  }


  function findAlertForVehicle(
    vehicleId,
  ) {
    for (
      const alert of
        state.alerts.values()
    ) {
      if (
        alert.emergency
          .vehicleId ===
        vehicleId
      ) {
        return alert;
      }
    }

    return null;
  }


  /* =======================================================
     MODAL
  ======================================================== */

  function openAlertModal(
    alert,
  ) {
    if (!alert) {
      return;
    }

    const existing =
      document.getElementById(
        'alertModalOverlay',
      );

    if (existing) {
      existing.remove();
    }

    const data =
      alert.emergency;

    const overlay =
      document.createElement(
        'div',
      );

    overlay.id =
      'alertModalOverlay';

    overlay.className =
      'alert-modal-overlay open';

    overlay.innerHTML = `
      <div
        class="alert-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alertModalTitle"
      >

        <div class="alert-modal-header">

          <div class="alert-modal-heading">

            <div class="alert-modal-icon">
              !
            </div>

            <div>

              <h2 id="alertModalTitle">
                WARNING
              </h2>

              <p>
                Emergency
                <br />
                An Accident has been reported at
              </p>

            </div>

          </div>


          <button
            type="button"
            class="alert-modal-close"
            id="alertModalClose"
            aria-label="Close warning"
          >
            ×
          </button>

        </div>


        <div class="alert-modal-body">

          <p class="modal-message">
            Emergency alert received from SafePath.
          </p>


          <div class="modal-data-grid">

            ${renderModalDataItem(
              'Vehicle ID',
              data.vehicleId,
            )}

            ${renderModalDataItem(
              'Vehicle Type',
              data.vehicleType,
            )}

            ${renderModalDataItem(
              'Latitude',
              formatCoordinate(
                data.latitude,
              ),
            )}

            ${renderModalDataItem(
              'Longitude',
              formatCoordinate(
                data.longitude,
              ),
            )}

            ${renderModalDataItem(
              'Speed',
              `${formatNumber(
                data.speed,
              )} km/h`,
            )}

            ${renderModalDataItem(
              'Heading',
              `${formatNumber(
                data.heading,
              )}°`,
            )}

            ${renderModalDataItem(
              'Accuracy',
              data.accuracy === null
                ? '—'
                : `${formatNumber(
                    data.accuracy,
                  )} m`,
            )}

            ${renderModalDataItem(
              'Last Online',
              formatDateTime(
                data.lastOnline,
              ),
            )}

            ${renderModalDataItem(
              'Current Online',
              data.currentOnline
                ? 'true'
                : 'false',
            )}

          </div>

        </div>


        <div class="modal-actions">

          <button
            type="button"
            class="modal-map-button"
            id="modalMapButton"
          >
            Active Alert
          </button>


          <button
            type="button"
            class="modal-close-button"
            id="modalCloseButton"
          >
            Close
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(
      overlay,
    );


    const closeButton =
      document.getElementById(
        'alertModalClose',
      );

    const modalCloseButton =
      document.getElementById(
        'modalCloseButton',
      );

    const modalMapButton =
      document.getElementById(
        'modalMapButton',
      );


    if (closeButton) {
      closeButton.addEventListener(
        'click',
        closeAlertModal,
      );
    }


    if (modalCloseButton) {
      modalCloseButton.addEventListener(
        'click',
        closeAlertModal,
      );
    }


    if (modalMapButton) {
      modalMapButton.addEventListener(
        'click',
        () => {
          closeAlertModal();

          showAlertVehicleOnMap(
            alert,
          );
        },
      );
    }


    overlay.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          overlay
        ) {
          closeAlertModal();
        }
      },
    );
  }


  function renderModalDataItem(
    label,
    value,
  ) {
    return `
      <div class="modal-data-item">

        <span class="label">
          ${escapeHtml(label)}
        </span>

        <span class="value">
          ${escapeHtml(
            String(value),
          )}
        </span>

      </div>
    `;
  }


  function closeAlertModal() {
    const modal =
      document.getElementById(
        'alertModalOverlay',
      );

    if (modal) {
      modal.remove();
    }
  }


  /* =======================================================
     LIVE MAP

     IMPORTANT:
     The HTML already contains:

       #alertMapPanel
       #alertMap
       #alertMapDescription

     This function ONLY initializes that existing map.

     It NEVER creates another panel.
  ======================================================== */

  function initializeMap() {
    if (
      typeof window.L ===
      'undefined'
    ) {
      console.error(
        'Leaflet is not loaded.',
      );

      return;
    }

    /*
      Use the existing map element
      from alerts.html.
    */

    if (!dom.alertMap) {
      console.error(
        'SafePath Alerts: #alertMap was not found in alerts.html.',
      );

      return;
    }

    /*
      Make sure the map starts hidden.
      alerts.html already uses map-hidden.
    */

    dom.alertMap.classList.add(
      'map-hidden',
    );


    /*
      Initialize Leaflet directly
      on the existing #alertMap.
    */

    state.map =
      window.L.map(
        dom.alertMap,
        {
          zoomControl: true,

          attributionControl: true,
        },
      ).setView(
        DEFAULT_MAP_CENTER,
        DEFAULT_MAP_ZOOM,
      );


    /*
      OpenStreetMap tiles.
    */

    window.L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors',

        maxZoom: 19,
      },
    ).addTo(
      state.map,
    );


    /*
      Keep the map hidden until
      Active Alert is clicked.
    */

    hideAlertMap();
  }


  /* =======================================================
     SHOW SELECTED ALERT ON THE SINGLE MAP
  ======================================================== */

  async function showAlertVehicleOnMap(
    alert,
  ) {
    if (
      !alert ||
      !alert.emergency
    ) {
      return;
    }

    if (!state.map) {
      console.error(
        'SafePath Alerts: map is not initialized.',
      );

      return;
    }

    const data =
      alert.emergency;

    state.activeVehicleId =
      data.vehicleId;


    /*
      Show the EXISTING map panel.
    */

    showAlertMap();


    /*
      Update description.
    */

    if (
      dom.alertMapDescription
    ) {
      dom.alertMapDescription.textContent =
        `Live location for ${data.vehicleId}`;
    }


    /*
      Update the vehicle marker.
    */

    updateVehicleMarker(
      data,
    );


    /*
      Scroll to the single
      existing Live Location panel.
    */

    if (
      dom.alertMapPanel
    ) {
      dom.alertMapPanel.scrollIntoView(
        {
          behavior: 'smooth',

          block: 'start',
        },
      );
    }


    /*
      The map was previously hidden,
      so Leaflet needs its size
      recalculated after it becomes visible.
    */

    window.setTimeout(
      () => {
        if (!state.map) {
          return;
        }

        state.map.invalidateSize(
          true,
        );

        state.map.setView(
          [
            data.latitude,
            data.longitude,
          ],
          17,
        );
      },
      180,
    );
  }


  function showAlertMap() {
    if (!dom.alertMap) {
      return;
    }

    dom.alertMap.classList.remove(
      'map-hidden',
    );

    if (
      dom.alertMapPanel
    ) {
      dom.alertMapPanel.style.display =
        '';
    }
  }


  function hideAlertMap() {
    if (!dom.alertMap) {
      return;
    }

    dom.alertMap.classList.add(
      'map-hidden',
    );
  }


  /* =======================================================
     VEHICLE MARKER
  ======================================================== */

  function updateVehicleMarker(
    data,
  ) {
    if (!state.map) {
      return;
    }

    const latitude =
      Number(data.latitude);

    const longitude =
      Number(data.longitude);

    if (
      !Number.isFinite(
        latitude,
      ) ||
      !Number.isFinite(
        longitude,
      )
    ) {
      return;
    }

    const position = [
      latitude,
      longitude,
    ];


    /*
      Create the marker only once.
    */

    if (
      !state.vehicleMarker
    ) {
      state.vehicleMarker =
        window.L.marker(
          position,
          {
            icon:
              window.L.divIcon(
                {
                  className: '',

                  html:
                    '<div class="alert-vehicle-marker"></div>',

                  iconSize: [
                    16,
                    16,
                  ],

                  iconAnchor: [
                    8,
                    8,
                  ],
                },
              ),
          },
        ).addTo(
          state.map,
        );
    } else {
      state.vehicleMarker.setLatLng(
        position,
      );
    }


    /*
      Popup contains selected
      vehicle telemetry.
    */

    state.vehicleMarker
      .bindPopup(
        `
          <strong>
            ${escapeHtml(
              data.vehicleId,
            )}
          </strong>

          <br />

          ${escapeHtml(
            data.vehicleType,
          )}

          <br />

          Speed:
          ${escapeHtml(
            formatNumber(
              data.speed,
            ),
          )}
          km/h

          <br />

          Heading:
          ${escapeHtml(
            formatNumber(
              data.heading,
            ),
          )}°

          <br />

          Accuracy:
          ${
            data.accuracy ===
            null
              ? '—'
              : `${escapeHtml(
                  formatNumber(
                    data.accuracy,
                  ),
                )} m`
          }

          <br />

          Latitude:
          ${escapeHtml(
            formatCoordinate(
              data.latitude,
            ),
          )}

          <br />

          Longitude:
          ${escapeHtml(
            formatCoordinate(
              data.longitude,
            ),
          )}
        `,
      )
      .openPopup();


    /*
      Center immediately.
    */

    state.map.setView(
      position,
      17,
    );
  }


  function removeVehicleMarker() {
    if (
      state.vehicleMarker &&
      state.map
    ) {
      state.map.removeLayer(
        state.vehicleMarker,
      );
    }

    state.vehicleMarker =
      null;
  }


  /* =======================================================
     OPTIONAL LIVE VEHICLE REFRESH

     If the selected vehicle remains
     online, fetch its latest telemetry
     and update the single map marker.
  ======================================================== */

  async function refreshActiveVehicleLocation() {
    if (
      !state.activeVehicleId
    ) {
      return;
    }

    const alert =
      findAlertForVehicle(
        state.activeVehicleId,
      );

    if (!alert) {
      return;
    }

    try {
      const response =
        await fetch(
          `${BACKEND_URL}/api/vehicles/${encodeURIComponent(
            state.activeVehicleId,
          )}/live`,
          {
            method: 'GET',
            cache: 'no-store',
          },
        );

      if (!response.ok) {
        return;
      }

      const vehicle =
        await response.json();

      if (
        !vehicle ||
        vehicle.latitude ===
          undefined ||
        vehicle.longitude ===
          undefined
      ) {
        return;
      }

      const updatedData = {
        ...alert.emergency,

        vehicleId:
          vehicle.vehicleId ??
          alert.emergency.vehicleId,

        vehicleType:
          vehicle.vehicleType ??
          alert.emergency.vehicleType,

        latitude:
          Number(
            vehicle.latitude,
          ),

        longitude:
          Number(
            vehicle.longitude,
          ),

        speed:
          Number(
            vehicle.speed ??
              alert.emergency.speed,
          ),

        heading:
          Number(
            vehicle.heading ??
              alert.emergency.heading,
          ),

        accuracy:
          vehicle.accuracy ===
            null ||
          vehicle.accuracy ===
            undefined
            ? alert.emergency
                .accuracy
            : Number(
                vehicle.accuracy,
              ),

        lastOnline:
          vehicle.lastOnline ??
          alert.emergency.lastOnline,

        currentOnline:
          Boolean(
            vehicle.currentOnline,
          ),
      };


      /*
        Update the stored alert.
      */

      alert.emergency =
        updatedData;


      /*
        If this is the active vehicle,
        move the marker.
      */

      if (
        state.activeVehicleId ===
        updatedData.vehicleId
      ) {
        updateVehicleMarker(
          updatedData,
        );
      }
    } catch (error) {
      console.debug(
        'Unable to refresh active emergency vehicle:',
        error,
      );
    }
  }


  /* =======================================================
     TELEMETRY FRESHNESS
  ======================================================== */

  function isFreshTelemetry(
    lastOnline,
  ) {
    const timestamp =
      new Date(
        lastOnline,
      ).getTime();

    if (
      !Number.isFinite(
        timestamp,
      )
    ) {
      return false;
    }

    return (
      Date.now() -
        timestamp <=
      ONLINE_TIMEOUT_MS
    );
  }


  /* =======================================================
     FORMATTERS
  ======================================================== */

  function formatNumber(
    value,
  ) {
    const number =
      Number(value);

    if (
      !Number.isFinite(
        number,
      )
    ) {
      return '—';
    }

    return number.toFixed(
      2,
    );
  }


  function formatCoordinate(
    value,
  ) {
    const number =
      Number(value);

    if (
      !Number.isFinite(
        number,
      )
    ) {
      return '—';
    }

    return number.toFixed(
      6,
    );
  }


  function formatDateTime(
    value,
  ) {
    if (!value) {
      return '—';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return String(value);
    }

    return date.toLocaleString();
  }


  /* =======================================================
     HTML SAFETY
  ======================================================== */

  function escapeHtml(
    value,
  ) {
    return String(value)
      .replaceAll(
        '&',
        '&amp;',
      )
      .replaceAll(
        '<',
        '&lt;',
      )
      .replaceAll(
        '>',
        '&gt;',
      )
      .replaceAll(
        '"',
        '&quot;',
      )
      .replaceAll(
        "'",
        '&#039;',
      );
  }


  function escapeAttribute(
    value,
  ) {
    return escapeHtml(
      value,
    );
  }


  /* =======================================================
     ERROR HANDLING
  ======================================================== */

  function showError(
    title,
    message,
  ) {
    if (!dom.alertError) {
      return;
    }

    dom.alertError.classList.remove(
      'hidden',
    );

    if (dom.errorTitle) {
      dom.errorTitle.textContent =
        title ||
        'Error';
    }

    if (dom.errorText) {
      dom.errorText.textContent =
        message ||
        '';
    }
  }


  function clearError() {
    if (!dom.alertError) {
      return;
    }

    dom.alertError.classList.add(
      'hidden',
    );

    if (dom.errorTitle) {
      dom.errorTitle.textContent =
        'Unable to load alerts.';
    }

    if (dom.errorText) {
      dom.errorText.textContent =
        '';
    }
  }


  /* =======================================================
     PUBLIC API
  ======================================================== */

  window.SafePathAlerts = {
    refresh:
      refreshPage,

    getAlerts() {
      return Array.from(
        state.alerts.values(),
      );
    },

    openAlertModal,

    closeAlertModal,

    showAlertVehicleOnMap,

    getState() {
      return {
        backendConnected:
          state.backendConnected,

        socketConnected:
          state.socketConnected,

        alertCount:
          state.alerts.size,

        activeVehicleId:
          state.activeVehicleId,
      };
    },
  };


  /* =======================================================
     PERIODIC ACTIVE VEHICLE UPDATE
  ======================================================== */

  const activeVehicleRefreshTimer =
    window.setInterval(
      () => {
        refreshActiveVehicleLocation();
      },
      5000,
    );


  /* =======================================================
     CLEANUP
  ======================================================== */

  window.addEventListener(
    'beforeunload',
    () => {
      window.clearInterval(
        activeVehicleRefreshTimer,
      );

      if (state.socket) {
        state.socket.disconnect();
      }

      removeVehicleMarker();

      if (state.map) {
        state.map.remove();

        state.map = null;
      }
    },
  );

})();