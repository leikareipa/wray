/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

Wray.ray = function(pos = Wray.vector3(0, 0, 0), dir = Wray.vector3(0, 0, 1))
{
    const publicInterface = Object.freeze(
    {
        pos,
        dir,

        // Convenience functions for altering the ray's direction.
        aimAt: Object.freeze(
        {
            direction: function(direction = Wray.vector3())
            {
                return Wray.ray(pos, direction);
            },

            // Returns a ray at this position but pointed at a random direction about
            // the hemisphere of the given normal.
            random_in_hemisphere: function(normal = Wray.vector3())
            {
                let newDir = Wray.vector3((Math.random() - Math.random()),
                                          (Math.random() - Math.random()),
                                          (Math.random() - Math.random())).normalized();

                if (normal.dot(newDir) < 0)
                {
                    newDir = Wray.vector3((newDir.x * -1),
                                          (newDir.y * -1),
                                          (newDir.z * -1));
                }
                
                return Wray.ray(pos, newDir);
            },

            // Returns a ray at this position but pointed at a random direction about
            // the hemisphere of the given normal. The direction is cosine-weighted,
            // i.e. more likely to be closer to the normal.
            random_in_hemisphere_cosine_weighted: function(normal = Wray.vector3())
            {
                const rand1 = Math.random();
                const rand2 = Math.random();

                // Adapted from http://www.rorydriscoll.com/2009/01/07/better-sampling/.
                // Get a cosine-weighted vector (x, y, z) about the hemisphere.
                const r = Math.sqrt(rand1);
                const theta = (2 * Math.PI * rand2);
                const x = (r * Math.cos(theta));
                const y = Math.sqrt(Math.max(0, 1 - rand1));
                const z = (r * Math.sin(theta));

                // Adapted from https://bheisler.github.io/post/writing-gpu-accelerated-path-tracer-part-2/.
                // Transform the cosine-weighted vector's hemisphere to the direction of
                // the normal.
                const t = (Math.abs(normal.x) > Math.abs(normal.y))
                          ? Wray.vector3(normal.z, 0, -normal.x).normalized()
                          : Wray.vector3(0, -normal.z, normal.y).normalized();
                const b = normal.cross(t);
                const newDir = Wray.vector3((x * b.x + y * normal.x + z * t.x),
                                            (x * b.y + y * normal.y + z * t.y),
                                            (x * b.z + y * normal.z + z * t.z)).normalized();
                                
                return Wray.ray(pos, newDir);
            },

            reflected: function(normal = Wray.vector3())
            {
                const dot = normal.dot(dir);
                return Wray.ray(pos, Wray.vector3((2 * dot * normal.x - dir.x),
                                                  (2 * dot * normal.y - dir.y),
                                                  (2 * dot * normal.z - dir.z)).reversed());
            },
        }),

        // Returns a ray moved forward from this position in this direction by the given amount.
        step: function(stepSize = 0, inDirection = dir)
        {
            return Wray.ray(Wray.vector3((pos.x + (inDirection.x * stepSize)),
                                         (pos.y + (inDirection.y * stepSize)),
                                         (pos.z + (inDirection.z * stepSize))), dir);
        },

        // Returns the ray's distance to its corresponding intersection point on the given triangle;
        // or null if the ray doesn't intersect the triangle.
        // Adapted from Moller & Trumbore 1997: "Fast, minimum storage ray/triangle intersection".
        intersect_triangle: function(triangle = Wray.triangle())
        {
            const ray = this;
            const noHit = [null, 0, 0];

            const e1 = triangle.vertices[1].position.sub(triangle.vertices[0].position);
            const e2 = triangle.vertices[2].position.sub(triangle.vertices[0].position);

            const pv = ray.dir.cross(e2);
            const det = e1.dot(pv);
            if ((det > -Wray.epsilon) && (det < Wray.epsilon)) return noHit;

            const invD = 1.0 / det;
            const tv = ray.pos.sub(triangle.vertices[0].position);
            const u = (tv.dot(pv) * invD);
            if ((u < 0) || (u > 1)) return noHit;

            const qv = tv.cross(e1);
            const v = (ray.dir.dot(qv) * invD);
            if ((v < 0) || ((u + v) > 1)) return noHit;

            const distance = (e2.dot(qv) * invD);
            if (distance <= 0) return noHit; 

            return [distance, u, v];
        },

        // Adapted from https://tavianator.com/fast-branchless-raybounding-box-intersections/.
        intersect_aabb: function(aabb = Wray.bvh_aabb())
        {
            const ray = this;

            const dirX = 1/ray.dir.x;
            const dirY = 1/ray.dir.y;
            const dirZ = 1/ray.dir.z;

            const tx1 = (aabb.min.x - ray.pos.x) * dirX;
            const tx2 = (aabb.max.x - ray.pos.x) * dirX;
            let tmin = Math.min(tx1, tx2);
            let tmax = Math.max(tx1, tx2);

            const ty1 = (aabb.min.y - ray.pos.y) * dirY;
            const ty2 = (aabb.max.y - ray.pos.y) * dirY;
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));

            const tz1 = (aabb.min.z - ray.pos.z) * dirZ;
            const tz2 = (aabb.max.z - ray.pos.z) * dirZ;
            tmin = Math.max(tmin, Math.min(tz1, tz2));
            tmax = Math.min(tmax, Math.max(tz1, tz2));

            return (tmax >= 0 && tmax >= tmin);
        },

        // Traces the ray recursively through the given BVH. Returns null if no triangle in
        // the BVH was intersected; and otherwise an object containing the triangle that was
        // intersected and the distance to the point of intersection on it along the ray.
        intersect_bvh: function(bvh = Wray.bvh())
        {
            const ray = this;

            const intersectionInfo = {
                triangle: null,
                distance: Infinity,
                u: 0,
                v: 0,
                w: 0,
            };

            (function trace(aabb = Wray.bvh_aabb())
            {
                if (aabb.isLeaf)
                {
                    for (const triangle of aabb.triangles)
                    {
                        const [distance, u, v] = ray.intersect_triangle(triangle);

                        if ((distance !== null) && (distance < intersectionInfo.distance))
                        {
                            intersectionInfo.triangle = triangle;
                            intersectionInfo.distance = distance;
                            intersectionInfo.u = u;
                            intersectionInfo.v = v;
                            intersectionInfo.w = (1 - u - v);
                        }
                    }

                    return;
                }

                if (ray.intersect_aabb(aabb.mutable.left)) trace(aabb.mutable.left);
                if (ray.intersect_aabb(aabb.mutable.right)) trace(aabb.mutable.right);
            })(bvh.base);

            return (intersectionInfo.triangle === null? null : intersectionInfo);
        },

        // Returns the combined color of this ray's random scatterings in the given scene. The ray's
        // scattering will be terminated either when it hits a light source, or when it has scattered
        // the maximum number of times.
        trace: function(sceneBVH = Wray.bvh_aabb(), depth = 0)
        {
            const ray = this;

            // Find the closest triangle this ray intersects.
            const intersected = ray.intersect_bvh(sceneBVH);
            const material = intersected? intersected.triangle.material : null;

            // See whether there's reason to terminate the ray.
            {
                if (!intersected) return Wray.sky_color(ray.dir);

                if (material.isEmissive)
                {
                    return Wray.color_rgb((material.color.red   * material.intensity),
                                          (material.color.green * material.intensity),
                                          (material.color.blue  * material.intensity));
                }

                if (depth >= Wray.maxRayDepth) return Wray.color_rgb(0, 0, 0);
            }

            // Otherwise, cast out a new ray from the current intersection point.
            {
                const interpolatedNormal = Wray.vector3((intersected.triangle.vertices[0].normal.x * intersected.w) +
                                                        (intersected.triangle.vertices[1].normal.x * intersected.u) +
                                                        (intersected.triangle.vertices[2].normal.x * intersected.v),
                                                        (intersected.triangle.vertices[0].normal.y * intersected.w) +
                                                        (intersected.triangle.vertices[1].normal.y * intersected.u) +
                                                        (intersected.triangle.vertices[2].normal.y * intersected.v),
                                                        (intersected.triangle.vertices[0].normal.z * intersected.w) +
                                                        (intersected.triangle.vertices[1].normal.z * intersected.u) +
                                                        (intersected.triangle.vertices[2].normal.z * intersected.v)).normalized();
                                                        
                const rayAtIntersection = ray.step(intersected.distance).step(Wray.epsilon, intersected.triangle.faceNormal);
                const {outRay, bsdf} = intersected.triangle.material.scatter(rayAtIntersection, interpolatedNormal);
                const inLight = outRay.trace(sceneBVH, depth + 1);
                return Wray.color_rgb(inLight.red*bsdf * material.color.red,
                                      inLight.green*bsdf * material.color.green,
                                      inLight.blue*bsdf * material.color.blue);
            }
        }
    });
    return publicInterface;
}
