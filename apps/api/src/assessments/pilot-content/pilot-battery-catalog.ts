import {
  COUNSELOR_VALIDATION_NOTICE,
  EMPLOYMENT_DECISION_NOTICE,
  type AssessmentProductSegment,
} from "../assessment-product-segment";

export type PilotItemType = "LIKERT" | "SINGLE_CHOICE";
export type PilotConstructKind = "SELF_REPORT" | "APTITUDE" | "SITUATIONAL_JUDGMENT";
export type PilotReportSection =
  "PERSONALITY" | "INTERESTS" | "MOTIVATORS" | "LEARNING_PROFILE" | "APTITUDE_AND_ABILITIES";

export interface PilotItemOption {
  code: string;
  label: string;
  score: number;
}

export interface PilotItem {
  code: string;
  type: PilotItemType;
  prompt: string;
  constructCode: string;
  reverseScored: boolean;
  required: true;
  options: PilotItemOption[];
}

export interface PilotConstruct {
  code: string;
  name: string;
  description: string;
  reportSection: PilotReportSection;
  kind: PilotConstructKind;
  theoreticalMinimum: number;
  theoreticalMaximum: number;
}

export interface PilotCareerFactor {
  constructCode: string;
  weight: number;
  direction: "POSITIVE" | "NEGATIVE";
}

export interface PilotCareerPath {
  code: string;
  name: string;
  clusterCode: string;
  clusterName: string;
  description: string;
  factors: PilotCareerFactor[];
}

export interface PilotBattery {
  code: string;
  segment: AssessmentProductSegment;
  title: string;
  edition: string;
  form: "A";
  language: "en";
  versionNumber: 1;
  expectedMinutes: number;
  validationStatus: "PILOT_RESEARCH_NOT_NORMED";
  normMode: "THEORETICAL_RANGE_PASS_THROUGH";
  scoringVersion: "pilot-response-score-v1";
  normVersion: "pilot-pass-through-v1";
  interpretationVersion: "pilot-response-interpretation-v1";
  reportVersion: "career-report-v3-pilot";
  careerFitAlgorithmKey: "weighted-scaled-raw";
  careerFitAlgorithmVersion: "1.0.0";
  counselorValidationNotice: string;
  employmentDecisionNotice: string | null;
  constructs: PilotConstruct[];
  items: PilotItem[];
  careerPaths: PilotCareerPath[];
}

interface ConstructMeta {
  name: string;
  description: string;
  reportSection: PilotReportSection;
  kind: PilotConstructKind;
}

interface PromptDefinition {
  text: string;
  reverse?: boolean;
}

interface ObjectiveDefinition {
  prompt: string;
  options: readonly [string, string, string, string];
  correctIndex: number;
}

const LIKERT_OPTIONS = [
  ["SD", "Strongly disagree"],
  ["D", "Disagree"],
  ["N", "Neither agree nor disagree"],
  ["A", "Agree"],
  ["SA", "Strongly agree"],
] as const;

const CONSTRUCT_META: Record<string, ConstructMeta> = {
  CURIOSITY: {
    name: "Curiosity and Openness",
    description: "Tendency to explore unfamiliar ideas, ask questions and seek understanding.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  ORGANIZATION: {
    name: "Organization and Planning",
    description: "Tendency to plan, structure tasks and keep track of commitments.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  COLLABORATION: {
    name: "Collaboration",
    description: "Tendency to listen, coordinate and contribute constructively with others.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  INITIATIVE: {
    name: "Initiative",
    description:
      "Tendency to begin useful action and take ownership without waiting for direction.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  ADAPTABILITY: {
    name: "Adaptability",
    description: "Tendency to adjust constructively when plans, demands or methods change.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  PERSISTENCE: {
    name: "Persistence",
    description: "Tendency to continue effort through difficulty, mistakes and slow progress.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  REALISTIC_INTEREST: {
    name: "Realistic Interest",
    description: "Interest in practical, hands-on, technical, physical or tool-based activities.",
    reportSection: "INTERESTS",
    kind: "SELF_REPORT",
  },
  INVESTIGATIVE_INTEREST: {
    name: "Investigative Interest",
    description: "Interest in analysis, science, evidence, research and solving complex questions.",
    reportSection: "INTERESTS",
    kind: "SELF_REPORT",
  },
  ARTISTIC_INTEREST: {
    name: "Artistic Interest",
    description: "Interest in creating, designing, expressing and generating original ideas.",
    reportSection: "INTERESTS",
    kind: "SELF_REPORT",
  },
  SOCIAL_INTEREST: {
    name: "Social Interest",
    description:
      "Interest in helping, teaching, supporting, guiding or working closely with people.",
    reportSection: "INTERESTS",
    kind: "SELF_REPORT",
  },
  ENTERPRISING_INTEREST: {
    name: "Enterprising Interest",
    description: "Interest in influencing, leading, presenting, selling or building initiatives.",
    reportSection: "INTERESTS",
    kind: "SELF_REPORT",
  },
  CONVENTIONAL_INTEREST: {
    name: "Conventional Interest",
    description:
      "Interest in accuracy, records, procedures, organizing information and orderly systems.",
    reportSection: "INTERESTS",
    kind: "SELF_REPORT",
  },
  ACHIEVEMENT_MOTIVATION: {
    name: "Achievement Motivation",
    description:
      "Drive to improve performance, meet challenging goals and produce high-quality work.",
    reportSection: "MOTIVATORS",
    kind: "SELF_REPORT",
  },
  AUTONOMY_MOTIVATION: {
    name: "Autonomy Motivation",
    description:
      "Preference for ownership, choice and independent judgment within appropriate boundaries.",
    reportSection: "MOTIVATORS",
    kind: "SELF_REPORT",
  },
  IMPACT_MOTIVATION: {
    name: "Impact Motivation",
    description:
      "Motivation to contribute to useful outcomes for other people, society or a community.",
    reportSection: "MOTIVATORS",
    kind: "SELF_REPORT",
  },
  SECURITY_MOTIVATION: {
    name: "Security and Stability Motivation",
    description:
      "Preference for predictable expectations, continuity and a dependable work or study environment.",
    reportSection: "MOTIVATORS",
    kind: "SELF_REPORT",
  },
  LEARNING_GROWTH_MOTIVATION: {
    name: "Learning and Growth Motivation",
    description: "Drive to develop new skills, seek feedback and expand capability over time.",
    reportSection: "MOTIVATORS",
    kind: "SELF_REPORT",
  },
  RECOGNITION_MOTIVATION: {
    name: "Recognition Motivation",
    description:
      "Value placed on visible accomplishment, appreciation and acknowledgement for contribution.",
    reportSection: "MOTIVATORS",
    kind: "SELF_REPORT",
  },
  STRUCTURED_LEARNING_PREFERENCE: {
    name: "Structured Learning Preference",
    description:
      "Preference for clear goals, examples, sequencing and explicit expectations while learning.",
    reportSection: "LEARNING_PROFILE",
    kind: "SELF_REPORT",
  },
  HANDS_ON_LEARNING_PREFERENCE: {
    name: "Hands-on Learning Preference",
    description:
      "Preference for learning through practice, application, demonstration and direct experience.",
    reportSection: "LEARNING_PROFILE",
    kind: "SELF_REPORT",
  },
  REFLECTIVE_LEARNING_PREFERENCE: {
    name: "Reflective Learning Preference",
    description: "Preference for time to review, think, connect ideas and learn from mistakes.",
    reportSection: "LEARNING_PROFILE",
    kind: "SELF_REPORT",
  },
  COLLABORATIVE_LEARNING_PREFERENCE: {
    name: "Collaborative Learning Preference",
    description:
      "Preference for discussion, explanation and shared problem solving while learning.",
    reportSection: "LEARNING_PROFILE",
    kind: "SELF_REPORT",
  },
  NUMERICAL_REASONING: {
    name: "Numerical Reasoning",
    description:
      "Performance on quantitative relationships, arithmetic and numerical problem solving in this battery.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "APTITUDE",
  },
  VERBAL_REASONING: {
    name: "Verbal Reasoning",
    description:
      "Performance on vocabulary, verbal relationships, comprehension and inference in this battery.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "APTITUDE",
  },
  LOGICAL_REASONING: {
    name: "Logical Reasoning",
    description:
      "Performance on patterns, rules, deduction and structured reasoning in this battery.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "APTITUDE",
  },
  DATA_INTERPRETATION: {
    name: "Data Interpretation",
    description:
      "Performance on reading and interpreting simple quantitative workplace information.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "APTITUDE",
  },
  DECISION_QUALITY: {
    name: "Decision Quality",
    description:
      "Performance on pilot scenarios requiring evidence gathering, prioritization and reasoned action.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "SITUATIONAL_JUDGMENT",
  },
  SITUATIONAL_JUDGMENT: {
    name: "Situational Judgment",
    description:
      "Performance on pilot workplace scenarios involving communication, responsibility and appropriate escalation.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "SITUATIONAL_JUDGMENT",
  },
  RELIABILITY: {
    name: "Reliability",
    description:
      "Self-reported tendency to be dependable, punctual and consistent with commitments.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  SAFETY_ORIENTATION: {
    name: "Safety Orientation",
    description:
      "Self-reported tendency to notice hazards, follow safe procedures and avoid unsafe shortcuts.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  SAFETY_JUDGMENT: {
    name: "Safety Judgment",
    description:
      "Performance on practical safety scenarios requiring hazard recognition and appropriate action.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "SITUATIONAL_JUDGMENT",
  },
  PRACTICAL_PROBLEM_SOLVING: {
    name: "Practical Problem Solving",
    description:
      "Self-reported tendency to diagnose practical problems and test workable solutions.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  TEAMWORK: {
    name: "Teamwork",
    description: "Self-reported tendency to coordinate tasks, communicate and support co-workers.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  ATTENTION_TO_DETAIL: {
    name: "Attention to Detail",
    description:
      "Self-reported tendency to check specifications, codes, quantities and finishing details.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  DETAIL_CHECKING_ACCURACY: {
    name: "Detail Checking Accuracy",
    description:
      "Performance on exact matching, quantity checking and specification-reading tasks in this battery.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "APTITUDE",
  },
  SERVICE_ORIENTATION: {
    name: "Service Orientation",
    description:
      "Self-reported tendency to understand needs and respond respectfully to customers or users.",
    reportSection: "INTERESTS",
    kind: "SELF_REPORT",
  },
  LEARNING_READINESS: {
    name: "Learning Readiness",
    description:
      "Self-reported willingness to learn procedures, accept coaching and update skills.",
    reportSection: "MOTIVATORS",
    kind: "SELF_REPORT",
  },
  WORK_PACE_STEADINESS: {
    name: "Work Pace Steadiness",
    description:
      "Self-reported tendency to maintain a consistent pace without sacrificing required checks.",
    reportSection: "PERSONALITY",
    kind: "SELF_REPORT",
  },
  PRACTICAL_NUMERACY: {
    name: "Practical Numeracy",
    description:
      "Performance on basic measurements, quantities, percentages and work-related arithmetic.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "APTITUDE",
  },
  MECHANICAL_SPATIAL_REASONING: {
    name: "Mechanical and Spatial Reasoning",
    description:
      "Performance on simple mechanical relationships, direction and spatial reasoning in this battery.",
    reportSection: "APTITUDE_AND_ABILITIES",
    kind: "APTITUDE",
  },
};

const STUDENT_PROMPTS: Record<string, readonly PromptDefinition[]> = {
  CURIOSITY: [
    { text: "I enjoy finding out how unfamiliar things work." },
    { text: "I ask questions when I want to understand something better." },
    { text: "I usually avoid exploring topics that are new to me.", reverse: true },
    { text: "I like connecting ideas from different subjects." },
  ],
  ORGANIZATION: [
    { text: "I make a plan before starting a large task." },
    { text: "I keep track of deadlines and important schoolwork." },
    { text: "I often begin work without thinking about what I will need.", reverse: true },
    { text: "I arrange my work so I can finish it on time." },
  ],
  COLLABORATION: [
    { text: "I listen to other people's ideas during group work." },
    { text: "I can share responsibility with teammates." },
    { text: "I prefer that group members simply follow my way.", reverse: true },
    { text: "I help a group move forward when people disagree." },
  ],
  INITIATIVE: [
    { text: "I volunteer to start useful tasks without being told." },
    { text: "I speak up when I have an idea that could improve a project." },
    { text: "I usually wait for someone else to take the first step.", reverse: true },
    { text: "I enjoy taking responsibility for making something happen." },
  ],
  ADAPTABILITY: [
    { text: "I can adjust when a plan changes unexpectedly." },
    { text: "I try a different method when my first approach does not work." },
    { text: "Sudden changes make it hard for me to continue.", reverse: true },
    { text: "I can learn new routines without much difficulty." },
  ],
  PERSISTENCE: [
    { text: "I keep working on difficult tasks even when progress is slow." },
    { text: "I try again after making a mistake." },
    { text: "I give up quickly when a task becomes frustrating.", reverse: true },
    { text: "I can stay focused until I reach an important goal." },
  ],
  REALISTIC_INTEREST: [
    { text: "I enjoy building, fixing or assembling things." },
    { text: "I like activities that involve tools, equipment or materials." },
    { text: "I enjoy learning by doing something practical with my hands." },
    { text: "I would rather avoid practical tasks and only read about them.", reverse: true },
  ],
  INVESTIGATIVE_INTEREST: [
    { text: "I enjoy science experiments, puzzles or investigations." },
    { text: "I like finding evidence before accepting an explanation." },
    { text: "I enjoy asking why something happens and testing possible answers." },
    {
      text: "Once I know an answer, I rarely want to understand how it was reached.",
      reverse: true,
    },
  ],
  ARTISTIC_INTEREST: [
    { text: "I enjoy creating stories, designs, music, images or original ideas." },
    { text: "I like imagining several different ways to express the same idea." },
    { text: "I notice how presentation, colour, words or layout affect a message." },
    { text: "I prefer tasks where there is only one fixed way to do everything.", reverse: true },
  ],
  SOCIAL_INTEREST: [
    { text: "I enjoy helping someone understand a difficult topic." },
    { text: "I like listening when another person needs support." },
    { text: "I enjoy activities where people learn or improve together." },
    { text: "I would rather avoid work that involves other people's concerns.", reverse: true },
  ],
  ENTERPRISING_INTEREST: [
    { text: "I enjoy presenting an idea and getting others interested in it." },
    { text: "I like organizing events, teams or small projects." },
    { text: "I enjoy taking a lead when a group needs direction." },
    { text: "I avoid situations where I may need to influence a decision.", reverse: true },
  ],
  CONVENTIONAL_INTEREST: [
    { text: "I enjoy organizing information so it is easy to find." },
    { text: "I like checking details for accuracy." },
    { text: "I am comfortable following a clear procedure when accuracy matters." },
    { text: "I dislike tasks that involve records, lists or careful checking.", reverse: true },
  ],
  ACHIEVEMENT_MOTIVATION: [
    { text: "I feel satisfied when I improve my performance." },
    { text: "Challenging goals can motivate me to work harder." },
    { text: "I try to produce work I can be proud of." },
    { text: "It does not matter much to me whether I improve at a task.", reverse: true },
  ],
  AUTONOMY_MOTIVATION: [
    { text: "I like having some choice in how I complete a task." },
    { text: "I enjoy taking ownership of decisions that are appropriate for me." },
    { text: "I prefer every small step to be decided for me.", reverse: true },
    { text: "I am motivated when I can use my own judgment after understanding the goal." },
  ],
  IMPACT_MOTIVATION: [
    { text: "I am motivated when my work is useful to other people." },
    { text: "I like contributing to something that improves a group or community." },
    { text: "I care about the positive effect of what I do." },
    { text: "Whether my work helps anyone else is not important to me.", reverse: true },
  ],
  SECURITY_MOTIVATION: [
    { text: "I value knowing what is expected of me." },
    { text: "A stable and dependable path is important to me." },
    { text: "I am comfortable when routines and responsibilities are reasonably clear." },
    { text: "I prefer constant uncertainty even when there is no clear benefit.", reverse: true },
  ],
  LEARNING_GROWTH_MOTIVATION: [
    { text: "Learning a useful new skill gives me energy." },
    { text: "I value feedback that helps me improve." },
    { text: "I look for chances to become better at things that matter to me." },
    { text: "I avoid learning new skills unless I am forced to.", reverse: true },
  ],
  RECOGNITION_MOTIVATION: [
    { text: "I appreciate it when good work is noticed." },
    { text: "Visible achievement can motivate me to put in extra effort." },
    { text: "I like knowing that my contribution is valued." },
    { text: "Recognition for strong work never matters to me.", reverse: true },
  ],
  STRUCTURED_LEARNING_PREFERENCE: [
    { text: "I learn well when a topic is explained in a clear sequence." },
    { text: "Examples and clear expectations help me begin a new topic." },
    { text: "A checklist or step-by-step plan can help me organize learning." },
    { text: "I prefer learning with no clear goal or structure at all.", reverse: true },
  ],
  HANDS_ON_LEARNING_PREFERENCE: [
    { text: "I understand ideas better after I try them in practice." },
    { text: "Demonstrations and experiments help me make sense of new concepts." },
    { text: "I like applying what I learn to a task, model or project." },
    { text: "Practising a skill usually adds little to my understanding.", reverse: true },
  ],
  REFLECTIVE_LEARNING_PREFERENCE: [
    { text: "I like a little time to think before giving an answer." },
    { text: "Reviewing mistakes helps me learn." },
    { text: "I often understand a topic better after I summarize it in my own words." },
    { text: "I rarely look back at what I could learn from an error.", reverse: true },
  ],
  COLLABORATIVE_LEARNING_PREFERENCE: [
    { text: "Discussing a topic can help me notice ideas I missed." },
    { text: "Explaining something to another student helps me test my understanding." },
    { text: "I can learn from comparing different ways to solve the same problem." },
    { text: "I avoid asking or answering questions during shared learning.", reverse: true },
  ],
};

const ADULT_PROMPTS: Record<string, readonly PromptDefinition[]> = {
  CURIOSITY: [
    { text: "I actively explore unfamiliar ideas that may improve my work or career." },
    { text: "I ask questions until I understand the reasoning behind an issue." },
    { text: "I prefer not to investigate topics outside what I already know.", reverse: true },
    { text: "I connect information from different areas when solving a problem." },
  ],
  ORGANIZATION: [
    { text: "I break larger responsibilities into planned steps." },
    { text: "I keep track of deadlines, commitments and follow-up actions." },
    { text: "I often start important work without deciding what is needed.", reverse: true },
    { text: "I organize work so priorities are visible and manageable." },
  ],
  COLLABORATION: [
    { text: "I listen carefully before responding to a colleague's viewpoint." },
    { text: "I share information that helps a team complete its work." },
    {
      text: "When working with others, I expect my approach to be followed without discussion.",
      reverse: true,
    },
    { text: "I can work through disagreement without losing sight of the shared goal." },
  ],
  INITIATIVE: [
    { text: "I begin useful work without waiting for unnecessary prompting." },
    { text: "I raise practical improvement ideas when I see an opportunity." },
    { text: "I usually wait for someone else to act first, even when I can help.", reverse: true },
    { text: "I am comfortable taking ownership of an appropriate next step." },
  ],
  ADAPTABILITY: [
    { text: "I adjust my approach when priorities or circumstances change." },
    { text: "If one method fails, I can test a different method." },
    { text: "Unexpected changes often prevent me from moving forward.", reverse: true },
    { text: "I can learn a new process when the situation requires it." },
  ],
  PERSISTENCE: [
    { text: "I stay engaged with difficult work when progress is slower than expected." },
    { text: "I recover and try again after a setback." },
    { text: "I tend to stop when a task becomes frustrating.", reverse: true },
    { text: "I can sustain effort on goals that matter over time." },
  ],
  REALISTIC_INTEREST: [
    { text: "I enjoy work that produces a visible or practical result." },
    { text: "I like using equipment, tools, systems or physical processes." },
    { text: "I enjoy troubleshooting something concrete that is not working." },
    {
      text: "I prefer to avoid practical tasks even when they are central to the work.",
      reverse: true,
    },
  ],
  INVESTIGATIVE_INTEREST: [
    { text: "I enjoy analyzing evidence before reaching a conclusion." },
    { text: "I am interested in research, diagnosis or complex problem solving." },
    { text: "I like understanding why a system or result behaves as it does." },
    {
      text: "I am satisfied with an answer even when the reasoning behind it is unclear.",
      reverse: true,
    },
  ],
  ARTISTIC_INTEREST: [
    { text: "I enjoy creating original content, designs, experiences or ways of communicating." },
    { text: "I like work that allows thoughtful experimentation with ideas or presentation." },
    { text: "I notice how wording, layout, visuals or style influence an audience." },
    { text: "I prefer every task to have only one prescribed way of expression.", reverse: true },
  ],
  SOCIAL_INTEREST: [
    { text: "I enjoy helping another person learn, improve or solve a problem." },
    { text: "I find meaning in roles that involve understanding people's needs." },
    { text: "I like facilitating cooperation or development in others." },
    {
      text: "I prefer work that never requires attention to another person's concerns.",
      reverse: true,
    },
  ],
  ENTERPRISING_INTEREST: [
    { text: "I enjoy persuading others when I believe an idea has value." },
    { text: "I am interested in building initiatives, opportunities or commercial outcomes." },
    { text: "I like taking the lead in moving a proposal toward action." },
    { text: "I avoid situations where I may need to influence stakeholders.", reverse: true },
  ],
  CONVENTIONAL_INTEREST: [
    { text: "I enjoy organizing information, records or processes accurately." },
    { text: "I like work where careful checking prevents avoidable errors." },
    { text: "I am comfortable using clear procedures when consistency matters." },
    {
      text: "Detailed records and systematic follow-through strongly frustrate me.",
      reverse: true,
    },
  ],
  ACHIEVEMENT_MOTIVATION: [
    { text: "I am motivated by goals that require meaningful effort." },
    { text: "I monitor whether my performance is improving." },
    { text: "I set a quality standard for work that matters." },
    { text: "Improving my performance is rarely important to me.", reverse: true },
  ],
  AUTONOMY_MOTIVATION: [
    { text: "I am motivated when I have appropriate discretion in how I deliver an outcome." },
    { text: "I value ownership of decisions within my responsibility." },
    { text: "I prefer every minor work decision to be made for me.", reverse: true },
    { text: "I like being trusted to use judgment after expectations are clear." },
  ],
  IMPACT_MOTIVATION: [
    { text: "I am motivated when my work creates a useful outcome for others." },
    { text: "I value contributing to an organization, customer or community in a meaningful way." },
    { text: "The broader usefulness of my work matters to me." },
    { text: "I am not concerned whether my work benefits anyone beyond myself.", reverse: true },
  ],
  SECURITY_MOTIVATION: [
    { text: "I value reasonable stability in responsibilities and working conditions." },
    { text: "A dependable path and clear expectations matter to me." },
    { text: "I prefer knowing the basic boundaries within which I am expected to perform." },
    {
      text: "I prefer constant uncertainty even when it adds no useful opportunity.",
      reverse: true,
    },
  ],
  LEARNING_GROWTH_MOTIVATION: [
    { text: "I seek opportunities to build capabilities that will remain useful." },
    { text: "Constructive feedback motivates me to improve." },
    { text: "I am willing to invest effort in learning a better way to work." },
    {
      text: "I avoid learning new skills unless there is absolutely no alternative.",
      reverse: true,
    },
  ],
  RECOGNITION_MOTIVATION: [
    { text: "Acknowledgement for strong contribution can motivate me." },
    { text: "I value knowing that good work is visible and appreciated." },
    { text: "Recognition of achievement can increase my sense of progress." },
    { text: "Being recognized for strong work never matters to me.", reverse: true },
  ],
  STRUCTURED_LEARNING_PREFERENCE: [
    { text: "Clear objectives and examples help me learn a new capability efficiently." },
    { text: "I prefer learning material to have a logical sequence." },
    { text: "A checklist or framework helps me organize unfamiliar material." },
    { text: "I learn best when there is no clear purpose or structure at all.", reverse: true },
  ],
  HANDS_ON_LEARNING_PREFERENCE: [
    { text: "I understand a new method better after practising it." },
    { text: "A demonstration helps me connect theory to action." },
    { text: "I like applying new knowledge to a realistic task or project." },
    { text: "Practice rarely adds to my understanding of a new skill.", reverse: true },
  ],
  REFLECTIVE_LEARNING_PREFERENCE: [
    { text: "I learn from reviewing what worked and what did not." },
    { text: "I value time to think through a complex issue before deciding." },
    { text: "Summarizing a new idea in my own words helps me retain it." },
    { text: "I rarely reflect on mistakes once a task is finished.", reverse: true },
  ],
  COLLABORATIVE_LEARNING_PREFERENCE: [
    { text: "Discussing a problem with others can reveal useful perspectives." },
    { text: "Explaining an idea to someone else helps me test my understanding." },
    { text: "I can learn from comparing different approaches to the same problem." },
    {
      text: "I avoid learning conversations even when another viewpoint could help.",
      reverse: true,
    },
  ],
};

const SKILLED_PROMPTS: Record<string, readonly PromptDefinition[]> = {
  RELIABILITY: [
    { text: "I arrive prepared for work or training at the agreed time." },
    { text: "If I commit to a task, I make sure it is completed or properly handed over." },
    { text: "I keep others informed when a delay could affect the job." },
    { text: "I sometimes leave assigned work unfinished without telling anyone.", reverse: true },
    { text: "People can usually depend on me to do what I agreed to do." },
  ],
  SAFETY_ORIENTATION: [
    { text: "I check for hazards before starting unfamiliar work." },
    { text: "I use required protective equipment even when the task looks simple." },
    { text: "I stop and ask when I am unsure whether a method is safe." },
    { text: "I am willing to skip a safety step to save a little time.", reverse: true },
    { text: "I report unsafe conditions that could harm someone." },
  ],
  PRACTICAL_PROBLEM_SOLVING: [
    { text: "When something stops working, I check likely causes one by one." },
    {
      text: "I compare the result with the required specification before deciding the job is complete.",
    },
    { text: "I can try another safe method when the first method does not solve a problem." },
    {
      text: "I usually guess at a repair without checking what caused the problem.",
      reverse: true,
    },
    { text: "I like finding a practical reason for why a fault occurred." },
  ],
  TEAMWORK: [
    { text: "I coordinate my part of a job with the people working around me." },
    { text: "I listen when a co-worker points out a problem I may have missed." },
    { text: "I share important job information rather than keeping it to myself." },
    { text: "I prefer to ignore team instructions when I think my way is faster.", reverse: true },
    { text: "I can ask for help when a task requires another person's support." },
  ],
  ATTENTION_TO_DETAIL: [
    { text: "I check measurements or quantities before finalizing work." },
    { text: "I notice when a code, label or specification does not match." },
    { text: "I inspect finishing details before saying a task is complete." },
    { text: "Small differences in measurements are not worth checking.", reverse: true },
    { text: "I recheck critical details when an error could cause rework or risk." },
  ],
  ADAPTABILITY: [
    { text: "I can adjust when the work sequence changes." },
    { text: "I can learn to use a different approved tool or process." },
    { text: "I stay useful when a job requires me to change my usual approach." },
    { text: "A change in routine usually stops me from working effectively.", reverse: true },
    { text: "I can follow updated instructions after they are explained." },
  ],
  SERVICE_ORIENTATION: [
    { text: "I listen carefully before deciding what a customer or user needs." },
    { text: "I explain delays or limitations respectfully." },
    { text: "I try to leave the work area and customer interaction in a professional condition." },
    {
      text: "It does not matter how I speak to a customer if the technical work is done.",
      reverse: true,
    },
    { text: "I confirm that the requested work has been understood before starting." },
  ],
  LEARNING_READINESS: [
    { text: "I am willing to practise a new skill until I can do it correctly." },
    { text: "I can accept coaching when someone shows me a safer or better method." },
    { text: "I ask questions when I do not understand a new procedure." },
    { text: "Once I know one method, I do not want to learn any updated method.", reverse: true },
    { text: "I am interested in training that can improve my job options." },
  ],
  REALISTIC_INTEREST: [
    { text: "I enjoy work where I can see a practical result at the end." },
    { text: "I like using tools, machines, materials or equipment." },
    { text: "I enjoy diagnosing or fixing a physical problem." },
    { text: "I prefer to avoid any work that involves practical tasks.", reverse: true },
    { text: "I am interested in learning a trade or technical skill through practice." },
  ],
  WORK_PACE_STEADINESS: [
    { text: "I can keep a steady pace during repetitive work." },
    { text: "I try to balance speed with the required quality checks." },
    { text: "I can continue working carefully even late in a long task." },
    { text: "When I am in a hurry, I stop checking my work.", reverse: true },
    { text: "I can follow a production or service rhythm without becoming careless." },
  ],
};

const SCHOOL_APTITUDE: Record<string, readonly ObjectiveDefinition[]> = {
  NUMERICAL_REASONING: [
    { prompt: "What is 15% of 240?", options: ["24", "30", "36", "40"], correctIndex: 2 },
    {
      prompt:
        "A class has boys and girls in the ratio 3:5. If there are 64 students, how many are boys?",
      options: ["18", "24", "32", "40"],
      correctIndex: 1,
    },
    {
      prompt: "What number comes next: 2, 6, 12, 20, ?",
      options: ["26", "28", "30", "32"],
      correctIndex: 2,
    },
    {
      prompt: "What is the average of 12, 18, 20 and 10?",
      options: ["14", "15", "16", "17"],
      correctIndex: 1,
    },
    {
      prompt: "A vehicle travels 180 km in 3 hours at a steady speed. What is its average speed?",
      options: ["45 km/h", "50 km/h", "60 km/h", "90 km/h"],
      correctIndex: 2,
    },
    {
      prompt: "An item marked Rs 1500 is sold at a 20% discount. What is the sale price?",
      options: ["Rs 1050", "Rs 1100", "Rs 1200", "Rs 1300"],
      correctIndex: 2,
    },
  ],
  VERBAL_REASONING: [
    {
      prompt: "Which word is closest in meaning to 'concise'?",
      options: ["Brief", "Doubtful", "Distant", "Polite"],
      correctIndex: 0,
    },
    {
      prompt: "Which word is opposite in meaning to 'scarce'?",
      options: ["Rare", "Limited", "Abundant", "Costly"],
      correctIndex: 2,
    },
    {
      prompt: "Book is to reading as fork is to:",
      options: ["Drawing", "Eating", "Writing", "Measuring"],
      correctIndex: 1,
    },
    {
      prompt:
        "A school found that students who practised ten minutes daily remembered more vocabulary after four weeks than students who practised only once a week. What is the main idea?",
      options: [
        "Daily short practice was associated with better vocabulary recall",
        "Vocabulary cannot be learned weekly",
        "Four weeks is too short for learning",
        "All students should study the same way",
      ],
      correctIndex: 0,
    },
    {
      prompt:
        "Meera submitted her project two days before the deadline after checking it against the instructions. Which statement is best supported?",
      options: [
        "Meera ignored the deadline",
        "Meera reviewed requirements before submitting",
        "Meera received the highest grade",
        "Meera worked alone",
      ],
      correctIndex: 1,
    },
    {
      prompt: "Which word is closest in meaning to 'evaluate'?",
      options: ["Ignore", "Assess", "Repeat", "Hide"],
      correctIndex: 1,
    },
  ],
  LOGICAL_REASONING: [
    {
      prompt: "What letter comes next: A, C, F, J, ?",
      options: ["M", "N", "O", "P"],
      correctIndex: 2,
    },
    {
      prompt:
        "All squares are rectangles. No circles are rectangles. Which statement must be true?",
      options: [
        "No square is a circle",
        "All rectangles are squares",
        "Some circles are squares",
        "All circles are rectangles",
      ],
      correctIndex: 0,
    },
    {
      prompt:
        "If each letter is moved one step forward in the alphabet, CAT becomes DBU. What does DOG become?",
      options: ["EPH", "ENH", "FPH", "EOG"],
      correctIndex: 0,
    },
    {
      prompt:
        "Asha must present before Bharat, and Bharat must present before Charu. Which order satisfies both rules?",
      options: [
        "Bharat, Asha, Charu",
        "Charu, Bharat, Asha",
        "Asha, Bharat, Charu",
        "Asha, Charu, Bharat",
      ],
      correctIndex: 2,
    },
    {
      prompt:
        "A box can hold 6 rows of 4 bottles. If 5 boxes are completely filled, how many bottles are there?",
      options: ["24", "60", "100", "120"],
      correctIndex: 3,
    },
    {
      prompt: "What number comes next: 81, 27, 9, 3, ?",
      options: ["0", "1", "2", "6"],
      correctIndex: 1,
    },
  ],
};

const COLLEGE_APTITUDE: Record<string, readonly ObjectiveDefinition[]> = {
  NUMERICAL_REASONING: [
    {
      prompt: "Revenue of Rs 12,00,000 increases by 12.5%. What is the new revenue?",
      options: ["Rs 12,75,000", "Rs 13,20,000", "Rs 13,50,000", "Rs 14,00,000"],
      correctIndex: 2,
    },
    {
      prompt:
        "Forty students average 70 marks and sixty students average 80 marks. What is the combined average?",
      options: ["74", "75", "76", "78"],
      correctIndex: 2,
    },
    {
      prompt:
        "A value rises by 10% and then falls by 10%. If it started at 100, what is the final value?",
      options: ["90", "99", "100", "101"],
      correctIndex: 1,
    },
    {
      prompt:
        "A bag contains 3 red and 2 blue tokens. One token is selected at random. What is the probability it is red?",
      options: ["2/5", "1/2", "3/5", "3/2"],
      correctIndex: 2,
    },
    {
      prompt:
        "Six people can complete a task in 15 days at the same constant rate. How many days would 10 people require?",
      options: ["6", "9", "10", "12"],
      correctIndex: 1,
    },
    {
      prompt: "Forty-five of 180 surveyed students chose option A. What percentage chose option A?",
      options: ["20%", "25%", "30%", "40%"],
      correctIndex: 1,
    },
  ],
  VERBAL_REASONING: [
    {
      prompt: "Which word is closest in meaning to 'mitigate'?",
      options: ["Increase", "Reduce", "Measure", "Predict"],
      correctIndex: 1,
    },
    {
      prompt:
        "A report states: 'Customer complaints fell after response time was reduced, but the data do not show whether response time was the only cause.' Which conclusion is justified?",
      options: [
        "Faster response definitely caused all improvement",
        "Complaints did not change",
        "The improvement coincided with faster response, but causation is not established",
        "Response time is irrelevant",
      ],
      correctIndex: 2,
    },
    {
      prompt: "Which sentence is the clearest professional wording?",
      options: [
        "Due to the fact that we are late, therefore delay",
        "The delivery is delayed by two days because the supplier shipment arrived late",
        "Delivery late supplier because two days",
        "There is a delay and stuff happened",
      ],
      correctIndex: 1,
    },
    {
      prompt: "Which word is closest in meaning to 'ambiguous'?",
      options: ["Unclear", "Accurate", "Immediate", "Generous"],
      correctIndex: 0,
    },
    {
      prompt:
        "A university extends library hours during exams after students report difficulty finding quiet study space. What is the most reasonable inference?",
      options: [
        "The university is responding to a reported study-space need",
        "Every student studies at night",
        "The library was previously closed all day",
        "Exam results will certainly improve",
      ],
      correctIndex: 0,
    },
    {
      prompt: "Blueprint is to building as recipe is to:",
      options: ["Ingredient", "Kitchen", "Meal", "Chef"],
      correctIndex: 2,
    },
  ],
  LOGICAL_REASONING: [
    {
      prompt: "What number comes next: 3, 7, 15, 31, ?",
      options: ["47", "55", "63", "65"],
      correctIndex: 2,
    },
    {
      prompt: "If P implies Q and Q is false, what follows logically?",
      options: [
        "P must be false",
        "P must be true",
        "Q must be true",
        "Nothing can be said about P",
      ],
      correctIndex: 0,
    },
    {
      prompt:
        "All analysts in Team X know SQL. Kavya is an analyst in Team X. Which conclusion follows?",
      options: [
        "Kavya knows SQL",
        "Everyone who knows SQL is in Team X",
        "Kavya manages Team X",
        "No conclusion is possible",
      ],
      correctIndex: 0,
    },
    {
      prompt:
        "Four tasks W, X, Y and Z must be done once. W is before X. Y is after X. Z is before W. Which order is valid?",
      options: ["W, Z, X, Y", "Z, W, X, Y", "Z, X, W, Y", "W, X, Z, Y"],
      correctIndex: 1,
    },
    {
      prompt: "A code replaces each number n with 2n + 1. What is the coded value of 8?",
      options: ["9", "16", "17", "18"],
      correctIndex: 2,
    },
    {
      prompt:
        "Three statements are given: Some designers are researchers. All researchers are readers. Which conclusion must be true?",
      options: [
        "Some designers are readers",
        "All designers are readers",
        "No reader is a designer",
        "All readers are researchers",
      ],
      correctIndex: 0,
    },
  ],
};

const PROFESSIONAL_APTITUDE: Record<string, readonly ObjectiveDefinition[]> = {
  DATA_INTERPRETATION: [
    {
      prompt: "Monthly sales rise from 120 units to 150 units. What is the percentage increase?",
      options: ["20%", "25%", "30%", "35%"],
      correctIndex: 1,
    },
    {
      prompt: "A project has 80 tasks and 52 are complete. What percentage is complete?",
      options: ["60%", "65%", "70%", "75%"],
      correctIndex: 1,
    },
    {
      prompt:
        "Three defective units are found in a sample of 120. What is the observed defect rate?",
      options: ["1.5%", "2.0%", "2.5%", "3.0%"],
      correctIndex: 2,
    },
    {
      prompt:
        "A budget is Rs 2,50,000 and Rs 1,75,000 has been spent. What percentage of the budget has been spent?",
      options: ["60%", "65%", "70%", "75%"],
      correctIndex: 2,
    },
  ],
  VERBAL_REASONING: [
    {
      prompt:
        "A client writes: 'Please confirm whether the revised delivery date includes testing.' What is the most direct response?",
      options: [
        "We are working on many things",
        "Yes. The revised date includes completion of testing",
        "Testing is a technical matter",
        "We will reply sometime",
      ],
      correctIndex: 1,
    },
    {
      prompt: "Which word is closest in meaning to 'feasible'?",
      options: ["Practical", "Hidden", "Delayed", "Expensive"],
      correctIndex: 0,
    },
    {
      prompt:
        "A memo says a policy will be reviewed after a three-month pilot. Which statement is supported?",
      options: [
        "The policy is permanent",
        "The pilot will last three months before review",
        "The policy will certainly be cancelled",
        "The review has already happened",
      ],
      correctIndex: 1,
    },
    {
      prompt: "Which sentence best separates fact from interpretation?",
      options: [
        "The team is careless because two reports were late",
        "Two reports were submitted after the stated deadline; the cause has not yet been established",
        "Late reports prove poor leadership",
        "Everyone knows the team is unreliable",
      ],
      correctIndex: 1,
    },
  ],
  DECISION_QUALITY: [
    {
      prompt:
        "A key metric drops suddenly and the source data may be incomplete. What is the best first step?",
      options: [
        "Announce a major strategy change",
        "Verify data quality and define the size of the change",
        "Ignore the metric",
        "Blame the reporting team",
      ],
      correctIndex: 1,
    },
    {
      prompt:
        "Two important tasks have the same deadline and you cannot complete both alone. What is the best response?",
      options: [
        "Stay silent and miss one",
        "Prioritize by impact and urgency, then communicate the trade-off early",
        "Choose the easier task without telling anyone",
        "Wait until the deadline to ask for help",
      ],
      correctIndex: 1,
    },
    {
      prompt:
        "A proposed change may improve speed but could create a compliance risk. What should happen before implementation?",
      options: [
        "Implement immediately",
        "Assess the compliance requirement and obtain the necessary review",
        "Hide the risk",
        "Assume speed is more important",
      ],
      correctIndex: 1,
    },
    {
      prompt:
        "A customer requests a feature, but the problem they are trying to solve is unclear. What is the best next step?",
      options: [
        "Build the requested feature immediately",
        "Clarify the underlying need, constraints and success criteria",
        "Reject the request",
        "Ask another customer to decide",
      ],
      correctIndex: 1,
    },
  ],
  SITUATIONAL_JUDGMENT: [
    {
      prompt:
        "A colleague makes a mistake that may affect a customer. What is the most appropriate response?",
      options: [
        "Hide it to protect the colleague",
        "Address the impact promptly, involve the colleague and escalate if required",
        "Publicly criticize the colleague",
        "Wait to see if the customer notices",
      ],
      correctIndex: 1,
    },
    {
      prompt: "You receive unclear instructions for a high-impact task. What is the best response?",
      options: [
        "Guess and proceed",
        "Clarify the expected outcome, constraints and deadline before proceeding",
        "Do nothing and say nothing",
        "Delegate it without context",
      ],
      correctIndex: 1,
    },
    {
      prompt:
        "A team discussion becomes tense and two members stop listening to each other. What is the best contribution?",
      options: [
        "Choose a side immediately",
        "Restate the shared objective and bring the discussion back to evidence and options",
        "Leave without comment",
        "Increase the argument",
      ],
      correctIndex: 1,
    },
    {
      prompt:
        "You discover information that suggests an agreed plan may no longer work. What is the best response?",
      options: [
        "Keep quiet because the plan was already approved",
        "Share the evidence promptly and propose a review of the plan",
        "Delete the information",
        "Continue until failure is certain",
      ],
      correctIndex: 1,
    },
  ],
};

const SKILLED_APTITUDE: Record<string, readonly ObjectiveDefinition[]> = {
  PRACTICAL_NUMERACY: [
    {
      prompt: "A pipe is 2.4 metres long. How many centimetres is that?",
      options: ["24 cm", "240 cm", "2400 cm", "204 cm"],
      correctIndex: 1,
    },
    {
      prompt:
        "A job needs 12 identical bolts for each unit. How many bolts are needed for 8 units?",
      options: ["20", "84", "96", "108"],
      correctIndex: 2,
    },
    {
      prompt: "A material sheet costs Rs 800 and 5% is expected as wastage. What is 5% of Rs 800?",
      options: ["Rs 20", "Rs 40", "Rs 50", "Rs 80"],
      correctIndex: 1,
    },
    {
      prompt: "A task starts at 9:20 and takes 1 hour 35 minutes. When does it finish?",
      options: ["10:45", "10:55", "11:05", "11:15"],
      correctIndex: 1,
    },
    {
      prompt: "A container holds 25 litres. Four full containers hold how many litres?",
      options: ["50", "75", "100", "125"],
      correctIndex: 2,
    },
  ],
  MECHANICAL_SPATIAL_REASONING: [
    {
      prompt:
        "Two gears are directly meshed. If the first gear turns clockwise, the second gear turns:",
      options: ["Clockwise", "Counter-clockwise", "Upward", "It cannot turn"],
      correctIndex: 1,
    },
    {
      prompt: "On a simple lever, moving the load closer to the pivot generally makes the load:",
      options: ["Harder to lift", "Easier to lift", "Heavier", "Hotter"],
      correctIndex: 1,
    },
    {
      prompt:
        "A simple circuit has a battery, wires and a lamp. If one wire is disconnected, the lamp will usually:",
      options: ["Become brighter", "Stay the same", "Go off", "Change colour"],
      correctIndex: 2,
    },
    {
      prompt:
        "You face north and turn right, then turn right again. Which direction are you facing?",
      options: ["North", "East", "South", "West"],
      correctIndex: 2,
    },
    {
      prompt: "A longer wrench is often useful for loosening a tight bolt because it can provide:",
      options: [
        "More turning effect for the same force",
        "Less grip",
        "More electricity",
        "A smaller bolt",
      ],
      correctIndex: 0,
    },
  ],
  SAFETY_JUDGMENT: [
    {
      prompt:
        "Before working on electrical equipment that can be isolated, the safest first action is to:",
      options: [
        "Touch the wire quickly",
        "Follow the approved isolation and lockout procedure",
        "Work faster",
        "Remove protective equipment",
      ],
      correctIndex: 1,
    },
    {
      prompt: "You notice a damaged power cable on a tool. What should you do?",
      options: [
        "Use it carefully",
        "Tape it only if no one is watching",
        "Remove it from use and report it for proper action",
        "Ignore it",
      ],
      correctIndex: 2,
    },
    {
      prompt: "A liquid spill creates a slipping hazard in a walkway. What is the best response?",
      options: [
        "Walk around it and leave it",
        "Control access and arrange prompt safe clean-up",
        "Cover it with paper",
        "Wait until the end of the shift",
      ],
      correctIndex: 1,
    },
    {
      prompt: "A ladder is unstable on the floor. What should happen before climbing?",
      options: [
        "Ask someone to watch",
        "Stabilize or replace it using the approved safe setup",
        "Climb quickly",
        "Carry a heavier load",
      ],
      correctIndex: 1,
    },
    {
      prompt:
        "Required eye protection feels inconvenient for a cutting task. What is the appropriate action?",
      options: [
        "Skip it for a short task",
        "Use the required protection correctly",
        "Close one eye",
        "Ask someone else to take the risk",
      ],
      correctIndex: 1,
    },
  ],
  DETAIL_CHECKING_ACCURACY: [
    {
      prompt: "Which code exactly matches AB7-4219-K?",
      options: ["AB7-4219-K", "AB7-4129-K", "AB7-4219-X", "A87-4219-K"],
      correctIndex: 0,
    },
    {
      prompt: "A drawing requires 16 mm bolts. Which label matches the requirement?",
      options: ["12 mm", "14 mm", "16 mm", "18 mm"],
      correctIndex: 2,
    },
    {
      prompt: "Which sequence is identical to 5-8-3-1-9?",
      options: ["5-8-3-1-9", "5-8-3-9-1", "5-3-8-1-9", "8-5-3-1-9"],
      correctIndex: 0,
    },
    {
      prompt:
        "A checklist requires 4 washers per assembly. For 7 assemblies, how many washers should be prepared?",
      options: ["11", "21", "28", "32"],
      correctIndex: 2,
    },
    {
      prompt: "A label reads MAX 25 kg. Which load is within the stated maximum?",
      options: ["26 kg", "25 kg", "30 kg", "35 kg"],
      correctIndex: 1,
    },
  ],
};

const STUDENT_PATHS = [
  {
    code: "ENGINEERING_TECH",
    name: "Engineering and Technology",
    clusterCode: "STEM_TECH",
    clusterName: "STEM and Technology",
    description:
      "Engineering, applied technology, electronics, automation and related technical pathways.",
    factors: [
      ["INVESTIGATIVE_INTEREST", 3],
      ["REALISTIC_INTEREST", 2],
      ["CURIOSITY", 2],
      ["NUMERICAL_REASONING", 2],
      ["LOGICAL_REASONING", 3],
      ["PERSISTENCE", 1],
    ],
  },
  {
    code: "DATA_COMPUTING",
    name: "Data, Computing and AI",
    clusterCode: "STEM_TECH",
    clusterName: "STEM and Technology",
    description: "Computing, software, data, analytics and AI-oriented exploration.",
    factors: [
      ["INVESTIGATIVE_INTEREST", 3],
      ["CURIOSITY", 2],
      ["NUMERICAL_REASONING", 3],
      ["LOGICAL_REASONING", 3],
      ["CONVENTIONAL_INTEREST", 1],
    ],
  },
  {
    code: "HEALTH_LIFE_SCIENCE",
    name: "Health and Life Sciences",
    clusterCode: "HEALTH_SCIENCE",
    clusterName: "Health and Life Sciences",
    description: "Medicine, allied health, life science and health-support pathways.",
    factors: [
      ["INVESTIGATIVE_INTEREST", 2],
      ["SOCIAL_INTEREST", 2],
      ["ACHIEVEMENT_MOTIVATION", 2],
      ["VERBAL_REASONING", 1],
      ["PERSISTENCE", 2],
    ],
  },
  {
    code: "BUSINESS_ENTREPRENEURSHIP",
    name: "Business and Entrepreneurship",
    clusterCode: "BUSINESS",
    clusterName: "Business and Enterprise",
    description: "Business, management, entrepreneurship, sales and enterprise-building pathways.",
    factors: [
      ["ENTERPRISING_INTEREST", 3],
      ["INITIATIVE", 2],
      ["ORGANIZATION", 1],
      ["VERBAL_REASONING", 2],
      ["ACHIEVEMENT_MOTIVATION", 2],
      ["COLLABORATION", 1],
    ],
  },
  {
    code: "CREATIVE_DESIGN",
    name: "Creative, Media and Design",
    clusterCode: "CREATIVE",
    clusterName: "Creative and Design",
    description: "Design, media, communication, content and creative production pathways.",
    factors: [
      ["ARTISTIC_INTEREST", 3],
      ["CURIOSITY", 2],
      ["VERBAL_REASONING", 1],
      ["HANDS_ON_LEARNING_PREFERENCE", 1],
      ["INITIATIVE", 1],
    ],
  },
  {
    code: "EDUCATION_SOCIAL_IMPACT",
    name: "Education and Social Impact",
    clusterCode: "PEOPLE_SOCIETY",
    clusterName: "People and Society",
    description: "Teaching, counseling, development, community and people-support pathways.",
    factors: [
      ["SOCIAL_INTEREST", 3],
      ["VERBAL_REASONING", 2],
      ["IMPACT_MOTIVATION", 2],
      ["COLLABORATION", 2],
      ["ACHIEVEMENT_MOTIVATION", 1],
    ],
  },
  {
    code: "LAW_PUBLIC_SERVICE",
    name: "Law, Governance and Public Service",
    clusterCode: "PUBLIC_SERVICE",
    clusterName: "Law and Public Service",
    description: "Law, civil services, governance, public administration and related pathways.",
    factors: [
      ["SOCIAL_INTEREST", 2],
      ["ENTERPRISING_INTEREST", 2],
      ["VERBAL_REASONING", 3],
      ["ORGANIZATION", 1],
      ["IMPACT_MOTIVATION", 2],
      ["LOGICAL_REASONING", 1],
    ],
  },
  {
    code: "SKILLED_APPLIED_TECH",
    name: "Skilled and Applied Technologies",
    clusterCode: "APPLIED_SKILLS",
    clusterName: "Skilled and Applied Work",
    description:
      "Technical trades, applied systems, field service and hands-on technology pathways.",
    factors: [
      ["REALISTIC_INTEREST", 3],
      ["HANDS_ON_LEARNING_PREFERENCE", 3],
      ["LOGICAL_REASONING", 1],
      ["PERSISTENCE", 1],
      ["CONVENTIONAL_INTEREST", 1],
    ],
  },
] as const;

const COLLEGE_PATHS = [
  [
    "SOFTWARE_DATA",
    "Software, Data and AI",
    "DIGITAL",
    "Digital and Technology",
    "Software, data, analytics and AI roles",
    [
      ["INVESTIGATIVE_INTEREST", 3],
      ["NUMERICAL_REASONING", 3],
      ["LOGICAL_REASONING", 3],
      ["CURIOSITY", 2],
      ["PERSISTENCE", 1],
    ],
  ],
  [
    "ENGINEERING_OPERATIONS",
    "Engineering and Technical Operations",
    "ENGINEERING",
    "Engineering and Operations",
    "Engineering, technical operations and applied systems roles",
    [
      ["REALISTIC_INTEREST", 2],
      ["INVESTIGATIVE_INTEREST", 2],
      ["LOGICAL_REASONING", 2],
      ["ORGANIZATION", 2],
      ["PERSISTENCE", 2],
    ],
  ],
  [
    "FINANCE_ANALYTICS",
    "Finance and Business Analytics",
    "BUSINESS",
    "Business and Finance",
    "Finance, accounting, analytics and commercial decision-support roles",
    [
      ["CONVENTIONAL_INTEREST", 2],
      ["NUMERICAL_REASONING", 3],
      ["LOGICAL_REASONING", 2],
      ["ORGANIZATION", 2],
      ["ACHIEVEMENT_MOTIVATION", 1],
    ],
  ],
  [
    "SALES_GROWTH",
    "Sales, Marketing and Growth",
    "BUSINESS",
    "Business and Finance",
    "Sales, marketing, growth and customer-acquisition roles",
    [
      ["ENTERPRISING_INTEREST", 3],
      ["VERBAL_REASONING", 2],
      ["INITIATIVE", 2],
      ["ACHIEVEMENT_MOTIVATION", 2],
      ["COLLABORATION", 1],
    ],
  ],
  [
    "ENTREPRENEURSHIP",
    "Entrepreneurship and Venture Building",
    "ENTERPRISE",
    "Enterprise and Innovation",
    "Startup, venture and independent enterprise pathways",
    [
      ["ENTERPRISING_INTEREST", 3],
      ["INITIATIVE", 3],
      ["AUTONOMY_MOTIVATION", 2],
      ["ADAPTABILITY", 2],
      ["ACHIEVEMENT_MOTIVATION", 2],
    ],
  ],
  [
    "DESIGN_CONTENT",
    "Design, Content and Creative Communication",
    "CREATIVE",
    "Creative and Communication",
    "Design, content, communication and creative production roles",
    [
      ["ARTISTIC_INTEREST", 3],
      ["CURIOSITY", 2],
      ["VERBAL_REASONING", 2],
      ["HANDS_ON_LEARNING_PREFERENCE", 1],
      ["INITIATIVE", 1],
    ],
  ],
  [
    "PEOPLE_LD",
    "People, HR and Learning Development",
    "PEOPLE",
    "People and Development",
    "Human resources, learning, training and people-development roles",
    [
      ["SOCIAL_INTEREST", 3],
      ["COLLABORATION", 2],
      ["VERBAL_REASONING", 2],
      ["IMPACT_MOTIVATION", 2],
      ["STRUCTURED_LEARNING_PREFERENCE", 1],
    ],
  ],
  [
    "RESEARCH_HIGHER_STUDIES",
    "Research and Higher Studies",
    "RESEARCH",
    "Research and Knowledge",
    "Research, academic and specialist knowledge-development pathways",
    [
      ["INVESTIGATIVE_INTEREST", 3],
      ["CURIOSITY", 3],
      ["PERSISTENCE", 2],
      ["NUMERICAL_REASONING", 1],
      ["VERBAL_REASONING", 1],
    ],
  ],
  [
    "PUBLIC_POLICY",
    "Public Policy and Social Impact",
    "PUBLIC",
    "Public and Social Impact",
    "Policy, development, public administration and social-impact roles",
    [
      ["IMPACT_MOTIVATION", 3],
      ["SOCIAL_INTEREST", 2],
      ["VERBAL_REASONING", 2],
      ["ORGANIZATION", 1],
      ["COLLABORATION", 1],
    ],
  ],
  [
    "HEALTH_ALLIED",
    "Healthcare and Allied Services",
    "HEALTH",
    "Health and Care",
    "Healthcare, allied services and patient-support pathways",
    [
      ["SOCIAL_INTEREST", 3],
      ["INVESTIGATIVE_INTEREST", 2],
      ["ACHIEVEMENT_MOTIVATION", 1],
      ["PERSISTENCE", 2],
      ["COLLABORATION", 1],
    ],
  ],
] as const;

const PROFESSIONAL_PATHS = [
  [
    "LEADERSHIP_MANAGEMENT",
    "Leadership and General Management",
    "LEADERSHIP",
    "Leadership and Management",
    "People, business and organizational leadership pathways",
    [
      ["ENTERPRISING_INTEREST", 3],
      ["INITIATIVE", 3],
      ["COLLABORATION", 2],
      ["ACHIEVEMENT_MOTIVATION", 2],
      ["DECISION_QUALITY", 2],
    ],
  ],
  [
    "STRATEGY_CONSULTING",
    "Strategy and Consulting",
    "STRATEGY",
    "Strategy and Advisory",
    "Analytical strategy, advisory and problem-framing pathways",
    [
      ["INVESTIGATIVE_INTEREST", 3],
      ["CURIOSITY", 2],
      ["VERBAL_REASONING", 2],
      ["DATA_INTERPRETATION", 2],
      ["DECISION_QUALITY", 3],
    ],
  ],
  [
    "PRODUCT_INNOVATION",
    "Product and Innovation",
    "INNOVATION",
    "Product and Innovation",
    "Product, innovation and cross-functional development pathways",
    [
      ["CURIOSITY", 3],
      ["INITIATIVE", 2],
      ["ADAPTABILITY", 2],
      ["COLLABORATION", 2],
      ["DECISION_QUALITY", 2],
    ],
  ],
  [
    "SALES_BD",
    "Sales and Business Development",
    "COMMERCIAL",
    "Commercial Growth",
    "Sales, partnerships and business-development pathways",
    [
      ["ENTERPRISING_INTEREST", 3],
      ["ACHIEVEMENT_MOTIVATION", 3],
      ["VERBAL_REASONING", 2],
      ["INITIATIVE", 2],
      ["RECOGNITION_MOTIVATION", 1],
    ],
  ],
  [
    "OPERATIONS_PROJECT",
    "Operations and Project Management",
    "OPERATIONS",
    "Operations and Delivery",
    "Operations, program and project-delivery pathways",
    [
      ["ORGANIZATION", 3],
      ["PERSISTENCE", 2],
      ["COLLABORATION", 2],
      ["DATA_INTERPRETATION", 2],
      ["DECISION_QUALITY", 2],
    ],
  ],
  [
    "SPECIALIST_RESEARCH",
    "Specialist and Research Track",
    "SPECIALIST",
    "Specialist and Research",
    "Deep specialist, research and expert-contributor pathways",
    [
      ["INVESTIGATIVE_INTEREST", 3],
      ["CURIOSITY", 3],
      ["LEARNING_GROWTH_MOTIVATION", 3],
      ["PERSISTENCE", 2],
      ["DATA_INTERPRETATION", 1],
    ],
  ],
  [
    "PEOPLE_LEARNING",
    "People and Learning Leadership",
    "PEOPLE",
    "People and Development",
    "People development, HR, coaching and learning pathways",
    [
      ["SOCIAL_INTEREST", 3],
      ["COLLABORATION", 3],
      ["IMPACT_MOTIVATION", 2],
      ["VERBAL_REASONING", 2],
      ["LEARNING_GROWTH_MOTIVATION", 2],
    ],
  ],
  [
    "ENTREPRENEUR_INDEPENDENT",
    "Entrepreneurship and Independent Practice",
    "ENTERPRISE",
    "Enterprise and Independent Work",
    "Entrepreneurial, advisory and independent-practice pathways",
    [
      ["ENTERPRISING_INTEREST", 3],
      ["AUTONOMY_MOTIVATION", 3],
      ["INITIATIVE", 3],
      ["ADAPTABILITY", 2],
      ["ACHIEVEMENT_MOTIVATION", 2],
    ],
  ],
] as const;

const SKILLED_PATHS = [
  [
    "ELECTRICAL_SOLAR",
    "Electrical and Solar Technician",
    "ELECTRICAL",
    "Electrical and Energy",
    [
      ["REALISTIC_INTEREST", 3],
      ["SAFETY_ORIENTATION", 2],
      ["SAFETY_JUDGMENT", 2],
      ["DETAIL_CHECKING_ACCURACY", 2],
      ["PRACTICAL_NUMERACY", 2],
      ["MECHANICAL_SPATIAL_REASONING", 2],
    ],
  ],
  [
    "HVAC_REFRIGERATION",
    "HVAC and Refrigeration Technician",
    "MECHANICAL",
    "Mechanical Services",
    [
      ["REALISTIC_INTEREST", 3],
      ["PRACTICAL_PROBLEM_SOLVING", 3],
      ["SAFETY_JUDGMENT", 2],
      ["MECHANICAL_SPATIAL_REASONING", 3],
      ["DETAIL_CHECKING_ACCURACY", 2],
    ],
  ],
  [
    "WELDING_FABRICATION",
    "Welding and Fabrication",
    "FABRICATION",
    "Fabrication and Production",
    [
      ["REALISTIC_INTEREST", 3],
      ["SAFETY_JUDGMENT", 3],
      ["DETAIL_CHECKING_ACCURACY", 3],
      ["WORK_PACE_STEADINESS", 2],
      ["MECHANICAL_SPATIAL_REASONING", 2],
    ],
  ],
  [
    "CNC_MACHINE",
    "CNC and Machine Operation",
    "FABRICATION",
    "Fabrication and Production",
    [
      ["ATTENTION_TO_DETAIL", 2],
      ["DETAIL_CHECKING_ACCURACY", 3],
      ["PRACTICAL_NUMERACY", 3],
      ["SAFETY_JUDGMENT", 2],
      ["WORK_PACE_STEADINESS", 2],
      ["LEARNING_READINESS", 2],
    ],
  ],
  [
    "PLUMBING",
    "Plumbing Technician",
    "CONSTRUCTION",
    "Construction Trades",
    [
      ["REALISTIC_INTEREST", 3],
      ["PRACTICAL_PROBLEM_SOLVING", 3],
      ["PRACTICAL_NUMERACY", 2],
      ["ATTENTION_TO_DETAIL", 2],
      ["SERVICE_ORIENTATION", 1],
    ],
  ],
  [
    "CARPENTRY",
    "Carpentry and Woodwork",
    "CONSTRUCTION",
    "Construction Trades",
    [
      ["REALISTIC_INTEREST", 3],
      ["ATTENTION_TO_DETAIL", 3],
      ["PRACTICAL_NUMERACY", 2],
      ["MECHANICAL_SPATIAL_REASONING", 2],
      ["WORK_PACE_STEADINESS", 1],
    ],
  ],
  [
    "MASONRY",
    "Masonry and Construction Work",
    "CONSTRUCTION",
    "Construction Trades",
    [
      ["REALISTIC_INTEREST", 3],
      ["PRACTICAL_NUMERACY", 2],
      ["WORK_PACE_STEADINESS", 2],
      ["TEAMWORK", 2],
      ["SAFETY_ORIENTATION", 2],
    ],
  ],
  [
    "AUTOMOTIVE",
    "Automotive Service Technician",
    "AUTOMOTIVE",
    "Automotive and Mobility",
    [
      ["REALISTIC_INTEREST", 3],
      ["PRACTICAL_PROBLEM_SOLVING", 3],
      ["MECHANICAL_SPATIAL_REASONING", 3],
      ["ATTENTION_TO_DETAIL", 2],
      ["LEARNING_READINESS", 2],
    ],
  ],
  [
    "WAREHOUSE_LOGISTICS",
    "Warehouse and Logistics Operator",
    "LOGISTICS",
    "Logistics and Warehousing",
    [
      ["RELIABILITY", 3],
      ["ATTENTION_TO_DETAIL", 2],
      ["WORK_PACE_STEADINESS", 3],
      ["TEAMWORK", 2],
      ["PRACTICAL_NUMERACY", 2],
    ],
  ],
  [
    "FACILITY_MAINTENANCE",
    "Facility Maintenance Technician",
    "MAINTENANCE",
    "Facility and Maintenance",
    [
      ["PRACTICAL_PROBLEM_SOLVING", 3],
      ["RELIABILITY", 2],
      ["SAFETY_JUDGMENT", 3],
      ["REALISTIC_INTEREST", 2],
      ["LEARNING_READINESS", 2],
    ],
  ],
  [
    "PRODUCTION_ASSEMBLY",
    "Production and Assembly Operator",
    "PRODUCTION",
    "Production and Manufacturing",
    [
      ["WORK_PACE_STEADINESS", 3],
      ["DETAIL_CHECKING_ACCURACY", 3],
      ["RELIABILITY", 3],
      ["TEAMWORK", 2],
      ["SAFETY_JUDGMENT", 2],
    ],
  ],
  [
    "FIELD_SERVICE",
    "Field Service Technician",
    "SERVICE",
    "Field and Customer Service",
    [
      ["SERVICE_ORIENTATION", 3],
      ["PRACTICAL_PROBLEM_SOLVING", 3],
      ["RELIABILITY", 2],
      ["ADAPTABILITY", 2],
      ["REALISTIC_INTEREST", 2],
    ],
  ],
  [
    "FOOD_HOSPITALITY",
    "Food Production and Hospitality Operations",
    "HOSPITALITY",
    "Food and Hospitality",
    [
      ["SERVICE_ORIENTATION", 3],
      ["RELIABILITY", 2],
      ["ATTENTION_TO_DETAIL", 2],
      ["WORK_PACE_STEADINESS", 2],
      ["TEAMWORK", 2],
    ],
  ],
  [
    "CARE_SUPPORT",
    "Care and Support Worker",
    "CARE",
    "Care and Support",
    [
      ["SERVICE_ORIENTATION", 3],
      ["RELIABILITY", 3],
      ["TEAMWORK", 2],
      ["LEARNING_READINESS", 2],
      ["ADAPTABILITY", 2],
    ],
  ],
] as const;

function likertItem(
  prefix: string,
  constructCode: string,
  index: number,
  prompt: PromptDefinition,
): PilotItem {
  const reverse = prompt.reverse === true;
  return {
    code: `${prefix}_${constructCode}_${String(index + 1).padStart(2, "0")}`,
    type: "LIKERT",
    prompt: prompt.text,
    constructCode,
    reverseScored: reverse,
    required: true,
    options: LIKERT_OPTIONS.map(([code, label], optionIndex) => ({
      code,
      label,
      score: reverse ? 5 - optionIndex : optionIndex + 1,
    })),
  };
}

function objectiveItem(
  prefix: string,
  constructCode: string,
  index: number,
  item: ObjectiveDefinition,
): PilotItem {
  return {
    code: `${prefix}_${constructCode}_${String(index + 1).padStart(2, "0")}`,
    type: "SINGLE_CHOICE",
    prompt: item.prompt,
    constructCode,
    reverseScored: false,
    required: true,
    options: item.options.map((label, optionIndex) => ({
      code: String.fromCharCode(65 + optionIndex),
      label,
      score: optionIndex === item.correctIndex ? 1 : 0,
    })),
  };
}

function ranges(items: readonly PilotItem[]): Map<string, { min: number; max: number }> {
  const result = new Map<string, { min: number; max: number }>();
  for (const item of items) {
    const scores = item.options.map((option) => option.score);
    const current = result.get(item.constructCode) ?? { min: 0, max: 0 };
    current.min += Math.min(...scores);
    current.max += Math.max(...scores);
    result.set(item.constructCode, current);
  }
  return result;
}

function careerPaths(
  rawPaths: readonly unknown[],
  allowedConstructCodes: ReadonlySet<string>,
): PilotCareerPath[] {
  return rawPaths.map((raw) => {
    let code: string;
    let name: string;
    let clusterCode: string;
    let clusterName: string;
    let description: string;
    let factorRows: readonly (readonly [string, number])[];

    if (Array.isArray(raw)) {
      const [rawCode, rawName, rawClusterCode, rawClusterName, descriptionOrFactors, maybeFactors] =
        raw;
      code = String(rawCode);
      name = String(rawName);
      clusterCode = String(rawClusterCode);
      clusterName = String(rawClusterName);
      description = Array.isArray(descriptionOrFactors)
        ? `${name} role-family exploration for this pilot.`
        : String(descriptionOrFactors);
      factorRows = (
        Array.isArray(descriptionOrFactors) ? descriptionOrFactors : maybeFactors
      ) as readonly (readonly [string, number])[];
    } else {
      const record = raw as {
        code: string;
        name: string;
        clusterCode: string;
        clusterName: string;
        description: string;
        factors: readonly (readonly [string, number])[];
      };
      code = record.code;
      name = record.name;
      clusterCode = record.clusterCode;
      clusterName = record.clusterName;
      description = record.description;
      factorRows = record.factors;
    }

    const factors = factorRows
      .filter(([constructCode]) => allowedConstructCodes.has(constructCode))
      .map(([constructCode, weight]) => ({
        constructCode,
        weight,
        direction: "POSITIVE" as const,
      }));
    if (factors.length < 3) {
      throw new Error(`Career path ${code} has fewer than three usable factors.`);
    }
    return { code, name, clusterCode, clusterName, description, factors };
  });
}

function buildBattery(input: {
  code: string;
  prefix: string;
  segment: AssessmentProductSegment;
  title: string;
  edition: string;
  expectedMinutes: number;
  promptBank: Record<string, readonly PromptDefinition[]>;
  selfReport: readonly { code: string; count: number }[];
  objectiveBank: Record<string, readonly ObjectiveDefinition[]>;
  objective: readonly { code: string; count: number }[];
  paths: readonly unknown[];
}): PilotBattery {
  const items: PilotItem[] = [];
  for (const selection of input.selfReport) {
    const prompts = input.promptBank[selection.code];
    if (!prompts || prompts.length < selection.count) {
      throw new Error(`Missing self-report item bank for ${selection.code}`);
    }
    prompts.slice(0, selection.count).forEach((prompt, index) => {
      items.push(likertItem(input.prefix, selection.code, index, prompt));
    });
  }
  for (const selection of input.objective) {
    const questions = input.objectiveBank[selection.code];
    if (!questions || questions.length < selection.count) {
      throw new Error(`Missing objective item bank for ${selection.code}`);
    }
    questions.slice(0, selection.count).forEach((question, index) => {
      items.push(objectiveItem(input.prefix, selection.code, index, question));
    });
  }

  const rangeMap = ranges(items);
  const constructCodes = [...rangeMap.keys()];
  const constructs = constructCodes.map((code) => {
    const meta = CONSTRUCT_META[code];
    const range = rangeMap.get(code);
    if (!meta || !range) throw new Error(`Missing construct metadata for ${code}`);
    return {
      code,
      ...meta,
      theoreticalMinimum: range.min,
      theoreticalMaximum: range.max,
    };
  });
  const allowed = new Set(constructCodes);

  return {
    code: input.code,
    segment: input.segment,
    title: input.title,
    edition: input.edition,
    form: "A",
    language: "en",
    versionNumber: 1,
    expectedMinutes: input.expectedMinutes,
    validationStatus: "PILOT_RESEARCH_NOT_NORMED",
    normMode: "THEORETICAL_RANGE_PASS_THROUGH",
    scoringVersion: "pilot-response-score-v1",
    normVersion: "pilot-pass-through-v1",
    interpretationVersion: "pilot-response-interpretation-v1",
    reportVersion: "career-report-v3-pilot",
    careerFitAlgorithmKey: "weighted-scaled-raw",
    careerFitAlgorithmVersion: "1.0.0",
    counselorValidationNotice: COUNSELOR_VALIDATION_NOTICE,
    employmentDecisionNotice:
      input.segment === "PROFESSIONAL" || input.segment === "SKILLED_WORKFORCE"
        ? EMPLOYMENT_DECISION_NOTICE
        : null,
    constructs,
    items,
    careerPaths: careerPaths(input.paths, allowed),
  };
}

const FOUR = 4;
const FIVE = 5;

export const PILOT_BATTERIES: readonly PilotBattery[] = [
  buildBattery({
    code: "EDUMALL_SCHOOL_6_8_CAREER_DISCOVERY",
    prefix: "S68",
    segment: "SCHOOL_6_8",
    title: "The EduMall Career Discovery - Classes 6 to 8",
    edition: "School 6-8 Pilot Research Edition 2026",
    expectedMinutes: 20,
    promptBank: STUDENT_PROMPTS,
    selfReport: [
      { code: "CURIOSITY", count: FOUR },
      { code: "ORGANIZATION", count: FOUR },
      { code: "COLLABORATION", count: FOUR },
      { code: "ADAPTABILITY", count: FOUR },
      { code: "REALISTIC_INTEREST", count: FOUR },
      { code: "INVESTIGATIVE_INTEREST", count: FOUR },
      { code: "ARTISTIC_INTEREST", count: FOUR },
      { code: "SOCIAL_INTEREST", count: FOUR },
      { code: "ENTERPRISING_INTEREST", count: FOUR },
      { code: "CONVENTIONAL_INTEREST", count: FOUR },
      { code: "ACHIEVEMENT_MOTIVATION", count: FOUR },
      { code: "HANDS_ON_LEARNING_PREFERENCE", count: FOUR },
    ],
    objectiveBank: SCHOOL_APTITUDE,
    objective: [
      { code: "NUMERICAL_REASONING", count: 4 },
      { code: "VERBAL_REASONING", count: 4 },
      { code: "LOGICAL_REASONING", count: 4 },
    ],
    paths: STUDENT_PATHS,
  }),
  buildBattery({
    code: "EDUMALL_SCHOOL_9_10_CAREER_GUIDANCE",
    prefix: "S910",
    segment: "SCHOOL_9_10",
    title: "The EduMall Career Guidance - Classes 9 to 10",
    edition: "School 9-10 Pilot Research Edition 2026",
    expectedMinutes: 30,
    promptBank: STUDENT_PROMPTS,
    selfReport: [
      { code: "CURIOSITY", count: FOUR },
      { code: "ORGANIZATION", count: FOUR },
      { code: "COLLABORATION", count: FOUR },
      { code: "INITIATIVE", count: FOUR },
      { code: "PERSISTENCE", count: FOUR },
      { code: "REALISTIC_INTEREST", count: FOUR },
      { code: "INVESTIGATIVE_INTEREST", count: FOUR },
      { code: "ARTISTIC_INTEREST", count: FOUR },
      { code: "SOCIAL_INTEREST", count: FOUR },
      { code: "ENTERPRISING_INTEREST", count: FOUR },
      { code: "CONVENTIONAL_INTEREST", count: FOUR },
      { code: "ACHIEVEMENT_MOTIVATION", count: FOUR },
      { code: "AUTONOMY_MOTIVATION", count: FOUR },
      { code: "IMPACT_MOTIVATION", count: FOUR },
      { code: "STRUCTURED_LEARNING_PREFERENCE", count: FOUR },
    ],
    objectiveBank: SCHOOL_APTITUDE,
    objective: [
      { code: "NUMERICAL_REASONING", count: 5 },
      { code: "VERBAL_REASONING", count: 5 },
      { code: "LOGICAL_REASONING", count: 5 },
    ],
    paths: STUDENT_PATHS,
  }),
  buildBattery({
    code: "EDUMALL_SCHOOL_11_12_CAREER_INTELLIGENCE",
    prefix: "S1112",
    segment: "SCHOOL_11_12",
    title: "The EduMall Career Intelligence - Classes 11 to 12",
    edition: "School 11-12 Pilot Research Edition 2026",
    expectedMinutes: 40,
    promptBank: STUDENT_PROMPTS,
    selfReport: [
      { code: "CURIOSITY", count: FOUR },
      { code: "ORGANIZATION", count: FOUR },
      { code: "COLLABORATION", count: FOUR },
      { code: "INITIATIVE", count: FOUR },
      { code: "ADAPTABILITY", count: FOUR },
      { code: "PERSISTENCE", count: FOUR },
      { code: "REALISTIC_INTEREST", count: FOUR },
      { code: "INVESTIGATIVE_INTEREST", count: FOUR },
      { code: "ARTISTIC_INTEREST", count: FOUR },
      { code: "SOCIAL_INTEREST", count: FOUR },
      { code: "ENTERPRISING_INTEREST", count: FOUR },
      { code: "CONVENTIONAL_INTEREST", count: FOUR },
      { code: "ACHIEVEMENT_MOTIVATION", count: FOUR },
      { code: "AUTONOMY_MOTIVATION", count: FOUR },
      { code: "IMPACT_MOTIVATION", count: FOUR },
      { code: "LEARNING_GROWTH_MOTIVATION", count: FOUR },
      { code: "STRUCTURED_LEARNING_PREFERENCE", count: FOUR },
      { code: "HANDS_ON_LEARNING_PREFERENCE", count: FOUR },
    ],
    objectiveBank: SCHOOL_APTITUDE,
    objective: [
      { code: "NUMERICAL_REASONING", count: 6 },
      { code: "VERBAL_REASONING", count: 6 },
      { code: "LOGICAL_REASONING", count: 6 },
    ],
    paths: STUDENT_PATHS,
  }),
  buildBattery({
    code: "EDUMALL_COLLEGE_CAREER_INTELLIGENCE",
    prefix: "COL",
    segment: "COLLEGE",
    title: "The EduMall College and Graduate Career Intelligence",
    edition: "College UG-PG Pilot Research Edition 2026",
    expectedMinutes: 45,
    promptBank: ADULT_PROMPTS,
    selfReport: [
      { code: "CURIOSITY", count: FOUR },
      { code: "ORGANIZATION", count: FOUR },
      { code: "COLLABORATION", count: FOUR },
      { code: "INITIATIVE", count: FOUR },
      { code: "ADAPTABILITY", count: FOUR },
      { code: "PERSISTENCE", count: FOUR },
      { code: "REALISTIC_INTEREST", count: FOUR },
      { code: "INVESTIGATIVE_INTEREST", count: FOUR },
      { code: "ARTISTIC_INTEREST", count: FOUR },
      { code: "SOCIAL_INTEREST", count: FOUR },
      { code: "ENTERPRISING_INTEREST", count: FOUR },
      { code: "CONVENTIONAL_INTEREST", count: FOUR },
      { code: "ACHIEVEMENT_MOTIVATION", count: FOUR },
      { code: "AUTONOMY_MOTIVATION", count: FOUR },
      { code: "IMPACT_MOTIVATION", count: FOUR },
      { code: "LEARNING_GROWTH_MOTIVATION", count: FOUR },
      { code: "STRUCTURED_LEARNING_PREFERENCE", count: FOUR },
      { code: "HANDS_ON_LEARNING_PREFERENCE", count: FOUR },
    ],
    objectiveBank: COLLEGE_APTITUDE,
    objective: [
      { code: "NUMERICAL_REASONING", count: 6 },
      { code: "VERBAL_REASONING", count: 6 },
      { code: "LOGICAL_REASONING", count: 6 },
    ],
    paths: COLLEGE_PATHS,
  }),
  buildBattery({
    code: "EDUMALL_PROFESSIONAL_CAREER_INTELLIGENCE",
    prefix: "PRO",
    segment: "PROFESSIONAL",
    title: "The EduMall Professional Career Intelligence",
    edition: "Professional Pilot Research Edition 2026",
    expectedMinutes: 40,
    promptBank: ADULT_PROMPTS,
    selfReport: [
      { code: "CURIOSITY", count: FOUR },
      { code: "ORGANIZATION", count: FOUR },
      { code: "COLLABORATION", count: FOUR },
      { code: "INITIATIVE", count: FOUR },
      { code: "ADAPTABILITY", count: FOUR },
      { code: "INVESTIGATIVE_INTEREST", count: FOUR },
      { code: "SOCIAL_INTEREST", count: FOUR },
      { code: "ENTERPRISING_INTEREST", count: FOUR },
      { code: "CONVENTIONAL_INTEREST", count: FOUR },
      { code: "ACHIEVEMENT_MOTIVATION", count: FOUR },
      { code: "AUTONOMY_MOTIVATION", count: FOUR },
      { code: "IMPACT_MOTIVATION", count: FOUR },
      { code: "SECURITY_MOTIVATION", count: FOUR },
      { code: "LEARNING_GROWTH_MOTIVATION", count: FOUR },
      { code: "RECOGNITION_MOTIVATION", count: FOUR },
      { code: "REFLECTIVE_LEARNING_PREFERENCE", count: FOUR },
    ],
    objectiveBank: PROFESSIONAL_APTITUDE,
    objective: [
      { code: "DATA_INTERPRETATION", count: 4 },
      { code: "VERBAL_REASONING", count: 4 },
      { code: "DECISION_QUALITY", count: 4 },
      { code: "SITUATIONAL_JUDGMENT", count: 4 },
    ],
    paths: PROFESSIONAL_PATHS,
  }),
  buildBattery({
    code: "EDUMALL_SKILLED_WORKFORCE_CAREER_INTELLIGENCE",
    prefix: "SKW",
    segment: "SKILLED_WORKFORCE",
    title: "The EduMall Skilled Workforce and Blue-Collar Career Intelligence",
    edition: "Skilled Workforce Blue-Collar Pilot Research Edition 2026",
    expectedMinutes: 35,
    promptBank: SKILLED_PROMPTS,
    selfReport: [
      { code: "RELIABILITY", count: FIVE },
      { code: "SAFETY_ORIENTATION", count: FIVE },
      { code: "PRACTICAL_PROBLEM_SOLVING", count: FIVE },
      { code: "TEAMWORK", count: FIVE },
      { code: "ATTENTION_TO_DETAIL", count: FIVE },
      { code: "ADAPTABILITY", count: FIVE },
      { code: "SERVICE_ORIENTATION", count: FIVE },
      { code: "LEARNING_READINESS", count: FIVE },
      { code: "REALISTIC_INTEREST", count: FIVE },
      { code: "WORK_PACE_STEADINESS", count: FIVE },
    ],
    objectiveBank: SKILLED_APTITUDE,
    objective: [
      { code: "PRACTICAL_NUMERACY", count: 5 },
      { code: "MECHANICAL_SPATIAL_REASONING", count: 5 },
      { code: "SAFETY_JUDGMENT", count: 5 },
      { code: "DETAIL_CHECKING_ACCURACY", count: 5 },
    ],
    paths: SKILLED_PATHS,
  }),
] as const;

export const PILOT_PROFILE_BANDS = [
  { code: "LOWER_OBSERVED", scaledMin: 0, scaledMax: 24.9999, label: "Lower observed pattern" },
  { code: "DEVELOPING", scaledMin: 25, scaledMax: 49.9999, label: "Developing pattern" },
  {
    code: "MODERATE_STRENGTH",
    scaledMin: 50,
    scaledMax: 74.9999,
    label: "Moderate observed strength",
  },
  { code: "STRONG_OBSERVED", scaledMin: 75, scaledMax: 100, label: "Strong observed pattern" },
] as const;

export const PILOT_CAREER_FIT_BANDS = [
  { code: "EXPLORE_CAUTIOUSLY", lower: 0, upper: 39.9999, label: "Explore cautiously" },
  {
    code: "POSSIBLE_ALIGNMENT",
    lower: 40,
    upper: 59.9999,
    label: "Possible response-based alignment",
  },
  {
    code: "PROMISING_ALIGNMENT",
    lower: 60,
    upper: 74.9999,
    label: "Promising response-based alignment",
  },
  { code: "STRONG_ALIGNMENT", lower: 75, upper: 100, label: "Strong response-based alignment" },
] as const;

export function getPilotBattery(segment: AssessmentProductSegment): PilotBattery {
  const battery = PILOT_BATTERIES.find((candidate) => candidate.segment === segment);
  if (!battery) throw new Error(`Pilot battery not found for segment ${segment}`);
  return battery;
}
