baseUrl = (document.baseURI || (document.getElementsByName('base')[0] || {}).href);
angular.module('MapsIndoors').directive('routeLeg', function (locationsService, directionsRenderer, mapsIndoors, appConfig) {
    var yInitVals = [0, 14, 24, 29, 36, 120, 144],
        xInitVals = [0, 14, 48, 51, 60, 236, 284],
        horizontalView = false,
        colors,
        _cache = {
            types: {}
        };

    function getType(type) {
        if (_cache.types) {
            return _cache.types[type] || {};
        }
    }

    locationsService.getTypes().then(function (types) {
        types.sort(function (a, b) {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        }).forEach(function (type) {
            _cache.types[type.name] = type;
        });
    });

    appConfig.get().then(function (result) {
        colors = {
            primary: result.appSettings.primaryColor,
            accent: result.appSettings.accentColor
        };
    });
    function Draw(context, legs) {
        var ctx = context,
            icons = {
                elevator: function (ctx, cx, cy, deferred) {
                    var icon = new Image();

                    icon.onload = function () {
                        ctx.save();
                        ctx.translate(cx - 9, cy - 9);
                        ctx.drawImage(icon, 0, 0, 24, 24, 0, 0, 18, 18);
                        ctx.restore();
                        deferred.resolve();
                    };
                    icon.src = baseUrl + '/assets/elevator.svg';
                },
                venue: function (ctx, cx, cy, deferred) {
                    ctx.save();
                    ctx.fillStyle = colors.primary;
                    ctx.font = '18px "Material Icons"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = "middle";
                    ctx.fillText(String.fromCharCode('0xE0AF'), cx, cy);
                    ctx.restore();
                    deferred.resolve();
                },
                place: function (ctx, cx, cy, deferred) {
                    ctx.save();
                    ctx.fillStyle = colors.primary;
                    ctx.font = '18px "Material Icons"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = "middle";
                    ctx.fillText(String.fromCharCode('0xE55F'), cx, cy);
                    ctx.restore();
                    deferred.resolve();
                },
                steps: function (ctx, cx, cy, deferred) {
                    var icon = new Image();
                    icon.onload = function () {
                        ctx.save();
                        ctx.translate(cx - 6, cy - 6);
                        ctx.drawImage(icon, 0, 80, 360, 285, 0, 0, 12, 12);
                        ctx.restore();
                        deferred.resolve();
                    };

                    icon.src = baseUrl + '/assets/stairs.svg';
                },
                start: function (ctx, cx, cy, deferred) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, 10.5, 0, 2 * Math.PI, false);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = colors.primary;
                    ctx.stroke();

                    //ctx.save();
                    //ctx.beginPath();
                    //ctx.arc(cx, cy, 12.5, 0, 2 * Math.PI, false);
                    //ctx.fillStyle = '#fff';
                    //ctx.fill();
                    //ctx.lineWidth = 3;
                    //ctx.strokeStyle = 'rgba(233,30,99, 0.2)';
                    //ctx.stroke();

                    //ctx.beginPath();
                    //ctx.arc(cx, cy, 7, 0, 2 * Math.PI, false);
                    //ctx.fillStyle = colors.primary;
                    //ctx.fill();
                    ctx.restore();
                    deferred.resolve();
                }
            };

        return {
            icon: function (icon, cx, cy, iconOnly) {
                var args = [].slice.call(arguments),
                    deferred = $.Deferred();
                if (icons[icon]) {
                    if (!iconOnly) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(cx, cy, 13, 0, 2 * Math.PI, false);
                        ctx.shadowBlur = 2;
                        ctx.shadowColor = '#a9a9a9';
                        ctx.shadowOffsetX = 0.5;
                        ctx.shadowOffsetY = 0.5;
                        ctx.fillStyle = '#fff';
                        ctx.fill();
                        ctx.restore();
                    }
                    icons[icon](ctx, cx, cy, deferred);
                } else {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, 13, 0, 2 * Math.PI, false);
                    ctx.shadowBlur = 2;
                    ctx.shadowColor = '#a9a9a9';
                    ctx.shadowOffsetX = 0.5;
                    ctx.shadowOffsetY = 0.5;
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.restore();
                    deferred.resolve();
                }
                return deferred.promise();
            },
            image: function (cx, cy, url) {
                var icon = new Image();
                //this.base(ctx, cx, cy);
                icon.onload = function () {
                    var height = this.width > 33 ? (this.height / this.width * 33) : this.height;
                    var width = this.width > 33 ? 33 : this.width;
                    ctx.save();
                    ctx.drawImage(icon, 0, 0, this.width, this.height, cx - (width / 2), cy - (height / 2), width, height);
                    ctx.restore();
                };
                icon.src = url;
            },
            start: function (i, cx, cy) {
                if (i === 0) {
                    this.icon('start', cx, cy, true);
                } else if (legs[i - 1]._mi.type !== legs[i]._mi.type) {
                    this.icon('venue', cx, cy);
                } else {
                    switch (legs[i].steps[0].highway) {
                        case 'steps':
                            this.icon('steps', cx, cy);
                            break;
                        case 'elevator':
                            this.icon('elevator', cx, cy);
                            break;
                        default:
                            this.icon('', cx, cy);
                            break;

                    }
                }
            },
            end: function (i, cx, cy) {
                if (legs[i]._mi.type !== legs[i + 1]._mi.type) {
                    this.icon('venue', cx, cy);
                } else {
                    switch (legs[i + 1].steps[0].highway) {
                        case 'steps':
                            this.icon('steps', cx, cy);
                            break;
                        case 'elevator':
                            this.icon('elevator', cx, cy);
                            break;
                        default:
                            this.icon('', cx, cy);
                            break;

                    }
                }
            },
        };
    }

    var stroke = function () {
        var canvas = document.createElement('canvas');

        if (!horizontalView) {
            canvas.height = '12';
            canvas.width = '1';
        }
        else {
            canvas.height = '1';
            canvas.width = '12';
        }

        var ctx = canvas.getContext('2d');
        if (!horizontalView) {
            ctx.moveTo(0, 4);
            ctx.lineTo(0, 9);
        } else {
            ctx.moveTo(4, 0);
            ctx.lineTo(9, 0);
        }
        ctx.strokeStyle = colors.primary;
        ctx.stroke();

        return ctx.createPattern(canvas, 'repeat');
    };

    function Labels(element, legs) {
        var el = element,
            isOutside = /^outside/i,
            isInside = /^inside/i;

        return {
            start: function (i) {
                if (legs[i]._mi.type === 'google.maps.DirectionsLeg') {
                    return legs[i].start_address;
                }

                switch (legs[i].steps[0].highway) {
                    case 'steps':
                        return 'Stairs level ' + legs[i].end_location.floorName;
                    case 'elevator':
                        return 'Elevator level ' + legs[i].end_location.floorName;
                    default:
                        return '';
                }
            },
            end: function (i) {
                var end = legs[i].steps[0],
                    start = legs[i + 1].steps[0];

                if (legs[i]._mi.type === 'google.maps.DirectionsLeg') {
                    return legs[i].end_address;
                }

                switch (legs[i + 1].steps[0].highway) {
                    case 'steps':
                        return 'Stairs level ' + legs[i + 1].start_location.floorName;
                    case 'elevator':
                        return 'Elevator level ' + legs[i + 1].start_location.floorName;
                }

                if (isOutside.test(end.abutters) && isInside.test(start.abutters)) {
                    return 'Walk inside';
                } else if (isOutside.test(start.abutters) && isInside.test(end.abutters)) {
                    return 'Walk outside';
                } else {
                    return '';
                }
            }
        };
    }

    var endMarker = new google.maps.Marker();
    var startMarker = new google.maps.Marker();

    google.maps.event.addListener(endMarker, 'click', function () {
        directionsRenderer.nextLeg();
    });

    google.maps.event.addListener(directionsRenderer, 'directions_changed', function () {
        var directions = directionsRenderer.getDirections();
        if (!directions) {
            startMarker.setMap(null);
            endMarker.setMap(null);
        }
    });

    google.maps.event.addListener(directionsRenderer, 'legindex_changed', function () {
        var i = this.getLegIndex(),
            legs = this.getDirections().routes[0].legs,
            label, metrics,
            map = this.getMap(),
            type = i === 0 ? 'start' : legs[i].steps[0].highway.toLowerCase();


        var start = legs[i].start_location,
            icon = document.createElement('canvas'),
            ctx = icon.getContext('2d'),
            draw = new Draw(ctx, legs);

        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(16, 16, 11.5, 0, 2 * Math.PI, false);
        ctx.fill();
        draw.icon(type, 16, 16, true).then(function () {

            var imgData = icon.toDataURL('image/png');

            startMarker.setOptions({
                icon: {
                    url: imgData, anchor: new google.maps.Point(16, 16)
                },
                position: start,
                map: map,
                floor: start.zLevel,
                visible: true
            });
        });

        if (i < legs.length - 1 && (legs[i].end_location.zLevel !== undefined && legs[i + 1].end_location.zLevel !== undefined && legs[i].end_location.zLevel !== legs[i + 1].end_location.zLevel)) {
            var end = legs[i + 1].end_location;
            type = legs[i + 1].steps[0].highway;
            icon = document.createElement('canvas');
            ctx = icon.getContext('2d');
            draw = new Draw(ctx, legs);
            start = legs[i + 1].start_location;


            if (legs[i + 1].start_location instanceof google.maps.LatLng) {
                start = { lat: legs[i + 1].start_location.lat(), lng: legs[i + 1].start_location.lng() };
            }

            if (legs[i + 1].end_location instanceof google.maps.LatLng) {
                end = { lat: legs[i + 1].end_location.lat(), lng: legs[i + 1].end_location.lng() };
            }

            label = 'Level ' + start.floorName + ' → Level ' + end.floorName;
            icon.height = 32;
            icon.width = 300;

            ctx.save();
            ctx.textBaseline = 'middle';
            ctx.font = '12px Roboto';
            metrics = ctx.measureText(label);

            ctx.beginPath();
            ctx.fillStyle = colors.accent;
            ctx.arc(40 + metrics.width, 16, 9.5, 0, 2 * Math.PI, false);
            ctx.rect(16, 6.5, 24 + metrics.width, 19);
            ctx.fill();
            ctx.beginPath();
            ctx.fillStyle = '#fff';
            ctx.arc(16, 16, 11.5, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = colors.primary;
            ctx.stroke();
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.fillText(label, 36, 16);

            draw.icon(type, 16, 16, true).then(function () {
                var imgData = icon.toDataURL('image/png');

                endMarker.setOptions({
                    icon: {
                        url: imgData, anchor: new google.maps.Point(16, 16)
                    },
                    position: { lat: start.lat, lng: start.lng },
                    map: map,
                    floor: start.zLevel,
                    visible: true
                });
            });
        } else {
            endMarker.setOptions({
                visible: false
            });
        }
    });

    function link(scope, element, attrs) {
        var i = scope.$index,
            legs = scope.legs,
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d'),
            draw = new Draw(ctx, legs, colors),
            labels = new Labels(element, legs),
            img = getType(scope.destination.selected.properties.type).icon,
            x0 = xInitVals[1],
            x1 = xInitVals[1],
            x2 = xInitVals[1],
            x3 = xInitVals[1],
            x4 = xInitVals[1],
            x5 = xInitVals[1],
            x6 = xInitVals[1],
            y0 = yInitVals[0],
            y1 = yInitVals[1],
            y2 = yInitVals[2],
            y3 = yInitVals[3],
            y4 = yInitVals[4],
            y5 = yInitVals[5],
            y6 = yInitVals[6];

        horizontalView = scope.horizontalView;

        //canvas.style.position = 'fixed';
        canvas.width = xInitVals[6] + '';
        canvas.height = yInitVals[6] + '';
        ctx.lineWidth = 2;

        if (horizontalView) {
            x0 = xInitVals[0];
            x1 = xInitVals[1];
            x2 = xInitVals[2];
            x3 = xInitVals[3];
            x4 = xInitVals[4];
            x5 = xInitVals[5];
            x6 = xInitVals[6];
            y0 = yInitVals[4];
            y1 = yInitVals[4];
            y2 = yInitVals[4];
            y3 = yInitVals[4];
            y4 = yInitVals[4];
            y5 = yInitVals[4];
            y6 = yInitVals[4];

            element.context.style.minWidth = x6 + 'px';
            element.context.style.minHeight = '80px';
            canvas.height = '80';

        }

        if (scope.getLeg() === i) {
            element.focus();
        }

        if (!horizontalView)
            element.append(canvas);

        if (legs.length === 1) {
            ctx.beginPath();
            ctx.moveTo(x4, y4);
            ctx.lineTo(x5, y5);
            ctx.strokeStyle = colors.primary;
            ctx.stroke();

            draw.start(i, x2, y2);
            draw.image(x5, y5, img);

            element.append($('<label>Start</label>'));
            element.append($('<label>' + scope.destination.selected.properties.name + '</label>'));
        }
        else if (i > 0 && i < legs.length - 1) {
            ctx.moveTo(x4, y4);
            ctx.lineTo(x5, y5);
            ctx.strokeStyle = colors.primary;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x4, y4);
            ctx.moveTo(x5, y5);
            ctx.lineTo(x6, y6);
            ctx.strokeStyle = stroke();
            ctx.stroke();

            draw.start(i, x2, y2);
            draw.end(i, x5, y5);

            element.append($('<label>' + labels.start(i) + '</label>'));
            element.append($('<label>' + labels.end(i) + '</label>'));

        } else if (i === 0) {
            ctx.beginPath();
            ctx.moveTo(x4, y4);
            ctx.lineTo(x5, y5);
            ctx.strokeStyle = colors.primary;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x5, y5);
            ctx.lineTo(x6, y6);
            ctx.strokeStyle = stroke();
            ctx.stroke();

            draw.start(i, x2, y2);
            draw.end(i, x5, y5);

            element.append($('<label>Start</label>'));
            element.append($('<label>' + labels.end(i) + '</label>'));
        } else if (i === legs.length - 1) {
            ctx.moveTo(x3, y3);
            ctx.lineTo(x0, y0);
            ctx.strokeStyle = stroke();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x4, y4);
            ctx.lineTo(x5, y5);
            ctx.strokeStyle = colors.primary;
            ctx.stroke();

            draw.start(i, x2, y2);

            if (legs[i]._mi.type === 'google.maps.DirectionsLeg') {
                draw.icon('place', x5, y5);
            } else {
                draw.image(x5, y5, img);
            }

            element.append($('<label>' + labels.start(i) + '</label>'));
            element.append($('<label>' + scope.destination.selected.properties.name + '</label>'));
        }

        if (horizontalView) {
            element.append(canvas);
        }

    }

    return {
        restrict: 'E',
        scope: true,
        link: link
    };
});