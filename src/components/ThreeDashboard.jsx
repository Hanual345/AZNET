import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Activity, ShieldAlert, Package, Check, RefreshCw, X, Box as BoxIcon } from 'lucide-react';

export default function ThreeDashboard({ assets, users, onActionSuccess }) {
  const containerRef = useRef(null);
  const [hoveredAsset, setHoveredAsset] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [checkoutUser, setCheckoutUser] = useState('');
  const [checkoutQty, setCheckoutQty] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Keep a ref of meshes to match them during raycasting
  const meshesRef = useRef([]);
  // Scene objects for updates
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameId = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- SETUP SCENE ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);
    scene.fog = new THREE.FogExp2(0x080c14, 0.035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 15, 25);
    cameraRef.current = camera;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("WebGL is not supported in this environment:", e);
      setErrorMessage("3D Visualizer disabled: WebGL context is not supported or disabled in your browser.");
      return;
    }

    // --- CONTROLS ---
    let controls;
    try {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
      controls.minDistance = 5;
      controls.maxDistance = 60;
    } catch (e) {
      console.warn("OrbitControls initialization failed:", e);
    }

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x06b6d4, 0.8);
    dirLight1.position.set(10, 20, 10);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8b5cf6, 0.4);
    dirLight2.position.set(-10, 10, -10);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.5, 30);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    // --- FLOOR GRID ---
    const gridHelper = new THREE.GridHelper(80, 80, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // --- CYBER FLOOR CIRCLE ---
    const ringGeo = new THREE.RingGeometry(18, 18.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // --- WAREHOUSE SHELVES ---
    // Generate shelves based on categories/locations
    const shelfGeo = new THREE.BoxGeometry(16, 0.2, 3);
    const shelfMat = new THREE.MeshStandardMaterial({ 
      color: 0x1e293b, 
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 0.7
    });

    const pillarGeo = new THREE.BoxGeometry(0.3, 12, 0.3);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });

    // Rack 1 (Left Shelf System)
    const shelfYLevels = [1, 4, 7];
    shelfYLevels.forEach(y => {
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.set(-10, y, 0);
      scene.add(shelf);
    });
    // Pillars for Rack 1
    const p1 = new THREE.Mesh(pillarGeo, pillarMat); p1.position.set(-18, 6, -1.5); scene.add(p1);
    const p2 = new THREE.Mesh(pillarGeo, pillarMat); p2.position.set(-2, 6, -1.5); scene.add(p2);
    const p3 = new THREE.Mesh(pillarGeo, pillarMat); p3.position.set(-18, 6, 1.5); scene.add(p3);
    const p4 = new THREE.Mesh(pillarGeo, pillarMat); p4.position.set(-2, 6, 1.5); scene.add(p4);

    // Rack 2 (Right Shelf System)
    shelfYLevels.forEach(y => {
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.set(10, y, 0);
      scene.add(shelf);
    });
    // Pillars for Rack 2
    const p5 = new THREE.Mesh(pillarGeo, pillarMat); p5.position.set(2, 6, -1.5); scene.add(p5);
    const p6 = new THREE.Mesh(pillarGeo, pillarMat); p6.position.set(18, 6, -1.5); scene.add(p6);
    const p7 = new THREE.Mesh(pillarGeo, pillarMat); p7.position.set(2, 6, 1.5); scene.add(p7);
    const p8 = new THREE.Mesh(pillarGeo, pillarMat); p8.position.set(18, 6, 1.5); scene.add(p8);

    // --- SEEDING 3D ASSET OBJECTS ---
    meshesRef.current = [];
    
    // Distribute assets on shelves
    assets.forEach((asset, idx) => {
      // Determine positions based on category/index
      const isLeft = idx % 2 === 0;
      const shelfIndex = Math.floor(idx / 2) % 3; // 0, 1, 2
      const xOffset = -6 + ((idx % 3) * 6); // spread horizontally on shelf
      
      const x = isLeft ? -10 + xOffset : 10 + xOffset;
      const y = shelfYLevels[shelfIndex] + 0.8;
      const z = (idx % 2 === 0) ? -0.5 : 0.5;

      let geometry;
      let material;

      // Base emissive colors
      let glowColor = 0x06b6d4; // Available: Cyan
      if (asset.type === 'serialized') {
        if (asset.status === 'Checked Out') glowColor = 0xa78bfa; // Checked Out: Lavender/Violet
        if (asset.status === 'Maintenance') glowColor = 0xf59e0b; // Maintenance: Amber
      } else {
        glowColor = 0x10b981; // Bulk Consumables: Emerald green
      }

      // Generate visual geometry representing the asset type
      if (asset.type === 'serialized') {
        if (asset.category.toLowerCase().includes('camera')) {
          // Camera visual: Combo of box and cylinder
          geometry = new THREE.BoxGeometry(1.2, 0.8, 0.8);
        } else if (asset.category.toLowerCase().includes('drill') || asset.category.toLowerCase().includes('tool')) {
          // Tool: T-shape/cylinder
          geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.4, 16);
        } else {
          // Laptop or other electronics: flat box
          geometry = new THREE.BoxGeometry(1.4, 0.2, 1.1);
        }

        material = new THREE.MeshStandardMaterial({
          color: glowColor,
          roughness: 0.2,
          metalness: 0.8,
          emissive: glowColor,
          emissiveIntensity: asset.status === 'Maintenance' ? 0.3 : 0.15
        });
      } else {
        // Bulk consumables represented as cluster arrays or torus/spheres
        geometry = new THREE.TorusGeometry(0.5, 0.15, 8, 24);
        material = new THREE.MeshStandardMaterial({
          color: glowColor,
          roughness: 0.4,
          metalness: 0.5,
          emissive: glowColor,
          emissiveIntensity: 0.2
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Attach database details
      mesh.userData = { asset };
      scene.add(mesh);
      meshesRef.current.push(mesh);
    });

    // --- DUST PARTICLES ---
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 250;
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 60;
      posArray[i + 1] = Math.random() * 20;
      posArray[i + 2] = (Math.random() - 0.5) * 60;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.1,
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- RAYCASTER FOR SELECTION ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(meshesRef.current);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        setHoveredAsset(mesh.userData.asset);
        document.body.style.cursor = 'pointer';

        // Add a hover glow effect in 3D
        meshesRef.current.forEach(m => {
          if (m === mesh) {
            m.scale.set(1.2, 1.2, 1.2);
            m.material.emissiveIntensity = 0.8;
          } else {
            m.scale.set(1, 1, 1);
            m.material.emissiveIntensity = m.userData.asset.status === 'Maintenance' ? 0.3 : 0.15;
          }
        });
      } else {
        setHoveredAsset(null);
        document.body.style.cursor = 'default';
        meshesRef.current.forEach(m => {
          m.scale.set(1, 1, 1);
          m.material.emissiveIntensity = m.userData.asset.status === 'Maintenance' ? 0.3 : 0.15;
        });
      }
    };

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(meshesRef.current);

      if (intersects.length > 0) {
        const asset = intersects[0].object.userData.asset;
        setSelectedAsset(asset);
        setErrorMessage('');
        setCheckoutUser('');
        setCheckoutQty(1);

        // Animate camera to focus on object
        const targetPos = intersects[0].object.position;
        // Move camera closer to object
        const offset = new THREE.Vector3(0, 3, 6);
        const newCamPos = targetPos.clone().add(offset);
        
        // Let controls target this object
        controls.target.copy(targetPos);
        
        // Simple lerp animation inside render loop
        let progress = 0;
        const animateCamera = () => {
          if (progress < 1) {
            progress += 0.05;
            camera.position.lerp(newCamPos, 0.1);
            requestAnimationFrame(animateCamera);
          }
        };
        animateCamera();
      }
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    // --- ANIMATION LOOP ---
    let time = 0;
    const animate = () => {
      time += 0.01;
      if (controls) controls.update();

      // Slow rotation for custom float meshes
      meshesRef.current.forEach((mesh, index) => {
        mesh.rotation.y += 0.01;
        // Subtle floating bounce animation
        mesh.position.y += Math.sin(time + index) * 0.002;

        // Pulse the glowing emissive light of maintenance assets
        if (mesh.userData.asset.status === 'Maintenance') {
          mesh.material.emissiveIntensity = 0.3 + Math.sin(time * 4) * 0.2;
        }
      });

      // Slowly rotate particle field
      particles.rotation.y = time * 0.02;

      renderer.render(scene, camera);
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    // --- RESIZE HANDLER ---
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 550;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener('mousemove', onMouseMove);
        rendererRef.current.domElement.removeEventListener('click', onClick);
        if (containerRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      if (controls) controls.dispose();
    };
  }, [assets]);

  // Actions
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!checkoutUser) {
      setErrorMessage('Please select a user');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: Number(checkoutUser),
          quantity: selectedAsset.type === 'bulk' ? Number(checkoutQty) : 1
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout failed');
      
      onActionSuccess();
      setSelectedAsset(null);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: selectedAsset.type === 'bulk' ? Number(checkoutQty) : 1
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkin failed');
      
      onActionSuccess();
      setSelectedAsset(null);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMaintenance = async (action) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Maintenance transition failed');
      
      onActionSuccess();
      setSelectedAsset(null);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[550px] rounded-xl overflow-hidden border border-slate-800 glass-card">
      {errorMessage && !selectedAsset ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950/20">
          <ShieldAlert className="w-12 h-12 text-cyan-500 animate-pulse mb-3" />
          <h4 className="text-white font-bold text-base mb-2">3D Render Environment Fault</h4>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
            {errorMessage}
          </p>
          <div className="text-[10px] text-slate-500 font-mono">
            Fallback mode active: navigate to other tabs using the sidebar.
          </div>
        </div>
      ) : (
        <>
          {/* 3D Render Target */}
          <div ref={containerRef} className="w-full h-full" />

          {/* Instruction Overlay */}
          <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 pointer-events-none flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Rotate scene: Left-click + Drag | Zoom: Scroll | Select asset: Click 3D object</span>
          </div>
        </>
      )}

      {/* Hover Card */}
      {hoveredAsset && !selectedAsset && (
        <div className="absolute bottom-4 left-4 bg-slate-950/90 backdrop-blur-md p-4 rounded-xl border border-cyan-500/30 text-left pointer-events-none w-72 shadow-2xl animate-fade-in">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold font-mono">
              {hoveredAsset.type}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
              hoveredAsset.status === 'Available' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
              hoveredAsset.status === 'Checked Out' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
              hoveredAsset.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}>
              {hoveredAsset.type === 'serialized' ? hoveredAsset.status : `${hoveredAsset.quantity_available}/${hoveredAsset.quantity_total} left`}
            </span>
          </div>
          <h4 className="text-white font-semibold text-sm mt-1.5">{hoveredAsset.name}</h4>
          {hoveredAsset.type === 'serialized' && (
            <p className="text-xs text-slate-400 font-mono mt-1">S/N: {hoveredAsset.serial_number}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">Location: {hoveredAsset.location}</p>
        </div>
      )}

      {/* Selected Drawer / Modal */}
      {selectedAsset && (
        <div className="absolute top-0 right-0 h-full w-96 bg-slate-950/95 backdrop-blur-lg border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl z-10 animate-slide-in">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <BoxIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-lg">Asset Inspector</h3>
              </div>
              <button 
                onClick={() => setSelectedAsset(null)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Asset Metadata */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block">Name</label>
                <span className="text-white text-base font-semibold block">{selectedAsset.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">Type</label>
                  <span className="text-slate-300 font-medium capitalize text-sm block">{selectedAsset.type}</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">Category</label>
                  <span className="text-slate-300 font-medium text-sm block">{selectedAsset.category}</span>
                </div>
              </div>
              {selectedAsset.type === 'serialized' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block">Serial Number</label>
                      <span className="text-slate-300 font-mono text-sm block">{selectedAsset.serial_number}</span>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block">Status</label>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold mt-1 border ${
                        selectedAsset.status === 'Available' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                        selectedAsset.status === 'Checked Out' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {selectedAsset.status}
                      </span>
                    </div>
                  </div>
                  {selectedAsset.status === 'Checked Out' && selectedAsset.current_user_name && (
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block">Currently Checked Out To</label>
                      <span className="text-cyan-400 font-semibold text-sm block">{selectedAsset.current_user_name}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Stock Available</label>
                    <span className="text-emerald-400 font-bold text-base block">
                      {selectedAsset.quantity_available} / {selectedAsset.quantity_total}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Value / Unit</label>
                    <span className="text-slate-300 font-mono text-sm block">${selectedAsset.cost.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">Location</label>
                  <span className="text-slate-300 text-sm block">{selectedAsset.location}</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">Total Cost</label>
                  <span className="text-slate-300 font-mono text-sm block">${(selectedAsset.cost * (selectedAsset.quantity_total || 1)).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 p-3 bg-red-950/50 border border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Action Context Menu */}
          <div className="border-t border-slate-900 pt-6 mt-6">
            {/* Serialized - Available Actions */}
            {selectedAsset.type === 'serialized' && selectedAsset.status === 'Available' && (
              <form onSubmit={handleCheckout} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Assign Checkout User</label>
                  <select
                    value={checkoutUser}
                    onChange={(e) => setCheckoutUser(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    required
                  >
                    <option value="">Select Staff Member</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Checkout Asset</span>
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleMaintenance('start')}
                    className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/20 font-bold px-4 py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-reverse" />
                    <span>Send to Repair</span>
                  </button>
                </div>
              </form>
            )}

            {/* Serialized - Checked Out Actions */}
            {selectedAsset.type === 'serialized' && selectedAsset.status === 'Checked Out' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  This asset is currently deployed. Perform a Check-in operation to return it to the available inventory pool.
                </p>
                <button
                  onClick={handleCheckin}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Process Return (Check-in)</span>
                </button>
              </div>
            )}

            {/* Serialized - Maintenance Actions */}
            {selectedAsset.type === 'serialized' && selectedAsset.status === 'Maintenance' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  This asset is flagged in maintenance. Complete servicing to restore availability status.
                </p>
                <button
                  onClick={() => handleMaintenance('stop')}
                  disabled={loading}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Resolve & Set Available</span>
                </button>
              </div>
            )}

            {/* Bulk Actions */}
            {selectedAsset.type === 'bulk' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedAsset.quantity_total}
                      value={checkoutQty}
                      onChange={(e) => setCheckoutQty(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Action Type</label>
                    <span className="text-slate-400 text-xs mt-2 block">Checkout or Restock</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Assign User (For Checkout)</label>
                  <select
                    value={checkoutUser}
                    onChange={(e) => setCheckoutUser(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select Staff (Required for Checkout)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleCheckout}
                    disabled={loading || !checkoutUser || selectedAsset.quantity_available < checkoutQty}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Package className="w-4 h-4" />
                    <span>Checkout</span>
                  </button>
                  <button
                    onClick={handleCheckin}
                    disabled={loading || (selectedAsset.quantity_available + checkoutQty > selectedAsset.quantity_total)}
                    className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 font-bold px-4 py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Restock</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
