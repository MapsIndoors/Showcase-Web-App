(function () {
    angular.module('MapsIndoors')
            .factory('mapsIndoors', mapsIndoors)
            .factory('directionsRenderer', directionsRenderer)
            .factory('appConfig', appConfig)
            .factory('locationsService', locationsService)
            .factory('geoCodeService', geoCodeService)
            .factory('venuesService', venuesService)
            .factory('state', appState);

    function mapsIndoors($routeParams, $location, $rootScope, appConfig, googleMap, $http) {
        mapsindoors.locale.setLanguage((navigator.language || navigator.userLanguage).substr(0, 2));
        var mapsIndoors = new mapsindoors.MapsIndoors({ map: googleMap, buildingOutlineOptions: { visible: false } }),
           div = document.createElement('div'),
           control = new mapsindoors.FloorSelector(div, mapsIndoors),
           halo = {
               path: google.maps.SymbolPath.CIRCLE,
               scale: 12,
               strokeColor: '#1976D2',
               fillOpacity: 0,
               strokeWeight: 5,
               strokeOpacity: 0.5
           };

        init();

        googleMap.controls[google.maps.ControlPosition.RIGHT_CENTER].push(div);

        google.maps.event.addListener(mapsIndoors, 'location_click', function (location) {
            mapsIndoors.clear();
            $location.path($routeParams.venue + '/details/' + location.id);
            $rootScope.$apply();
        });

        return mapsIndoors;

        function init() {
            appConfig.get().then(function (appConf) {
                halo.strokeColor = appConf.appSettings.primaryColor;
                mapsIndoors.setHighlightOptions({ halo: halo });
            });
        }
    }

    function directionsRenderer(mapsIndoors) {
        var dr = new mapsindoors.DirectionsRenderer({ mapsindoors: mapsIndoors });
        dr.setStyle('default', {
            strokeOpacity: 1,
            strokeWeight: 6,
            strokeColor: '#90CAF9'
        });

        dr.setStyle('hidden', {
            strokeOpacity: 0.1875,
            strokeColor: 'rgb(33,150,243)'
        });

        dr.setStyle('inactive', {
            visible: false
        });

        return dr;
    }

    function appConfig() {
        var service = new mapsindoors.AppConfigService(),
            appConfig;

        return {
            get: get
        };

        function get() {
            if (!appConfig) {
                appConfig = service.getAppConfig().then(function (appConfig) {
                    appConfig.appSettings.primaryColor = prepend(appConfig.appSettings.primaryColor || '2196F3', '#');
                    appConfig.appSettings.accentColor = prepend(appConfig.appSettings.accentColor || 'F44336', '#');
                    appConfig.appSettings.title = appConfig.appSettings.title || "MapsIndoors";
                    appConfig.appSettings.displayAliases = JSON.parse(appConfig.appSettings.displayAliases || false);
                    return appConfig;
                });
            }

            return appConfig;
        }

        function prepend(str, char) {
            return str[0] !== char ? char + str : str;
        }
    }

    function locationsService() {
        return new mapsindoors.LocationsService();
    }

    function venuesService(appConfig) {
        var service = new mapsindoors.VenuesService(),
            venues = {},
            getVenuesPromise;

        return {
            getVenues: getVenues,
            getVenue: getVenue
        };

        function getVenues() {
            if (!getVenuesPromise) {
                getVenuesPromise = new Promise(function (fulfill, reject) {
                    $.when(service.getVenues(), appConfig.get()).then(function (venues, appConfig) {
                        venues.forEach(function (venue) {
                            var center = [].concat(venue.anchor.coordinates).reverse();
                            venue.image = appConfig.venueImages[venue.name.toLowerCase()] || ['https://maps.googleapis.com/maps/api/staticmap?center=', center, '&size=400x220&zoom=14&style=feature:all|saturation:-80&style=feature:poi|visibility:off&key=AIzaSyCrk6QMTzO0LhPDfv36Ko5RCXWPER_5o8o'].join("");
                        });

                        fulfill(venues);
                    }, reject);
                });
            }
            return getVenuesPromise;
        }

        function getVenue(id) {
            if (!venues[id]) {
                venues[id] = $.when(service.getVenue(id), appConfig.get()).then(function (venue, appConfig) {
                    var center = [].concat(venue.anchor.coordinates).reverse();
                    venue.image = appConfig.venueImages[venue.name.toLowerCase()] || ['https://maps.googleapis.com/maps/api/staticmap?center=', center, '&size=400x220&zoom=14&style=feature:all|saturation:-80&style=feature:poi|visibility:off&key=AIzaSyCrk6QMTzO0LhPDfv36Ko5RCXWPER_5o8o'].join("");

                    return venue;
                });
            }
            return venues[id];
        }
    }

    function appState(venuesService, $routeParams) {
        var venue;

        return {
            getVenue: function () {
                return $.when(venue || venuesService.getVenue($routeParams.venue).then(function (result) {
                    venue = result;
                    return result;
                }));
            },
            setVenue: function () {
                if (arguments[0].id && arguments[0].id.length === 24) {
                    venue = arguments[0];
                }
            }
        };
    }

    function geoCodeService() {
        return new mapsindoors.GeoCodeService();
    }
})();

var utils = utils || {};
if (!utils.debounce) {
    utils.debounce = function (fn, delay) {
        var timer = null;
        return function () {
            var context = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    };
}