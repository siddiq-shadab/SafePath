/*
 * SafePath
 * Speed Analysis Algorithm
 *
 * File:
 * D:\Sec\safe_path_nodejs\display\algorithm\speedalgorithm.js
 *
 * Purpose:
 * - Monitor speed ONLY for Car vehicles.
 * - Ignore VIP, Police, Fire Engine and Ambulance.
 * - Trigger when a Car crosses above 30 km/h.
 * - Show a safety warning popup.
 * - Start a 10-second countdown.
 * - After countdown, issue a demo ₹100 fine.
 *
 * Trigger:
 *
 *   Car <= 30 km/h
 *          |
 *          | crosses above 30 km/h
 *          v
 *   Speed Warning Popup
 *          |
 *          v
 *   10 -> 9 -> 8 -> ... -> 1
 *          |
 *          v
 *   ₹100 Fine
 *
 * Important:
 * - This file does NOT connect to REST.
 * - This file does NOT connect to Socket.IO.
 * - This file does NOT create a Leaflet map.
 * - This file does NOT modify monitor.js.
 * - monitor.html will connect this module later.
 */

(function (window) {
    'use strict';

    // ================================================================
    // Configuration
    // ================================================================

    const SPEED_LIMIT_KMH = 30;

    const FINE_AMOUNT = 100;

    const COUNTDOWN_SECONDS = 10;

    const CAR_TYPE = 'Car';

    // ================================================================
    // Internal state
    // ================================================================

    /*
     * Vehicle state:
     *
     * vehicleId -> {
     *     vehicleId,
     *     vehicleType,
     *     speed,
     *     previousSpeed,
     *     aboveLimit,
     *     violationActive
     * }
     */
    const vehicles = new Map();

    /*
     * Active countdowns:
     *
     * vehicleId -> {
     *     vehicleId,
     *     remainingSeconds,
     *     timer,
     *     speed,
     *     startedAt
     * }
     */
    const activeCountdowns = new Map();

    /*
     * Fine records.
     */
    const issuedFines = new Map();

    /*
     * Popup DOM element.
     *
     * Only one speed popup is displayed at a time.
     */
    let popupElement = null;

    /*
     * Currently displayed vehicle.
     */
    let popupVehicleId = null;

    /*
     * Optional callbacks.
     */
    let violationStartCallback = null;
    let fineIssuedCallback = null;
    let violationCloseCallback = null;

    // ================================================================
    // Vehicle type normalization
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

    // ================================================================
    // Vehicle helpers
    // ================================================================

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

    function getVehicleSpeed(vehicle) {
        if (!vehicle) {
            return null;
        }

        const speed = Number(
            vehicle.speed
        );

        if (!Number.isFinite(speed)) {
            return null;
        }

        return speed;
    }

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

    // ================================================================
    // Popup creation
    // ================================================================

    function createPopup() {
        if (popupElement) {
            return popupElement;
        }

        const popup =
            document.createElement('div');

        popup.className =
            'safepath-speed-popup';

        popup.setAttribute(
            'role',
            'alert'
        );

        popup.setAttribute(
            'aria-live',
            'assertive'
        );

        popup.innerHTML = `
            <div class="safepath-speed-popup__card">

                <div class="safepath-speed-popup__header">
                    <div class="safepath-speed-popup__warning-icon">
                        ⚠
                    </div>

                    <div class="safepath-speed-popup__title">
                        Speed Warning
                    </div>
                </div>

                <div class="safepath-speed-popup__message">
                    Slowing down right now helps you stay safe
                    and prevents a traffic ticket
                </div>

                <div class="safepath-speed-popup__vehicle">
                    <div class="safepath-speed-popup__vehicle-label">
                        Vehicle
                    </div>

                    <div
                        class="safepath-speed-popup__vehicle-id"
                        data-speed-vehicle-id>
                        —
                    </div>
                </div>

                <div class="safepath-speed-popup__speed">
                    <span>Speed</span>
                    <strong data-speed-value>— km/h</strong>
                </div>

                <div class="safepath-speed-popup__countdown-container">

                    <div class="safepath-speed-popup__countdown-label">
                        Slow down now
                    </div>

                    <div
                        class="safepath-speed-popup__countdown"
                        data-speed-countdown>
                        10
                    </div>

                    <div class="safepath-speed-popup__countdown-unit">
                        seconds
                    </div>

                </div>

                <div
                    class="safepath-speed-popup__fine"
                    data-speed-fine>
                    ₹100 fine
                </div>

                <button
                    type="button"
                    class="safepath-speed-popup__close"
                    data-speed-close>
                    Close
                </button>

            </div>
        `;

        document.body.appendChild(
            popup
        );

        popupElement = popup;

        const closeButton =
            popup.querySelector(
                '[data-speed-close]'
            );

        if (closeButton) {
            closeButton.addEventListener(
                'click',
                () => {
                    closePopup();
                }
            );
        }

        return popup;
    }

    // ================================================================
    // Popup elements
    // ================================================================

    function getPopupElement(
        selector
    ) {
        if (!popupElement) {
            return null;
        }

        return popupElement.querySelector(
            selector
        );
    }

    // ================================================================
    // Popup update
    // ================================================================

    function updatePopup(
        vehicleId,
        speed,
        remainingSeconds
    ) {
        const popup =
            createPopup();

        const vehicleIdElement =
            getPopupElement(
                '[data-speed-vehicle-id]'
            );

        const speedElement =
            getPopupElement(
                '[data-speed-value]'
            );

        const countdownElement =
            getPopupElement(
                '[data-speed-countdown]'
            );

        if (vehicleIdElement) {
            vehicleIdElement.textContent =
                vehicleId;
        }

        if (speedElement) {
            speedElement.textContent =
                `${speed.toFixed(1)} km/h`;
        }

        if (countdownElement) {
            countdownElement.textContent =
                String(
                    remainingSeconds
                );
        }
    }

    // ================================================================
    // Show popup
    // ================================================================

    function showPopup(
        vehicleId,
        speed,
        remainingSeconds
    ) {
        const popup =
            createPopup();

        popupVehicleId =
            vehicleId;

        updatePopup(
            vehicleId,
            speed,
            remainingSeconds
        );

        popup.classList.add(
            'safepath-speed-popup--visible'
        );
    }

    // ================================================================
    // Hide popup
    // ================================================================

    function hidePopup() {
        if (!popupElement) {
            return;
        }

        popupElement.classList.remove(
            'safepath-speed-popup--visible'
        );

        popupVehicleId = null;
    }

    // ================================================================
    // Close popup
    // ================================================================

    function closePopup() {
        const vehicleId =
            popupVehicleId;

        hidePopup();

        if (
            vehicleId &&
            typeof violationCloseCallback ===
            'function'
        ) {
            try {
                violationCloseCallback({
                    vehicleId
                });
            } catch (error) {
                console.error(
                    '[SafePathSpeedAlgorithms] Close callback error:',
                    error
                );
            }
        }
    }

    // ================================================================
    // Start violation
    // ================================================================

    function startViolation(
        vehicle
    ) {
        if (!vehicle) {
            return;
        }

        /*
         * VERY IMPORTANT:
         *
         * Speed algorithm applies ONLY to Car.
         *
         * VIP, Police, Fire Engine and Ambulance
         * are completely ignored.
         */
        if (!isCar(vehicle)) {
            return;
        }

        const vehicleId =
            getVehicleId(vehicle);

        const speed =
            getVehicleSpeed(vehicle);

        if (!vehicleId) {
            return;
        }

        if (
            speed === null ||
            speed <= SPEED_LIMIT_KMH
        ) {
            return;
        }

        /*
         * Do not start another countdown if
         * this vehicle already has one.
         */
        if (
            activeCountdowns.has(
                vehicleId
            )
        ) {
            return;
        }

        const vehicleState =
            vehicles.get(
                vehicleId
            );

        if (
            vehicleState &&
            vehicleState.violationActive
        ) {
            return;
        }

        /*
         * Mark violation active.
         */
        if (vehicleState) {
            vehicleState.violationActive =
                true;
        }

        const countdownState = {
            vehicleId,

            remainingSeconds:
                COUNTDOWN_SECONDS,

            timer: null,

            speed,

            startedAt:
                new Date().toISOString()
        };

        activeCountdowns.set(
            vehicleId,
            countdownState
        );

        /*
         * Show initial popup at 10.
         */
        showPopup(
            vehicleId,
            speed,
            COUNTDOWN_SECONDS
        );

        if (
            typeof violationStartCallback ===
            'function'
        ) {
            try {
                violationStartCallback({
                    vehicleId,
                    vehicleType: 'Car',
                    speed,
                    speedLimit:
                        SPEED_LIMIT_KMH,
                    countdown:
                        COUNTDOWN_SECONDS,
                    startedAt:
                        countdownState.startedAt
                });
            } catch (error) {
                console.error(
                    '[SafePathSpeedAlgorithms] Violation start callback error:',
                    error
                );
            }
        }

        /*
         * Start countdown.
         */
        countdownState.timer =
            window.setInterval(
                () => {
                    tickCountdown(
                        vehicleId
                    );
                },
                1000
            );
    }

    // ================================================================
    // Countdown
    // ================================================================

    function tickCountdown(
        vehicleId
    ) {
        const countdown =
            activeCountdowns.get(
                vehicleId
            );

        if (!countdown) {
            return;
        }

        countdown.remainingSeconds -=
            1;

        /*
         * Update popup only if this is
         * the currently displayed vehicle.
         */
        if (
            popupVehicleId ===
            vehicleId
        ) {
            updatePopup(
                vehicleId,
                countdown.speed,
                Math.max(
                    countdown.remainingSeconds,
                    0
                )
            );
        }

        /*
         * Countdown completed.
         */
        if (
            countdown.remainingSeconds <=
            0
        ) {
            issueFine(
                vehicleId
            );
        }
    }

    // ================================================================
    // Issue fine
    // ================================================================

    function issueFine(
        vehicleId
    ) {
        const countdown =
            activeCountdowns.get(
                vehicleId
            );

        if (!countdown) {
            return;
        }

        /*
         * Stop countdown timer.
         */
        if (
            countdown.timer !== null
        ) {
            window.clearInterval(
                countdown.timer
            );

            countdown.timer = null;
        }

        /*
         * Store fine record.
         */
        const fineRecord = {
            vehicleId,

            vehicleType: 'Car',

            fineAmount:
                FINE_AMOUNT,

            currency: 'INR',

            reason:
                'Speed above 30 km/h',

            speed:
                countdown.speed,

            speedLimit:
                SPEED_LIMIT_KMH,

            issuedAt:
                new Date().toISOString()
        };

        issuedFines.set(
            vehicleId,
            fineRecord
        );

        /*
         * Update popup.
         */
        if (
            popupVehicleId ===
            vehicleId
        ) {
            const countdownElement =
                getPopupElement(
                    '[data-speed-countdown]'
                );

            const fineElement =
                getPopupElement(
                    '[data-speed-fine]'
                );

            if (countdownElement) {
                countdownElement.textContent =
                    '0';
            }

            if (fineElement) {
                fineElement.textContent =
                    '₹100 fine issued';
            }

            if (popupElement) {
                popupElement.classList.add(
                    'safepath-speed-popup--fine-issued'
                );
            }
        }

        if (
            typeof fineIssuedCallback ===
            'function'
        ) {
            try {
                fineIssuedCallback(
                    fineRecord
                );
            } catch (error) {
                console.error(
                    '[SafePathSpeedAlgorithms] Fine callback error:',
                    error
                );
            }
        }

        /*
         * The violation remains recorded.
         *
         * Remove the countdown because it is complete.
         */
        activeCountdowns.delete(
            vehicleId
        );

        /*
         * Mark the vehicle violation as
         * completed but still active until
         * its speed drops back to <= 30 km/h.
         */
        const vehicleState =
            vehicles.get(
                vehicleId
            );

        if (vehicleState) {
            vehicleState.violationActive =
                true;

            vehicleState.fineIssued =
                true;
        }
    }

    // ================================================================
    // Process one vehicle update
    // ================================================================

    function updateVehicle(
        vehicle
    ) {
        if (!vehicle) {
            return;
        }

        const vehicleId =
            getVehicleId(vehicle);

        if (!vehicleId) {
            return;
        }

        const vehicleType =
            normalizeVehicleType(
                vehicle.vehicleType
            );

        const speed =
            getVehicleSpeed(vehicle);

        /*
         * ------------------------------------------------------------
         * ONLY CAR
         * ------------------------------------------------------------
         *
         * Explicitly ignore:
         *
         * VIP
         * Police
         * Fire Engine
         * Ambulance
         */
        if (
            vehicleType !==
            CAR_TYPE
        ) {
            return;
        }

        if (speed === null) {
            return;
        }

        const previousState =
            vehicles.get(
                vehicleId
            );

        const previousSpeed =
            previousState
                ? previousState.speed
                : null;

        const previousAboveLimit =
            previousState
                ? previousState.aboveLimit
                : false;

        const currentAboveLimit =
            speed >
            SPEED_LIMIT_KMH;

        /*
         * Store current state.
         */
        const state = {
            ...vehicle,

            vehicleId,

            vehicleType: CAR_TYPE,

            speed,

            previousSpeed,

            aboveLimit:
                currentAboveLimit,

            violationActive:
                previousState
                    ? previousState.violationActive
                    : false,

            fineIssued:
                previousState
                    ? previousState.fineIssued
                    : false
        };

        vehicles.set(
            vehicleId,
            state
        );

        /*
         * ------------------------------------------------------------
         * Trigger only when the Car CROSSes
         * from <=30 to >30 km/h.
         * ------------------------------------------------------------
         */
        if (
            currentAboveLimit &&
            !previousAboveLimit
        ) {
            startViolation(
                state
            );
        }

        /*
         * ------------------------------------------------------------
         * When Car returns to <=30 km/h,
         * reset the violation state.
         *
         * This allows a new violation later.
         * ------------------------------------------------------------
         */
        if (
            !currentAboveLimit
        ) {
            resetViolationState(
                vehicleId
            );
        }
    }

    // ================================================================
    // Update all vehicles
    // ================================================================

    function updateVehicles(
        vehicleList
    ) {
        if (
            !Array.isArray(
                vehicleList
            )
        ) {
            return;
        }

        const currentCarIds =
            new Set();

        vehicleList.forEach(
            (vehicle) => {
                if (!vehicle) {
                    return;
                }

                const vehicleId =
                    getVehicleId(
                        vehicle
                    );

                if (!vehicleId) {
                    return;
                }

                const vehicleType =
                    normalizeVehicleType(
                        vehicle.vehicleType
                    );

                /*
                 * Only store Cars.
                 *
                 * Emergency vehicles are ignored
                 * by this algorithm.
                 */
                if (
                    vehicleType !==
                    CAR_TYPE
                ) {
                    return;
                }

                currentCarIds.add(
                    vehicleId
                );

                updateVehicle(
                    vehicle
                );
            }
        );

        /*
         * Remove Cars that disappeared
         * from the current fleet.
         */
        vehicles.forEach(
            (
                vehicle,
                vehicleId
            ) => {
                if (
                    !currentCarIds.has(
                        vehicleId
                    )
                ) {
                    stopCountdown(
                        vehicleId
                    );

                    vehicles.delete(
                        vehicleId
                    );
                }
            }
        );
    }

    // ================================================================
    // Reset violation
    // ================================================================

    function resetViolationState(
        vehicleId
    ) {
        const state =
            vehicles.get(
                vehicleId
            );

        if (!state) {
            return;
        }

        /*
         * If a countdown is currently running,
         * do not cancel it merely because the
         * latest speed packet temporarily dropped.
         *
         * The warning countdown represents the
         * violation event that already started.
         */
        if (
            activeCountdowns.has(
                vehicleId
            )
        ) {
            return;
        }

        state.violationActive =
            false;

        state.aboveLimit =
            false;

        state.fineIssued =
            false;
    }

    // ================================================================
    // Stop countdown
    // ================================================================

    function stopCountdown(
        vehicleId
    ) {
        const countdown =
            activeCountdowns.get(
                vehicleId
            );

        if (!countdown) {
            return;
        }

        if (
            countdown.timer !== null
        ) {
            window.clearInterval(
                countdown.timer
            );

            countdown.timer = null;
        }

        activeCountdowns.delete(
            vehicleId
        );

        if (
            popupVehicleId ===
            vehicleId
        ) {
            hidePopup();
        }
    }

    // ================================================================
    // Remove vehicle
    // ================================================================

    function removeVehicle(
        vehicleId
    ) {
        if (!vehicleId) {
            return;
        }

        const id =
            String(
                vehicleId
            ).trim();

        stopCountdown(
            id
        );

        vehicles.delete(
            id
        );
    }

    // ================================================================
    // Clear algorithm
    // ================================================================

    function clear() {
        /*
         * Stop all countdown timers.
         */
        activeCountdowns.forEach(
            (
                countdown
            ) => {
                if (
                    countdown.timer !==
                    null
                ) {
                    window.clearInterval(
                        countdown.timer
                    );
                }
            }
        );

        activeCountdowns.clear();

        vehicles.clear();

        issuedFines.clear();

        hidePopup();
    }

    // ================================================================
    // Initialize
    // ================================================================

    function initialize(
        options = {}
    ) {
        if (
            typeof options.onViolationStart ===
            'function'
        ) {
            violationStartCallback =
                options.onViolationStart;
        }

        if (
            typeof options.onFineIssued ===
            'function'
        ) {
            fineIssuedCallback =
                options.onFineIssued;
        }

        if (
            typeof options.onViolationClose ===
            'function'
        ) {
            violationCloseCallback =
                options.onViolationClose;
        }

        createPopup();

        hidePopup();

        return true;
    }

    // ================================================================
    // Public API
    // ================================================================

    const SafePathSpeedAlgorithms = {

        initialize,

        updateVehicle,

        updateVehicles,

        removeVehicle,

        clear,

        isCar,

        normalizeVehicleType,

        getSpeedLimit() {
            return SPEED_LIMIT_KMH;
        },

        getFineAmount() {
            return FINE_AMOUNT;
        },

        getCountdownSeconds() {
            return COUNTDOWN_SECONDS;
        },

        getVehicle(
            vehicleId
        ) {
            if (!vehicleId) {
                return null;
            }

            return (
                vehicles.get(
                    String(
                        vehicleId
                    ).trim()
                ) || null
            );
        },

        getVehicles() {
            return Array.from(
                vehicles.values()
            );
        },

        getActiveCountdown(
            vehicleId
        ) {
            if (!vehicleId) {
                return null;
            }

            return (
                activeCountdowns.get(
                    String(
                        vehicleId
                    ).trim()
                ) || null
            );
        },

        getActiveCountdowns() {
            return Array.from(
                activeCountdowns.values()
            );
        },

        getIssuedFine(
            vehicleId
        ) {
            if (!vehicleId) {
                return null;
            }

            return (
                issuedFines.get(
                    String(
                        vehicleId
                    ).trim()
                ) || null
            );
        },

        getIssuedFines() {
            return Array.from(
                issuedFines.values()
            );
        },

        hasActiveViolation(
            vehicleId
        ) {
            if (!vehicleId) {
                return false;
            }

            const id =
                String(
                    vehicleId
                ).trim();

            return activeCountdowns.has(
                id
            );
        },

        showSpeedPopup(
            vehicleId,
            speed
        ) {
            showPopup(
                String(
                    vehicleId
                ),
                Number(speed),
                COUNTDOWN_SECONDS
            );
        },

        closeSpeedPopup() {
            closePopup();
        },

        setViolationStartCallback(
            callback
        ) {
            violationStartCallback =
                typeof callback ===
                'function'
                    ? callback
                    : null;
        },

        setFineIssuedCallback(
            callback
        ) {
            fineIssuedCallback =
                typeof callback ===
                'function'
                    ? callback
                    : null;
        },

        setViolationCloseCallback(
            callback
        ) {
            violationCloseCallback =
                typeof callback ===
                'function'
                    ? callback
                    : null;
        }
    };

    // ================================================================
    // Global export
    // ================================================================

    window.SafePathSpeedAlgorithms =
        SafePathSpeedAlgorithms;

})(window);