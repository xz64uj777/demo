(function (global) {
  'use strict';

  var GRAVITY = -28;
  var RESTITUTION = 0.28;
  var FRICTION = 0.82;
  var AIR_DRAG = 0.995;
  var SLEEP_EPS = 0.08;
  var GROUND_Y = 0;

  function Body(mesh, opts) {
    opts = opts || {};
    this.mesh = mesh;
    this.mass = opts.mass != null ? opts.mass : 1;
    this.invMass = this.mass > 0 ? 1 / this.mass : 0;
    this.velocity = new THREE.Vector3();
    this.angular = new THREE.Vector3();
    this.size = opts.size || new THREE.Vector3(1, 1, 1);
    this.half = this.size.clone().multiplyScalar(0.5);
    this.alive = true;
    this.sleeping = false;
    this.points = opts.points || 10;
    this.isBall = !!opts.isBall;
    this.isStatic = this.mass <= 0;
    this.radius = opts.radius || 0;
    this.fallen = false;
  }

  Body.prototype.getAABB = function () {
    var p = this.mesh.position;
    if (this.isBall) {
      var r = this.radius;
      return {
        minX: p.x - r, maxX: p.x + r,
        minY: p.y - r, maxY: p.y + r,
        minZ: p.z - r, maxZ: p.z + r
      };
    }
    var hx = this.half.x, hy = this.half.y, hz = this.half.z;
    return {
      minX: p.x - hx, maxX: p.x + hx,
      minY: p.y - hy, maxY: p.y + hy,
      minZ: p.z - hz, maxZ: p.z + hz
    };
  };

  function PhysicsWorld() {
    this.bodies = [];
    this.ball = null;
    this.onBlockDestroyed = null;
  }

  PhysicsWorld.prototype.add = function (body) {
    this.bodies.push(body);
    return body;
  };

  PhysicsWorld.prototype.setBall = function (body) {
    this.ball = body;
    this.bodies.push(body);
  };

  PhysicsWorld.prototype.clearBlocks = function () {
    var kept = [];
    for (var i = 0; i < this.bodies.length; i++) {
      var b = this.bodies[i];
      if (b.isBall) kept.push(b);
      else if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
    }
    this.bodies = kept;
  };

  PhysicsWorld.prototype.activeBlockCount = function () {
    var n = 0;
    for (var i = 0; i < this.bodies.length; i++) {
      var b = this.bodies[i];
      if (!b.isBall && b.alive && !b.fallen) n++;
    }
    return n;
  };

  PhysicsWorld.prototype.applyImpulse = function (body, ix, iy, iz) {
    if (body.isStatic || !body.alive) return;
    body.sleeping = false;
    body.velocity.x += ix * body.invMass;
    body.velocity.y += iy * body.invMass;
    body.velocity.z += iz * body.invMass;
  };

  PhysicsWorld.prototype.step = function (dt) {
    if (dt > 0.05) dt = 0.05;
    var bodies = this.bodies;
    var i, j, b;

    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (!b.alive || b.isStatic || b.sleeping) continue;
      if (b.isBall) continue;

      b.velocity.y += GRAVITY * dt;
      b.velocity.x *= AIR_DRAG;
      b.velocity.z *= AIR_DRAG;

      b.mesh.position.x += b.velocity.x * dt;
      b.mesh.position.y += b.velocity.y * dt;
      b.mesh.position.z += b.velocity.z * dt;

      b.angular.x *= 0.98;
      b.angular.y *= 0.98;
      b.angular.z *= 0.98;
      b.mesh.rotation.x += b.angular.x * dt;
      b.mesh.rotation.y += b.angular.y * dt;
      b.mesh.rotation.z += b.angular.z * dt;

      var bottom = b.mesh.position.y - b.half.y;
      if (bottom < GROUND_Y) {
        b.mesh.position.y = GROUND_Y + b.half.y;
        if (b.velocity.y < 0) {
          b.velocity.y *= -RESTITUTION;
          b.velocity.x *= FRICTION;
          b.velocity.z *= FRICTION;
        }
        if (Math.abs(b.velocity.y) < 0.5) b.velocity.y = 0;
      }

      var speed = b.velocity.length();
      if (speed < SLEEP_EPS && bottom <= GROUND_Y + 0.02) {
        b.velocity.set(0, 0, 0);
        b.angular.set(0, 0, 0);
        b.sleeping = true;
      }

      if (!b.fallen && (b.mesh.position.y < -2 || Math.abs(b.mesh.position.x) > 55 || Math.abs(b.mesh.position.z) > 55)) {
        b.fallen = true;
        b.alive = false;
        if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
        if (this.onBlockDestroyed) this.onBlockDestroyed(b);
      }
    }

    if (this.ball && this.ball.alive) {
      this._collideBallBlocks();
    }

    this._collideBlocks();
  };

  PhysicsWorld.prototype._aabbOverlap = function (a, b) {
    return a.minX <= b.maxX && a.maxX >= b.minX &&
           a.minY <= b.maxY && a.maxY >= b.minY &&
           a.minZ <= b.maxZ && a.maxZ >= b.minZ;
  };

  PhysicsWorld.prototype._collideBallBlocks = function () {
    var ball = this.ball;
    var bp = ball.mesh.position;
    var r = ball.radius;
    var bodies = this.bodies;

    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.alive || b.isBall || b.isStatic) continue;

      var aabb = b.getAABB();
      var cx = Math.max(aabb.minX, Math.min(bp.x, aabb.maxX));
      var cy = Math.max(aabb.minY, Math.min(bp.y, aabb.maxY));
      var cz = Math.max(aabb.minZ, Math.min(bp.z, aabb.maxZ));

      var dx = bp.x - cx;
      var dy = bp.y - cy;
      var dz = bp.z - cz;
      var distSq = dx * dx + dy * dy + dz * dz;

      if (distSq >= r * r) continue;

      var dist = Math.sqrt(distSq) || 0.0001;
      var nx = dx / dist;
      var ny = dy / dist;
      var nz = dz / dist;
      var penetration = r - dist;

      bp.x += nx * penetration * 0.5;
      bp.y += ny * penetration * 0.5;
      bp.z += nz * penetration * 0.5;

      b.mesh.position.x -= nx * penetration * 0.5;
      b.mesh.position.y -= ny * penetration * 0.5;
      b.mesh.position.z -= nz * penetration * 0.5;

      var relVx = ball.velocity.x - b.velocity.x;
      var relVy = ball.velocity.y - b.velocity.y;
      var relVz = ball.velocity.z - b.velocity.z;
      var velAlongNormal = relVx * nx + relVy * ny + relVz * nz;

      if (velAlongNormal > 0) continue;

      var invMassSum = ball.invMass + b.invMass;
      var jImp = -(1 + 0.45) * velAlongNormal / invMassSum;
      var impact = Math.abs(jImp);

      var ix = jImp * nx;
      var iy = jImp * ny;
      var iz = jImp * nz;

      ball.velocity.x += ix * ball.invMass;
      ball.velocity.y += iy * ball.invMass;
      ball.velocity.z += iz * ball.invMass;

      b.sleeping = false;
      b.velocity.x -= ix * b.invMass;
      b.velocity.y -= iy * b.invMass;
      b.velocity.z -= iz * b.invMass;

      b.angular.x += (nz - ny) * impact * 0.08 * b.invMass;
      b.angular.y += (nx - nz) * impact * 0.08 * b.invMass;
      b.angular.z += (ny - nx) * impact * 0.08 * b.invMass;

      if (impact > 4 && this.onBlockHit) {
        this.onBlockHit(b, impact);
      }

      if (impact > 18 && b.mesh.position.y - b.half.y > 0.3) {
        b.velocity.y += impact * 0.05;
      }
    }
  };

  PhysicsWorld.prototype._collideBlocks = function () {
    var bodies = this.bodies;
    var n = bodies.length;

    for (var i = 0; i < n; i++) {
      var a = bodies[i];
      if (!a.alive || a.isBall || a.isStatic) continue;

      for (var j = i + 1; j < n; j++) {
        var b = bodies[j];
        if (!b.alive || b.isBall || b.isStatic) continue;
        if (a.sleeping && b.sleeping) continue;

        var A = a.getAABB();
        var B = b.getAABB();
        if (!this._aabbOverlap(A, B)) continue;

        var ox = Math.min(A.maxX, B.maxX) - Math.max(A.minX, B.minX);
        var oy = Math.min(A.maxY, B.maxY) - Math.max(A.minY, B.minY);
        var oz = Math.min(A.maxZ, B.maxZ) - Math.max(A.minZ, B.minZ);

        var nx = 0, ny = 0, nz = 0;
        var pen = ox;
        nx = a.mesh.position.x < b.mesh.position.x ? -1 : 1;

        if (oy < pen) {
          pen = oy;
          nx = 0; nz = 0;
          ny = a.mesh.position.y < b.mesh.position.y ? -1 : 1;
        }
        if (oz < pen) {
          pen = oz;
          nx = 0; ny = 0;
          nz = a.mesh.position.z < b.mesh.position.z ? -1 : 1;
        }

        var totalInv = a.invMass + b.invMass;
        if (totalInv <= 0) continue;
        var sepA = pen * (a.invMass / totalInv);
        var sepB = pen * (b.invMass / totalInv);

        a.mesh.position.x += nx * sepA;
        a.mesh.position.y += ny * sepA;
        a.mesh.position.z += nz * sepA;
        b.mesh.position.x -= nx * sepB;
        b.mesh.position.y -= ny * sepB;
        b.mesh.position.z -= nz * sepB;

        var rvx = a.velocity.x - b.velocity.x;
        var rvy = a.velocity.y - b.velocity.y;
        var rvz = a.velocity.z - b.velocity.z;
        var vn = rvx * nx + rvy * ny + rvz * nz;
        if (vn > 0) continue;

        var jImp = -(1 + RESTITUTION * 0.5) * vn / totalInv;
        a.sleeping = false;
        b.sleeping = false;
        a.velocity.x += jImp * nx * a.invMass;
        a.velocity.y += jImp * ny * a.invMass;
        a.velocity.z += jImp * nz * a.invMass;
        b.velocity.x -= jImp * nx * b.invMass;
        b.velocity.y -= jImp * ny * b.invMass;
        b.velocity.z -= jImp * nz * b.invMass;

        if (ny !== 0) {
          a.velocity.x *= FRICTION;
          a.velocity.z *= FRICTION;
          b.velocity.x *= FRICTION;
          b.velocity.z *= FRICTION;
        }
      }
    }
  };

  global.DemoPhysics = {
    Body: Body,
    PhysicsWorld: PhysicsWorld,
    GRAVITY: GRAVITY,
    GROUND_Y: GROUND_Y
  };
})(window);