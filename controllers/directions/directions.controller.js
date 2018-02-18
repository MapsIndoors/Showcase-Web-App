(function () {
    angular.module('MapsIndoors').controller('DirectionsController', DirectionsController);

    function DirectionsController($scope, $sce, $timeout, $location, $routeParams, $mdSidenav, $mdMedia, $mdToast, appConfig, locationsService, geoCodeService, mapsIndoors, googleMap, directionsRenderer, directionsData, state, returnToVenue, floorSelector) {
        var predefined = [],
            myPosition = [],
            config = {},
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

        returnToVenue.disable();

        $scope.legs = [];
        $scope.origin = {
            query: state.origin,
            results: [],
            network: 'VENUE',
            reset: function () {
                this.query = '';
                this.results = this.network === 'VENUE' ? [].concat(myPosition, predefined) : [].concat(myPosition);
                this.selected = null;
                clearRoute();
                this.focus();
                onFocus(this);
            },
            focus: function () {
                document.getElementById('originInput').focus();
            },
            select: function (location) {
                ga('send', 'event', 'Directions', 'Origin Search', this.query);
                this.selected = location;
                if (location.properties.type === 'google_places') {
                    this.query = location.properties.name + ', ' + location.properties.subtitle;
                } else {
                    this.query = location.properties.name;
                    this.query += location.properties.floorName ? ', Level ' + location.properties.floorName : '';
                    this.query += location.properties.building ? ', ' + location.properties.building : '';
                    this.query += location.properties.venue ? ', ' + location.properties.venue : '';
                }
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
            },
            select: function (location) {
                ga('send', 'event', 'Directions', 'Destination Search', this.query);
                this.selected = location;                
                if (location.properties.type === 'google_places') {
                    this.query = location.properties.name + ', ' + location.properties.subtitle;
                } else {
                    this.query = location.properties.name;
                    this.query += location.properties.floorName ? ', Level ' + location.properties.floorName : '';
                    this.query += location.properties.building ? ', ' + location.properties.building : '';
                    this.query += location.properties.venue ? ', ' + location.properties.venue : '';
                }
               
            }
        };

        $scope.current = $scope.origin;
        $scope.onFocus = onFocus;
        $scope.onKeypress = onKeypress;
        $scope.travelMode = sessionStorage.getItem('TRAVEL_MODE') || 'WALKING';
        $scope.network = 'VENUE';
        $scope.avoidStairs = sessionStorage.getItem('AVOID_STAIRS') == 'true' || false;
        $scope.reversed = false;
        $scope.loading = true;
        state.title = 'Directions';

        $scope.select = function (location) {
            location = location || $scope.current.results[0];
            if (location) {
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
                    $scope.current.select(location);

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
        $scope.onAvoidStairsChange = function () {
            sessionStorage.setItem('AVOID_STAIRS', $scope.avoidStairs);
            $scope.updateRoute();
            ga('send', 'event', 'Directions', 'Avoid stairs', $scope.avoidStairs);
        };

        $scope.updateRoute = function () {
            clearRoute();
            getRoute();
        };

        $scope.find = function (query) {
            clearRoute();
            if (query.length > 0) {
                $scope.loading = true;
                $scope.showHint = false;
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
            ga('send', 'event', 'Directions', 'Reverse route');
        };

        $scope.showPoweredByGoogle = function () {
            if ($scope.current.results) {
                return $scope.current.results.find(function (item) {
                    return item.properties.type === 'google_places';
                });
            }
            return false;
        };

        $scope.switchNetwork = function (network) {
            $scope.current.network = network;
            $scope.find($scope.current.query);
        };

        $scope.setTravelmode = function (mode) {
            clearRoute();
            $scope.travelMode = mode;
            sessionStorage.setItem('TRAVEL_MODE', mode);
            getRoute();
            ga('send', 'event', 'Directions', 'Travel mode', mode);
        };

        $scope.back = function () {
            clearRoute();
            history.back();
        };

        $scope.reset = function () {
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

        $scope.$on('$destroy', function () {
            directionsRenderer.setDirections(null);
            animatedPolyline.setMap(null);
            if (animatePath) {
                animatePath.stop();
            }
            returnToVenue.enable();
            $scope.legs = [];
            state.mode = 'normal';
            floorSelector.show();
        });

        google.maps.event.addListener(directionsRenderer, 'legindex_changed', function () {
            var i = this.getLegIndex();
            if (animatePath) {
                animatePath.setLegIndex(i);
            }
        });

        appConfig.get().then(function (appConfig) {
            directionsRenderer.setStyle('default', {
                strokeOpacity: 0.5,
                strokeWeight: 6,
                strokeColor: appConfig.appSettings.primaryColor
            });

            config = appConfig;

            animatedPolyline.set('strokeColor', appConfig.appSettings.primaryColor);

            if (!$routeParams.from && !$routeParams.to) {
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
            }
        });

        if (state.destination) {
            $scope.destination.select(state.destination);
            $scope.destination.results = [state.destination];
        } else if (destinationId) {
            locationsService.getLocation(destinationId).then(function (feature) {
                $timeout(function () {
                    $scope.destination.select(feature);
                    $scope.destination.results = [feature];
                });
            });
        } else if ($routeParams.from && $routeParams.to) {
            $scope.loading = true;
            var promise = $.when(locationsService.getLocation($routeParams.from), locationsService.getLocation($routeParams.to));
            google.maps.event.addListener(mapsIndoors, 'ready', function () {
                promise.then(function (origin, destination) {
                    $timeout(function () {
                        $scope.destination.select(destination);
                        $scope.destination.results = [destination];
                        $scope.origin.select(origin);
                        $scope.origin.results = [origin];
                        getRoute();
                    });
                }).fail(function () {
                    showNotification('Unable to calculate a route.');
                });
            });
        } else {
            $location.path('/search/');
        }

        state.isMapDirty = true;

        var delayedSearch = utils.debounce(function (query) {
            if ((query || '').length > 0) {
                search(query).then(function (results) {
                    if ($scope.current.query > '') {
                        $scope.current.results = results;
                        $scope.loading = false;
                        $scope.$apply();
                    }
                });
            }
        }, 250);

        function onFocus(fieldInFocus) {
            $scope.current = fieldInFocus;

            if (!fieldInFocus.query && fieldInFocus.results.length === 0) {
                $scope.showHint = true;
            } else {
                $scope.showHint = false;
            }
        }

        function onKeypress($event) {
            switch ($event.which) {
                case 13:
                    $scope.select();
                    break;
            }
        }

        function search(query) {
            return $.when(getLocations(query), getPlaces(query)).then(function (locations, places) {
                return locations.concat(places);
            });
        }

        function getLocations(query) {
            return state.getVenue().then(function (venue) {
                return locationsService.getLocations({ q: query, take: 10, near: { toUrlValue: function () { return 'venue:' + venue.id; } } });
            });
        }

        function getPlaces(query) {
            var deffered = $.Deferred();
            var origin = $scope.origin.selected, destination = $scope.destination.selected;
            if (query.length > 3 && (origin && origin.properties.type !== 'google_places' || destination && destination.properties.type !== 'google_places')) {
                autocomplete.getPlacePredictions({ input: query, componentRestrictions: config.appSettings.countryCode ? { country: config.appSettings.countryCode } : null }, function (results) {
                    var floor = mapsIndoors.getFloor();
                    results = (results || []).map(function (result) {
                        return {
                            type: 'Feature',
                            properties: {
                                type: 'google_places',
                                placeId: result.place_id,
                                name: result.structured_formatting.main_text,
                                subtitle: result.structured_formatting.secondary_text || '',
                                floor: floor
                            }
                        };
                    });
                    deffered.resolve(results);
                });
            } else {
                deffered.resolve([]);
            }
            return deffered.promise();
        }

        function getMyPosition() {
            var deffered = $.Deferred();
            if (config.appSettings.positioningDisabled !== '1') {
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
            }
            else {
                deffered.resolve();
            }

            return deffered.promise();
        }

        function getPredefined(venue) {
            return locationsService.getLocations({ categories: 'startpoint', venue: venue.name });
        }

        function getRoute() {
            state.mode = 'navigating';
            floorSelector.hide();
            if ($scope.origin.selected && $scope.destination.selected) {
                $scope.loading = true;
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
                            }
                            
                            
                            $scope.legs = JSON.parse(JSON.stringify(result.routes[0])).legs;
                            directionsData.set({ legs: $scope.legs, start: $scope.origin.selected, end: $scope.destination.selected, travelMode: $scope.travelMode });
                            directionsRenderer.setDirections(result);
                            animatePath = new mapsindoors.AnimatePath({ route: result.routes, legIndex: 0, polyline: animatedPolyline, fps: 60, duration: 5, mapsindoors: mapsIndoors });
                            directionsRenderer.setLegIndex(0);
                            google.maps.event.addListenerOnce(googleMap, 'idle', function () {
                                googleMap.panBy(
                                    0, 120
                                );
                            });
                            $scope.loading = false;
                        });

                    });
                }).catch(function (err) {
                    $timeout(function () {
                        $scope.loading = false;
                        $scope.error = "Sorry, no route were found.";
                    });
                });
            }
        }

        function processRoute(route) {
            var legs = route.legs.reduce(function (legs, leg) {
                var steps = leg.steps;
                for (var i = 1; i < steps.length; i++) {
                    if (steps[i - 1].travel_mode !== steps[i].travel_mode || steps[i - 1].travel_mode === 'TRANSIT' && steps[i].travel_mode === 'TRANSIT') {
                        var firstStep = steps[0],
                            lastStep = steps[i];
                        legs.push({
                            _mi: leg._mi,
                            start_location: firstStep.start_location,
                            end_location: lastStep.end_location,
                            start_address: leg.start_address,
                            steps: steps.splice(0, i)
                        });
                        i = 0;
                    }
                }
                legs.push(leg);
                return legs;
            }, []);

            route.legs = legs;
            return route;
        }

        function clearRoute() {
            directionsRenderer.setDirections(null);
            if (animatePath) {
                animatePath.dispose();
            }
            $scope.legs = [];
            directionsData.set(null);
            $scope.error = null;
            floorSelector.show();
            state.mode = 'normal';
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

        function setFloorSelectorVisible(visible) {
            [].forEach.call(document.getElementsByClassName('mapsindoors floor-selector'), function (item) {
                item.style.display = visible ? '' : 'none';
            });
        }
    }
})();