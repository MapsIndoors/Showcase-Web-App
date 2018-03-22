(function () {
    angular.module('MapsIndoors').controller('VenuesController', VenuesController);

    function VenuesController($scope, $timeout, $location, $mdSidenav, mapsIndoors, appConfig, venuesService, googleMap, state, returnToVenue, floorSelector) {
        var appInfo = JSON.parse(localStorage.getItem('MI:' + mapsIndoors.getSolutionId())) || {};
        returnToVenue.disable();
        floorSelector.hide();
        $scope.setVenue = setVenue;
        $scope.getVenue = getVenue;
        $scope.back = back;

        $scope.venues = [];
        $mdSidenav('left').open();

        venuesService.getVenues().then(function (venues) {
            $timeout(function () {
                var bounds = venues.reduce(function (bounds, venue) {
                    var bbox = venue.geometry.bbox;
                    return bounds.union(new google.maps.LatLngBounds({ lat: bbox[1], lng: bbox[0] }, { lat: bbox[3], lng: bbox[2] }));
                }, new google.maps.LatLngBounds());

                appConfig.get().then(function (appConfig) {

                    if (appConfig.appSettings && appConfig.appSettings.defaultVenue && appConfig.appSettings.defaultVenue.length === 24) {
                        var venue = venues.find(function (venue) {
                            return venue.id === appConfig.appSettings.defaultVenue;
                        });
                        if (venue) {
                            var bbox = venue.geometry.bbox;
                            bounds = new google.maps.LatLngBounds({ lat: bbox[1], lng: bbox[0] }, { lat: bbox[3], lng: bbox[2] });
                        }
                    }
                    
                    $scope.venues = venues;

                    googleMap.fitBounds(bounds);
                    googleMap.setZoom(googleMap.getZoom() + 1);

                });
            }, 0);
        });

        state.isMapDirty = false;

        function setVenue(venueId) {
            appInfo.lastVenue = venueId;
            var venue = $scope.venues.find(function (venue) {
                return venue.id === venueId;
            });
            localStorage.setItem('MI:' + mapsIndoors.getSolutionId(), JSON.stringify(appInfo));
            floorSelector.show();
            mapsIndoors.fitVenue(venueId);
            returnToVenue.enable();
            $location.path(venueId);
            ga('send', 'event', 'Venues', 'Select venue', venue.venueInfo.name);
        }

        function sortVenuesByName(a, b) {
            return a.venueInfo.name < b.venueInfo.name ? - 1 : a.venueInfo.name > b.venueInfo.name ? 1 : 0;
        }
        
        function getVenue() {
            return appInfo.lastVenue;
        }

        function back() {
            floorSelector.show();
            $location.path(appInfo.lastVenue);
        }
    }
})();