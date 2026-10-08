/* ============================================================
   SAFEPATH
   TRAFFIC FINE
   ============================================================ */

(function () {

    'use strict';


    /* ============================================================
       CONFIG
    ============================================================ */

    const BACKEND_URL =
        window.location.origin;

    const VEHICLES_API =
        `${BACKEND_URL}/api/vehicles`;

    const SOCKET_NAMESPACE =
        `${BACKEND_URL}/vehicles`;

    const LIVE_REFRESH_INTERVAL =
        1000;

    const WRONG_DIRECTION_DELAY =
        5000;

    const ONLINE_TIMEOUT =
        2 * 60 * 1000;

    const DEFAULT_CENTER = [
        18.445167,
        79.131954
    ];

    const DEFAULT_ZOOM =
        14;


    /* ============================================================
       STATE
    ============================================================ */

    let map = null;

    let socket = null;

    let refreshTimer = null;

    let refreshRunning = false;

    let wrongDirectionTimer = null;

    let selectedVehicleId = null;

    let wrongDirectionActive = false;

    let vehicles = new Map();

    let vehicleMarkers = new Map();

    /*
     * IMPORTANT:
     * REST and Socket.IO connection states are independent.
     */

    let restConnected = false;

    let socketConnected = false;


    /* ============================================================
       INITIALIZATION
    ============================================================ */

    document.addEventListener(
        'DOMContentLoaded',
        initialize
    );


    async function initialize() {

        console.log(
            '[SafePath Traffic Fine] Initializing...'
        );


        initializeNavigation();

        initializeMap();

        initializeButtons();


        updateConnectionState();


        /*
         * First REST request.
         */

        await refreshLiveVehicles();


        /*
         * Socket.IO.
         */

        initializeSocket();


        /*
         * REST polling every 1 second.
         */

        refreshTimer =
            window.setInterval(
                function () {

                    refreshLiveVehicles();

                },
                LIVE_REFRESH_INTERVAL
            );


        /*
         * Leaflet size corrections.
         */

        window.setTimeout(
            invalidateMap,
            250
        );

        window.setTimeout(
            invalidateMap,
            1000
        );

        window.setTimeout(
            invalidateMap,
            2000
        );

    }


    /* ============================================================
       NAVIGATION
    ============================================================ */

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

            return;

        }


        menuButton.addEventListener(
            'click',
            function () {

                drawer.classList.add(
                    'open'
                );

                overlay.classList.add(
                    'open'
                );

                menuButton.setAttribute(
                    'aria-expanded',
                    'true'
                );

            }
        );


        closeButton.addEventListener(
            'click',
            closeNavigation
        );


        overlay.addEventListener(
            'click',
            closeNavigation
        );


        document.addEventListener(
            'keydown',
            function (event) {

                if (
                    event.key ===
                    'Escape'
                ) {

                    closeNavigation();

                }

            }
        );

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


        if (drawer) {

            drawer.classList.remove(
                'open'
            );

        }


        if (overlay) {

            overlay.classList.remove(
                'open'
            );

        }


        if (menuButton) {

            menuButton.setAttribute(
                'aria-expanded',
                'false'
            );

        }

    }


    /* ============================================================
       MAP
    ============================================================ */

    function initializeMap() {

        const mapElement =
            document.getElementById(
                'fineMap'
            );


        if (!mapElement) {

            console.error(
                '[SafePath Traffic Fine] #fineMap not found.'
            );

            return;

        }


        if (
            typeof L ===
            'undefined'
        ) {

            console.error(
                '[SafePath Traffic Fine] Leaflet not loaded.'
            );

            return;

        }


        map =
            L.map(
                mapElement,
                {
                    center:
                        DEFAULT_CENTER,

                    zoom:
                        DEFAULT_ZOOM,

                    zoomControl:
                        true
                }
            );


        L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                attribution:
                    '&copy; OpenStreetMap contributors',

                maxZoom:
                    19,

                tileSize:
                    256,

                zoomOffset:
                    0,

                updateWhenIdle:
                    false,

                keepBuffer:
                    4
            }
        ).addTo(
            map
        );


        invalidateMap();


        window.setTimeout(
            invalidateMap,
            300
        );

        window.setTimeout(
            invalidateMap,
            1000
        );

        window.setTimeout(
            invalidateMap,
            2000
        );


        window.addEventListener(
            'resize',
            invalidateMap
        );

    }


    function invalidateMap() {

        if (!map) {

            return;

        }


        try {

            map.invalidateSize(
                true
            );

        } catch (error) {

            console.warn(
                '[SafePath Traffic Fine] Map resize error:',
                error
            );

        }

    }


    /* ============================================================
       BUTTONS
    ============================================================ */

    function initializeButtons() {

        const startButton =
            document.getElementById(
                'fineStartButton'
            );

        const refreshButton =
            document.getElementById(
                'refreshButton'
            );

        const closeButton =
            document.getElementById(
                'fineAlertCloseButton'
            );

        const alertOverlay =
            document.getElementById(
                'fineAlertOverlay'
            );


        if (startButton) {

            startButton.addEventListener(
                'click',
                startFineTest
            );

        }


        if (refreshButton) {

            refreshButton.addEventListener(
                'click',
                async function () {

                    refreshButton.disabled =
                        true;

                    const oldText =
                        refreshButton.textContent;

                    refreshButton.textContent =
                        'Refreshing...';


                    try {

                        await refreshLiveVehicles();

                        invalidateMap();

                    } finally {

                        window.setTimeout(
                            function () {

                                refreshButton.disabled =
                                    false;

                                refreshButton.textContent =
                                    oldText;

                            },
                            300
                        );

                    }

                }
            );

        }


        if (closeButton) {

            closeButton.addEventListener(
                'click',
                closeFineAlert
            );

        }


        if (alertOverlay) {

            alertOverlay.addEventListener(
                'click',
                function (event) {

                    if (
                        event.target ===
                        alertOverlay
                    ) {

                        closeFineAlert();

                    }

                }
            );

        }


        document.addEventListener(
            'keydown',
            function (event) {

                if (
                    event.key ===
                    'Escape'
                ) {

                    closeFineAlert();

                }

            }
        );

    }


    /* ============================================================
       REST API - EVERY 1 SECOND
    ============================================================ */

    async function refreshLiveVehicles() {

        if (
            refreshRunning
        ) {

            return;

        }


        refreshRunning =
            true;


        try {

            const response =
                await fetch(
                    VEHICLES_API,
                    {
                        method:
                            'GET',

                        cache:
                            'no-store',

                        headers:
                            {
                                Accept:
                                    'application/json',

                                'Cache-Control':
                                    'no-cache',

                                Pragma:
                                    'no-cache'
                            }
                    }
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const data =
                await response.json();


            if (
                !Array.isArray(
                    data
                )
            ) {

                throw new Error(
                    'Invalid vehicle response.'
                );

            }


            /*
             * REST is working.
             */

            restConnected =
                true;


            updateConnectionState();


            const nextVehicles =
                new Map();


            data.forEach(
                function (item) {

                    const vehicle =
                        normalizeVehicle(
                            item
                        );


                    if (
                        vehicle.vehicleId
                    ) {

                        nextVehicles.set(
                            vehicle.vehicleId,
                            vehicle
                        );

                    }

                }
            );


            vehicles =
                nextVehicles;


            /*
             * Remove stale/offline markers.
             */

            vehicleMarkers.forEach(
                function (
                    marker,
                    vehicleId
                ) {

                    const vehicle =
                        vehicles.get(
                            vehicleId
                        );


                    if (
                        !vehicle ||
                        !isLiveVehicle(
                            vehicle
                        )
                    ) {

                        removeMarker(
                            vehicleId
                        );

                    }

                }
            );


            /*
             * Add/update live vehicles.
             */

            vehicles.forEach(
                function (vehicle) {

                    if (
                        isLiveVehicle(
                            vehicle
                        )
                    ) {

                        updateMarker(
                            vehicle
                        );

                    }

                }
            );


        } catch (error) {

            console.error(
                '[SafePath Traffic Fine] REST error:',
                error
            );


            /*
             * REST failed.
             */

            restConnected =
                false;


            updateConnectionState();

        } finally {

            refreshRunning =
                false;

        }

    }


    /* ============================================================
       SOCKET.IO
    ============================================================ */

    function initializeSocket() {

        if (
            typeof io !==
            'function'
        ) {

            console.error(
                '[SafePath Traffic Fine] Socket.IO client unavailable.'
            );

            socketConnected =
                false;

            updateConnectionState();

            return;

        }


        try {

            socket =
                io(
                    SOCKET_NAMESPACE,
                    {
                        transports:
                            [
                                'websocket',
                                'polling'
                            ],

                        reconnection:
                            true,

                        reconnectionAttempts:
                            Infinity,

                        reconnectionDelay:
                            1000,

                        reconnectionDelayMax:
                            5000
                    }
                );


            socket.on(
                'connect',
                function () {

                    console.log(
                        '[SafePath Traffic Fine] Socket.IO connected:',
                        socket.id
                    );


                    socketConnected =
                        true;


                    updateConnectionState();


                    /*
                     * Immediately synchronize REST.
                     */

                    refreshLiveVehicles();

                }
            );


            socket.on(
                'disconnect',
                function (reason) {

                    console.warn(
                        '[SafePath Traffic Fine] Socket.IO disconnected:',
                        reason
                    );


                    socketConnected =
                        false;


                    /*
                     * IMPORTANT:
                     *
                     * We DO NOT automatically show
                     * Disconnected here if REST is still working.
                     */

                    updateConnectionState();

                }
            );


            socket.on(
                'connect_error',
                function (error) {

                    console.warn(
                        '[SafePath Traffic Fine] Socket.IO connection error:',
                        error
                    );


                    socketConnected =
                        false;


                    updateConnectionState();

                }
            );


            socket.on(
                'connection:ready',
                function (data) {

                    console.log(
                        '[SafePath Traffic Fine] Socket ready:',
                        data
                    );

                }
            );


            socket.on(
                'fleet:snapshot',
                function (data) {

                    processFleetSnapshot(
                        data
                    );

                }
            );


            socket.on(
                'fleet:telemetry',
                function (data) {

                    processTelemetry(
                        data
                    );

                }
            );


            socket.on(
                'vehicle:telemetry',
                function (data) {

                    processTelemetry(
                        data
                    );

                }
            );


        } catch (error) {

            console.error(
                '[SafePath Traffic Fine] Socket initialization error:',
                error
            );


            socketConnected =
                false;


            updateConnectionState();

        }

    }


    /* ============================================================
       CONNECTION STATE
    ============================================================ */

    function updateConnectionState() {

        const indicator =
            document.getElementById(
                'connectionIndicator'
            );

        const text =
            document.getElementById(
                'connectionText'
            );


        if (
            !indicator ||
            !text
        ) {

            return;

        }


        /*
         * CONNECTED if either transport works.
         */

        const connected =
            restConnected ||
            socketConnected;


        indicator.classList.toggle(
            'connected',
            connected
        );


        indicator.classList.toggle(
            'disconnected',
            !connected
        );


        text.textContent =
            connected
                ? 'Connected'
                : 'Disconnected';

    }


    /* ============================================================
       SOCKET SNAPSHOT
    ============================================================ */

    function processFleetSnapshot(
        payload
    ) {

        if (!payload) {

            return;

        }


        let list =
            payload.vehicles;


        if (
            !Array.isArray(
                list
            )
        ) {

            list =
                payload;

        }


        if (
            !Array.isArray(
                list
            )
        ) {

            return;

        }


        list.forEach(
            function (item) {

                processTelemetry(
                    item
                );

            }
        );

    }


    /* ============================================================
       SOCKET TELEMETRY
    ============================================================ */

    function processTelemetry(
        payload
    ) {

        if (!payload) {

            return;

        }


        const raw =
            payload.vehicle ||
            payload;


        const vehicle =
            normalizeVehicle(
                raw
            );


        if (
            !vehicle.vehicleId
        ) {

            return;

        }


        vehicles.set(
            vehicle.vehicleId,
            vehicle
        );


        if (
            isLiveVehicle(
                vehicle
            )
        ) {

            updateMarker(
                vehicle
            );

        } else {

            removeMarker(
                vehicle.vehicleId
            );

        }


        /*
         * Socket is alive.
         */

        socketConnected =
            true;


        updateConnectionState();

    }


    /* ============================================================
       LIVE VEHICLE
    ============================================================ */

    function isLiveVehicle(
        vehicle
    ) {

        if (!vehicle) {

            return false;

        }


        if (
            vehicle.currentOnline !==
            true
        ) {

            return false;

        }


        if (
            !Number.isFinite(
                vehicle.latitude
            ) ||
            !Number.isFinite(
                vehicle.longitude
            )
        ) {

            return false;

        }


        if (
            !vehicle.lastOnline
        ) {

            return false;

        }


        const timestamp =
            new Date(
                vehicle.lastOnline
            ).getTime();


        if (
            !Number.isFinite(
                timestamp
            )
        ) {

            return false;

        }


        const age =
            Math.max(
                0,
                Date.now() -
                timestamp
            );


        return (
            age <=
            ONLINE_TIMEOUT
        );

    }


    /* ============================================================
       MARKER
    ============================================================ */

    function updateMarker(
        vehicle
    ) {

        if (!map) {

            return;

        }


        const position = [

            vehicle.latitude,

            vehicle.longitude

        ];


        let marker =
            vehicleMarkers.get(
                vehicle.vehicleId
            );


        if (marker) {

            marker.setLatLng(
                position
            );


            marker.setIcon(
                createVehicleIcon(
                    vehicle
                )
            );


            marker.setPopupContent(
                createVehiclePopup(
                    vehicle
                )
            );


            applyWrongDirectionColor(
                vehicle.vehicleId
            );


            return;

        }


        marker =
            L.marker(
                position,
                {
                    icon:
                        createVehicleIcon(
                            vehicle
                        ),

                    title:
                        vehicle.vehicleId
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
            vehicle.vehicleId,
            marker
        );


        /*
         * Center on first live vehicle.
         */

        if (
            vehicleMarkers.size ===
            1
        ) {

            map.setView(
                position,
                DEFAULT_ZOOM
            );

        }


        applyWrongDirectionColor(
            vehicle.vehicleId
        );

    }


    /* ============================================================
       REMOVE MARKER
    ============================================================ */

    function removeMarker(
        vehicleId
    ) {

        const marker =
            vehicleMarkers.get(
                vehicleId
            );


        if (!marker) {

            return;

        }


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


        vehicleMarkers.delete(
            vehicleId
        );

    }


    /* ============================================================
       ICON
    ============================================================ */

    function createVehicleIcon(
        vehicle
    ) {

        let markerType =
            'car';

        let symbol =
            '●';


        const type =
            String(
                vehicle.vehicleType ||
                'NORMAL'
            )
                .trim()
                .toUpperCase()
                .replace(
                    /[\s-]+/g,
                    '_'
                );


        switch (
            type
        ) {

            case 'VIP':

                markerType =
                    'vip';

                symbol =
                    '★';

                break;


            case 'POLICE':

                markerType =
                    'police';

                symbol =
                    'P';

                break;


            case 'FIRE_ENGINE':

                markerType =
                    'fire-engine';

                symbol =
                    'F';

                break;


            case 'AMBULANCE':

                markerType =
                    'ambulance';

                symbol =
                    '✚';

                break;


            default:

                markerType =
                    'car';

                symbol =
                    '●';

        }


        const heading =
            Number.isFinite(
                vehicle.heading
            )
                ? vehicle.heading
                : 0;


        return L.divIcon(
            {

                className:
                    'safepath-fine-marker',

                html: `

                    <div
                        class="fine-vehicle-marker ${markerType}"
                        data-vehicle-id="${escapeHtml(
                            vehicle.vehicleId
                        )}"
                        style="
                            transform:
                                rotate(${heading}deg);
                        "
                    >

                        <span
                            style="
                                transform:
                                    rotate(-${heading}deg);
                            "
                        >
                            ${symbol}
                        </span>

                    </div>

                `,

                iconSize:
                    [
                        30,
                        30
                    ],

                iconAnchor:
                    [
                        15,
                        15
                    ],

                popupAnchor:
                    [
                        0,
                        -16
                    ]

            }
        );

    }


    /* ============================================================
       POPUP
    ============================================================ */

    function createVehiclePopup(
        vehicle
    ) {

        return `

            <div
                style="
                    min-width:190px;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                    line-height:1.6;
                "
            >

                <strong
                    style="
                        display:block;
                        margin-bottom:5px;
                        font-size:14px;
                    "
                >
                    ${escapeHtml(
                        vehicle.vehicleId
                    )}
                </strong>


                <div>
                    Vehicle Type:
                    ${escapeHtml(
                        vehicle.vehicleType
                    )}
                </div>


                <div>
                    Speed:
                    ${formatNumber(
                        vehicle.speed,
                        1
                    )} km/h
                </div>


                <div>
                    Heading:
                    ${formatNumber(
                        vehicle.heading,
                        1
                    )}°
                </div>


                <div>
                    Latitude:
                    ${formatNumber(
                        vehicle.latitude,
                        6
                    )}
                </div>


                <div>
                    Longitude:
                    ${formatNumber(
                        vehicle.longitude,
                        6
                    )}
                </div>


                <div>
                    Accuracy:
                    ${
                        vehicle.accuracy === null
                            ? '--'
                            : `${formatNumber(
                                vehicle.accuracy,
                                1
                            )} m`
                    }
                </div>

            </div>

        `;

    }


    /* ============================================================
       START TRAFFIC FINE DEMO
    ============================================================ */

    function startFineTest() {

        if (
            wrongDirectionTimer
        ) {

            return;

        }


        const vehicle =
            getFirstLiveVehicle();


        if (!vehicle) {

            window.alert(
                'No live vehicle is currently available. Please wait for a vehicle to appear on the map.'
            );

            return;

        }


        selectedVehicleId =
            vehicle.vehicleId;


        wrongDirectionActive =
            true;


        /*
         * Change vehicle to PINK immediately.
         */

        applyWrongDirectionColor(
            selectedVehicleId
        );


        const startButton =
            document.getElementById(
                'fineStartButton'
            );


        if (startButton) {

            startButton.disabled =
                true;

            startButton.textContent =
                'Testing...';

        }


        console.log(
            '[SafePath Traffic Fine] Test started:',
            selectedVehicleId
        );


        /*
         * Wait 5 seconds.
         */

        wrongDirectionTimer =
            window.setTimeout(
                function () {

                    wrongDirectionTimer =
                        null;


                    const latestVehicle =
                        vehicles.get(
                            selectedVehicleId
                        ) ||
                        vehicle;


                    openFinePopup(
                        latestVehicle
                    );


                    if (startButton) {

                        startButton.disabled =
                            false;

                        startButton.textContent =
                            'Start';

                    }

                },
                WRONG_DIRECTION_DELAY
            );

    }


    /* ============================================================
       FIRST LIVE VEHICLE
    ============================================================ */

    function getFirstLiveVehicle() {

        for (
            const vehicle
            of vehicles.values()
        ) {

            if (
                isLiveVehicle(
                    vehicle
                )
            ) {

                return vehicle;

            }

        }


        return null;

    }


    /* ============================================================
       PINK VEHICLE
    ============================================================ */

    function applyWrongDirectionColor(
        vehicleId
    ) {

        if (
            selectedVehicleId !==
            vehicleId ||
            !wrongDirectionActive
        ) {

            return;

        }


        const marker =
            vehicleMarkers.get(
                vehicleId
            );


        if (!marker) {

            return;

        }


        const element =
            marker.getElement();


        if (!element) {

            return;

        }


        const vehicleElement =
            element.querySelector(
                '.fine-vehicle-marker'
            );


        if (!vehicleElement) {

            return;

        }


        vehicleElement.classList.add(
            'wrong-direction'
        );

    }


    /* ============================================================
       OPEN FINE POPUP
    ============================================================ */

    function openFinePopup(
        vehicle
    ) {

        if (!vehicle) {

            return;

        }


        const vehicleId =
            document.getElementById(
                'fineAlertVehicleId'
            );


        const direction =
            document.getElementById(
                'fineAlertDirection'
            );


        const status =
            document.getElementById(
                'fineAlertStatus'
            );


        const fine =
            document.getElementById(
                'fineAlertFine'
            );


        if (vehicleId) {

            vehicleId.textContent =
                vehicle.vehicleId;

        }


        if (direction) {

            direction.textContent =
                'Backward';

        }


        if (status) {

            status.textContent =
                'Fine Issued';

        }


        if (fine) {

            fine.textContent =
                '₹100';

        }


        const overlay =
            document.getElementById(
                'fineAlertOverlay'
            );


        if (!overlay) {

            return;

        }


        overlay.classList.add(
            'open'
        );


        overlay.setAttribute(
            'aria-hidden',
            'false'
        );


        console.log(
            '[SafePath Traffic Fine] Fine issued:',
            vehicle.vehicleId,
            '₹100'
        );

    }


    /* ============================================================
       CLOSE POPUP
    ============================================================ */

    function closeFineAlert() {

        const overlay =
            document.getElementById(
                'fineAlertOverlay'
            );


        if (!overlay) {

            return;

        }


        overlay.classList.remove(
            'open'
        );


        overlay.setAttribute(
            'aria-hidden',
            'true'
        );

    }


    /* ============================================================
       NORMALIZE VEHICLE
    ============================================================ */

    function normalizeVehicle(
        item
    ) {

        if (!item) {

            return {

                vehicleId:
                    '',

                vehicleType:
                    'NORMAL',

                latitude:
                    NaN,

                longitude:
                    NaN,

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


        const accuracy =
            item.accuracy === null ||
            item.accuracy === undefined
                ? null
                : Number(
                    item.accuracy
                );


        return {

            vehicleId:
                String(
                    item.vehicleId ??
                    ''
                ).trim(),


            vehicleType:
                String(
                    item.vehicleType ??
                    'NORMAL'
                ).trim(),


            latitude:
                Number(
                    item.latitude
                ),


            longitude:
                Number(
                    item.longitude
                ),


            speed:
                Number.isFinite(
                    Number(
                        item.speed
                    )
                )
                    ? Number(
                        item.speed
                    )
                    : 0,


            heading:
                Number.isFinite(
                    Number(
                        item.heading
                    )
                )
                    ? Number(
                        item.heading
                    )
                    : 0,


            accuracy:
                Number.isFinite(
                    accuracy
                )
                    ? accuracy
                    : null,


            lastOnline:
                item.lastOnline ??
                null,


            currentOnline:
                item.currentOnline ===
                true

        };

    }


    /* ============================================================
       FORMAT NUMBER
    ============================================================ */

    function formatNumber(
        value,
        decimals
    ) {

        const number =
            Number(
                value
            );


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


    /* ============================================================
       ESCAPE HTML
    ============================================================ */

    function escapeHtml(
        value
    ) {

        return String(
            value ??
            ''
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


    /* ============================================================
       GLOBAL API
    ============================================================ */

    window.SafePathTrafficFine = {

        refresh:
            function () {

                return refreshLiveVehicles();

            },


        getVehicles:
            function () {

                return vehicles;

            },


        getMap:
            function () {

                return map;

            },


        start:
            function () {

                startFineTest();

            },


        closeAlert:
            function () {

                closeFineAlert();

            }

    };


    /* ============================================================
       CLEANUP
    ============================================================ */

    window.addEventListener(
        'beforeunload',
        function () {

            if (
                refreshTimer
            ) {

                window.clearInterval(
                    refreshTimer
                );

                refreshTimer =
                    null;

            }


            if (
                wrongDirectionTimer
            ) {

                window.clearTimeout(
                    wrongDirectionTimer
                );

                wrongDirectionTimer =
                    null;

            }


            if (
                socket
            ) {

                socket.disconnect();

                socket =
                    null;

            }

        }
    );

})();