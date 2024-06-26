import { TEXEL_ENCODING_TYPE, TEXTURE_WRAP } from 't3d';
import { Texture2DLoader } from 't3d/examples/jsm/loaders/Texture2DLoader.js';
import { ClusteredLightingManager } from 't3d/examples/jsm/render/ClusteredLightingManager.js';

import { DefaultEffectComposer, RenderListMask } from 't3d-effect-composer';
import { Inspector } from 't3d-effect-composer/examples/jsm/Inspector.js';

import { LensflareBuffer } from 't3d-effect-composer/examples/jsm/lensflare/LensflareBuffer.js';
import { LensflareEffect } from 't3d-effect-composer/examples/jsm/lensflare/LensflareEffect.js';
import { LensflareDebugger } from 't3d-effect-composer/examples/jsm/lensflare/LensflareDebugger.js';

import SnowEffect from 't3d-effect-composer/examples/jsm/weather/SnowEffect.js';
import RainEffect from 't3d-effect-composer/examples/jsm/weather/RainEffect.js';

import { GUI } from 'lil-gui';

export class EffectComposer extends DefaultEffectComposer {
  constructor(width, height, options) {
    super(width, height, options);

    this.getBuffer('SceneBuffer')._sceneRenderOptions.beforeRender = renderable => {
      const renderMode = this.renderMode;
      const lightingManager = this._lightingManager;
      const material = renderable.material;
      if (material.shaderName === 'ClusteredLightingPBR') {
        const useClusterLighting = renderMode !== 'Forward';
        if (material.defines.CLUSTER_LIGHT !== useClusterLighting) {
          material.defines.CLUSTER_LIGHT = useClusterLighting;
          material.needsUpdate = true;
        }

        const clusterDebug = renderMode === 'Forward+Debug';
        if (material.defines.CLUSTER_DEBUG !== clusterDebug) {
          material.defines.CLUSTER_DEBUG = clusterDebug;
          material.needsUpdate = true;
        }

        material.uniforms.maxLightsPerCell = lightingManager.maxLightsPerCell;

        if (!material._linkedUniforms) {
          material.uniforms.cells = lightingManager.cells;
          material.uniforms.cellsDotData = lightingManager.cellsDotData;
          material.uniforms.cellsTextureSize = lightingManager.cellsTextureSize;
          material.uniforms.cellsTransformFactors = lightingManager.cellsTransformFactors;

          material.uniforms.cellsTexture = lightingManager.cellsTexture;
          material.uniforms.lightsTexture = lightingManager.lightsTexture;

          material._linkedUniforms = true;
        }
      }
    };

    this.getBuffer('SceneBuffer').setOutputEncoding(TEXEL_ENCODING_TYPE.SRGB);
    this.getBuffer('SceneBuffer').renderLayers.unshift({ id: 2, mask: RenderListMask.ALL });

    // Fix foliage under snow
    this.getBuffer('GBuffer')._renderOptions.beforeRender = function (renderable, material) {
      if (material.alphaTest > 0) {
        material.alphaTest = 0.2; // default is 0.99
      }
    };

    this.addBuffer('LensflareBuffer', new LensflareBuffer(width, height));

    const textureLoader = new Texture2DLoader();
    const rainCoverTexture = textureLoader.load('./textures/RippleTex.png');
    rainCoverTexture.wrapS = rainCoverTexture.wrapT = TEXTURE_WRAP.REPEAT;

    const rainEffect = new RainEffect();
    rainEffect.active = false;
    rainEffect.coverStrength = 0.01;
    rainEffect.coverSize = 3;
    rainEffect.rainCoverTexture = rainCoverTexture;
    this.addEffect('Rain', rainEffect, 99);

    const snowEffect = new SnowEffect();
    snowEffect.active = false;
    snowEffect.cover = 0;
    this.addEffect('Snow', snowEffect, 100);

    const lensflareEffect = new LensflareEffect();
    this.addEffect('Lensflare', lensflareEffect, 101.5);

    this._syncAttachments();

    this.lensflareDebugger = new LensflareDebugger();
    this.renderMode = 'Forward+';

    this._lightingManager = new ClusteredLightingManager({
      maxLights: 128,
      maxLightsPerCell: 64,
      floatLights: false
    });
    this._inspector = null;
  }

  setRenderQuality(quality) {
    this.sceneMSAA = quality !== 'Low';

    const fxaaEffect = this.getEffect('FXAA');
    fxaaEffect.active = quality === 'Low';

    const colorCorrectionEffect = this.getEffect('ColorCorrection');
    colorCorrectionEffect.active = true;
    // colorCorrectionEffect.gamma = 1.2;
    colorCorrectionEffect.contrast = 1.09;
    colorCorrectionEffect.saturation = 1.3;
    // colorCorrectionEffect.exposure = 0;

    const ssaoEffect = this.getEffect('SSAO');
    ssaoEffect.active = quality === 'High';
    ssaoEffect.radius = 0.68;
    ssaoEffect.intensity = 0.5;
    ssaoEffect.quality = quality;
    ssaoEffect.autoSampleWeight = true;

    const ssrEffect = this.getEffect('SSR');
    ssrEffect.active = quality === 'High';
    ssrEffect.minGlossiness = 0.7;
    ssrEffect.strength = 0.9;
    ssrEffect.falloff = 0.9;

    const blurEdgeEffect = this.getEffect('BlurEdge');
    blurEdgeEffect.active = quality !== 'Low';
    blurEdgeEffect.offset = 0.8;

    const chromaticAberrationEffect = this.getEffect('ChromaticAberration');
    chromaticAberrationEffect.active = quality !== 'Low';
    chromaticAberrationEffect.chromaFactor = 0.0045;

    const bloomEffect = this.getEffect('Bloom');
    bloomEffect.threshold = 0.7;
    bloomEffect.smoothWidth = 0.3;
    bloomEffect.blurSize = 3;
    bloomEffect.strength = 0.3;
  }

  render(renderer, scene, camera, renderTarget) {
    const renderStates = scene.getRenderStates(camera);
    this._lightingManager.update(renderStates.camera, renderStates.lights, true);
    renderStates.lights.totalNum -= renderStates.lights.pointsNum;
    renderStates.lights.pointsNum = 0;
    renderStates.lights.hash._factor[4] = 0;

    super.render(renderer, scene, camera, renderTarget);
  }

  toggleInspector() {
    if (this._inspector) {
      this.hideInspector();
    } else {
      this.showInspector();
    }
  }

  showInspector() {
    this._inspector = new Inspector(this, GUI);
    this._inspector.gui.domElement.classList.add('top-left-corner');
  }

  hideInspector() {
    this._inspector.destroy();
    this._inspector = null;
  }
}
