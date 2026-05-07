// Pre-Employment Clinical Judgment Test — 14 multiple-choice questions.
// SAFE FOR CLIENT IMPORT. The answer key lives in clinicalTestScoring.ts
// which is server-only (do not move keys into this file).

export type ClinicalTestChoice = { letter: "A" | "B" | "C" | "D" | "E"; text: string };

export type ClinicalTestQuestion = {
  number: number;
  prompt: string;
  choices: ClinicalTestChoice[];
};

export const CLINICAL_TEST_QUESTIONS: ClinicalTestQuestion[] = [
  {
    number: 1,
    prompt: "You are caring for a patient with an uncontrolled seizure disorder. You review a care plan for interventions to be taken in the event of a seizure. Which intervention would NOT be included?",
    choices: [
      { letter: "A", text: "Remove hard or sharp objects from the area." },
      { letter: "B", text: "Restrain the patient's limbs." },
      { letter: "C", text: "Turn the patient to the side to maintain open airway." },
      { letter: "D", text: "Stay with the patient until fully conscious." }
    ]
  },
  {
    number: 2,
    prompt: "An infant with congenital heart defect is receiving diuretic therapy of Lasix. Which of the following symptoms would require you to notify physician immediately?",
    choices: [
      { letter: "A", text: "Sudden weight gain." },
      { letter: "B", text: "Increase irritability after the feed." },
      { letter: "C", text: "Hard a big wet diaper one hour after the medicine." },
      { letter: "D", text: "Lost 2 pounds from last week." }
    ]
  },
  {
    number: 3,
    prompt: "You are about to administer digoxin elixir to a 2-month-old with Congenital heart defect. You auscultate an apical pulse rate of 80. You should:",
    choices: [
      { letter: "A", text: "Call 911." },
      { letter: "B", text: "Administer half of the medication dose." },
      { letter: "C", text: "Administer the medication and recheck the heart rate in 15 minutes." },
      { letter: "D", text: "Hold the medication and recheck the heart rate in 30 minutes." }
    ]
  },
  {
    number: 4,
    prompt: "A nurse is suctioning a patient with tracheostomy tube. Which of the following is a correct technique for this procedure?",
    choices: [
      { letter: "A", text: "Suction for 30 seconds before withdrawing catheter from the tracheostomy." },
      { letter: "B", text: "Apply suction during insertion of a catheter to the tracheostomy." },
      { letter: "C", text: "Suction mouth and nose before suctioning tracheostomy." },
      { letter: "D", text: "Keep the catheter sterile during the entire procedure." }
    ]
  },
  {
    number: 5,
    prompt: "You are receiving a medication order over the telephone. How should you handle this situation?",
    choices: [
      { letter: "A", text: "Tell the physician that the nurse practice act prohibits taking medication order over the phone." },
      { letter: "B", text: "Verify the order by repeating it to the physician over the phone." },
      { letter: "C", text: "Request that a second physician repeat the order to you over the phone." },
      { letter: "D", text: "Insist the physician sign the medication order within one (1) hour." }
    ]
  },
  {
    number: 6,
    prompt: "A child with the history of epilepsy is having a seizure, what condition would prompt a nurse to call 911?",
    choices: [
      { letter: "A", text: "Difficulty in breathing or walking after the seizure." },
      { letter: "B", text: "The seizure lasts longer than 5 minutes." },
      { letter: "C", text: "The child has another seizure soon after the first one." },
      { letter: "D", text: "Seizure continues for more than a few minutes after giving the Diastat." },
      { letter: "E", text: "All of the above." }
    ]
  },
  {
    number: 7,
    prompt: "A nurse is caring for a child who suddenly develops a tonic-clonic seizure. Which nursing action is priority?",
    choices: [
      { letter: "A", text: "Look at your watch at the start of the seizure, to time its length." },
      { letter: "B", text: "Assess the child's airway." },
      { letter: "C", text: "Clear the area around the child of any hard, sharp or hot objects to prevent injury." },
      { letter: "D", text: "Have the Diastat (rectal diazepam) ready to give if the seizure last over five minutes." }
    ]
  },
  {
    number: 8,
    prompt: "A physician orders Amoxicillin 500mg liquid, BID via G-Tube for 2 year old patient with strep infection. The medication comes in a bottle labeled 250mg/5ml. What quantity would you administer?",
    choices: [
      { letter: "A", text: "5 ML" },
      { letter: "B", text: "10 ML" },
      { letter: "C", text: "2.5 ML" },
      { letter: "D", text: "20 ML" }
    ]
  },
  {
    number: 9,
    prompt: "A physician orders Lasix 20 mg twice a day PO for a 2 year old patient. Available dose is 5mg/tablet. How many tablets would you administer to the patient?",
    choices: [
      { letter: "A", text: "2 tablets" },
      { letter: "B", text: "5 tablets" },
      { letter: "C", text: "4 tablets" },
      { letter: "D", text: "10 tablets" }
    ]
  },
  {
    number: 10,
    prompt: "A 4 year old patient receives continuous feeding of 600 ML via G-Tube to run over 13 hours from 8pm – 6AM. What is the infusion rate?",
    choices: [
      { letter: "A", text: "30 ML/HR" },
      { letter: "B", text: "80 ML/HR" },
      { letter: "C", text: "90 ML/HR" },
      { letter: "D", text: "60 ML/HR" }
    ]
  },
  {
    number: 11,
    prompt: "A physician writes the following order for a patient: Digoxin .125 mg PO once, daily. To prevent a dose error, how would you transcribe this order into the Medication Administration Record (MAR)?",
    choices: [
      { letter: "A", text: "Digoxin .125 mg PO once daily" },
      { letter: "B", text: "Digoxin 0.125 mg PO Once daily" },
      { letter: "C", text: "Digoxin 0.1250 mg PO Once daily" },
      { letter: "D", text: "Digoxin .1250 mg PO Once daily" }
    ]
  },
  {
    number: 12,
    prompt: "Which of the following is the FIRST priority in preventing infections when providing care for a patient?",
    choices: [
      { letter: "A", text: "Hand washing." },
      { letter: "B", text: "Wearing gloves." },
      { letter: "C", text: "Using a barrier between patient's furniture and nurse's bag." },
      { letter: "D", text: "Wearing gowns and goggles." }
    ]
  },
  {
    number: 13,
    prompt: "While you're changing the tracheostomy ties on 6 year old patient with cerebral palsy (CP), patient coughs and the tube dislodged (comes out). Your initial action would be:",
    choices: [
      { letter: "A", text: "Call the physician." },
      { letter: "B", text: "Reinsert tracheostomy tube immediately." },
      { letter: "C", text: "Wait until patient stop coughing and ask if it's OK to reinsert a tracheostomy tube." },
      { letter: "D", text: "Cover the tracheostomy site with a sterile dressing to prevent infection." }
    ]
  },
  {
    number: 14,
    prompt: "You performed a blood glucose test at 7AM on 14 year old patient with type 2 diabetes. The blood sugar reading shows 60. Based on the reading of 60, you should:",
    choices: [
      { letter: "A", text: "Call 911." },
      { letter: "B", text: "Give regular insulin per sliding scale." },
      { letter: "C", text: "Give him a cup of orange juice and recheck the blood sugar in 10 minutes." },
      { letter: "D", text: "Administer the next hyperglycemic tablet." }
    ]
  }
];

export const CLINICAL_TEST_PASS_THRESHOLD = 11; // out of 14 (78%)
