import { BLEND_TYPE, TEXTURE_WRAP, Scene, TEXTURE_FILTER } from 't3d';
import { ReflectionProbe } from 't3d/examples/jsm/probes/ReflectionProbe.js';
import { Texture2DLoader } from 't3d/examples/jsm/loaders/Texture2DLoader.js';
import { TextureCubeLoader } from 't3d/examples/jsm/loaders/TextureCubeLoader.js';
import { SkyPrecomputeUtil, Clouds, Stars, Sky, SkyTimeline } from './libs/t3d-dynamic-sky/t3d.dynamicsky.module.js';
import { isNight } from './Utils.js';

import {
  START_TIME,
  SUN_EQUATOR_OFFSET,
  CAMERA_FAR,
  LIGHT_EXPOSURE,
  SKY_EXPOSURE,
  SUNLIGHT_STRENGTH,
  MOONLIGHT_STRENGTH
} from './Config.js';

export class SkyDome {
  constructor() {
    this._scene = new Scene();

    this._probe = new ReflectionProbe();
    this._probe.renderTarget.resize(1024, 1024); // sky resolution
    this._probe.renderTexture.minFilter = TEXTURE_FILTER.LINEAR;
    this._probe.renderTexture.generateMipmaps = false;

    this._sunLight = null;
    this._moonLight = null;

    this._clouds = null;
    this._stars = null;
    this._sky = null;

    this._skyTimeline = null;

    this._isReady = false;
  }

  init(renderer, capabilities, sunLight, moonLight, hemisphereLight) {
    const container = this._scene;

    // Resources

    const textureLoader = new Texture2DLoader();
    const texture = textureLoader.load('./textures/Sample_Rectangular_2048.jpg');
    texture.anisotropy = 16;
    texture.wrapS = texture.wrapT = TEXTURE_WRAP.REPEAT;

    const moonTexture = textureLoader.load('./textures/Full_Moon_glow.jpg');
    moonTexture.anisotropy = 16;

    const skyTexture = new TextureCubeLoader().load([
      './textures/cube/Night/posx.png',
      './textures/cube/Night/negx.png',
      './textures/cube/Night/posy.png',
      './textures/cube/Night/negy.png',
      './textures/cube/Night/posz.png',
      './textures/cube/Night/negz.png'
    ]);

    const skyPrecomputeUtil = new SkyPrecomputeUtil(capabilities);
    skyPrecomputeUtil.computeTransmittance(renderer);
    skyPrecomputeUtil.computeInscatter(renderer);

    // Clouds

    const clouds = new Clouds();
    clouds.renderOrder = 2;
    clouds.material.blending = BLEND_TYPE.NORMAL;
    clouds.material.uniforms._CameraFar = CAMERA_FAR;
    clouds.material.uniforms._CloudSampler = texture;
    clouds.material.uniforms._SkyColor = [158 / 255, 158 / 255, 158 / 255];
    container.add(clouds);

    // Sky

    const sky = new Sky();
    sky.material.uniforms._Inscatter = skyPrecomputeUtil.inscatterTexture;
    sky.material.uniforms._Transmittance = skyPrecomputeUtil.transmittanceTexture;
    sky.material.uniforms._MoonSampler = moonTexture;
    sky.material.uniforms._OuterSpaceCube = skyTexture;
    sky.material.uniforms._SkyExposure = SKY_EXPOSURE;
    sky.material.uniforms._CameraFar = CAMERA_FAR;
    sky.material.uniforms.betaR = skyPrecomputeUtil.betaR;
    container.add(sky);

    this._sunLight = sunLight;
    this._moonLight = moonLight;

    this._clouds = clouds;
    this._sky = sky;

    // Stars and Timeline

    return fetch('./data/StarsData.bytes')
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(blob);

        return new Promise(resolve => {
          reader.onload = e => {
            const bytesArray = new Float32Array(e.target.result);

            this._stars = new Stars(bytesArray);
            this._stars.renderOrder = 1;
            this._stars.material.transparent = true;
            this._stars.material.blending = BLEND_TYPE.ADD;
            this._stars.material.uniforms._CameraFar = CAMERA_FAR;
            container.add(this._stars);

            this._skyTimeline = new SkyTimeline({
              sunLight,
              moonLight,
              hemisphereLight,
              clouds,
              sky,
              stars: this._stars
            });
            this._skyTimeline._sunIntensity = SUNLIGHT_STRENGTH;
            this._skyTimeline._moonIntensity = MOONLIGHT_STRENGTH;

            this._skyTimeline._sunAndMoon.sunEquatorOffset = SUN_EQUATOR_OFFSET;
            this._skyTimeline._lightExposure = LIGHT_EXPOSURE;
            this._skyTimeline.timeline = START_TIME;

            this._isReady = true;

            resolve();
          };
        });
      });
  }

  get isReady() {
    return this._isReady;
  }

  set exposure(value) {
    this._sky.material.uniforms._SkyExposure = value;
  }

  get exposure() {
    return this._sky.material.uniforms._SkyExposure;
  }

  set lightExposure(value) {
    this._skyTimeline._lightExposure = value;
    this._skyTimeline.timeline = this._skyTimeline.timeline;
  }

  get lightExposure() {
    return this._skyTimeline._lightExposure;
  }

  set timeline(value) {
    this._skyTimeline.timeline = value;
  }

  get timeline() {
    return this._skyTimeline.timeline;
  }

  get sunPosition() {
    return this._sunLight.position;
  }

  get renderTexture() {
    return this._probe.renderTexture;
  }

  refresh() {
    const timeline = this.timeline;
    const _isNight = isNight(timeline);

    this._sunLight.shadow.needsUpdate = !_isNight;
    this._moonLight.shadow.needsUpdate = _isNight;
  }

  render(renderer, deltaTime) {
    if (this._isReady) {
      this._stars.material.uniforms._Time += (deltaTime / 1000) * 500;
    }
    this._clouds.material.uniforms._Rotation += deltaTime * 0.5;

    this._scene.updateMatrix();

    this._probe.render(renderer, this._scene);
  }
}
