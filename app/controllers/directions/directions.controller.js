(function () {
    angular.module('MapsIndoors').controller('DirectionsController', DirectionsController);

    function DirectionsController($scope, $timeout, $location, $routeParams, $mdSidenav, $mdBottomSheet, $mdMedia, $mdToast, appConfig, locationsService, geoCodeService, mapsIndoors, googleMap, directionsRenderer, state) {
        var predefined = [],
            myPosition = [],
            destinationId = $location.search().destination,
            directions = new mapsindoors.DirectionsService(),
            autocomplete = new google.maps.places.AutocompleteService({ type: 'geocode' }),
            places = new google.maps.places.PlacesService(googleMap),
            animatedPolyline = new google.maps.Polyline({
                geodesic: true,
                strokeColor: '#2196F3',
                strokeOpacity: 1.0,
                strokeWeight: 3,
                map: googleMap,
                zIndex: 200
            }),
            animatePath,
            animation;

        $scope.origin = {
            query: '',
            results: [],
            network: 'VENUE',
            reset: function () {
                this.query = '';
                this.results = this.network === 'VENUE' ? [].concat(myPosition, predefined) : [].concat(myPosition);
                this.selected = null;
                clearRoute();
                this.focus();
            },
            focus: function () {
                document.getElementById('originInput').focus();
            }
        };

        $scope.destination = {
            query: '',
            results: [],
            network: 'VENUE',
            reset: function () {
                this.query = '';
                this.results = this.network === 'VENUE' ? [].concat(myPosition, predefined) : [].concat(myPosition);
                this.selected = null;
                clearRoute();
                this.focus();
            },
            focus: function () {
                document.getElementById('destinationInput').focus();
            }
        };

        $scope.current = $scope.origin;

        $scope.onFocus = onFocus;

        $scope.onKeypress = onKeypress;

        $scope.travelMode = 'WALKING';
        $scope.network = 'VENUE';
        $scope.avoidStairs = false;

        $scope.reversed = false;
        $scope.loading = true;
        state.title = 'Directions';

        $scope.select = function (location) {
            location = location || $scope.current.results[0];
            if (location) {
                $scope.current.query = location.properties.name;

                if (location.properties.type === 'google_places') {
                    places.getDetails({ placeId: location.properties.placeId }, function (place) {
                        location.geometry = {
                            type: 'point',
                            coordinates: [place.geometry.location.lng(), place.geometry.location.lat()]
                        };

                        final(location);
                    });
                } else {
                    final(location);
                }
            }

            function final(location) {
                $timeout(function () {
                    $scope.current.selected = location;

                    if ($scope.destination.selected && $scope.origin.selected) {
                        getRoute();
                    } else if ($scope.origin.selected) {
                        $scope.destination.focus();
                    } else {
                        $scope.origin.focus();
                    }
                });
            }
        };

        $scope.updateRoute = function () {
            clearRoute();
            getRoute();
        };

        $scope.find = function (query) {
            clearRoute();
            if (query.length > 0) {
                $scope.loading = true;
                delayedSearch(query);
            } else {
                $scope.current.reset();
                $scope.loading = false;
            }

        };

        $scope.reverse = function () {
            var tmp = {};

            copy($scope.destination, tmp);
            copy($scope.origin, $scope.destination);
            copy(tmp, $scope.origin);

            if (!$scope.origin.selected) {
                $scope.origin.focus();
            } else if (!$scope.destination.selected) {
                $scope.destination.focus();
            }

            function copy(from, to) {
                for (var k in from) {
                    if (from.hasOwnProperty(k) && Object.typeOf(from[k]) !== 'function') {
                        to[k] = from[k];
                    }
                }
            }

            if ($scope.origin.selected && $scope.destination.selected) {
                clearRoute();
                getRoute();
            }
        };

        $scope.switchNetwork = function (network) {
            $scope.current.network = network;
            $scope.find($scope.current.query);
        };

        $scope.closeHorizontalDirections = function () {
            $scope.reset();
            $mdBottomSheet.cancel();
            $mdSidenav('left').open();
        };

        $scope.setTravelmode = function (mode) {
            clearRoute();
            $scope.travelMode = mode;
            getRoute();
        };

        $scope.legs = [];

        $scope.getLeg = function () {
            return directionsRenderer.getLegIndex();
        };

        $scope.setLeg = function (index) {
            directionsRenderer.setLegIndex(index);
            updateHorizontalView(index);
        };

        $scope.isFirstLeg = function () {
            return directionsRenderer.getLegIndex() === 0;
        };

        $scope.isLastLeg = function () {
            return directionsRenderer.getLegIndex() === $scope.legs.length - 1;
        };

        $scope.prevLeg = function () {
            directionsRenderer.previousLeg();
            updateHorizontalView(directionsRenderer.getLegIndex());
        };

        $scope.nextLeg = function () {
            directionsRenderer.nextLeg();
            updateHorizontalView(directionsRenderer.getLegIndex());
        };

        $scope.back = function () {
            clearRoute();
            history.back();
        };

        $scope.reset = function () {
            console.log(arguments);
            if ($scope.reversed) {
                $scope.destination = null;
                $scope.fields.destination = '';
            } else {
                $scope.origin = null;
                $scope.fields.origin = '';
            }
            if ($scope.network === 'VENUE') {
                $scope.locations = myPosition.concat(predefined);
            } else {
                $scope.locations = myPosition;
            }
            clearRoute();
        };

        $scope.$on("$locationChangeStart", function (event) {
            directionsRenderer.setDirections(null);
            animatedPolyline.setMap(null);
            if (animatePath) {
                animatePath.stop();
            }

            $scope.legs = [];
        });



        google.maps.event.addListener(directionsRenderer, 'legindex_changed', function () {
            var i = this.getLegIndex();

            animatePath.setLegIndex(i);
        });

        appConfig.get().then(function (appConfig) {
            directionsRenderer.setStyle('default', {
                strokeOpacity: 0.5,
                strokeWeight: 6,
                strokeColor: appConfig.appSettings.primaryColor
            });

            animatedPolyline.set('strokeColor', appConfig.appSettings.primaryColor);
        });

        state.getVenue().then(function (venue) {
            $.when(getMyPosition(), getPredefined(venue)).then(function (position, list) {
                myPosition = position ? [position] : [];
                predefined = list.sort(function (a, b) {
                    return a.properties.name !== b.properties.name ? a.properties.name < b.properties.name ? -1 : 1 : 0;
                });

                $scope.origin.reset();
                $scope.loading = false;
                $scope.$apply();
            });
        });

        if (state.destination) {
            $scope.destination.selected = state.destination;
            $scope.destination.results = [state.destination];
            $scope.destination.query = state.destination.properties.name;
        } else if (destinationId) {
            locationsService.getLocation(destinationId).then(function (feature) {
                $scope.$apply(function () {
                    $scope.destination.selected = feature;
                    $scope.destination.results = [feature];
                    $scope.destination.query = feature.properties.name;
                });
            });
        } else if ($routeParams.from && $routeParams.to) {
            $.when(locationsService.getLocation($routeParams.from), locationsService.getLocation($routeParams.to)).then(function (origin, destination) {
                console.log(origin, destination);
                $scope.$apply(function () {
                    $scope.destination.selected = destination;
                    $scope.destination.results = [destination];
                    $scope.destination.query = destination.properties.name;

                    $scope.origin.selected = origin;
                    $scope.origin.results = [origin];
                    $scope.origin.query = origin.properties.name;

                    getRoute();
                });
            }).fail(function () {
                showNotification('Unable to caculate a route.');
            });
            console.log('here');
        } else {
            $location.path('/search/');
        }

        var delayedSearch = utils.debounce(function (query) {
            if ((query || '').length > 0) {
                search(query).then(function (results) {
                    $scope.current.results = results;
                    $scope.loading = false;
                    $scope.$apply();

                });
            }
        }, 250);

        function init(destination) {
            $scope.$apply(function () {
                $scope.destination.selected = destination;
                $scope.destination.results = [destination];
                $scope.destination.query = destination.properties.name;
            });
        }

        function onFocus(fieldInFocus) {
            $scope.current = fieldInFocus;
            $scope.enableGooglePlaces = $scope.current.network === 'GOOGLE_PLACES' || $scope.origin.network === 'VENUE' && $scope.destination.network === 'VENUE';
        }

        function onKeypress($event) {
            console.log($event);
            switch ($event.which) {
                case 13:
                    $scope.select();
                    break;
            }
        }

        function updateHorizontalView(index) {
            if ($scope.horizontalView) {
                var legElem = $('route-leg').get(index);
                $(legElem).parent().animate({
                    scrollLeft: $(legElem).offset().left
                }, 300);

                google.maps.event.addListenerOnce(googleMap, 'idle', function () {
                    googleMap.panBy(
                        0, 150
                    );
                });

            }
        }

        function search(query) {
            var deffered = $.Deferred();
            switch ($scope.current.network) {
                case 'VENUE':
                    state.getVenue().then(function (venue) {
                        locationsService.getLocations({ q: query, take: 10, near: { toUrlValue: function () { return 'venue:' + venue.id; } } }).then(deffered.resolve);
                    });
                    break;
                case 'GOOGLE_PLACES':
                    autocomplete.getQueryPredictions({ input: query }, function (results) {
                        var floor = mapsIndoors.getFloor();
                        results = results.map(function (result) {
                            return {
                                type: 'Feature',
                                properties: {
                                    type: 'google_places',
                                    placeId: result.place_id,
                                    name: result.description,
                                    floor: floor
                                }
                            };
                        });
                        deffered.resolve(results);
                    });
                    break;
            }
            return deffered.promise();
        }

        function getMyPosition() {
            var deffered = $.Deferred();
            window.navigator.geolocation.getCurrentPosition(function (position) {
                var coords = position.coords,
                feature = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [coords.longitude, coords.latitude]
                    },
                    properties: {
                        name: 'My Position',
                        type: 'myposition'
                    }
                };

                deffered.resolve(feature);
            }, function () {
                deffered.resolve();
            });

            return deffered.promise();
        }

        function getPredefined(venue) {
            return locationsService.getLocations({ categories: 'startpoint', venue: venue.name });
        }

        function getRoute() {
            if ($scope.origin.selected && $scope.destination.selected) {
                var origin = $scope.origin.selected,
                    destination = $scope.destination.selected;

                var args = {
                    origin: {
                        lat: origin.geometry.coordinates[1],
                        lng: origin.geometry.coordinates[0],
                        floor: origin.properties.floor
                    },
                    destination: {
                        lat: destination.geometry.coordinates[1],
                        lng: destination.geometry.coordinates[0],
                        floor: destination.properties.floor
                    },
                    travelMode: $scope.travelMode,
                    avoidStairs: $scope.avoidStairs
                };

                directions.route(args).then(function (result) {
                    //Creates an Array with all route legs start and end positions.
                    var points = result.routes[0].legs.reduce(function (arr, leg) {
                        return arr.concat([toUrlValue(leg.start_location), toUrlValue(leg.end_location)]);
                    }, []);
                    geoCodeService.reverseGeoCode(points).then(function (geoCodeResults) {
                        var i = 0;
                        result.routes[0].legs = result.routes[0].legs.map(function (leg) {
                            if (geoCodeResults[i] && geoCodeResults[i].building) {
                                leg.start_location.floorName = geoCodeResults[i].building.floors[leg.start_location.zLevel];
                                leg.end_location.floorName = geoCodeResults[i].building.floors[leg.end_location.zLevel];
                            }
                            i += 2;
                            return leg;
                        });

                        $scope.$apply(function () {
                            if ($mdMedia('xs')) {
                                $mdSidenav('left').close();
                                $scope.horizontalView = true;
                                $mdBottomSheet.show({
                                    scope: $scope,
                                    preserveScope: true,
                                    controller: function () { },
                                    templateUrl: 'controllers/directions/directions-bottom-sheet.tpl.html',
                                    clickOutsideToClose: false,
                                    disableBackdrop: true
                                }).then(function () {
                                    $scope.closeHorizontalDirections();
                                }, function () {
                                    $scope.closeHorizontalDirections();
                                });
                            }

                            $scope.legs = result.routes[0].legs;
                            animatePath = new mapsindoors.AnimatePath({ route: result.routes, legIndex: 0, polyline: animatedPolyline, fps: 60, duration: 5, mapsindoors: mapsIndoors });
                            directionsRenderer.setDirections(result);
                            directionsRenderer.setLegIndex(0);
                            google.maps.event.addListenerOnce(googleMap, 'idle', function () {
                                googleMap.panBy(
                                    0, 120
                                );
                            });
                        });

                    });
                });
            }
        }

        function clearRoute() {
            directionsRenderer.setDirections(null);
            if (animatePath) {
                animatePath.dispose();
            }
            $scope.legs = [];
        }

        function showNotification(message) {
            $mdToast.show({
                hideDelay: 0,
                position: 'bottom right',
                controller: function ($scope, $mdToast) {
                    $scope.message = message;
                    $scope.dismiss = function () {
                        $mdToast.hide();
                    };

                },
                templateUrl: 'shared/toasts/directions.error.tpl.html'
            });
        }

        function toUrlValue(latLng) {
            if (latLng instanceof google.maps.LatLng) {
                return latLng.toUrlValue();
            }
            else {
                return latLng.lat + ', ' + latLng.lng;
            }
        }
    }
})();