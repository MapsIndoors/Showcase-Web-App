(function () {
    angular.module('MapsIndoors')
        .config(SetThemingProvider)
        .run(function (mapsIndoors, directionsRenderer, appConfig, googleMap) {
            mapsIndoors.setBuildingsLabelsVisible(true);
            mapsIndoors.setLabelStyle({
                color: '#3c3834',
                strokeStyle: '#fff',
                strokeWidth: 2,
                shadowBlur: 1,
                shadowColor: '#fff'
            });
            
            appConfig.get().then(function (appConf) {
                appConf.appSettings.primaryColor = "#49A842";
                appConf.appSettings.accentColor = "#F5A623";
            });

            google.maps.event.addListener(googleMap, 'zoom_changed', function () {
                var z = this.getZoom(),
                    isVisible = mapsIndoors.get('buildings_labels_visible');

                if (z <= 16 && isVisible) {
                    mapsIndoors.setBuildingsLabelsVisible(false);
                } else if (z > 16 && !isVisible) {
                    mapsIndoors.setBuildingsLabelsVisible(true);
                }
            });
        });

    function SetThemingProvider($mdThemingProvider) {
        $mdThemingProvider.theme('default')
            .primaryPalette('blue')
            .accentPalette('red');

    }
})();