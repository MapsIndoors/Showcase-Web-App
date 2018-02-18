(function () {
    angular.module('MapsIndoors').controller('SearchController', SearchController);


    function SearchController($scope, $sce, $timeout, $location, $routeParams, $mdSidenav, appConfig, venuesService, locationsService, googleMap, mapsIndoors, state) {
        $scope.showHint = false;
        $scope.headerImage = '';
        $scope.showResults = true;
        $scope.types = {};
        $scope.categories = {};
        $scope.query = state.latestQuery || {
            take: 50,
            orderBy: 'relevance',
            skip: 0
        };
        $scope.query.categories = $routeParams.category;
        $scope.result = state.latestSearchResult || [];
        $scope.loading = true;
        $scope.onKeypress = onKeypress;

        var delay = 500,
            types,
            timer = null,
            moreItems = true,
            content = document.getElementById('content');

        content.addEventListener('scroll', onScroll);

        $scope.clear = function () {
            if ($scope.query.q !== undefined && $scope.query.q > '') {
                $scope.query.q = '';
            } else {
                $location.path('/' + $routeParams.venue + '/search/');
            }
            mapsIndoors.clear();
            mapsIndoors.setLocationsVisible(true);
            $scope.getLocations();
            state.isMapDirty = false;
        };

        var lastRequest;
        $scope.getLocations = function () {
            if (timer) {
                clearTimeout(timer);
            }

            content.scrollTop = 0;
            $scope.query.skip = 0;
            $scope.query.take = 50;
            moreItems = true;

            if ($scope.query.q || $scope.query.categories) {
                $scope.loading = true;
                $scope.showHint = false;

                timer = setTimeout(function () {
                    var requestId;
                    requestId = lastRequest = Date.now();
                    state.getVenue().then(function (venue) {
                        $scope.$apply(function () {
                            $scope.query.venue = !$scope.query.q && $scope.query.categories ? venue.name : '';
                            $scope.query.near = {
                                toUrlValue: function () {
                                    return 'venue:' + venue.id;
                                }
                            };
                            locationsService.getLocations($scope.query)
                                .then(function (data) {
                                    if (requestId === lastRequest) {
                                        $timeout(function () {
                                            var bounds = new google.maps.LatLngBounds();

                                            data.forEach(function (item) {
                                                bounds.extend(new google.maps.LatLng(item.geometry.coordinates[1], item.geometry.coordinates[0]));
                                            });

                                            $scope.result = data;
                                            $scope.loading = false;
                                        }, 0);
                                    }
                                });
                        });
                    });
                }, delay);
            } else {
                $scope.loading = false;
            }
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
                ga('send', 'event', 'Search', 'Category', item.categoryKey);
            }
        };

        $scope.trustAsHtml = function (str) {
            return $sce.trustAsHtml(str);
        };

        $scope.onFocus = function () {
            $scope.showHint = (!$scope.query.q && !$scope.query.categories);
        };

        $scope.onBlur = function () {
            $scope.showHint = false;
        };

        $.when(appConfig.get(), venuesService.getVenue($routeParams.venue)).then(function (appConf, venue) {
            $timeout(function () {
                $scope.title = appConf.appSettings.title;
                $scope.venueName = venue.venueInfo.name;
                $scope.feedbackUrl = (appConf.appSettings || {}).feedbackUrl || null;
                var center = [].concat(venue.anchor.coordinates).reverse();
                $scope.categories = appConf.menuInfo.mainmenu.reduce(function (list, category) {
                    list[category.categoryKey] = category;

                    return list;
                }, {});
                $scope.headerImage = venue.image; //appConf.venueImages[venue.name.toLowerCase()] || ['https://maps.googleapis.com/maps/api/staticmap?center=', center, '&size=320x180&zoom=14&style=feature:all|saturation:-80&style=feature:poi|visibility:off&key=AIzaSyCrk6QMTzO0LhPDfv36Ko5RCXWPER_5o8o'].join("");
                state.isMapDirty = !!$routeParams.category;
                state.title = $routeParams.category ? $scope.categories[$routeParams.category].name : null;
                $scope.loading = false;

                if ($routeParams.category) {
                    $scope.getLocations();
                    $mdSidenav('left').open();

                } else {
                    mapsIndoors.setLocationsVisible(true);
                }
            });
        });

        $scope.about = function () {
            $scope.$parent.about();
        };

        function onKeypress($event) {
            switch ($event.which) {
                case 13:
                    if ($scope.result.length > 0) {
                        $scope.select($scope.result[0]);
                    }
                    break;
            }
        }

        function onScroll() {
            var elm = this;
            if (!$scope.loading && moreItems && this.scrollTop > 0 && this.scrollTop + this.clientHeight >= this.scrollHeight) {
                $scope.query.skip += $scope.query.take;
                $timeout(function () {
                    $scope.loading = true;
                    setTimeout(function () {
                        elm.scrollTop = elm.scrollHeight - elm.clientHeight;
                    }, 5);
                }, 0);
                locationsService.getLocations($scope.query).then(function (results) {
                    $timeout(function () {
                        $scope.result = $scope.result.concat(results);
                        moreItems = results.length === $scope.query.take;
                        $scope.loading = false;
                    }, 0);
                });
            }
        }
    }
})();