angular.module('MapsIndoors')
.directive('listIcon', function (state) {
    function link(scope, element) {
        var feature = scope.src;
        scope.type = feature.properties.type;

        scope.getIconUrl = function () {
            var type = feature.properties.type.toLowerCase();
            if (state.types && state.types[type]) {
                if (state.types[type].displayRule && false) {
                    return state.types[type].displayRule.icon;
                } else {
                    return state.types[type].icon;
                }
            }
        };
    }

    return {
        restrict: 'E',
        templateUrl: 'directives/list-icon/list-icon.tpl.html',
        scope: { 'src': '=' },
        link: link
    };
});