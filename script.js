let gameHistory = [];
let usedWords = new Set();
let lastWord = '';
let isProcessing = false;
let playerName = '';
let timerInterval;
let timeLeft = 30;
let initialTimeLimit = 30;
let gameActive = false;
let streakCount = 0;
let highScore = localStorage.getItem('wordChainHighScore') || 0;
let difficulty = 'normal';
let pointsEarned = 0;
let totalCorrectWords = 0;

function calculatePoints(word) {
    const basePoints = word.length;
    const difficultyMultiplier = {
        'easy': 1,
        'normal': 1.5,
        'hard': 2
    };
    return Math.floor(basePoints * difficultyMultiplier[difficulty]);
}

function startGame() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
        alert('Please enter your name!');
        return;
    }

    playerName = name;
    difficulty = document.getElementById('difficulty').value;
    initialTimeLimit = parseInt(document.getElementById('timeLimit').value);
    
    // Adjust time limit based on difficulty
    if (difficulty === 'hard') {
        initialTimeLimit = Math.floor(initialTimeLimit * 0.7);
    } else if (difficulty === 'easy') {
        initialTimeLimit = Math.floor(initialTimeLimit * 1.3);
    }
    
    timeLeft = initialTimeLimit;
    streakCount = 0;
    pointsEarned = 0;
    
    document.getElementById('playerRegistration').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('playerDisplay').textContent = `Player: ${playerName}`;
    document.getElementById('streakDisplay').textContent = `Streak: ${streakCount}`;
    document.getElementById('pointsDisplay').textContent = `Points: ${pointsEarned}`;
    document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
    
    resetGameState();
    startTimer();
    updateUsedWordsDisplay();
}

function startTimer() {
    timeLeft = initialTimeLimit;
    gameActive = true;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            handleTimeout();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeString = minutes > 0 
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;
    document.getElementById('timer').textContent = `Time: ${timeString}`;
}

function handleTimeout() {
    clearInterval(timerInterval);
    gameActive = false;
    document.getElementById('message').textContent = "Time's up! Qbit wins!";
    document.getElementById('submitButton').disabled = true;
    showEndGameButtons();
}

function resetTimer() {
    timeLeft = initialTimeLimit;
    updateTimerDisplay();
    if (timerInterval) clearInterval(timerInterval);
    startTimer();
}

function updateUsedWordsDisplay() {
    const usedWordsDiv = document.getElementById('usedWords');
    if (usedWords.size === 0) {
        usedWordsDiv.textContent = 'No words used yet';
        return;
    }
    usedWordsDiv.innerHTML = '<strong>Used Words:</strong><br>' + 
        Array.from(usedWords).join(', ');
}

async function checkWordExists(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        return response.ok;
    } catch (error) {
        console.error('Error checking word:', error);
        return false;
    }
}

async function getQbitWord(lastLetter) {
    try {
        const response = await fetch(`https://api.datamuse.com/words?sp=${lastLetter}*&max=100`);
        const data = await response.json();
        const possibleWords = data
            .map(item => item.word.toLowerCase())
            .filter(word => !usedWords.has(word));
        
        return possibleWords.length > 0 ? possibleWords[0] : null;
    } catch (error) {
        console.error('Error fetching Qbit word:', error);
        return null;
    }
}

async function submitWord() {
    if (isProcessing || !gameActive) return;
    
    const input = document.getElementById('wordInput');
    const message = document.getElementById('message');
    const submitButton = document.getElementById('submitButton');
    const word = input.value.trim().toLowerCase();

    input.value = '';
    input.blur();

    if (!word) {
        message.textContent = 'Please enter a word!';
        return;
    }

    // Check for duplicate word
    if (usedWords.has(word)) {
        message.textContent = 'That word has already been used! Try another.';
        return;
    }

    isProcessing = true;
    submitButton.disabled = true;
    message.innerHTML = 'Checking word... <div class="loading"></div>';

    const wordExists = await checkWordExists(word);
    if (!wordExists) {
        message.textContent = 'That\'s not a valid word! Try again.';
        streakCount = 0; // Reset streak on invalid word
        document.getElementById('streakDisplay').textContent = `Streak: ${streakCount}`;
        isProcessing = false;
        submitButton.disabled = false;
        return;
    }
    if (wordExists) {
        totalCorrectWords++;
        document.getElementById('correctWordsDisplay').textContent = `Correct Words: ${totalCorrectWords}`;
    }
    // Calculate points for the word
    const wordPoints = calculatePoints(word);
    pointsEarned += wordPoints;
    streakCount++;

    // Check for first word
    if (!lastWord) {
        lastWord = word;
        usedWords.add(word);
        gameHistory.push(`${playerName}: ${word} (+${wordPoints} points)`);
        updateHistory();
        updateUsedWordsDisplay();
        
        // Apply streak bonus if applicable
        if (streakCount >= 3) {
            const streakBonus = Math.floor(wordPoints * 0.5);
            pointsEarned += streakBonus;
            message.textContent = `+${wordPoints} points (+${streakBonus} streak bonus)!`;
        } else {
            message.textContent = `+${wordPoints} points!`;
        }

        // Update high score if needed
        if (pointsEarned > highScore) {
            highScore = pointsEarned;
            localStorage.setItem('wordChainHighScore', highScore);
            document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
        }

        // Update displays
        document.getElementById('streakDisplay').textContent = `Streak: ${streakCount}`;
        document.getElementById('pointsDisplay').textContent = `Points: ${pointsEarned}`;
        
        message.innerHTML = 'Qbit is thinking... <div class="loading"></div>';
        const QbitWord = await getQbitWord(word[word.length - 1]);
        handleQbitTurn(QbitWord);
        return;
    }

    // Check if word starts with last letter of previous word
    const lastLetter = lastWord[lastWord.length - 1];
    if (word[0] !== lastLetter) {
        message.textContent = `Your word must start with the letter '${lastLetter}'!`;
        streakCount = 0; // Reset streak on invalid word
        document.getElementById('streakDisplay').textContent = `Streak: ${streakCount}`;
        isProcessing = false;
        submitButton.disabled = false;
        return;
    }

    lastWord = word;
    usedWords.add(word);
    gameHistory.push(`${playerName}: ${word} (+${wordPoints} points)`);
    updateHistory();
    updateUsedWordsDisplay();
    
    // Apply streak bonus if applicable
    if (streakCount >= 3) {
        const streakBonus = Math.floor(wordPoints * 0.5);
        pointsEarned += streakBonus;
        message.textContent = `+${wordPoints} points (+${streakBonus} streak bonus)!`;
    } else {
        message.textContent = `+${wordPoints} points!`;
    }

    // Update high score if needed
    if (pointsEarned > highScore) {
        highScore = pointsEarned;
        localStorage.setItem('wordChainHighScore', highScore);
        document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
    }

    // Update displays
    document.getElementById('streakDisplay').textContent = `Streak: ${streakCount}`;
    document.getElementById('pointsDisplay').textContent = `Points: ${pointsEarned}`;
    
    // Check achievements
    checkAchievements(word);
    
    resetTimer();
    message.innerHTML = 'Qbit is thinking... <div class="loading"></div>';
    const QbitWord = await getQbitWord(word[word.length - 1]);
    handleQbitTurn(QbitWord);
}
async function getHint() {
    if (!lastWord || !gameActive) return;
    
    const lastLetter = lastWord[lastWord.length - 1];
    const response = await fetch(`https://api.datamuse.com/words?sp=${lastLetter}*&max=5`);
    const data = await response.json();
    
    const hints = data
        .map(item => item.word)
        .filter(word => !usedWords.has(word))
        .slice(0, 3);
    
    if (hints.length > 0) {
        document.getElementById('message').textContent = 
            `Hint: Try words like ${hints.join(', ')}`;
        // Deduct points for using hint
        pointsEarned = Math.max(0, pointsEarned - 5);
        document.getElementById('pointsDisplay').textContent = 
            `Points: ${pointsEarned}`;
    }
}

// Add these functions for achievements
const achievements = {
    'Quick Thinker': { description: 'Submit 3 words in under 30 seconds', earned: false },
    'Vocabulary Master': { description: 'Use a word longer than 8 letters', earned: false },
    'Streak Master': { description: 'Maintain a 5-word streak', earned: false }
};

function checkAchievements(word) {
    if (!achievements['Vocabulary Master'].earned && word.length > 8) {
        unlockAchievement('Vocabulary Master');
    }
    if (!achievements['Streak Master'].earned && streakCount >= 5) {
        unlockAchievement('Streak Master');
    }
    // Add more achievement checks as needed
}

function unlockAchievement(achievementName) {
    achievements[achievementName].earned = true;
    const achievementDiv = document.createElement('div');
    achievementDiv.className = 'achievement-popup';
    achievementDiv.textContent = `Achievement Unlocked: ${achievementName}!`;
    document.body.appendChild(achievementDiv);
    setTimeout(() => achievementDiv.remove(), 3000);
}

function handleQbitTurn(QbitWord) {
    const wordInput = document.getElementById('wordInput');
    
    if (QbitWord) {
        lastWord = QbitWord;
        usedWords.add(QbitWord);
        gameHistory.push(`Qbit: ${QbitWord}`);
        message.textContent = `Qbit's turn: ${QbitWord}`;
        updateUsedWordsDisplay();
        resetTimer();
        
        // Update placeholder and focus input
        const lastLetter = QbitWord[QbitWord.length - 1].toUpperCase();
        wordInput.placeholder = `Enter a word starting with '${lastLetter}'`;
        wordInput.focus();
    } else {
        message.textContent = "Qbit couldn't find a word. You win!";
        gameActive = false;
        clearInterval(timerInterval);
        showEndGameButtons();
        wordInput.placeholder = "Game Over!";
    }
    
    updateHistory();
    isProcessing = false;
    submitButton.disabled = false;
}

function updateHistory() {
    const history = document.getElementById('history');
    history.innerHTML = '<strong>Game History:</strong><br>' + 
        gameHistory.join('<br>');
}

function showEndGameButtons() {
    document.getElementById('newGameButton').style.display = 'block';
    document.getElementById('downloadPDF').style.display = 'block';
}

function resetGame() {
    document.getElementById('playerRegistration').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';
    resetGameState();
}

function resetGameState() {
    gameHistory = [];
    usedWords = new Set();
    lastWord = '';
    isProcessing = false;
    totalCorrectWords = 0; // Reset the counter
    document.getElementById('correctWordsDisplay').textContent = 'Correct Words: 0';
    updateHistory();
    updateUsedWordsDisplay();
    document.getElementById('message').textContent = '';
    document.getElementById('wordInput').value = '';
    document.getElementById('newGameButton').style.display = 'none';
    document.getElementById('downloadPDF').style.display = 'none';
    window.scrollTo(0, 0);
    
    // Clear any active focus
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
}
document.getElementById('correctWordsDisplay').textContent = 'Correct Words: 0';
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Word Chain Game - Match Summary', 20, 20);
    
    // Add player name
    doc.setFontSize(12);
    doc.text(`Player: ${playerName}`, 20, 30);
    
    // Add game history
    doc.setFontSize(10);
    let yPosition = 40;
    gameHistory.forEach((entry, index) => {
        if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
        }
        doc.text(`${index + 1}. ${entry}`, 20, yPosition);
        yPosition += 10;
    });
    
    // Save the PDF
    const name = playerName.replace(/\s/g, '-').toLowerCase();
    doc.save(`${name}.pdf`);
}

// Add enter key support
document.getElementById('wordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default form submission
        submitWord().then(() => {
            // Focus will be handled in handleQbitTurn
            this.value = ''; // Clear the input
        });
    }
});

document.getElementById('playerName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        startGame();
    }
});

document.addEventListener('touchend', function(event) {
    event.preventDefault();
    event.target.click();
}, false);

// Improve input handling on mobile
function setupMobileInputs() {
    const wordInput = document.getElementById('wordInput');
    
    // Auto-capitalize first letter on mobile
    wordInput.setAttribute('autocapitalize', 'characters');
    
    // Disable autocorrect for the word input
    wordInput.setAttribute('autocorrect', 'off');
    
    // Handle virtual keyboard submission
    wordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitWord();
            // Hide virtual keyboard after submission
            wordInput.blur();
        }
    });
}

// Handle orientation changes
function handleOrientationChange() {
    const container = document.querySelector('.container');
    if (window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches) {
        container.style.height = '100vh';
        container.style.overflowY = 'auto';
    } else {
        container.style.height = 'auto';
        container.style.overflowY = 'visible';
    }
}

// Initialize mobile optimizations
function initializeMobileOptimizations() {
    setupMobileInputs();
    handleOrientationChange();
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', function() {
        setTimeout(handleOrientationChange, 100);
    });
    
    // Prevent elastic scrolling on iOS
    document.body.addEventListener('touchmove', function(e) {
        if (e.target.closest('.used-words, .history') === null) {
            e.preventDefault();
        }
    }, { passive: false });
}
document.addEventListener('DOMContentLoaded', initializeMobileOptimizations);
function enhanceMobileExperience() {
    const wordInput = document.getElementById('wordInput');
    const container = document.querySelector('.container');
    const gameArea = document.getElementById('gameArea');
    const submitButton = document.getElementById('submitButton');
    
    // Fix 1: Proper viewport height handling for mobile browsers
    function setMobileHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        container.style.minHeight = `calc(var(--vh, 1vh) * 100)`;
    }
    
    // Fix 2: Improve input handling on mobile
    function enhanceMobileInput() {
        // Prevent zoom on input focus for iOS
        wordInput.style.fontSize = '16px';
        
        // Add touch event handling
        wordInput.addEventListener('touchstart', function(e) {
            if (gameActive) {
                e.preventDefault();
                this.focus();
            }
        });
        
        // Improve virtual keyboard handling
        wordInput.addEventListener('blur', function() {
            // Small delay to allow button clicks to register
            setTimeout(() => {
                if (gameActive) {
                    window.scrollTo(0, 0);
                }
            }, 100);
        });
    }
    
    // Fix 3: Scroll management
    function manageScroll() {
        const gameElements = document.querySelectorAll('.history, .used-words');
        
        gameElements.forEach(element => {
            element.addEventListener('touchstart', function(e) {
                const scrollTop = element.scrollTop;
                const scrollHeight = element.scrollHeight;
                const height = element.clientHeight;
                const deltaY = e.touches[0].clientY;
                
                if (scrollTop === 0 && deltaY > 0) {
                    e.preventDefault();
                }
                
                if (scrollHeight - scrollTop === height && deltaY < 0) {
                    e.preventDefault();
                }
            }, { passive: false });
        });
    }
    
    // Fix 4: Prevent double-tap zoom
    function preventDoubleTapZoom() {
        let lastTap = 0;
        document.addEventListener('touchend', function(e) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                e.preventDefault();
            }
            lastTap = currentTime;
        });
    }
    
    // Fix 5: Improve button touch response
    function enhanceButtonResponse() {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
            });
            
            button.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
                // Add slight delay for visual feedback
                setTimeout(() => {
                    if (this.id === 'submitButton') {
                        submitWord();
                    }
                }, 50);
            });
        });
    }
    
    // Fix 6: Keyboard visibility handling
    function handleKeyboardVisibility() {
        const originalHeight = window.innerHeight;
        
        window.addEventListener('resize', () => {
            if (window.innerHeight < originalHeight) {
                // Keyboard is visible
                gameArea.style.paddingBottom = '20vh';
            } else {
                // Keyboard is hidden
                gameArea.style.paddingBottom = '0';
            }
        });
    }
    
    // Initialize all mobile optimizations
    setMobileHeight();
    enhanceMobileInput();
    manageScroll();
    preventDoubleTapZoom();
    enhanceButtonResponse();
    handleKeyboardVisibility();
    
    // Update height on orientation change and resize
    window.addEventListener('resize', setMobileHeight);
    window.addEventListener('orientationchange', () => {
        setTimeout(setMobileHeight, 100);
    });
}

// Add corresponding CSS rules
const mobileStyles = `
    @media (max-width: 768px) {
        .container {
            padding: 12px;
            min-height: calc(var(--vh, 1vh) * 100);
        }
        
        .game-controls {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--card-background);
            padding: 12px;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        }
        
        .game-area {
            padding-bottom: 160px;
        }
        
        input, button {
            min-height: 44px;
            touch-action: manipulation;
        }
        
        .history, .used-words {
            -webkit-overflow-scrolling: touch;
            max-height: 25vh;
        }
    }
`;

// Add the styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = mobileStyles;
document.head.appendChild(styleSheet);

// Initialize mobile optimizations when the DOM is ready
document.addEventListener('DOMContentLoaded', enhanceMobileExperience);