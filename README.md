# Hexapod Gamepad Controller



A virtual, browser-based gamepad control system for a hexapod robotic arm, built to replace individual servo sliders with direct joystick-style input.



###### **Why a virtual gamepad**



Early in the hexapod build, we needed a reliable way to drive its movement. Instead of individual sliders for each servo, we built a virtual joystick UI in the browser, mimicking gamepad-style control for more intuitive, real-time movement of the arm.



##### **Architecture**



All inverse kinematics and joystick-to-angle calculations run client-side in the controller (JavaScript), not on the ESP32. The ESP32 only receives final servo angle instructions over WebSocket and executes them. This keeps the microcontroller's load limited to motor control, not math.



**Frontend (controller):** index.html, controller.js, hexapod.js — handles gamepad/joystick input, IK, and angle calculation

Communication: websocket.js — sends computed servo instructions to the ESP32 in real time

**Firmware:** Firmware.ino — receives instructions, drives servos via PCA9685



##### **Problems solved during development**



Servos ignoring joystick input, or reacting to old positions. This one cost us a few days because it looked like broken inverse kinematics at first. It wasn't.



The real cause: the original code pushed joystick updates at a fixed 30Hz no matter what, even when the ESP32 hadn't finished handling the last message. Under load, packets piled up in the Wi-Fi send buffer. By the time the ESP32 worked through the backlog, it was acting on position data from around 20 seconds ago. From the outside that just looks like the arm not responding, or the IK math being wrong.



###### **Two changes fixed it:**



Frame dropping in websocket.js. If the send buffer is full, the browser just drops the queued frame instead of sending it. Only the newest joystick position ever makes it across.

Throttling and idle silence in controller.js. Update rate came down to 15Hz, and the controller stops transmitting entirely once the sticks are back at rest, instead of spamming the same position over and over.



End result: latency went from \~20 seconds down to a consistent 0.25–0.5s.

