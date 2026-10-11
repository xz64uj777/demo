(function (global) {
  'use strict';

  function Game(container) {
    this.container = container;
    this.width = 1;
    this.height = 1;

    this.score = 0;
    this.level = 1;
    this.timeLeft = 90;
    this.combo = 0;
    this.comboTimer = 0;
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.totalDestroyed = 0;
    this.levelDestroyed = 0;
    this.levelStartBlocks = 0;

    this.keys = {};
    this.pointer = { active: false, x: 0, y: 0, id: null };
    this.pinchStartDist = 0;
    this.pinchStartLen = 0;
    this.touches = {};

    this.clock = { last: 0, acc: 0 };
    this.dustParticles = [];
    this.shake = 0;

    this._initThree();
    this._initWorld();
    this._bindUI();
    this._onResize();
    window.addEventListener('resize', this._onResize.bind(this));
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  Game.prototype._initThree = function () {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b8d8);
    this.scene.fog = new THREE.Fog(0x87b8d8, 40, 95);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.camera.position.set(0, 14, 28);
    this.camera.lookAt(0, 6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    var amb = new THREE.AmbientLight(0xb0c4de, 0.55);
    this.scene.add(amb);

    var sun = new THREE.DirectionalLight(0xfff0dd, 0.95);
    sun.position.set(20, 35, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);

    var fill = new THREE.DirectionalLight(0x8ecae6, 0.25);
    fill.position.set(-15, 10, -10);
    this.scene.add(fill);

    this._buildEnvironment();
  };

  Game.prototype._buildEnvironment = function () {
    var groundGeo = new THREE.PlaneGeometry(120, 120, 20, 20);
    var groundMat = new THREE.MeshStandardMaterial({
      color: 0x5a6b4a,
      roughness: 0.95,
      metalness: 0.0
    });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    var pad = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshStandardMaterial({ color: 0x6b735c, roughness: 0.9 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.02;
    pad.receiveShadow = true;
    this.scene.add(pad);

    var grid = new THREE.GridHelper(40, 20, 0x4a5340, 0x4a5340);
    grid.position.y = 0.03;
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    this.scene.add(grid);

    var dirtMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 1 });
    for (var i = 0; i < 12; i++) {
      var rubble = new THREE.Mesh(
        new THREE.BoxGeometry(rand(0.3, 1.2), rand(0.15, 0.4), rand(0.3, 1)),
        dirtMat
      );
      var a = Math.random() * Math.PI * 2;
      var d = rand(14, 28);
      rubble.position.set(Math.cos(a) * d, 0.15, Math.sin(a) * d);
      rubble.rotation.y = Math.random() * Math.PI;
      rubble.castShadow = true;
      rubble.receiveShadow = true;
      this.scene.add(rubble);
    }

    this._buildSkyline();
    this._buildFence();
  };

  Game.prototype._buildSkyline = function () {
    var mat = new THREE.MeshStandardMaterial({ color: 0x6a8ba0, roughness: 0.85, metalness: 0.1 });
    var group = new THREE.Group();
    for (var i = 0; i < 18; i++) {
      var w = rand(2, 5);
      var h = rand(8, 28);
      var d = rand(2, 5);
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone());
      b.material.color.offsetHSL(0, 0, rand(-0.1, 0.1));
      var side = i < 9 ? -1 : 1;
      b.position.set(side * rand(35, 55), h * 0.5, rand(-40, 40));
      group.add(b);
    }
    this.scene.add(group);

    var mountainMat = new THREE.MeshStandardMaterial({ color: 0x7a9bb0, flatShading: true, roughness: 1 });
    for (var m = 0; m < 5; m++) {
      var mg = new THREE.ConeGeometry(rand(12, 22), rand(10, 18), 5);
      var mountain = new THREE.Mesh(mg, mountainMat);
      mountain.position.set(rand(-60, 60), 0, -55 - rand(0, 15));
      this.scene.add(mountain);
    }
  };

  Game.prototype._buildFence = function () {
    var postMat = new THREE.MeshStandardMaterial({ color: 0x444850, metalness: 0.5, roughness: 0.6 });
    var barMat = new THREE.MeshStandardMaterial({ color: 0xf0a020, metalness: 0.3, roughness: 0.5 });
    var positions = [
      { x: 0, z: -16, rot: 0, len: 30 },
      { x: -16, z: 0, rot: Math.PI / 2, len: 28 },
      { x: 16, z: 0, rot: Math.PI / 2, len: 28 }
    ];
    for (var p = 0; p < positions.length; p++) {
      var conf = positions[p];
      var fence = new THREE.Group();
      var segs = Math.floor(conf.len / 2);
      for (var s = 0; s < segs; s++) {
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), postMat);
        post.position.set(-conf.len * 0.5 + s * 2, 1.1, 0);
        fence.add(post);
      }
      var bar1 = new THREE.Mesh(new THREE.BoxGeometry(conf.len, 0.12, 0.08), barMat);
      bar1.position.y = 1.6;
      fence.add(bar1);
      var bar2 = bar1.clone();
      bar2.position.y = 0.7;
      fence.add(bar2);
      fence.position.set(conf.x, 0, conf.z);
      fence.rotation.y = conf.rot;
      this.scene.add(fence);
    }

    var sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.8, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xe63946 })
    );
    sign.position.set(10, 3.5, -15.5);
    this.scene.add(sign);
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 3.5, 8),
      postMat
    );
    pole.position.set(10, 1.75, -15.5);
    this.scene.add(pole);
  };

  Game.prototype._initWorld = function () {
    this.world = new DemoPhysics.PhysicsWorld();
    var self = this;
    this.world.onBlockDestroyed = function (body) {
      self._onDestroyed(body);
    };
    this.world.onBlockHit = function (body, impact) {
      self._onHit(body, impact);
    };
    this.crane = new DemoWreckingBall(this.scene, this.world);
  };

  Game.prototype._bindUI = function () {
    var self = this;
    this.el = {
      score: document.getElementById('score'),
      level: document.getElementById('level'),
      blocks: document.getElementById('blocks'),
      time: document.getElementById('time'),
      combo: document.getElementById('combo'),
      comboDisplay: document.getElementById('combo-display'),
      overlay: document.getElementById('overlay'),
      pauseOverlay: document.getElementById('pause-overlay'),
      endOverlay: document.getElementById('end-overlay'),
      endTitle: document.getElementById('end-title'),
      endStats: document.getElementById('end-stats'),
      btnStart: document.getElementById('btn-start'),
      btnResume: document.getElementById('btn-resume'),
      btnRestartP: document.getElementById('btn-restart-p'),
      btnNext: document.getElementById('btn-next'),
      btnRetry: document.getElementById('btn-retry'),
      btnSmash: document.getElementById('btn-smash'),
      btnPauseM: document.getElementById('btn-pause-m'),
      touchZone: document.getElementById('touch-zone')
    };

    this.el.btnStart.addEventListener('click', function () { self.startGame(); });
    this.el.btnResume.addEventListener('click', function () { self.setPaused(false); });
    this.el.btnRestartP.addEventListener('click', function () { self.restartLevel(); });
    this.el.btnNext.addEventListener('click', function () { self.nextLevel(); });
    this.el.btnRetry.addEventListener('click', function () { self.restartLevel(); });
    this.el.btnSmash.addEventListener('click', function (e) {
      e.preventDefault();
      if (self.running && !self.paused) self.crane.smash();
    });
    this.el.btnPauseM.addEventListener('click', function () {
      if (self.running) self.setPaused(!self.paused);
    });

    window.addEventListener('keydown', function (e) { self._onKey(e, true); });
    window.addEventListener('keyup', function (e) { self._onKey(e, false); });

    var tz = this.el.touchZone;
    tz.addEventListener('pointerdown', function (e) { self._onPointerDown(e); });
    tz.addEventListener('pointermove', function (e) { self._onPointerMove(e); });
    tz.addEventListener('pointerup', function (e) { self._onPointerUp(e); });
    tz.addEventListener('pointercancel', function (e) { self._onPointerUp(e); });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.running && !self.paused) self.setPaused(true);
    });
  };

  Game.prototype._onKey = function (e, down) {
    var k = e.key.toLowerCase();
    this.keys[k] = down;
    if (!down) return;

    if (k === 'p' || k === 'escape') {
      if (this.running && !this.ended) this.setPaused(!this.paused);
      e.preventDefault();
    }
    if (k === 'r' && this.running) {
      this.restartLevel();
      e.preventDefault();
    }
    if ((k === ' ' || k === 'enter') && this.running && !this.paused) {
      this.crane.smash();
      e.preventDefault();
    }
  };

  Game.prototype._onPointerDown = function (e) {
    this.touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    this.el.touchZone.setPointerCapture(e.pointerId);
    var ids = Object.keys(this.touches);
    if (ids.length === 1) {
      this.pointer.active = true;
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.originX = e.clientX;
      this.pointer.id = e.pointerId;
      this.pointer.startAngle = this.crane.angle;
      this.pointer.startLen = this.crane.ropeLength;
    } else if (ids.length === 2) {
      var t0 = this.touches[ids[0]];
      var t1 = this.touches[ids[1]];
      this.pinchStartDist = Math.hypot(t0.x - t1.x, t0.y - t1.y);
      this.pinchStartLen = this.crane.ropeLength;
    }
  };

  Game.prototype._onPointerMove = function (e) {
    if (!this.touches[e.pointerId]) return;
    this.touches[e.pointerId].x = e.clientX;
    this.touches[e.pointerId].y = e.clientY;
    var ids = Object.keys(this.touches);

    if (ids.length >= 2) {
      var a = this.touches[ids[0]];
      var b = this.touches[ids[1]];
      var dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchStartDist > 0) {
        var delta = (this.pinchStartDist - dist) / 80;
        this.crane.ropeLength = clamp(this.pinchStartLen + delta * 4, this.crane.minLength, this.crane.maxLength);
      }
      return;
    }

    if (!this.pointer.active || e.pointerId !== this.pointer.id) return;
    var dx = e.clientX - this.pointer.originX;
    var dy = e.clientY - this.pointer.originY;
    this.crane.angle = clamp(this.pointer.startAngle + dx * 0.004, -1.35, 1.35);
    this.crane.ropeLength = clamp(this.pointer.startLen + dy * 0.02, this.crane.minLength, this.crane.maxLength);
    this.crane.angVel = dx * 0.002;
  };

  Game.prototype._onPointerUp = function (e) {
    delete this.touches[e.pointerId];
    if (e.pointerId === this.pointer.id) {
      this.pointer.active = false;
      this.pointer.id = null;
    }
    if (Object.keys(this.touches).length < 2) this.pinchStartDist = 0;
  };

  Game.prototype.startGame = function () {
    this.score = 0;
    this.level = 1;
    this.totalDestroyed = 0;
    this.el.overlay.classList.add('hidden');
    this.el.endOverlay.classList.add('hidden');
    this.el.pauseOverlay.classList.add('hidden');
    this._loadLevel();
    this.running = true;
    this.paused = false;
    this.ended = false;
    this.clock.last = performance.now();
  };

  Game.prototype.restartLevel = function () {
    this.el.endOverlay.classList.add('hidden');
    this.el.pauseOverlay.classList.add('hidden');
    this._loadLevel();
    this.running = true;
    this.paused = false;
    this.ended = false;
    this.clock.last = performance.now();
  };

  Game.prototype.nextLevel = function () {
    this.level += 1;
    this.el.endOverlay.classList.add('hidden');
    this._loadLevel();
    this.running = true;
    this.paused = false;
    this.ended = false;
    this.clock.last = performance.now();
  };

  Game.prototype._loadLevel = function () {
    this.crane.reset();
    DemoBuilding.generateLevel(this.world, this.scene, this.level);
    this.levelStartBlocks = this.world.activeBlockCount();
    this.levelDestroyed = 0;
    this.timeLeft = Math.min(90 + this.level * 8, 150);
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this._clearDust();
    this._updateHUD();
  };

  Game.prototype.setPaused = function (v) {
    this.paused = v;
    if (v) {
      this.el.pauseOverlay.classList.remove('hidden');
    } else {
      this.el.pauseOverlay.classList.add('hidden');
      this.clock.last = performance.now();
    }
  };

  Game.prototype._onHit = function (body, impact) {
    if (impact > 6) {
      this.shake = Math.min(0.6, this.shake + impact * 0.008);
      this._spawnDust(body.mesh.position, Math.min(8, Math.floor(impact / 3)));
    }
  };

  Game.prototype._onDestroyed = function (body) {
    this.levelDestroyed++;
    this.totalDestroyed++;
    this.comboTimer = 2.2;
    this.combo = Math.min(this.combo + 1, 12);
    var mult = 1 + Math.floor(this.combo / 2) * 0.5;
    var pts = Math.floor(body.points * mult);
    this.score += pts;
    this._spawnDust(body.mesh.position.clone(), 12);
    this.shake = Math.min(0.8, this.shake + 0.15);
    this._updateHUD();

    if (this.world.activeBlockCount() <= 0) {
      this._levelClear();
    }
  };

  Game.prototype._levelClear = function () {
    this.ended = true;
    this.running = false;
    var timeBonus = Math.floor(this.timeLeft * 15);
    this.score += timeBonus;
    this.el.endTitle.textContent = 'LEVEL CLEAR!';
    this.el.endStats.textContent =
      'Blocks destroyed: ' + this.levelDestroyed +
      '\nTime bonus: +' + timeBonus +
      '\nTotal score: ' + this.score;
    this.el.btnNext.classList.remove('hidden');
    this.el.btnNext.style.display = 'block';
    this.el.endOverlay.classList.remove('hidden');
    this._updateHUD();
  };

  Game.prototype._levelFail = function () {
    this.ended = true;
    this.running = false;
    this.el.endTitle.textContent = 'TIME\'S UP';
    this.el.endStats.textContent =
      'Blocks left: ' + this.world.activeBlockCount() +
      '\nDestroyed: ' + this.levelDestroyed + ' / ' + this.levelStartBlocks +
      '\nScore: ' + this.score;
    this.el.btnNext.style.display = 'none';
    this.el.endOverlay.classList.remove('hidden');
  };

  Game.prototype._spawnDust = function (pos, count) {
    for (var i = 0; i < count; i++) {
      var mesh = new THREE.Mesh(
        new THREE.BoxGeometry(rand(0.1, 0.35), rand(0.1, 0.35), rand(0.1, 0.35)),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.08, 0.3, rand(0.3, 0.6)),
          roughness: 1
        })
      );
      mesh.position.copy(pos);
      mesh.position.x += rand(-0.5, 0.5);
      mesh.position.y += rand(0, 1);
      mesh.position.z += rand(-0.5, 0.5);
      this.scene.add(mesh);
      this.dustParticles.push({
        mesh: mesh,
        vel: new THREE.Vector3(rand(-4, 4), rand(2, 8), rand(-4, 4)),
        life: rand(0.4, 1.1)
      });
    }
  };

  Game.prototype._clearDust = function () {
    for (var i = 0; i < this.dustParticles.length; i++) {
      var d = this.dustParticles[i];
      if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
    }
    this.dustParticles = [];
  };

  Game.prototype._updateDust = function (dt) {
    for (var i = this.dustParticles.length - 1; i >= 0; i--) {
      var d = this.dustParticles[i];
      d.life -= dt;
      d.vel.y += -18 * dt;
      d.mesh.position.x += d.vel.x * dt;
      d.mesh.position.y += d.vel.y * dt;
      d.mesh.position.z += d.vel.z * dt;
      d.mesh.rotation.x += dt * 4;
      d.mesh.rotation.y += dt * 3;
      d.mesh.material.opacity = Math.max(0, d.life);
      d.mesh.material.transparent = true;
      if (d.life <= 0 || d.mesh.position.y < 0) {
        if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
        this.dustParticles.splice(i, 1);
      }
    }
  };

  Game.prototype._updateHUD = function () {
    this.el.score.textContent = String(this.score);
    this.el.level.textContent = String(this.level);
    this.el.blocks.textContent = String(this.world.activeBlockCount());
    this.el.time.textContent = String(Math.max(0, Math.ceil(this.timeLeft)));
    this.el.combo.textContent = String(this.combo);
    if (this.combo >= 2 && this.comboTimer > 0) {
      this.el.comboDisplay.classList.remove('hidden');
    } else {
      this.el.comboDisplay.classList.add('hidden');
    }
  };

  Game.prototype._readInput = function () {
    var swing = 0;
    var len = 0;
    if (this.keys['a'] || this.keys['arrowleft']) swing -= 1;
    if (this.keys['d'] || this.keys['arrowright']) swing += 1;
    if (this.keys['w'] || this.keys['arrowup']) len -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) len += 1;

    if (!this.pointer.active) {
      this.crane.setInput(swing, len);
    } else {
      this.crane.setInput(0, 0);
    }
  };

  Game.prototype._updateCamera = function (dt) {
    var ball = this.crane.ballMesh.position;
    var target = new THREE.Vector3(
      ball.x * 0.25,
      12 + ball.y * 0.15,
      26 + Math.abs(ball.x) * 0.05
    );
    this.camera.position.lerp(target, 1 - Math.pow(0.04, dt));

    var look = new THREE.Vector3(ball.x * 0.4, 5 + ball.y * 0.2, ball.z * 0.3);
    if (this.shake > 0) {
      look.x += (Math.random() - 0.5) * this.shake * 2;
      look.y += (Math.random() - 0.5) * this.shake * 2;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    this.camera.lookAt(look);
  };

  Game.prototype._onResize = function () {
    var w = this.container.clientWidth || window.innerWidth;
    var h = this.container.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  Game.prototype._loop = function (now) {
    requestAnimationFrame(this._loop);
    var dt = (now - (this.clock.last || now)) / 1000;
    this.clock.last = now;
    if (dt > 0.1) dt = 0.1;

    if (this.running && !this.paused && !this.ended) {
      this._readInput();
      this.crane.update(dt);
      this.world.step(dt);
      this._updateDust(dt);

      this.timeLeft -= dt;
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }

      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        if (this.world.activeBlockCount() > 0) this._levelFail();
        else this._levelClear();
      }

      this._checkFallenBlocks();
      this._updateHUD();
    } else {
      this.crane.update(dt * 0.15);
      this._updateDust(dt);
    }

    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };

  Game.prototype._checkFallenBlocks = function () {
    var bodies = this.world.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.alive || b.isBall || b.fallen) continue;
      var tipped = Math.abs(b.mesh.rotation.x) > 0.9 || Math.abs(b.mesh.rotation.z) > 0.9;
      var onGround = b.mesh.position.y - b.half.y <= 0.15;
      var far = Math.abs(b.mesh.position.x) > 14 || Math.abs(b.mesh.position.z) > 14;
      var lowAndMoving = onGround && b.velocity.length() < 0.3 && (tipped || far);

      if (b.mesh.position.y < -1 || (far && onGround && b.sleeping) || lowAndMoving && (tipped || far)) {
        if (far || tipped || b.mesh.position.y < -1) {
          b.fallen = true;
          b.alive = false;
          if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
          this._onDestroyed(b);
        }
      }
    }
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  global.DemoGame = Game;
})(window);