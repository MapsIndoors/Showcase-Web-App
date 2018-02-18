var mapsindoors = mapsindoors || {};
(function (mapsindoors) {
    mapsindoors.AnimatePath = function (args) {
        var path = [],
            mapsIndoors = args.mapsindoors,
            polyline = args.polyline,
            duration = args.duration,
            fps = args.fps || 30,
            legs = args.route[0].legs,
            legIndex = args.legIndex || 0,
            steps, animation,
            loop = args.loop || false,
            floorChangedEvent;

        if (!(args.mapsindoors instanceof mapsindoors.MapsIndoors)) {
            throw new TypeError("'mapsindoors' must be of type mapsindoors.MapsIndoor");
        }

        function start() {
            var steps = legs[legIndex].steps,
                speed = 0,
                distance = 0,
                p0;

            polyline.setVisible(true);
            path.length = 0;
            p0 = steps[0].start_location instanceof google.maps.LatLng ? steps[0].start_location : new google.maps.LatLng(steps[0].start_location);
            p0.distance = 0;
            path.push(p0);

            steps.forEach(function (step) {
                (step.geometry || step.lat_lngs).forEach(function (geometry) {
                    var p0 = path[path.length - 1],
                        p1 = geometry instanceof google.maps.LatLng ? geometry : new google.maps.LatLng(geometry);
                    if (!p0.equals(p1)) {
                        p1.distance = p0.distance + google.maps.geometry.spherical.computeDistanceBetween(p0, p1);
                        path.push(p1);
                    }
                });
            });

            clearInterval(animation);
            speed = path[path.length - 1].distance / duration;
            animation = setInterval(function () {
                if (loop && distance > path[path.length - 1].distance) {
                    distance = 0;
                }

                distance += speed / fps;
                polyline.setPath(getPath(distance));
            }, 1000 / fps);
        }

        function findIndex(distance) {
            if (distance <= 0) {
                return 0;
            }

            for (var i = 0; i < path.length; i++) {

                if (path[i].distance > distance) {
                    return i - 1;
                }
            }

            return path.length - 1;
        }

        function getPath(distance) {
            if (distance <= 0) {
                return [];
            } else if (distance >= path[path.length - 1].distance) {
                return path;
            } else {
                var i = findIndex(distance),
                    p0 = path[i],
                    p1 = path[i + 1],
                    heading = google.maps.geometry.spherical.computeHeading(p0, p1),
                    delta = distance - p0.distance,
                    p = google.maps.geometry.spherical.computeOffset(p0, delta, heading),
                    result = path.slice(0, i + 1);

                result.push(p);

                return result;
            }
        }

        function onFloorChange() {
            //if (mapsIndoors.getFloor() !== (legs[legIndex].end_location.zLevel || 0)) {
            //    polyline.setVisible(false);
            //} else {
            //   polyline.setVisible(true);
            //}
            polyline.setVisible(true);
        }

        this.setLegIndex = function (index) {
            if (legIndex !== index) {
                index = index > 0 ? index : 0;
                index = index < legs.length ? index : legs.length - 1;

                legIndex = index;
                this.clear();
                start();
            }
        };

        this.stop = function () {
            clearInterval(animation);
        };

        this.clear = function () {
            polyline.setPath([]);
        };

        this.dispose = function () {
            clearInterval(animation);
            polyline.setPath([]);
            google.maps.event.removeListener(floorChangedEvent);
        };

        floorChangedEvent = google.maps.event.addListener(mapsIndoors, 'floor_changed', onFloorChange);

        start();
    };
})(mapsindoors);