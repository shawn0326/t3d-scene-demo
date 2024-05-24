import { Color3 } from 't3d';

export class LightsManager {
  constructor() {
    this.streetLamps = new LightPool();
    this.poolLights = new LightPool();
    this.lawnLamps = new LightPool();
    this.doorLights = new LightPool();
  }

  addLight(light) {
    if (light.name.startsWith('StreetLamp')) {
      this.streetLamps.addLight(light);
    } else if (light.name.startsWith('PoolLight')) {
      this.poolLights.addLight(light);
    } else if (light.name.startsWith('LawnLamp')) {
      this.lawnLamps.addLight(light);
    } else if (light.name.startsWith('DoorLight')) {
      this.doorLights.addLight(light);
    }
  }

  setDefault() {
    this.streetLamps.intensity = 1.94;
    this.streetLamps.color.setHex(0xfef5d2);
    this.streetLamps.distance = 8.4;
    this.streetLamps.decay = 0.69;

    this.poolLights.intensity = 2.61;
    this.poolLights.color.setHex(0x8ad2ff);
    this.poolLights.distance = 13.6;
    this.poolLights.decay = 1.58;

    this.lawnLamps.intensity = 2.29;
    this.lawnLamps.color.setHex(0xffffff);
    this.lawnLamps.distance = 16.2;
    this.lawnLamps.decay = 2;

    this.doorLights.intensity = 3.5;
    this.doorLights.color.setHex(0xd0cdfe);
    this.doorLights.distance = 11.8;
    this.doorLights.decay = 1.72;
  }

  setTime(time) {
    this.streetLamps.intensityScale = time < 6 || time > 18 ? 1 : 0;
    this.poolLights.intensityScale = time < 3 || time > 19.5 ? 1 : 0;
    this.lawnLamps.intensityScale = time < 4 || time > 18.5 ? 1 : 0;
    this.doorLights.intensityScale = time < 5 || time > 19 ? 1 : 0;
    this.update();
  }

  update() {
    this.streetLamps.update(this);
    this.poolLights.update(this);
    this.lawnLamps.update(this);
    this.doorLights.update(this);
  }
}

class LightPool {
  constructor() {
    this.lights = [];

    this.intensity = 1;
    this.color = new Color3(1, 1, 1);
    this.distance = 20;
    this.decay = 1;

    this.intensityScale = 0;
  }

  addLight(light) {
    this.lights.push(light);
  }

  update() {
    this.lights.forEach(light => {
      light.intensity = this.intensity * this.intensityScale;
      light.color.copy(this.color);
      light.distance = this.distance;
      light.decay = this.decay;
    });
  }
}
