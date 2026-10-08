/* =============================================================
   SAFE PATH
   LIVE MAP
   Leaflet + OpenStreetMap + REST + Socket.IO
   ============================================================= */

(function () {

    'use strict';


    /* =========================================================
       CONFIGURATION
    ========================================================== */

    const BACKEND_URL =
        'http://localhost:3000';


    const VEHICLES_API =
        `${BACKEND_URL}/api/vehicles`;


    const DEFAULT_CENTER = [
        18.445167,
        79.131954
    ];


    const DEFAULT_ZOOM = 14;


    /* =========================================================
       STATE
    ========================================================== */

    let map = null;


    let socketClient = null;


    /*
     * vehicleId -> Leaflet marker
     */
    const vehicleMarkers =
        new Map();


    /*
     * vehicleId -> latest ONLINE vehicle telemetry
     *
     * IMPORTANT:
     * Only currentOnline === true vehicles are stored here.
     */
    const vehicles =
        new Map();


    /*
     * Prevent automatic map recentering every time
     * telemetry arrives.
     */
    let mapHasFittedFleet =
        false;


    /* =========================================================
       INITIALIZE
    ========================================================== */

    document.addEventListener(
        'DOMContentLoaded',
        initializeLiveMap
    );


    async function initializeLiveMap() {

        console.log(
            '[SafePath LiveMap] Initializing...'
        );


        initializeNavigation();


        initializeMap();


        initializeRefreshButton();


        clearFleet();


        updateFleetCount();


        /*
         * First load the ONLINE fleet from REST.
         */
        await loadFleetFromApi();


        /*
         * Then establish Socket.IO for live updates.
         */
        initializeSocket();


        console.log(
            '[SafePath LiveMap] Initialization complete.'
        );

    }


    /* =========================================================
       NAVIGATION DRAWER
    ========================================================== */

    function initializeNavigation() {

        const menuButton =
            document.getElementById(
                'menuButton'
            );


        const drawer =
            document.getElementById(
                'navigationDrawer'
            );


        const overlay =
            document.getElementById(
                'navigationOverlay'
            );


        const closeButton =
            document.getElementById(
                'drawerClose'
            );


        if (
            !menuButton ||
            !drawer ||
            !overlay ||
            !closeButton
        ) {

            console.error(
                '[SafePath LiveMap] Navigation elements not found.'
            );

            return;

        }


        menuButton.addEventListener(
            'click',
            function () {

                openNavigation();

            }
        );


        closeButton.addEventListener(
            'click',
            function () {

                closeNavigation();

            }
        );


        overlay.addEventListener(
            'click',
            function () {

                closeNavigation();

            }
        );


        document.addEventListener(
            'keydown',
            function (event) {

                if (
                    event.key === 'Escape'
                ) {

                    closeNavigation();

                }

            }
        );


        /*
         * Close the drawer after selecting
         * a navigation item.
         */
        drawer
            .querySelectorAll(
                '.drawer-navigation a'
            )
            .forEach(
                function (link) {

                    link.addEventListener(
                        'click',
                        function () {

                            closeNavigation();

                        }
                    );

                }
            );

    }


    function openNavigation() {

        const menuButton =
            document.getElementById(
                'menuButton'
            );


        const drawer =
            document.getElementById(
                'navigationDrawer'
            );


        const overlay =
            document.getElementById(
                'navigationOverlay'
            );


        if (!drawer || !overlay) {

            return;

        }


        drawer.classList.add(
            'open'
        );


        overlay.classList.add(
            'open'
        );


        drawer.setAttribute(
            'aria-hidden',
            'false'
        );


        if (menuButton) {

            menuButton.setAttribute(
                'aria-expanded',
                'true'
            );

        }

    }


    function closeNavigation() {

        const menuButton =
            document.getElementById(
                'menuButton'
            );


        const drawer =
            document.getElementById(
                'navigationDrawer'
            );


        const overlay =
            document.getElementById(
                'navigationOverlay'
            );


        if (!drawer || !overlay) {

            return;

        }


        drawer.classList.remove(
            'open'
        );


        overlay.classList.remove(
            'open'
        );


        drawer.setAttribute(
            'aria-hidden',
            'true'
        );


        if (menuButton) {

            menuButton.setAttribute(
                'aria-expanded',
                'false'
            );

        }

    }


    /* =========================================================
       MAP
    ========================================================== */

    function initializeMap() {

        const mapElement =
            document.getElementById(
                'liveMap'
            );


        if (!mapElement) {

            console.error(
                '[SafePath LiveMap] #liveMap element not found.'
            );

            return;

        }


        if (
            typeof window.L ===
            'undefined'
        ) {

            console.error(
                '[SafePath LiveMap] Leaflet is not available.'
            );

            return;

        }


        map =
            L.map(
                'liveMap',
                {

                    center:
                        DEFAULT_CENTER,

                    zoom:
                        DEFAULT_ZOOM,

                    zoomControl:
                        true,

                    attributionControl:
                        true

                }
            );


        /*
         * SafePath uses OpenStreetMap directly.
         *
         * No Google Maps.
         * No CARTO.
         * No API key.
         * No OSRM.
         */

        L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {

                attribution:
                    '&copy; OpenStreetMap contributors',

                maxZoom:
                    19

            }
        ).addTo(
            map
        );


        console.log(
            '[SafePath LiveMap] OpenStreetMap initialized.'
        );

    }


    /* =========================================================
       LOAD ONLINE FLEET FROM REST API
    ========================================================== */

    async function loadFleetFromApi() {

        /*
         * Always clear existing display state first.
         *
         * This prevents stale vehicles from remaining
         * when the backend is unavailable or when a vehicle
         * becomes offline.
         */
        clearFleet();


        try {

            console.log(
                '[SafePath LiveMap] Loading fleet from:',
                VEHICLES_API
            );


            const response =
                await fetch(
                    VEHICLES_API,
                    {

                        method:
                            'GET',

                        headers: {

                            Accept:
                                'application/json'

                        },

                        cache:
                            'no-store'

                    }
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status} ${response.statusText}`
                );

            }


            const fleet =
                await response.json();


            if (
                !Array.isArray(fleet)
            ) {

                throw new Error(
                    'Backend returned an invalid fleet response.'
                );

            }


            console.log(
                '[SafePath LiveMap] REST fleet received:',
                fleet
            );


            /*
             * IMPORTANT:
             *
             * The backend returns all vehicles stored
             * in PostgreSQL.
             *
             * We display ONLY:
             *
             * currentOnline === true
             */
            fleet.forEach(
                function (vehicle) {

                    processVehicleTelemetry(
                        vehicle,
                        false
                    );

                }
            );


            updateFleetCount();


            fitMapToFleetOnce();


            console.log(
                `[SafePath LiveMap] ${vehicles.size} ONLINE vehicle(s) loaded from REST.`
            );


        } catch (error) {

            console.error(
                '[SafePath LiveMap] Failed to load fleet:',
                error
            );


            /*
             * Backend unavailable:
             *
             * Make absolutely sure no stale vehicles
             * remain visible.
             */
            clearFleet();


            updateFleetCount();


            setConnectionIndicator(
                false
            );

        }

    }


    /* =========================================================
       SOCKET.IO
    ========================================================== */

    function initializeSocket() {

        if (
            typeof window.SafePathWebSocket !==
            'function'
        ) {

            console.error(
                '[SafePath LiveMap] SafePathWebSocket is not available.'
            );

            setConnectionIndicator(
                false
            );

            return;

        }


        socketClient =
            new window.SafePathWebSocket(
                {

                    backendUrl:
                        BACKEND_URL

                }
            );


        /* -----------------------------------------------------
           FLEET SNAPSHOT
        ------------------------------------------------------ */

        socketClient.onFleetSnapshot(
            function (
                fleet,
                data
            ) {

                console.log(
                    '[SafePath LiveMap] Fleet snapshot received:',
                    data
                );


                if (
                    !Array.isArray(fleet)
                ) {

                    return;

                }


                /*
                 * Snapshot represents the current fleet.
                 *
                 * Clear first so vehicles that are no longer
                 * online cannot remain on the map.
                 */
                clearFleet();


                fleet.forEach(
                    function (vehicle) {

                        processVehicleTelemetry(
                            vehicle,
                            false
                        );

                    }
                );


                updateFleetCount();


                fitMapToFleetOnce();

            }
        );


        /* -----------------------------------------------------
           FLEET LIVE TELEMETRY
        ------------------------------------------------------ */

        socketClient.onFleetTelemetry(
            function (
                payload
            ) {

                console.log(
                    '[SafePath LiveMap] Fleet telemetry:',
                    payload
                );


                processVehicleTelemetry(
                    payload,
                    true
                );


                updateFleetCount();

            }
        );


        /* -----------------------------------------------------
           CONNECTION
        ------------------------------------------------------ */

        socketClient.onConnection(
            function (
                connected
            ) {

                console.log(
                    '[SafePath LiveMap] Socket connection:',
                    connected
                );


                setConnectionIndicator(
                    Boolean(
                        connected
                    )
                );


                if (
                    !connected
                ) {

                    /*
                     * Socket disconnected:
                     *
                     * Do not keep stale markers visible.
                     */
                    clearFleet();


                    updateFleetCount();

                }

            }
        );


        /* -----------------------------------------------------
           ERROR
        ------------------------------------------------------ */

        socketClient.onError(
            function (
                error
            ) {

                console.error(
                    '[SafePath LiveMap] Socket error:',
                    error
                );

            }
        );


        socketClient.connect();

    }


    /* =========================================================
       PROCESS VEHICLE TELEMETRY
    ========================================================== */

    function processVehicleTelemetry(
        payload,
        liveUpdate = true
    ) {

        if (!payload) {

            return;

        }


        /*
         * Some Socket.IO implementations can wrap
         * the vehicle inside payload.vehicle.
         */
        const incomingVehicle =
            payload.vehicle ??
            payload;


        if (
            !incomingVehicle
        ) {

            return;

        }


        const vehicleId =
            normalizeVehicleId(
                incomingVehicle.vehicleId
            );


        if (!vehicleId) {

            console.warn(
                '[SafePath LiveMap] Ignoring telemetry without vehicleId:',
                incomingVehicle
            );

            return;

        }


        /*
         * =====================================================
         * CRITICAL ONLINE CHECK
         * =====================================================
         *
         * Only currentOnline === true vehicles are displayed.
         *
         * Example:
         *
         * TS02ER8769  -> true  -> SHOW
         * TS02EZ1234  -> true  -> SHOW
         * VEHICLE_001 -> false -> REMOVE / HIDE
         */
        const currentOnline =
            incomingVehicle.currentOnline === true;


        if (
            !currentOnline
        ) {

            removeVehicle(
                vehicleId
            );

            updateFleetCount();

            return;

        }


        const latitude =
            Number(
                incomingVehicle.latitude
            );


        const longitude =
            Number(
                incomingVehicle.longitude
            );


        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            console.warn(
                '[SafePath LiveMap] Invalid coordinates:',
                incomingVehicle
            );

            return;

        }


        const vehicle = {

            vehicleId:
                vehicleId,

            vehicleType:
                normalizeVehicleType(
                    incomingVehicle.vehicleType
                ),

            latitude:
                latitude,

            longitude:
                longitude,

            speed:
                toFiniteNumber(
                    incomingVehicle.speed,
                    0
                ),

            heading:
                toFiniteNumber(
                    incomingVehicle.heading,
                    0
                ),

            accuracy:
                incomingVehicle.accuracy === null ||
                incomingVehicle.accuracy === undefined

                    ? null

                    : toFiniteNumber(
                        incomingVehicle.accuracy,
                        null
                    ),

            lastOnline:
                incomingVehicle.lastOnline ??
                null,

            currentOnline:
                true

        };


        /*
         * Store only ONLINE vehicles.
         */
        vehicles.set(
            vehicleId,
            vehicle
        );


        updateVehicleMarker(
            vehicle,
            liveUpdate
        );

    }


    /* =========================================================
       UPDATE VEHICLE MARKER
    ========================================================== */

    function updateVehicleMarker(
        vehicle,
        liveUpdate
    ) {

        if (!map) {

            return;

        }


        /*
         * Safety check:
         *
         * This function should never display an offline
         * vehicle.
         */
        if (
            vehicle.currentOnline !== true
        ) {

            removeVehicle(
                vehicle.vehicleId
            );

            return;

        }


        const vehicleId =
            vehicle.vehicleId;


        const position = [

            vehicle.latitude,

            vehicle.longitude

        ];


        const existingMarker =
            vehicleMarkers.get(
                vehicleId
            );


        /*
         * Existing vehicle:
         * move its current marker.
         */

        if (existingMarker) {

            existingMarker.setLatLng(
                position
            );


            existingMarker.setIcon(
                createVehicleIcon(
                    vehicle
                )
            );


            existingMarker.setPopupContent(
                createVehiclePopup(
                    vehicle
                )
            );


            return;

        }


        /*
         * New online vehicle.
         */

        const marker =
            L.marker(
                position,
                {

                    icon:
                        createVehicleIcon(
                            vehicle
                        ),

                    title:
                        vehicleId

                }
            );


        marker.bindPopup(
            createVehiclePopup(
                vehicle
            )
        );


        marker.addTo(
            map
        );


        vehicleMarkers.set(
            vehicleId,
            marker
        );


        console.log(
            '[SafePath LiveMap] ONLINE vehicle marker added:',
            vehicleId
        );


        /*
         * Fit map after the first live vehicle
         * if necessary.
         */
        if (
            !mapHasFittedFleet
        ) {

            fitMapToFleetOnce();

        }

    }


    /* =========================================================
       REMOVE VEHICLE
    ========================================================== */

    function removeVehicle(
        vehicleId
    ) {

        if (!vehicleId) {

            return;

        }


        vehicles.delete(
            vehicleId
        );


        const marker =
            vehicleMarkers.get(
                vehicleId
            );


        if (marker) {

            if (map) {

                map.removeLayer(
                    marker
                );

            }


            vehicleMarkers.delete(
                vehicleId
            );


            console.log(
                '[SafePath LiveMap] Vehicle removed from map:',
                vehicleId
            );

        }

    }


    /* =========================================================
       CLEAR FLEET
    ========================================================== */

    function clearFleet() {

        /*
         * Remove all Leaflet markers.
         */
        vehicleMarkers.forEach(
            function (
                marker
            ) {

                if (
                    map &&
                    map.hasLayer(
                        marker
                    )
                ) {

                    map.removeLayer(
                        marker
                    );

                }

            }
        );


        vehicleMarkers.clear();


        /*
         * Remove all stored vehicles.
         */
        vehicles.clear();


        /*
         * Allow the next valid fleet to fit the map.
         */
        mapHasFittedFleet =
            false;


        console.log(
            '[SafePath LiveMap] Fleet cleared.'
        );

    }


    /* =========================================================
       VEHICLE ICON
    ========================================================== */

    function createVehicleIcon(
        vehicle
    ) {

        const vehicleClass =
            getVehicleClass(
                vehicle.vehicleType
            );


        const symbol =
            getVehicleSymbol(
                vehicle.vehicleType
            );


        const heading =
            Number.isFinite(
                vehicle.heading
            )

                ? vehicle.heading

                : 0;


        const html = `

            <div
                class="vehicle-marker ${vehicleClass}"
                style="transform: rotate(${heading}deg);"
                title="${escapeHtml(vehicle.vehicleId)}"
            >

                <span
                    style="transform: rotate(-${heading}deg);"
                >
                    ${symbol}
                </span>

            </div>

        `;


        return L.divIcon(
            {

                className:
                    'safepath-vehicle-marker',

                html:
                    html,

                iconSize:
                    [34, 34],

                iconAnchor:
                    [17, 17],

                popupAnchor:
                    [0, -18]

            }
        );

    }


    /* =========================================================
       VEHICLE SYMBOL
    ========================================================== */

    function getVehicleSymbol(
        vehicleType
    ) {

        switch (
            normalizeVehicleType(
                vehicleType
            )
        ) {

            case 'VIP':

                return '★';


            case 'POLICE':

                return 'P';


            case 'FIRE_ENGINE':

                return 'F';


            case 'AMBULANCE':

                return '✚';


            case 'CAR':

            default:

                return '●';

        }

    }


    /* =========================================================
       VEHICLE CSS CLASS
    ========================================================== */

    function getVehicleClass(
        vehicleType
    ) {

        switch (
            normalizeVehicleType(
                vehicleType
            )
        ) {

            case 'VIP':

                return 'vip';


            case 'POLICE':

                return 'police';


            case 'FIRE_ENGINE':

                return 'fire-engine';


            case 'AMBULANCE':

                return 'ambulance';


            case 'CAR':

            default:

                return 'car';

        }

    }


    /* =========================================================
       VEHICLE POPUP
    ========================================================== */

    function createVehiclePopup(
        vehicle
    ) {

        const speed =
            formatNumber(
                vehicle.speed,
                1
            );


        const heading =
            formatNumber(
                vehicle.heading,
                1
            );


        const accuracy =
            vehicle.accuracy === null

                ? '--'

                : `${formatNumber(vehicle.accuracy, 1)} m`;


        const lastOnline =
            formatDateTime(
                vehicle.lastOnline
            );


        return `

            <div class="vehicle-popup">

                <div class="vehicle-popup-title">

                    ${escapeHtml(
                        vehicle.vehicleId
                    )}

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Type
                    </span>

                    <span class="vehicle-popup-value">

                        ${escapeHtml(
                            formatVehicleType(
                                vehicle.vehicleType
                            )
                        )}

                    </span>

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Speed
                    </span>

                    <span class="vehicle-popup-value">

                        ${speed} km/h

                    </span>

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Heading
                    </span>

                    <span class="vehicle-popup-value">

                        ${heading}°

                    </span>

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Accuracy
                    </span>

                    <span class="vehicle-popup-value">

                        ${accuracy}

                    </span>

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Status
                    </span>

                    <span class="vehicle-popup-value">

                        Online

                    </span>

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Latitude
                    </span>

                    <span class="vehicle-popup-value">

                        ${formatNumber(
                            vehicle.latitude,
                            6
                        )}

                    </span>

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Longitude
                    </span>

                    <span class="vehicle-popup-value">

                        ${formatNumber(
                            vehicle.longitude,
                            6
                        )}

                    </span>

                </div>


                <div class="vehicle-popup-row">

                    <span class="vehicle-popup-label">
                        Last Online
                    </span>

                    <span class="vehicle-popup-value">

                        ${escapeHtml(
                            lastOnline
                        )}

                    </span>

                </div>

            </div>

        `;

    }


    /* =========================================================
       FIT MAP TO ONLINE FLEET
    ========================================================== */

    function fitMapToFleetOnce() {

        if (

            mapHasFittedFleet ||

            !map ||

            vehicleMarkers.size === 0

        ) {

            return;

        }


        const bounds =
            L.latLngBounds([]);


        vehicleMarkers.forEach(
            function (
                marker
            ) {

                bounds.extend(
                    marker.getLatLng()
                );

            }
        );


        if (
            !bounds.isValid()
        ) {

            return;

        }


        map.fitBounds(
            bounds,
            {

                padding:
                    [60, 60],

                maxZoom:
                    16

            }
        );


        mapHasFittedFleet =
            true;

    }


    /* =========================================================
       REFRESH BUTTON
    ========================================================== */

    function initializeRefreshButton() {

        const button =
            document.getElementById(
                'refreshButton'
            );


        if (!button) {

            return;

        }


        button.addEventListener(
            'click',
            async function () {

                button.disabled =
                    true;


                const originalText =
                    button.textContent;


                button.textContent =
                    'Refreshing...';


                try {

                    /*
                     * Clear stale fleet immediately.
                     */
                    clearFleet();


                    updateFleetCount();


                    /*
                     * Reload current ONLINE fleet
                     * from backend.
                     */
                    await loadFleetFromApi();


                    /*
                     * Reconnect Socket.IO so that
                     * a fresh snapshot is received.
                     */
                    if (socketClient) {

                        try {

                            socketClient.disconnect();

                        } catch {
                            // Ignore.
                        }


                        setTimeout(
                            function () {

                                try {

                                    socketClient.connect();

                                } catch (error) {

                                    console.error(
                                        '[SafePath LiveMap] Socket reconnect failed:',
                                        error
                                    );

                                }

                            },
                            150
                        );

                    }


                    mapHasFittedFleet =
                        false;


                    setTimeout(
                        function () {

                            fitMapToFleetOnce();

                        },
                        200
                    );


                } finally {

                    setTimeout(
                        function () {

                            button.disabled =
                                false;

                            button.textContent =
                                originalText;

                        },
                        500
                    );

                }

            }
        );

    }


    /* =========================================================
       FLEET COUNT
    ========================================================== */

    function updateFleetCount() {

        const element =
            document.getElementById(
                'fleetVehicleCount'
            );


        if (!element) {

            return;

        }


        /*
         * `vehicles` contains ONLINE vehicles only.
         */
        const count =
            vehicles.size;


        element.textContent =
            `${count} ${
                count === 1
                    ? 'vehicle'
                    : 'vehicles'
            }`;

    }


    /* =========================================================
       CONNECTION INDICATOR
    ========================================================== */

    function setConnectionIndicator(
        connected
    ) {

        const indicator =
            document.getElementById(
                'connectionIndicator'
            );


        const text =
            document.getElementById(
                'connectionText'
            );


        if (!indicator || !text) {

            return;

        }


        indicator.classList.remove(
            'online',
            'offline'
        );


        if (connected) {

            indicator.classList.add(
                'online'
            );


            text.textContent =
                'Connected';

        } else {

            indicator.classList.add(
                'offline'
            );


            text.textContent =
                'Disconnected';

        }

    }


    /* =========================================================
       NORMALIZE VEHICLE ID
    ========================================================== */

    function normalizeVehicleId(
        vehicleId
    ) {

        if (

            vehicleId === null ||

            vehicleId === undefined

        ) {

            return '';

        }


        return String(
            vehicleId
        ).trim();

    }


    /* =========================================================
       NORMALIZE VEHICLE TYPE
    ========================================================== */

    function normalizeVehicleType(
        vehicleType
    ) {

        if (

            vehicleType === null ||

            vehicleType === undefined

        ) {

            return 'CAR';

        }


        const normalized =
            String(
                vehicleType
            )
                .trim()
                .toUpperCase()
                .replace(
                    /[\s-]+/g,
                    '_'
                );


        /*
         * The current backend may still contain NORMAL
         * while Flutter is being corrected later.
         *
         * Display it as Car.
         */
        if (
            normalized === 'NORMAL'
        ) {

            return 'CAR';

        }


        switch (
            normalized
        ) {

            case 'VIP':
                return 'VIP';

            case 'POLICE':
                return 'POLICE';

            case 'FIRE_ENGINE':
                return 'FIRE_ENGINE';

            case 'AMBULANCE':
                return 'AMBULANCE';

            case 'CAR':
                return 'CAR';

            default:
                return 'CAR';

        }

    }


    /* =========================================================
       FORMAT VEHICLE TYPE
    ========================================================== */

    function formatVehicleType(
        vehicleType
    ) {

        switch (
            normalizeVehicleType(
                vehicleType
            )
        ) {

            case 'VIP':

                return 'VIP';


            case 'POLICE':

                return 'Police';


            case 'FIRE_ENGINE':

                return 'Fire Engine';


            case 'AMBULANCE':

                return 'Ambulance';


            case 'CAR':

            default:

                return 'Car';

        }

    }


    /* =========================================================
       NUMBER HELPERS
    ========================================================== */

    function toFiniteNumber(
        value,
        fallback
    ) {

        const number =
            Number(value);


        return Number.isFinite(
            number
        )

            ? number

            : fallback;

    }


    function formatNumber(
        value,
        decimals = 2
    ) {

        const number =
            Number(value);


        if (
            !Number.isFinite(
                number
            )
        ) {

            return '--';

        }


        return number.toFixed(
            decimals
        );

    }


    /* =========================================================
       DATE/TIME
    ========================================================== */

    function formatDateTime(
        value
    ) {

        if (!value) {

            return '--';

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

            return '--';

        }


        return date.toLocaleString();

    }


    /* =========================================================
       HTML ESCAPING
    ========================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ''
        )
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


    /* =========================================================
       GLOBAL ACCESS
    ========================================================== */

    window.SafePathLiveMap = {

        getMap() {

            return map;

        },


        getVehicles() {

            return vehicles;

        },


        getVehicleMarkers() {

            return vehicleMarkers;

        },


        refresh() {

            loadFleetFromApi();

        }

    };


})();