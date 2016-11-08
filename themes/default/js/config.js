(function () {
    angular.module('MapsIndoors').config(SetThemingProvider);

    function SetThemingProvider($mdThemingProvider) {
        $mdThemingProvider.theme('default')
              .primaryPalette('blue')
              .accentPalette('red');

    }
})();