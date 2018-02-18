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
            $location.search({});
            $location.path(path);
        };

        appConfig.get().then(function (config) {
            return config;
        });
    })
    .controller('main', function ($scope, $location, $timeout, $mdSidenav, $mdDialog, $route, $routeParams, $window, appConfig, mapsIndoors, googleMap, infoWindow, locationsService, venuesService, state, directionsData, directionsRenderer, returnToVenue, zoomForMoreDetails, floorSelector) {
        var appConf;
        init();
        $scope.showSidenav = true;
        $scope.toggle = function (mdId) {
            $mdSidenav(mdId).toggle();
        };

        $scope.state = state;
        $scope.showHorizontalDirections = function () {
            var currentIndex = directionsRenderer.getLegIndex();
            if (!$mdSidenav('left').isOpen()) {
                if (!$mdSidenav('left').isOpen() && currentIndex > -1) {
                    var scrollThreshold = window.innerWidth / 2,
                        scrollPosition = (currentIndex + 1) * 160,
                        scrollBy = scrollPosition - scrollThreshold;
                    scrollBy = scrollBy < 0 ? 0 : scrollBy;

                    document.getElementById('hnav').getElementsByClassName('direction-panel')[0].scrollLeft = scrollBy;
                }
            }
            return !$mdSidenav('left').isOpen() && currentIndex > -1;
        };

        angular.element($window).on('resize', function () {
            $timeout(function () {
                google.maps.event.trigger(googleMap, 'resize');
            }, 500);
        });

        $scope.reset = function () {
            mapsIndoors.clear();
            mapsIndoors.setLocationsVisible(true);
            mapsIndoors.fitVenue($scope.venueId);
            infoWindow.close();
            directionsData.set(null);
            directionsRenderer.setDirections(null);
            $scope.goto('/:venue');
            state.isDirty = false;
            ga('send', 'event', 'Clear map');
        };

        $scope.onKeyPress = onKeyPress;

        $scope.$on('$routeChangeSuccess', function (e, current, previous) {
            if (current.loadedTemplateUrl) {
                ga('send', 'pageview', $location.url());
            }

            var venue = current.pathParams.venue || false,
                category = current.pathParams.category || false,
                localState = JSON.parse(localStorage.getItem('MI:' + mapsIndoors.getSolutionId())) || {},
                elements;

            var defaultVenue = localState.lastVenue;

            if (defaultVenue && current.templateUrl === 'controllers/venues/venues.tpl.html' && !previous) {
                $scope.goto('/' + defaultVenue);
            }

            if (current.templateUrl !== 'controllers/venues/venues.tpl.html') {
                elements = document.getElementsByClassName('mapsindoors floor-selector');
                [].forEach.call(elements, function (item) {
                    item.style.display = 'block';
                });
            }

            if (previous && previous.params.type && !current.params.type) {
                mapsIndoors.clear();
                mapsIndoors.setLocationsVisible(true);
            }

            if (venue.length === 24) {
                if ($scope.venueId !== venue) {
                    $scope.venueId = venue;
                    venuesService.getVenue($scope.venueId).then(venueOpener);
                }
            } else if (venue.length > 0) {
                $location.path('/');
            }

            if (['controllers/details/details.tpl.html'].indexOf(current.templateUrl) === -1) {
                infoWindow.close();
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
                    mapsIndoors.setFloor(venue.defaultFloor || 0);
                    mapsIndoors.fitVenue(venue.id);
                    state.setVenue(venue);
                    google.maps.event.addListenerOnce(mapsIndoors, 'ready', function () {
                        mapsIndoors.setLocationsVisible(true);
                    });
                }
            }
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
                appConf = config;
                return config;
            });
        }

        $scope.about = function about(e) {         
            var map = googleMap;
            $mdDialog.show({
                controller: function ($scope, $mdDialog) {
                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.SDK_VERSION = mapsindoors._version;
                    $scope.APP_VERSION = '%%GULP_INJECT_VERSION%%';
                    $scope.BUILD_DATE = '%%BUILD_DATE%%';
                    $scope.USER_AGENT = navigator.userAgent;
                    $scope.TITLE = appConf.appSettings.title;
                },
                templateUrl: 'shared/about.tpl.html',
                parent: angular.element(document.body),
                targetEvent: e,
                onRemoving: function(event, removePromise) {
                    ga('send', 'event', 'About', 'Closed');
                },
                clickOutsideToClose: true
            });
            ga('send', 'event', 'About', 'Opened');
        };

        function onKeyPress($event) {
            if ($event.ctrlKey) {
                switch ($event.which) {
                    case 9:
                        $scope.about();
                        break;

                }
            }
        }
    });