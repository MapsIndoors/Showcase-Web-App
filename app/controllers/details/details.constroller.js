(function () {
    angular.module('MapsIndoors').controller('DetailsController', DetailsController);


    function DetailsController($scope, $location, $timeout, $routeParams, $route, $mdSidenav, $mdDialog, locationsService, appConfig, googleMap, mapsIndoors, directionsRenderer, state) {
        var _id = $routeParams.id,
            highlightIcon = {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                strokeColor: '#2196F3',
                fillOpacity: 0,
                strokeWeight: 5,
                strokeOpacity: 0.3
            };

        $scope.displayAliases = false;

        init();

        if (_id && _id.length === 24) {
            $mdSidenav('left').open();
            getById(_id);
        } else if (_id) {
            $mdSidenav('left').open();
            locationsService.getLocations({ roomId: _id }).then(function (locations) {
                if (locations[0]) {
                    getById(locations[0].id);
                }
            });
        }

        $scope.back = function () {
            mapsIndoors.clear();
            mapsIndoors.setLocationsVisible(true);
            //Make sure we don't back out of app
            if (history.length > 2) {
                history.back();
            } else {
                $location.path($routeParams.venue + '/search/');
            }
        };

        $scope.share = function (e) {
            $mdDialog.show({
                controller: function ($scope, $mdDialog, poi) {
                    $scope.location = poi;
                    $scope.hide = function () {
                        $mdDialog.hide();
                    };

                    $scope.url = $location.absUrl();

                    $scope.copy = function () {
                        try {
                            var link = document.getElementById('share-location-link');
                            link.focus();
                            link.select();

                            document.execCommand('copy');
                        } catch (err) {

                        }
                    };
                },
                locals: {
                    poi: $scope.location
                },
                templateUrl: 'shared/share.tpl.html',
                parent: angular.element(document.body),
                targetEvent: e,

                clickOutsideToClose: true
            });
        };

        $scope.getRoute = function () {
            state.destination = $scope.location;
            state.direction = 'to';
            $location.path($routeParams.venue + '/route/').search('destination', $scope.location.id);
        };

        $scope.showOnMap = function () {
            $mdSidenav('left').close();
            mapsIndoors.find($scope.location.id);
            //mapsIndoors.locate({ fitBounds: true, locationId: $scope.location.id, locations: { q: $scope.location.properties.roomId, take: 1 }, highlightIcon: highlightIcon, suppressOthers: true });
        };

        function init() {
            directionsRenderer.setDirections(null);

            $.when(getAppConfig(), getVenue()).then(function (appConf, venue) {
                $timeout(function () {
                    highlightIcon.strokeColor = appConf.appSettings.primaryColor;
                    $scope.displayAliases = appConf.appSettings.displayAliases || false;
                    $scope.venue = venue;
                },0);
            });

            function getAppConfig() {
                return appConfig.get();
            }

            function getVenue() {
                return state.getVenue();
            }
        }

        function getById(id) {
            locationsService.getLocation(id).then(function (location) {
                $timeout(function () {
                    if (location) {
                        if (location.properties.fields && location.properties.fields.website && location.properties.fields.website.value) {
                            var pattern = /^https?:\/\//;
                            if (!pattern.test(location.properties.fields.website.value)) {
                                location.properties.fields.website.value = 'http://' + location.properties.fields.website.value;
                            }
                        }
                        $scope.location = location;
                        state.title = $scope.location.properties.name;
                        mapsIndoors.setFloor($scope.location.properties.floor);
                        mapsIndoors.setLocationsVisible(false);
                        
                        mapsIndoors.find(location.id);

                    }
                }, 0);
            });
        }
    }
})();