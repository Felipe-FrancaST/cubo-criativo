import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function ModelViewer3D({ src, style, background = "#0b1220" }) {
  const mountRef = React.useRef(null);
  const cleanupRef = React.useRef(() => {});

  React.useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight || 420;

    // cena / camera / renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(0, 0.3, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // luzes
    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 1.0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 2);
    dir.castShadow = true;
    scene.add(dir);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.target.set(0, 0, 0);

    // chão suave (sombra fake leve)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 64),
      new THREE.ShadowMaterial({ opacity: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // carregar modelo (STL ou GLB/GLTF)
    const ext = src.split(".").pop().toLowerCase();
    const group = new THREE.Group();
    scene.add(group);

    function frameObject(object3d) {
      // centraliza e enquadra
      const box = new THREE.Box3().setFromObject(object3d);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      object3d.position.sub(center); // centraliza no (0,0,0)
      controls.target.set(0, 0, 0);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = (camera.fov * Math.PI) / 180;
      let cameraZ = maxDim / (2 * Math.tan(fov / 2)) * 1.6;

      camera.position.set(0.6 * maxDim, 0.6 * maxDim, cameraZ);
      camera.near = maxDim / 100;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();
    }

    const onLoaded = (obj) => {
      let meshOrScene = obj;
      if (obj.scene) meshOrScene = obj.scene; // GLTF
      meshOrScene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // material padrão se for STL sem material
          if (!child.material) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xb9c2ff,
              metalness: 0.1,
              roughness: 0.6,
            });
          }
        }
      });
      group.add(meshOrScene);
      frameObject(group);
    };

    if (ext === "stl") {
      const loader = new STLLoader();
      loader.load(
        src,
        (geometry) => {
          const mat = new THREE.MeshStandardMaterial({
            color: 0xb9c2ff,
            metalness: 0.05,
            roughness: 0.65,
          });
          const mesh = new THREE.Mesh(geometry, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          onLoaded(group);
        },
        undefined,
        (err) => console.error("Falha ao carregar STL:", err)
      );
    } else if (ext === "glb" || ext === "gltf") {
      const loader = new GLTFLoader();
      loader.load(src, onLoaded, undefined, (err) => console.error("Falha ao carregar GLTF:", err));
    } else {
      console.error("Formato não suportado. Use .stl, .glb ou .gltf");
    }

    // resize
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    // loop
    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // cleanup
    cleanupRef.current = () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material?.dispose?.();
        }
      });
    };

    return () => cleanupRef.current();
  }, [src, background]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "min(70vh, 560px)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
