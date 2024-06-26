import {
  Scene,
  Camera,
  LoadingManager,
  WebGLRenderer,
  RenderTargetBack,
  ShadowMapPass,
  TEXEL_ENCODING_TYPE,
  Color3,
  Vector3,
  DRAW_SIDE,
  DirectionalLight,
  HemisphereLight
} from 't3d';
import { Clock } from 't3d/examples/jsm/Clock.js';
import { GLTFLoader } from 't3d/examples/jsm/loaders/glTF/GLTFLoader.js';
import { OrbitControls } from 't3d/examples/jsm/controls/OrbitControls.js';
import { Texture2DLoader } from 't3d/examples/jsm/loaders/Texture2DLoader.js';
import { SkyBox } from 't3d/examples/jsm/objects/SkyBox.js';
import { DRACOLoader } from 't3d/examples/jsm/loaders/DRACOLoader.js';

import { LensflareMarker } from 't3d-effect-composer/examples/jsm/lensflare/LensflareMarker.js';
import Stats from 'stats.js';

import { GUI } from 'lil-gui';
import Nanobar from 'nanobar';
import { isNight, isPC, mix } from './Utils.js';
import { SkyDome } from './SkyDome.js';
import { EffectComposer } from './EffectComposer.js';
import { LightsManager } from './LightsManager.js';

import { default as TWEEN } from '@tweenjs/tween.js';

import { MaterialParser } from './externals/MaterialParser.js';

import {
  VERSION,
  MAX_LIGHT_FACTOR,
  CAMERA_FOV,
  CAMERA_FAR,
  CAMERA_VIEW,
  MAX_RAIN_COVER,
  MAX_SNOW_COVER,
  SKY_EXPOSURE,
  LIGHT_EXPOSURE,
  HEMLIGHT_STRENGTH
} from './Config.js';

export class App {
  constructor(el) {
    this.el = el;

    let width = window.innerWidth || 2;
    let height = window.innerHeight || 2;
    const devicePixelRatio = Math.min(window.devicePixelRatio, 2);

    // Resources

    const nanobar = new Nanobar();
    const loadingManager = new LoadingManager(
      function () {
        nanobar.go(100);
        nanobar.el.style.background = 'transparent';
      },
      function (url, itemsLoaded, itemsTotal) {
        if (itemsLoaded < itemsTotal) {
          nanobar.go((itemsLoaded / itemsTotal) * 100);
        }
      }
    );

    const textureLoader = new Texture2DLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./libs/draco/');

    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.replaceParser(MaterialParser, 7);
    gltfLoader.setDRACOLoader(dracoLoader);

    // const textureFlare0 = textureLoader.load("./textures/lensflare/lensflare0.png");
    const textureFlare3 = textureLoader.load('./textures/lensflare/hexagon_blur2.png');

    // Renderer

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    el.appendChild(canvas);

    const contextParams = { antialias: true, alpha: false, stencil: false };
    const gl = canvas.getContext('webgl2', contextParams) || canvas.getContext('webgl', contextParams);
    const renderer = new WebGLRenderer(gl);
    const backRenderTarget = new RenderTargetBack(canvas);

    const capabilities = renderer.capabilities;

    // Effect Composer

    const effectComposer = new EffectComposer(width * devicePixelRatio, height * devicePixelRatio, {
      samplerNumber: Math.min(capabilities.maxSamples, 5),
      webgl2: capabilities.version > 1,
      floatColorBuffer: !!capabilities.getExtension('EXT_color_buffer_float')
    });
    effectComposer.setRenderQuality(isPC() ? 'High' : 'Medium');

    el.addEventListener('keydown', e => {
      if (e.keyCode === 73) {
        effectComposer.toggleInspector();
      }
    });

    // Scene

    const scene = new Scene();

    // Lights

    const sunLight = new DirectionalLight();
    sunLight.castShadow = true;
    sunLight.shadow.windowSize = 100;
    sunLight.shadow.bias = -0.004;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.autoUpdate = false;
    sunLight.shadow.needsUpdate = true;
    scene.add(sunLight);

    const moonLight = new DirectionalLight();
    moonLight.castShadow = true;
    moonLight.shadow.windowSize = 100;
    moonLight.shadow.bias = -0.004;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.autoUpdate = false;
    moonLight.shadow.needsUpdate = true;
    scene.add(moonLight);

    const hemisphereLight = new HemisphereLight();
    hemisphereLight.intensity = HEMLIGHT_STRENGTH;
    scene.add(hemisphereLight);

    this.lightsManager = new LightsManager();
    this.lightsManager.setDefault();

    // Camera

    const camera = new Camera();
    camera.outputEncoding = TEXEL_ENCODING_TYPE.SRGB;
    const viewArray = CAMERA_VIEW[isPC() ? 'right_front' : 'far_left_front'];
    camera.position.fromArray(viewArray);
    camera.lookAt(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
    camera.setPerspective((CAMERA_FOV / 180) * Math.PI, width / height, 1, CAMERA_FAR);
    scene.add(camera);

    const sky_box = new SkyBox();
    sky_box.renderLayer = 2;
    camera.add(sky_box);

    // Lensflares

    const lensflareMarker = new LensflareMarker();
    lensflareMarker.occlusionScale = 0.1;
    lensflareMarker.lensflareElements = [
      // { texture: textureFlare0, color: new Color3(0.2, 0.2, 0.2), scale: 0.6, offset: 1 },
      { texture: textureFlare3, color: new Color3(0.2, 0.2, 0.2), scale: 0.05, offset: 0.4 },
      { texture: textureFlare3, color: new Color3(0.2, 0.2, 0.2), scale: 0.06, offset: 0.7 },
      { texture: textureFlare3, color: new Color3(0.3, 0.3, 0.3), scale: 0.1, offset: 0.9 },
      { texture: textureFlare3, color: new Color3(0.2, 0.2, 0.2), scale: 0.06, offset: 1 }
    ];
    scene.add(lensflareMarker);

    // Sky Dome

    const skyDome = new SkyDome();

    sky_box.texture = skyDome.renderTexture;
    scene.environment = skyDome.renderTexture;

    // Stats

    const stats = new Stats();
    stats.showPanel(0);
    el.appendChild(stats.dom);

    //

    this._skyDome = skyDome;
    this._clock = new Clock();
    this._controller = new OrbitControls(camera, canvas);
    this._renderer = renderer;
    this._scene = scene;
    this._camera = camera;
    this._effectComposer = effectComposer;
    this._shadowMapPass = new ShadowMapPass();
    this._backRenderTarget = backRenderTarget;
    this._lensflareMarker = lensflareMarker;
    this._stats = stats;

    this._lightFactor = MAX_LIGHT_FACTOR;
    this._timeGoes = false;
    this._timeSpeed = 2;
    this._waterScroll = true;

    this._waterMaterial = undefined;
    this._fountainMaterial = undefined;
    this._logoMaterial = undefined;
    this._windowMaterial = undefined;

    // Init

    skyDome.init(renderer, capabilities, sunLight, moonLight, hemisphereLight).then(() => {
      this.initGUI();
      this.refresh();
    });

    console.time('GLTFLoader');
    gltfLoader.load('./models/uino-scene.glb').then(result => {
      console.timeEnd('GLTFLoader');

      const root = result.root;

      root.traverse(node => {
        if (node.material) {
          if (node.material.name === 'logo') {
            this._logoMaterial = node.material;
          }
          if (node.material.name === 'window') {
            this._windowMaterial = node.material;
          }
          if (node.material.name === 'fountain') {
            this._fountainMaterial = node.material;
          }
          if (node.material.name === 'water') {
            this._waterMaterial = node.material;
          }
          if (node.material.alphaTest > 0) {
            node.material.roughness = 1;
            node.material.side = DRAW_SIDE.DOUBLE;
            node.material.alphaTest = 0.2;
          }
          node.castShadow = true;
          node.receiveShadow = true;
        }

        if (node.isPointLight) {
          this.lightsManager.addLight(node);
        }
      });

      scene.add(root);

      this.refresh();
    });

    window.addEventListener(
      'resize',
      () => {
        width = window.innerWidth || 2;
        height = window.innerHeight || 2;

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        camera.setPerspective((CAMERA_FOV / 180) * Math.PI, width / height, 1, CAMERA_FAR);

        backRenderTarget.resize(width * devicePixelRatio, height * devicePixelRatio);
        effectComposer.resize(width * devicePixelRatio, height * devicePixelRatio);
      },
      false
    );

    const loop = () => {
      requestAnimationFrame(loop);
      this.update();
    };
    requestAnimationFrame(loop);
  }

  update() {
    this._stats.begin();

    const deltaTime = this._clock.getDelta();

    if (this._timeGoes && this._skyDome.isReady) {
      this._skyDome.timeline = (this._skyDome.timeline + this._timeSpeed * deltaTime) % 24;
      this.refresh();
    }

    if (this._waterScroll) {
      if (this._waterMaterial) {
        this._waterMaterial.diffuseMapTransform.elements[7] += deltaTime * 0.2;
      }
      if (this._fountainMaterial) {
        this._fountainMaterial.diffuseMapTransform.elements[7] -= deltaTime * 0.8;
      }
    }

    TWEEN.update();

    this._controller.update();

    this._skyDome.render(this._renderer, deltaTime);

    this._scene.updateMatrix();
    this._scene.updateRenderStates(this._camera);
    this._scene.updateRenderQueue(this._camera);

    this._shadowMapPass.render(this._renderer, this._scene);

    this._renderer.setClearColor(0, 0, 0, 1);
    this._effectComposer.render(this._renderer, this._scene, this._camera, this._backRenderTarget);

    this._stats.end();
  }

  refresh() {
    this._skyDome.refresh();

    const time = this._skyDome.timeline;
    const _isNight = isNight(time);

    // update environmentLightIntensity
    this._scene.environmentLightIntensity = Math.max(Math.sin(((time - 6) / 12) * Math.PI), 0.0) * this._lightFactor;

    // update lensflare
    this._lensflareMarker.position.copy(this._skyDome.sunPosition).multiplyScalar(1.2);
    this._lensflareMarker.visible = !_isNight;

    // emissive
    if (this._logoMaterial) {
      const s = time < 6 || time > 17 ? 1 : 0;
      this._logoMaterial.emissive.setRGB(0.8 * s, 0.8 * s, 0.8 * s);
    }

    if (this._windowMaterial) {
      const s = (time >= 18 && time <= 24) || time < 4 ? 1 : 0;
      this._windowMaterial.emissive.setRGB(0.8 * s, 0.8 * s, 0.65 * s);
    }

    this._effectComposer.getEffect('Bloom').active = (time >= 18 && time <= 24) || time < 4;

    this.lightsManager.setTime(time);
  }

  initGUI() {
    const gui = new GUI();

    // Time

    gui
      .add(this._skyDome, 'timeline', 0, 24, 0.01)
      .name('time')
      .onChange(() => {
        this.refresh();
      })
      .listen()
      .decimals(2);

    const timeFolder = gui.addFolder('Time');
    timeFolder.add(this, '_timeGoes').name('auto');
    timeFolder.add(this, '_timeSpeed', -5, 5, 0.01).name('speed');
    timeFolder
      .add(this._skyDome._skyTimeline._sunAndMoon, 'sunEquatorOffset', -90, 90, 0.01)
      .name('sunEquatorOffset')
      .onChange(() => {
        this._skyDome.timeline = this._skyDome.timeline;
        this.refresh();
      });

    // Weather

    const weatherFolder = gui.addFolder('Weather');
    const rainEffect = this._effectComposer.getEffect('Rain');
    const snowEffect = this._effectComposer.getEffect('Snow');

    const weatherInfo = {
      rain: { active: false, weight: 0, tween: null, effect: rainEffect },
      snow: { active: false, weight: 0, tween: null, effect: snowEffect }
    };

    const applyWeatherWeight = () => {
      const rainWeight = weatherInfo.rain.weight;
      const snowWeight = weatherInfo.snow.weight;

      const weatherWeight = Math.max(rainWeight, snowWeight);

      rainEffect.strength = rainWeight;
      snowEffect.strength = snowWeight;

      rainEffect.coverStrength = mix(0, isPC() ? MAX_RAIN_COVER : 0, rainWeight); // close rain cover for mobile
      snowEffect.cover = mix(0, MAX_SNOW_COVER, snowWeight);

      this._skyDome.exposure = mix(SKY_EXPOSURE, SKY_EXPOSURE * 0.5, weatherWeight);
      this._skyDome.lightExposure = mix(LIGHT_EXPOSURE, LIGHT_EXPOSURE * 0.4, weatherWeight);
      this._lightFactor = mix(MAX_LIGHT_FACTOR, MAX_LIGHT_FACTOR * 0.6, weatherWeight);

      this._waterScroll = snowWeight < 0.5;

      this.refresh();
    };

    const runWeatherAnimation = (type, targetWeight) => {
      if (weatherInfo[type].tween) {
        weatherInfo[type].tween.stop();
        weatherInfo[type].tween = null;
      }

      weatherInfo[type].tween = new TWEEN.Tween(weatherInfo[type])
        .to({ weight: targetWeight }, 500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onStart(object => {
          object.effect.active = true;
        })
        .onUpdate(object => {
          applyWeatherWeight(object.weight);
        })
        .onComplete(object => {
          object.tween.stop();
          object.tween = null;
          object.effect.active = object.weight > 0;
        })
        .onStop(object => {
          object.tween.stop();
          object.tween = null;
          object.effect.active = object.weight > 0;
        })
        .start();
    };

    weatherFolder
      .add(weatherInfo.rain, 'active')
      .name('rain')
      .onChange(value => {
        runWeatherAnimation('rain', value ? 1 : 0);
      });
    weatherFolder
      .add(weatherInfo.snow, 'active')
      .name('snow')
      .onChange(value => {
        runWeatherAnimation('snow', value ? 1 : 0);
      });

    // View

    const viewFolder = gui.addFolder('View');
    const camraViewKeys = Object.keys(CAMERA_VIEW);
    camraViewKeys.forEach(viewName => {
      viewFolder
        .add(
          {
            viewName: () => {
              const fromPos = this._camera.position;
              const toPos = new Vector3(CAMERA_VIEW[viewName][0], CAMERA_VIEW[viewName][1], CAMERA_VIEW[viewName][2]);
              if (this._cameraTween) {
                this._cameraTween.stop();
                this._cameraTween = null;
              }
              let tween = new TWEEN.Tween(fromPos)
                .to(toPos, 1000)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                  this._camera.position.set(fromPos.x, fromPos.y, fromPos.z);
                })
                .start()
                .onComplete(() => {
                  tween.stop();
                  tween = null;
                })
                .onStop(() => {
                  tween.stop();
                  tween = null;
                });
              this._cameraTween = tween;
            }
          },
          'viewName'
        )
        .name(viewName);
    });

    // Effects

    const effectFolder = gui.addFolder('Effect');
    effectFolder
      .add({ quality: isPC() ? 'High' : 'Medium' }, 'quality', ['Low', 'Medium', 'High'])
      .onChange(quality => {
        this._effectComposer.setRenderQuality(quality);
      });
    effectFolder.close();

    // Lights

    const lightsFolder = gui.addFolder('Lights').close();
    const streetLampsFolder = lightsFolder.addFolder('StreetLamps').onChange(() => {
      this.lightsManager.streetLamps.update(this.lightsManager);
    });
    streetLampsFolder.add(this.lightsManager.streetLamps, 'intensity', 0, 4, 0.01);
    streetLampsFolder.addColor(this.lightsManager.streetLamps, 'color');
    streetLampsFolder.add(this.lightsManager.streetLamps, 'distance', 0, 100, 0.1);
    streetLampsFolder.add(this.lightsManager.streetLamps, 'decay', 0, 4, 0.01);
    const poolLightsFolder = lightsFolder.addFolder('PoolLights').onChange(() => {
      this.lightsManager.poolLights.update(this.lightsManager);
    });
    poolLightsFolder.add(this.lightsManager.poolLights, 'intensity', 0, 4, 0.01);
    poolLightsFolder.addColor(this.lightsManager.poolLights, 'color');
    poolLightsFolder.add(this.lightsManager.poolLights, 'distance', 0, 100, 0.1);
    poolLightsFolder.add(this.lightsManager.poolLights, 'decay', 0, 4, 0.01);
    const lawnLampsFolder = lightsFolder.addFolder('LawnLamps').onChange(() => {
      this.lightsManager.lawnLamps.update(this.lightsManager);
    });
    lawnLampsFolder.add(this.lightsManager.lawnLamps, 'intensity', 0, 4, 0.01);
    lawnLampsFolder.addColor(this.lightsManager.lawnLamps, 'color');
    lawnLampsFolder.add(this.lightsManager.lawnLamps, 'distance', 0, 100, 0.1);
    lawnLampsFolder.add(this.lightsManager.lawnLamps, 'decay', 0, 4, 0.01);
    const doorLightsFolder = lightsFolder.addFolder('DoorLights').onChange(() => {
      this.lightsManager.doorLights.update(this.lightsManager);
    });
    doorLightsFolder.add(this.lightsManager.doorLights, 'intensity', 0, 4, 0.01);
    doorLightsFolder.addColor(this.lightsManager.doorLights, 'color');
    doorLightsFolder.add(this.lightsManager.doorLights, 'distance', 0, 100, 0.1);
    doorLightsFolder.add(this.lightsManager.doorLights, 'decay', 0, 4, 0.01);

    // Debug

    const debugFolder = gui.addFolder('Debug');
    debugFolder.add(
      {
        logCamera: () => {
          const p = this._camera.position;
          console.log(`${p.x}, ${p.y}, ${p.z}`);
        }
      },
      'logCamera'
    );
    debugFolder.add(this._effectComposer, 'renderMode', ['Forward', 'Forward+', 'Forward+Debug']);
    debugFolder.add({ debugger: 'None' }, 'debugger', ['None', 'Lensflare']).onChange(value => {
      if (value === 'Lensflare') {
        this._effectComposer.debugger = this._effectComposer.lensflareDebugger;
      } else {
        this._effectComposer.debugger = null;
      }
    });
    debugFolder.close();

    //

    if (!isPC()) {
      gui.open();
      timeFolder.close();
      weatherFolder.close();
      viewFolder.close();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App(document.body, location);
  console.info(`ver: ${VERSION}`);
});
