'use strict';

var THREE = require('../three');
var TWEEN = require('tween.js');

var Events = require('../../events/Events');
var settings = require('../../settings');
var State = require('../../state/State');

var BlendCharacter = require('../animation/BlendCharacter');

function RaceMesh (obj) {
  THREE.Object3D.call(this);

  this.race = obj;

  this.clampedIntensity = 0;
  this.isElevationStarted = false;

  // From 0 to 0.08 when the race is aspleep waiting to be wake up
  this.asleepBreatheFactor = 0;
  this.randomBreatheFrequency = Math.random() * 3 + 1;
  this.randomInitTime = Math.random() * 30;

  this.mesh = new THREE.BlendCharacter();
  var self = this;
  this.mesh.load('models/races/' + this.race.name + '.json', function () {
    self.mesh.castShadow = true;
    self.mesh.receiveShadow = true;
    self.mesh.material = new THREE.MeshStandardMaterial({
      color: settings.offColor,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color(settings[self.race.name + 'Color']),
      emissiveIntensity: 0,
      shading: THREE.FlatShading,
      transparent: true,
      skinning: true
    });

    self.add(self.mesh);
    Events.on('updateScene', self.update.bind(self));
    Events.on('raceStatusChanged', self.raceStatusChanged.bind(self));
    Events.on('elevationStarted', self.elevationStarted.bind(self));
    self.mesh.play('idle', 1);
    self.mesh.play('awake', 0);
  });
}

RaceMesh.prototype = Object.create(THREE.Object3D.prototype);

RaceMesh.prototype.update = function (delta, time) {
  if (State.get('endMode') === 1) {
    if (State.get('stage') === 'ending') {
      this.mesh.update(delta);
      return;
    }
  } else {
    if (this.isElevationStarted) {
      this.mesh.update(delta);
      return;
    }
  }
  var mappedIntensity = THREE.Math.mapLinear(this.race.track.averageAnalyser * this.race.track.getVolume(), 0, 100, 0, 1);
  this.clampedIntensity = THREE.Math.clamp(mappedIntensity, 0, 1);
  this.scale.y = 1 + this.clampedIntensity / 3;
  this.mesh.material.emissiveIntensity = this.clampedIntensity * 0.3;

  if (!this.race.isAwake) {
    // Slow idle animation
    this.mesh.applyWeight('idle', 1 - this.clampedIntensity);
    this.mesh.applyWeight('awake', this.clampedIntensity);
    this.mesh.update(delta * 0.2);
    if (State.get('stage') === 'experience') {
      this.asleepBreatheFactor = THREE.Math.clamp(Math.sin((time / this.randomBreatheFrequency) + this.randomInitTime) * 0.1, 0, 0.1);
      this.mesh.material.emissiveIntensity = this.asleepBreatheFactor;
    }
  } else {
    this.mesh.update(delta);
  }
};

RaceMesh.prototype.raceStatusChanged = function (race, status) {
  if (this.race === race && status === 'awake') {
    this.adjustWeight = this.clampedIntensity;
    new TWEEN.Tween(this).to({
      adjustWeight: 1
    }, 2000)
      .onUpdate(function () {
        this.updateWeight();
      })
      .start();
  }
};

RaceMesh.prototype.updateWeight = function () {
  this.mesh.applyWeight('idle', 1 - this.adjustWeight);
  this.mesh.applyWeight('awake', this.adjustWeight);
};

RaceMesh.prototype.elevationStarted = function () {
  this.isElevationStarted = true;
  new TWEEN.Tween(this.mesh.material).to({
    emissiveIntensity: 1
  }, 15000)
    .easing(TWEEN.Easing.Quadratic.In)
    .start();
  new TWEEN.Tween(this.mesh.material).to({
    opacity: 0.5
  }, 10000)
    .start();
  this.mesh.applyWeight('idle', 0);
  this.mesh.applyWeight('awake', 1);
};

RaceMesh.prototype.updateAtEnding = function (delta, time) {};

module.exports = RaceMesh;
