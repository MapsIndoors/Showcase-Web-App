var MapsIndoors = angular.module('MapsIndoors', [
    'ngMaterial',
    'ngRoute'
])
.config(function ($routeProvider, $locationProvider) {
    $routeProvider
        .when('/', {
            templateUrl: 'controllers/venues/venues.tpl.html',
            controller: 'VenuesController'
        })
        .when('/:venue', {
            templateUrl: 'controllers/search/search.tpl.html',
            controller: 'SearchController'
        })
        .when('/:venue/search', {
            templateUrl: 'controllers/search/search.tpl.html',
            controller: 'SearchController'
        })
        .when('/:venue/search/:category', {
            templateUrl: 'controllers/search/search.tpl.html',
            controller: 'SearchController'
        })
        .when('/:venue/details/:id/', {
            templateUrl: 'controllers/details/details.tpl.html',
            controller: 'DetailsController'
        })
        .when('/:venue/route/', {
            templateUrl: 'controllers/directions/directions.tpl.html',
            controller: 'DirectionsController'
        })
        .when('/:venue/route/from/:from/to/:to', {
            templateUrl: 'controllers/directions/directions.tpl.html',
            controller: 'DirectionsController'
        })
        .otherwise({
            redirectTo: '/'
        });

    $locationProvider.html5Mode(true);
})

.run(function ($rootScope, $location, $routeParams, appConfig) {
    $rootScope.goto = function (path) {
        path = path.replace(':venue', $routeParams.venue);
        $location.path(path);
    };

    appConfig.get().then(function (config) {
        return config;
    });
})

.controller('main', function ($scope, $location, $timeout, $mdSidenav, $mdDialog, $routeParams, appConfig, mapsIndoors, googleMap, locationsService, venuesService, state) {
    init();
    $scope.showSidenav = true;
    $scope.toggle = function (mdId) {
        $mdSidenav(mdId).toggle();
    };
    $scope.state = state;

    $scope.reset = function () {
        mapsIndoors.clear();
        mapsIndoors.setLocationsVisible(true);
        mapsIndoors.fitVenue($scope.venueId);
        $scope.goto('/:venue');
    };

    $scope.onKeyPress = onKeyPress;

    //google.maps.event.addListener(googleMap, 'idle', function () {
    //    var coords = '@' + googleMap.getCenter().lat().toFixed(12) + ',' + googleMap.getCenter().lng().toFixed(12) + ',' + googleMap.getZoom() + 'z',
    //        path = $location.path();

    //    if (path.indexOf(coords) < 0) {
    //        if (path.indexOf('@') > -1) {
    //            path = path.replace(/@(.*?)$/, coords);
    //        } else {
    //            path += !path.match(/\/$/) ? '/' + coords : coords;
    //        }
    //        $timeout(function () {
    //            console.log(path);
    //            $location.path(path);
    //        }, 0);
    //    }
    //});
    $scope.$on('$locationChangeStart', function () {
    });

    $scope.$on('$routeChangeSuccess', function (e, current, previous) {
        var venue = current.pathParams.venue || false,
            category = current.pathParams.category || false;

        var defaultVenue = localStorage.getItem('VenueId');

        if (defaultVenue && current.templateUrl === 'controllers/venues/venues.tpl.html' && !previous) {
            $scope.goto('/' + defaultVenue);
        }

        if (current.templateUrl === 'controllers/venues/venues.tpl.html') {
            $scope.showClearButton = false;
        } else {
            $scope.showClearButton = true;
        }

        if (previous && previous.params.type && !current.params.type) {
            mapsIndoors.clear();
            mapsIndoors.setLocationsVisible(true);
        }

        function venueOpener(venue) {
            if (venue) {
                if (!$routeParams.coordinates) {
                    var bounds = new google.maps.LatLngBounds(),
                        bbox = [-180, -90, 180, 90],
                        sort = function (a, b) {
                            return a === b ? 0 : a > b ? 1 : -1;
                        };
                    //this is a workaround for invalid data from MapToWeb.GeoJSON 
                    venue.geometry.coordinates.forEach(function (ring) {
                        var lng = ring.map(function (coords) {
                            return coords[0];
                        }).sort(sort);

                        var lat = ring.map(function (coords) {
                            return coords[1];
                        }).sort(sort);

                        bbox[0] = lng.last() >= bbox[0] ? lng.last() : bbox[0];
                        bbox[2] = lng[0] <= bbox[2] ? lng[0] : bbox[2];

                        bbox[1] = lat.last() >= bbox[1] ? lat.last() : bbox[1];
                        bbox[3] = lat[0] <= bbox[3] ? lat[0] : bbox[3];
                    });
                    //----------------------------------------------------------//
                    bounds.extend(new google.maps.LatLng(bbox[1], bbox[0]));
                    bounds.extend(new google.maps.LatLng(bbox[3], bbox[2]));

                    googleMap.fitBounds(bounds);
                }
                mapsIndoors.clear();
                mapsIndoors.setVenue($scope.venueId);
                state.setVenue(venue);
            }
        }



        if (venue.length === 24) {
            if ($scope.venueId !== venue) {
                $scope.venueId = venue;
                venuesService.getVenue($scope.venueId).then(venueOpener);
            }
        } else if (venue.length > 0) {
            $location.path('/');
        }
        //if (current && previous) {
        //    var reload = Object.keys(current.params).map(function (key) {
        //        if (key !== 'coordinates') {
        //            return current.params[key] !== previous.params[key];
        //        } else {
        //            return false;
        //        }
        //    }).reduce(function (result, changed) {
        //        return changed ? changed : result;
        //    }, false);

        //    if (!reload) {
        //        e.preventDefault();
        //    }
        //}

        //$scope.showSidenav = current.controller !== 'route';


        //var newVenueId = (current.pathParams ? current.pathParams.venue : '');
        //if ($scope.venueId !== newVenueId && newVenueId != 'venue') {
        //    $scope.venueId = $routeParams.venue;
        //    venues.getVenue($scope.venueId).then(venueOpener);
        //} else if (newVenueId === 'venue') {
        //    venues.getVenues().then(function (venues) {
        //        if (venues && venues[0]) {
        //            $routeParams.venue = venues[0].id;
        //            $scope.venueId = venues[0].id;
        //            venueOpener(venues[0]);
        //        }
        //    });
        //}

        //if ($routeParams.coordinates) {
        //    var matches = $routeParams.coordinates.match(/^(.*?),(.*?),(.*?)z$/),
        //        lat = parseFloat(Number(matches[1]).toFixed(12)),
        //        lng = parseFloat(Number(matches[2]).toFixed(12)),
        //        z = parseFloat(matches[3]);

        //    googleMap.panTo({ lat: lat, lng: lng });
        //    googleMap.setZoom(z);
        //}



    });

    locationsService.getTypes().then(function setTypes(data) {
        state.types = {};
        data.sort(function (a, b) {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        }).forEach(function (type) {
            state.types[type.name.toLowerCase()] = type;
        });
    });

    function init() {
        appConfig.get().then(function (config) {
            $scope.title = config.appSettings.title;
            $scope.config = config;
            return config;
        });
    }
    function about(e) {
        $mdDialog.show({
            controller: function ($scope, $mdDialog) {
                $scope.hide = function () {
                    $mdDialog.hide();
                };

                $scope.SDK_VERSION = mapsindoors._version;
                $scope.APP_VERSION = '%%GULP_INJECT_VERSION%%';
            },
            templateUrl: 'shared/about.tpl.html',
            parent: angular.element(document.body),
            targetEvent: e,

            clickOutsideToClose: true
        });
    }

    function onKeyPress($event) {
        if ($event.ctrlKey) {
            switch ($event.which) {
                case 9:
                    about();
                    break;

            }
        }
    }
});
