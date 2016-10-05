'use strict';

var THREE = require('../three');
var TWEEN = require('tween.js');

var Events = require('../../events/Events');
var State = require('../../state/State');
var settings = require('../../settings');
var glslify = require('glslify');

var AudioManager = require('../audio/AudioManager');

var ParticleSystem = require('./particles/ParticleSystem');

function IntroBall (obj) {
  THREE.Object3D.call(this);

  this.track;
  this.idAudio = 'introBall';

  this.isCollided = false;

  this.distanceToGamepad = 1;
  this.fadeInOutOpacity = 0;

  this.isActive = true;

  this.gamepadR = State.get('gamepadR');
  this.gamepadL = State.get('gamepadL');

  this.cameraForGlow = State.get('camera');
  this.addGlow();

  this.addRings();

  this.particleSystemR = new ParticleSystem();
  this.addTrail('R');

  this.particleSystemL = new ParticleSystem();
  this.addTrail('L');

  var geometry = new THREE.OctahedronGeometry(0.1, 0);
  var material = new THREE.MeshStandardMaterial({color: settings.offColor, roughness: 1, metalness: 0.5,
    emissive: 0xffffff, emissiveIntensity: 0.5, shading: THREE.FlatShading,
  transparent: true, opacity: 0.5});
  this.mesh = new THREE.Mesh(geometry, material);
  this.add(this.mesh);

  this.addAudio();
  Events.on('updateScene', this.update.bind(this));
  Events.on('introBallCollided', this.introBallCollided.bind(this));
  Events.on('stageChanged', this.stageChanged.bind(this));
  Events.on('updateSceneSpectator', this.updateSceneSpectator.bind(this));
}

IntroBall.prototype = Object.create(THREE.Object3D.prototype);

IntroBall.prototype.addGlow = function () {
  var glowGeometry = new THREE.SphereGeometry(0.2, 16, 16);
  var glowMaterial = new THREE.ShaderMaterial(
    {
      uniforms: {
        'c': { type: 'f', value: 0.0 },
        'p': { type: 'f', value: 6.0 },
        'opacity': { type: 'f', value: 1.0 },
        glowColor: { type: 'c', value: new THREE.Color(0xffffff) },
        viewVector: { type: 'v3', value: this.cameraForGlow.position }
      },
      vertexShader: glslify('../shaders/glow.vert'),
      fragmentShader: glslify('../shaders/glow.frag'),
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });

  this.glow = new THREE.Mesh(glowGeometry, glowMaterial.clone());
  this.add(this.glow);
};

IntroBall.prototype.addRings = function () {
  var geometryCircleLine = new THREE.CircleGeometry(0.2, 3);
  geometryCircleLine.vertices.shift();
  var materialCircleLine = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false});
  // materialCircleLine.linewidth = 2;

  this.ring01 = new THREE.Line(geometryCircleLine, materialCircleLine);
  this.add(this.ring01);

  geometryCircleLine = new THREE.CircleGeometry(0.15, 3);
  geometryCircleLine.vertices.shift();
  var materialRing3 = new THREE.LineDashedMaterial({
    color: 0xffffff,
  dashSize: 0.002, gapSize: 0.005, transparent: true, depthWrite: false});
  geometryCircleLine.computeLineDistances();
  this.ring02 = new THREE.Line(geometryCircleLine, materialRing3);
  this.add(this.ring02);
};

IntroBall.prototype.addTrail = function (side) {
  var g_trailParameters = {
    numParticles: 1,
    lifeTime: 2,
    startSize: 0.01,
    endSize: 0.025,
    velocity: [ 0.05, 0.05, 0.05],
    velocityRange: [0.1, 0.1, 0.1],
    spinSpeedRange: 0.08,
    billboard: true
  };
  this['g_trail' + side] = this['particleSystem' + side].createTrail(
    50   ,
    g_trailParameters,
    new THREE.TextureLoader().load('textures/magic.png'));
  this['g_trail' + side].setState(THREE.AdditiveBlending);
  this['g_trail' + side].setColorRamp(
    [1, 1, 1, 1,
      1, 1, 1, 0.5,
      1, 1, 1, 0]);
  // this['g_trail' + side].material.depthTest = false;
  this['g_trail' + side].material.depthWrite = false;
};

IntroBall.prototype.introBallCollided = function () {
  if (!this.isCollided) {
    this.isCollided = true;
    this.track.play();
    var self = this;
    new TWEEN.Tween(this.position).to({
      x: 0,
      y: 0.4,
      z: -0.1
    }, 2000)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    // new TWEEN.Tween(this.track.position).to({
    //   y: -1.2
    // }, 2000)
    //   .easing(TWEEN.Easing.Cubic.Out)
    //   .start();
    new TWEEN.Tween(this.mesh.material).to({
      opacity: 0
    }, 1000)
      .delay(1000)
      .easing(TWEEN.Easing.Cubic.In)
      .onComplete(function () {
        Events.emit('introBallStarted');
      })
      .start();
    new TWEEN.Tween(this.ring02.scale).to({
      x: 5,
      y: 5,
      z: 5
    }, 5200)
      .delay(1000)
      .easing(TWEEN.Easing.Cubic.In)
      .start();
    new TWEEN.Tween(this.ring02.material).to({
      opacity: 0
    }, 5200)
      .delay(1000)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .start();
    new TWEEN.Tween(this.ring01.material).to({
      opacity: 0
    }, 5200)
      .delay(1000)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .start();
    new TWEEN.Tween(this).to({
      distanceToGamepad: 0
    }, 5200)
      .delay(1000)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .onComplete(function () {
        self.mesh.visible = false;
        self.awayBall();
        self.glow.material.uniforms.opacity.value = 0;
        self.finalExplode();
      })
      .start();

    new TWEEN.Tween(this).to({
      fadeInOutOpacity: 1
    }, 3000)
      .easing(TWEEN.Easing.Cubic.Out)
      .onComplete(function () {
        self.fadeOutOpacity();
      })
      .start();

    var self = this;
    new TWEEN.Tween({
      volume: this.initalTrack.getVolume()
    })
      .to({ volume: 0 }, 1000)
      .onUpdate(function () {
        self.initalTrack.setVolume(this.volume);
      })
      .start();
  }
};

IntroBall.prototype.fadeOutOpacity = function () {
  new TWEEN.Tween(this).to({
    fadeInOutOpacity: 0
  }, 6000)
    .delay(6000)
    .onComplete(function () {
      self.isActive = false;
    })
    .start();
};
IntroBall.prototype.awayBall = function () {
  var self = this;
  new TWEEN.Tween({
    volume: this.track.getVolume()
  })
    .to({ volume: 0 }, 5000)
    .onUpdate(function () {
      self.track.setVolume(this.volume);
    })
    .start();
};

IntroBall.prototype.finalExplode = function () {
  this.ring01.rotation.set(Math.PI / 2, 0, 0);
  this.ring01.scale.set(0.1, 0.1, 0.1);
  this.ring01.material.opacity = 1;
  new TWEEN.Tween(this.ring01.scale).to({
    x: 5,
    y: 5,
    z: 5
  }, 500)
    .easing(TWEEN.Easing.Cubic.In)
    .start();
  new TWEEN.Tween(this.ring01.material).to({
    opacity: 0
  }, 500)
    .onComplete(function () {
      Events.emit('introBallCatched');
      Events.emit('stageChanged', 'experience');
    })
    .easing(TWEEN.Easing.Cubic.In)
    .start();
};

IntroBall.prototype.addAudio = function () {
  this.initalTrack = new AudioManager('effects/magic', true, this, true, true);
  this.track = new AudioManager(this.idAudio, true, this, false, false);
  this.track.setVolume(3);
};

IntroBall.prototype.update = function (delta, time) {
  if (!this.isActive) {
    return;
  }
  this.cameraForGlow = State.get('camera');
  this.updateCommon(delta, time);
};

IntroBall.prototype.updateSceneSpectator = function (delta, time) {
  if (!this.isActive) {
    return;
  }
  this.cameraForGlow = State.get('cameraSpectator');
  this.updateCommon(delta, time);
};

IntroBall.prototype.updateCommon = function (delta, time) {
  this.updateGlowOrientation();
  var scaleTime = 1 + (Math.cos(time * 2) / 4);
  this.glow.scale.set(scaleTime, scaleTime, scaleTime);

  this.ring01.rotation.x += 0.01;
  this.ring01.rotation.z += 0.01;

  this.ring02.rotation.y -= 0.01;
  this.ring02.rotation.z -= 0.01;

  this.particleSystemR.draw(this.cameraForGlow);
  this.particleSystemL.draw(this.cameraForGlow);
  if (this.distanceToGamepad < 1) {
    var posToGamepadR = this.gamepadR.position.clone().multiplyScalar(1 - this.distanceToGamepad);
    var posToGamepadL = this.gamepadL.position.clone().multiplyScalar(1 - this.distanceToGamepad);

    var posToIntroBall = this.position.clone().multiplyScalar(this.distanceToGamepad);

    posToGamepadR.add(posToIntroBall);
    posToGamepadL.add(posToIntroBall);
    this.g_trailR.birthParticles(
      [posToGamepadR.x, posToGamepadR.y, posToGamepadR.z], this.fadeInOutOpacity);
    this.g_trailL.birthParticles(
      [posToGamepadL.x, posToGamepadL.y, posToGamepadL.z], this.fadeInOutOpacity);
  } else {
    if (!this.isCollided) {
      this.position.x = Math.sin(time / 4) * 0.5;
      this.position.z = Math.cos(time / 4) * 0.5;
    }
    var absPos = new THREE.Vector3().setFromMatrixPosition(this.matrixWorld);
    this.g_trailR.birthParticles(
      [absPos.x + Math.cos(time * 2) * 0.1, absPos.y, absPos.z + Math.cos(time * 2) * 0.1], 1);
    this.g_trailL.birthParticles(
      [absPos.x + Math.sin(time * 2) * 0.1, absPos.y + Math.sin(time * 2) * 0.1, absPos.z], 1);
  }
};
IntroBall.prototype.updateGlowOrientation = function () {
  var cameraRelPos = new THREE.Vector3().setFromMatrixPosition(this.cameraForGlow.matrixWorld);
  var glowPos = new THREE.Vector3().setFromMatrixPosition(this.glow.matrixWorld);
  this.glow.material.uniforms.viewVector.value = new THREE.Vector3().subVectors(cameraRelPos, glowPos);
};

IntroBall.prototype.stageChanged = function (newStage) {
  var self = this;
  switch (newStage) {
    case 'experience':
      setTimeout(function () {
        self.isActive = false;
      }, 9000);

  }
};

module.exports = IntroBall;
