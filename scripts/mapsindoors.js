(function () {
    angular.module('MapsIndoors')
        .factory('mapsIndoors', mapsIndoors)
        .factory('directionsRenderer', directionsRenderer)
        .factory('appConfig', appConfig)
        .factory('locationsService', locationsService)
        .factory('geoCodeService', geoCodeService)
        .factory('venuesService', venuesService)
        .factory('returnToVenue', returnToVenue)
        .factory('zoomForMoreDetails', zoomForMoreDetails)
        .factory('state', appState)
        .factory('floorSelector', floorSelector);

    function mapsIndoors($routeParams, $rootScope, $compile, googleMap, state, infoWindow, $http, venuesService) {
        mapsindoors.locale.setLanguage((navigator.language || navigator.userLanguage).substr(0, 2));
        var mapsIndoors = new mapsindoors.MapsIndoors({
            map: googleMap,
            buildingOutlineOptions: {
                visible: true,
                strokeWeight: 3,
                strokeColor: '#43aaa0',
                fillOpacity: 0,
                clickable: false
            }
        });

        init();

        google.maps.event.addListener(mapsIndoors, 'location_click', function (location) {
            var content;
            mapsIndoors.clear();

            if (!$routeParams.venue) {
                venuesService.getVenues().then(function (venues) {
                    var venue = venues.find(function (venue) {
                        return venue.name === location.properties.venueId;
                    });

                    if (venue) {
                        location.properties.venueId = venue.id;
                        openInfoWindow(location);
                    }
                });
            } else {
                location.properties.venueId = $routeParams.venue;
                openInfoWindow(location);
            }

            ga('send', 'event', 'Locations', 'Poi on map clicked', location.properties.name);
            ga('send', 'event', 'Locations', 'Map zoom level', googleMap.getZoom());

            // $rootScope.$apply();

            function openInfoWindow(venueId) {
                if (state.mode === 'navigating') {
                    content = '<div class="infowindow"><b>' + location.properties.name + '</b></div>';
                } else {
                    content = '<div class="infowindow"><a ng-click="goto(\'' + location.properties.venueId + '/details/' + location.id + '\')"><b>' + location.properties.name + '</b></a></div>';
                }

                content = $compile(content)($rootScope);

                infoWindow.setContent(content[0]);
                infoWindow.setPosition({ lat: location.geometry.coordinates[1], lng: location.geometry.coordinates[0] });
                infoWindow.open(googleMap);
            }
        });

        google.maps.event.addListener(mapsIndoors, 'floor_changed', function (index) {
            ga('send', 'event', 'Floor selector', 'Floor changed', mapsIndoors.getFloor());
        });

        return mapsIndoors;

        function init() {
            var controls = document.getElementById('mi-controls');
            if (controls) {
                googleMap.controls[google.maps.ControlPosition.TOP_CENTER].push(controls);
            }
        }
    }

    function directionsRenderer(mapsIndoors) {
        var dr = new mapsindoors.DirectionsRenderer({
            mapsindoors: mapsIndoors
        });
        dr.setStyle('default', {
            strokeOpacity: 1,
            strokeWeight: 6,
            strokeColor: '#90CAF9'
        });

        dr.setStyle('hidden', {
            strokeOpacity: 0.1875,
            strokeColor: 'rgb(33,150,243)'
        });

        dr.setStyle('inactive', {
            visible: false
        });

        return dr;
    }

    function appConfig() {
        var service = new mapsindoors.AppConfigService(),
            appConfig;

        return {
            get: get
        };

        function get() {
            if (!appConfig) {
                appConfig = service.getAppConfig().then(function (appConfig) {
                    appConfig.appSettings.primaryColor = prepend(appConfig.appSettings.primaryColor || '2196F3', '#');
                    appConfig.appSettings.accentColor = prepend(appConfig.appSettings.accentColor || 'F44336', '#');
                    appConfig.appSettings.title = appConfig.appSettings.title || "MapsIndoors";
                    appConfig.appSettings.displayAliases = JSON.parse(appConfig.appSettings.displayAliases || false);
                    return appConfig;
                });
            }

            return appConfig;
        }

        function prepend(str, char) {
            return str[0] !== char ? char + str : str;
        }
    }

    function locationsService() {
        return new mapsindoors.LocationsService();
    }

    function venuesService(appConfig) {
        var service = new mapsindoors.VenuesService(),
            venues = {},
            getVenuesPromise;

        return {
            getBuildings: getBuildings,
            getVenues: getVenues,
            getVenue: getVenue
        };

        function getBuildings() {
            return service.getBuildings();
        }


        function getVenues() {
            if (!getVenuesPromise) {
                getVenuesPromise = new Promise(function (resolve, reject) {
                    $.when(service.getVenues(), appConfig.get()).then(function (venues, appConfig) {
                        venues.forEach(function (venue) {
                            var center = [].concat(venue.anchor.coordinates).reverse();
                            venue.image = appConfig.venueImages[venue.name.toLowerCase()] || ['https://maps.googleapis.com/maps/api/staticmap?center=', center, '&size=400x220&zoom=14&style=feature:all|saturation:-80&style=feature:poi|visibility:off&key=AIzaSyCrk6QMTzO0LhPDfv36Ko5RCXWPER_5o8o'].join("");
                        });

                        resolve(venues);
                    }, reject);
                });
            }
            return getVenuesPromise;
        }

        function getVenue(id) {
            if (!venues[id]) {
                venues[id] = $.when(service.getVenue(id), appConfig.get()).then(function (venue, appConfig) {
                    var center = [].concat(venue.anchor.coordinates).reverse();
                    venue.image = appConfig.venueImages[venue.name.toLowerCase()] || ['https://maps.googleapis.com/maps/api/staticmap?center=', center, '&size=400x220&zoom=14&style=feature:all|saturation:-80&style=feature:poi|visibility:off&key=AIzaSyCrk6QMTzO0LhPDfv36Ko5RCXWPER_5o8o'].join("");

                    return venue;
                });
            }
            return venues[id];
        }
    }

    function appState(venuesService, $routeParams) {
        var venue;

        return {
            getVenue: function () {
                return $.when(venue || venuesService.getVenue($routeParams.venue).then(function (result) {
                    venue = result;
                    return result;
                }));
            },
            setVenue: function () {
                if (arguments[0].id && arguments[0].id.length === 24) {
                    venue = arguments[0];
                }
            }
        };
    }

    function geoCodeService() {
        return new mapsindoors.GeoCodeService();
    }

    function returnToVenue(mapsIndoors, googleMap) {
        var $this = this;
        $this.container = document.getElementById('return-to-venue');
        $this.disabled = false;

        google.maps.event.addDomListener($this.container.firstChild, 'click', function () {
            if ($this.location) {
                googleMap.setCenter({
                    lat: $this.location.geometry.coordinates[1],
                    lng: $this.location.geometry.coordinates[0]
                });
            } else {
                mapsIndoors.fitVenue();
            }
        });

        google.maps.event.addListener(mapsIndoors, 'venue_changed', function () {
            $this.venue = mapsIndoors.getVenue();
            if ($this.venue) {
                var bounds = {
                    east: -180,
                    north: -90,
                    south: 90,
                    west: 180
                };
                $this.venue.geometry.coordinates.reduce(function (bounds, ring) {
                    ring.reduce(function (bounds, coords) {
                        bounds.east = coords[0] >= bounds.east ? coords[0] : bounds.east;
                        bounds.west = coords[0] <= bounds.west ? coords[0] : bounds.west;
                        bounds.north = coords[1] >= bounds.north ? coords[1] : bounds.north;
                        bounds.south = coords[1] <= bounds.south ? coords[1] : bounds.south;
                        return bounds;
                    }, bounds);
                    return bounds;
                }, bounds);

                $this.container.firstChild.innerText = 'Return to ' + $this.venue.venueInfo.name;
                $this.bbox = bounds;

                evaluate();
            }
        });

        google.maps.event.addListener(googleMap, 'idle', evaluate);

        return {
            disable: function () {
                $this.disabled = true;
                $this.container.style.display = 'none';
            },
            enable: function () {
                $this.disabled = false;
            },
            setLocation: function (location) {
                $this.location = location;
                if ($this.location) {
                    $this.container.firstChild.innerText = 'Return to ' + $this.location.properties.name;
                } else {
                    $this.container.firstChild.innerText = 'Return to ' + $this.venue.venueInfo.name;
                }
            }
        };

        function evaluate() {
            if (mapsIndoors instanceof mapsindoors.MapsIndoors && !$this.disabled) {
                var bounds = googleMap.getBounds();
                $this.container.style.display = '';

                if (bounds && bounds.intersects($this.bbox)) {
                    if ($this.container.className.indexOf(' hidden') < 0) {
                        $this.container.className += ' hidden';
                    }
                } else {
                    $this.container.className = $this.container.className.replace(' hidden', '');
                }
            }
        }
    }

    function zoomForMoreDetails($rootScope, googleMap, mapsIndoors) {
        var $this = this;
        $this.container = document.getElementById('zoom-for-more-details');
        $this.localState = JSON.parse(localStorage.getItem('MI:' + mapsIndoors.getSolutionId())) || {};

        if ($this.container) {
            google.maps.event.addDomListener($this.container, 'click', function () {
                googleMap.setZoom(Math.max(18, googleMap.getZoom() + 1));
                hideZoomHint();
            });

            google.maps.event.addListenerOnce(googleMap, 'click', hideZoomHint);
            google.maps.event.addListenerOnce(googleMap, 'dragend', hideZoomHint);

            if (!$this.localState.hideZoomHint) {
                $this.removeListener = $rootScope.$on('$routeChangeSuccess', function (e, current, previous) {
                    if (current.templateUrl === 'controllers/venues/venues.tpl.html') {
                        if ($this.container.className.indexOf(' hidden') < 0) {
                            $this.container.className += ' hidden';
                        }
                    }
                });
                $this.container.style.display = '';
            } else {
                $this.container.style.display = 'none';
            }
        }

        return {};

        function hideZoomHint() {
            $this.localState = JSON.parse(localStorage.getItem('MI:' + mapsIndoors.getSolutionId())) || {};
            $this.localState.hideZoomHint = true;
            localStorage.setItem('MI:' + mapsIndoors.getSolutionId(), JSON.stringify($this.localState));

            if ($this.container.className.indexOf(' hidden') < 0) {
                $this.container.className += ' hidden';
            }

            if ($this.removeListener) {
                $this.removeListener();
            }
        }
    }

    function floorSelector($rootScope, $mdMedia, googleMap, mapsIndoors) {
        var container = document.createElement('div'),
            div = document.createElement('div'),
            control = new mapsindoors.FloorSelector(div, mapsIndoors);

        container.id = 'mi-floor-selector';
        container.className = 'mapsindoors floor-selector-container';
        container.appendChild(div);

        googleMap.controls[google.maps.ControlPosition.RIGHT_CENTER].push(container);

        $rootScope.$watch(function () {
            return $mdMedia('gt-sm');
        }, function (largeScreen) {
            if (largeScreen) {
                googleMap.controls[google.maps.ControlPosition.LEFT_CENTER].getArray().find(function (item, i) {
                    if (item.id === 'mi-floor-selector') {
                        googleMap.controls[google.maps.ControlPosition.LEFT_CENTER].removeAt(i);
                        googleMap.controls[google.maps.ControlPosition.RIGHT_CENTER].push(floorSelector);
                        return item;
                    }
                });
            } else {
                googleMap.controls[google.maps.ControlPosition.RIGHT_CENTER].getArray().find(function (item, i) {
                    if (item.id === 'mi-floor-selector') {
                        googleMap.controls[google.maps.ControlPosition.RIGHT_CENTER].removeAt(i);
                        googleMap.controls[google.maps.ControlPosition.LEFT_CENTER].push(floorSelector);
                        return item;
                    }
                });
            }
        });

        // [].forEach.call(document.getElementsByClassName('mapsindoors floor-selector'), function (item) {
        //     item.style.display = visible ? '' : 'none';
        // });

        return {
            hide: function () {
                container.style.display = 'none';
            },
            show: function () {
                container.style.display = '';
            }
        };
    }
})();

var utils = utils || {};
if (!utils.debounce) {
    utils.debounce = function (fn, delay) {
        var timer = null;
        return function () {
            var context = this,
                args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    };
}