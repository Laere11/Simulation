// Global variables and constants
const sz = 20;
let cols, rows;
let charges = [];
const K = 1000;
let running = false;
let magField = [];
let w, h;
let holdingAlt = false;

// UI controls
let fieldStrengthSlider, chargeMagnitudeSlider, boundarySlider;
let traceCheckbox;
let circularTrapButton, magneticBottleButton, mirrorTrapButton, clearButton;
let simulationToggleButton, recordButton, replayButton;

// Logging and replay
let recording = false;
let logData = [];
let replayMode = false;
let replayIndex = 0;

// For trajectory tracing toggle
let traceTrails = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  cols = floor(width / sz);
  rows = floor(height / sz);
  w = cols * sz;
  h = rows * sz;
  
  // Initialize magField as a 2D array filled with 0
  magField = Array(rows).fill().map(() => Array(cols).fill(0));
  
  // Create the UI panel with interactive controls
  createUIPanel();
}

function createUIPanel() {
  let panel = createDiv();
  panel.id('ui-panel');
  
  // Magnetic Field Strength Slider
  createSpan("Magnetic Field Strength:").parent(panel);
  fieldStrengthSlider = createSlider(0, 10, 3, 0.1);
  fieldStrengthSlider.parent(panel);
  
  // Charge Magnitude Slider
  createSpan("Charge Magnitude Multiplier:").parent(panel);
  chargeMagnitudeSlider = createSlider(0.5, 5, 1, 0.1);
  chargeMagnitudeSlider.parent(panel);
  
  // Trap Boundary Slider (for Circular Trap)
  createSpan("Trap Boundary (for Circular Trap):").parent(panel);
  boundarySlider = createSlider(50, min(width, height) / 2, 150, 1);
  boundarySlider.parent(panel);
  
  // Trajectory Tracing Checkbox
  traceCheckbox = createCheckbox("Show Trajectories", false);
  traceCheckbox.parent(panel);
  
  // Preset Trap Buttons
  circularTrapButton = createButton("Circular Trap");
  circularTrapButton.parent(panel);
  circularTrapButton.mousePressed(presetCircularTrap);
  
  magneticBottleButton = createButton("Magnetic Bottle");
  magneticBottleButton.parent(panel);
  magneticBottleButton.mousePressed(presetMagneticBottle);
  
  mirrorTrapButton = createButton("Mirror Trap");
  mirrorTrapButton.parent(panel);
  mirrorTrapButton.mousePressed(presetMirrorTrap);
  
  // Clear All Button
  clearButton = createButton("Clear All");
  clearButton.parent(panel);
  clearButton.mousePressed(clearAll);
  
  // Toggle Simulation Running
  simulationToggleButton = createButton("Start/Pause Simulation (R)");
  simulationToggleButton.parent(panel);
  simulationToggleButton.mousePressed(toggleRunning);
  
  // Record and Replay Buttons
  recordButton = createButton("Toggle Recording");
  recordButton.parent(panel);
  recordButton.mousePressed(toggleRecording);
  
  replayButton = createButton("Replay Recording");
  replayButton.parent(panel);
  replayButton.mousePressed(startReplay);
  
  // Display key instructions
  createDiv("Instructions:<br>Press '1' for positive charge, '2' for negative charge.<br>Press Shift+1 and Shift+2 for lazy particles.<br>Press '3' and '4' to add magnetic field cells manually, '0' to erase them.").parent(panel);
}

function draw() {
  background(255);
  
  // Update whether to trace trajectories based on the checkbox
  traceTrails = traceCheckbox.checked();
  
  // If in replay mode, display logged states instead of live simulation
  if (replayMode) {
    replaySimulation();
    return;
  }
  
  // Manual editing of the magnetic field via keys "3", "4", "0"
  if (keyIsPressed) {
    let i = floor(map(mouseX, 0, w, 0, cols));
    let j = floor(map(mouseY, 0, h, 0, rows));
    if (i >= 0 && i < cols && j >= 0 && j < rows) {
      if (key === '3') {
        magField[j][i] = 1;
      } else if (key === '4') {
        magField[j][i] = 2;
      } else if (key === '0') {
        magField[j][i] = 0;
      }
    }
  }
  
  // Draw the magnetic field grid
  drawMagneticField();
  
  // Update physics if the simulation is running
  if (running) {
    // Compute and apply Coulomb forces between all charges
    for (let a of charges) {
      for (let b of charges) {
        if (a !== b) {
          let force = a.fieldLine(b.pos.x, b.pos.y);
          force.mult(b.charge * chargeMagnitudeSlider.value());
          b.applyForce(force);
        }
      }
    }
    
    // Apply magnetic field effects based on the grid
    for (let c of charges) {
      let i = floor(map(c.pos.x, 0, w, 0, cols));
      let j = floor(map(c.pos.y, 0, h, 0, rows));
      if (i >= 0 && i < cols && j >= 0 && j < rows) {
        let fieldType = magField[j][i];
        if (fieldType === 1) {
          // Rotate velocity clockwise; rotation angle is proportional to slider value and charge sign
          c.vel.rotate(radians(fieldStrengthSlider.value() * 1 * c.charge));
        } else if (fieldType === 2) {
          // Rotate velocity counterclockwise
          c.vel.rotate(radians(fieldStrengthSlider.value() * -1 * c.charge));
        }
      }
    }
    
    // Update charges and record trajectories if tracing is enabled
    for (let c of charges) {
      if (!c.lazy) {
        c.update();
      } else {
        // Lazy particles update less frequently
        if (frameCount % 5 === 0) {
          c.update();
        }
      }
      if (traceTrails) {
        c.addTrail();
      }
    }
    
    // Basic auto-adjustment: if any charge escapes the circular trap,
    // slightly increase the magnetic field strength.
    autoAdjustParameters();
  }
  
  // Render each charge (and its trail if enabled)
  for (let c of charges) {
    c.render();
  }
  
  // Log the current state if recording is enabled
  if (recording && running) {
    logCurrentState();
  }
  
  // Display real-time simulation information
  displayInfo();
}

// Draw the magnetic field grid with colored cells
function drawMagneticField() {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let x = i * sz;
      let y = j * sz;
      if (magField[j][i] === 1) {
        fill(0, 255, 255, 150);
        rect(x, y, sz, sz);
      } else if (magField[j][i] === 2) {
        fill(255, 0, 255, 150);
        rect(x, y, sz, sz);
      }
      // Optional: draw grid lines for reference
      noFill();
      stroke(200);
      rect(x, y, sz, sz);
    }
  }
}

function keyPressed() {
  if (key === '1') {
    // Add a positive charge
    charges.push(new Charge(mouseX, mouseY, holdingAlt ? 0.5 : 1, false));
  } else if (key === '2') {
    // Add a negative charge
    charges.push(new Charge(mouseX, mouseY, holdingAlt ? -0.5 : -1, false));
  } else if (key === '!') {
    // Shift+1 for a lazy positive charge
    charges.push(new Charge(mouseX, mouseY, holdingAlt ? 0.5 : 1, true));
  } else if (key === '@') {
    // Shift+2 for a lazy negative charge
    charges.push(new Charge(mouseX, mouseY, holdingAlt ? -0.5 : -1, true));
  } else if (key === 'r' || key === 'R') {
    toggleRunning();
  } else if (keyCode === 18) { // Alt key
    holdingAlt = true;
  }
}

function keyReleased() {
  if (keyCode === 18) {
    holdingAlt = false;
  }
}

function toggleRunning() {
  running = !running;
  if (!running) {
    // Stop recording when simulation is paused
    recording = false;
  }
}

// Auto-adjust parameters: if any charge escapes the circular trap (as defined by boundarySlider),
// increase the magnetic field strength slightly to help confine the particle.
function autoAdjustParameters() {
  let trapRadius = boundarySlider.value();
  let trapCenter = createVector(width / 2, height / 2);
  for (let c of charges) {
    if (p5.Vector.dist(c.pos, trapCenter) > trapRadius) {
      let currentVal = fieldStrengthSlider.value();
      fieldStrengthSlider.value(min(currentVal + 0.1, 10));
    }
  }
}

// Log the current simulation state (positions, velocities, and trails for all charges)
function logCurrentState() {
  let state = charges.map(c => ({
    pos: c.pos.copy(),
    vel: c.vel.copy(),
    acc: c.acc.copy(),
    charge: c.charge,
    lazy: c.lazy,
    trail: c.trail.slice()
  }));
  logData.push(state);
}

// Replay the simulation from the logged states
function replaySimulation() {
  if (logData.length === 0) return;
  
  background(255);
  drawMagneticField();
  
  let state = logData[replayIndex];
  for (let savedCharge of state) {
    let pos = savedCharge.pos;
    fill(savedCharge.charge > 0 ? (savedCharge.lazy ? color(128, 0, 0) : color(255, 0, 0)) : (savedCharge.lazy ? color(0, 0, 128) : color(0, 0, 255)));
    noStroke();
    let sizeVal = abs(savedCharge.charge) * 20;
    circle(pos.x, pos.y, sizeVal);
    
    if (traceTrails && savedCharge.trail.length > 1) {
      noFill();
      stroke(50);
      beginShape();
      for (let p of savedCharge.trail) {
        vertex(p.x, p.y);
      }
      endShape();
    }
  }
  
  replayIndex++;
  if (replayIndex >= logData.length) {
    replayIndex = 0;
    replayMode = false; // End replay after one full cycle
  }
}

// Start replay mode (pause live simulation and replay the recorded simulation)
function startReplay() {
  if (logData.length > 0) {
    replayMode = true;
    running = false;
    replayIndex = 0;
  }
}

// Preset: Circular Trap
function presetCircularTrap() {
  clearMagField();
  let trapRadius = boundarySlider.value();
  let centerX = width / 2;
  let centerY = height / 2;
  
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let x = i * sz + sz / 2;
      let y = j * sz + sz / 2;
      let d = dist(x, y, centerX, centerY);
      // Set an annulus (a narrow ring) to form a circular boundary trap.
      if (d > trapRadius - 10 && d < trapRadius + 10) {
        let angle = atan2(y - centerY, x - centerX);
        magField[j][i] = (angle > 0) ? 1 : 2;
      }
    }
  }
}

// Preset: Magnetic Bottle (strong magnetic fields at the edges)
function presetMagneticBottle() {
  clearMagField();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i < 2 || i > cols - 3 || j < 2 || j > rows - 3) {
        magField[j][i] = (i + j) % 2 === 0 ? 1 : 2;
      }
    }
  }
}

// Preset: Mirror Trap (magnetic fields at the top and bottom boundaries)
function presetMirrorTrap() {
  clearMagField();
  for (let i = 0; i < cols; i++) {
    magField[0][i] = 1;
    magField[rows - 1][i] = 2;
  }
}

// Clear the magnetic field grid
function clearMagField() {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      magField[j][i] = 0;
    }
  }
}

// Clear all simulation data: charges, magnetic field, and logged data
function clearAll() {
  charges = [];
  clearMagField();
  logData = [];
  replayMode = false;
  replayIndex = 0;
}

// Display real-time simulation info at the bottom of the canvas
function displayInfo() {
  fill(0);
  noStroke();
  textSize(14);
  let info = `Charges: ${charges.length} | Running: ${running} | Recording: ${recording} | Replay Mode: ${replayMode}`;
  text(info, 10, height - 10);
}

// Charge class definition
class Charge {
  constructor(x, y, charge, lazy) {
    this.pos = createVector(x, y);
    this.vel = createVector();
    this.acc = createVector();
    this.charge = charge;
    this.lazy = lazy;
    this.trail = [];
  }
  
  applyForce(force) {
    this.acc.add(force);
  }
  
  fieldLine(x, y) {
    let disp = createVector(x, y).sub(this.pos);
    let distSq = max(disp.magSq(), 25); // prevent division by zero
    disp.setMag(K * this.charge / distSq);
    return disp;
  }
  
  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.vel.limit(10); // cap maximum speed
    if (traceTrails) {
      this.addTrail();
    }
  }
  
  addTrail() {
    this.trail.push(this.pos.copy());
    if (this.trail.length > 50) {
      this.trail.shift();
    }
  }
  
  render() {
    // Draw trail if trajectory tracing is enabled
    if (traceTrails && this.trail.length > 1) {
      noFill();
      stroke(100);
      beginShape();
      for (let p of this.trail) {
        vertex(p.x, p.y);
      }
      endShape();
    }
    // Draw the charge itself
    noStroke();
    let sizeVal = abs(this.charge) * 20;
    if (this.charge > 0) {
      fill(this.lazy ? color(128, 0, 0) : color(255, 0, 0));
      circle(this.pos.x, this.pos.y, sizeVal);
      stroke(255);
      line(this.pos.x - sizeVal / 2, this.pos.y, this.pos.x + sizeVal / 2, this.pos.y);
      line(this.pos.x, this.pos.y - sizeVal / 2, this.pos.x, this.pos.y + sizeVal / 2);
    } else if (this.charge < 0) {
      fill(this.lazy ? color(0, 0, 128) : color(0, 0, 255));
      circle(this.pos.x, this.pos.y, sizeVal);
      stroke(255);
      line(this.pos.x - sizeVal / 2, this.pos.y, this.pos.x + sizeVal / 2, this.pos.y);
    }
  }
}

// Toggle recording of simulation states
function toggleRecording() {
  recording = !recording;
  if (recording) {
    logData = [];
    console.log("Recording started.");
  } else {
    console.log("Recording stopped.");
  }
}
