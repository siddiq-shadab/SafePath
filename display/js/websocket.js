/* =============================================================
   SAFE PATH
   SOCKET.IO CLIENT
   Fleet + Vehicle Realtime Communication
============================================================= */

class SafePathWebSocket {
    constructor(options = {}) {

        this.backendUrl =
            options.backendUrl ??
            window.location.origin;

        /*
         * Vehicle ID is optional.
         *
         * Fleet pages such as livemap.html do not need
         * a vehicle ID.
         *
         * Vehicle-specific pages such as events.html
         * can provide one.
         */
        this.vehicleId =
            options.vehicleId ??
            '';

        this.socket = null;

        this.connected = false;

        this.subscribed = false;

        /*
         * Existing single-vehicle callback.
         */
        this.telemetryCallback = null;

        /*
         * Fleet snapshot callback.
         *
         * Called when the backend sends:
         *
         * fleet:snapshot
         */
        this.fleetSnapshotCallback = null;

        /*
         * Fleet realtime callback.
         *
         * Called when the backend sends:
         *
         * fleet:telemetry
         */
        this.fleetTelemetryCallback = null;

        this.connectionCallback = null;

        this.errorCallback = null;
    }


    /* =========================================================
       CONNECT
    ========================================================== */

    connect() {

        if (this.socket) {
            this.disconnect();
        }

        this.updateConnectionStatus(false);

        console.log(
            '[SafePath] Connecting to:',
            `${this.backendUrl}/vehicles`
        );

        this.socket =
            io(
                `${this.backendUrl}/vehicles`,
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
                        5000,

                    timeout:
                        10000
                }
            );

        this.registerEvents();
    }


    /* =========================================================
       REGISTER EVENTS
    ========================================================== */

    registerEvents() {

        if (!this.socket) {
            return;
        }


        /* -----------------------------------------------------
           CONNECT
        ------------------------------------------------------ */

        this.socket.on(
            'connect',
            () => {

                this.connected = true;

                this.subscribed = false;

                console.log(
                    '[SafePath] Socket connected:',
                    this.socket.id
                );

                this.updateConnectionStatus(
                    true
                );

                this.updateSocketId(
                    this.socket.id
                );

                this.emitConnection(
                    true
                );

                /*
                 * IMPORTANT:
                 *
                 * We do NOT automatically subscribe to a
                 * vehicle for fleet pages.
                 *
                 * If a vehicleId was explicitly supplied,
                 * retain the existing vehicle-specific
                 * behavior for events.html.
                 */
                if (
                    this.vehicleId &&
                    this.vehicleId.trim().length > 0
                ) {

                    this.subscribe(
                        this.vehicleId
                    );
                }
            }
        );


        /* -----------------------------------------------------
           CONNECTION READY
        ------------------------------------------------------ */

        this.socket.on(
            'connection:ready',
            (data) => {

                console.log(
                    '[SafePath] Connection ready:',
                    data
                );
            }
        );


        /* -----------------------------------------------------
           FLEET SNAPSHOT
        ------------------------------------------------------ */

        this.socket.on(
            'fleet:snapshot',
            (data) => {

                console.log(
                    '[SafePath] Fleet snapshot received:',
                    data
                );

                if (!data) {
                    return;
                }

                /*
                 * Backend format:
                 *
                 * {
                 *     vehicles: [...],
                 *     count: number
                 * }
                 */

                const vehicles =
                    Array.isArray(
                        data.vehicles
                    )
                        ? data.vehicles
                        : [];

                if (
                    typeof this.fleetSnapshotCallback ===
                    'function'
                ) {

                    this.fleetSnapshotCallback(
                        vehicles,
                        data
                    );
                }
            }
        );


        /* -----------------------------------------------------
           FLEET LIVE TELEMETRY
        ------------------------------------------------------ */

        this.socket.on(
            'fleet:telemetry',
            (payload) => {

                console.log(
                    '[SafePath] Fleet telemetry:',
                    payload
                );

                if (!payload) {
                    return;
                }

                /*
                 * Fleet pages receive every vehicle update
                 * through this event.
                 *
                 * livemap.html can use vehicleId as the key
                 * and update/create the corresponding marker.
                 */

                if (
                    typeof this.fleetTelemetryCallback ===
                    'function'
                ) {

                    this.fleetTelemetryCallback(
                        payload
                    );
                }
            }
        );


        /* -----------------------------------------------------
           VEHICLE SUBSCRIBED
        ------------------------------------------------------ */

        this.socket.on(
            'vehicle:subscribed',
            (data) => {

                console.log(
                    '[SafePath] Vehicle subscribed:',
                    data
                );

                this.subscribed = true;

                const subscribedVehicleId =
                    data?.vehicleId ??
                    this.vehicleId;

                if (
                    subscribedVehicleId
                ) {

                    this.vehicleId =
                        String(
                            subscribedVehicleId
                        ).trim();

                    this.updateVehicleId(
                        this.vehicleId
                    );

                    this.updateRoom(
                        this.vehicleId
                    );
                }
            }
        );


        /* -----------------------------------------------------
           VEHICLE UNSUBSCRIBED
        ------------------------------------------------------ */

        this.socket.on(
            'vehicle:unsubscribed',
            (data) => {

                console.log(
                    '[SafePath] Vehicle unsubscribed:',
                    data
                );

                this.subscribed = false;
            }
        );


        /* -----------------------------------------------------
           VEHICLE ERROR
        ------------------------------------------------------ */

        this.socket.on(
            'vehicle:error',
            (data) => {

                console.error(
                    '[SafePath] Vehicle error:',
                    data
                );

                this.emitError(
                    data
                );
            }
        );


        /* -----------------------------------------------------
           VEHICLE-SPECIFIC LIVE TELEMETRY
        ------------------------------------------------------ */

        this.socket.on(
            'vehicle:telemetry',
            (payload) => {

                console.log(
                    '[SafePath] Vehicle telemetry:',
                    payload
                );

                if (!payload) {
                    return;
                }

                /*
                 * Backend telemetry is authoritative.
                 *
                 * Automatically discover the vehicle ID
                 * if this client is being used by a
                 * vehicle-specific display.
                 */
                if (
                    payload.vehicleId
                ) {

                    const incomingVehicleId =
                        String(
                            payload.vehicleId
                        ).trim();

                    if (
                        incomingVehicleId.length > 0
                    ) {

                        /*
                         * Only update the local vehicle ID
                         * when this client already operates
                         * in vehicle-specific mode.
                         *
                         * Fleet pages should not become locked
                         * to the first vehicle they receive.
                         */
                        if (
                            this.vehicleId &&
                            this.vehicleId !==
                                incomingVehicleId
                        ) {

                            this.vehicleId =
                                incomingVehicleId;

                            this.updateVehicleId(
                                incomingVehicleId
                            );

                            this.updateRoom(
                                incomingVehicleId
                            );
                        }

                        /*
                         * If no vehicle was selected, allow
                         * the first vehicle telemetry to be
                         * delivered without changing the
                         * fleet client's identity.
                         */
                    }
                }

                if (
                    typeof this.telemetryCallback ===
                    'function'
                ) {

                    this.telemetryCallback(
                        payload
                    );
                }
            }
        );


        /* -----------------------------------------------------
           DISCONNECT
        ------------------------------------------------------ */

        this.socket.on(
            'disconnect',
            (reason) => {

                this.connected = false;

                this.subscribed = false;

                console.warn(
                    '[SafePath] Socket disconnected:',
                    reason
                );

                this.updateConnectionStatus(
                    false
                );

                this.updateSocketId(
                    '--'
                );

                this.emitConnection(
                    false
                );
            }
        );


        /* -----------------------------------------------------
           CONNECT ERROR
        ------------------------------------------------------ */

        this.socket.on(
            'connect_error',
            (error) => {

                this.connected = false;

                console.error(
                    '[SafePath] Socket connection error:',
                    error
                );

                this.updateConnectionStatus(
                    false
                );

                this.emitError(
                    error
                );
            }
        );
    }


    /* =========================================================
       SET VEHICLE ID
    ========================================================== */

    setVehicleId(vehicleId) {

        const normalizedVehicleId =
            String(
                vehicleId ?? ''
            ).trim();

        this.vehicleId =
            normalizedVehicleId;

        this.updateVehicleId(
            normalizedVehicleId
        );

        this.updateRoom(
            normalizedVehicleId
        );
    }


    /* =========================================================
       SUBSCRIBE TO VEHICLE
    ========================================================== */

    subscribe(vehicleId) {

        if (!this.socket) {

            console.warn(
                '[SafePath] Socket is not initialized.'
            );

            return;
        }

        if (!this.connected) {

            console.warn(
                '[SafePath] Socket is not connected.'
            );

            return;
        }

        const normalizedVehicleId =
            String(
                vehicleId ?? ''
            ).trim();

        if (
            normalizedVehicleId.length === 0
        ) {

            console.warn(
                '[SafePath] Vehicle ID is empty.'
            );

            return;
        }


        /* -----------------------------------------------------
           Unsubscribe previous vehicle
        ------------------------------------------------------ */

        if (
            this.subscribed &&
            this.vehicleId &&
            this.vehicleId !==
                normalizedVehicleId
        ) {

            this.unsubscribe(
                this.vehicleId
            );
        }


        this.vehicleId =
            normalizedVehicleId;

        console.log(
            '[SafePath] Subscribing to:',
            normalizedVehicleId
        );

        this.socket.emit(
            'vehicle:subscribe',
            normalizedVehicleId
        );

        this.updateVehicleId(
            normalizedVehicleId
        );

        this.updateRoom(
            normalizedVehicleId
        );
    }


    /* =========================================================
       UNSUBSCRIBE FROM VEHICLE
    ========================================================== */

    unsubscribe(
        vehicleId = this.vehicleId
    ) {

        if (
            !this.socket ||
            !this.connected
        ) {
            return;
        }

        const normalizedVehicleId =
            String(
                vehicleId ?? ''
            ).trim();

        if (
            normalizedVehicleId.length === 0
        ) {
            return;
        }

        this.socket.emit(
            'vehicle:unsubscribe',
            normalizedVehicleId
        );

        this.subscribed = false;
    }


    /* =========================================================
       CHANGE VEHICLE
    ========================================================== */

    changeVehicle(vehicleId) {

        const normalizedVehicleId =
            String(
                vehicleId ?? ''
            ).trim();

        if (
            normalizedVehicleId.length === 0
        ) {
            return;
        }

        if (
            !this.connected
        ) {

            this.vehicleId =
                normalizedVehicleId;

            return;
        }

        this.subscribe(
            normalizedVehicleId
        );
    }


    /* =========================================================
       DISCONNECT
    ========================================================== */

    disconnect() {

        if (!this.socket) {
            return;
        }

        if (
            this.connected &&
            this.subscribed
        ) {

            this.unsubscribe(
                this.vehicleId
            );
        }

        this.socket.disconnect();

        this.socket = null;

        this.connected = false;

        this.subscribed = false;

        this.updateConnectionStatus(
            false
        );

        this.updateSocketId(
            '--'
        );

        this.emitConnection(
            false
        );
    }


    /* =========================================================
       FLEET CALLBACKS
    ========================================================== */

    onFleetSnapshot(callback) {

        this.fleetSnapshotCallback =
            callback;
    }


    onFleetTelemetry(callback) {

        this.fleetTelemetryCallback =
            callback;
    }


    /* =========================================================
       VEHICLE TELEMETRY CALLBACK
    ========================================================== */

    onTelemetry(callback) {

        this.telemetryCallback =
            callback;
    }


    /* =========================================================
       CONNECTION CALLBACK
    ========================================================== */

    onConnection(callback) {

        this.connectionCallback =
            callback;
    }


    /* =========================================================
       ERROR CALLBACK
    ========================================================== */

    onError(callback) {

        this.errorCallback =
            callback;
    }


    /* =========================================================
       EMIT CONNECTION
    ========================================================== */

    emitConnection(connected) {

        if (
            typeof this.connectionCallback ===
            'function'
        ) {

            this.connectionCallback(
                connected
            );
        }
    }


    /* =========================================================
       EMIT ERROR
    ========================================================== */

    emitError(error) {

        if (
            typeof this.errorCallback ===
            'function'
        ) {

            this.errorCallback(
                error
            );
        }
    }


    /* =========================================================
       UI HELPERS
    ========================================================== */

    updateConnectionStatus(
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

        if (!indicator) {
            return;
        }

        if (connected) {

            indicator.classList
                .remove('offline');

            indicator.classList
                .add('online');

            if (text) {

                text.textContent =
                    'Connected';
            }
        }

        else {

            indicator.classList
                .remove('online');

            indicator.classList
                .add('offline');

            if (text) {

                text.textContent =
                    'Disconnected';
            }
        }
    }


    updateSocketId(socketId) {

        const element =
            document.getElementById(
                'socketIdValue'
            );

        if (!element) {
            return;
        }

        element.textContent =
            socketId ?? '--';
    }


    updateVehicleId(vehicleId) {

        const input =
            document.getElementById(
                'vehicleIdInput'
            );

        if (input) {

            input.value =
                vehicleId ?? '';
        }
    }


    updateRoom(vehicleId) {

        const element =
            document.getElementById(
                'roomValue'
            );

        if (!element) {
            return;
        }

        const normalizedVehicleId =
            String(
                vehicleId ?? ''
            ).trim();

        element.textContent =
            normalizedVehicleId
                ? `vehicle:${normalizedVehicleId}`
                : '--';
    }
}


/* =============================================================
   GLOBAL EXPORT
============================================================= */

window.SafePathWebSocket =
    SafePathWebSocket;