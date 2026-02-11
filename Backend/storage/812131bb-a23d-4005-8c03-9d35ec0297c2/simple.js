/**
 * 🚀 Ultimate Dashboard Script 
 * Features: Clock, To-Do List, and Weather Simulator
 */

const App = (() => {
    // 1. State Management
    const state = {
        tasks: JSON.parse(localStorage.getItem('tasks')) || [],
        user: "Bhai",
        theme: 'dark'
    };

    // 2. DOM Elements
    const elements = {
        clock: document.getElementById('clock'),
        taskInput: document.getElementById('taskInput'),
        taskBtn: document.getElementById('addBtn'),
        taskList: document.getElementById('taskList'),
        weatherMsg: document.getElementById('weather')
    };

    // 3. Utility Functions
    const updateClock = () => {
        const now = new Date();
        if (elements.clock) {
            elements.clock.innerText = now.toLocaleTimeString();
        }
    };

    const saveToLocal = () => {
        localStorage.setItem('tasks', JSON.stringify(state.tasks));
    };

    // 4. Task Logic
    const addTask = (text) => {
        if (!text.trim()) return alert("Kuch likh toh sahi!");
        
        const newTask = {
            id: Date.now(),
            text: text,
            completed: false
        };

        state.tasks.push(newTask);
        renderTasks();
        saveToLocal();
        elements.taskInput.value = '';
    };

    const deleteTask = (id) => {
        state.tasks = state.tasks.filter(t => t.id !== id);
        renderTasks();
        saveToLocal();
    };

    const toggleTask = (id) => {
        state.tasks = state.tasks.map(t => 
            t.id === id ? { ...t, completed: !t.completed } : t
        );
        renderTasks();
        saveToLocal();
    };

    // 5. UI Rendering
    const renderTasks = () => {
        if (!elements.taskList) return;
        
        elements.taskList.innerHTML = state.tasks.map(task => `
            <li class="task-item ${task.completed ? 'done' : ''}">
                <span onclick="App.toggleTask(${task.id})">${task.text}</span>
                <button onclick="App.deleteTask(${task.id})">❌</button>
            </li>
        `).join('');
    };

    const simulateWeather = () => {
        const conditions = ['Sunny ☀️', 'Rainy 🌧️', 'Cloudy ☁️', 'Hot 🥵'];
        const random = conditions[Math.floor(Math.random() * conditions.length)];
        if (elements.weatherMsg) {
            elements.weatherMsg.innerText = `Aaj ka Mausam: ${random}`;
        }
    };

    // 6. Initialization
    const init = () => {
        console.log("App Started for", state.user);
        
        // Interval for clock
        setInterval(updateClock, 1000);
        updateClock();
        
        // Initial renders
        renderTasks();
        simulateWeather();

        // Event Listeners
        if (elements.taskBtn) {
            elements.taskBtn.addEventListener('click', () => {
                addTask(elements.taskInput.value);
            });
        }

        elements.taskInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask(elements.taskInput.value);
        });
    };

    // Exporting methods for global access (for onclick)
    return { init, deleteTask, toggleTask };
})();

// Load App
document.addEventListener('DOMContentLoaded', App.init);

// --- Code ends here (approx 100 lines including comments and spaces) ---

function factorial(a){
  if (a === 0 || a === 1) return 1; 
  return a * factorial(a - 1);
}

let c=5;
function add(a,b){
  return  a+b;
  }
  
function printHelloWorld(){
  console.log("Hello World");
}
  
function greeting(){
console.log("helo buddy how r u i am very fine how r u 
