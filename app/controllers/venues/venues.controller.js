(function () {
    angular.module('MapsIndoors').controller('VenuesController', VenuesController);

    function VenuesController($scope, $timeout, $location, mapsIndoors, appConfig, venuesService, googleMap) {
        $scope.setVenue = setVenue;

        venuesService.getVenues().then(function (venues) {
            $timeout(function () {
                var bounds = venues.reduce(function (bounds, venue) {
                    var bbox = venue.geometry.bbox;
                    return bounds.union(new google.maps.LatLngBounds({ lat: bbox[1], lng: bbox[0] }, { lat: bbox[3], lng: bbox[2] }));
                }, new google.maps.LatLngBounds());

                googleMap.fitBounds(bounds);

                $scope.venues = venues.sort(sortVenuesByName);
            }, 0);
        });
 
        function setVenue(venueId) {
            localStorage.setItem("VenueId", venueId);
            $location.path(venueId);
        }

        function sortVenuesByName(a,b) {
            return a.venueInfo.name < b.venueInfo.name ? -1 : a.venueInfo.name > b.venueInfo.name ? 1 : 0;
        }
    }
})();