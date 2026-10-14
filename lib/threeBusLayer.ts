import * as maplibregl from 'maplibre-gl';
import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import { ActiveBus } from './types';
import { ROUTE_COLORS, DEFAULT_ROUTE_COLOR } from './transit';

const ORIGIN_LNG = 103.7745;
const ORIGIN_LAT = 1.2970;

export class ThreeBusLayer implements CustomLayerInterface {
  id = 'nus-shuttle-bus-3d';
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private scene: THREE.Scene = new THREE.Scene();
  private camera: THREE.Camera = new THREE.Camera();
  private renderer: THREE.WebGLRenderer | null = null;
  private busesMap: Map<string, THREE.Group> = new Map();
  private currentBuses: ActiveBus[] = [];

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      alpha: true,
    });
    this.renderer.autoClear = false;

    // Lighting setup for high contrast on dark basemaps
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(100, 200, 300);
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x90caf9, 0.8);
    fillLight.position.set(-100, -200, 150);
    this.scene.add(fillLight);

    this.rebuildBusMeshes();
  }

  public updateBuses(buses: ActiveBus[]) {
    this.currentBuses = buses;
    if (this.map) {
      this.rebuildBusMeshes();
      this.map.triggerRepaint();
    }
  }

  private createBusMesh(bus: ActiveBus): THREE.Group {
    const group = new THREE.Group();
    const routeColor = ROUTE_COLORS[bus.route] || DEFAULT_ROUTE_COLOR;

    // Scale factor 2.5x
    // Real bus dimensions: Length 10.5m, Width 2.6m, Height 3.2m
    // Scaled dimensions: Length 26.25m, Width 6.5m, Height 8.0m
    const length = 26.25;
    const width = 6.5;
    const height = 8.0;

    // 1. Lower White Chassis Body
    const bodyGeo = new THREE.BoxGeometry(width, length * 0.9, height * 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Crisp white
      roughness: 0.3,
      metalness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.z = height * 0.25;
    group.add(body);

    // 2. Tinted Glass Cabin
    const cabinGeo = new THREE.BoxGeometry(width * 0.94, length * 0.85, height * 0.35);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Dark tinted glass
      roughness: 0.1,
      metalness: 0.8,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.z = height * 0.65;
    group.add(cabin);

    // 3. Vibrant NUS Orange Roof
    const roofGeo = new THREE.BoxGeometry(width * 0.98, length * 0.92, height * 0.15);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xff7200, // Vibrant NUS Orange
      roughness: 0.4,
      metalness: 0.1,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.z = height * 0.9;
    group.add(roof);

    // 4. Route Identifier Stripe along roof sides
    const stripeGeo = new THREE.BoxGeometry(width * 1.02, length * 0.9, height * 0.08);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(routeColor),
      emissive: new THREE.Color(routeColor),
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.z = height * 0.82;
    group.add(stripe);

    // 5. Glowing Headlights (Front is +Y)
    const headlightGeo = new THREE.BoxGeometry(width * 0.25, 0.4, 0.8);
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 1.0,
      roughness: 0.1,
    });
    const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    leftHeadlight.position.set(-width * 0.32, (length * 0.9) / 2 + 0.1, height * 0.25);
    group.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    rightHeadlight.position.set(width * 0.32, (length * 0.9) / 2 + 0.1, height * 0.25);
    group.add(rightHeadlight);

    // 6. Glowing Taillights (Back is -Y)
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });
    const leftTaillight = new THREE.Mesh(headlightGeo, taillightMat);
    leftTaillight.position.set(-width * 0.32, -(length * 0.9) / 2 - 0.1, height * 0.25);
    group.add(leftTaillight);

    const rightTaillight = new THREE.Mesh(headlightGeo, taillightMat);
    rightTaillight.position.set(width * 0.32, -(length * 0.9) / 2 - 0.1, height * 0.25);
    group.add(rightTaillight);

    // 7. Rubber Wheels
    const wheelGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.9, 12);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
    });
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelOffsets = [
      [-width * 0.48, length * 0.3, 1.6],
      [width * 0.48, length * 0.3, 1.6],
      [-width * 0.48, -length * 0.3, 1.6],
      [width * 0.48, -length * 0.3, 1.6],
    ];

    for (const [wx, wy, wz] of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    }

    return group;
  }

  private rebuildBusMeshes() {
    const activeIds = new Set(this.currentBuses.map((b) => b.id));

    // Remove obsolete meshes
    for (const [id, mesh] of this.busesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.busesMap.delete(id);
      }
    }

    const originMercator = maplibregl.MercatorCoordinate.fromLngLat(
      [ORIGIN_LNG, ORIGIN_LAT],
      0
    );
    const meterScale = originMercator.meterInMercatorCoordinateUnits();

    // Add or update current meshes
    for (const bus of this.currentBuses) {
      let group = this.busesMap.get(bus.id);
      if (!group) {
        group = this.createBusMesh(bus);
        this.scene.add(group);
        this.busesMap.set(bus.id, group);
      }

      // Compute local position in meters relative to Kent Ridge origin
      const busMercator = maplibregl.MercatorCoordinate.fromLngLat([bus.lng, bus.lat], 0);
      const dx = (busMercator.x - originMercator.x) / meterScale;
      const dy = -(busMercator.y - originMercator.y) / meterScale;

      group.position.set(dx, dy, 0.5);

      // Rotate bus based on compass bearing (0 = North/+Y, 90 = East/+X)
      group.rotation.z = -(bus.bearing * Math.PI) / 180;
    }
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: any) {
    if (!this.map || !this.renderer) return;

    // Extract projection matrix supporting all MapLibre GL versions
    const rawMatrix =
      options?.defaultProjectionData?.mainMatrix ||
      (Array.isArray(options) ||
      options instanceof Float64Array ||
      options instanceof Float32Array
        ? options
        : options?.matrix);

    if (!rawMatrix) return;

    const originMercator = maplibregl.MercatorCoordinate.fromLngLat(
      [ORIGIN_LNG, ORIGIN_LAT],
      0
    );
    const meterScale = originMercator.meterInMercatorCoordinateUnits();

    // Double-precision matrix multiplication anchoring camera to Kent Ridge center
    const m = new THREE.Matrix4().fromArray(rawMatrix);
    const l = new THREE.Matrix4()
      .makeTranslation(originMercator.x, originMercator.y, originMercator.z)
      .scale(new THREE.Vector3(meterScale, -meterScale, meterScale));

    this.camera.projectionMatrix = m.multiply(l);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }

  onRemove() {
    for (const [, mesh] of this.busesMap) {
      this.scene.remove(mesh);
    }
    this.busesMap.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }
}
