/**
 * DSAT SCORING DATA (Linear Scale)
 * Maps Total Mistakes (Mod 1 + Mod 2) -> Scaled Score out of 800
 */
export const DSAT_SCORING_DATA = {
  "MATH_LINEAR_LOOKUP": {
    "0": 800, "1": 790, "2": 770, "3": 760, "4": 750, "5": 730, "6": 720, 
    "7": 700, "8": 690, "9": 680, "10": 660, "11": 650, "12": 640, "13": 620, 
    "14": 610, "15": 600, "16": 580, "17": 570, "18": 550, "19": 540, "20": 530, 
    "21": 510, "22": 500, "23": 490, "24": 470, "25": 460, "26": 450, "27": 430, 
    "28": 420, "29": 400, "30": 390, "31": 380, "32": 360, "33": 350, "34": 340, 
    "35": 320, "36": 310, "37": 300, "38": 280, "39": 270, "40": 250, "41": 240, 
    "42": 230, "43": 210, "44": 200
  },
  "RW_LINEAR_LOOKUP": {
    "0": 800, "1": 790, "2": 780, "3": 770, "4": 760, "5": 740, "6": 730, 
    "7": 720, "8": 710, "9": 700, "10": 690, "11": 680, "12": 670, "13": 660, 
    "14": 640, "15": 630, "16": 620, "17": 610, "18": 600, "19": 590, "20": 580, 
    "21": 570, "22": 560, "23": 540, "24": 530, "25": 520, "26": 510, "27": 500, 
    "28": 490, "29": 480, "30": 470, "31": 460, "32": 440, "33": 430, "34": 420, 
    "35": 410, "36": 400, "37": 390, "38": 380, "39": 370, "40": 360, "41": 340, 
    "42": 330, "43": 320, "44": 310, "45": 300, "46": 290, "47": 280, "48": 270, 
    "49": 260, "50": 240, "51": 230, "52": 220, "53": 210, "54": 200
  }
};

/**
 * Calculates the final scaled score for a DSAT section, applying routing caps.
 * @param {string} section - "MATH" or "RW"
 * @param {number} totalMistakes - Combined mistakes from Module 1 + Module 2
 * @param {boolean} tookHardRoute - Your internal variable checking if they got the Hard Mod 2
 * @returns {object} Payload with the route taken and final score
 */
export function calculateSectionScore(section, totalMistakes, tookHardRoute) {
  let easyCap, lookupTable;

  // Load constraints based on the section
  if (section === "MATH") {
    easyCap = 610;
    lookupTable = DSAT_SCORING_DATA.MATH_LINEAR_LOOKUP;
  } else if (section === "RW") {
    easyCap = 600;
    lookupTable = DSAT_SCORING_DATA.RW_LINEAR_LOOKUP;
  } else {
    throw new Error("Invalid section. Use 'MATH' or 'RW'.");
  }

  // 1. Fetch base score from the lookup dictionary (fallback to 200 if beyond max mistakes)
  let baseScore = lookupTable[totalMistakes.toString()];
  if (baseScore === undefined) {
    baseScore = 200;
  }

  // 2. Apply the Cap if they took the Easy Route
  let finalScore = tookHardRoute ? baseScore : Math.min(baseScore, easyCap);

  return {
    section: section,
    routeTaken: tookHardRoute ? "HARD" : "EASY",
    totalMistakes: totalMistakes,
    finalScaledScore: finalScore
  };
}
