(function (global) {
  'use strict';

  var PALETTES = [
    [0xc45c26, 0xd4763a, 0xe8a05c, 0x8b3a1a, 0xb85c38],
    [0x3d5a80, 0x98c1d9, 0xee6c4d, 0x293241, 0x5c6b73],
    [0x2a9d8f, 0xe9c46a, 0xf4a261, 0xe76f51, 0x264653],
    [0x6d597a, 0xb56576, 0xe56b6f, 0xeaac8b, 0x355070],
    [0x457b9d, 0xa8dadc, 0xf1faee, 0xe63946, 0x1d3557],
    [0x606c38, 0x283618, 0xfefae0, 0xdda15e, 0xbc6c25]
  ];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function irand(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function createBlockMesh(w, h, d, color, scene) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.72,
      metalness: 0.08,
      flatShading: false
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    var edges = new THREE.EdgesGeometry(geo);
    var line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    mesh.add(line);
    return mesh;
  }

  function buildStructure(world, scene, ox, oz, cols, rows, floors, blockSize, gap, palette, pointValue) {
    var bodies = [];
    var bs = blockSize;
    var halfW = (cols * (bs + gap) - gap) * 0.5;
    var halfD = (rows * (bs + gap) - gap) * 0.5;

    for (var f = 0; f < floors; f++) {
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          if (f > 0 && f < floors - 1 && c > 0 && c < cols - 1 && r > 0 && r < rows - 1 && Math.random() < 0.35) {
            continue;
          }

          var bw = bs * rand(0.88, 1.05);
          var bh = bs * rand(0.9, 1.1);
          var bd = bs * rand(0.88, 1.05);
          var color = palette[irand(0, palette.length - 1)];

          var mesh = createBlockMesh(bw, bh, bd, color, scene);
          var x = ox - halfW + c * (bs + gap) + bs * 0.5;
          var y = bh * 0.5 + f * (bs + gap * 0.5);
          var z = oz - halfD + r * (bs + gap) + bs * 0.5;
          mesh.position.set(x, y, z);

          var mass = bw * bh * bd * 0.85;
          var body = new DemoPhysics.Body(mesh, {
            mass: mass,
            size: new THREE.Vector3(bw, bh, bd),
            points: pointValue
          });
          world.add(body);
          bodies.push(body);
        }
      }
    }
    return bodies;
  }

  function generateLevel(world, scene, level) {
    world.clearBlocks();
    var bodies = [];
    var difficulty = Math.min(level, 12);
    var palette = PALETTES[(level - 1) % PALETTES.length];

    var layouts = [];

    if (level === 1) {
      layouts.push({ x: 0, z: -2, cols: 3, rows: 3, floors: 4, size: 1.15 });
    } else if (level === 2) {
      layouts.push({ x: -5, z: -1, cols: 3, rows: 2, floors: 5, size: 1.1 });
      layouts.push({ x: 5, z: -2, cols: 2, rows: 3, floors: 4, size: 1.1 });
    } else if (level === 3) {
      layouts.push({ x: 0, z: -3, cols: 4, rows: 3, floors: 6, size: 1.05 });
      layouts.push({ x: -8, z: 2, cols: 2, rows: 2, floors: 4, size: 1.1 });
      layouts.push({ x: 8, z: 2, cols: 2, rows: 2, floors: 4, size: 1.1 });
    } else {
      var count = Math.min(2 + Math.floor(difficulty / 2), 5);
      for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
        var dist = rand(4, 9 + difficulty * 0.3);
        layouts.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist * 0.6 - 2,
          cols: irand(2, 2 + Math.min(3, Math.floor(difficulty / 3))),
          rows: irand(2, 2 + Math.min(3, Math.floor(difficulty / 3))),
          floors: irand(3, 4 + Math.min(5, Math.floor(difficulty / 2))),
          size: rand(0.95, 1.2)
        });
      }
    }

    var points = 10 + level * 5;
    for (var L = 0; L < layouts.length; L++) {
      var lay = layouts[L];
      var built = buildStructure(
        world, scene,
        lay.x, lay.z,
        lay.cols, lay.rows, lay.floors,
        lay.size, 0.04,
        palette, points
      );
      bodies = bodies.concat(built);
    }

    if (level >= 4 && Math.random() < 0.5) {
      var wallCols = 6 + irand(0, 3);
      for (var w = 0; w < wallCols; w++) {
        for (var wh = 0; wh < 3; wh++) {
          var ww = 1.0, whh = 1.0, wd = 0.7;
          var mesh = createBlockMesh(ww, whh, wd, palette[irand(0, palette.length - 1)], scene);
          mesh.position.set(-6 + w * 1.15, whh * 0.5 + wh * 1.05, 8);
          var body = new DemoPhysics.Body(mesh, {
            mass: 0.9,
            size: new THREE.Vector3(ww, whh, wd),
            points: points
          });
          world.add(body);
          bodies.push(body);
        }
      }
    }

    return bodies;
  }

  global.DemoBuilding = {
    generateLevel: generateLevel,
    PALETTES: PALETTES
  };
})(window);