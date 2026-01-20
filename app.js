import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { allReadings, startDate } from './readings.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state
let currentUser = null;
let currentDisplayDay = null;
let completedDays = {};

// Auth functions
window.showSignup = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
};

window.showLogin = () => {
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
};

window.signUp = async () => {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signupError');

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        errorEl.textContent = '';
    } catch (error) {
        errorEl.textContent = error.message;
    }
};

window.signIn = async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorEl.textContent = '';
    } catch (error) {
        errorEl.textContent = error.message;
    }
};

window.signOut = async () => {
    await fbSignOut(auth);
};

// Utility functions
function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDateFromDay(dayNum) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayNum - 1);
    return date;
}

function calculateStreak() {
    let streak = 0;
    const today = getDayOfYear(new Date());
    for (let i = today; i >= 1; i--) {
        if (completedDays[i]) streak++;
        else break;
    }
    return streak;
}

function updateStats() {
    const completed = Object.keys(completedDays).length;
    const remaining = 358 - completed;
    const streak = calculateStreak();
    const completionPercent = Math.round((completed / 358) * 100);

    document.getElementById('completedCount').textContent = completed;
    document.getElementById('remainingCount').textContent = remaining;
    document.getElementById('streakCount').textContent = streak;
    document.getElementById('completionPercent').textContent = completionPercent + '%';
    document.getElementById('completionFill').style.width = completionPercent + '%';
}

function updateDisplay(dayNum) {
    if (dayNum < 1 || dayNum > 358) return;

    currentDisplayDay = dayNum;
    const reading = allReadings[dayNum - 1];
    const displayDate = getDateFromDay(dayNum);
    const isCompleted = completedDays[dayNum];

    document.getElementById('dayNumber').textContent = `Day ${reading[0]} of 358`;
    document.getElementById('readingText').textContent = reading[1];
    document.getElementById('dateDisplay').textContent = displayDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const progress = (dayNum / 358) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressPercent').textContent = Math.round(progress) + '%';

    const card = document.getElementById('readingCard');
    const btn = document.getElementById('completeBtn');

    if (isCompleted) {
        card.classList.add('completed');
        btn.textContent = 'Mark as Incomplete';
        btn.className = 'btn-complete mark-incomplete';
    } else {
        card.classList.remove('completed');
        btn.textContent = 'Mark as Complete';
        btn.className = 'btn-complete mark-complete';
    }

    document.getElementById('prevBtn').disabled = dayNum <= 1;
    document.getElementById('nextBtn').disabled = dayNum >= 358;

    updateStats();
}

window.toggleComplete = async () => {
    if (!currentUser) return;

    if (completedDays[currentDisplayDay]) {
        delete completedDays[currentDisplayDay];
    } else {
        completedDays[currentDisplayDay] = true;
    }

    await setDoc(doc(db, 'users', currentUser.uid), {
        completedDays: completedDays
    });

    updateDisplay(currentDisplayDay);
};

window.changeDay = (delta) => {
    updateDisplay(currentDisplayDay + delta);
};

window.goToToday = () => {
    const today = new Date();
    const dayOfYear = getDayOfYear(today);
    const planDay = Math.min(Math.max(dayOfYear, 1), 358);
    updateDisplay(planDay);
};

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    const authCorner = document.getElementById('cornerAuth');

    if (user) {
        currentUser = user;
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('authView').classList.remove('active');
        document.getElementById('mainView').classList.add('active');
        authCorner.style.display = 'flex';

        // Load user progress from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            completedDays = userDoc.data().completedDays || {};
        } else {
            completedDays = {};
        }

        // Listen for real-time updates
        onSnapshot(doc(db, 'users', user.uid), (doc) => {
            if (doc.exists()) {
                completedDays = doc.data().completedDays || {};
                updateDisplay(currentDisplayDay);
            }
        });

        goToToday();
    } else {
        currentUser = null;
        completedDays = {};
        document.getElementById('mainView').classList.remove('active');
        document.getElementById('authView').classList.add('active');
        authCorner.style.display = 'none';
    }
});
