
/* =============================================================
   SAFE PATH
   VEHICLE DISPLAY / MAP LOGIC
============================================================= */

class SafePathVehicle {


    constructor(map) {

        this.map = map;


        this.vehicleId = null;


        this.vehicleType = null;


        this.latitude = null;


        this.longitude = null;


        this.speed = 0;


        this.heading = 0;


        this.accuracy = null;


        this.lastOnline = null;


        this.currentOnline = false;


        this.marker = null;


        this.accuracyCircle = null;


        this.hasInitialPosition = false;

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
            normalizedVehicleId ||
            null;


        this.updateVehicleIdDisplay();

    }


    /* =========================================================
       UPDATE TELEMETRY
    ========================================================== */

    updateTelemetry(payload) {

        if (!payload) {
            return;
        }


        /*
         * Backend telemetry is authoritative.
         */

        if (
            payload.vehicleId !==
            undefined &&
            payload.vehicleId !==
            null
        ) {

            this.vehicleId =
                String(
                    payload.vehicleId
                ).trim();

        }


        if (
            payload.vehicleType !==
            undefined &&
            payload.vehicleType !==
            null
        ) {

            this.vehicleType =
                String(
                    payload.vehicleType
                ).trim();

        }


        this.latitude =
            this.toNumber(
                payload.latitude
            );


        this.longitude =
            this.toNumber(
                payload.longitude
            );


        this.speed =
            this.toNumber(
                payload.speed
            ) ?? 0;


        this.heading =
            this.toNumber(
                payload.heading
            ) ?? 0;


        this.accuracy =
            this.toNumber(
                payload.accuracy
            );


        this.lastOnline =
            payload.lastOnline ??
            null;


        this.currentOnline =
            Boolean(
                payload.currentOnline
            );


        this.updateMarker();


        this.updateUI();

    }


    /* =========================================================
       NUMBER CONVERSION
    ========================================================== */

    toNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ''
        ) {

            return null;

        }


        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return null;

        }


        return number;

    }


    /* =========================================================
       UPDATE MAP MARKER
    ========================================================== */

    updateMarker() {

        if (
            this.latitude === null ||
            this.longitude === null
        ) {

            return;

        }


        const position = [

            this.latitude,

            this.longitude

        ];


        /* -----------------------------------------------------
           CREATE MARKER
        ------------------------------------------------------ */

        if (!this.marker) {

            this.marker =
                L.marker(
                    position,
                    {
                        icon:
                            this.createVehicleIcon(
                                this.heading
                            ),

                        title:
                            this.vehicleId ??
                            'SafePath Vehicle'
                    }
                );


            this.marker
                .addTo(this.map);


            this.marker.bindPopup(
                this.createPopupContent()
            );


            this.hasInitialPosition = true;


            /*
             * First real telemetry position
             * becomes the map center.
             */

            this.map.setView(
                position,
                17
            );

        }


        /* -----------------------------------------------------
           UPDATE EXISTING MARKER
        ------------------------------------------------------ */

        else {

            this.marker.setLatLng(
                position
            );


            this.marker.setIcon(
                this.createVehicleIcon(
                    this.heading
                )
            );


            this.marker
                .setPopupContent(
                    this.createPopupContent()
                );


            if (
                !this.hasInitialPosition
            ) {

                this.map.setView(
                    position,
                    17
                );


                this.hasInitialPosition =
                    true;

            }

        }


        /* -----------------------------------------------------
           ACCURACY CIRCLE
        ------------------------------------------------------ */

        this.updateAccuracyCircle(
            position
        );

    }


    /* =========================================================
       VEHICLE ICON
    ========================================================== */

    createVehicleIcon(heading) {

        const safeHeading =
            Number.isFinite(
                heading
            )
                ? heading
                : 0;


        return L.divIcon({

            className:
                'safe-path-marker-container',


            html: `
                <div
                    class="safe-path-marker"
                    style="transform: rotate(${safeHeading}deg);"
                >
                    <div class="safe-path-marker-inner">
                        ▲
                    </div>
                </div>
            `,


            iconSize: [
                34,
                34
            ],


            iconAnchor: [
                17,
                17
            ],


            popupAnchor: [
                0,
                -18
            ]

        });

    }


    /* =========================================================
       ACCURACY CIRCLE
    ========================================================== */

    updateAccuracyCircle(position) {

        if (
            this.accuracy === null ||
            this.accuracy < 0
        ) {

            if (
                this.accuracyCircle
            ) {

                this.map.removeLayer(
                    this.accuracyCircle
                );


                this.accuracyCircle =
                    null;

            }


            return;

        }


        if (
            !this.accuracyCircle
        ) {

            this.accuracyCircle =
                L.circle(
                    position,
                    {
                        radius:
                            this.accuracy,

                        color:
                            '#2563eb',

                        fillColor:
                            '#2563eb',

                        fillOpacity:
                            0.08,

                        weight:
                            1
                    }
                );


            this.accuracyCircle
                .addTo(this.map);

        }


        else {

            this.accuracyCircle
                .setLatLng(
                    position
                );


            this.accuracyCircle
                .setRadius(
                    this.accuracy
                );

        }

    }


    /* =========================================================
       POPUP
    ========================================================== */

    createPopupContent() {

        const vehicleId =
            this.vehicleId ??
            '--';


        const vehicleType =
            this.vehicleType ??
            '--';


        const speed =
            Number.isFinite(
                this.speed
            )
                ? this.speed.toFixed(1)
                : '--';


        const heading =
            Number.isFinite(
                this.heading
            )
                ? this.heading.toFixed(1)
                : '--';


        const latitude =
            this.latitude !== null
                ? this.latitude.toFixed(6)
                : '--';


        const longitude =
            this.longitude !== null
                ? this.longitude.toFixed(6)
                : '--';


        const online =
            this.currentOnline
                ? 'ONLINE'
                : 'OFFLINE';


        return `
            <div
                style="
                    min-width:180px;
                    font-family:Arial,sans-serif;
                    line-height:1.5;
                "
            >

                <strong>
                    SafePath Vehicle
                </strong>

                <hr
                    style="
                        border:0;
                        border-top:
                            1px solid #e2e8f0;
                    "
                >

                <div>
                    <b>ID:</b>
                    ${this.escapeHtml(vehicleId)}
                </div>

                <div>
                    <b>Type:</b>
                    ${this.escapeHtml(vehicleType)}
                </div>

                <div>
                    <b>Status:</b>
                    ${online}
                </div>

                <div>
                    <b>Speed:</b>
                    ${speed} km/h
                </div>

                <div>
                    <b>Heading:</b>
                    ${heading}°
                </div>

                <div>
                    <b>Latitude:</b>
                    ${latitude}
                </div>

                <div>
                    <b>Longitude:</b>
                    ${longitude}
                </div>

            </div>
        `;

    }


    /* =========================================================
       UPDATE UI
    ========================================================== */

    updateUI() {

        this.setText(
            'vehicleIdDisplay',
            this.vehicleId ??
            '--'
        );


        this.setText(
            'vehicleTypeDisplay',
            this.vehicleType ??
            '--'
        );


        this.setText(
            'speedValue',
            Number.isFinite(
                this.speed
            )
                ? this.speed.toFixed(1)
                : '0'
        );


        this.setText(
            'headingValue',
            Number.isFinite(
                this.heading
            )
                ? this.heading.toFixed(1)
                : '0'
        );


        this.setText(
            'accuracyValue',
            this.accuracy !== null
                ? this.accuracy.toFixed(1)
                : '--'
        );


        this.setText(
            'latitudeValue',
            this.latitude !== null
                ? this.latitude.toFixed(6)
                : '--'
        );


        this.setText(
            'longitudeValue',
            this.longitude !== null
                ? this.longitude.toFixed(6)
                : '--'
        );


        this.setText(
            'lastOnlineValue',
            this.formatDate(
                this.lastOnline
            )
        );


        this.updateOnlineBadge();

    }


    /* =========================================================
       ONLINE BADGE
    ========================================================== */

    updateOnlineBadge() {

        const badge =
            document.getElementById(
                'vehicleOnlineBadge'
            );


        if (!badge) {
            return;
        }


        if (
            this.currentOnline
        ) {

            badge.textContent =
                'ONLINE';


            badge.classList
                .remove('offline');


            badge.classList
                .add('online');

        }


        else {

            badge.textContent =
                'OFFLINE';


            badge.classList
                .remove('online');


            badge.classList
                .add('offline');

        }

    }


    /* =========================================================
       VEHICLE ID DISPLAY
    ========================================================== */

    updateVehicleIdDisplay() {

        this.setText(
            'vehicleIdDisplay',
            this.vehicleId ??
            '--'
        );

    }


    /* =========================================================
       SET TEXT
    ========================================================== */

    setText(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (!element) {
            return;
        }


        element.textContent =
            value;

    }


    /* =========================================================
       DATE FORMAT
    ========================================================== */

    formatDate(value) {

        if (!value) {
            return '--';
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(value);

        }


        return date.toLocaleTimeString(
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


    /* =========================================================
       HTML ESCAPE
    ========================================================== */

    escapeHtml(value) {

        return String(value)
            .replaceAll(
                '&',
                '&amp;'
            )
            .replaceAll(
                '<',
                '&lt;'
            )
            .replaceAll(
                '>',
                '&gt;'
            )
            .replaceAll(
                '"',
                '&quot;'
            )
            .replaceAll(
                "'",
                '&#039;'
            );

    }


    /* =========================================================
       REMOVE MARKER
    ========================================================== */

    clear() {

        if (this.marker) {

            this.map.removeLayer(
                this.marker
            );


            this.marker =
                null;

        }


        if (
            this.accuracyCircle
        ) {

            this.map.removeLayer(
                this.accuracyCircle
            );


            this.accuracyCircle =
                null;

        }


        this.vehicleId = null;

        this.vehicleType = null;

        this.latitude = null;

        this.longitude = null;

        this.speed = 0;

        this.heading = 0;

        this.accuracy = null;

        this.lastOnline = null;

        this.currentOnline = false;


        this.hasInitialPosition =
            false;


        this.updateUI();

    }

}


/* =============================================================
   GLOBAL EXPORT
============================================================= */

window.SafePathVehicle =
    SafePathVehicle;