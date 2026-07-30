// hexapod.js
// Handles gait generation and inverse kinematics for the hexapod.

window.Hexapod = (() => {
  // Configuration from user
  const CONFIG = {
    bodyRadius: 127.5, // mm
    coxaLength: 95,    // mm
    femurLength: 73,   // mm
    tibiaLength: 205,  // mm
    
    // Leg mount angles (degrees, 0 is right, 90 is forward)
    legAngles: [
      30,  // RF
      90,  // RM
      150, // RR
      210, // LR
      270, // LM
      330  // LF
    ],
    
    stepHeight: 50,    // mm
    strideLength: 80,  // mm max stride
    defaultZ: -205,    // mm (stand height, tibia length down)
    defaultX: 168,     // mm (coxa + femur horizontal)
    
    servoCenter: 90,
    servoMin: 60,
    servoMax: 120
  };

  // State
  let phase = 0; // 0.0 to 1.0
  let isMoving = false;
  
  // Deg/Rad conversions
  const rad = (deg) => deg * Math.PI / 180;
  const deg = (rad) => rad * 180 / Math.PI;
  
  // Clamp servo angle
  const clampServo = (angle) => {
    return Math.max(CONFIG.servoMin, Math.min(CONFIG.servoMax, Math.round(angle)));
  };

  // IK Solver for a single leg
  // Input: (x, y, z) in local leg coordinates (x is straight out from coxa, y is CCW tangent, z is up)
  // Output: { coxa, femur, tibia } angles in degrees
  function solveIK(x, y, z) {
    // 1. Coxa angle
    let coxaAngle = Math.atan2(y, x);
    
    // 2. Project to 2D plane of the leg
    let groundDist = Math.sqrt(x*x + y*y) - CONFIG.coxaLength;
    let D = Math.sqrt(groundDist*groundDist + z*z);
    
    // 3. Femur and Tibia (Law of Cosines)
    let cosTibia = (CONFIG.femurLength**2 + CONFIG.tibiaLength**2 - D**2) / (2 * CONFIG.femurLength * CONFIG.tibiaLength);
    cosTibia = Math.max(-1, Math.min(1, cosTibia));
    let tibiaAngleInner = Math.acos(cosTibia);
    
    let tibiaAngle = deg(tibiaAngleInner);
    
    let alpha = Math.atan2(-z, groundDist);
    let cosBeta = (CONFIG.femurLength**2 + D**2 - CONFIG.tibiaLength**2) / (2 * CONFIG.femurLength * D);
    cosBeta = Math.max(-1, Math.min(1, cosBeta));
    let beta = Math.acos(cosBeta);
    
    let femurAngle = deg(alpha + beta); // Angle of femur above horizontal
    
    // Map physical angles to servo angles (Center = 90)
    let coxaServo = CONFIG.servoCenter + deg(coxaAngle);
    let femurServo = CONFIG.servoCenter + femurAngle;
    let tibiaServo = CONFIG.servoCenter + (tibiaAngle - 90);
    
    return {
      coxa: clampServo(coxaServo),
      femur: clampServo(femurServo),
      tibia: clampServo(tibiaServo)
    };
  }

  function update(dt, lsX, lsY, rsX) {
    let linSpeed = Math.sqrt(lsX*lsX + lsY*lsY) / 100;
    if (linSpeed > 1) linSpeed = 1;
    let linAngle = Math.atan2(lsX, lsY); 
    
    let rotSpeed = rsX / 100;
    
    isMoving = (linSpeed > 0.1 || Math.abs(rotSpeed) > 0.1);
    
    if (isMoving) {
      let cycleSpeed = 1.5; 
      let speedFactor = Math.max(linSpeed, Math.abs(rotSpeed));
      phase += dt * cycleSpeed * speedFactor;
      if (phase >= 1.0) phase -= 1.0;
    } else {
      phase = 0;
    }

    let angles = [];
    
    for (let i = 0; i < 6; i++) {
      let isGroupA = (i % 2 === 0);
      let localPhase = phase;
      
      if (!isGroupA) {
        localPhase += 0.5;
        if (localPhase >= 1.0) localPhase -= 1.0;
      }
      
      let stepFraction;
      let zOffset = 0;
      
      if (localPhase < 0.5) {
        stepFraction = 1.0 - (localPhase / 0.5) * 2.0;
        zOffset = 0;
      } else {
        stepFraction = ((localPhase - 0.5) / 0.5) * 2.0 - 1.0;
        let liftPhase = (localPhase - 0.5) / 0.5; 
        zOffset = Math.sin(liftPhase * Math.PI) * CONFIG.stepHeight;
      }
      
      if (!isMoving) {
        stepFraction = 0;
        zOffset = 0;
      }
      
      let moveDir = linAngle; 
      let stride = CONFIG.strideLength * linSpeed;
      let dx = Math.sin(moveDir) * stride * stepFraction / 2;
      let dy = Math.cos(moveDir) * stride * stepFraction / 2;
      
      let mountAngleRad = rad(CONFIG.legAngles[i]);
      let rotDir = mountAngleRad + Math.PI/2;
      let rotStride = CONFIG.strideLength * rotSpeed;
      dx += Math.sin(rotDir) * rotStride * stepFraction / 2;
      dy += Math.cos(rotDir) * rotStride * stepFraction / 2;
      
      let localDx = dx * Math.cos(mountAngleRad) + dy * Math.sin(mountAngleRad);
      let localDy = -dx * Math.sin(mountAngleRad) + dy * Math.cos(mountAngleRad);
      
      let targetX = CONFIG.defaultX + localDx;
      let targetY = localDy;
      let targetZ = CONFIG.defaultZ + zOffset;
      
      let servoAngles = solveIK(targetX, targetY, targetZ);
      
      angles.push(servoAngles.coxa);
      angles.push(servoAngles.femur);
      angles.push(servoAngles.tibia);
    }
    
    return angles;
  }

  return { update };
})();
