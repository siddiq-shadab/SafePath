/*
 * SafePath
 * Emergency Algorithm
 *
 * File:
 * D:\Sec\safe_path_nodejs\display\algorithm\emergencyalgorithm.js
 *
 * Purpose:
 * Detect when a moving Car's 300-meter Geo Circle
 * touches/intersects the 300-meter Geo Circle of:
 *
 *   - VIP
 *   - Police
 *   - Fire Engine
 *   - Ambulance
 *
 * When the condition occurs:
 *
 *   "THIS IS EMERGENCY"
 *   "Please move Left side"
 *
 * with a left-direction visual symbol.
 *
 * When the emergency vehicle leaves the Car's Geo Circle,
 * the popup closes.
 *
 * No emergency popup is generated for:
 *
 *   VIP ↔ VIP
 *   VIP ↔ Police
 *   VIP ↔ Fire Engine
 *   VIP ↔ Ambulance
 *   Police ↔ Police
 *   Police ↔ Fire Engine
 *   Police ↔ Ambulance
 *   Fire Engine ↔ Fire Engine
 *   Fire Engine ↔ Ambulance
 *   Ambulance ↔ Ambulance
 *
 * This module does NOT:
 *   - create the Leaflet map
 *   - connect to REST
 *   - connect to Socket.IO
 *   - replace monitor.js
 *   - replace radiusalgorithms.js
 *
 * It is intended to be initialized by monitor.html later.
 */

(function (window) {
    'use strict';

    // ================================================================
    // Configuration
    // ================================================================

    const EMERGENCY_RADIUS_METERS = 300;

    const CAR_TYPE = 'Car';

    const EMERGENCY_TYPES = new Set([
        'VIP',
        'Police',
        'Fire Engine',
        'Ambulance'
    ]);

    // ================================================================
    // Internal state
    // ================================================================

    let map = null;

    /*
     * Current vehicle state.
     *
     * vehicleId -> vehicle object
     */
    const vehicles = new Map();

    /*
     * Active emergency situations.
     *
     * key:
     *   carVehicleId::emergencyVehicleId
     *
     * value:
     * {
     *   carVehicleId,
     *   emergencyVehicleId,
     *   emergencyVehicleType,
     *   distanceMeters,
     *   active,
     *   popupElement
     * }
     */
    const activeEmergencies = new Map();

    /*
     * Popup DOM container.
     *
     * One popup is displayed at a time.
     *
     * If multiple emergency vehicles approach
     * the same car, the popup remains active until
     * all triggering emergency situations have ended.
     */
    let popupElement = null;

    /*
     * Optional callback supplied by Monitor.
     *
     * Example:
     *
     * SafePathEmergencyAlgorithms.onEmergencyStart = function (data) {
     *     ...
     * };
     */
    let emergencyStartCallback = null;
    let emergencyEndCallback = null;

    // ================================================================
    // Utility
    // ================================================================

    function normalizeVehicleType(vehicleType) {
        if (!vehicleType) {
            return 'Car';
        }

        const value = String(vehicleType)
            .trim()
            .toLowerCase();

        switch (value) {
            case 'car':
            case 'normal':
            case 'normal car':
            case 'car / jeep / van':
            case 'car/jeep/van':
            case 'jeep':
            case 'van':
                return 'Car';

            case 'vip':
                return 'VIP';

            case 'police':
            case 'police vehicle':
                return 'Police';

            case 'fire':
            case 'fire engine':
            case 'fire_engine':
            case 'fireengine':
                return 'Fire Engine';

            case 'ambulance':
            case 'ambulance vehicle':
                return 'Ambulance';

            default:
                return String(vehicleType).trim();
        }
    }

    function getVehicleId(vehicle) {
        if (!vehicle) {
            return '';
        }

        return String(
            vehicle.vehicleId ??
            vehicle.id ??
            ''
        ).trim();
    }

    function getLatitude(vehicle) {
        return Number(vehicle?.latitude);
    }

    function getLongitude(vehicle) {
        return Number(vehicle?.longitude);
    }

    function isValidCoordinate(latitude, longitude) {
        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return false;
        }

        if (
            latitude < -90 ||
            latitude > 90
        ) {
            return false;
        }

        if (
            longitude < -180 ||
            longitude > 180
        ) {
            return false;
        }

        return true;
    }

    // ================================================================
    // Geographic distance
    // ================================================================

    /*
     * Haversine distance.
     *
     * Returns meters.
     */

    function calculateDistance(
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) {
        if (
            !isValidCoordinate(
                latitude1,
                longitude1
            )
        ) {
            return null;
        }

        if (
            !isValidCoordinate(
                latitude2,
                longitude2
            )
        ) {
            return null;
        }

        const earthRadiusMeters = 6371000;

        const lat1 =
            latitude1 *
            Math.PI /
            180;

        const lat2 =
            latitude2 *
            Math.PI /
            180;

        const deltaLat =
            (latitude2 - latitude1) *
            Math.PI /
            180;

        const deltaLon =
            (longitude2 - longitude1) *
            Math.PI /
            180;

        const a =
            Math.sin(deltaLat / 2) *
            Math.sin(deltaLat / 2) +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(deltaLon / 2) *
            Math.sin(deltaLon / 2);

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        return earthRadiusMeters * c;
    }

    // ================================================================
    // Geo Circle intersection
    // ================================================================

    /*
     * Both Geo Circles have a 300-meter radius.
     *
     * Therefore:
     *
     * Car Geo Circle radius      = 300 m
     * Emergency Geo Circle      = 300 m
     *
     * The circles touch/intersect when:
     *
     * distance between centers <= 600 m
     *
     * We intentionally use:
     *
     *   radiusA + radiusB
     *
     * instead of hard-coding 600.
     *
     * This makes the algorithm easier to extend later.
     */

    function geoCirclesTouch(
        latitude1,
        longitude1,
        radius1,
        latitude2,
        longitude2,
        radius2
    ) {
        const distance = calculateDistance(
            latitude1,
            longitude1,
            latitude2,
            longitude2
        );

        if (distance === null) {
            return false;
        }

        const combinedRadius =
            Number(radius1) +
            Number(radius2);

        return distance <= combinedRadius;
    }

    // ================================================================
    // Emergency vehicle classification
    // ================================================================

    function isCar(vehicle) {
        if (!vehicle) {
            return false;
        }

        return (
            normalizeVehicleType(
                vehicle.vehicleType
            ) === CAR_TYPE
        );
    }

    function isEmergencyVehicle(vehicle) {
        if (!vehicle) {
            return false;
        }

        return EMERGENCY_TYPES.has(
            normalizeVehicleType(
                vehicle.vehicleType
            )
        );
    }

    /*
     * Only these combinations are allowed:
     *
     * Car -> VIP
     * Car -> Police
     * Car -> Fire Engine
     * Car -> Ambulance
     *
     * No other combination is allowed.
     */

    function isEmergencyPair(
        vehicleA,
        vehicleB
    ) {
        if (!vehicleA || !vehicleB) {
            return false;
        }

        const typeA = normalizeVehicleType(
            vehicleA.vehicleType
        );

        const typeB = normalizeVehicleType(
            vehicleB.vehicleType
        );

        return (
            (
                typeA === CAR_TYPE &&
                EMERGENCY_TYPES.has(typeB)
            ) ||
            (
                typeB === CAR_TYPE &&
                EMERGENCY_TYPES.has(typeA)
            )
        );
    }

    // ================================================================
    // Emergency popup
    // ================================================================

    function createPopup() {
        if (popupElement) {
            return popupElement;
        }

        const popup = document.createElement('div');

        popup.className =
            'safepath-emergency-popup';

        popup.setAttribute(
            'role',
            'alert'
        );

        popup.setAttribute(
            'aria-live',
            'assertive'
        );

        popup.innerHTML = `
            <div class="safepath-emergency-popup__card">

                <div class="safepath-emergency-popup__icon">
                    🚨
                </div>

                <div class="safepath-emergency-popup__content">

                    <div class="safepath-emergency-popup__title">
                        THIS IS EMERGENCY
                    </div>

                    <div class="safepath-emergency-popup__message">
                        Please move Left side
                    </div>

                    <div class="safepath-emergency-popup__left-arrow"
                         aria-hidden="true">
                        ←
                    </div>

                    <div class="safepath-emergency-popup__instruction">
                        Move to the left side and give way
                    </div>

                </div>

            </div>
        `;

        document.body.appendChild(popup);

        popupElement = popup;

        return popup;
    }

    function showPopup() {
        const popup = createPopup();

        popup.classList.add(
            'safepath-emergency-popup--visible'
        );
    }

    function hidePopup() {
        if (!popupElement) {
            return;
        }

        popupElement.classList.remove(
            'safepath-emergency-popup--visible'
        );
    }

    // ================================================================
    // Active emergency popup state
    // ================================================================

    function hasActiveEmergencyForCar(
        carVehicleId
    ) {
        for (
            const emergency of activeEmergencies.values()
        ) {
            if (
                emergency.carVehicleId ===
                carVehicleId
            ) {
                return true;
            }
        }

        return false;
    }

    function hasAnyActiveEmergency() {
        return activeEmergencies.size > 0;
    }

    // ================================================================
    // Emergency start
    // ================================================================

    function startEmergency(
        carVehicle,
        emergencyVehicle,
        distanceMeters
    ) {
        const carVehicleId =
            getVehicleId(carVehicle);

        const emergencyVehicleId =
            getVehicleId(emergencyVehicle);

        if (
            !carVehicleId ||
            !emergencyVehicleId
        ) {
            return;
        }

        const emergencyVehicleType =
            normalizeVehicleType(
                emergencyVehicle.vehicleType
            );

        const emergencyKey =
            `${carVehicleId}::${emergencyVehicleId}`;

        /*
         * Do not repeatedly open the same emergency
         * every time telemetry is received.
         */
        if (
            activeEmergencies.has(
                emergencyKey
            )
        ) {
            return;
        }

        const emergencyData = {
            carVehicleId,
            emergencyVehicleId,
            emergencyVehicleType,
            distanceMeters,
            active: true,
            startedAt: new Date().toISOString()
        };

        activeEmergencies.set(
            emergencyKey,
            emergencyData
        );

        /*
         * Open the popup only for the permitted
         * Car -> Emergency Vehicle combination.
         */
        showPopup();

        if (
            typeof emergencyStartCallback ===
            'function'
        ) {
            try {
                emergencyStartCallback(
                    emergencyData
                );
            } catch (error) {
                console.error(
                    '[SafePathEmergencyAlgorithms] Emergency start callback error:',
                    error
                );
            }
        }
    }

    // ================================================================
    // Emergency end
    // ================================================================

    function endEmergency(
        carVehicleId,
        emergencyVehicleId
    ) {
        if (
            !carVehicleId ||
            !emergencyVehicleId
        ) {
            return;
        }

        const emergencyKey =
            `${carVehicleId}::${emergencyVehicleId}`;

        const emergencyData =
            activeEmergencies.get(
                emergencyKey
            );

        if (!emergencyData) {
            return;
        }

        activeEmergencies.delete(
            emergencyKey
        );

        if (
            typeof emergencyEndCallback ===
            'function'
        ) {
            try {
                emergencyEndCallback({
                    ...emergencyData,
                    active: false,
                    endedAt:
                        new Date().toISOString()
                });
            } catch (error) {
                console.error(
                    '[SafePathEmergencyAlgorithms] Emergency end callback error:',
                    error
                );
            }
        }

        /*
         * Close the popup only when there are
         * no remaining Car -> Emergency Vehicle
         * situations.
         */
        if (
            !hasAnyActiveEmergency()
        ) {
            hidePopup();
        }
    }

    // ================================================================
    // Evaluate one Car against one Emergency Vehicle
    // ================================================================

    function evaluatePair(
        carVehicle,
        emergencyVehicle
    ) {
        if (
            !carVehicle ||
            !emergencyVehicle
        ) {
            return;
        }

        /*
         * Make absolutely sure that only:
         *
         * Car ↔ VIP
         * Car ↔ Police
         * Car ↔ Fire Engine
         * Car ↔ Ambulance
         *
         * can reach the emergency calculation.
         */
        if (
            !isEmergencyPair(
                carVehicle,
                emergencyVehicle
            )
        ) {
            return;
        }

        const carLatitude =
            getLatitude(carVehicle);

        const carLongitude =
            getLongitude(carVehicle);

        const emergencyLatitude =
            getLatitude(emergencyVehicle);

        const emergencyLongitude =
            getLongitude(emergencyVehicle);

        if (
            !isValidCoordinate(
                carLatitude,
                carLongitude
            )
        ) {
            return;
        }

        if (
            !isValidCoordinate(
                emergencyLatitude,
                emergencyLongitude
            )
        ) {
            return;
        }

        const carRadius =
            EMERGENCY_RADIUS_METERS;

        const emergencyRadius =
            EMERGENCY_RADIUS_METERS;

        const distanceMeters =
            calculateDistance(
                carLatitude,
                carLongitude,
                emergencyLatitude,
                emergencyLongitude
            );

        if (distanceMeters === null) {
            return;
        }

        const touching =
            geoCirclesTouch(
                carLatitude,
                carLongitude,
                carRadius,
                emergencyLatitude,
                emergencyLongitude,
                emergencyRadius
            );

        const carVehicleId =
            getVehicleId(carVehicle);

        const emergencyVehicleId =
            getVehicleId(emergencyVehicle);

        if (
            !carVehicleId ||
            !emergencyVehicleId
        ) {
            return;
        }

        const emergencyKey =
            `${carVehicleId}::${emergencyVehicleId}`;

        if (touching) {
            startEmergency(
                carVehicle,
                emergencyVehicle,
                distanceMeters
            );

            /*
             * Update the current distance in case
             * the emergency is already active.
             */
            const active =
                activeEmergencies.get(
                    emergencyKey
                );

            if (active) {
                active.distanceMeters =
                    distanceMeters;
            }
        } else {
            /*
             * The emergency vehicle has passed
             * outside the Car's Geo Circle.
             *
             * Close this specific emergency condition.
             */
            endEmergency(
                carVehicleId,
                emergencyVehicleId
            );
        }
    }

    // ================================================================
    // Evaluate all vehicles
    // ================================================================

    function evaluate() {
        const vehicleArray =
            Array.from(
                vehicles.values()
            );

        const cars =
            vehicleArray.filter(
                isCar
            );

        const emergencyVehicles =
            vehicleArray.filter(
                isEmergencyVehicle
            );

        /*
         * Evaluate every Car against every
         * Emergency Vehicle.
         */
        cars.forEach((carVehicle) => {
            emergencyVehicles.forEach(
                (emergencyVehicle) => {
                    evaluatePair(
                        carVehicle,
                        emergencyVehicle
                    );
                }
            );
        });

        /*
         * Clean up active emergency pairs
         * where either vehicle is no longer present.
         */
        activeEmergencies.forEach(
            (emergencyData, emergencyKey) => {
                const carExists =
                    vehicles.has(
                        emergencyData.carVehicleId
                    );

                const emergencyExists =
                    vehicles.has(
                        emergencyData.emergencyVehicleId
                    );

                if (
                    !carExists ||
                    !emergencyExists
                ) {
                    activeEmergencies.delete(
                        emergencyKey
                    );
                }
            }
        );

        if (
            activeEmergencies.size === 0
        ) {
            hidePopup();
        }
    }

    // ================================================================
    // Update one vehicle
    // ================================================================

    function updateVehicle(vehicle) {
        if (!vehicle) {
            return;
        }

        const vehicleId =
            getVehicleId(vehicle);

        if (!vehicleId) {
            return;
        }

        const latitude =
            getLatitude(vehicle);

        const longitude =
            getLongitude(vehicle);

        if (
            !isValidCoordinate(
                latitude,
                longitude
            )
        ) {
            return;
        }

        const normalizedVehicle = {
            ...vehicle,

            vehicleId,

            vehicleType:
                normalizeVehicleType(
                    vehicle.vehicleType
                ),

            latitude,

            longitude
        };

        vehicles.set(
            vehicleId,
            normalizedVehicle
        );

        evaluate();
    }

    // ================================================================
    // Update all vehicles
    // ================================================================

    function updateVehicles(vehicleList) {
        if (!Array.isArray(vehicleList)) {
            return;
        }

        const currentVehicleIds =
            new Set();

        vehicleList.forEach((vehicle) => {
            if (!vehicle) {
                return;
            }

            const vehicleId =
                getVehicleId(vehicle);

            if (!vehicleId) {
                return;
            }

            const latitude =
                getLatitude(vehicle);

            const longitude =
                getLongitude(vehicle);

            if (
                !isValidCoordinate(
                    latitude,
                    longitude
                )
            ) {
                return;
            }

            currentVehicleIds.add(
                vehicleId
            );

            vehicles.set(
                vehicleId,
                {
                    ...vehicle,

                    vehicleId,

                    vehicleType:
                        normalizeVehicleType(
                            vehicle.vehicleType
                        ),

                    latitude,

                    longitude
                }
            );
        });

        /*
         * Remove vehicles that no longer
         * exist in the latest fleet snapshot.
         */
        vehicles.forEach(
            (vehicle, vehicleId) => {
                if (
                    !currentVehicleIds.has(
                        vehicleId
                    )
                ) {
                    vehicles.delete(
                        vehicleId
                    );
                }
            }
        );

        evaluate();
    }

    // ================================================================
    // Remove vehicle
    // ================================================================

    function removeVehicle(vehicleId) {
        if (!vehicleId) {
            return;
        }

        const id =
            String(vehicleId).trim();

        vehicles.delete(id);

        /*
         * End every active emergency involving
         * this vehicle.
         */
        activeEmergencies.forEach(
            (emergencyData, emergencyKey) => {
                if (
                    emergencyData.carVehicleId === id ||
                    emergencyData.emergencyVehicleId === id
                ) {
                    activeEmergencies.delete(
                        emergencyKey
                    );
                }
            }
        );

        if (
            activeEmergencies.size === 0
        ) {
            hidePopup();
        }
    }

    // ================================================================
    // Initialize
    // ================================================================

    function initialize(options = {}) {
        if (
            options &&
            options.map
        ) {
            map = options.map;
        }

        if (
            typeof options.onEmergencyStart ===
            'function'
        ) {
            emergencyStartCallback =
                options.onEmergencyStart;
        }

        if (
            typeof options.onEmergencyEnd ===
            'function'
        ) {
            emergencyEndCallback =
                options.onEmergencyEnd;
        }

        /*
         * Create popup only when needed.
         */
        if (
            typeof document !==
            'undefined'
        ) {
            createPopup();
            hidePopup();
        }

        return true;
    }

    // ================================================================
    // Clear
    // ================================================================

    function clear() {
        vehicles.clear();
        activeEmergencies.clear();

        hidePopup();
    }

    // ================================================================
    // Public API
    // ================================================================

    const SafePathEmergencyAlgorithms = {

        initialize,

        updateVehicle,

        updateVehicles,

        removeVehicle,

        evaluate,

        clear,

        calculateDistance,

        geoCirclesTouch,

        isEmergencyPair,

        isCar,

        isEmergencyVehicle,

        getActiveEmergencies() {
            return Array.from(
                activeEmergencies.values()
            );
        },

        getVehicle(vehicleId) {
            if (!vehicleId) {
                return null;
            }

            return (
                vehicles.get(
                    String(vehicleId).trim()
                ) || null
            );
        },

        getVehicles() {
            return Array.from(
                vehicles.values()
            );
        },

        hasActiveEmergency() {
            return (
                activeEmergencies.size > 0
            );
        },

        getActiveEmergencyCount() {
            return activeEmergencies.size;
        },

        showEmergencyPopup() {
            showPopup();
        },

        hideEmergencyPopup() {
            hidePopup();
        },

        setEmergencyStartCallback(callback) {
            emergencyStartCallback =
                typeof callback === 'function'
                    ? callback
                    : null;
        },

        setEmergencyEndCallback(callback) {
            emergencyEndCallback =
                typeof callback === 'function'
                    ? callback
                    : null;
        },

        getEmergencyRadiusMeters() {
            return EMERGENCY_RADIUS_METERS;
        }
    };

    // ================================================================
    // Global export
    // ================================================================

    window.SafePathEmergencyAlgorithms =
        SafePathEmergencyAlgorithms;

})(window);