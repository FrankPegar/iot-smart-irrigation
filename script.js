const firebaseConfig = {
  apiKey: "AIzaSyCvLuPpg6fS0HSE-Ut7hhc6vC_trJAnhWw",
  authDomain: "esp32-rtdb-e26d5.firebaseapp.com",
  databaseURL: "https://esp32-rtdb-e26d5-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "esp32-rtdb-e26d5",
  storageBucket: "esp32-rtdb-e26d5.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Doughnut chart plugin for center text
Chart.register({
  id: 'centerText',
  beforeDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const { width, height } = chart;
    const ctx = chart.ctx;
    const value = chart.data.datasets[0].data[0];
    ctx.restore();
    ctx.font = `${(height / 4).toFixed(0)}px Arial`;
    ctx.fillStyle = '#4ade80';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(`${value.toFixed(1)}%`, width / 2, height / 2);
    ctx.save();
  }
});

const soilMoistureChart = new Chart(document.getElementById('soilMoistureChart'), {
  type: 'doughnut',
  data: {
    labels: ['Moisture', 'Remaining'],
    datasets: [{
      data: [0, 100],
      backgroundColor: ['#4ade80', '#334155'],
      borderWidth: 0,
      cutout: '80%',
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  }
});

function createWaterGradient(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
  gradient.addColorStop(1, 'rgba(29, 78, 216, 0.8)');
  return gradient;
}

const waterLevelChart = new Chart(document.getElementById('waterLevelChart'), {
  type: 'bar',
  data: {
    labels: ['Water Level'],
    datasets: [{
      label: 'Water Level (%)',
      data: [0],
      backgroundColor: createWaterGradient(document.getElementById('waterLevelChart').getContext('2d')),
      borderColor: 'rgba(29, 78, 216, 0.8)',
      borderWidth: 2,
      borderRadius: 15,
      barPercentage: 1,
      categoryPercentage: 1,
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { display: false },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: 'white' },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(tooltipItem) {
            return `Water Level: ${tooltipItem.raw}%`;
          }
        }
      }
    },
    animation: {
      duration: 500,
      easing: 'easeInOutQuad',
    }
  }
});
function updateLine(chart, value) {
  const now = new Date().toLocaleTimeString();
  chart.data.labels.push(now);
  chart.data.datasets[0].data.push(value);

  // Limit to 5 points only
  if (chart.data.labels.length > 10) {
    chart.data.labels.shift();          // remove oldest label
    chart.data.datasets[0].data.shift(); // remove oldest data point
  }

  chart.update();
}

function updateWaterLevelChart(percent) {
  const waterPercent = clamp(percent, 0, 100);
  const ctx = waterLevelChart.ctx;
  const newGradient = createWaterGradient(ctx);

  waterLevelChart.data.datasets[0].data = [waterPercent];
  waterLevelChart.data.datasets[0].backgroundColor = newGradient;
  waterLevelChart.update();
}

const rainChart = new Chart(document.getElementById('rainChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Rain Intensity (%)',
      data: [],
      borderColor: '#818cf8',
      backgroundColor: 'rgba(129, 140, 248, 0.2)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      borderWidth: 2,
    }]
  },
  options: {
    animation: false,
    responsive: true,
    scales: {
      x: { display: false },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: 'white', stepSize: 10 }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(tooltipItem) {
            return `Rain Intensity: ${tooltipItem.raw}%`;
          }
        }
      }
    }
  }
});

function createLineChart(ctxId, label, unit, color, yMin, yMax) {
  return new Chart(document.getElementById(ctxId), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: `${label} (${unit})`,
        data: [],
        borderColor: color,
        backgroundColor: color + '80',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        borderWidth: 2,
      }]
    },
    options: {
      animation: false/*{
        duration: 300,
        easing: 'easeOutQuart',
      }*/,
      responsive: true,
      scales: {
        x: { display: false },
        y: {
          beginAtZero: true,
          min: yMin,
          max: yMax,
          ticks: { color: 'white' }
        }
      },
      plugins: {
        legend: { labels: { color: 'white' }, display: false }
      }
    }
  });
}

const temperatureChart = createLineChart('temperatureChart', 'Temperature', '°C', '#facc15', 0, 50);
const humidityChart = createLineChart('humidityChart', 'Humidity', '%', '#22d3ee', 0, 100);
const ldrChart = createLineChart('ldrChart', 'Light Intensity', 'lux', '#bef264', 0, 100);

function fetchAndUpdateSensorData() {
  db.ref('Sensors').once('value').then(snapshot => {
    const data = snapshot.val();
    const now = new Date().toLocaleTimeString();
    const ldr = data.LDR || 0;
    const rain = data.Rain || 0;
    const soil = data.SoilMoisture || 0;
    const rawWater = data.WaterLevel || 0; // 🔄 use raw sensor value
    const water = mapValue(rawWater, 0, 4095, 0, 100); // ✅ convert to percent
    const temperature = data.Temperature || 0;
    const humidity = data.Humidity || 0;

    const soilPercent = mapValue(soil, 0, 4095, 0, 100);
    soilMoistureChart.data.datasets[0].data = [soilPercent, 100 - soilPercent];
    soilMoistureChart.update();


    updateWaterLevelChart(water);

    const rainPercent = mapValue(rain, 0, 4095, 0, 100);
    const rainInvertedPercent = 100 - rainPercent;
    updateLine(rainChart, rainInvertedPercent);

    updateLine(temperatureChart, temperature);
    updateLine(humidityChart, humidity);
    updateLine(ldrChart, mapValue(ldr, 0, 4095, 0, 100));
  });
}

setInterval(fetchAndUpdateSensorData, 3000); // every 3 seconds


db.ref('RelayModule').on('value', snapshot => {
  isOn = snapshot.val() === true;
  updateRelayUI(isOn);
});

db.ref('Sensors/WaterLevelPercent').once('value').then(snapshot => {
  const waterLevel = snapshot.val() || 0;
  updateWaterLevelChart(waterLevel);
});

function mapValue(value, inMin, inMax, outMin, outMax) {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateLine(chart, value) {
  chart.data.labels.push(new Date().toLocaleTimeString());
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > 20) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

let waterBtn = document.getElementById('irrigateBtn');
let btnCircle = document.getElementById('btnCircle');
let isOn = false;

waterBtn.addEventListener('click', () => {
  isOn = !isOn;
  updateRelayUI(isOn);
  firebase.database().ref('RelayModule').set(isOn);
});

function updateRelayUI(state) {
  if (state) {
    btnCircle.innerText = 'ON';
    waterBtn.classList.remove('bg-gray-200');
    waterBtn.classList.add('bg-green-300');
    btnCircle.classList.remove('text-gray-400', 'bg-white');
    btnCircle.classList.add('text-white', 'bg-green-500');
    btnCircle.style.transform = 'translateX(95%)';
  } else {
    btnCircle.innerText = 'OFF';
    waterBtn.classList.add('bg-gray-200');
    waterBtn.classList.remove('bg-green-300');
    btnCircle.classList.add('text-gray-400', 'bg-white');
    btnCircle.classList.remove('text-white', 'bg-green-500');
    btnCircle.style.transform = 'translateX(0)';
  }
}

function checkIrrigationSchedule() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  const time1 = document.getElementById('irrigationTime1').value;
  const time2 = document.getElementById('irrigationTime2').value;

  // Check if it's exactly on the scheduled time
  if ((currentTime === time1 || currentTime === time2)) {
    // Prevent repeated triggers within the same minute
    if (!checkIrrigationSchedule.lastTrigger || checkIrrigationSchedule.lastTrigger !== currentTime) {
      checkIrrigationSchedule.lastTrigger = currentTime;

      console.log(`Irrigation ON at ${currentTime}`);
      isOn = true;
      firebase.database().ref('RelayModule').set(true);
      updateRelayUI(true);

      // Turn OFF after 5 seconds
      setTimeout(() => {
        isOn = false;
        firebase.database().ref('RelayModule').set(false);
        updateRelayUI(false);
        console.log(`Irrigation OFF after 5 seconds`);
      }, 5000);
    }
  }
}

document.getElementById('saveBtn').addEventListener('click', () => {
  const time1 = document.getElementById('irrigationTime1').value;
  const time2 = document.getElementById('irrigationTime2').value;

  firebase.database().ref('IrrigationSchedule').set({
    time1: time1,
    time2: time2
  }).then(() => {
    alert('Irrigation schedule saved!');
    document.getElementById('irrigateCard').classList.remove('scale-100');
    document.getElementById('irrigateCard').classList.add('scale-0');
  }).catch(error => {
    console.error('Failed to save:', error);
    alert('Error saving schedule. Check console.');
  });
});

setInterval(checkIrrigationSchedule, 10000);
