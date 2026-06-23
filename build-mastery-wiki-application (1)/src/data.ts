export type MachineStatus = 'operational' | 'needs-attention' | 'down';

export interface Setting {
  material: string;
  nozzle: string;
  bed: string;
  notes?: string;
}

export interface TroubleshootingItem {
  title: string;
  steps: string[];
}

export interface RepairGuide {
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tools: string[];
  steps: string[];
  warning?: string;
}

export interface LaserSetting {
  material: string;
  power: string;
  speed: string;
  notes?: string;
}

export interface CNCSetting {
  material: string;
  bitType: string;
  spindleSpeed: string;
  depthPerPass: string;
  notes?: string;
}

export interface IssueReport {
  id: string;
  machineId: string;
  machineName: string;
  reportedBy: string;
  issueType: 'broken' | 'needs-calibration' | 'missing-parts' | 'other';
  description: string;
  timestamp: string;
  status: 'open' | 'in-progress' | 'resolved';
  adminNotes?: string;
}

export interface Machine {
  id: string;
  name: string;
  icon: string;
  status: MachineStatus;
  quantity: string;
  statusNote?: string;
  quickStartSteps: string[];
  correctSettings: Setting[];
  troubleshooting: TroubleshootingItem[];
  repairGuides: RepairGuide[];
  rules: string[];
  videoUrls: string[];
  category: 'printer' | 'snapmaker' | 'soldering';
  // Snapmaker-specific
  laserQuickStart?: string[];
  cncQuickStart?: string[];
  laserSettings?: LaserSetting[];
  cncSettings?: CNCSetting[];
}

export interface FilamentItem {
  id: string;
  material: string;
  brand: string;
  size: string;
  colors: string;
}

export const initialMachines: Machine[] = [
  {
    id: 'h2c',
    name: 'H2C Printer',
    icon: '🖨️',
    status: 'needs-attention',
    quantity: '2 units',
    statusNote: 'Prone to clogs',
    category: 'printer',
    quickStartSteps: [
      'Check filament type matches machine — PLA 200°C, PETG 240°C, CoPE on designated machine only',
      'Clean build plate with IPA',
      'Ensure brim is active in slicer settings (mandatory)',
      'Load filament and confirm it extrudes cleanly',
      'Stay for first layer to confirm adhesion',
    ],
    correctSettings: [
      { material: 'PLA', nozzle: '200°C', bed: '60°C' },
      { material: 'PETG', nozzle: '240°C', bed: '70°C' },
      { material: 'CoPE', nozzle: '220°C', bed: '80°C', notes: 'Designated machine only' },
    ],
    troubleshooting: [
      {
        title: 'Nozzle Clog',
        steps: [
          'Pause the print immediately and unload filament',
          'Heat the nozzle to printing temperature (200°C for PLA, 240°C for PETG)',
          'Perform a cold pull: heat to 200°C, insert filament, cool to 90°C, then pull firmly',
          'If cold pull fails, use the unclogging pin tool to push through the nozzle from above',
          'If still clogged, proceed to the full print head disassembly repair guide',
          'After clearing, extrude filament to confirm clean flow before resuming print',
        ],
      },
      {
        title: 'Filament Loading Failure',
        steps: [
          'Check PTFE tube is fully seated in the coupler — push until it clicks',
          'Look for broken filament pieces inside the PTFE tube path',
          'If filament is stuck in the extruder, cut above the gear, remove the segment, and reload',
          'Ensure the filament spool is not tangled and feeds freely',
          'Try loading with the PTFE tube disconnected from the hot end to isolate the issue',
        ],
      },
      {
        title: 'First Layer Not Adhering',
        steps: [
          'Clean the build plate thoroughly with IPA (isopropyl alcohol)',
          'Re-level the bed using the built-in leveling routine',
          'Check Z-offset — the nozzle should be about 0.1-0.2mm from the bed (paper test)',
          'Verify brim is active in slicer settings (mandatory for all prints)',
          'Ensure the build plate is not warped — check with a straight edge',
          'Try increasing bed temperature by 5°C if adhesion is still poor',
        ],
      },
      {
        title: 'Filament Grinding / Extruder Clicking',
        steps: [
          'Pause the print immediately to prevent further damage',
          'Unload the filament and inspect the feeder gear for debris',
          'Clean the feeder gear with a small brush or compressed air',
          'Check the Bowden tube for wear or deformation — replace if damaged',
          'Reduce print speed slightly and check if extrusion improves',
          'If the filament is ground flat, cut back past the damaged section before reloading',
        ],
      },
      {
        title: 'Print Shifting / Layer Misalignment',
        steps: [
          'Check all belt tensions — belts should be taut but not overly tight',
          'Lubricate the linear rails with light machine oil or PTFE lubricant',
          'Reduce travel speed in slicer settings (try 150mm/s instead of 200mm/s)',
          'Ensure the build plate is not slipping — check the magnetic adhesion',
          'Verify the printer is on a stable surface without vibration',
        ],
      },
    ],
    repairGuides: [
      {
        title: 'Print Head Disassembly (Clog Clearing)',
        difficulty: 'Medium',
        tools: ['2mm Allen key', 'Unclogging pin tool', 'Needle-nose pliers', 'Isopropyl alcohol', 'Heat-resistant gloves'],
        warning: 'Ensure printer is powered off and nozzle is cool before starting disassembly. Allow hot end to fully cool to avoid burns.',
        steps: [
          'Power off the printer and disconnect the power cable. Wait for the hot end to cool completely to room temperature.',
          'Remove the two M3 screws securing the print head cover using the 2mm Allen key. Set the cover aside carefully.',
          'Disconnect the fan cable and thermistor cable from the print head PCB. Note the connector orientation for reassembly.',
          'Loosen the setscrew on the heat break and carefully slide the hot end assembly downward out of the heat sink. Support it from below.',
          'Use the unclogging pin tool to push any remaining filament through the heat break from the top. If severely clogged, heat the nozzle to 200°C briefly, then push filament through.',
          'Inspect the PTFE tube inside the heat sink for damage or melting. If damaged, remove the collet clip and pull the PTFE tube out for replacement.',
        ],
      },
      {
        title: 'Print Head Assembly (After Clog Clearing)',
        difficulty: 'Medium',
        tools: ['2mm Allen key', 'New PTFE tube (if needed)', 'Wire cutters (to trim PTFE)', 'Isopropyl alcohol', 'Thermal paste (optional)'],
        warning: 'Do not overtighten screws. Ensure all cables are properly connected before powering on. Check for filament leaks after reassembly.',
        steps: [
          'If replacing PTFE tube, cut a new section to match the original length. Ensure the cut is perfectly square — angled cuts cause clogs.',
          'Insert the new PTFE tube into the heat sink collet and push it fully down until it bottoms out against the heat break. Secure with the collet clip.',
          'Slide the hot end assembly up into the heat sink, aligning the flat side with the setscrew. Tighten the setscrew firmly but do not overtighten.',
          'Reconnect the thermistor cable and fan cable to the print head PCB. Ensure connectors are fully seated and oriented correctly.',
          'Replace the print head cover and secure with the two M3 screws. Do not pinch any cables between the cover and the housing.',
          'Power on the printer and heat the nozzle to 200°C. Extrude filament and verify clean, even flow with no leaks around the heat break.',
          'Run a test print (e.g., a small calibration cube) to confirm print quality and that no issues remain.',
        ],
      },
      {
        title: 'Nozzle Replacement',
        difficulty: 'Easy',
        tools: ['7mm wrench or socket', 'Heat-resistant gloves', 'New nozzle (0.4mm default)', 'Isopropyl alcohol'],
        warning: 'Nozzle must be hot during removal to avoid damaging the heat block thread. Wear heat-resistant gloves.',
        steps: [
          'Heat the nozzle to 240°C to soften any filament inside and prevent thread damage',
          'While hot, use the 7mm wrench to unscrew the old nozzle counter-clockwise',
          'Clean the heat block thread with a brass brush — remove any melted filament residue',
          'Screw in the new nozzle finger-tight, then tighten an additional 1/4 turn with the wrench',
          'Heat to printing temperature and extrude filament to check for leaks around the nozzle base',
          'If leaking, tighten slightly more while hot — never overtighten a cold nozzle',
        ],
      },
      {
        title: 'PTFE Tube Replacement',
        difficulty: 'Easy',
        tools: ['PTFE tube cutter or sharp blade', 'New PTFE tube (4mm OD, 2mm ID)', 'Collet clips'],
        steps: [
          'Press the collet release ring and pull the old PTFE tube out of the fitting',
          'Cut the new PTFE tube to the correct length, ensuring a perfectly square cut',
          'Push the new tube firmly into the collet fitting until it bottoms out',
          'Secure with a collet clip to prevent the tube from backing out during prints',
          'Load filament and verify it passes through freely without resistance',
        ],
      },
      {
        title: 'Hot End Removal and Replacement',
        difficulty: 'Hard',
        tools: ['2mm Allen key', '1.5mm Allen key', '7mm wrench', 'Wire cutters (for cable ties)', 'Thermal paste', 'New hot end assembly (if replacing)'],
        warning: 'This procedure involves handling delicate wiring. Take photos before disconnecting anything. If unsure, escalate to manufacturer support.',
        steps: [
          'Power off and unplug the printer. Allow the hot end to cool completely',
          'Remove the print head cover and disconnect all cables (thermistor, heater, fan)',
          'Note the routing of all cables and take a photo for reference',
          'Remove the screws securing the hot end heat sink to the carriage',
          'Carefully lower the entire hot end assembly out of the carriage',
          'If replacing, transfer the thermistor and heater cartridge to the new hot end block',
          'Apply a small amount of thermal paste between the heat sink and heat break during reassembly',
          'Reassemble in reverse order, using your photos to verify cable routing',
          'After reassembly, perform a PID auto-tune for the new hot end before printing',
        ],
      },
    ],
    rules: [
      'Brim must always be active',
      'Check filament type before printing',
      'Check filament amount is sufficient',
      'Check bed is clean',
      'Check nozzle is clean',
      'CoPE only on designated machine',
      'Stay for first layer',
      'Remove print promptly when done',
      'Report failures immediately',
    ],
    videoUrls: ['https://www.youtube.com/watch?v=GKOte3nmskI'],
  },
  {
    id: 'p1s',
    name: 'P1S Printer',
    icon: '🖨️',
    status: 'operational',
    quantity: '3 units',
    category: 'printer',
    quickStartSteps: [
      'Select correct filament profile in Bambu Studio — don\'t guess',
      'Check filament type and amount',
      'Clean build plate',
      'Ensure brim is active (mandatory)',
      'Monitor first layer via camera or in person',
    ],
    correctSettings: [
      { material: 'PLA', nozzle: '200°C', bed: '60°C' },
      { material: 'PETG', nozzle: '240°C', bed: '70°C' },
      { material: 'TPU', nozzle: '220°C', bed: '50°C' },
      { material: 'PC', nozzle: '260°C', bed: '100°C' },
      { material: 'PA (Nylon)', nozzle: '260°C', bed: '80°C' },
    ],
    troubleshooting: [
      {
        title: 'Print Failure (Wrong Settings)',
        steps: [
          'Verify the material profile in Bambu Studio matches the loaded filament exactly',
          'Check that brim is enabled in the slicer — this is mandatory for all prints',
          'Confirm the correct printer is selected in Bambu Studio (P1S, not X1C or A1)',
          'Compare your settings against the Correct Settings table on this page',
        ],
      },
      {
        title: 'Bed Adhesion Issues',
        steps: [
          'Clean the build plate with IPA — oils from hands reduce adhesion significantly',
          'Check bed temperature matches the material profile',
          'Use a glue stick on the textured PEI plate for materials like PETG and PC',
          'Ensure the first layer height is not too high — Z-offset should be properly calibrated',
          'Try increasing bed temperature by 5°C',
        ],
      },
      {
        title: 'Filament Runout During Print',
        steps: [
          'Check spool weight before starting large prints — a full 1kg spool weighs ~1.3kg with the spool',
          'If the AMS reports runout, swap the spool and resume from the printer screen',
          'Keep spare spools of commonly used materials loaded in the AMS',
        ],
      },
      {
        title: 'AMS Feeding Issues',
        steps: [
          'Check the spool is not tangled — look for loops or crossed windings on the spool',
          'Clean the AMS rollers with a lint-free cloth and IPA',
          'Ensure the PTFE tube is not kinked or too long',
          'Verify the filament is not too brittle — snap off the first 30cm if needed',
          'Check that the AMS firmware is up to date via Bambu Handy app',
        ],
      },
      {
        title: 'Stringing / Oozing',
        steps: [
          'Enable retraction in slicer settings (should be on by default for P1S)',
          'Reduce nozzle temperature by 5-10°C from the recommended setting',
          'Increase travel speed to minimize ooze time',
          'For PETG, try a slightly lower temperature and ensure drying — wet PETG strings badly',
        ],
      },
    ],
    repairGuides: [
      {
        title: 'Hot End Replacement',
        difficulty: 'Medium',
        tools: ['2mm Allen key', '1.5mm Allen key', 'New hot end assembly', 'Isopropyl alcohol'],
        warning: 'Allow hot end to cool completely before replacement. The P1S uses a quick-change hot end — no heating required for removal.',
        steps: [
          'Pause any running print and home the printer',
          'Open the door and locate the hot end on the tool head',
          'Press the hot end release lever on the side of the tool head',
          'Pull the hot end straight down and out of the tool head',
          'Align the new hot end with the tool head slot and push up until it clicks',
          'The printer will automatically detect the new hot end and read its RFID tag',
          'Run a calibration from the printer screen before printing',
        ],
      },
      {
        title: 'Extruder Cleaning',
        difficulty: 'Easy',
        tools: ['2mm Allen key', 'Brass brush', 'Isopropyl alcohol', 'Unclogging pin'],
        steps: [
          'Unload filament from the extruder via the printer menu',
          'Open the extruder cover by removing the two screws on the side',
          'Use the brass brush to clean the feeder gear teeth — remove all filament debris',
          'Check for ground filament packed between the gear teeth',
          'Wipe the inside with IPA on a lint-free cloth',
          'Reassemble the extruder cover and test by loading filament',
        ],
      },
      {
        title: 'AMS Maintenance',
        difficulty: 'Medium',
        tools: ['Lint-free cloth', 'Isopropyl alcohol', 'Small Phillips screwdriver', 'PTFE tube cutter'],
        steps: [
          'Power off the printer before cleaning the AMS',
          'Remove all filament spools from the AMS',
          'Wipe down the rubber rollers with IPA — they collect filament dust over time',
          'Check each PTFE tube for wear or kinks, replace any damaged sections',
          'Vacuum or blow out filament debris from the spool bays',
          'Check the AMS belt tension — it should move smoothly without slack',
          'Reinstall spools and run the AMS self-test from Bambu Handy app',
        ],
      },
      {
        title: 'Carbon Rod Cleaning',
        difficulty: 'Easy',
        tools: ['Isopropyl alcohol', 'Lint-free cloth', 'PTFE lubricant (optional)'],
        steps: [
          'Power off the printer and move the tool head to the center manually',
          'Wipe the carbon rods with IPA on a lint-free cloth',
          'Check for any sticky residue or buildup on the rods',
          'If the tool head feels gritty when moving, clean more thoroughly',
          'Apply a very small amount of PTFE lubricant to each rod if movement is not smooth',
          'Move the tool head back and forth several times to distribute the lubricant',
        ],
      },
    ],
    rules: [
      'Brim must always be active',
      'Check filament type before printing',
      'Check filament amount is sufficient',
      'Check bed is clean',
      'Check nozzle is clean',
      'Stay for first layer',
      'Remove print promptly when done',
      'Report failures immediately',
      'Use Bambu Handy app to monitor prints remotely',
    ],
    videoUrls: ['https://www.youtube.com/watch?v=vdG84yOj-Qc'],
  },
  {
    id: 'j1s',
    name: 'J1S Printer',
    icon: '🖨️',
    status: 'needs-attention',
    quantity: '1 unit',
    statusNote: 'Prints ugly — needs calibration',
    category: 'printer',
    quickStartSteps: [
      'This machine requires calibration — prints may be low quality',
      'Check with Exco before starting important prints on this machine',
      'Use only PLA until calibration is complete',
      'Ensure brim is active',
      'Expect quality issues — inspect first layer carefully',
    ],
    correctSettings: [
      { material: 'PLA (only)', nozzle: '200°C', bed: '60°C', notes: 'Until calibration is complete' },
    ],
    troubleshooting: [
      {
        title: 'Ugly / Poor Quality Prints',
        steps: [
          'This machine needs full calibration — report to Exco if you notice persistent quality issues',
          'Check that the belts are properly tensioned (see repair guide)',
          'Verify the Z-rod is aligned and not wobbling',
          'Try printing at slower speed (50% of normal) to reduce quality artifacts',
          'Check if E-steps are calibrated — over/under-extrusion is common on uncalibrated machines',
        ],
      },
      {
        title: 'Layer Shifts',
        steps: [
          'Check belt tension on both X and Y axes — belts should resonate like a bass guitar string when plucked',
          'Reduce print speed significantly (try 40mm/s)',
          'Ensure the build plate is not slipping on the magnetic base',
          'Check that the stepper motor pulleys are tight on their shafts',
        ],
      },
      {
        title: 'Z-Banding / Wobble',
        steps: [
          'Check Z-rod alignment — the rod should be perfectly vertical with no side-to-side play',
          'Lubricate the Z-rod with PTFE or light machine oil',
          'Check the Z-nut for excessive play — a loose Z-nut causes banding',
          'Ensure the printer frame is square and sitting on a level surface',
        ],
      },
      {
        title: 'Over-Extrusion',
        steps: [
          'Calibrate E-steps (see repair guide for procedure)',
          'Reduce flow rate in slicer by 5-10% as a temporary fix',
          'Check filament diameter setting matches actual filament (measure with calipers)',
          'Ensure you are not using a different filament profile than what is loaded',
        ],
      },
    ],
    repairGuides: [
      {
        title: 'Belt Tensioning',
        difficulty: 'Easy',
        tools: ['2mm Allen key', 'Belt tension gauge (or phone app)'],
        steps: [
          'Home the printer to move the gantry to a known position',
          'Locate the belt tensioner on each axis — it is a screw-adjustable mechanism',
          'Pluck the belt like a guitar string — it should produce a clear tone, not a dull thud',
          'Tighten the tensioner screw to increase tension, loosen to decrease',
          'The belt should deflect about 5-10mm when pressed with moderate finger pressure',
          'Check both X and Y belts — they should have similar tension',
          'Re-home the printer and run a test print to verify improvement',
        ],
      },
      {
        title: 'Z-Rod Alignment',
        difficulty: 'Medium',
        tools: ['2mm Allen key', 'Square or straight edge', 'PTFE lubricant'],
        steps: [
          'Power off the printer and manually move the print head to the top of the Z axis',
          'Place a square against the frame and check if the Z-rod is perfectly vertical',
          'If misaligned, loosen the Z-motor mounting screws slightly',
          'Gently reposition the Z-motor until the rod is vertical, then re-tighten',
          'Loosen the Z-nut bracket screws and let the rod self-align, then re-tighten',
          'Lubricate the Z-rod with PTFE lubricant',
          'Move the print head up and down manually to verify smooth travel',
        ],
      },
      {
        title: 'E-Step Calibration',
        difficulty: 'Medium',
        tools: ['Ruler or calipers', 'Marker pen', 'Computer with terminal access (e.g., Pronterface)'],
        steps: [
          'Mark the filament at the entry point to the extruder with a marker (120mm from the extruder body)',
          'Measure the exact distance and note it (e.g., 120mm)',
          'Command the extruder to feed 100mm of filament (M92 or G1 E100 command)',
          'Measure the remaining distance from the extruder body to the mark',
          'Calculate actual extruded length: (original distance) - (remaining distance)',
          'Calculate new E-steps: (current E-steps × 100) / actual extruded length',
          'Set the new E-steps with M92 E[new value] command and save with M500',
          'Repeat the test to verify the new value is accurate',
        ],
      },
      {
        title: 'Gantry Tramming',
        difficulty: 'Hard',
        tools: ['2mm Allen key', '3mm Allen key', 'Dial indicator or piece of paper', 'Square'],
        warning: 'This is an advanced procedure. If unsure, contact Exco or Snapmaker support. Incorrect tramming can damage the printer.',
        steps: [
          'Home the printer and disable steppers (M84 command)',
          'Manually move the print head to each corner of the build plate',
          'Check the distance between the nozzle and build plate at each corner using a piece of paper',
          'All four corners should have the same paper drag resistance',
          'Adjust the Z-endstop or bed leveling screws to even out any differences',
          'For the X-axis gantry: check that both sides are at the same height',
          'If one side is higher, loosen the set screws on the Z-axis coupler on the higher side',
          'Lower that side until both sides are level, then re-tighten',
          'Re-home and verify all four corners have equal nozzle height',
          'Run a first-layer test print and inspect for consistent adhesion across the bed',
        ],
      },
    ],
    rules: [
      'Brim must always be active',
      'Check filament type before printing',
      'Check filament amount is sufficient',
      'Check bed is clean',
      'Check nozzle is clean',
      'Stay for first layer',
      'Remove print promptly when done',
      'Report failures immediately',
      'PLA only until calibration is complete',
      'Report all quality issues to Exco',
    ],
    videoUrls: ['https://www.youtube.com/watch?v=b19pqEl3FCo'],
  },
  {
    id: 'snapmaker-artisan',
    name: 'Snapmaker Artisan (40W Laser + CNC)',
    icon: '⚡',
    status: 'operational',
    quantity: '1 unit',
    category: 'snapmaker',
    laserQuickStart: [
      'Check material is approved for laser cutting (no PVC, no vinyl — toxic fumes)',
      'Ensure ventilation/fume extraction is running',
      'Set correct power and speed for material type',
      'Run a test cut on scrap material first',
      'Never leave laser unattended while running',
    ],
    cncQuickStart: [
      'Secure material firmly to bed',
      'Set correct bit, speed, and depth for material',
      'Run simulation before actual cut',
      'Wear safety glasses',
      'Clean bed and surrounding area after use',
    ],
    quickStartSteps: [
      'Select the correct module (Laser or CNC) and install it',
      'Follow the Laser or CNC quick start guide below for mode-specific steps',
      'Ensure fume extraction is running for laser, safety glasses for CNC',
      'Run a test on scrap material before your actual job',
      'Never leave the machine unattended while operating',
    ],
    correctSettings: [],
    laserSettings: [
      { material: 'Plywood (3mm)', power: '80%', speed: '5mm/s', notes: 'Single pass cut' },
      { material: 'Plywood (6mm)', power: '100%', speed: '3mm/s', notes: '2 passes recommended' },
      { material: 'Acrylic (3mm)', power: '100%', speed: '4mm/s', notes: 'Mask with tape to prevent burn marks' },
      { material: 'Acrylic (5mm)', power: '100%', speed: '2mm/s', notes: 'Multiple passes' },
      { material: 'Leather', power: '60%', speed: '8mm/s', notes: 'Engrave: 30% power, 15mm/s' },
      { material: 'Cardboard', power: '40%', speed: '10mm/s', notes: 'Single pass cut' },
      { material: 'Anodized Aluminum', power: '70%', speed: '10mm/s', notes: 'Engrave only — removes anodized layer' },
    ],
    cncSettings: [
      { material: 'Soft Wood', bitType: '1/8" flat end mill', spindleSpeed: '12,000 RPM', depthPerPass: '1.5mm', notes: 'Feed rate: 800mm/min' },
      { material: 'Hard Wood', bitType: '1/8" flat end mill', spindleSpeed: '10,000 RPM', depthPerPass: '1.0mm', notes: 'Feed rate: 600mm/min' },
      { material: 'Acrylic', bitType: '1/8" single flute', spindleSpeed: '10,000 RPM', depthPerPass: '0.5mm', notes: 'Feed rate: 400mm/min, use masking tape' },
      { material: 'Aluminum', bitType: '1/8" 2-flute carbide', spindleSpeed: '12,000 RPM', depthPerPass: '0.2mm', notes: 'Feed rate: 300mm/min, use cutting fluid' },
    ],
    troubleshooting: [
      {
        title: 'Laser Not Cutting Through',
        steps: [
          'Increase power percentage or reduce speed',
          'Check that the laser lens is clean — a dirty lens scatters the beam',
          'Ensure the material is flat and at the correct focal distance',
          'For thick materials, try multiple passes instead of one slow pass',
          'Check that the laser module fan is running — overheating reduces power',
        ],
      },
      {
        title: 'Burn Marks on Material',
        steps: [
          'Reduce laser power slightly',
          'Increase cutting speed',
          'Apply masking tape over the cut line — peel off after cutting',
          'Use the air assist feature if available to blow away smoke at the cut point',
          'For acrylic, the protective film should be left on during cutting',
        ],
      },
      {
        title: 'CNC Bit Breaking',
        steps: [
          'Reduce depth per pass — the most common cause of bit breakage',
          'Check the feed rate is not too high for the material',
          'Ensure the bit is properly colleted and not sticking out too far',
          'For aluminum, use cutting fluid and very light passes',
          'Check that the material is securely clamped — vibration causes bit breakage',
        ],
      },
      {
        title: 'Material Not Secure',
        steps: [
          'Use proper clamps — do not rely on tape or friction alone',
          'Check the CNC wasteboard is clean and flat',
          'For laser work, use the included hold-down pins or magnets',
          'Ensure the work area is level — warped materials shift during cutting',
        ],
      },
      {
        title: 'Laser Not Firing',
        steps: [
          'Check the door safety interlock — the laser will not fire if the enclosure door is open',
          'Verify the laser module is properly seated in the quick-change mount',
          'Check the module connection cable is fully inserted',
          'Restart the machine and try again — sometimes a firmware glitch prevents firing',
          'If the laser still does not fire, the module may need replacement — contact Exco',
        ],
      },
    ],
    repairGuides: [
      {
        title: 'Laser Lens Cleaning',
        difficulty: 'Easy',
        tools: ['Lens cleaning tissue', 'Isopropyl alcohol (90%+)', 'Cotton swabs', 'Compressed air'],
        steps: [
          'Power off the machine and remove the laser module',
          'Use compressed air to blow away loose dust and debris from the lens area',
          'Apply a small amount of IPA to a lens cleaning tissue (never apply liquid directly to the lens)',
          'Gently wipe the lens in a circular motion from center to edge',
          'Use a dry tissue to remove any residue',
          'Inspect the lens under bright light for remaining contamination',
          'If the lens is scratched or permanently clouded, it needs replacement',
        ],
      },
      {
        title: 'Laser Lens Replacement',
        difficulty: 'Medium',
        tools: ['Lens spanner wrench', 'New laser lens', 'Lens cleaning tissue', 'Isopropyl alcohol'],
        warning: 'Do not touch the new lens with bare fingers — skin oils will damage the coating. Handle only by the edges.',
        steps: [
          'Power off and remove the laser module from the machine',
          'Use the lens spanner wrench to unscrew the lens retainer ring',
          'Carefully remove the old lens — note the orientation (convex side faces outward)',
          'Clean the lens housing with IPA and a cotton swab',
          'Install the new lens in the correct orientation — convex side faces the workpiece',
          'Screw the retainer ring back in finger-tight, then snug with the spanner',
          'Reinstall the laser module and recalibrate the focal distance',
        ],
      },
      {
        title: 'CNC Belt Tensioning',
        difficulty: 'Easy',
        tools: ['2mm Allen key', '3mm Allen key'],
        steps: [
          'Power off the machine',
          'Locate the belt tensioner on the axis you need to adjust',
          'Loosen the tensioner lock screws slightly',
          'Push the tensioner to increase belt tension — the belt should have 5-10mm deflection',
          'Tighten the lock screws while holding the tensioner in position',
          'Verify the axis moves smoothly by pushing the gantry back and forth',
          'Repeat for all axes that need adjustment',
        ],
      },
      {
        title: 'Module Calibration',
        difficulty: 'Medium',
        tools: ['Computer with Snapmaker Luban software', 'Calibration card (included)', 'USB cable'],
        steps: [
          'Connect the machine to your computer via USB',
          'Open Snapmaker Luban software and go to Machine Settings',
          'Select the module type you want to calibrate (Laser or CNC)',
          'Follow the on-screen calibration wizard — it will guide you through the process',
          'For laser: calibrate the focal distance using the calibration card',
          'For CNC: calibrate the Z-axis zero point with the touch probe',
          'Save the calibration data to the machine before disconnecting',
        ],
      },
      {
        title: 'Firmware Update',
        difficulty: 'Easy',
        tools: ['Computer with internet', 'USB cable', 'Snapmaker Luban software'],
        steps: [
          'Connect the machine to your computer via USB',
          'Open Snapmaker Luban and go to Machine Settings → Firmware',
          'Click "Check for Updates" — Luban will find the latest firmware',
          'Read the release notes for any important changes',
          'Click "Update" and do not disconnect the USB cable during the process',
          'Wait for the update to complete — the machine will restart automatically',
          'After restart, verify the firmware version in the machine settings',
          'Run a calibration check after any firmware update',
        ],
      },
    ],
    rules: [
      'Check material is laser-safe (no PVC, vinyl, or chlorine-containing materials)',
      'Fume extraction must be running before laser use',
      'Never leave laser unattended',
      'Wear safety glasses for CNC',
      'Clean area after use — remove all debris and offcuts',
      'Report any unusual sounds, smells, or damage immediately',
    ],
    videoUrls: ['https://www.youtube.com/watch?v=FlW-ANX8llE'],
  },
  {
    id: 'soldering-station',
    name: 'Soldering Station',
    icon: '🔧',
    status: 'operational',
    quantity: 'Multiple stations available',
    category: 'soldering',
    quickStartSteps: [
      'Turn on fume extractor before starting',
      'Set correct temperature (lead-free: 350°C, leaded: 320°C)',
      'Tin the tip before and after use',
      'Use helping hands or clamp to hold your work',
      'Turn off iron and clean workstation when done',
    ],
    correctSettings: [
      { material: 'Lead-free solder', nozzle: '350°C', bed: '', notes: 'Most common — use for all general work' },
      { material: 'Leaded solder', nozzle: '320°C', bed: '', notes: 'Lower temp, easier to work with' },
      { material: 'SMD work', nozzle: '300-320°C', bed: '', notes: 'Use fine tip (chisel or conical)' },
      { material: 'High-power work (thick wires, large pads)', nozzle: '370-400°C', bed: '', notes: 'Use chisel tip for heat transfer' },
    ],
    troubleshooting: [
      {
        title: 'Solder Not Flowing',
        steps: [
          'The tip may be dirty or oxidized — clean with brass wool and re-tin immediately',
          'Temperature may be too low — increase by 10-20°C',
          'Both surfaces must be heated before applying solder — touch the iron to both the pad and the component lead',
          'Add a small amount of fresh flux to help the solder flow',
          'If using old solder, it may have lost its flux core — try fresh solder',
        ],
      },
      {
        title: 'Burnt Flux / Brown Residue',
        steps: [
          'Temperature is too high — reduce to 320°C for leaded or 350°C for lead-free',
          'You are holding the iron on the joint too long — aim for 2-3 seconds max',
          'Clean the brown residue with IPA and a brush after the joint cools',
          'Use flux pens or flux core solder rather than applying additional paste flux',
        ],
      },
      {
        title: 'Cold Joint (Dull / Grainy Appearance)',
        steps: [
          'Reheat the joint — apply the iron to both the pad and the component lead simultaneously',
          'Add a tiny amount of fresh solder with flux to help reflow',
          'Ensure both surfaces reach solder melting temperature before adding solder',
          'A proper joint should be shiny and have a concave (volcano) shape',
          'If the joint cracks when moved, the component moved while the solder was cooling',
        ],
      },
      {
        title: 'Tip Oxidation (Black, Won\'t Take Solder)',
        steps: [
          'Clean vigorously with brass wool — do not use a file or sandpaper (it destroys the plating)',
          'Immediately apply solder to the hot tip after cleaning (re-tin)',
          'If the tip is still black after brass wool cleaning, try tip activator paste',
          'Prevent future oxidation by always tinning the tip before putting the iron in the holder',
          'If severely oxidized, the tip needs replacement — report to Exco',
        ],
      },
      {
        title: 'Solder Bridges Between Pins',
        steps: [
          'Use solder wick (desoldering braid) — place the wick on the bridge and apply the iron on top',
          'The wick will absorb the excess solder through capillary action',
          'Alternatively, use a desoldering pump (solder sucker) — melt the bridge and quickly suck',
          'Add flux before using the wick — it helps the solder flow into the braid',
          'Use a finer tip for close-pitch IC work to prevent bridges in the first place',
        ],
      },
    ],
    repairGuides: [
      {
        title: 'Tip Replacement',
        difficulty: 'Easy',
        tools: ['New soldering tip (compatible model)', 'Brass wool', 'Solder for tinning'],
        steps: [
          'Turn off the soldering iron and let it cool completely',
          'Pull the old tip straight off the heating element — do not twist',
          'Check the heating element for damage or corrosion',
          'Push the new tip onto the heating element until it seats fully',
          'Turn on the iron and set to normal working temperature',
          'Tin the new tip immediately with fresh solder — coat the entire working surface',
          'The tip should be shiny and accept solder easily if properly installed',
        ],
      },
      {
        title: 'Iron Calibration',
        difficulty: 'Medium',
        tools: ['Thermocouple thermometer', 'Soldering tip thermometer (if available)', 'Small screwdriver (for adjustment)'],
        steps: [
          'Set the iron to a known temperature (e.g., 350°C)',
          'Measure the actual tip temperature using a thermocouple or tip thermometer',
          'If the reading differs by more than ±10°C, calibration is needed',
          'Some stations have a calibration screw inside the handle or base',
          'Adjust the calibration screw until the measured temperature matches the set temperature',
          'If no adjustment is available, note the offset and compensate when setting temperatures',
          'Recheck after 15 minutes of warm-up time — some stations drift',
        ],
      },
      {
        title: 'Cleaning Procedures',
        difficulty: 'Easy',
        tools: ['Brass wool tip cleaner', 'Isopropyl alcohol', 'Lint-free cloth', 'Cotton swabs'],
        steps: [
          'For tip cleaning: plunge the hot tip into brass wool 2-3 times, then re-tin immediately',
          'For the iron body: wipe with IPA on a lint-free cloth when cool',
          'Clean the tip holder / sponge tray — remove old solder balls and flux residue',
          'If using a wet sponge, ensure it is damp (not soaking wet) and replace when worn',
          'Clean the work surface with IPA to remove flux residue and solder splatter',
          'Brass wool containers should be emptied and refreshed periodically',
        ],
      },
      {
        title: 'Heating Element Failure Diagnosis',
        difficulty: 'Hard',
        tools: ['Multimeter', 'Replacement heating element (if needed)', 'Small screwdriver set'],
        warning: 'Unplug the station before opening any enclosures. If the heating element is confirmed dead, the iron likely needs replacement — contact Exco.',
        steps: [
          'Verify the station powers on and the display shows temperature',
          'If the iron never heats up but the display works, the heating element may be dead',
          'Unplug the station and use a multimeter to check continuity across the heating element terminals',
          'If open circuit (no continuity), the heating element is broken and needs replacement',
          'If the element has continuity but still does not heat, check the control board connections',
          'Check the handle cable for breaks — flex the cable while measuring continuity',
          'If the heating element is dead, the iron should be replaced — report to Exco for ordering',
        ],
      },
    ],
    rules: [
      'Fume extractor must be on',
      'Clean tip after every use — return to holder tinned',
      'Return all tools to their labeled locations',
      'Clean workstation — remove solder scraps, wire clippings, flux residue',
      'Turn off iron when leaving, even if just for a break',
      'Report damaged tips, broken tools, or low supplies',
    ],
    videoUrls: ['https://www.youtube.com/watch?v=3jAw41LRBxU'],
  },
];

export const initialFilament: FilamentItem[] = [
  { id: 'f1', material: 'CoPE', brand: 'Panchroma CoPE', size: '1Kg', colors: 'Black, Grey, White, Orange' },
  { id: 'f2', material: 'PLA', brand: 'Polymaker Polylite PLA', size: '3Kg', colors: 'Black, White' },
  { id: 'f3', material: 'PLA', brand: 'Polymaker Panchroma PLA Matte', size: '1Kg', colors: 'Various' },
  { id: 'f4', material: 'PETG', brand: 'Polymaker Polylite PETG', size: '1Kg', colors: 'Black, Grey, White, Clear' },
  { id: 'f5', material: 'PETG', brand: 'Polymaker Fiberon PETG-CF', size: '1Kg', colors: 'Black' },
  { id: 'f6', material: 'PC', brand: 'Polymaker Polylite PC', size: '1Kg', colors: 'Clear' },
  { id: 'f7', material: 'PC', brand: 'Polymaker Polymax PC', size: '750g', colors: 'White' },
  { id: 'f8', material: 'PA', brand: 'Polymaker Polymide CoPA', size: '750g', colors: 'Black, White' },
  { id: 'f9', material: 'PA', brand: 'Polymaker Fiberon PA6-CF', size: '500g', colors: 'Black' },
  { id: 'f10', material: 'PA', brand: 'Polymaker Fiberon PA6-GF', size: '500g', colors: 'Black' },
  { id: 'f11', material: 'TPU', brand: 'Polymaker Polyflex TPU90A', size: '750g', colors: 'White' },
  { id: 'f12', material: 'TPU', brand: 'Polymaker Polyflex TPU95 HF', size: '750g', colors: 'Various' },
  { id: 'f13', material: 'TPU', brand: 'Esun eTPU 95a', size: '1Kg', colors: 'Black' },
];

export function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/[?&]v=([^&]+)/);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  // Handle youtu.be format
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }
  return url;
}

export function getStatusColor(status: MachineStatus): string {
  switch (status) {
    case 'operational': return '#34d399';
    case 'needs-attention': return '#fbbf24';
    case 'down': return '#f87171';
  }
}

export function getStatusLabel(status: MachineStatus): string {
  switch (status) {
    case 'operational': return 'Operational';
    case 'needs-attention': return 'Needs Attention';
    case 'down': return 'Down';
  }
}

export function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'broken': '🔴 Broken / Not Working',
    'needs-calibration': '🟡 Needs Calibration',
    'missing-parts': '🟠 Missing Parts/Accessories',
    'other': '⚪ Other Issue'
  };
  return labels[type] || type;
}

export function getIssueStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'open': '#f87171',
    'in-progress': '#fbbf24',
    'resolved': '#34d399'
  };
  return colors[status] || '#a0a4b4';
}
