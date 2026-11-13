import type { Plan, Material, Assessment, Defense, Completion } from '../shared/schema.ts';
export const plan: Plan = {
  title: 'Reasoning about sample means',
  introduction: 'Why can repeated noisy measurements support an estimate?',
  objectives: ['Derive the variance of a sample mean', 'Design a reproducible investigation'],
  prerequisites: [
    { concept: 'Expectation', why: 'Needed for derivation', check: 'What is E[X+Y]?' },
  ],
  activities: [
    {
      title: 'Independent reasoning',
      kind: 'problem',
      minutes: 20,
      purpose: 'Derive rather than recall.',
      concepts: ['Sample mean'],
      closedBook: true,
      criteria: [
        { name: 'Variance argument', description: 'State independence and justify the 1/n rate.' },
      ],
    },
    {
      title: 'A reproducible investigation',
      kind: 'lab',
      minutes: 30,
      purpose: 'Test a scaling prediction with independent replicates.',
      concepts: ['Monte Carlo error'],
      closedBook: false,
      criteria: [{ name: 'Design', description: 'Vary a factor and preserve controls.' }],
    },
  ],
};
export const simulator = `import json, random
c=json.load(open('config.json'))
rng=random.Random(c['seed'])
n=int(c['parameters']['n'])
rows=[]
for i in range(40):
    mean=sum(rng.gauss(0,1) for _ in range(n))/n
    rows.append({'replicate':i,'sample_mean':mean})
json.dump({'measurements':rows,'summary':{'kind':'synthetic'}},open('result.json','w'))
print('Collected',len(rows),'independent simulated means')`;
export const material: Material = {
  body: `For independent observations with variance $\\sigma^2$.

$$
\\mathrm{Var}(\\bar X)=\\sigma^2/n.
$$

This depends on independence.

| Parameter | Meaning |
| --- | --- |
| $n$ | Number of independent observations |
| $\\sigma^2$ | Variance of each observation |
| $\\bar X$ | Sample mean of the observations |
| $\\mathrm{Var}(\\bar X)$ | Variance of the sample mean, equal to $\\sigma^2/n$ |

Keep the assumptions explicit when applying the formula.`,
  prompt: 'Derive the variance formula and explain what changes under correlation.',
  references: [],
  hints: ['Expand the variance of a sum.', 'Which covariance terms vanish?'],
  starterCode: '',
  lab: null,
};
export const labMaterial: Material = {
  ...material,
  lab: {
    question: 'How does sample size change the spread of repeated sample means?',
    modelAssumptions: 'Independent Gaussian synthetic observations. Not physical measurements.',
    independentVariable: 'Sample size n',
    dependentVariable: 'Spread of replicate means',
    controls: [{ key: 'n', label: 'Sample size', min: 2, max: 200, step: 1, initial: 16 }],
    simulator,
    analysisStarter:
      "import json, statistics\ntrials=json.load(open('trials.json'))\nfor t in trials:\n    print(statistics.stdev(r['sample_mean'] for r in t['result']['measurements']))",
    procedure:
      'Predict a change, then compare repeated independent replicates at selected conditions.',
    limitations:
      'This tests a simulator under its assumptions, not the applicability of independence in real data.',
  },
};
export const assessment: Assessment = {
  summary: 'The dependence assumption remains unresolved.',
  judgment: 'developing',
  criteria: [
    {
      name: 'Variance argument',
      finding: 'The covariance terms were omitted.',
      evidence: 'Variance decreases with sample size.',
      status: 'partial',
    },
  ],
  strengths: ['Recognizes a decrease in uncertainty.'],
  weaknesses: ['Does not establish independence.'],
  followUp: 'What if all observations share a common noise term?',
  concepts: [
    {
      name: 'Sample mean',
      understanding: 'Predicts decreasing uncertainty.',
      uncertainty: 'Dependence has not been addressed.',
      confidence: 'moderate',
    },
  ],
};
export const defense: Defense = {
  introduction: 'AI-simulated reviewers ask about your actual argument.',
  reviewers: [
    {
      perspective: 'Mathematics',
      observation: 'An independence assumption is implicit.',
      evidence: 'Variance decreases with sample size.',
      question: 'Where did covariance disappear?',
    },
    {
      perspective: 'Methodology',
      observation: 'No repeated trials were supplied.',
      evidence: 'Variance decreases with sample size.',
      question: 'What would you measure to test that claim?',
    },
    {
      perspective: 'Interpretation',
      observation: 'Generalizability is uncertain.',
      evidence: 'Variance decreases with sample size.',
      question: 'Under what data process could this fail?',
    },
  ],
};
export const completion: Completion = {
  synthesis: 'The work shows a useful conjecture with an unresolved dependence assumption.',
  demonstrated: ['Recognized sample-size scaling.'],
  unresolved: ['Derive covariance terms.'],
  retention: 'Only immediate performance was observed. Long-term retention is untested.',
  recommendations: (
    ['depth', 'foundation', 'research', 'application', 'connection', 'project'] as const
  ).map((kind, i) => ({
    kind,
    title: [
      'Dependent sample means',
      'Covariance foundations',
      'Read a sampling paper',
      'Estimate a noisy signal',
      'Connect to correlated physics measurements',
      'Build a Monte Carlo estimator',
    ][i],
    rationale: 'Extend an open question from the submitted evidence.',
    objective: 'Investigate ' + kind + ' of sample mean uncertainty',
    hours: 2,
  })),
};
