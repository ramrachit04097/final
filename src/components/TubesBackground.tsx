import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface TubesBackgroundProps {
  opacity?: number;
  interactive?: boolean;
  className?: string;
}

export const TubesBackground: React.FC<TubesBackgroundProps> = ({
  opacity = 0.4,
  interactive = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.z = 48;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0x0f0b24, 1.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x8b7cff, 2.5, 90);
    pointLight1.position.set(0, 10, 25);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x6d5df5, 2.2, 80);
    pointLight2.position.set(-20, -10, 20);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x38bdf8, 1.8, 70);
    pointLight3.position.set(20, -15, 15);
    scene.add(pointLight3);

    // 4. Tubes Geometry & Materials
    // Palette: violet, indigo, lavender, electric blue, subtle pink highlights
    const colorPalette = [
      { color: 0x6d5df5, emissive: 0x221255, metalness: 0.8, roughness: 0.2 }, // MeetFlow Signature Violet
      { color: 0x8b7cff, emissive: 0x2a1d60, metalness: 0.7, roughness: 0.25 }, // Bright Lavender
      { color: 0x4f46e5, emissive: 0x161448, metalness: 0.85, roughness: 0.3 }, // Deep Indigo
      { color: 0x38bdf8, emissive: 0x0c3358, metalness: 0.9, roughness: 0.2 }, // Electric Blue
      { color: 0xec4899, emissive: 0x470c2a, metalness: 0.75, roughness: 0.35 }, // Subtle Pink Accent
      { color: 0xa78bfa, emissive: 0x351963, metalness: 0.8, roughness: 0.2 }, // Soft Lavender
    ];

    interface TubeData {
      mesh: THREE.Mesh;
      basePoints: THREE.Vector3[];
      speed: number;
      phase: number;
      amplitude: number;
      frequency: number;
    }

    const tubes: TubeData[] = [];
    const tubeCount = 7;

    for (let i = 0; i < tubeCount; i++) {
      const palette = colorPalette[i % colorPalette.length];
      const pointCount = 9;
      const points: THREE.Vector3[] = [];

      const xOffset = (i - tubeCount / 2) * 9;
      const zOffset = (Math.sin(i) - 0.5) * 16;

      for (let j = 0; j < pointCount; j++) {
        const y = (j / (pointCount - 1) - 0.5) * 55;
        const x = xOffset + Math.sin(j * 0.8 + i) * 6;
        const z = zOffset + Math.cos(j * 0.6 + i) * 8;
        points.push(new THREE.Vector3(x, y, z));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const radius = 0.55 + (i % 3) * 0.25;
      const geometry = new THREE.TubeGeometry(curve, 72, radius, 12, false);

      const material = new THREE.MeshStandardMaterial({
        color: palette.color,
        emissive: palette.emissive,
        emissiveIntensity: 0.6,
        roughness: palette.roughness,
        metalness: palette.metalness,
        transparent: true,
        opacity: opacity,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      tubes.push({
        mesh,
        basePoints: points.map((p) => p.clone()),
        speed: 0.0008 + (i % 4) * 0.0004,
        phase: i * 1.3,
        amplitude: 2.2 + (i % 3) * 1.2,
        frequency: 0.35 + (i % 2) * 0.2,
      });
    }

    // 5. Pointer tracking with smooth inertia damping
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      if (!interactive) return;
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    // 6. Responsive Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // 7. Animation Loop
    let clockTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      clockTime += 0.015;

      // Smooth mouse interpolation
      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;

      // Camera subtle parallax
      camera.position.x = mouseX * 6;
      camera.position.y = -mouseY * 4;
      camera.lookAt(0, 0, 0);

      // Light cursor following
      pointLight1.position.x = mouseX * 25;
      pointLight1.position.y = -mouseY * 20 + 5;
      pointLight2.position.x = -mouseX * 20 - 10;
      pointLight2.position.y = mouseY * 15 - 5;

      // Animate tubes
      for (let i = 0; i < tubes.length; i++) {
        const tube = tubes[i];
        const newPoints: THREE.Vector3[] = [];

        for (let j = 0; j < tube.basePoints.length; j++) {
          const bp = tube.basePoints[j];
          const offset = Math.sin(clockTime * tube.speed * 80 + tube.phase + j * tube.frequency) * tube.amplitude;
          const mouseEffect = Math.sin((j / tube.basePoints.length) * Math.PI) * 4;

          newPoints.push(
            new THREE.Vector3(
              bp.x + offset + mouseX * mouseEffect,
              bp.y + Math.cos(clockTime * 0.8 + j * 0.4) * 0.8,
              bp.z + offset * 0.8 - mouseY * mouseEffect
            )
          );
        }

        const newCurve = new THREE.CatmullRomCurve3(newPoints);
        const radius = 0.55 + (i % 3) * 0.25;
        const newGeometry = new THREE.TubeGeometry(newCurve, 72, radius, 12, false);

        tube.mesh.geometry.dispose();
        tube.mesh.geometry = newGeometry;
        tube.mesh.rotation.y = Math.sin(clockTime * 0.2 + i) * 0.08;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('resize', handleResize);

      tubes.forEach((t) => {
        t.mesh.geometry.dispose();
        if (Array.isArray(t.mesh.material)) {
          t.mesh.material.forEach((m) => m.dispose());
        } else {
          t.mesh.material.dispose();
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [opacity, interactive]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
};
