angular.module('MapsIndoors')
    .factory('googleMap', function ($location) {
        var element = document.getElementById('google-map'),
            map = new google.maps.Map(element, {
                zoom: 17,
                mapTypeControl: false,
                streetViewControl: false
            });
        map.fitBounds({ north: 83.5, east: 175, south: -83.5, west: -175 });
        return map;
    })
    .factory('infoWindow', function () {
        return new google.maps.InfoWindow({ pixelOffset: { height: -8, width: 0 } });
    });

