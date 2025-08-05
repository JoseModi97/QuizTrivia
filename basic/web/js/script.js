// Quiz Application Logic using jQuery

// --- Cookie Helper Functions ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax;';
}


$(document).ready(function() {
    // Global state variables
    let sessionToken = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let questionAmount = 10; // Default, will be updated from input

    // Timer variables
    let timerInterval = null;
    let totalQuizTime = 0; // in seconds
    let timeRemaining = 0; // in seconds

    const API_URL = "https://opentdb.com/";

    // Timer Constants
    const BASE_SECONDS_PER_QUESTION = 20; // Average time for a medium question
    const DIFFICULTY_MULTIPLIERS = {
        easy: 0.75,  // Easy questions get less time
        medium: 1.0,
        hard: 1.5    // Hard questions get more time
    };

    // --- DOM Elements ---
    const $settingsSection = $("#settings-section");
    const $quizSection = $("#quiz-section");
    const $resultsSection = $("#results-section");

    const $categorySelect = $("#category");
    const $difficultySelect = $("#difficulty");
    const $typeSelect = $("#type");
    const $amountInput = $("#amount");

    const $startQuizBtn = $("#start-quiz-btn");
    const $nextQuestionBtn = $("#next-question-btn");
    const $retakeQuizBtn = $("#retake-quiz-btn");
    const $newSettingsBtn = $("#new-settings-btn");

    const $progressBar = $("#progress-bar");
    const $questionText = $("#question-text");
    const $answersContainer = $("#answers-container");
    const $feedbackContainer = $("#feedback-container");

    const $correctAnswersSpan = $("#correct-answers");
    const $incorrectAnswersSpan = $("#incorrect-answers");
    const $finalScoreSpan = $("#final-score");
    const $errorMessageQuiz = $("#error-message-quiz");
    const $timeRemainingDisplay = $("#time-remaining");

    // Auth DOM Elements
    const $authSection = $("#auth-section");
    const $registrationFormContainer = $("#registration-form-container");
    const $loginFormContainer = $("#login-form-container");
    const $registrationForm = $("#registration-form");
    const $loginForm = $("#login-form");
    const $regUsernameInput = $("#reg-username");
    const $regPasswordInput = $("#reg-password");
    const $loginUsernameInput = $("#login-username");
    const $loginPasswordInput = $("#login-password");
    const $regFeedback = $("#reg-feedback");
    const $loginFeedback = $("#login-feedback");
    const $showLoginLink = $("#show-login-link");
    const $showRegisterLink = $("#show-register-link");
    const $userInfoContainer = $("#user-info-container");
    const $userDisplay = $("#user-display");
    const $logoutBtn = $("#logout-btn");
    const $quizMainContainer = $("#quiz-main-container");

    // Report Section DOM Elements
    const $reportSection = $("#report-section");
    const $viewHistoryBtn = $("#view-history-btn");
    const $backToSettingsBtn = $("#back-to-settings-btn");
    const $quizHistoryTableContainer = $("#quiz-history-table-container"); // Actually the div containing the placeholder
    const $historyTablePlaceholder = $("#history-table-placeholder");
    const $noHistoryMessage = $("#no-history-message");
    const $scoreOverTimeChartEl = $("#score-over-time-chart");
    const $categoryPerformanceChartEl = $("#category-performance-chart");
    const $difficultyDistributionChartEl = $("#difficulty-distribution-chart");


    // --- User Auth Constants ---
    const MOCK_USER_DB_KEY = 'quizUserDB'; // localStorage key
    const SESSION_COOKIE_NAME = 'loggedInQuizUser';


    // --- Timer Functions ---
    function calculateTotalTime() {
        totalQuizTime = 0;
        if (questions.length === 0) return 0;

        questions.forEach(question => {
            const difficulty = question.difficulty.toLowerCase();
            const multiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
            totalQuizTime += BASE_SECONDS_PER_QUESTION * multiplier;
        });
        totalQuizTime = Math.round(totalQuizTime);
        return totalQuizTime;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function updateTimerDisplay() {
        $timeRemainingDisplay.text(`Time: ${formatTime(timeRemaining)}`);
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval); // Clear existing timer

        timeRemaining = totalQuizTime;
        updateTimerDisplay();

        // Announce total time for screen readers
        const minutes = Math.floor(totalQuizTime / 60);
        const seconds = totalQuizTime % 60;
        let announcement = `Timer started. `;
        if (totalQuizTime > 0) {
            announcement += `You have `;
            if (minutes > 0) {
                announcement += `${minutes} minute${minutes > 1 ? 's' : ''}`;
                if (seconds > 0) announcement += ` and `;
            }
            if (seconds > 0) {
                announcement += `${seconds} second${seconds > 1 ? 's' : ''}`;
            }
            announcement += `.`;
        } else {
            announcement += `No time allocated.`; // Should ideally not happen if there are questions
        }
        $("#sr-announcer").text(announcement);
        // Clear after a short delay so it doesn't re-announce if something else triggers a change on it,
        // though with aria-atomic="true", it should read the whole new content.
        setTimeout(() => { $("#sr-announcer").text(""); }, 1500); // Increased delay slightly

        timerInterval = setInterval(function() {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                console.log("Time's up!");
                // This feedback will be announced by the feedback container's aria-live="polite"
                $feedbackContainer.text("Time's up! Moving to results.").addClass('text-red-600 font-semibold');
                // Disable answer buttons if any are active
                $answersContainer.find('button').prop('disabled', true).addClass('opacity-75 cursor-not-allowed');
                $nextQuestionBtn.addClass('hidden'); // Hide next button if visible
                setTimeout(showResults, 1500); // Give a moment for user to see "Time's up"
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        console.log("Timer stopped.");
    }


    // --- Initialization ---
    function init() {
        console.log("Quiz App Initialized");
        // Check for logged-in user on page load
        const loggedInUser = getCookie(SESSION_COOKIE_NAME);
        if (loggedInUser) {
            console.log("User", loggedInUser, "is logged in from cookie.");
            updateUIAfterLogin(loggedInUser); // This will show quiz, hide auth, populate categories, get token
        } else {
            console.log("No user logged in. Showing auth forms.");
            updateUIAfterLogout(); // This will show auth forms, hide quiz
            // No need to populate categories or get OpenTDB token if not logged in
        }
        // Note: populateCategories() and requestSessionToken() are now called conditionally
        // within updateUIAfterLogin() or not at all in updateUIAfterLogout() for the initial state.
    }

    // --- API Communication ---
    async function requestSessionToken() {
        try {
            const response = await $.ajax({
                url: `${API_URL}api_token.php?command=request`,
                method: 'GET',
                dataType: 'json'
            });
            if (response.response_code === 0 && response.token) {
                sessionToken = response.token;
                console.log("Session token obtained:", sessionToken);
            } else {
                console.error("Failed to retrieve session token:", response);
                // Optionally, display an error to the user or retry
            }
        } catch (error) {
            console.error("Error requesting session token:", error);
            // Optionally, display an error to the user
        }
    }

    async function resetSessionToken() {
        if (!sessionToken) return;
        try {
            const response = await $.ajax({
                url: `${API_URL}api_token.php?command=reset&token=${sessionToken}`,
                method: 'GET',
                dataType: 'json'
            });
            if (response.response_code === 0) {
                console.log("Session token reset successfully.");
                sessionToken = null; // Clear the old token
                await requestSessionToken(); // Get a new one
            } else {
                console.error("Failed to reset session token:", response);
            }
        } catch (error) {
            console.error("Error resetting session token:", error);
        }
    }

    async function populateCategories() {
        try {
            const response = await $.ajax({
                url: `${API_URL}api_category.php`,
                method: 'GET',
                dataType: 'json'
            });
            if (response.trivia_categories && response.trivia_categories.length > 0) {
                $categorySelect.empty(); // Clear existing options first
                $categorySelect.append('<option value="">Any Category</option>');
                response.trivia_categories.forEach(category => {
                    $categorySelect.append(`<option value="${category.id}">${category.name}</option>`);
                });
                console.log("Categories populated.");
            } else {
                console.error("No categories found or error in response:", response);
                $categorySelect.append('<option value="">Could not load categories</option>');
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
            $categorySelect.append('<option value="">Error loading categories</option>');
        }
    }

    async function fetchQuestions() {
        questionAmount = parseInt($amountInput.val()) || 10;
        const selectedCategory = $categorySelect.val();
        const selectedDifficulty = $difficultySelect.val();
        const selectedType = $typeSelect.val();

        let apiUrl = `${API_URL}api.php?amount=${questionAmount}`;
        if (sessionToken) {
            apiUrl += `&token=${sessionToken}`;
        }
        if (selectedCategory) {
            apiUrl += `&category=${selectedCategory}`;
        }
        if (selectedDifficulty) {
            apiUrl += `&difficulty=${selectedDifficulty}`;
        }
        if (selectedType) {
            apiUrl += `&type=${selectedType}`;
        }
        // Using default encoding (HTML entities) for now, can add 'encode' parameter if needed

        console.log("Fetching questions from:", apiUrl);
        $errorMessageQuiz.text('').addClass('hidden'); // Clear previous errors

        try {
            const response = await $.ajax({
                url: apiUrl,
                method: 'GET',
                dataType: 'json'
            });
            console.log("API Response:", response);
            return handleApiResponse(response);
        } catch (error) {
            console.error("Error fetching questions:", error);
            $errorMessageQuiz.text('Failed to fetch questions. Please check your connection and try again.').removeClass('hidden');
            showSection($resultsSection); // Show results/error section
            return false; // Indicate failure
        }
    }

    async function handleApiResponse(response) {
        switch (response.response_code) {
            case 0: // Success
                questions = response.results;
                if (questions.length === 0) { // Should be caught by code 1, but as a safeguard
                    console.warn("API Success (0) but no questions returned.");
                    $errorMessageQuiz.text('No questions found for your criteria. Please try different settings.').removeClass('hidden');
                    showSection($resultsSection);
                    return false;
                }
                console.log("Questions received:", questions);
                return true; // Indicate success
            case 1: // No Results
                console.warn("API Response: No Results. Could not return results. The API doesn't have enough questions for your query.");
                $errorMessageQuiz.text('Not enough questions found for your selected criteria. Please try different settings or a smaller amount.').removeClass('hidden');
                showSection($resultsSection);
                 // No need to reset token here, it's a query issue
                return false;
            case 2: // Invalid Parameter
                console.error("API Response: Invalid Parameter. Arguments passed in aren't valid.");
                $errorMessageQuiz.text('There was an issue with the quiz parameters. (Invalid Parameter)').removeClass('hidden');
                showSection($resultsSection);
                // This is a developer/logic error, should be investigated
                return false;
            case 3: // Token Not Found
                console.warn("API Response: Token Not Found. Session Token does not exist.");
                $errorMessageQuiz.text('Your quiz session has expired or is invalid. Please start a new quiz.').removeClass('hidden');
                await resetSessionToken(); // Request a new token
                showSection($settingsSection); // Send user back to settings
                return false;
            case 4: // Token Empty
                console.warn("API Response: Token Empty. Session Token has returned all possible questions for the query.");
                $errorMessageQuiz.text('You\'ve answered all available questions for this session! Please reset the session or try different settings.').removeClass('hidden');
                // Advise user to reset token (or we can do it automatically)
                // await resetSessionToken(); // Or offer a button to reset
                showSection($resultsSection); // Show results, user can then go to settings
                return false;
            case 5: // Rate Limit
                console.warn("API Response: Rate Limit. Too many requests. Please wait 5 seconds.");
                $errorMessageQuiz.text('Too many requests. Please wait a few seconds and try again.').removeClass('hidden');
                // Could implement a retry mechanism with a delay
                showSection($settingsSection); // Send back to settings to wait
                return false;
            default:
                console.error("API Response: Unknown error code.", response.response_code);
                $errorMessageQuiz.text(`An unknown error occurred (Code: ${response.response_code}).`).removeClass('hidden');
                showSection($resultsSection);
                return false;
        }
    }

    // --- UI Update Functions ---
    function showSection(section) {
        $settingsSection.addClass('hidden');
        $quizSection.addClass('hidden');
        $resultsSection.addClass('hidden');
        section.removeClass('hidden');
    }

    function updateProgressBar() {
        // Ensure questions.length is not zero to avoid division by zero
        const totalQuestions = questions.length > 0 ? questions.length : questionAmount;
        // Progress should reflect current question number out of total.
        // If currentQuestionIndex is 0 for the 1st question, progress is (0+1)/total.
        // If displaying results (currentQuestionIndex might be questions.length), progress is 100%.
        let progressPercentage;
        let progressText;

        if (currentQuestionIndex >= questions.length) { // Quiz finished or showing results
            progressPercentage = 100;
            progressText = `Quiz complete. ${questions.length} of ${questions.length} questions answered.`;
        } else if (questions.length > 0) {
            progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;
            progressText = `Question ${currentQuestionIndex + 1} of ${questions.length}.`;
        } else { // Before quiz starts or if no questions
            progressPercentage = 0;
            progressText = "Quiz not started or no questions loaded.";
        }

        $progressBar.css('width', progressPercentage + '%').attr('aria-valuenow', progressPercentage.toFixed(0));
        // $progressBar.attr('aria-valuetext', progressText); // Optional: more descriptive text
        // Let's use aria-label on the progress bar div itself for a static description, and aria-valuenow for the dynamic part.
        // The label "Quiz progress" is already on the div.
    }

    function displayQuestion() {
        if (currentQuestionIndex < questions.length) {
            updateProgressBar(); // Update progress before displaying the question
            const question = questions[currentQuestionIndex];
            $questionText.html(question.question).focus(); // jQuery's .html() decodes HTML entities by default & set focus
            $answersContainer.empty();
            $feedbackContainer.empty().removeClass('text-green-600 text-red-600');
            $nextQuestionBtn.addClass('hidden');

            let answers = [...question.incorrect_answers];
            answers.push(question.correct_answer);
            // Shuffle answers
            answers.sort(() => Math.random() - 0.5);

            answers.forEach(answer => {
                const $button = $('<button></button>');
                $button.html(answer); // Decodes entities
                $button.addClass('block w-full text-left p-3 my-2 rounded-md border border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-150');
                $button.on('click', function() {
                    handleAnswerSelection($(this), question.correct_answer);
                });
                $answersContainer.append($button);
            });
            // updateProgressBar(); // Moved to the beginning of displayQuestion
        } else {
            showResults();
        }
    }

    function handleAnswerSelection($selectedButton, correctAnswer) {
        // Disable all answer buttons after one is clicked
        $answersContainer.find('button').prop('disabled', true).addClass('opacity-75 cursor-not-allowed');
        $selectedButton.removeClass('hover:bg-gray-200'); // Remove hover effect

        const selectedAnswer = $selectedButton.html(); // Will be HTML decoded text

        if (selectedAnswer === correctAnswer) {
            score++;
            $selectedButton.removeClass('border-gray-300').addClass('bg-green-500 text-white border-green-500');
            $feedbackContainer.text('Correct!').removeClass('text-red-600').addClass('text-green-600 font-semibold');
        } else {
            $selectedButton.removeClass('border-gray-300').addClass('bg-red-500 text-white border-red-500');
            $feedbackContainer.html(`Incorrect. The correct answer was: ${correctAnswer}`).removeClass('text-green-600').addClass('text-red-600 font-semibold');
            // Highlight the correct answer
            $answersContainer.find('button').each(function() {
                if ($(this).html() === correctAnswer) {
                    $(this).removeClass('border-gray-300 opacity-75').addClass('bg-green-500 text-white border-green-500');
                }
            });
        }
        $nextQuestionBtn.removeClass('hidden');
        // If it's the last question, change "Next Question" to "Show Results"
        if (currentQuestionIndex === questions.length - 1) {
            $nextQuestionBtn.text('Show Results');
        } else {
            $nextQuestionBtn.text('Next Question');
        }
        $nextQuestionBtn.removeClass('hidden').focus(); // Show and focus on the next button
    }

    function showResults() {
        stopTimer(); // Stop timer as quiz is ending
        $quizSection.addClass('hidden');

        const numQuestions = questions.length;
        const correctCount = score;
        const incorrectCount = numQuestions - correctCount;
        const percentage = numQuestions > 0 ? (correctCount / numQuestions) * 100 : 0;

        $correctAnswersSpan.text(correctCount);
        $incorrectAnswersSpan.text(incorrectCount);
        $finalScoreSpan.text(percentage.toFixed(1) + '%');

        // Update progress bar to 100% and set ARIA attributes for completion
        currentQuestionIndex = numQuestions; // Ensure progress bar calculation is for completion
        updateProgressBar(); // This will now set it to 100% and update ARIA

        // Store detailed quiz results for history
        const loggedInUser = getCookie(SESSION_COOKIE_NAME);
        if (loggedInUser && numQuestions > 0) { // Only store if logged in and quiz had questions
            const categoryName = $categorySelect.find('option:selected').text();
            const difficultyName = $difficultySelect.find('option:selected').text();

            const quizResult = {
                timestamp: new Date().toISOString(),
                category: $categorySelect.val() ? { id: $categorySelect.val(), name: categoryName } : { id: '', name: 'Any Category'},
                difficulty: $difficultySelect.val() ? {value: $difficultySelect.val(), name: difficultyName } : { value: '', name: 'Any Difficulty'},
                questionType: $typeSelect.val() ? $typeSelect.find('option:selected').text() : 'Any Type',
                numQuestions: numQuestions,
                correct: correctCount,
                incorrect: incorrectCount,
                percentage: parseFloat(percentage.toFixed(1)),
                timeTaken: totalQuizTime > 0 ? totalQuizTime - Math.max(0, timeRemaining) : null // Time spent in seconds
            };

            const historyKey = `quizHistory_${loggedInUser}`;
            let userHistory = JSON.parse(localStorage.getItem(historyKey)) || [];
            userHistory.push(quizResult);
            localStorage.setItem(historyKey, JSON.stringify(userHistory));
            console.log("Quiz result stored for user:", loggedInUser, quizResult);
        }

        showSection($resultsSection);
        $("#results-heading").focus(); // Focus on the results heading
    }

    // --- Event Handlers ---
    $startQuizBtn.on('click', async function() {
        console.log("Start Quiz button clicked");
        resetQuizState(); // Reset before starting a new quiz

        if (!sessionToken) {
            console.log("No session token, requesting one...");
            await requestSessionToken();
            if (!sessionToken) {
                $errorMessageQuiz.text('Could not obtain a session token. Please try again.').removeClass('hidden');
                showSection($resultsSection); // Show error in results section or a dedicated error div in settings
                return;
            }
        }

        const success = await fetchQuestions();
        if (success && questions.length > 0) {
            currentQuestionIndex = 0;
            score = 0;
            calculateTotalTime(); // Calculate time based on fetched questions
            startTimer();         // Start the countdown
            displayQuestion();
            showSection($quizSection);
        } else {
            // Error message already handled by fetchQuestions/handleApiResponse
            // Ensure results section is shown if not already
            if ($resultsSection.hasClass('hidden')) {
                 showSection($resultsSection);
            }
             // If questions array is empty but success was true (e.g. API returned 0 results but response_code was 0)
            if (questions.length === 0 && $errorMessageQuiz.text() === '') {
                $errorMessageQuiz.text('No questions found for your criteria.').removeClass('hidden');
            }
        }
    });

    $nextQuestionBtn.on('click', function() {
        console.log("Next Question button clicked");
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            displayQuestion();
        } else {
            console.log("End of quiz, showing results.");
            showResults();
        }
    });

    $retakeQuizBtn.on('click', async function() {
        console.log("Retake Quiz button clicked");
        // Reset quiz state for retake, keep current settings
        resetQuizState();
        // We need to re-fetch questions. If the token is still good, it should give new questions
        // or handle 'Token Empty' if all questions for that token & criteria were exhausted.
        // If token was invalidated (e.g. by Token Not Found), startQuizBtn logic would request a new one.
        // For simplicity, we can call the start quiz logic again, which will use existing settings.
        // The $startQuizBtn handler already calls resetQuizState.

        // $startQuizBtn.trigger('click'); // This is one way, but let's be more explicit
        // to ensure UI updates correctly and avoid potential recursive loops if not careful.

        // Re-fetch questions with current settings.
        // $startQuizBtn logic already handles token presence and fetching.
        // We need to ensure that resetQuizState does not clear the settings values from the form.
        // (which it currently doesn't, it only resets runtime quiz variables)

        const success = await fetchQuestions(); // Uses current form settings
        if (success && questions.length > 0) {
            currentQuestionIndex = 0;
            score = 0;
            calculateTotalTime(); // Calculate time for the new set of questions
            startTimer();         // Start the timer
            displayQuestion();
            showSection($quizSection);
        } else {
            // Error message handled by fetchQuestions/handleApiResponse
            if ($resultsSection.hasClass('hidden')) {
                 showSection($resultsSection);
            }
            if (questions.length === 0 && $errorMessageQuiz.text() === '') {
                $errorMessageQuiz.text('Could not retake quiz. No questions found for current settings.').removeClass('hidden');
            }
        }
    });

    $newSettingsBtn.on('click', function() {
        console.log("New Settings button clicked");
        resetQuizState();
        showSection($settingsSection);
    });

    // --- Helper Functions ---
    function resetQuizState() {
        questions = [];
        currentQuestionIndex = 0;
        score = 0;
        stopTimer(); // Stop any active timer
        totalQuizTime = 0;
        timeRemaining = 0;
        updateTimerDisplay(); // Reset display to --:-- or initial state
        $timeRemainingDisplay.text('Time: --:--');


        // sessionToken = null; // Or reset it via API if needed
        $questionText.html("Question will appear here...");
        $answersContainer.empty();
        $feedbackContainer.empty().removeClass('text-green-600 text-red-600');
        $progressBar.css('width', '0%').attr('aria-valuenow', '0'); // Reset progress bar ARIA
        $nextQuestionBtn.addClass('hidden');
        $errorMessageQuiz.text('').addClass('hidden');
    }

    // Call init function when DOM is ready
    init();

    // --- Auth UI Togglers ---
    $showLoginLink.on('click', function(e) {
        e.preventDefault();
        $registrationFormContainer.addClass('hidden');
        $loginFormContainer.removeClass('hidden');
        $regFeedback.text('').removeClass('text-red-500 text-green-500');
        $loginFeedback.text('').removeClass('text-red-500');
        $loginUsernameInput.focus(); // Focus on username field of login form
    });

    $showRegisterLink.on('click', function(e) {
        e.preventDefault();
        $loginFormContainer.addClass('hidden');
        $registrationFormContainer.removeClass('hidden');
        $loginFeedback.text('').removeClass('text-red-500');
        $regFeedback.text('').removeClass('text-red-500 text-green-500');
        $regUsernameInput.focus(); // Focus on username field of registration form
    });

    // --- Registration Logic ---
    $registrationForm.on('submit', function(e) {
        e.preventDefault();
        const username = $regUsernameInput.val().trim();
        const password = $regPasswordInput.val(); // For this demo, not hashing. Real app MUST hash.

        if (!username || !password) {
            $regFeedback.text('Username and password are required.').removeClass('text-green-500').addClass('text-red-500');
            return;
        }
        // Basic password length check (example)
        if (password.length < 6) {
            $regFeedback.text('Password must be at least 6 characters long.').removeClass('text-green-500').addClass('text-red-500');
            return;
        }


        let users = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY)) || {};

        if (users[username]) {
            $regFeedback.text('Username already exists. Please choose another.').removeClass('text-green-500').addClass('text-red-500');
        } else {
            // Simulate storing the user. In a real app, password would be securely hashed.
            users[username] = { password: password }; // Storing plain password for demo purposes ONLY.
            localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify(users));

            $regFeedback.text('Registration successful! Please login.').removeClass('text-red-500').addClass('text-green-500');
            $regUsernameInput.val(''); // Clear registration form
            $regPasswordInput.val('');

            // Automatically switch to login form
            setTimeout(() => {
                $showLoginLink.trigger('click'); // Simulate click to switch forms
                $loginUsernameInput.val(username); // Pre-fill username in login form
                $loginPasswordInput.focus();
                $regFeedback.text(''); // Clear registration success message after switch
            }, 1500); // Delay to allow user to read success message
        }
    });

    // --- Login Logic ---
    $loginForm.on('submit', function(e) {
        e.preventDefault();
        const username = $loginUsernameInput.val().trim();
        const password = $loginPasswordInput.val();

        if (!username || !password) {
            $loginFeedback.text('Username and password are required.').addClass('text-red-500');
            return;
        }

        let users = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY)) || {};
        const user = users[username];

        if (user && user.password === password) { // In a real app, compare hashed passwords securely
            setCookie(SESSION_COOKIE_NAME, username, 1); // Set session cookie for 1 day

            $loginFeedback.text('Login successful!').removeClass('text-red-500').addClass('text-green-500');
            $loginUsernameInput.val('');
            $loginPasswordInput.val('');

            updateUIAfterLogin(username);

            // Optionally clear success message after a delay
            setTimeout(() => { $loginFeedback.text(''); }, 1500);

        } else {
            $loginFeedback.text('Invalid username or password.').removeClass('text-green-500').addClass('text-red-500');
        }
    });

    function updateUIAfterLogin(username) {
        $authSection.addClass('hidden'); // Hide login/reg section
        $quizMainContainer.removeClass('hidden'); // Show main quiz content
        $settingsSection.removeClass('hidden'); // Ensure settings are visible if previously hidden by quiz flow
        $quizSection.addClass('hidden'); // Keep quiz gameplay hidden until started
        $resultsSection.addClass('hidden'); // Keep results hidden

        $userDisplay.text(`Logged in as: ${username}`);
        $userInfoContainer.removeClass('hidden'); // Show user info (name + logout button)

        // Reset any previous quiz state when logging in, ready for a fresh start
        resetQuizState();
        // Populate categories and get a session token for the OpenTDB API as user is now logged in
        populateCategories();
        requestSessionToken();
        // Focus on a relevant element after login, e.g., the start quiz button
        $startQuizBtn.focus();
    }

    // --- Logout Logic ---
    $logoutBtn.on('click', function() {
        deleteCookie(SESSION_COOKIE_NAME);
        updateUIAfterLogout();
    });

    function updateUIAfterLogout() {
        $quizMainContainer.addClass('hidden'); // Hide main quiz content
        $authSection.removeClass('hidden');     // Show login/reg section

        // Default to showing login form after logout
        $registrationFormContainer.addClass('hidden');
        $loginFormContainer.removeClass('hidden');
        $loginFeedback.text('').removeClass('text-red-500 text-green-500'); // Clear any old messages
        $regFeedback.text('').removeClass('text-red-500 text-green-500');


        $userInfoContainer.addClass('hidden'); // Hide user info (name + logout button)
        $userDisplay.text('');

        // Clear quiz specific data and OpenTDB session token
        resetQuizState();
        sessionToken = null; // Explicitly clear the OpenTDB session token
        // Clear category dropdown to be repopulated if user logs in again or on page refresh
        $categorySelect.empty().append('<option value="">Any Category</option>');
        // No need to call populateCategories() or requestSessionToken() here, as user is logged out.

        // Focus on the login username field
        $loginUsernameInput.focus();
    }


    // --- Report/History Logic ---
    $viewHistoryBtn.on('click', function() {
        showReportSection();
    });

    $backToSettingsBtn.on('click', function() {
        $reportSection.addClass('hidden');
        $quizMainContainer.removeClass('hidden'); // Show quiz settings area
        $settingsSection.removeClass('hidden');
        $quizSection.addClass('hidden');
        $resultsSection.addClass('hidden');
        // Potentially focus on a settings element, e.g., the first one or a heading
        $("#settings-section h2").first().focus();
    });

    // This is the consolidated showReportSection function
    function showReportSection() {
        $quizMainContainer.addClass('hidden');
        $authSection.addClass('hidden'); // Should already be hidden if user is logged in
        $reportSection.removeClass('hidden');
        $("#report-section h1").first().focus(); // Focus on report heading

        loadAndDisplayQuizHistory(); // This function now exists

        // Fetch history again or pass it from loadAndDisplayQuizHistory
        const loggedInUser = getCookie(SESSION_COOKIE_NAME);
        if (loggedInUser) {
            const historyKey = `quizHistory_${loggedInUser}`;
            const userHistory = JSON.parse(localStorage.getItem(historyKey)) || [];
            renderScoreOverTimeChart(userHistory);
            renderCategoryPerformanceChart(userHistory);
            renderDifficultyDistributionChart(userHistory);
        } else {
            // Clear charts if no user (or handle in render functions)
            destroyChartIfExists($scoreOverTimeChartEl);
            destroyChartIfExists($categoryPerformanceChartEl);
            destroyChartIfExists($difficultyDistributionChartEl);
        }
    }

    function loadAndDisplayQuizHistory() {
        const loggedInUser = getCookie(SESSION_COOKIE_NAME);
        if (!loggedInUser) {
            $noHistoryMessage.text("Please log in to view history.").removeClass('hidden');
            $historyTablePlaceholder.empty(); // Clear any old table
            return;
        }

        const historyKey = `quizHistory_${loggedInUser}`;
        const userHistory = JSON.parse(localStorage.getItem(historyKey)) || [];

        $historyTablePlaceholder.empty(); // Clear previous table/message

        if (userHistory.length === 0) {
            $noHistoryMessage.text("No quiz history found.").removeClass('hidden');
        } else {
            $noHistoryMessage.addClass('hidden');
            const $table = $('<table class="min-w-full divide-y divide-gray-200 border border-gray-300"></table>');

            // Add a caption for accessibility
            const $caption = $('<caption>A summary of your past quiz attempts, showing details including date, category, difficulty, and score.</caption>');
            $caption.addClass('sr-only'); // Visually hide, but available to screen readers
            $table.append($caption);

            const $thead = $('<thead class="bg-gray-50"><tr></tr></thead>');
            const headers = ["Date", "Category", "Difficulty", "Type", "Questions", "Correct", "Score %", "Time Taken"];
            headers.forEach(header => {
                $thead.find('tr').append(`<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`);
            });
            $table.append($thead);

            const $tbody = $('<tbody class="bg-white divide-y divide-gray-200"></tbody>');
            // Display latest quizzes first
            userHistory.slice().reverse().forEach(quiz => {
                const $row = $('<tr></tr>');
                const quizDate = new Date(quiz.timestamp).toLocaleString();
                const timeTakenStr = quiz.timeTaken !== null ? formatTime(quiz.timeTaken) : 'N/A';

                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${quizDate}</td>`);
                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${quiz.category.name}</td>`);
                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${quiz.difficulty.name}</td>`);
                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${quiz.questionType}</td>`);
                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">${quiz.numQuestions}</td>`);
                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">${quiz.correct}</td>`);
                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center font-semibold">${quiz.percentage}%</td>`);
                $row.append(`<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">${timeTakenStr}</td>`);
                $tbody.append($row);
            });
            $table.append($tbody);
            $historyTablePlaceholder.append($table);
        }
    }

    function destroyChartIfExists(chartContainerElement) {
        // ApexCharts adds a data attribute 'apexcharts-id' to the container.
        // We can check for this or simply try to get the chart instance by its common ID pattern.
        // However, a simpler way for this context is to empty the container before rendering.
        // This might not destroy the ApexCharts instance itself if not managed by an instance variable,
        // but it prevents duplicate charts. For more robust dynamic updates, managing chart instances is better.
        if (chartContainerElement && chartContainerElement.length > 0) {
            chartContainerElement.empty(); // Clear previous chart
        }
    }


    function renderScoreOverTimeChart(userHistory) {
        destroyChartIfExists($scoreOverTimeChartEl);
        if (userHistory.length === 0) return;

        const options = {
            series: [{
                name: 'Score %',
                data: userHistory.map(quiz => quiz.percentage)
            }],
            chart: {
                type: 'line',
                height: 350,
                toolbar: { show: true }
            },
            xaxis: {
                type: 'datetime',
                categories: userHistory.map(quiz => quiz.timestamp),
                title: { text: 'Date of Quiz' }
            },
            yaxis: {
                title: { text: 'Score Percentage' },
                min: 0,
                max: 100
            },
            tooltip: {
                x: { format: 'dd MMM yyyy HH:mm' }
            },
            stroke: { curve: 'smooth' },
            title: { text: 'Quiz Score Trend', align: 'left' }
        };
        const chart = new ApexCharts($scoreOverTimeChartEl[0], options);
        chart.render();
    }

    function renderCategoryPerformanceChart(userHistory) {
        destroyChartIfExists($categoryPerformanceChartEl);
        if (userHistory.length === 0) return;

        const categoryData = {}; // { 'Category Name': { totalScore: 0, count: 0 } }
        userHistory.forEach(quiz => {
            const catName = quiz.category.name || 'Unknown';
            if (!categoryData[catName]) {
                categoryData[catName] = { totalScore: 0, count: 0 };
            }
            categoryData[catName].totalScore += quiz.percentage;
            categoryData[catName].count++;
        });

        const categories = Object.keys(categoryData);
        const averageScores = categories.map(cat =>
            parseFloat((categoryData[cat].totalScore / categoryData[cat].count).toFixed(1))
        );

        const options = {
            series: [{
                name: 'Average Score %',
                data: averageScores
            }],
            chart: {
                type: 'bar',
                height: 350,
                toolbar: { show: true }
            },
            xaxis: {
                categories: categories,
                title: { text: 'Category' }
            },
            yaxis: {
                title: { text: 'Average Score %' },
                min: 0,
                max: 100
            },
            plotOptions: { bar: { horizontal: false, columnWidth: '55%', endingShape: 'rounded' } },
            title: { text: 'Average Score by Category', align: 'left' }
        };
        const chart = new ApexCharts($categoryPerformanceChartEl[0], options);
        chart.render();
    }

    function renderDifficultyDistributionChart(userHistory) {
        destroyChartIfExists($difficultyDistributionChartEl);
        if (userHistory.length === 0) return;

        const difficultyCounts = { 'Any Difficulty': 0, 'Easy': 0, 'Medium': 0, 'Hard': 0 };
        userHistory.forEach(quiz => {
            const diffName = quiz.difficulty.name || 'Any Difficulty';
             if (difficultyCounts[diffName] !== undefined) {
                difficultyCounts[diffName]++;
            } else {
                // If a new/unexpected difficulty name appears, group it under 'Other' or handle as needed
                difficultyCounts['Other'] = (difficultyCounts['Other'] || 0) + 1;
            }
        });

        // Filter out difficulties with zero quizzes taken for a cleaner pie chart
        const labels = Object.keys(difficultyCounts).filter(key => difficultyCounts[key] > 0);
        const series = labels.map(label => difficultyCounts[label]);

        if (series.length === 0) return; // Nothing to show

        const options = {
            series: series,
            labels: labels,
            chart: {
                type: 'donut', // or 'pie'
                height: 380
            },
            title: { text: 'Quiz Distribution by Difficulty', align: 'left' },
            responsive: [{
                breakpoint: 480,
                options: {
                    chart: { width: 200 },
                    legend: { position: 'bottom' }
                }
            }]
        };
        const chart = new ApexCharts($difficultyDistributionChartEl[0], options);
        chart.render();
    }

    // The duplicate showReportSection function that was here has been removed.
    // The consolidated version is now located above loadAndDisplayQuizHistory.

});
