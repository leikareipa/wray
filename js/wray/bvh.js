/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * Builds a bounding volume hierarchy (BVH) for a given mesh of triangles, allowing
 * for faster path-tracing of that mesh.
 * 
 */

"use strict";

// Axis-aligned bounding box for a BVH.
Wray.bvh_aabb = function(mesh = [Wray.triangle()], isLeaf = false)
{
    const [min, max] = (()=>
    {
        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, minZ = Number.MAX_VALUE;
        let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE, maxZ = -Number.MAX_VALUE;
        
        for (const triangle of mesh)
        {
            for (const vertex of triangle.vertices)
            {
                minX = Math.min(minX, vertex.x);
                minY = Math.min(minY, vertex.y);
                minZ = Math.min(minZ, vertex.z);

                maxX = Math.max(maxX, vertex.x);
                maxY = Math.max(maxY, vertex.y);
                maxZ = Math.max(maxZ, vertex.z);
            }
        }

        return [Wray.vector3(minX, minY, minZ), Wray.vector3(maxX, maxY, maxZ)];
    })();

    const publicInterface = Object.freeze(
    {
        min,
        max,
        isLeaf,
        triangles: Object.freeze(isLeaf? mesh : []),

        mutable:
        {
            // This AABB's left and right child AABBs.
            left: null,
            right: null,
        }
    });
    return publicInterface;
}

// Recursively splits the given scene into smaller and smaller bounding boxes.
Wray.bvh = function(scene = [Wray.triangle()])
{
    Wray.assert((scene instanceof Array), "Expected an array of triangles for creating a BVH.");

    const startTime = Date.now();

    // An AABB encompassing the entire scene and from which further splits are made.
    const baseAABB = Wray.bvh_aabb(scene, false);
    
    // How many splits we're allowed to do, at most, before declaring a leaf node and stopping.
    const maxDepth = 20;

    // A split must have at most this many triangles in it to be eligible to act as a leaf.
    const minNumTris = 3;

    // Recursively split the mesh into smaller and smaller AABBs.
    (function split(parentAABB = Wray.bvh_aabb(), mesh = [Wray.triangle()], depth = 0)
    {
        if (parentAABB.isLeaf) return;

        // Split the AABB into two new AABBs (termed left/right, here, though the split could
        // be along one of a number of axes).
        {
            // Decide on which axis to split on.
            const axesAvailable = ["x", "y", "z"];
            const splitAxis = axesAvailable[depth % axesAvailable.length];
            const splitStart = parentAABB.min[splitAxis] + ((parentAABB.max[splitAxis] - parentAABB.min[splitAxis]) / 2);
            const leftMin = parentAABB.min;
            const leftMax = (()=>
            {
                switch (splitAxis)
                {
                    case "x": return Wray.vector3(splitStart, parentAABB.max.y, parentAABB.max.z);
                    case "y": return Wray.vector3(parentAABB.max.x, splitStart, parentAABB.max.z);
                    case "z": return Wray.vector3(parentAABB.max.x, parentAABB.max.y, splitStart);
                    default: Wray.assert(0, "Unknown BVH split direction."); return Wray.vector3(0, 0, 0);
                }
            })();

            // Distribute the AABB's triangles between the two new AABBs.
            const leftMesh = mesh.filter(triangle=>is_triangle_fully_inside_box(triangle, leftMin, leftMax));
            const rightMesh = mesh.filter(triangle=>!is_triangle_fully_inside_box(triangle, leftMin, leftMax));
            Wray.assert((leftMesh.length + rightMesh.length === mesh.length),
                        "Triangles have gone missing during BVH-splitting.");

            // Recurse to split each of the two new AABBs further into two more, etc.
            parentAABB.mutable.left = Wray.bvh_aabb(leftMesh, Boolean(((depth + 1) >= maxDepth) || (leftMesh.length <= minNumTris)));
            parentAABB.mutable.right = Wray.bvh_aabb(rightMesh, Boolean(((depth + 1) >= maxDepth) || (rightMesh.length <= minNumTris)));
            split(parentAABB.mutable.left, leftMesh, depth + 1);
            split(parentAABB.mutable.right, rightMesh, depth + 1);

            // A helper function; returns true if the given triangle is fully inside the given AABB.
            // Otherwise, returns false.
            function is_triangle_fully_inside_box(triangle = Wray.triangle(), min = Wray.vector3(), max = Wray.vector3())
            {
                return triangle.vertices.every(vertex=>
                {
                    return Boolean(vertex.x >= min.x && vertex.x <= max.x &&
                                   vertex.y >= min.y && vertex.y <= max.y &&
                                   vertex.z >= min.z && vertex.z <= max.z);
                });
            };
        }
    })(baseAABB, scene, 1);

    const endTime = Date.now();

    const publicInterface = Object.freeze(
    {
        base: baseAABB,
        triangles: Object.freeze(scene),
        constructTimeMs: (endTime - startTime),

        // Returns the count of triangles in the BVH's leaf nodes.
        num_triangles: function()
        {
            return (function tri_count(aabb = Wray.bvh_aabb(), total = 0)
            {
                if (aabb.isLeaf) return aabb.triangles.length;
                else return (total +
                             tri_count(aabb.mutable.left, total) +
                             tri_count(aabb.mutable.right, total));
            })(baseAABB, 0);
        },
    });
    return publicInterface;
}
