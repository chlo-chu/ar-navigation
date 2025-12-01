import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

// --- GLOBAL VARIABLES ---
const arrowList = []; // This list stores our arrows so we can animate them

// 1. Setup Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// 2. Add Start Button with "Hit Test" required
const button = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
document.body.appendChild(button);

// 3. Lighting (Crucial for 3D shapes)
// A. General Ambient Light
const ambientLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5);
scene.add(ambientLight);

// B. Directional Light (Like the sun) to create shadows/depth on the 3D arrows
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(0, 5, 0); // Light coming from above
scene.add(dirLight);

// 4. Create World Anchor (Hidden until floor is found)
const worldAnchor = new THREE.Group();
scene.add(worldAnchor);
worldAnchor.visible = false; 

// --- HELPER FUNCTION: 3D EXTRUDED ARROWS ---
function createArrow(x, z, rotationY) {
    const arrowGroup = new THREE.Group();

    // 1. Draw the 2D Shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);       // Tip
    shape.lineTo(-0.2, -0.2); // Head Left
    shape.lineTo(-0.1, -0.2); // Shaft Notch Left
    shape.lineTo(-0.1, -0.6); // Shaft Bottom Left
    shape.lineTo(0.1, -0.6);  // Shaft Bottom Right
    shape.lineTo(0.1, -0.2);  // Shaft Notch Right
    shape.lineTo(0.2, -0.2);  // Head Right
    shape.lineTo(0, 0);       // Back to Tip

    // 2. EXTRUDE IT (Make it 3D!)
    const extrudeSettings = {
        depth: 0.03,          // Thickness (3cm)
        bevelEnabled: true,   // Round edges look nicer
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 3
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 3. Material (Standard Material reacts to light)
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff, // Cyan/Blue
        roughness: 0.3,  // Slightly shiny
        metalness: 0.1
    });

    const arrowMesh = new THREE.Mesh(geometry, material);
    
    // Rotate 90 degrees to lay flat on floor
    arrowMesh.rotation.x = -Math.PI / 2; 
    
    // Add to our list for animation
    arrowList.push(arrowMesh);

    arrowGroup.add(arrowMesh);
    
    // Lift slightly (0.05) so the 3D bottom doesn't clip through floor
    arrowGroup.position.set(x, 0.05, z); 
    arrowGroup.rotation.y = rotationY;
    
    worldAnchor.add(arrowGroup);
}

// --- YOUR PATH ---
// Adjust coordinates here as needed
createArrow(0, -1, 0); 
createArrow(0, -5, 0); 
createArrow(-2, -10, 0.3); 
createArrow(-5, -15, 0.5); 
createArrow(-7, -18, 1.0); 

// --- ADDING THE LANDMARK SIGN (BIGGER & CLOSER) ---

const loader = new THREE.TextureLoader();

loader.load('./makersign.png', (texture) => {
    
    // 1. MAKE IT BIGGER
    // Changed from (1, 0.5) to (1.5, 0.75) -> 50% larger
    const signGeometry = new THREE.PlaneGeometry(1.5, 0.75);
    
    const signMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        side: THREE.DoubleSide, 
        transparent: true       
    });

    const signMesh = new THREE.Mesh(signGeometry, signMaterial);

    // 2. MOVE IT CLOSER
    // Changed z from -4 to -2 (Now only 2 meters in front of you)
    // Kept x at -1.5 (Left side) and y at 1.3 (Eye level)
    signMesh.position.set(-1.5, 1.3, -2);

    // Rotation: Face right
    signMesh.rotation.y = Math.PI / 2;

    worldAnchor.add(signMesh);
});

// 5. Drift Fix (Tap screen to rotate path)
window.addEventListener('click', (event) => {
    const x = event.clientX / window.innerWidth; 
    const nudge = 0.05;
    if (worldAnchor.visible) {
        if (x < 0.5) worldAnchor.rotation.y += nudge;
        else worldAnchor.rotation.y -= nudge;
    }
});

// 6. Render Loop with Animation & Hit Test
let hitTestSource = null;
let hitTestSourceRequested = false;
let floorFound = false;

function render(timestamp, frame) {
    if (frame) {
        // --- HIT TEST LOGIC ---
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then((referenceSpace) => {
                session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                    hitTestSource = source;
                });
            });
            session.onend = () => {
                hitTestSourceRequested = false;
                hitTestSource = null;
                floorFound = false;
            };
            hitTestSourceRequested = true;
        }

        if (hitTestSource && !floorFound) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace);
                worldAnchor.position.y = pose.transform.position.y;
                worldAnchor.visible = true; 
                floorFound = true; 
            }
        }
    }

    // --- ANIMATION LOGIC (Scale Pulse) ---
    // Use 'timestamp' to drive the sine wave
    if (arrowList.length > 0) {
        const time = timestamp / 500; // Speed
        const scale = 1 + (Math.sin(time) * 0.15); // Bounce between 0.85 and 1.15
        
        arrowList.forEach((arrow) => {
            arrow.scale.set(scale, scale, scale);
        });
    }

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(render);