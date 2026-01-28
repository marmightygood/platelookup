const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("capture");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let locationData = null;

// --- Camera (rear preferred)
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: "environment" } }
})
.then(stream => {
  video.srcObject = stream;
  statusEl.textContent = "Ready";
})
.catch(err => {
  statusEl.textContent = "Camera access denied";
  console.error(err);
});

// --- GPS (one-shot)
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    pos => {
      locationData = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
    },
    () => {},
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// --- Capture & upload
captureBtn.onclick = async () => {
  captureBtn.disabled = true;
  statusEl.textContent = "Capturing…";
  resultsEl.hidden = true;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  const blob = await new Promise(r =>
    canvas.toBlob(r, "image/jpeg", 0.9)
  );

  statusEl.textContent = "Uploading…";

  const formData = new FormData();
  formData.append("photo", blob, "capture.jpg");
  formData.append("timestamp", new Date().toISOString());

  if (locationData) {
    formData.append("latitude", locationData.lat);
    formData.append("longitude", locationData.lon);
    formData.append("accuracy", locationData.accuracy);
  }

  try {
    const response = await fetch(
      `${window.APP_CONFIG.API_HOST}/scan`,
      { method: "POST", body: formData }
    );

    if (!response.ok) throw new Error("API error");

    const data = await response.json();
    showResults(data);
    statusEl.textContent = "Scan complete";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Scan failed";
  } finally {
    captureBtn.disabled = false;
  }
};

// --- Render API response
function showResults(data) {
  /*
    Expected API response example:
    {
      "plates": [
        { "number": "ABC123", "stolen": false },
        { "number": "XYZ987", "stolen": true }
      ]
    }
  */

  resultsEl.innerHTML = "";

  if (!data.plates || data.plates.length === 0) {
    resultsEl.textContent = "No plates detected";
  } else {
    data.plates.forEach(p => {
      const plate = document.createElement("div");
      plate.className = "plate";
      plate.textContent = p.number;

      const stolen = document.createElement("div");
      stolen.className = `stolen ${p.stolen ? "yes" : "no"}`;
      stolen.textContent = p.stolen ? "🚨 STOLEN" : "✓ Not reported stolen";

      resultsEl.appendChild(plate);
      resultsEl.appendChild(stolen);
    });
  }

  resultsEl.hidden = false;
}
