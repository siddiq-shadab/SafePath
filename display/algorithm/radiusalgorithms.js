/*
 * SafePath
 * Radius Algorithms
 *
 * File:
 * D:\Sec\safe_path_nodejs\display\algorithm\radiusalgorithms.js
 *
 * Purpose:
 * - Draw a 100-meter geographic radius around every monitored vehicle.
 * - Keep the radius attached to the vehicle as it moves.
 * - Support:
 *      Car
 *      VIP
 *      Police
 *      Fire Engine
 *      Ambulance
 *
 * Important:
 * - This file does NOT create a Leaflet map.
 * - This file does NOT connect to REST.
 * - This file does NOT connect to Socket.IO.
 * - This file does NOT replace monitor.js.
 * - monitor.html will initialize this module later.
 */

(function (window) {
    'use strict';

    const SafePathRadiusAlgorithms = {

        // ------------------------------------------------------------
        // Configuration
        // ------------------------------------------------------------

        RADIUS_METERS: 100,

        // Internal Leaflet map reference.
        map: null,

        // Vehicle radius objects.
        // vehicleId -> {
        //     circle: Leaflet Circle,
        //     vehicleType: string,
        //     latitude: number,
        //     longitude: number
        // }
        vehicleRadii: new Map(),

        // ------------------------------------------------------------
        // Vehicle type normalization
        // ------------------------------------------------------------

        normalizeVehicleType(vehicleType) {
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
        },

        // ------------------------------------------------------------
        // Radius style
        // ------------------------------------------------------------

        getRadiusStyle(vehicleType) {
            const type = this.normalizeVehicleType(vehicleType);

            /*
             * The vehicle marker colors are controlled by Monitor.
             *
             * The radius itself is black for every vehicle as requested.
             */
            return {
                color: '#000000',
                weight: 2,
                opacity: 0.85,
                fillColor: '#000000',
                fillOpacity: 0.03,
                interactive: false,
                bubblingMouseEvents: false
            };
        },

        // ------------------------------------------------------------
        // Validation
        // ------------------------------------------------------------

        isValidCoordinate(latitude, longitude) {
            const lat = Number(latitude);
            const lon = Number(longitude);

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                return false;
            }

            if (lat < -90 || lat > 90) {
                return false;
            }

            if (lon < -180 || lon > 180) {
                return false;
            }

            return true;
        },

        // ------------------------------------------------------------
        // Initialize
        // ------------------------------------------------------------

        initialize(map) {
            if (!map) {
                console.error(
                    '[SafePathRadiusAlgorithms] Leaflet map is required.'
                );

                return false;
            }

            if (typeof L === 'undefined') {
                console.error(
                    '[SafePathRadiusAlgorithms] Leaflet is not loaded.'
                );

                return false;
            }

            this.map = map;

            return true;
        },

        // ------------------------------------------------------------
        // Create radius
        // ------------------------------------------------------------

        createRadius(vehicle) {
            if (!this.map) {
                console.warn(
                    '[SafePathRadiusAlgorithms] Map has not been initialized.'
                );

                return null;
            }

            if (!vehicle) {
                return null;
            }

            const vehicleId = String(
                vehicle.vehicleId ?? vehicle.id ?? ''
            ).trim();

            const latitude = Number(vehicle.latitude);
            const longitude = Number(vehicle.longitude);

            if (!vehicleId) {
                return null;
            }

            if (!this.isValidCoordinate(latitude, longitude)) {
                return null;
            }

            const vehicleType = this.normalizeVehicleType(
                vehicle.vehicleType
            );

            const style = this.getRadiusStyle(vehicleType);

            const circle = L.circle(
                [latitude, longitude],
                {
                    radius: this.RADIUS_METERS,

                    color: style.color,
                    weight: style.weight,
                    opacity: style.opacity,

                    fillColor: style.fillColor,
                    fillOpacity: style.fillOpacity,

                    interactive: style.interactive,
                    bubblingMouseEvents: style.bubblingMouseEvents
                }
            );

            circle.addTo(this.map);

            this.vehicleRadii.set(vehicleId, {
                circle,
                vehicleType,
                latitude,
                longitude
            });

            return circle;
        },

        // ------------------------------------------------------------
        // Update radius
        // ------------------------------------------------------------

        updateVehicle(vehicle) {
            if (!this.map) {
                return;
            }

            if (!vehicle) {
                return;
            }

            const vehicleId = String(
                vehicle.vehicleId ?? vehicle.id ?? ''
            ).trim();

            const latitude = Number(vehicle.latitude);
            const longitude = Number(vehicle.longitude);

            if (!vehicleId) {
                return;
            }

            if (!this.isValidCoordinate(latitude, longitude)) {
                return;
            }

            const vehicleType = this.normalizeVehicleType(
                vehicle.vehicleType
            );

            const existing = this.vehicleRadii.get(vehicleId);

            // --------------------------------------------------------
            // Create new radius if this vehicle does not have one.
            // --------------------------------------------------------

            if (!existing || !existing.circle) {
                this.createRadius({
                    vehicleId,
                    vehicleType,
                    latitude,
                    longitude
                });

                return;
            }

            // --------------------------------------------------------
            // Move existing radius with vehicle.
            // --------------------------------------------------------

            existing.circle.setLatLng([
                latitude,
                longitude
            ]);

            // --------------------------------------------------------
            // Keep radius exactly 100 meters.
            // --------------------------------------------------------

            existing.circle.setRadius(
                this.RADIUS_METERS
            );

            // --------------------------------------------------------
            // Update internal state.
            // --------------------------------------------------------

            existing.vehicleType = vehicleType;
            existing.latitude = latitude;
            existing.longitude = longitude;
        },

        // ------------------------------------------------------------
        // Update all vehicles
        // ------------------------------------------------------------

        updateVehicles(vehicles) {
            if (!Array.isArray(vehicles)) {
                return;
            }

            const activeVehicleIds = new Set();

            vehicles.forEach((vehicle) => {
                if (!vehicle) {
                    return;
                }

                const vehicleId = String(
                    vehicle.vehicleId ?? vehicle.id ?? ''
                ).trim();

                if (!vehicleId) {
                    return;
                }

                const latitude = Number(vehicle.latitude);
                const longitude = Number(vehicle.longitude);

                if (!this.isValidCoordinate(latitude, longitude)) {
                    return;
                }

                activeVehicleIds.add(vehicleId);

                this.updateVehicle(vehicle);
            });

            // Remove radius circles for vehicles no longer present.
            this.vehicleRadii.forEach((entry, vehicleId) => {
                if (!activeVehicleIds.has(vehicleId)) {
                    this.removeVehicle(vehicleId);
                }
            });
        },

        // ------------------------------------------------------------
        // Remove one vehicle radius
        // ------------------------------------------------------------

        removeVehicle(vehicleId) {
            if (!vehicleId) {
                return;
            }

            const id = String(vehicleId).trim();

            const entry = this.vehicleRadii.get(id);

            if (!entry) {
                return;
            }

            if (entry.circle && this.map) {
                this.map.removeLayer(entry.circle);
            }

            this.vehicleRadii.delete(id);
        },

        // ------------------------------------------------------------
        // Clear all radius circles
        // ------------------------------------------------------------

        clear() {
            this.vehicleRadii.forEach((entry) => {
                if (
                    entry &&
                    entry.circle &&
                    this.map
                ) {
                    this.map.removeLayer(entry.circle);
                }
            });

            this.vehicleRadii.clear();
        },

        // ------------------------------------------------------------
        // Get one vehicle radius
        // ------------------------------------------------------------

        getVehicleRadius(vehicleId) {
            if (!vehicleId) {
                return null;
            }

            const entry = this.vehicleRadii.get(
                String(vehicleId).trim()
            );

            if (!entry) {
                return null;
            }

            return entry.circle || null;
        },

        // ------------------------------------------------------------
        // Get all vehicle radii
        // ------------------------------------------------------------

        getAllRadii() {
            return Array.from(
                this.vehicleRadii.entries()
            ).map(([vehicleId, entry]) => {
                return {
                    vehicleId,
                    vehicleType: entry.vehicleType,
                    latitude: entry.latitude,
                    longitude: entry.longitude,
                    radiusMeters: this.RADIUS_METERS,
                    circle: entry.circle
                };
            });
        },

        // ------------------------------------------------------------
        // Get radius information
        // ------------------------------------------------------------

        getRadiusInfo(vehicleId) {
            if (!vehicleId) {
                return null;
            }

            const entry = this.vehicleRadii.get(
                String(vehicleId).trim()
            );

            if (!entry) {
                return null;
            }

            return {
                vehicleId: String(vehicleId).trim(),
                vehicleType: entry.vehicleType,
                latitude: entry.latitude,
                longitude: entry.longitude,
                radiusMeters: this.RADIUS_METERS
            };
        },

        // ------------------------------------------------------------
        // Distance calculation
        //
        // Returns distance in meters between two coordinates.
        //
        // This will also be useful for future radius algorithms.
        // ------------------------------------------------------------

        calculateDistance(
            latitude1,
            longitude1,
            latitude2,
            longitude2
        ) {
            if (
                !this.isValidCoordinate(
                    latitude1,
                    longitude1
                )
            ) {
                return null;
            }

            if (
                !this.isValidCoordinate(
                    latitude2,
                    longitude2
                )
            ) {
                return null;
            }

            const earthRadius = 6371000;

            const lat1 = Number(latitude1) * Math.PI / 180;
            const lat2 = Number(latitude2) * Math.PI / 180;

            const deltaLat =
                (Number(latitude2) - Number(latitude1))
                * Math.PI / 180;

            const deltaLon =
                (Number(longitude2) - Number(longitude1))
                * Math.PI / 180;

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

            return earthRadius * c;
        },

        // ------------------------------------------------------------
        // Check whether a coordinate is inside a vehicle's radius.
        // ------------------------------------------------------------

        isInsideRadius(
            vehicle,
            latitude,
            longitude
        ) {
            if (!vehicle) {
                return false;
            }

            const vehicleLatitude = Number(
                vehicle.latitude
            );

            const vehicleLongitude = Number(
                vehicle.longitude
            );

            const targetLatitude = Number(latitude);
            const targetLongitude = Number(longitude);

            if (
                !this.isValidCoordinate(
                    vehicleLatitude,
                    vehicleLongitude
                )
            ) {
                return false;
            }

            if (
                !this.isValidCoordinate(
                    targetLatitude,
                    targetLongitude
                )
            ) {
                return false;
            }

            const distance = this.calculateDistance(
                vehicleLatitude,
                vehicleLongitude,
                targetLatitude,
                targetLongitude
            );

            if (distance === null) {
                return false;
            }

            return distance <= this.RADIUS_METERS;
        },

        // ------------------------------------------------------------
        // Find vehicles inside another vehicle's 100 m radius.
        //
        // This does NOT generate alerts yet.
        // It only calculates the result.
        // ------------------------------------------------------------

        findVehiclesWithinRadius(
            sourceVehicle,
            vehicles
        ) {
            if (!sourceVehicle) {
                return [];
            }

            if (!Array.isArray(vehicles)) {
                return [];
            }

            const sourceVehicleId = String(
                sourceVehicle.vehicleId ??
                sourceVehicle.id ??
                ''
            ).trim();

            const sourceLatitude = Number(
                sourceVehicle.latitude
            );

            const sourceLongitude = Number(
                sourceVehicle.longitude
            );

            if (
                !this.isValidCoordinate(
                    sourceLatitude,
                    sourceLongitude
                )
            ) {
                return [];
            }

            const nearbyVehicles = [];

            vehicles.forEach((vehicle) => {
                if (!vehicle) {
                    return;
                }

                const vehicleId = String(
                    vehicle.vehicleId ??
                    vehicle.id ??
                    ''
                ).trim();

                if (!vehicleId) {
                    return;
                }

                // Do not compare a vehicle with itself.
                if (
                    sourceVehicleId &&
                    vehicleId === sourceVehicleId
                ) {
                    return;
                }

                const latitude = Number(
                    vehicle.latitude
                );

                const longitude = Number(
                    vehicle.longitude
                );

                if (
                    !this.isValidCoordinate(
                        latitude,
                        longitude
                    )
                ) {
                    return;
                }

                const distance = this.calculateDistance(
                    sourceLatitude,
                    sourceLongitude,
                    latitude,
                    longitude
                );

                if (
                    distance !== null &&
                    distance <= this.RADIUS_METERS
                ) {
                    nearbyVehicles.push({
                        vehicleId,
                        vehicleType:
                            this.normalizeVehicleType(
                                vehicle.vehicleType
                            ),
                        latitude,
                        longitude,
                        distanceMeters: distance
                    });
                }
            });

            nearbyVehicles.sort(
                (a, b) =>
                    a.distanceMeters -
                    b.distanceMeters
            );

            return nearbyVehicles;
        },

        // ------------------------------------------------------------
        // Get number of active radius circles.
        // ------------------------------------------------------------

        getCount() {
            return this.vehicleRadii.size;
        }
    };

    // ------------------------------------------------------------
    // Public global API
    // ------------------------------------------------------------

    window.SafePathRadiusAlgorithms =
        SafePathRadiusAlgorithms;

})(window);