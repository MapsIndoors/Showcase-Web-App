(function () {
    angular.module('MapsIndoors').controller('SearchController', SearchController);


    function SearchController($scope, $timeout, $location, $routeParams, $mdSidenav, appConfig, venuesService, locationsService, googleMap, mapsIndoors, state) {
        $scope.showHeader = true;
        $scope.headerImage = '';
        $scope.types = {};
        $scope.categories = {};
        $scope.query = state.latestQuery || { take: 50, orderBy: 'relevance' };
        $scope.query.categories = $routeParams.category;
        $scope.result = state.latestSearchResult || [];
        $scope.loading = true;

        var delay = 500,
            types,
            timer = null;

        $scope.clear = function () {
            mapsIndoors.clear();
            mapsIndoors.setLocationsVisible(true);
            if ($scope.query.q !== undefined && $scope.query.q.length > 0) {
                $scope.query.q = '';
            } else {
                $location.path('/' + $routeParams.venue + '/search/');
            }

        };
        var lastRequest;
        $scope.getLocations = function () {
            $scope.loading = true;
            if (timer) {
                clearTimeout(timer);
                console.log('reset');
            }

            timer = setTimeout(function () {
                var requestId;
                requestId = lastRequest = Date.now();
                state.getVenue().then(function (venue) {
                    $scope.$apply(function () {
                        //$scope.query.venue = venue.name;
                        $scope.query.near = { toUrlValue: function () { return 'venue:' + venue.id; } };
                        getLocationsPromise = locationsService.getLocations($scope.query);
                        getLocationsPromise.then(function (data) {
                            if (requestId === lastRequest) {
                                $timeout(function () {
                                    var bounds = new google.maps.LatLngBounds();

                                    data.forEach(function (item) {
                                        bounds.extend(new google.maps.LatLng(item.geometry.coordinates[1], item.geometry.coordinates[0]));
                                    });
                                    //googleMap.fitBounds(bounds);

                                    $scope.result = data;
                                    $scope.loading = false;
                                }, 0);
                            }
                        });

                        var locateQuery = angular.copy($scope.query);
                        delete locateQuery.take;
                        delete locateQuery.near;
                        if (locateQuery.q || locateQuery.categories) {
                            mapsIndoors.setLocationsVisible(false);
                            mapsIndoors.locate({ locations: locateQuery, venue: venue.name, suppressOthers: true });
                        }
                        else {
                            mapsIndoors.clear();
                            mapsIndoors.setLocationsVisible(true);
                        }
                    });
                });
            }, delay);
        };

        $scope.getIcon = function (item) {
            var icon = null;
            icon = item.icon ? item.icon : $scope.types[item.properties.type] ? $scope.types[item.properties.type].icon : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
            return icon;
        };

        $scope.items = function () {
            if ($scope.query.q || $scope.query.categories) {
                return $scope.result;
            }
        };

        $scope.select = function (item) {
            mapsIndoors.clear();
            item = Object(item);
            if (item.hasOwnProperty('properties')) {
                $location.path($routeParams.venue + '/details/' + item.id);
            } else {
                $scope.loading = true;
                $location.path($routeParams.venue + '/search/' + item.categoryKey);
            }
        };

        $.when(appConfig.get(), venuesService.getVenue($routeParams.venue)).then(function (appConf, venue) {
            $timeout(function () {
                $scope.venueName = venue.venueInfo.name;
                var center = [].concat(venue.anchor.coordinates).reverse();
                $scope.categories = appConf.menuInfo.mainmenu.reduce(function (list, category) {
                    list[category.categoryKey] = category;

                    return list;
                }, {});
                $scope.headerImage = venue.image; //appConf.venueImages[venue.name.toLowerCase()] || ['https://maps.googleapis.com/maps/api/staticmap?center=', center, '&size=320x180&zoom=14&style=feature:all|saturation:-80&style=feature:poi|visibility:off&key=AIzaSyCrk6QMTzO0LhPDfv36Ko5RCXWPER_5o8o'].join("");
                state.title = $routeParams.category ? $scope.categories[$routeParams.category].name : null;
                $scope.loading = false;

                if ($routeParams.category) {
                    $scope.getLocations();
                    $mdSidenav('left').open();
                }
            });
        });

        locationsService.getTypes().then(function (data) {
            $timeout(function () {
                data.sort(function (a, b) {
                    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                }).forEach(function (type) {
                    $scope.types[type.name] = type;
                });
            }, 0);
        });
    }
})();