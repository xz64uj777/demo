(function (global) {
  'use strict';

  function WreckingBall(scene, world) {
    this.scene = scene;
    this.world = world;

    this.pivot = new THREE.Vector3(0, 18, 8);
    this.angle = 0;
    this.angleZ = 0;
    this.ropeLength = 12;
    this.minLength = 5;
    this.maxLength = 16;
    this.angVel = 0;
    this.angVelZ = 0;
    this.radius = 1.15;

    this.inputSwing = 0;
    this.inputLength = 0;
    this.smashPower = 0;

    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildCrane();
    this._buildBall();
    this._buildRope();
  }

  WreckingBall.prototype._buildCrane = function () {
    var baseMat = new THREE.MeshStandardMaterial({ color: 0xf0a020, roughness: 0.55, metalness: 0.4 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.7, metalness: 0.3 });
    var steelMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.4, metalness: 0.7 });

    var base = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), baseMat);
    base.position.set(0, 0.6, 10);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.5), darkMat);
    cabin.position.set(0, 2.1, 10.2);
    cabin.castShadow = true;
    this.scene.add(cabin);

    var cabinWin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.9, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x7ec8e3, roughness: 0.2, metalness: 0.5, transparent: true, opacity: 0.7 })
    );
    cabinWin.position.set(0, 2.3, 8.95);
    this.scene.add(cabinWin);

    this.tower = new THREE.Group();
    this.tower.position.set(0, 0, 10);
    this.scene.add(this.tower);

    for (var i = 0; i < 4; i++) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 16, 0.35), steelMat);
      var ox = (i % 2 === 0 ? -1 : 1) * 1.1;
      var oz = (i < 2 ? -1 : 1) * 1.1;
      leg.position.set(ox, 8.6, oz);
      leg.castShadow = true;
      this.tower.add(leg);
    }

    for (var h = 0; h < 5; h++) {
      var cross = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.2), steelMat);
      cross.position.set(0, 3 + h * 3, -1.1);
      this.tower.add(cross);
      var cross2 = cross.clone();
      cross2.position.z = 1.1;
      this.tower.add(cross2);
      var cross3 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.4), steelMat);
      cross3.position.set(-1.1, 3 + h * 3, 0);
      this.tower.add(cross3);
      var cross4 = cross3.clone();
      cross4.position.x = 1.1;
      this.tower.add(cross4);
    }

    this.jib = new THREE.Group();
    this.jib.position.set(0, 17.2, 10);
    this.scene.add(this.jib);

    var boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 14), baseMat);
    boom.position.set(0, 0, -5);
    boom.castShadow = true;
    this.jib.add(boom);

    var boomTop = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 14), steelMat);
    boomTop.position.set(0, 0.5, -5);
    this.jib.add(boomTop);

    for (var t = 0; t < 6; t++) {
      var strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), steelMat);
      strut.position.set(0, 0.25, -1 - t * 2);
      this.jib.add(strut);
    }

    var hookMount = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8), steelMat);
    hookMount.position.set(0, -0.2, -12);
    this.jib.add(hookMount);

    this.pivotMarker = new THREE.Object3D();
    this.pivotMarker.position.set(0, -0.2, -12);
    this.jib.add(this.pivotMarker);

    var counter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 2), darkMat);
    counter.position.set(0, 0, 2.5);
    this.jib.add(counter);
  };

  WreckingBall.prototype._buildBall = function () {
    var geo = new THREE.SphereGeometry(this.radius, 24, 20);
    var mat = new THREE.MeshStandardMaterial({
      color: 0x3a3e45,
      roughness: 0.45,
      metalness: 0.85
    });
    this.ballMesh = new THREE.Mesh(geo, mat);
    this.ballMesh.castShadow = true;
    this.scene.add(this.ballMesh);

    var spikeGeo = new THREE.ConeGeometry(0.18, 0.45, 6);
    var spikeMat = new THREE.MeshStandardMaterial({ color: 0x22252a, metalness: 0.9, roughness: 0.3 });
    for (var i = 0; i < 8; i++) {
      var spike = new THREE.Mesh(spikeGeo, spikeMat);
      var phi = (i / 8) * Math.PI * 2;
      spike.position.set(Math.cos(phi) * this.radius * 0.85, 0, Math.sin(phi) * this.radius * 0.85);
      spike.rotation.z = -Math.PI / 2;
      spike.rotation.y = -phi;
      this.ballMesh.add(spike);
    }

    var band = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius * 0.92, 0.08, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xf0a020, metalness: 0.6, roughness: 0.4 })
    );
    band.rotation.x = Math.PI / 2;
    this.ballMesh.add(band);

    this.body = new DemoPhysics.Body(this.ballMesh, {
      mass: 25,
      radius: this.radius,
      isBall: true
    });
    this.world.setBall(this.body);
  };

  WreckingBall.prototype._buildRope = function () {
    var ropeMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9, metalness: 0.2 });
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), ropeMat);
    this.scene.add(this.rope);

    this.chainLinks = [];
    for (var i = 0; i < 5; i++) {
      var link = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.04, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0x555960, metalness: 0.8, roughness: 0.35 })
      );
      this.scene.add(link);
      this.chainLinks.push(link);
    }
  };

  WreckingBall.prototype.getPivotWorld = function () {
    var p = new THREE.Vector3();
    this.pivotMarker.getWorldPosition(p);
    return p;
  };

  WreckingBall.prototype.setInput = function (swing, lengthDelta) {
    this.inputSwing = swing;
    this.inputLength = lengthDelta;
  };

  WreckingBall.prototype.smash = function () {
    this.smashPower = 1;
    var pivot = this.getPivotWorld();
    var dir = new THREE.Vector3().subVectors(this.ballMesh.position, pivot).normalize();
    var tangent = new THREE.Vector3(-dir.y, dir.x, 0);
    if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
    tangent.normalize();
    var boost = 22 + Math.abs(this.angVel) * 8;
    this.body.velocity.x += tangent.x * boost * (this.angVel >= 0 ? 1 : -1);
    this.body.velocity.y += 4;
    this.angVel += (this.angVel >= 0 ? 1 : -1) * 1.8;
  };

  WreckingBall.prototype.update = function (dt) {
    var swingForce = 3.5;
    this.angVel += this.inputSwing * swingForce * dt;
    this.angVelZ += this.inputSwing * 0.15 * dt;

    this.angVel *= Math.pow(0.25, dt);
    this.angVelZ *= Math.pow(0.3, dt);

    var gravityTorque = -Math.sin(this.angle) * 2.8;
    this.angVel += gravityTorque * dt;

    var maxVel = 3.2;
    if (this.angVel > maxVel) this.angVel = maxVel;
    if (this.angVel < -maxVel) this.angVel = -maxVel;
    if (this.angVelZ > 1.2) this.angVelZ = 1.2;
    if (this.angVelZ < -1.2) this.angVelZ = -1.2;

    this.angle += this.angVel * dt;
    this.angleZ += this.angVelZ * dt;

    if (this.angle > 1.35) { this.angle = 1.35; this.angVel *= -0.4; }
    if (this.angle < -1.35) { this.angle = -1.35; this.angVel *= -0.4; }
    if (this.angleZ > 0.7) { this.angleZ = 0.7; this.angVelZ *= -0.4; }
    if (this.angleZ < -0.7) { this.angleZ = -0.7; this.angVelZ *= -0.4; }

    this.ropeLength += this.inputLength * 8 * dt;
    if (this.ropeLength < this.minLength) this.ropeLength = this.minLength;
    if (this.ropeLength > this.maxLength) this.ropeLength = this.maxLength;

    this.jib.rotation.y = this.angleZ * 0.35;

    var pivot = this.getPivotWorld();
    this.pivot.copy(pivot);

    var targetX = pivot.x + Math.sin(this.angle) * this.ropeLength;
    var targetY = pivot.y - Math.cos(this.angle) * Math.cos(this.angleZ) * this.ropeLength;
    var targetZ = pivot.z + Math.sin(this.angleZ) * this.ropeLength * 0.85;

    if (targetY < this.radius + 0.05) {
      targetY = this.radius + 0.05;
      if (this.angVel * Math.sin(this.angle) > 0) this.angVel *= 0.5;
    }

    var prev = this.ballMesh.position.clone();
    var lerp = 1 - Math.pow(0.02, dt);
    this.ballMesh.position.x += (targetX - this.ballMesh.position.x) * Math.min(1, lerp * 3);
    this.ballMesh.position.y += (targetY - this.ballMesh.position.y) * Math.min(1, lerp * 3);
    this.ballMesh.position.z += (targetZ - this.ballMesh.position.z) * Math.min(1, lerp * 3);

    this.body.velocity.set(
      (this.ballMesh.position.x - prev.x) / Math.max(dt, 0.001),
      (this.ballMesh.position.y - prev.y) / Math.max(dt, 0.001),
      (this.ballMesh.position.z - prev.z) / Math.max(dt, 0.001)
    );

    if (this.smashPower > 0) {
      this.smashPower = Math.max(0, this.smashPower - dt * 2);
    }

    this._updateRope(pivot);
    this.ballMesh.rotation.x += this.angVel * dt * 0.5;
    this.ballMesh.rotation.z -= this.angVel * dt * 0.3;
  };

  WreckingBall.prototype._updateRope = function (pivot) {
    var ball = this.ballMesh.position;
    var mid = new THREE.Vector3().addVectors(pivot, ball).multiplyScalar(0.5);
    var len = pivot.distanceTo(ball);
    this.rope.position.copy(mid);
    this.rope.scale.set(1, len, 1);
    this.rope.lookAt(ball);
    this.rope.rotateX(Math.PI / 2);

    for (var i = 0; i < this.chainLinks.length; i++) {
      var t = (i + 1) / (this.chainLinks.length + 1);
      var link = this.chainLinks[i];
      link.position.lerpVectors(pivot, ball, t);
      link.lookAt(ball);
      link.rotateX(Math.PI / 2);
      link.visible = len > 3;
    }
  };

  WreckingBall.prototype.reset = function () {
    this.angle = 0;
    this.angleZ = 0;
    this.angVel = 0;
    this.angVelZ = 0;
    this.ropeLength = 12;
    this.inputSwing = 0;
    this.inputLength = 0;
    this.smashPower = 0;
    this.jib.rotation.y = 0;
    var pivot = this.getPivotWorld();
    this.ballMesh.position.set(pivot.x, pivot.y - this.ropeLength, pivot.z);
    this.body.velocity.set(0, 0, 0);
  };

  global.DemoWreckingBall = WreckingBall;
})(window);