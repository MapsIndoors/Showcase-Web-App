angular.module('MapsIndoors')
    .directive('listItem', function (state) {
        function link(scope, element) {
            var type = scope.location.properties.type.toLowerCase();

            scope.getTemplateUrl = function () {
                switch (type)   {
                    case 'google_places':
                        return 'directives/list-item/list-item.google_places.tpl.html';
                    case 'myposition':
                        return 'directives/list-item/list-item.myposition.tpl.html';
                    default:
                        return 'directives/list-item/list-item.tpl.html';
                }
            };
        }

        return {
            restrict: 'E',
            template: '<ng-include src="getTemplateUrl()"/>',
            scope: { 'location': '=' },
            link: link
        };
    });