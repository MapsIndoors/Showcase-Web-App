(function () {
    baseUrl = document.baseURI || (document.getElementsByName('base')[0] || {}).href;
    angular.module('MapsIndoors').directive('directions', directions)
        .factory('directionsData', directionsData);

    function Observable() {
        this.subscribers = [];
    }

    Observable.prototype.subscribe = function (fn) {
        if (Object.typeOf(fn) === 'function') {
            this.subscribers.push(fn);
        }
    };

    Observable.prototype.unsubscribe = function (fn) {
        this.subscribers = this.subscribers.filter(function (item) {
            if (item !== fn) {
                return item;
            }
        });
    };

    Observable.prototype.trigger = function (o) {
        this.subscribers.forEach(function (fn) {
            fn.call(this, o);
        });
    };

    function directionsData() {
        var _self = this,
            isOutside = /^outside/i,
            isInside = /^inside/i,
            geoCoder = new mapsindoors.GeoCodeService();

        var data = new Observable();

        data.get = function (key) {
            return this.values ? this.values[key] : undefined;
        };

        data.set = function (args) {
            var _self = this;
            _self.values = args;
            if (args) {
                var entranceOrExits = [];

                args.totalDistance = 0;
                args.totalDuration = 0;
                args.providers = '';
                args.agencies = [];

                if (args.legs) {
                    var i = 0;
                    args.legs.forEach(function (leg, index, legs) {
                        var prev = index > 0 ? legs[index - 1] : null,
                            next = index < legs.length - 1 ? legs[index + 1] : null;

                        args.totalDistance += leg.distance.value;
                        args.totalDuration += leg.duration.value;

                        if (leg.departure_time) {
                            leg.steps.forEach(function (step, index) {
                                step.index = i;
                                i += 1;

                                if (step.transit && step.transit.line.agencies) {
                                    var agencies = step.transit.line.agencies.map(function (agency) {
                                        if (agency.url) {
                                            var a = document.createElement('a');
                                            a.href = agency.url;

                                            agency.website = a;

                                            return agency;
                                        }
                                    });

                                    args.agencies = args.agencies.concat(agencies);
                                    // if (args.providers.indexOf(step.transit.line.agencies[0].url) === -1) {
                                    //     args.providers += '<a target="_blank" href="' + step.transit.line.agencies[0].url + '">' + step.transit.line.agencies[0].name + '</a>';
                                    // }
                                }
                                if (step.steps && step.steps.length > 0) {
                                    step.steps.forEach(addMissingManeuver);
                                }
                            });
                        } else {
                            leg.steps.forEach(addMissingManeuver);
                            leg.index = i;
                            i += 1;
                        }

                        if (prev && prev._mi.type !== 'mapsindoors.DirectionsLeg' && leg._mi.type === 'mapsindoors.DirectionsLeg') {
                            leg.steps[0].instructions = '<span class="action">Enter:</span>';
                            entranceOrExits.push(leg.steps[0]);
                            return;
                        } else if (prev && prev._mi.type === 'mapsindoors.DirectionsLeg' && leg._mi.type !== 'mapsindoors.DirectionsLeg') {
                            leg.steps[0].instructions = '<span class="action">Exit:</span>';
                            entranceOrExits.push(leg.steps[0]);
                            return;
                        } else if (prev && isInside.test(prev.steps.last().abutters) && leg && isOutside.test(leg.steps[0].abutters)) {
                            leg.steps[0].instructions = '<span class="action">Exit:</span>';
                            entranceOrExits.push(leg.steps[0]);
                            return;
                        } else if (prev && isOutside.test(prev.steps.last().abutters) && leg && isInside.test(leg.steps[0].abutters)) {
                            leg.steps[0].instructions = '<span class="action">Enter:</span>';
                            entranceOrExits.push(leg.steps[0]);
                            return;
                        }

                        if (leg._mi.type === 'mapsindoors.DirectionsLeg') {


                            switch (leg.steps[0].highway) {
                                case 'steps':
                                case 'stairs':
                                    leg.steps[0].instructions = '<span class="action">Stairs: </span>Level ' + leg.start_location.floorName + ' to ' + leg.end_location.floorName;
                                    return;
                                case 'elevator':
                                    leg.steps[0].instructions = '<span class="action">Elevator: </span>Level ' + leg.start_location.floorName + ' to ' + leg.end_location.floorName;
                                    return;
                                default:
                                    return;
                            }
                        }
                    });

                    args.lastIndex = i;

                    geoCoder.reverseGeoCode(entranceOrExits.map(function (step) {
                        return step.start_location.lat + ', ' + step.start_location.lng;
                    })).then(function (results) {
                        entranceOrExits.forEach(function (step, index) {
                            var building = results[index].building || {},
                                venue = results[index].venue || {};

                            step.instructions += ' ' + (building.name || venue.name || 'Building');
                        });
                        _self.trigger(args);
                    });
                }
            }
        };

        return data;

        function addMissingManeuver(step) {
            if (/head|walk/i.test(step.instructions) && step.maneuver === '') {
                step.maneuver = 'straight';
            }

            if (step.highway && (!step.instructions || step.instructions === '')) {
                switch (step.maneuver) {
                    case 'straight':
                        step.instructions = 'Continue straight ahead';
                        break;
                    case 'turn-left':
                        step.instructions = 'Go left and continue';
                        break;
                    case 'turn-right':
                        step.instructions = 'Go right and continue';
                        break;
                    case 'turn-sharp-left':
                        step.instructions = 'Go sharp left and continue';
                        break;
                    case 'turn-sharp-right':
                        step.instructions = 'Go sharp right and continue';
                        break;
                    case 'turn-slight-left':
                        step.instructions = 'Go slight left and continue';
                        break;
                    case 'turn-slight-right':
                        step.instructions = 'Go slight right and continue';
                        break;
                    case 'uturn-left':
                    case 'uturn-right':
                    case 'uturn':
                        step.instructions = 'Turn around and continue';
                        break;
                }
            }
        }
    }





    function directions($timeout, locationsService, venuesService, directionsRenderer, directionsData, mapsIndoors, appConfig, $sce, state) {
        var _cache = {
            types: {}
        },
            endMarker = new google.maps.Marker(),
            startMarker = new google.maps.Marker(),
            colors = {};

        locationsService.getTypes().then(function (types) {
            types.sort(function (a, b) {
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
            }).forEach(function (type) {
                _cache.types[type.name] = type;
            });
        });

        appConfig.get().then(function (result) {
            colors = {
                primary: result.appSettings.primaryColor,
                accent: result.appSettings.accentColor
            };
        });

        google.maps.event.addListener(endMarker, 'click', function () {
            directionsRenderer.nextLeg();
        });

        google.maps.event.addListener(directionsRenderer, 'directions_changed', function () {
            if (!directionsRenderer.getDirections()) {
                startMarker.setMap(null);
                endMarker.setMap(null);
            }
        });

        google.maps.event.addListener(directionsRenderer, 'legindex_changed', function () {
            if (this.getLegIndex() > -1) {
                var i = this.getLegIndex(),
                    legs = this.getDirections().routes[0].legs,
                    map = this.getMap(),
                    draw = new Draw();


                getStartIcon().then(function (icon) {
                    var start_location = legs[i].steps[0].start_location;
                    startMarker.setOptions({
                        icon: {
                            url: icon,
                            anchor: new google.maps.Point(16, 16)
                        },
                        position: start_location,
                        map: map,
                        floor: start_location.zLevel,
                        visible: true
                    });
                }).then(function () {
                    getEndIcon(legs, i).then(function (icon) {
                        var end_location = legs[i].steps.last().end_location;
                        endMarker.setOptions({
                            icon: {
                                url: icon,
                                anchor: new google.maps.Point(16, 16)
                            },
                            position: end_location,
                            map: map,
                            floor: end_location.zLevel,
                            visible: true
                        });
                    });

                });
            }

            function getStartIcon() {
                var isOutside = /^outside/i,
                    isInside = /^inside/i,
                    current,
                    prev,
                    transit;

                if (i < 1) {
                    return draw.icon('start');
                }

                current = legs[i].steps[0];
                prev = (legs[i - 1].steps.last().steps || []).length > 0 ? legs[i - 1].steps.last().steps.last() : legs[i - 1].steps.last();
                transit = current.transit || prev.transit;



                if (isOutside.test(current.abutters) && isInside.test(prev.abutters)) {
                    return draw.icon('exit');
                } else if (isInside.test(current.abutters) && isOutside.test(prev.abutters)) {
                    return draw.icon('enter');
                } else if (current.highway) {
                    return draw.icon(current.highway.toLowerCase());
                } else if (transit) {
                    var src = transit.line.vehicle.local_icon || transit.line.vehicle.icon,
                        img = new Image();

                    img.setAttribute('crossOrigin', 'anonymous');
                    img.src = src;

                    return draw.icon(img);
                }

                return draw.icon();


            }

            function getEndIcon() {
                var isOutside = /^outside/i,
                    isInside = /^inside/i,
                    current,
                    next;

                if (i === legs.length - 1) {
                    return draw.icon('end');
                }

                current = (legs[i].steps.last().steps || []).length > 0 ? legs[i].steps.last().steps.last() : legs[i].steps.last();
                next = (legs[i + 1].steps[0].steps || []).length > 0 ? legs[i + 1].steps[0].steps[0] : legs[i + 1].steps[0];

                transit = next.transit || current.transit;



                if (isOutside.test(current.abutters) && isInside.test(next.abutters)) {
                    return draw.iconWithLabel('enter', 'Next');
                } else if (isInside.test(current.abutters) && isOutside.test(next.abutters)) {
                    return draw.iconWithLabel('exit', 'Next');
                } else if (next.highway) {
                    var highway = next.highway.toLowerCase();
                    if (next.start_location.floor_name && next.end_location.floor_name && next.start_location.floor_name !== next.end_location.floor_name) {
                        return draw.iconWithLabel(highway, 'Level ' + next.start_location.floor_name + ' → Level ' + next.end_location.floor_name);
                    } else {
                        return draw.icon(highway);
                    }
                } else if (transit) {
                    var src = transit.line.vehicle.local_icon || transit.line.vehicle.icon,
                        img = new Image();

                    img.setAttribute('crossOrigin', 'anonymous');
                    img.src = src;

                    return draw.iconWithLabel(img, 'Next');
                }

                return draw.icon();
            }
        });


        function link(scope, element, attrs) {
            var i = scope.$index,
                venues = venuesService,
                draw = new Draw();

            scope.expanded = -1;
            scope.agencyInfoVisible = false;

            scope.$on("$destroy", function handler() {
                directionsData.unsubscribe(updateScope);
            });

            scope.currentIndex = 0;

            //This is to prevents the horizontal panel being empty.
            if (directionsData.get('legs')) {
                updateScope(directionsData.values);
            }

            directionsData.subscribe(updateScope);

            scope.trustAsHtml = function (str) {
                return $sce.trustAsHtml(str);
            };

            scope.durationAsText = function (val) {
                val = Math.max(val, 60);
                var days = Math.floor(val / 86400);
                val = val % 86400;
                var hours = Math.floor(val / 3600);
                val = val % 3600;
                var minutes = Math.floor(val / 60);
                days = days ? days > 1 ? days + ' days' : '1 day' : '';
                hours = hours ? hours > 1 ? hours + ' hours' : '1 hour' : '';
                minutes = minutes ? minutes > 1 ? minutes + ' mins' : '1 min' : '';

                return (days + ' ' + hours + ' ' + minutes).trimLeft(' ');
            };

            scope.distanceAsText = function (val) {
                if (val < 100) {
                    return Math.round(val * 10) / 10 + ' m';
                } else if (val >= 100) {
                    val = val / 1000;
                    return (val <= 100 ? Math.round(val * 10) / 10 : Math.round(val)) + ' km';
                }
            };

            scope.startLabel = function (index) {
                var legs = scope.data.legs;
                if (index === 0) {
                    if (scope.data.start.properties.subtitle) {
                        return scope.data.start.properties.name + ' (' + scope.data.start.properties.subtitle + ')';
                    } else {
                        var startPosition = scope.data.start.properties.name,
                            address = scope.data.start.properties.floorName ? 'Level ' + scope.data.start.properties.floorName : '';
                        address += scope.data.start.properties.building ? ', ' + scope.data.start.properties.building : '';
                        address += scope.data.start.properties.venue ? ', ' + scope.data.start.properties.venue : '';
                        address = address.indexOf(', ') === 0 ? address.substring(2) : address;

                        address = address > '' ? ' (' + address + ')' : '';
                        startPosition += address;

                        return startPosition;
                    }
                }

                if (legs[index]._mi.type === 'google.maps.DirectionsLeg') {
                    return legs[index].start_address;
                }

                switch (legs[index].steps[0].highway) {
                    case 'steps':
                        return 'Stairs level ' + legs[index].end_location.floorName;
                    case 'elevator':
                        return 'Elevator level ' + legs[index].end_location.floorName;
                    default:
                        return '';
                }
            };

            scope.endLabel = function (index) {
                var isOutside = /^outside/i,
                    isInside = /^inside/i,
                    legs = scope.data.legs;

                if (index === scope.endIndex - 1) {
                    if (scope.data.end.properties.subtitle) {
                        return scope.data.end.properties.name + ' (' + scope.data.end.properties.subtitle + ')';
                    } else {
                        var endPosition = scope.data.end.properties.name;
                        address = scope.data.end.properties.floorName ? 'Level ' + scope.data.end.properties.floorName : '';
                        address += scope.data.end.properties.building ? ', ' + scope.data.end.properties.building : '';
                        address += scope.data.end.properties.venue ? ', ' + scope.data.end.properties.venue : '';
                        address = address.indexOf(', ') === 0 ? address.substring(2) : address;

                        address = address > '' ? ' (' + address + ')' : '';
                        endPosition += address;
                        return endPosition;
                    }
                }

                var end = legs[index].steps[0],
                    start = legs[index + 1].steps[0];

                if (legs[indexi]._mi.type === 'google.maps.DirectionsLeg') {
                    return legs[index].end_address;
                }

                switch (legs[index + 1].steps[0].highway) {
                    case 'steps':
                        return 'Stairs level ' + legs[index + 1].start_location.floorName;
                    case 'elevator':
                        return 'Elevator level ' + legs[index + 1].start_location.floorName;
                }

                if (isOutside.test(end.abutters) && isInside.test(start.abutters)) {
                    return 'Walk inside';
                } else if (isOutside.test(start.abutters) && isInside.test(end.abutters)) {
                    return 'Walk outside';
                } else {
                    return '';
                }
            };

            scope.setSegment = function (index) {
                directionsRenderer.setLegIndex(index);
            };

            scope.prevSegment = function () {
                directionsRenderer.previousLeg();
            };

            scope.nextSegment = function () {
                directionsRenderer.nextLeg();
            };

            scope.focusSegment = function () {
                //if (document.getElementById('hnav')) {
                //    var scrollThreshold = window.innerWidth / 2,
                //    scrollPosition = (scope.currentIndex + 1) * 160,
                //    scrollBy = scrollPosition - scrollThreshold;
                //    scrollBy = scrollBy < 0 ? 0 : scrollBy;
                //    document.getElementById('hnav').getElementsByClassName('direction-panel')[0].onresize = function () {
                //        console.log('onresize');
                //    };
                //}
            };

            google.maps.event.addListener(directionsRenderer, 'legindex_changed', function () {
                var currentIndex = this.getLegIndex();
                $timeout(function () {
                    scope.currentIndex = currentIndex;
                    scope.focusSegment();
                });
            });

            function updateScope(args) {
                $timeout(function () {
                    scope.data = args;

                    switch (scope.data.travelMode) {
                        case 'WALKING':
                            scope.ACTION_CLASS = 'WALKING';
                            scope.ACTION_TEXT = 'Walk';
                            scope.ACTION_ICON = $sce.trustAsHtml('&#xE536;');
                            break;
                        case 'DRIVING':
                            scope.ACTION_CLASS = 'DRIVING';
                            scope.ACTION_TEXT = 'Drive';
                            scope.ACTION_ICON = $sce.trustAsHtml('&#xE531');
                            break;
                        case 'BICYCLING':
                            scope.ACTION_CLASS = 'BICYCLING';
                            scope.ACTION_TEXT = 'Ride';
                            scope.ACTION_ICON = $sce.trustAsHtml('&#xE52F;');
                            break;
                        default:
                            scope.ACTION_CLASS = 'WALKING';
                            scope.ACTION_TEXT = 'Walk';
                            scope.ACTION_ICON = $sce.trustAsHtml('&#xE536;');
                            break;
                    }

                    if (scope.data.end) {
                        draw.icon('end').then(function (icon) {
                            scope.endIcon = {
                                'background-image': 'url(' + icon + ')'
                            };
                        });
                    }
                    scope.totalDistance = args.totalDistance;
                    scope.totalDuration = args.totalDuration;
                    scope.providers = args.providers;
                    scope.agencies = args.agencies;
                    scope.endIndex = args.lastIndex;
                });
            }

            scope.toggle = function (i) {
                if (i !== scope.expanded) {
                    ga('send', 'event', 'Directions', 'Expand Directions');
                }
                scope.expanded = i === scope.expanded ? -1 : i;

            };


            scope.showAgencyInfo = function () {
                if (arguments.length > 0) {
                    scope.agencyInfoVisible = arguments[0];
                }
            };
        }

        return {
            restrict: 'E',
            templateUrl: 'directives/directions/directions.tpl.html',
            scope: {
                legs: '=',
                travelMode: '='
            },
            link: link
        };

        function TravelMode(legs) {
            return {
                current: function (i) {
                    if (legs[i].steps[0].travel_mode) {
                        return legs[i].steps[0].travel_mode;
                    }
                }
            };
        }

        function Draw() {
            var center = {
                x: 16,
                y: 16
            };

            return {
                icon: function (icon) {
                    return newCanvas().then(drawBackground).then(drawIcon(icon)).then(crop).then(toImage);
                },
                iconWithLabel: function (icon, label) {
                    return newCanvas().then(drawLabel(label)).then(drawBackground).then(drawIcon(icon)).then(crop).then(toImage);
                }
            };

            function newCanvas() {
                return new Promise(function (resolve, reject) {
                    var canvas = document.createElement('canvas'),
                        ctx = canvas.getContext('2d');

                    canvas.height = center.y * 2;

                    resolve(ctx);
                });
            }

            function crop(ctx) {
                return new Promise(function (resolve, reject) {
                    var canvas = ctx.canvas,
                        height = canvas.height,
                        width = canvas.width,
                        pixels = {
                            x: [],
                            y: []
                        },
                        i = 0,
                        image = ctx.getImageData(0, 0, width, height);

                    for (var y = 0; y < height; y++) {
                        for (var x = 0; x < width; x++) {
                            i = (y * width + x) * 4;
                            if (image.data[i + 3] > 0) {
                                pixels.x.push(x);
                                pixels.y.push(y);
                            }
                        }
                    }

                    pixels.x.sort(function (a, b) {
                        return a - b;
                    });
                    pixels.y.sort(function (a, b) {
                        return a - b;
                    });

                    width = pixels.x.last() - pixels.x[0] + 1;
                    height = pixels.y.last() - pixels.y[0] + 1;

                    image = ctx.getImageData(pixels.x[0], pixels.y[0], width, height);
                    canvas.width = width;
                    canvas.height = height;

                    ctx.putImageData(image, 0, 0);

                    resolve(ctx);

                });
            }

            function toImage(ctx) {
                return new Promise(function (resolve, reject) {
                    resolve(ctx.canvas.toDataURL('image/png'));
                });
            }

            function drawBackground(ctx) {
                return new Promise(function (resolve, reject) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.fillStyle = '#fff';
                    ctx.arc(16, 16, 12, 0, 2 * Math.PI, false);
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = colors.primary;
                    ctx.stroke();
                    ctx.restore();
                    resolve(ctx);
                });
            }

            function drawLabel(label) {
                return function (ctx) {
                    return new Promise(function (resolve, reject) {
                        var measurement;

                        ctx.save();
                        ctx.textBaseline = 'middle';
                        ctx.font = '12px Roboto';
                        measurement = ctx.measureText(label);
                        ctx.beginPath();
                        ctx.fillStyle = colors.accent;
                        ctx.arc(40 + measurement.width, center.y, 9.5, 0, 2 * Math.PI, false);
                        ctx.rect(center.x, 6.5, 24 + measurement.width, 19);
                        ctx.fill();
                        ctx.fillStyle = '#fff';
                        ctx.fillText(label, 36, 16);
                        ctx.restore();
                        resolve(ctx);
                    });
                };
            }

            function drawIcon(icon) {
                return function (ctx) {
                    if (icon instanceof Image) {
                        return fromUrl(icon.src, ctx);
                    }

                    switch (icon) {
                        case '':
                        case 'start':
                            return fromCharCode('', ctx);
                        case 'steps':
                        case 'stairs':
                            return fromCharCode('0xE900', ctx);
                        case 'enter':
                            return fromCharCode('0xE902', ctx);
                        case 'exit':
                            return fromCharCode('0xE904', ctx);
                        case 'lift':
                        case 'elevator':
                            return fromCharCode('0xE90b', ctx);
                        case 'escalator':
                            return fromCharCode('0xE903', ctx);
                        case 'end':
                            return fromCharCode('0xE901', ctx, {
                                size: '26px',
                                color: colors.primary
                            });
                        default:
                            return fromCharCode('', ctx);

                    }
                };

                function fromCharCode(charCode, ctx, opts) {
                    var defaults = {
                        color: '#000',
                        size: '12px'
                    };

                    opts = Object.assign({}, defaults, opts);

                    return new Promise(function (resolve, reject) {
                        ctx.save();
                        ctx.fillStyle = opts.color;
                        ctx.font = opts.size + ' "MapsIndoors Icons"';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = "middle";
                        ctx.fillText(String.fromCharCode(charCode), center.x, center.y);
                        ctx.restore();
                        resolve(ctx);
                    });
                }

                function fromUrl(url, ctx) {
                    return new Promise(function (resolve, reject) {
                        var img = new Image();
                        img.setAttribute('crossOrigin', 'anonymous');
                        img.onload = function () {
                            var height = img.width > 20 ? img.height / img.width * 20 : img.height,
                                width = img.width > 20 ? 20 : img.width;
                            ctx.save();
                            ctx.drawImage(img, 0, 0, img.width, img.height, center.x - width / 2, center.y - height / 2, width, height);
                            ctx.restore();
                            resolve(ctx);
                        };

                        img.onerror = reject;

                        img.src = url;
                    });
                }
            }
        }
    }
})();