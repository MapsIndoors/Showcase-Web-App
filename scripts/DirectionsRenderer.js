mapsindoors.module('DirectionsRenderer', ['$config', function ($config) {
    var icons = {
        escalator: {
            icon: { url: $config.gfxUrl + 'Escalator20x20.png', anchor: { x: 10, y: 10 } }
        },
        travellator: {
            icon: { url: $config.gfxUrl + 'Travellator20x20.png', anchor: { x: 10, y: 10 } }
        },
        steps: {
            icon: { url: $config.gfxUrl + 'Staircase20x20.png', anchor: { x: 10, y: 10 } }
        },
        elevator: {
            icon: { url: $config.gfxUrl + 'Elevator20x20.png', anchor: { x: 10, y: 10 } }
        },
        start: {
            icon: { url: $config.gfxUrl + 'start_icon.png' }
        },
        end: {
            icon: { url: $config.gfxUrl + 'dest_icon.png' }
        }
    };

    function Leg(opts) {
        //this.markers = {
        //    start: new google.maps.Marker({ visible: false }),
        //    end: new google.maps.Marker({ visible: false })
        //};

        this.paths = [];

        this.add = function (item) {
            item.bindTo('map', this);
            item.bindTo('visible', this);
            this.paths.push(item);
        };

        this.setMap = function (map) {
            this.set('map', map);
        };

        this.getMap = function () {
            return this.get('map');
        };

        this.setVisible = function (visible) {
            this.set('visible', visible === false ? false : true);
        };
        this.setFloor = function (floor) {
            this.set('floor', floor);
        };

        this.getFloor = function () {
            return this.get('floor');
        };

        this.getBounds = function () {
            var bounds = new google.maps.LatLngBounds();
            this.paths.forEach(function (path) {
                path.getPath().forEach(function (latLng) {
                    bounds.extend(latLng);
                });
            });
            return bounds;
        };

        this.setValues(Object.assign({ visible: true }, opts));
    }

    Leg.prototype = new google.maps.MVCObject();

    function dr(opts) {
        var that = this;
        opts.suppressMarkers = opts.suppressMarkers === false ? false : true;

        this._mi = {
            legs: [],
            markers: [],
            styles: new google.maps.MVCObject()
        };

        this._mi.styles.changed = function (key) {
            redraw.call(that);
        };

        this.changed = function (key) {
            switch (key) {
                case 'directions':
                case 'map':
                    draw.call(this);
                    break;
                case 'floor':
                case 'suppressMarkers':
                    redraw.call(this);
                    break;
                case 'legIndex':
                    if (this._mi.legs.length > 0) {
                        redraw.call(this);
                        fitMap.call(this);
                        //google.maps.event.trigger(this, 'leg_changed', this.getLegIndex(), this._mi.legs[this.getLegIndex()].markers.start, this._mi.legs[this.getLegIndex()].markers.end);
                    }
                    break;
                case 'mapsindoors':
                    this.bindTo('map', this.mapsindoors);
                    this.bindTo('floor', this.mapsindoors);
                    break;
            }
        };

        //this.set('suppressMarkers', true);
        this.set('legIndex', -1);
        this.setValues(opts);
    }

    dr.prototype = new google.maps.MVCObject();

    dr.prototype.setDirections = function (directions) {
        this._mi.legs.forEach(function (leg) {
            leg.setMap(null);
        });

        this._mi.legs.clear();
        if (!directions) {
            this.setLegIndex(-1);
        }
        this.set('directions', directions);
    };

    dr.prototype.getDirections = function () {
        return this.get('directions');
    };

    dr.prototype.setStyle = function (type, style) {
        type = type.toLowerCase();
        this._mi.styles.set(type, style);
    };

    dr.prototype.getMap = function () {
        return this.get('map');
    };

    dr.prototype.setLegIndex = function (index) {
        index = Math.max(-1, Math.min(this._mi.legs.length - 1, index));
        this.set('legIndex', index);
    };

    dr.prototype.getLegIndex = function () {
        return this.get('legIndex');
    };

    dr.prototype.nextLeg = function () {
        this.setLegIndex(this.legIndex + 1);
    };

    dr.prototype.previousLeg = function () {
        this.setLegIndex(this.legIndex - 1 > -1 ? this.legIndex - 1 : 0);
    };

    function emptyStyle() {
        return { icons: null, strokeColor: null, strokeOpacity: null, strokeWeight: null, visible: true };
    }

    function draw() {
        if (this.directions && this.getMap() instanceof google.maps.Map) {
            var currentLegIndex = this.getLegIndex(),
                floor = this.mapsindoors.getFloor(),
                map = this.getMap(),
                route;

            route = aggregate(this.directions.routes[0]);
            route.legs.forEach(function (leg, index) {
                this._mi.legs[index] = new Leg({ map: map });
                leg.steps.forEach(function (step) {

                    if (step.highway && icons[step.highway]) {
                        var markerOptions = Object.assign({
                            map: map,
                            position: step.start_location,
                            floor: step.start_location.zLevel,
                            visible: step.start_location.zLevel === floor && !this.get('suppressMarkers')
                        },
                            icons[step.highway]);

                        var marker = new google.maps.Marker(markerOptions);
                        this._mi.markers.push(marker);

                    }
                    var options = {
                        map: map,
                        path: step.geometry || step.path,
                        floor: step.end_location.zLevel || 0,
                        style: (step.highway || step.travel_mode).toLowerCase()
                    };
                    if (currentLegIndex > -1 && index !== currentLegIndex) {
                        Object.assign(options, this._mi.styles.inactive);
                    }
                    else if (options.floor !== floor) {
                        Object.assign(options, this._mi.styles.hidden);
                    } else {
                        Object.assign(options, this._mi.styles[options.style] || this._mi.styles.default);
                    }
                    this._mi.legs[index].setFloor(options.floor);
                    this._mi.legs[index].add(new google.maps.Polyline(options));
                }, this);
            }, this);
            if (this.getLegIndex() > -1) {
                redraw.call(this);
            }
        } else {
            this._mi.markers.forEach(function (marker) {
                marker.setMap(null);
            });
            this._mi.markers = [];
        }
    }

    function redraw() {
        if (this.directions && this.getMap() instanceof google.maps.Map) {
            var currentLegIndex = this.getLegIndex(),
                floor = this.mapsindoors.getFloor();

            this._mi.legs.forEach(function (leg, index) {
                leg.paths.forEach(function (path) {
                    if (currentLegIndex > -1 && index !== currentLegIndex) {
                        path.setOptions(Object.assign(emptyStyle(), this._mi.styles.inactive));
                    }
                    else if (path.floor !== floor) {
                        path.setOptions(Object.assign(emptyStyle(), this._mi.styles.hidden));
                    } else {
                        path.setOptions(Object.assign(emptyStyle(), this._mi.styles[path.style] || this._mi.styles.default));
                    }
                }, this);
            }, this);

            this._mi.markers.forEach(function (marker) {
                marker.setVisible(marker.floor === floor && !this.get('suppressMarkers'));
            }, this);
        }
    }

    function aggregate(route) {
        var segments = [];
        route.legs.forEach(function (leg) {
            //Check if the current leg is a google transit leg
            if (leg._mi && leg._mi.type === 'google.maps.DirectionsLeg' && leg.departure_time) {
                leg.steps.forEach(function (step) {
                    segments.push({ steps: [step] });
                });
            } else {
                var steps = [];
                var lastStep = leg.steps.reduce(function (p, e, i, a) {
                    if (p.highway !== e.highway || p.abutters !== e.abutters) {
                        steps.push(p);
                        return e;
                    } else {
                        return {
                            abutters: e.abutters,
                            distance: { value: p.distance.value + e.distance.value, text: '' },
                            duration: { value: p.duration.value + e.duration.value, text: '' },
                            geometry: (p.geometry || p.path).concat(e.geometry || e.path),
                            start_location: p.start_location,
                            end_location: e.end_location,
                            highway: e.highway,
                            travel_mode: e.travel_mode
                        };
                    }
                });

                steps.push(lastStep);
                segments.push({ start_location: steps[0], end_location: steps.last(), steps: steps });
            }
        });

        route.legs = segments;
        return route;
    }

    function fitMap() {
        if (this.mapsindoors instanceof mapsindoors.MapsIndoors && this.getMap() instanceof google.maps.Map) {
            var map = this.getMap(),
                legIndex = this.getLegIndex(),
                currentLeg = this._mi.legs[legIndex];

            map.fitBounds(currentLeg.getBounds());
            this.mapsindoors.setFloor(currentLeg.floor);

        }
    }

    return dr;
}]);