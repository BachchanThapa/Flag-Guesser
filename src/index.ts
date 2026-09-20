
// === Data models (types) ===//
interface Country {
  name: string;    // country name, e.g., "Sweden"
  flagPng: string; // url to PNG flag
}

interface Question {
  flagUrl: string;      // which flag image to show
  correctName: string;  // the right country name
  options: string[];    // exactly 4 names (includes the correct one)
}

//=============== Simple game state ==========//
const TOTAL_ROUNDS = 5;
let roundIndex = 0;            // which question (0..4)
let score = 0;                 // 0..5
let allCountries: Country[] = [];
let questions: Question[] = [];


// ============ Collections of all our Elements===============//

const elRound = document.getElementById("round") as HTMLSpanElement;
const elScore = document.getElementById("score") as HTMLSpanElement;
const elHigh  = document.getElementById("highScore") as HTMLSpanElement;

const screenStart = document.getElementById("screen-start") as HTMLDivElement;
const screenGame  = document.getElementById("screen-game")  as HTMLDivElement;
const screenEnd   = document.getElementById("screen-end")   as HTMLDivElement;

const btnStart = document.getElementById("btnStart") as HTMLButtonElement;
const btnRetry = document.getElementById("btnRetry") as HTMLButtonElement;

const flagImg   = document.getElementById("flagImg")   as HTMLImageElement;
const optionsBox= document.getElementById("options")   as HTMLDivElement;
const feedback  = document.getElementById("feedback")  as HTMLParagraphElement;

const finalScore= document.getElementById("finalScore") as HTMLSpanElement;
const bestScore = document.getElementById("bestScore")  as HTMLSpanElement;


// ========We are adding music here ==========//
const soundCorrect = new Audio("./sounds/correct.mp3"); // "YaY"
const soundWrong   = new Audio("./sounds/wrong.mp3");   // "ah.."



/* ===For each round/question===Shuffle OPTIONS- 4 answer labels and their order is random=== */

function shuffleStrings(optionNames: string[]): string[] {
  const options = [...optionNames];   // copy of the 4 option country names
  for (let currentIndex = options.length - 1; currentIndex >= 0; currentIndex--) {
    const randomIndex = Math.floor(Math.random() * (currentIndex + 1)); //Picking a random integer from 0 to currentIndex
    const temporary = options[currentIndex];        // hold current items
    options[currentIndex] = options[randomIndex];   // put random item here
    options[randomIndex] = temporary;               // move held item to random spot
  }
  return options;     // shuffled 4 button labels with country name, in random order
}


/* Pick 'count' of DIFFERENT countries from the list. */
//=== in our case those 5 unique correct answer countries===//
function pickDifferentCountries(countries: Country[], count: number): Country[] {
  if (count > countries.length) {        //~200-250 countries form the API, South America has only  12
    throw new Error("Asked for more countries than available."); //safety brake e.g if asked 15 from South America 
  }
  const chosen: Country[] = [];      // will hold the 5 unique correct answers
  while (chosen.length < count) {
    const randomIndex = Math.floor(Math.random() * countries.length);
    const candidate = countries[randomIndex];
    // Only add if not already chosen
    if (chosen.indexOf(candidate) === -1) { //If this country is not already in the basket, put it in
  chosen.push(candidate);
}

  }
  return chosen;               // 5 unique countries for 5 rounds
}

//=== Local Storage === //

const HIGH_SCORE_KEY = "flagGuesserHighscore";

function getHighScore(): number {
  const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY); // text from storage, LS stores as "4" as string
  const highScore = storedHighScore ? Number(storedHighScore) : 0; // number version

  return Number.isFinite(highScore) ? highScore : 0; // make sure it’s a real number
}

function setHighScore(score: number): void {
  localStorage.setItem(HIGH_SCORE_KEY, String(score)); // save the score as text
}

//=== REST Countries (fetch once. For play again it goes smoothly as the data is already stored in the memory)===//
async function loadCountries(): Promise<Country[]> {
  const url = "https://restcountries.com/v3.1/all?fields=name,flags"; // Kindly gives only name and flags
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch countries.");

  // Type for the API item (just what we use name and flag)
  type ApiCountry = { name: { common: string }, flags: { png: string } };
  const rawList: ApiCountry[] = await res.json();

  // Map to our own simpler model; also filter any item with missing data
  const mapped: Country[] = rawList
    .filter(c => !!c?.name?.common && !!c?.flags?.png)
    // for each country c, KEEP ONLY the country with name and flag.
    .map(c => ({ name: c.name.common, flagPng: c.flags.png }));
    // for each country build a new object
    // Thus, We take the complicated API object c and turn it into a simple object:

  // Now Map keeps last one, so no duplicacy.
  const byName = new Map<string, Country>();
  for (const c of mapped) byName.set(c.name, c); //In the Map, we store the country using its name as the key
  return [...byName.values()]; //gives us all the Country objects stored in the Map
  // [...byName.values()] uses the spread operator ... to turn those values into a normal array
}



//===THE BRAIN part, Build 5 questions===//
function makeQuestions(countries: Country[]): Question[] {
  const qs: Question[] = [];

  // Pick 5 distinct "correct" countries
  const correctPicks = pickDifferentCountries(countries, TOTAL_ROUNDS);

  for (const correct of correctPicks) {
    // 3 distractors (not the same as correct)
    const pool = countries.filter(c => c.name !== correct.name);
    const distractors = pickDifferentCountries(pool, 3);

    // Options = 1 correct + 3 wrong, then shuffle their order
    const options = shuffleStrings([correct.name, ...distractors.map(d => d.name)]);

    qs.push({
      flagUrl: correct.flagPng,
      correctName: correct.name,
      options
    });
  }

  return qs;
}


//=== UI helpers, showScreen(...) ===//
function showScreen(which: "start" | "game" | "end"): void { // shows only one of these start or game or end at a time and hide others
  screenStart.classList.toggle("visible", which === "start");
  screenGame .classList.toggle("visible", which === "game");
  screenEnd  .classList.toggle("visible", which === "end");
}
  //=== UPPDATING DOM Elements round number, score, high score===//
function updateTopBar(): void { // updates DOM only, does not return any value
  elRound.textContent = String(Math.min(roundIndex + 1, TOTAL_ROUNDS));
  elScore.textContent = String(score);
  elHigh.textContent  = String(getHighScore());
}

function renderQuestion(q: Question): void {
  // Set the flag image
  flagImg.src = q.flagUrl;
  flagImg.alt = "Flag to guess";

  // Clear old buttons
  optionsBox.innerHTML = "";

  // Create 4 answer buttons
  q.options.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.textContent = name;

    // When user clicks, we check the answer
    btn.addEventListener("click", () => handleAnswer(name));

    optionsBox.appendChild(btn); //Put the button into the page so it becomes visible.
  });

  // Reset feedback message
  feedback.className = "feedback";
  feedback.textContent = "";
}

// =============Answer handling ============= //

function handleAnswer(chosenName: string): void {
  const q = questions[roundIndex]; // This is our question for this round
  const isCorrect = chosenName === q.correctName; // check if the correct answer is clicked

  // Give visual feedback + play sound
  if (isCorrect) {
    score++;
    feedback.textContent = "YaY! Correct 🎉";
    feedback.className = "feedback ok";
    soundCorrect.currentTime = 0;
    void soundCorrect.play();
  } else {
    feedback.textContent = `ah.. It was ${q.correctName}.`;
    feedback.className = "feedback bad";
    soundWrong.currentTime = 0;
    void soundWrong.play();
  }

  // Disable all buttons to prevent double clicks while we pause
  optionsBox.querySelectorAll("button").forEach(b => (b as HTMLButtonElement).disabled = true);

  updateTopBar();

  // After a short pause, 0.9 sec here, move on
  window.setTimeout(nextStep, 900);
}

function nextStep(): void {
  roundIndex++;
  if (roundIndex >= TOTAL_ROUNDS) {
    endGame();
  } else {
    renderQuestion(questions[roundIndex]); // runs till the round index becomes 4
  }
}

// =========GAME START ======== Game control===============//

async function startGame(): Promise<void> {
  // Reset basic state
  score = 0;
  roundIndex = 0;
  updateTopBar(); // refreshes UI counters and shows 0/0 at the START

  try {
    // Fetch country list only once. For next game we already have these countries in our memory, so we skip in play again
    if (allCountries.length === 0) {
      allCountries = await loadCountries();
    }

    // Create 5 questions from the country pool
    questions = makeQuestions(allCountries);

    // Switch screens and render first question
    showScreen("game"); //Hide start/end screens, show the game screen.
    renderQuestion(questions[0]); // index 0, round 1

  } catch (err) {
    showScreen("start");
    const msg = err instanceof Error ? err.message : "Unknown error."; // network fetch failed, JSON bad, or makeQuestions couldn’t build 5 questions
    alert("Could not start the game: " + msg); // Pop a simple message so the user knows what happened
  }
}

function endGame(): void {
  showScreen("end");
  finalScore.textContent = String(score);

  //======== Update high score if you beat it =================//
  const currentHigh = getHighScore();  //Read the saved best score  from localStorage.
  if (score > currentHigh) setHighScore(score); // If this round went better, save the new best.
  bestScore.textContent = String(getHighScore()); // Show the best-ever score on the end screen.
}

//============ Wire up buttons + initial UI=======//
btnStart.addEventListener("click", () => void startGame());
btnRetry.addEventListener("click", () => void startGame());
  // We don’t care about the return value (or promise) from startGame. void is just a TypeScript.
showScreen("start");
updateTopBar();                // sets score=0, round=1 display
elHigh.textContent = String(getHighScore()); // The saved high score is shown
