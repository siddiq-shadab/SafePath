/*
 * ============================================================
 * SafePath
 * Monitor
 *
 * Live Vehicle Monitor
 *
 * REST:
 *   GET http://localhost:3000/api/vehicles
 *
 * Socket:
 *   http://localhost:3000/vehicles
 *
 * Live refresh:
 *   Every 1 second
 *
 * Algorithms:
 *   radiusalgorithms.js
 *   emergencyalgorithm.js
 *   speedalgorithm.js
 * ============================================================
 */

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

    let vehicles = new Map();

    let vehicleMarkers = new Map();

    let restConnected = false;

    let socketConnected = false;


    /* ============================================================
       START
    ============================================================ */

    document.addEventListener(
        'DOMContentLoaded',
        initialize
    );


    async function initialize() {

        console.log(
            '[SafePath Monitor] Initializing...'
        );


        initializeNavigation();

        initializeMap();

        initializeButtons();


        /*
         * Initialize algorithms before
         * the first live telemetry update.
         */

        initializeAlgorithms();


        updateConnectionState();


        /*
         * First live request.
         */

        await refreshLiveVehicles();


        /*
         * Socket.IO.
         */

        initializeSocket();


        /*
         * Continue REST polling every second.
         */

        refreshTimer =
            window.setInterval(
                function () {

                    refreshLiveVehicles();

                },
                LIVE_REFRESH_INTERVAL
            );


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
       ALGORITHM INITIALIZATION
    ============================================================ */

    function initializeAlgorithms() {

        /*
         * Radius Algorithm
         *
         * Creates and maintains the 300 m
         * Geo Circle around live vehicles.
         */

        if (
            window.SafePathRadiusAlgorithms
        ) {

            window.SafePathRadiusAlgorithms
                .initialize(map);

        } else {

            console.warn(
                '[SafePath Monitor] Radius algorithm unavailable.'
            );

        }


        /*
         * Emergency Algorithm
         */

        if (
            window.SafePathEmergencyAlgorithms
        ) {

            window.SafePathEmergencyAlgorithms
                .initialize({

                    map: map,

                    onEmergencyStart:
                        function (data) {

                            console.log(
                                '[SafePath Emergency] START',
                                data
                            );

                        },

                    onEmergencyEnd:
                        function (data) {

                            console.log(
                                '[SafePath Emergency] END',
                                data
                            );

                        }

                });

        } else {

            console.warn(
                '[SafePath Monitor] Emergency algorithm unavailable.'
            );

        }


        /*
         * Speed Algorithm
         */

        if (
            window.SafePathSpeedAlgorithms
        ) {

            window.SafePathSpeedAlgorithms
                .initialize({

                    onViolationStart:
                        function (data) {

                            console.log(
                                '[SafePath Speed] Violation started',
                                data
                            );

                        },

                    onFineIssued:
                        function (data) {

                            console.log(
                                '[SafePath Speed] Fine issued',
                                data
                            );

                        },

                    onViolationClose:
                        function (data) {

                            console.log(
                                '[SafePath Speed] Popup closed',
                                data
                            );

                        }

                });

        } else {

            console.warn(
                '[SafePath Monitor] Speed algorithm unavailable.'
            );

        }

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
                'monitorMap'
            );


        if (!mapElement) {

            console.error(
                '[SafePath Monitor] #monitorMap not found.'
            );

            return;

        }


        if (
            typeof L ===
            'undefined'
        ) {

            console.error(
                '[SafePath Monitor] Leaflet not loaded.'
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


        /*
         * OpenStreetMap
         */

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
                '[SafePath Monitor] Map resize error:',
                error
            );

        }

    }


    /* ============================================================
       BUTTONS
    ============================================================ */

    function initializeButtons() {

        const refreshButton =
            document.getElementById(
                'refreshButton'
            );


        if (!refreshButton) {

            return;

        }


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


    /* ============================================================
       REST - EVERY 1 SECOND
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
             * Remove old map markers.
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
             * Update every live vehicle.
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


            /*
             * Run algorithms using the
             * current live fleet.
             */

            updateAlgorithms();


        } catch (error) {

            console.error(
                '[SafePath Monitor] REST error:',
                error
            );


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
                '[SafePath Monitor] Socket.IO unavailable.'
            );

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
                        '[SafePath Monitor] Socket.IO connected:',
                        socket.id
                    );


                    socketConnected =
                        true;


                    updateConnectionState();


                    refreshLiveVehicles();

                }
            );


            socket.on(
                'disconnect',
                function (reason) {

                    console.warn(
                        '[SafePath Monitor] Socket.IO disconnected:',
                        reason
                    );


                    socketConnected =
                        false;


                    updateConnectionState();

                }
            );


            socket.on(
                'connect_error',
                function (error) {

                    console.warn(
                        '[SafePath Monitor] Socket.IO error:',
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
                        '[SafePath Monitor] Socket ready:',
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
                '[SafePath Monitor] Socket initialization error:',
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
         * Connected if REST OR Socket.IO works.
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
       ALGORITHM ENGINE
    ============================================================ */

    function updateAlgorithms() {

        /*
         * Algorithms should only receive vehicles
         * that Monitor currently considers live.
         */

        const liveVehicles =
            Array.from(
                vehicles.values()
            ).filter(
                isLiveVehicle
            );


        /*
         * ----------------------------------------------------------
         * 300 m Geo Circle
         * ----------------------------------------------------------
         */

        if (
            window.SafePathRadiusAlgorithms
        ) {

            window.SafePathRadiusAlgorithms
                .updateVehicles(
                    liveVehicles
                );

        }


        /*
         * ----------------------------------------------------------
         * Emergency
         *
         * Car ↔ VIP
         * Car ↔ Police
         * Car ↔ Fire Engine
         * Car ↔ Ambulance
         * ----------------------------------------------------------
         */

        if (
            window.SafePathEmergencyAlgorithms
        ) {

            window.SafePathEmergencyAlgorithms
                .updateVehicles(
                    liveVehicles
                );

        }


        /*
         * ----------------------------------------------------------
         * Speed
         *
         * Car only
         *
         * > 30 km/h
         * ----------------------------------------------------------
         */

        if (
            window.SafePathSpeedAlgorithms
        ) {

            window.SafePathSpeedAlgorithms
                .updateVehicles(
                    liveVehicles
                );

        }

    }


    /* ============================================================
       SNAPSHOT
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


        /*
         * Re-evaluate algorithms after
         * receiving the complete snapshot.
         */

        updateAlgorithms();

    }


    /* ============================================================
       TELEMETRY
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
         * Run all algorithms immediately
         * on Socket.IO telemetry.
         *
         * This means the algorithm does not
         * need to wait for the next 1-second
         * REST request.
         */

        updateAlgorithms();


        socketConnected =
            true;


        updateConnectionState();

    }


    /* ============================================================
       LIVE VEHICLE CHECK
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
       UPDATE MARKER
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
         * Center on first vehicle.
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


        /*
         * Remove the algorithm state too.
         */

        if (
            window.SafePathRadiusAlgorithms
        ) {

            window.SafePathRadiusAlgorithms
                .removeVehicle(
                    vehicleId
                );

        }


        if (
            window.SafePathEmergencyAlgorithms
        ) {

            window.SafePathEmergencyAlgorithms
                .removeVehicle(
                    vehicleId
                );

        }


        if (
            window.SafePathSpeedAlgorithms
        ) {

            window.SafePathSpeedAlgorithms
                .removeVehicle(
                    vehicleId
                );

        }

    }


    /* ============================================================
       VEHICLE ICON
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
                    'safepath-monitor-marker',

                html: `

                    <div
                        class="monitor-vehicle-marker ${markerType}"
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
       VEHICLE POPUP
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


                <div>
                    Last Online:
                    ${escapeHtml(
                        vehicle.lastOnline ||
                        '--'
                    )}
                </div>


                <div>
                    Status:
                    <strong>
                        Online
                    </strong>
                </div>

            </div>

        `;

    }


    /* ============================================================
       NORMALIZE VEHICLE
    ============================================================ */

    function normalizeVehicle(
        item
    ) {

        if (!item) {

            return {

                vehicleId: '',

                vehicleType: 'NORMAL',

                latitude: NaN,

                longitude: NaN,

                speed: 0,

                heading: 0,

                accuracy: null,

                lastOnline: null,

                currentOnline: false

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
       NUMBER FORMAT
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
       HTML ESCAPE
    ============================================================ */

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


    /* ============================================================
       PUBLIC API
    ============================================================ */

    window.SafePathMonitor = {

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


        getLiveVehicles:
            function () {

                return Array.from(
                    vehicles.values()
                ).filter(
                    isLiveVehicle
                );

            },


        runAlgorithms:
            function () {

                updateAlgorithms();

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
                window.SafePathRadiusAlgorithms
            ) {

                window.SafePathRadiusAlgorithms
                    .clear();

            }


            if (
                window.SafePathEmergencyAlgorithms
            ) {

                window.SafePathEmergencyAlgorithms
                    .clear();

            }


            if (
                window.SafePathSpeedAlgorithms
            ) {

                window.SafePathSpeedAlgorithms
                    .clear();

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