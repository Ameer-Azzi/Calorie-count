/* --- APPLICATION DATA STRUCTURE & LOCALSTORAGE KEY --- */
// The core offline storage key. All application data lives here as one serialized JSON string.
const STORAGE_KEY = 'offlineCalorieTrackerData_v1';

// Default application state structure
let appState = {
    settings: {
        calorieTarget: 2000,
        age: 0,
        height: 175, // cm
        weightEntries: [] // Array of {date: YYYY-MM-DD, weight: kg}
    },
    // Daily food entries {date: YYYY-MM-DD, meals: [{name, calories}], totalConsumed}
    dailyLogs: []
};

let calorieChart, weightChart; // Chart.js instances

/* =========================================
   1. CORE OFFLINE STORAGE & INITIALIZATION
   ========================================= */

// Function to start the app, load data, and render the initial page
function initializeApp() {
    // 1. Try to load data from localStorage
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        appState = JSON.parse(savedData);
        console.log("Offline data loaded successfully.");
    } else {
        console.log("No saved data found. Starting fresh.");
        // Initialize weightEntries if new app
        appState.settings.weightEntries = [];
    }

    // 2. Load settings values into Settings Page Form inputs
    document.getElementById('set-age').value = appState.settings.age || '';
    document.getElementById('set-height').value = appState.settings.height || '';
    document.getElementById('set-calorie-target').value = appState.settings.calorieTarget;
    if (appState.settings.weightEntries.length > 0) {
        document.getElementById('set-current-weight').value = appState.settings.weightEntries[appState.settings.weightEntries.length - 1].weight;
    }

    // 3. Render the default view (Dashboard)
    showPage('dashboard');
}

// Utility Function to save the entire application state back to the device
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    console.log("Data auto-saved to device.");
}

/* =========================================
   2. UI & NAVIGATION
   ========================================= */

// Hides all 'pages' and shows the requested one, then triggers any needed rendering.
function showPage(pageName) {
    // 1. Swapping active classes
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageName}`).classList.add('active');

    // 2. Dynamic Initialization for the specific page
    if (pageName === 'dashboard') {
        renderDashboard();
    } else if (pageName === 'logging') {
        renderLoggingPage();
    }
}

// Utility: get current date string in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

/* =========================================
   3. DASHBOARD PAGE (STATS & GRAPHS)
   ========================================= */

function renderDashboard() {
    // A. Update Static Stat Cards
    const target = appState.settings.calorieTarget;
    document.getElementById('target-stat').textContent = target;

    const todayDate = getTodayDate();
    const todayLog = appState.dailyLogs.find(log => log.date === todayDate);
    const consumedToday = todayLog ? todayLog.totalConsumed : 0;
    document.getElementById('daily-consumed-stat').textContent = consumedToday;

    // Update colors based on progress
    if (consumedToday > target) {
        document.getElementById('daily-consumed-stat').style.color = '#ef5350'; // Red for over-limit
    } else {
        document.getElementById('daily-consumed-stat').style.color = 'var(--accent-green)';
    }

    // Update BMI Card
    calculateAndDisplayBMI();

    // B. Initialize/Update Graphs (Chart.js)
    renderCalorieGraph();
    renderWeightGraph();
}

function calculateAndDisplayBMI() {
    const age = parseInt(appState.settings.age);
    const heightCm = parseInt(appState.settings.height);

    if (age > 0 && heightCm > 0 && appState.settings.weightEntries.length > 0) {
        const lastWeight = appState.settings.weightEntries[appState.settings.weightEntries.length - 1].weight;
        const heightMeters = heightCm / 100;
        const bmi = (lastWeight / (heightMeters * heightMeters)).toFixed(1);

        document.getElementById('bmi-stat').textContent = bmi;

        // Simple classification (WHO)
        let category = "Normal";
        if (bmi < 18.5) category = "Underweight";
        else if (bmi >= 25 && bmi < 30) category = "Overweight";
        else if (bmi >= 30) category = "Obese";
        document.getElementById('bmi-category').textContent = category;

    } else {
        document.getElementById('bmi-stat').textContent = "--.-";
        document.getElementById('bmi-category').textContent = "Enter Settings";
    }
}

// Graph 1: 7-Day Calorie Consumed vs Target
function renderCalorieGraph() {
    const ctx = document.getElementById('calorieChart').getContext('2d');
    
    // Setup Chart.js global dark theme colors
    Chart.defaults.color = '#aaaaaa';
    Chart.defaults.borderColor = '#333333';

    // 1. Process data for past 7 days
    const labels = [];
    const consumedData = [];
    const targetData = [];
    const target = appState.settings.calorieTarget;

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        // Use last part of date for label (MM-DD)
        const labelParts = dateString.split('-');
        labels.push(`${labelParts[1]}-${labelParts[2]}`);

        const dailyLog = appState.dailyLogs.find(log => log.date === dateString);
        consumedData.push(dailyLog ? dailyLog.totalConsumed : 0);
        targetData.push(target); // The consistent baseline target
    }

    // 2. Destroy old chart instance to prevent layout issues if re-rendering
    if (calorieChart) calorieChart.destroy();

    // 3. Create the Chart
    calorieChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Consumed (kcal)',
                    data: consumedData,
                    borderColor: '#2196f3', // Accent Blue
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 3,
                    tension: 0.3, // Curve the lines
                    fill: true
                },
                {
                    label: 'Daily Target',
                    data: targetData,
                    borderColor: '#e0e0e0', // High Contrast for Target Line
                    borderWidth: 2,
                    borderDash: [5, 5], // Dashed line for baseline
                    fill: false,
                    pointRadius: 0 // Hide points
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: "#333333" } },
                x: { grid: { color: "#333333" } }
            },
            plugins: {
                legend: { labels: { color: "#aaaaaa" } }
            }
        }
    });
}

// Graph 2: Weight Tracking over Time
function renderWeightGraph() {
    const ctx = document.getElementById('weightChart').getContext('2d');
    
    // 1. Process data from entries array
    const weightEntries = appState.settings.weightEntries;
    const labels = weightEntries.map(entry => {
        const labelParts = entry.date.split('-');
        return `${labelParts[1]}-${labelParts[2]}`;
    });
    const data = weightEntries.map(entry => entry.weight);

    // 2. Destroy old chart instance
    if (weightChart) weightChart.destroy();

    // 3. Create the Chart
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Weight (kg)',
                data: data,
                borderColor: '#4caf50', // Accent Green
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.2,
                pointBackgroundColor: '#4caf50'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false, grid: { color: "#333333" } }, // Don't force 0 for weight
                x: { grid: { color: "#333333" } }
            }
        }
    });
}

/* =========================================
   4. LOGGING PAGE (DAILY INTAKE)
   ========================================= */

function renderLoggingPage() {
    const todayDate = getTodayDate();
    let todayLog = appState.dailyLogs.find(log => log.date === todayDate);

    // If no log exists yet for today, we must initialize a fresh one
    if (!todayLog) {
        todayLog = {
            date: todayDate,
            meals: [],
            totalConsumed: 0
        };
        appState.dailyLogs.push(todayLog);
        saveData(); // Save the new day initialization
    }

    // 1. Clear existing visual meal list
    const mealList = document.getElementById('meal-list');
    mealList.innerHTML = '';

    // 2. Re-render Today's Meals from state
    todayLog.meals.forEach(meal => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${meal.name}</span> <span class="meal-cals">${meal.calories} kcal</span>`;
        mealList.appendChild(li);
    });

    // 3. Update the total bar
    document.getElementById('log-total-consumed').textContent = todayLog.totalConsumed;
}

// Function to handle the form submission when adding a meal
document.getElementById('log-entry-form').addEventListener('submit', function(e) {
    e.preventDefault(); // Stop standard page reload

    const nameInput = document.getElementById('meal-name');
    const calInput = document.getElementById('meal-calories');
    
    const mealName = nameInput.value;
    const mealCals = parseInt(calInput.value);

    // 1. Find today's log in app state
    const todayDate = getTodayDate();
    let todayLog = appState.dailyLogs.find(log => log.date === todayDate);

    if (todayLog) {
        // 2. Add the meal to state
        todayLog.meals.push({ name: mealName, calories: mealCals });
        
        // 3. Update the today's total running sum
        todayLog.totalConsumed += mealCals;

        // 4. Save entire updated state back to device (Auto-save requirement)
        saveData();

        // 5. Clear the form and re-render the view
        nameInput.value = '';
        calInput.value = '';
        renderLoggingPage();
    }
});

// Feature: "Start a New Day" button functionality
function startNewDay() {
    const todayDate = getTodayDate();
    
    // Check if the current day log is just empty anyway
    const todayLog = appState.dailyLogs.find(log => log.date === todayDate);
    if (todayLog && todayLog.meals.length === 0) {
        alert("A new empty day is already active.");
        return;
    }

    // Since this app works automatically based on the device clock (getTodayDate()),
    // a truly "offline" start-new-day feature just serves to reset the active view 
    // or provide confirmation, but JavaScript naturally picks up the clock change.
    if(confirm("Start new day? Today's data is already autosaved.")) {
        // In this implementation, the app naturally picks up new dates.
        // If a user *manually* clicks this, they likely want to just visually reset.
        renderLoggingPage(); 
    }
}

/* =========================================
   5. SETTINGS PAGE (TARGETS & INPUTS)
   ========================================= */

// Event listener for the settings form submission
document.getElementById('settings-form').addEventListener('submit', function(e) {
    e.preventDefault(); // Stop reload

    // 1. Update Age & Height
    appState.settings.age = document.getElementById('set-age').value;
    appState.settings.height = document.getElementById('set-height').value;
    
    // 2. Update Calorie Target
    appState.settings.calorieTarget = parseInt(document.getElementById('set-calorie-target').value) || 2000;

    // 3. Handle Weekly Weight Input (adding a new datapoint for the weight trend)
    const currentWeightInput = document.getElementById('set-current-weight').value;
    if (currentWeightInput) {
        const todayDate = getTodayDate();
        const weight = parseFloat(currentWeightInput);

        // Check if we already have an entry for *today* in the array.
        const existingEntryIndex = appState.settings.weightEntries.findIndex(entry => entry.date === todayDate);
        
        if (existingEntryIndex !== -1) {
            // Update today's existing entry
            appState.settings.weightEntries[existingEntryIndex].weight = weight;
        } else {
            // Add a new datapoint
            appState.settings.weightEntries.push({ date: todayDate, weight: weight });
        }
        
        // Optional: Keep only the last 12 weight entries for graph clarity
        if (appState.settings.weightEntries.length > 12) {
            appState.settings.weightEntries.shift(); // Remove oldest
        }
    }

    // 4. Save entire new settings back to device
    saveData();
    alert('Settings saved. Dashboard updated.');
});