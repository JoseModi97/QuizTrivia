// Quiz Application Logic using jQuery

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
        populateCategories();
        requestSessionToken();
        // We can request a token initially, or wait until "Start Quiz" is clicked.
        // For now, let's get it on load to simplify the start quiz logic slightly.
        // If it expires or becomes invalid, we'll handle it then.
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
        $correctAnswersSpan.text(score);
        $incorrectAnswersSpan.text(questions.length - score);
        const percentage = questions.length > 0 ? (score / questions.length) * 100 : 0;
        $finalScoreSpan.text(percentage.toFixed(1) + '%');

        // Update progress bar to 100% and set ARIA attributes for completion
        currentQuestionIndex = questions.length; // Ensure progress bar calculation is for completion
        updateProgressBar(); // This will now set it to 100% and update ARIA

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
});
