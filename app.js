/* Airport Coordinates Database */
const AIRPORTS = {
  JFK: { name: 'New York (JFK)', lat: 40.6413, lng: -73.7781, city: 'New York' },
  LAX: { name: 'Los Angeles (LAX)', lat: 33.9425, lng: -118.4081, city: 'Los Angeles' },
  LHR: { name: 'London Heathrow (LHR)', lat: 51.4700, lng: -0.4543, city: 'London' },
  CDG: { name: 'Paris Charles de Gaulle (CDG)', lat: 49.0097, lng: 2.5479, city: 'Paris' },
  DXB: { name: 'Dubai Intl (DXB)', lat: 25.2532, lng: 55.3657, city: 'Dubai' },
  SIN: { name: 'Singapore Changi (SIN)', lat: 1.3644, lng: 103.9915, city: 'Singapore' },
  TYO: { name: 'Tokyo Haneda (HND)', lat: 35.5494, lng: 139.7798, city: 'Tokyo' },
  SYD: { name: 'Sydney Kingsford (SYD)', lat: -33.9399, lng: 151.1753, city: 'Sydney' },
  FRA: { name: 'Frankfurt Airport (FRA)', lat: 50.0379, lng: 8.5622, city: 'Frankfurt' }
};

/* Airline Catalog for Dynamic Scheduling */
const AIRLINE_CATALOG = [
  { name: 'SkyJet Economy', prefix: 'SJ', aircraft: 'Airbus A321neo', tier: 'budget', baggage: 'Cabin bag only', direct: true },
  { name: 'Norse Express', prefix: 'NE', aircraft: 'Boeing 737 MAX 9', tier: 'budget', baggage: 'Personal item only', direct: true },
  { name: 'Global Connect', prefix: 'GC', aircraft: 'Airbus A320neo', tier: 'budget', baggage: '1 Check-in (15kg)', direct: false },
  { name: 'SmartAir Shuttle', prefix: 'SA', aircraft: 'Boeing 787-9 Dreamliner', tier: 'standard', baggage: '1 Check-in (23kg)', direct: true },
  { name: 'Atlantic Wings', prefix: 'AW', aircraft: 'Airbus A350-900', tier: 'standard', baggage: '1 Check-in + Meal', direct: true },
  { name: 'Pacific Trans', prefix: 'PT', aircraft: 'Boeing 777-300ER', tier: 'standard', baggage: '23kg Check-in', direct: true },
  { name: 'British Star', prefix: 'BS', aircraft: 'Boeing 787-10', tier: 'standard', baggage: '2 Bags included', direct: true },
  { name: 'Emirates Airway', prefix: 'EA', aircraft: 'Airbus A380-800', tier: 'premium', baggage: '30kg Allowance', direct: true },
  { name: 'Lufthansa Line', prefix: 'LH', aircraft: 'Boeing 747-8 Intercontinental', tier: 'premium', baggage: '2 Bags (32kg)', direct: true },
  { name: 'Singa Global', prefix: 'SG', aircraft: 'Airbus A350-1000', tier: 'premium', baggage: 'Full Allowance (35kg)', direct: true },
  { name: 'Interline Transfer', prefix: 'IT', aircraft: 'Airbus A330-300', tier: 'budget', baggage: '1 Check-in', direct: false },
  { name: 'Royal Nightliner', prefix: 'RN', aircraft: 'Boeing 777-300ER', tier: 'premium', baggage: 'VIP 40kg Included', direct: true }
];

let state = {
  selectedFlight: null,
  selectedSeats: [],
  passengerCount: 1,
  cabinClass: 'economy',
  calculatedPricePerPax: 0,
  verifiedPassengers: []
};

let ACTIVE_FLIGHTS = [];
let globeScene, globeCamera, globeRenderer, globeObj, arcLineObj, movingPlaneMesh;
let currentFlightCurve = null;
let flightProgress = 0;

document.addEventListener('DOMContentLoaded', () => {
  const departInput = document.getElementById('departDate');
  if (departInput) departInput.valueAsDate = new Date();

  init3DGlobe();
  initAuth();
  initSearch();
  initSeatPicker();
  initPassportVerification();
  initPaymentGateway();
  initBookings();

  // Initial Projection
  projectFlightArc('JFK', 'LHR');
});

/* 1. Three.js 3D Globe Visualizer with Live Animated Plane */
function init3DGlobe() {
  const container = document.getElementById('globeContainer');
  if (!container) return;

  globeScene = new THREE.Scene();
  globeCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  globeCamera.position.z = 225;

  globeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  globeRenderer.setSize(container.clientWidth, container.clientHeight);
  globeRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(globeRenderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  globeScene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
  dirLight.position.set(120, 100, 100);
  globeScene.add(dirLight);

  // Wireframe Globe Sphere
  const geometry = new THREE.SphereGeometry(60, 48, 48);
  const material = new THREE.MeshPhongMaterial({
    color: 0x1e1b4b,
    wireframe: true,
    transparent: true,
    opacity: 0.35
  });
  globeObj = new THREE.Mesh(geometry, material);
  globeScene.add(globeObj);

  // Airport Pin Nodes & Pulse Rings
  Object.keys(AIRPORTS).forEach(key => {
    const apt = AIRPORTS[key];
    const pos = latLngToVector3(apt.lat, apt.lng, 60);

    const pinGeo = new THREE.SphereGeometry(1.5, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.copy(pos);
    globeObj.add(pinMesh);

    const ringGeo = new THREE.RingGeometry(2, 2.6, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(pos);
    ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
    globeObj.add(ringMesh);
  });

  // 3D Airplane Object
  const planeGroup = new THREE.Group();
  const fuselageGeo = new THREE.ConeGeometry(1.4, 5, 8);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselageMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
  planeGroup.add(fuselage);

  const wingGeo = new THREE.BoxGeometry(7, 0.2, 1.8);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.position.set(0, 0, -0.5);
  planeGroup.add(wing);

  movingPlaneMesh = planeGroup;
  movingPlaneMesh.visible = false;
  globeObj.add(movingPlaneMesh);

  const controls = new THREE.OrbitControls(globeCamera, globeRenderer.domElement);
  controls.enableZoom = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  function animate() {
    requestAnimationFrame(animate);

    if (currentFlightCurve && movingPlaneMesh) {
      flightProgress += 0.0035;
      if (flightProgress > 1) flightProgress = 0;

      const point = currentFlightCurve.getPoint(flightProgress);
      const tangent = currentFlightCurve.getTangent(flightProgress);

      movingPlaneMesh.position.copy(point);
      const lookTarget = point.clone().add(tangent);
      movingPlaneMesh.lookAt(lookTarget);
      movingPlaneMesh.visible = true;
    }

    controls.update();
    globeRenderer.render(globeScene, globeCamera);
  }
  animate();

  window.addEventListener('resize', () => {
    if (!container) return;
    globeCamera.aspect = container.clientWidth / container.clientHeight;
    globeCamera.updateProjectionMatrix();
    globeRenderer.setSize(container.clientWidth, container.clientHeight);
  });
}

function projectFlightArc(originKey, destKey) {
  if (arcLineObj) globeObj.remove(arcLineObj);

  const p1 = latLngToVector3(AIRPORTS[originKey].lat, AIRPORTS[originKey].lng, 60);
  const p2 = latLngToVector3(AIRPORTS[destKey].lat, AIRPORTS[destKey].lng, 60);

  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const distance = p1.distanceTo(p2);
  mid.setLength(60 + distance * 0.28);

  currentFlightCurve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
  flightProgress = 0;

  const points = currentFlightCurve.getPoints(60);
  const curveGeo = new THREE.BufferGeometry().setFromPoints(points);

  const curveMat = new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    linewidth: 2,
    dashSize: 3,
    gapSize: 1
  });

  arcLineObj = new THREE.Line(curveGeo, curveMat);
  arcLineObj.computeLineDistances();
  globeObj.add(arcLineObj);

  const statusEl = document.getElementById('routeStatus');
  if (statusEl) {
    statusEl.innerHTML = `Live Trajectory: <strong style="color:var(--accent);">${AIRPORTS[originKey].name}</strong> ✈ <strong style="color:var(--accent);">${AIRPORTS[destKey].name}</strong>`;
  }
}

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = (radius * Math.sin(phi) * Math.sin(theta));
  const y = (radius * Math.cos(phi));
  return new THREE.Vector3(x, y, z);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/* 2. Dynamic Schedule Generator */
function generateDynamicFlights(originKey, destKey) {
  const origin = AIRPORTS[originKey];
  const dest = AIRPORTS[destKey];
  if (!origin || !dest) return [];

  const distance = Math.round(calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng));
  const flightHours = Math.max(1.2, distance / 850);
  const totalMinutes = Math.round(flightHours * 60);
  const basePrice = Math.max(180, Math.round(distance * 0.075));

  const departureSlots = [
    { dep: '06:15 AM', depMin: 375 },
    { dep: '08:30 AM', depMin: 510 },
    { dep: '10:45 AM', depMin: 645 },
    { dep: '01:15 PM', depMin: 795 },
    { dep: '03:40 PM', depMin: 940 },
    { dep: '05:50 PM', depMin: 1070 },
    { dep: '07:20 PM', depMin: 1160 },
    { dep: '09:00 PM', depMin: 1260 },
    { dep: '10:30 PM', depMin: 1350 },
    { dep: '11:45 PM', depMin: 1425 }
  ];

  return departureSlots.map((slot, index) => {
    const airlineMeta = AIRLINE_CATALOG[index % AIRLINE_CATALOG.length];
    const isDirect = airlineMeta.direct;
    const durationMin = isDirect ? totalMinutes : Math.round(totalMinutes * 1.35 + 90);

    const durH = Math.floor(durationMin / 60);
    const durM = durationMin % 60;
    const durationStr = `${durH}h ${durM < 10 ? '0' : ''}${durM}m`;

    const arrTotalMin = (slot.depMin + durationMin) % 1440;
    const arrH = Math.floor(arrTotalMin / 60);
    const arrM = arrTotalMin % 60;
    const ampm = arrH >= 12 ? 'PM' : 'AM';
    const displayH = arrH % 12 === 0 ? 12 : arrH % 12;
    const arrivalStr = `${displayH < 10 ? '0' : ''}${displayH}:${arrM < 10 ? '0' : ''}${arrM} ${ampm}`;

    let price = basePrice;
    if (airlineMeta.tier === 'budget') price = Math.round(basePrice * 0.72);
    else if (airlineMeta.tier === 'premium') price = Math.round(basePrice * 1.35);
    if (!isDirect) price = Math.round(price * 0.85);

    const flightNum = 100 + ((originKey.charCodeAt(0) * 7 + destKey.charCodeAt(0) * 11 + index * 19) % 899);

    return {
      id: `FL-${originKey}${destKey}-${index + 1}`,
      airline: airlineMeta.name,
      code: `${airlineMeta.prefix}-${flightNum}`,
      origin: originKey,
      destination: destKey,
      price: price,
      duration: durationStr,
      durationMin: durationMin,
      departure: slot.dep,
      departureMin: slot.depMin,
      arrival: arrivalStr,
      aircraft: airlineMeta.aircraft,
      direct: isDirect,
      baggage: airlineMeta.baggage
    };
  });
}

function getClassMultiplier(cabin) {
  if (cabin === 'premium') return 1.5;
  if (cabin === 'business') return 2.6;
  return 1.0;
}

function renderFlights() {
  const resultsSection = document.getElementById('resultsSection');
  const resultsList = document.getElementById('flightResultsList');
  const from = document.getElementById('fromLocation').value;
  const to = document.getElementById('toLocation').value;
  const isDirectOnly = document.getElementById('directOnly').checked;
  const sortMode = document.getElementById('sortBy').value;
  const multiplier = getClassMultiplier(state.cabinClass);

  ACTIVE_FLIGHTS = generateDynamicFlights(from, to);
  let filtered = [...ACTIVE_FLIGHTS];

  if (isDirectOnly) filtered = filtered.filter(f => f.direct);

  if (sortMode === 'price') filtered.sort((a, b) => a.price - b.price);
  if (sortMode === 'duration') filtered.sort((a, b) => a.durationMin - b.durationMin);
  if (sortMode === 'departure') filtered.sort((a, b) => a.departureMin - b.departureMin);

  document.getElementById('searchRouteHeader').textContent = `${AIRPORTS[from].city} (${from}) → ${AIRPORTS[to].city} (${to})`;
  document.getElementById('searchMetaHeader').textContent = `${filtered.length} scheduled flights available • Class: ${state.cabinClass.toUpperCase()} • ${state.passengerCount} Traveler(s)`;

  resultsList.innerHTML = '';
  filtered.forEach(flight => {
    const adjustedPrice = Math.round(flight.price * multiplier);
    const card = document.createElement('div');
    card.className = 'flight-card';
    card.innerHTML = `
      <div style="flex: 1;">
        <div class="flight-airline-badge">
          <strong>${flight.airline}</strong>
          <span style="color:var(--text-muted); font-size:0.85rem;">${flight.code}</span>
        </div>
        <div class="flight-timeline">
          <div class="time-node">
            <span class="time">${flight.departure}</span>
            <span class="code">${flight.origin}</span>
          </div>
          <div class="flight-path-bar">
            <span style="font-size:0.75rem; color:var(--text-muted);">${flight.duration}</span>
            <div class="path-line"></div>
            <span style="font-size:0.7rem; color:${flight.direct ? 'var(--success)' : 'var(--text-muted)'};">
              ${flight.direct ? 'Non-stop' : '1 Layover'}
            </span>
          </div>
          <div class="time-node">
            <span class="time">${flight.arrival}</span>
            <span class="code">${flight.destination}</span>
          </div>
        </div>
        <div class="flight-badges">
          <span class="badge badge-aircraft"><i class="fa-solid fa-plane"></i> ${flight.aircraft}</span>
          <span class="badge"><i class="fa-solid fa-suitcase-rolling"></i> ${flight.baggage}</span>
        </div>
      </div>

      <div style="text-align:right; border-left:1px solid rgba(255,255,255,0.06); padding-left:25px;">
        <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Per Passenger</span>
        <span style="font-size:1.8rem; font-weight:800; color:var(--accent); display:block;">$${adjustedPrice}</span>
        <button class="btn btn-primary" onclick="openSeatPicker('${flight.id}', ${adjustedPrice})">
          Select Seats <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;
    resultsList.appendChild(card);
  });

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/* 3. Search & Form Logic */
function initSearch() {
  const searchForm = document.getElementById('flightSearchForm');
  const swapBtn = document.getElementById('swapLocationsBtn');
  const sortBy = document.getElementById('sortBy');
  const directOnly = document.getElementById('directOnly');
  const tripTypeRadios = document.querySelectorAll('input[name="tripType"]');

  tripTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const returnGroup = document.getElementById('returnGroup');
      if (e.target.value === 'roundtrip') {
        returnGroup.style.display = 'flex';
        const departVal = document.getElementById('departDate').value;
        if (departVal) {
          const ret = new Date(departVal);
          ret.setDate(ret.getDate() + 7);
          document.getElementById('returnDate').valueAsDate = ret;
        }
      } else {
        returnGroup.style.display = 'none';
      }
    });
  });

  swapBtn?.addEventListener('click', () => {
    const from = document.getElementById('fromLocation');
    const to = document.getElementById('toLocation');
    const temp = from.value;
    from.value = to.value;
    to.value = temp;
    projectFlightArc(from.value, to.value);
  });

  document.getElementById('fromLocation')?.addEventListener('change', () => {
    const from = document.getElementById('fromLocation').value;
    const to = document.getElementById('toLocation').value;
    if (from !== to) projectFlightArc(from, to);
  });

  document.getElementById('toLocation')?.addEventListener('change', () => {
    const from = document.getElementById('fromLocation').value;
    const to = document.getElementById('toLocation').value;
    if (from !== to) projectFlightArc(from, to);
  });

  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const from = document.getElementById('fromLocation').value;
    const to = document.getElementById('toLocation').value;
    if (from === to) {
      alert('Origin and Destination airports must be different.');
      return;
    }
    state.passengerCount = parseInt(document.getElementById('passengerCount').value) || 1;
    state.cabinClass = document.getElementById('cabinClass').value;

    projectFlightArc(from, to);
    renderFlights();
  });

  sortBy?.addEventListener('change', renderFlights);
  directOnly?.addEventListener('change', renderFlights);
}

/* 4. Cabin Seat Picker */
function initSeatPicker() {
  const closeSeatBtn = document.getElementById('closeSeatBtn');
  const confirmSeatBtn = document.getElementById('confirmSeatBtn');
  const seatModal = document.getElementById('seatModal');

  closeSeatBtn?.addEventListener('click', () => seatModal.classList.add('hidden'));
  confirmSeatBtn?.addEventListener('click', () => {
    seatModal.classList.add('hidden');
    openPassportVerification();
  });
}

window.openSeatPicker = (flightId, currentPrice) => {
  const user = JSON.parse(localStorage.getItem('smarttrip_user'));
  if (!user) {
    alert('Please sign in to proceed with booking!');
    document.getElementById('authModal').classList.remove('hidden');
    return;
  }

  state.selectedFlight = ACTIVE_FLIGHTS.find(f => f.id === flightId);
  state.calculatedPricePerPax = currentPrice;
  state.selectedSeats = [];

  const seatContainer = document.getElementById('seatMapContainer');
  const confirmBtn = document.getElementById('confirmSeatBtn');
  const label = document.getElementById('selectedSeatLabel');
  const instructions = document.getElementById('seatInstructions');

  confirmBtn.disabled = true;
  label.textContent = 'None';
  instructions.textContent = `Please select ${state.passengerCount} seat(s) for your party.`;
  seatContainer.innerHTML = '';

  const rows = 6;
  const cols = ['A', 'B', 'C', 'AISLE', 'D', 'E', 'F'];

  for (let r = 1; r <= rows; r++) {
    cols.forEach(col => {
      if (col === 'AISLE') {
        const aisle = document.createElement('div');
        aisle.className = 'seat aisle';
        aisle.textContent = `${r}`;
        seatContainer.appendChild(aisle);
        return;
      }

      const seatNum = `${r}${col}`;
      const isBusiness = r <= 2;
      const isOccupied = (r * 7 + col.charCodeAt(0)) % 6 === 0;

      const seatEl = document.createElement('div');
      seatEl.className = `seat ${isBusiness ? 'business' : ''} ${isOccupied ? 'occupied' : ''}`;
      seatEl.textContent = seatNum;

      if (!isOccupied) {
        seatEl.onclick = () => {
          if (state.selectedSeats.includes(seatNum)) {
            state.selectedSeats = state.selectedSeats.filter(s => s !== seatNum);
            seatEl.classList.remove('selected');
          } else {
            if (state.selectedSeats.length < state.passengerCount) {
              state.selectedSeats.push(seatNum);
              seatEl.classList.add('selected');
            } else {
              alert(`You already selected all ${state.passengerCount} seat(s).`);
            }
          }

          label.textContent = state.selectedSeats.length > 0 ? state.selectedSeats.join(', ') : 'None';
          confirmBtn.disabled = state.selectedSeats.length !== state.passengerCount;
        };
      }
      seatContainer.appendChild(seatEl);
    });
  }

  document.getElementById('seatModal').classList.remove('hidden');
};/* 5. APIS Passport & Visa Verification Engine */
function initPassportVerification() {
  const closePassportBtn = document.getElementById('closePassportBtn');
  const passportModal = document.getElementById('passportModal');
  const form = document.getElementById('passengerVerificationForm');

  closePassportBtn?.addEventListener('click', () => passportModal.classList.add('hidden'));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const departDateVal = new Date(document.getElementById('departDate').value || new Date());
    const minExpiryDate = new Date(departDateVal);
    minExpiryDate.setMonth(minExpiryDate.getMonth() + 6);

    state.verifiedPassengers = [];

    for (let i = 0; i < state.passengerCount; i++) {
      const name = document.getElementById(`pax_name_${i}`).value.trim();
      const passportNo = document.getElementById(`pax_passport_${i}`).value.trim().toUpperCase();
      const expiryDate = new Date(document.getElementById(`pax_expiry_${i}`).value);
      const nationality = document.getElementById(`pax_nation_${i}`).value;
      const visaStatus = document.getElementById(`pax_visa_${i}`).value;
      const seat = state.selectedSeats[i] || 'Auto-assigned';

      // 6-Month Passport Rule Validation
      if (expiryDate < minExpiryDate) {
        alert(`Validation Error (Traveler ${i + 1}): Passport expires on ${expiryDate.toLocaleDateString()}. International aviation guidelines require at least 6 months validity from departure date.`);
        return;
      }

      state.verifiedPassengers.push({
        name,
        passportNo,
        nationality,
        visaStatus,
        seat
      });
    }

    passportModal.classList.add('hidden');
    openPaymentGateway();
  });
}

function openPassportVerification() {
  const container = document.getElementById('passengerFormsContainer');
  container.innerHTML = '';

  for (let i = 0; i < state.passengerCount; i++) {
    const seatAlloc = state.selectedSeats[i] || 'TBD';
    const card = document.createElement('div');
    card.className = 'passenger-card-form';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:8px;">
        <strong><i class="fa-solid fa-user"></i> Passenger ${i + 1}</strong>
        <span style="color:var(--accent); font-size:0.85rem; font-weight:700;">Seat: ${seatAlloc}</span>
      </div>
      <div class="pax-grid">
        <div class="input-group">
          <label>Full Legal Name (as in Passport)</label>
          <input type="text" id="pax_name_${i}" placeholder="First Middle Last" required />
        </div>
        <div class="input-group">
          <label>Nationality / Citizenship</label>
          <select id="pax_nation_${i}" required>
            <option value="United States">United States (USA)</option>
            <option value="India">India (IND)</option>
            <option value="United Kingdom">United Kingdom (GBR)</option>
            <option value="Germany">Germany (DEU)</option>
            <option value="France">France (FRA)</option>
            <option value="United Arab Emirates">United Arab Emirates (UAE)</option>
            <option value="Japan">Japan (JPN)</option>
            <option value="Australia">Australia (AUS)</option>
            <option value="Singapore">Singapore (SGP)</option>
          </select>
        </div>
        <div class="input-group">
          <label>Passport Number</label>
          <input type="text" id="pax_passport_${i}" placeholder="e.g. A9283719" maxlength="12" required />
        </div>
        <div class="input-group">
          <label>Passport Expiry Date</label>
          <input type="date" id="pax_expiry_${i}" required />
        </div>
        <div class="input-group">
          <label>Destination Visa Status</label>
          <select id="pax_visa_${i}" required>
            <option value="Valid Visa On File">Valid Tourist/Business Visa Approved</option>
            <option value="Visa-Free / Electronic ETA">Visa-Free / ESTA / e-TA Eligible</option>
            <option value="Visa on Arrival">Eligible for Visa on Arrival</option>
          </select>
        </div>
      </div>
    `;
    container.appendChild(card);
  }

  document.getElementById('passportModal').classList.remove('hidden');
}

/* 6. UPI QR Code Gateway with Phone Gallery Upload */
function initPaymentGateway() {
  const closePaymentBtn = document.getElementById('closePaymentBtn');
  const paymentModal = document.getElementById('paymentModal');
  const simulateBtn = document.getElementById('simulateUpiSuccessBtn');
  const qrFileInput = document.getElementById('qrFileInput');
  const upiImg = document.getElementById('upiQrImage');

  closePaymentBtn?.addEventListener('click', () => paymentModal.classList.add('hidden'));

  // Allow uploading QR directly from Phone Gallery / File System
  qrFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Image = event.target.result;
        upiImg.src = base64Image;
        localStorage.setItem('smarttrip_custom_qr', base64Image);
        alert('QR code updated successfully from your device!');
      };
      reader.readAsDataURL(file);
    }
  });

  simulateBtn?.addEventListener('click', () => {
    simulateBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying UPI Transfer...`;
    simulateBtn.disabled = true;

    setTimeout(() => {
      simulateBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verify Payment & Issue Boarding Pass`;
      simulateBtn.disabled = false;
      paymentModal.classList.add('hidden');
      issueConfirmedTickets();
    }, 1200);
  });
}

function openPaymentGateway() {
  const flight = state.selectedFlight;
  const pax = state.passengerCount;
  const baseSubtotal = state.calculatedPricePerPax * pax;
  const taxesFees = Math.round(baseSubtotal * 0.14);
  const totalUSD = baseSubtotal + taxesFees;
  const totalINR = totalUSD * 85;

  document.getElementById('qrTotalAmount').textContent = `$${totalUSD} (₹${totalINR.toLocaleString('en-IN')})`;

  const upiImg = document.getElementById('upiQrImage');
  const savedQR = localStorage.getItem('smarttrip_custom_qr');

  if (savedQR) {
    upiImg.src = savedQR;
  } else {
    // Check for qr.png, fallback to live generator
    upiImg.src = 'qr.png';
  }
  
  document.getElementById('paymentModal').classList.remove('hidden');
}

function issueConfirmedTickets() {
  const flight = state.selectedFlight;
  const pnr = 'ST-' + Math.floor(100000 + Math.random() * 900000);
  const total = Math.round(state.calculatedPricePerPax * state.passengerCount * 1.14);

  const booking = {
    pnr,
    flightId: flight.id,
    airline: flight.airline,
    flightCode: flight.code,
    origin: flight.origin,
    destination: flight.destination,
    gate: 'G' + Math.floor(1 + Math.random() * 24),
    terminal: 'T' + Math.floor(1 + Math.random() * 4),
    boardingTime: flight.departure,
    price: total,
    passengers: state.verifiedPassengers,
    cabinClass: state.cabinClass.toUpperCase(),
    date: document.getElementById('departDate').value || new Date().toLocaleDateString()
  };

  const existingBookings = JSON.parse(localStorage.getItem('smarttrip_bookings') || '[]');
  existingBookings.push(booking);
  localStorage.setItem('smarttrip_bookings', JSON.stringify(existingBookings));

  alert(`Payment Confirmed via UPI! Official Boarding Pass Issued. PNR: ${pnr}`);
  renderBookingsList();
  document.getElementById('bookingsModal').classList.remove('hidden');
}

/* 7. Bookings & Official Boarding Passes */
function initBookings() {
  const myBookingsBtn = document.getElementById('myBookingsBtn');
  const closeBookingsBtn = document.getElementById('closeBookingsBtn');
  const bookingsModal = document.getElementById('bookingsModal');

  myBookingsBtn?.addEventListener('click', () => { renderBookingsList(); bookingsModal.classList.remove('hidden'); });
  closeBookingsBtn?.addEventListener('click', () => bookingsModal.classList.add('hidden'));
}

function renderBookingsList() {
  const bookingsList = document.getElementById('myBookingsList');
  const bookings = JSON.parse(localStorage.getItem('smarttrip_bookings') || '[]');
  bookingsList.innerHTML = '';

  if (bookings.length === 0) {
    bookingsList.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 30px;">No active boarding passes found.</p>';
  } else {
    bookings.forEach((b, index) => {
      const item = document.createElement('div');
      item.className = 'ticket-card';
      
      const paxRows = (b.passengers || []).map(p => `
        <div style="background:rgba(15,23,42,0.6); padding:8px 12px; border-radius:6px; margin-top:6px; display:flex; justify-content:space-between; font-size:0.8rem;">
          <span><strong>${p.name}</strong> (${p.nationality}) • Passport: ${p.passportNo}</span>
          <span style="color:var(--accent); font-weight:700;">Seat: ${p.seat} [${p.visaStatus}]</span>
        </div>
      `).join('');

      item.innerHTML = `
        <div class="ticket-header">
          <div>
            <strong style="color:var(--accent); font-size:1.15rem;">PNR: ${b.pnr}</strong>
            <p style="color:var(--text-muted); font-size:0.85rem;">${b.airline} (${b.flightCode}) • Class: ${b.cabinClass}</p>
          </div>
          <div>
            <button class="btn btn-outline" onclick="window.print()" style="padding:4px 10px; font-size:0.75rem; margin-right:6px;"><i class="fa-solid fa-print"></i> Print</button>
            <button class="btn btn-danger" onclick="cancelBooking(${index})" style="padding:4px 10px; font-size:0.75rem;">Cancel</button>
          </div>
        </div>

        <div class="ticket-grid">
          <div><span style="color:var(--text-muted)">ROUTE:</span><br><strong>${b.origin} → ${b.destination}</strong></div>
          <div><span style="color:var(--text-muted)">DATE / DEPARTURE:</span><br><strong>${b.date} • ${b.boardingTime}</strong></div>
          <div><span style="color:var(--text-muted)">TERMINAL / GATE:</span><br><strong>${b.terminal} • Gate ${b.gate}</strong></div>
          <div><span style="color:var(--text-muted)">PAYMENT STATUS:</span><br><strong style="color:var(--success)">PAID via UPI ($${b.price})</strong></div>
        </div>

        <div style="margin-top:12px;">
          <span style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Verified Passenger Manifest:</span>
          ${paxRows}
        </div>

        <div class="barcode"></div>
      `;
      bookingsList.appendChild(item);
    });
  }
}

window.cancelBooking = (index) => {
  if (confirm('Are you sure you want to cancel this booking and initiate a refund?')) {
    let bookings = JSON.parse(localStorage.getItem('smarttrip_bookings') || '[]');
    bookings.splice(index, 1);
    localStorage.setItem('smarttrip_bookings', JSON.stringify(bookings));
    renderBookingsList();
  }
};

/* 8. Authentication */
function initAuth() {
  const openAuthBtn = document.getElementById('openAuthBtn');
  const closeAuthBtn = document.getElementById('closeAuthBtn');
  const authModal = document.getElementById('authModal');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  openAuthBtn?.addEventListener('click', () => authModal.classList.remove('hidden'));
  closeAuthBtn?.addEventListener('click', () => authModal.classList.add('hidden'));

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
  });

  registerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = { name: document.getElementById('regName').value, email: document.getElementById('regEmail').value };
    localStorage.setItem('smarttrip_user', JSON.stringify(user));
    updateNavUser();
    authModal.classList.add('hidden');
  });

  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    localStorage.setItem('smarttrip_user', JSON.stringify({ email, name: email.split('@')[0] }));
    updateNavUser();
    authModal.classList.add('hidden');
  });

  updateNavUser();
}

function updateNavUser() {
  const user = JSON.parse(localStorage.getItem('smarttrip_user'));
  const authNav = document.getElementById('authNav');
  if (user && authNav) {
    authNav.innerHTML = `
      <span style="color:var(--accent); font-weight:600;"><i class="fa-regular fa-user"></i> ${user.name}</span>
      <button class="btn btn-outline" id="logoutBtn" style="padding:6px 12px; font-size:0.85rem; margin-left:10px;">Logout</button>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('smarttrip_user');
      location.reload();
    });
  }
}
