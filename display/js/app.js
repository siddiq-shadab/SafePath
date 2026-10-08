

/* =============================================================
   SAFE PATH
   MAIN DISPLAY APPLICATION
============================================================= */


/* =============================================================
   CONFIGURATION
============================================================ */

const SAFEPATH_CONFIG = {

    backendUrl:
        'http://localhost:3000',

    defaultLatitude:
        18.445167,

    defaultLongitude:
        79.131954,

    defaultZoom:
        17

};


/* =============================================================
   GLOBAL APPLICATION STATE
============================================================= */

const SafePathApp = {

    map: null,

    vehicle: null,

    websocket: null,

    initialized: false

};


/* =============================================================
   INITIALIZE MAP
============================================================= */

function initializeMap() {

    console.log(
        '[SafePath] Initializing Leaflet map.'
    );


    SafePathApp.map =
        L.map(
            'map',
            {
                zoomControl: true,

                preferCanvas: true
            }
        );


    /* ---------------------------------------------------------
       CARTO LIGHT BASEMAP
    ---------------------------------------------------------- */

    L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
            attribution:
                '&copy; OpenStreetMap contributors &copy; CARTO',

            subdomains:
                'abcd',

            maxZoom:
                20
        }
    ).addTo(
        SafePathApp.map
    );


    /* ---------------------------------------------------------
       INITIAL MAP LOCATION

       This is only the initial map viewport.
       It is NOT vehicle telemetry.
    ---------------------------------------------------------- */

    SafePathApp.map.setView(
        [
            SAFEPATH_CONFIG.defaultLatitude,
            SAFEPATH_CONFIG.defaultLongitude
        ],
        SAFEPATH_CONFIG.defaultZoom
    );


    console.log(
        '[SafePath] CARTO map initialized.'
    );

}


/* =============================================================
   INITIALIZE VEHICLE
============================================================= */

function initializeVehicle() {

    SafePathApp.vehicle =
        new SafePathVehicle(
            SafePathApp.map
        );


    console.log(
        '[SafePath] Vehicle controller initialized.'
    );

}


/* =============================================================
   INITIALIZE SOCKET.IO
============================================================= */

function initializeWebSocket() {

    SafePathApp.websocket =
        new SafePathWebSocket(
            {
                backendUrl:
                    SAFEPATH_CONFIG.backendUrl
            }
        );


    /* ---------------------------------------------------------
       TELEMETRY
    ---------------------------------------------------------- */

    SafePathApp.websocket.onTelemetry(
        (payload) => {

            console.log(
                '[SafePath] Processing live telemetry:',
                payload
            );


            if (
                SafePathApp.vehicle
            ) {

                SafePathApp.vehicle
                    .updateTelemetry(
                        payload
                    );

            }


            updateLastUpdateTime();

        }
    );


    /* ---------------------------------------------------------
       CONNECTION
    ---------------------------------------------------------- */

    SafePathApp.websocket.onConnection(
        (connected) => {

            console.log(
                '[SafePath] Socket.IO status:',
                connected
            );

        }
    );


    /* ---------------------------------------------------------
       ERROR
    ---------------------------------------------------------- */

    SafePathApp.websocket.onError(
        (error) => {

            console.error(
                '[SafePath] Socket.IO error:',
                error
            );

        }
    );


    /* ---------------------------------------------------------
       CONNECT

       Socket.IO connects to:

       http://localhost:3000/vehicles
    ---------------------------------------------------------- */

    SafePathApp.websocket.connect();

}


/* =============================================================
   SUBSCRIBE BUTTON
============================================================= */

function initializeControls() {

    const button =
        document.getElementById(
            'subscribeButton'
        );


    const input =
        document.getElementById(
            'vehicleIdInput'
        );


    if (!button || !input) {
        return;
    }


    button.addEventListener(
        'click',
        () => {

            const vehicleId =
                input.value.trim();


            if (
                vehicleId.length === 0
            ) {

                input.focus();

                return;

            }


            if (
                !SafePathApp.websocket
            ) {

                return;

            }


            const currentlyConnected =
                SafePathApp.websocket.connected;


            if (!currentlyConnected) {

                SafePathApp.websocket
                    .setVehicleId(
                        vehicleId
                    );

                SafePathApp.websocket
                    .connect();

                return;

            }


            SafePathApp.websocket
                .changeVehicle(
                    vehicleId
                );


            if (
                SafePathApp.vehicle
            ) {

                SafePathApp.vehicle.clear();

                SafePathApp.vehicle
                    .setVehicleId(
                        vehicleId
                    );

            }

        }
    );


    input.addEventListener(
        'keydown',
        (event) => {

            if (
                event.key === 'Enter'
            ) {

                button.click();

            }

        }
    );

}


/* =============================================================
   UPDATE LAST UPDATE
============================================================= */

function updateLastUpdateTime() {

    const element =
        document.getElementById(
            'updateValue'
        );


    if (!element) {
        return;
    }


    element.textContent =
        new Date()
            .toLocaleTimeString(
                [],
                {
                    hour:
                        '2-digit',

                    minute:
                        '2-digit',

                    second:
                        '2-digit'
                }
            );

}


/* =============================================================
   APPLICATION START
============================================================= */

function initializeSafePath() {

    if (
        SafePathApp.initialized
    ) {

        return;

    }


    console.log(
        '========================================'
    );

    console.log(
        'SafePath Live Vehicle Display'
    );

    console.log(
        '========================================'
    );


    initializeMap();

    initializeVehicle();

    initializeControls();

    initializeWebSocket();


    SafePathApp.initialized =
        true;


    console.log(
        '[SafePath] Application initialized.'
    );

}


/* =============================================================
   DOM READY
============================================================= */

if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        initializeSafePath
    );

}

else {

    initializeSafePath();

}