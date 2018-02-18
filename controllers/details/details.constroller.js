(function () {
    angular.module('MapsIndoors').controller('DetailsController', DetailsController);


    function DetailsController($scope, $location, $timeout, $routeParams, $route, $mdSidenav, $mdDialog, locationsService, appConfig, googleMap, infoWindow, mapsIndoors, directionsRenderer, state, returnToVenue) {
        var _id = $routeParams.id,
            highlightIcon = {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                strokeColor: '#2196F3',
                fillOpacity: 0,
                strokeWeight: 5,
                strokeOpacity: 0.3
            };
        state.isMapDirty = true;
        $scope.types = {};
        $scope.displayAliases = false;

        $scope.displayShareButton = function () {
            return !(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
        };

        init();

        if (_id && _id.length === 24) {
            $mdSidenav('left').open();
            getById(_id);
        } else if (_id) {
            $mdSidenav('left').open();
            locationsService.getLocations({
                roomId: _id
            }).then(function (locations) {
                if (locations[0]) {
                    getById(locations[0].id);
                }
            });
        }

        $scope.back = function () {
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
                            //We only get here if the browser dosen't support the copy command! *\_(o_o)_/*                            
                        }
                    };
                },
                locals: {
                    poi: $scope.location
                },
                templateUrl: 'shared/share.tpl.html',
                parent: angular.element(document.body),
                targetEvent: e,
                clickOutsideToClose: true,
                onRemoving: function(event, removePromise) {
                    ga('send', 'event', 'Details', 'Share POI', 'Close');
                }
            });
            ga('send', 'event', 'Details', 'Share POI', 'Open');
        };

        $scope.getRoute = function () {
            state.destination = $scope.location;
            state.direction = 'to';
            $location.path($routeParams.venue + '/route/').search('destination', $scope.location.id);
        };

        $scope.showOnMap = function () {
            $mdSidenav('left').close();
            mapsIndoors.find($scope.location.id);
            ga('send', 'event', 'Details', 'Show on map');
        };

        $scope.getIcon = function () {
            var location = $scope.location,
                icon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

            if ($scope.location) {
                icon = location.icon ? location.icon : $scope.types[location.properties.type] ? $scope.types[location.properties.type].icon : icon;
            }
            return icon;
        };

        function init() {
            directionsRenderer.setDirections(null);

            $.when(getAppConfig(), getVenue()).then(function (appConf, venue) {
                $timeout(function () {
                    highlightIcon.strokeColor = appConf.appSettings.primaryColor;
                    $scope.displayAliases = appConf.appSettings.displayAliases || false;
                    $scope.venue = venue;
                }, 0);
            });

            function getAppConfig() {
                return appConfig.get();
            }

            function getVenue() {
                return state.getVenue();
            }

            locationsService.getTypes().then(function (data) {
                $timeout(function () {
                    data.sort(function (a, b) {
                        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                    }).forEach(function (type) {
                        $scope.types[type.name] = type;
                    });
                }, 0);
            });

            var floorChangedListner = google.maps.event.addListener(mapsIndoors, 'floor_changed', function () {
                if ($scope.location && parseInt($scope.location.properties.floor) !== mapsIndoors.getFloor()) {
                    infoWindow.close();
                } else {
                    infoWindow.open(googleMap);
                }
            });

            $scope.$on('$destroy', function () {
                floorChangedListner.remove();
                mapsIndoors.clear();
                infoWindow.close();
                returnToVenue.setLocation();
                highlightLevel(null);
            });
        }

        function getById(id) {
            var zoom = googleMap.getZoom();
            mapsIndoors.find(id).then(function (location) {
                $timeout(function () {
                    if (location) {
                        if (location.properties.fields && location.properties.fields.website && location.properties.fields.website.value) {
                            var pattern = /^https?:\/\//;
                            if (!pattern.test(location.properties.fields.website.value)) {
                                location.properties.fields.website.value = 'http://' + location.properties.fields.website.value;
                            }
                        }

                        var categories = Object.keys(location.properties.categories);
                        if (categories && categories.length > 0) {
                            location.properties.category = location.properties.categories[categories[0]];
                        }

                        $scope.location = location;
                        state.title = $scope.location.properties.name;
                        mapsIndoors.setFloor($scope.location.properties.floor);

                        var content = '<div class="infowindow"><a><b>' + location.properties.name + '</b></a></div>'; 
                        infoWindow.setContent(content);  
                        infoWindow.setPosition({
                            lat: location.geometry.coordinates[1],
                            lng: location.geometry.coordinates[0]
                        });

                        if (zoom < 19) {
                            googleMap.setZoom(19);
                        }
            
                        googleMap.setCenter({
                            lat: location.geometry.coordinates[1],
                            lng: location.geometry.coordinates[0]
                        });

                        returnToVenue.setLocation(location);
                        highlightLevel(location.properties.floor);
                    }
                }, 0);
            });
        }

        function highlightLevel(level) {
            var style = document.getElementById('.mapsindoors.floor-selector') || (function () {
                    var style = document.createElement('style'),
                        head = document.head || document.getElementsByTagName('head')[0];

                    style.id = '.mapsindoors.floor-selector';
                    style.type = 'text/css';

                    head.appendChild(style);
                    return style;
                })(),
                css = level ? '.mapsindoors.floor-selector a[data-floor="' + level + '"] { font-size: 160%; color: #43aaa0 }' : '';

            if (style.styleSheet) {
                style.styleSheet.cssText = css;
            } else {
                style.innerHTML = '';
                style.appendChild(document.createTextNode(css));
            }

        }
    }
})();